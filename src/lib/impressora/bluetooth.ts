/**
 * Transporte Bluetooth para impressoras térmicas no navegador.
 * Usa Web Bluetooth para GATT/BLE e faz fallback para Web Serial em impressoras
 * Bluetooth Classic (RFCOMM/SPP) no Chrome desktop.
 */

/// <reference path="./web-bluetooth.d.ts" />
/// <reference path="./web-serial.d.ts" />

import { DispositivoBluetooth, StatusConexao } from './types'

const UUIDS_SERVICO_IMPRESSORA = [
  '000018f0-0000-1000-8000-00805f9b34fb',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455',
  'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
]

const UUIDS_CARACTERISTICA_ESCRITA = [
  '00002af1-0000-1000-8000-00805f9b34fb',
  '49535343-8841-43f4-a8d4-ecbe34729bb3',
  'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f',
]

const TAMANHO_CHUNK_PADRAO = 180
const INTERVALO_CHUNK_MS = 24
const TAMANHO_CHUNK_SERIAL = 512
const BAUD_RATE_SERIAL = 9600
const ID_DISPOSITIVO_SERIAL = 'serial-rfcomm'
const NOME_DISPOSITIVO_SERIAL = 'Impressora Bluetooth (Serial)'
const TEMPO_ESTABILIZACAO_MS = 500

type ListenerDesconexao = () => void
type TransporteConexao = 'bluetooth-le' | 'serial-rfcomm' | null

type OpcaoReconexao = {
  dispositivoId?: string | null
  dispositivoNome?: string | null
}

const aguardar = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const erroCanceladoPeloUsuario = (erro: unknown) =>
  erro instanceof DOMException && erro.name === 'NotFoundError'

const preferirSerialNoDesktop = () => {
  if (typeof navigator === 'undefined') return false
  const userAgent = navigator.userAgent.toLowerCase()
  return 'serial' in navigator && !/android|iphone|ipad|ipod/.test(userAgent)
}

class GerenciadorBluetooth {
  private dispositivo: BluetoothDevice | null = null
  private servidor: BluetoothRemoteGATTServer | null = null
  private caracteristica: BluetoothRemoteGATTCharacteristic | null = null
  private portaSerial: SerialPort | null = null
  private escritorSerial: WritableStreamDefaultWriter<Uint8Array> | null = null
  private transporte: TransporteConexao = null
  private status: StatusConexao = 'desconectado'
  private ultimaMensagemErro: string | null = null
  private callbacksStatus: Set<(status: StatusConexao) => void> = new Set()
  private infoDispositivo: DispositivoBluetooth | null = null
  private listenerDesconexao: ListenerDesconexao | null = null
  private tokenConexao = 0
  private desconexaoSolicitada = false

  verificarSuporte(): boolean {
    return typeof navigator !== 'undefined' && ('bluetooth' in navigator || 'serial' in navigator)
  }

  obterStatus(): StatusConexao {
    return this.status
  }

  obterDispositivo(): DispositivoBluetooth | null {
    return this.infoDispositivo
  }

  obterUltimoErro(): string | null {
    return this.ultimaMensagemErro
  }

  aoMudarStatus(callback: (status: StatusConexao) => void): () => void {
    this.callbacksStatus.add(callback)
    return () => this.callbacksStatus.delete(callback)
  }

  private atualizarStatus(novoStatus: StatusConexao): void {
    this.status = novoStatus
    this.callbacksStatus.forEach((callback) => callback(novoStatus))
  }

  private registrarErro(erro: unknown, fallback: string) {
    this.ultimaMensagemErro = erro instanceof Error ? erro.message : fallback
  }

  private suportaBluetoothLE() {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator
  }

  private suportaSerial() {
    return typeof navigator !== 'undefined' && 'serial' in navigator
  }

  private criarTokenConexao() {
    this.tokenConexao += 1
    return this.tokenConexao
  }

  private tokenConexaoValido(token: number) {
    return token === this.tokenConexao
  }

  private registrarListenerDesconexao(dispositivo: BluetoothDevice, token: number) {
    if (this.dispositivo && this.listenerDesconexao) {
      this.dispositivo.removeEventListener('gattserverdisconnected', this.listenerDesconexao)
    }

    this.listenerDesconexao = () => {
      if (!this.tokenConexaoValido(token) || this.desconexaoSolicitada) return
      this.aoDesconectar()
    }

    dispositivo.addEventListener('gattserverdisconnected', this.listenerDesconexao)
  }

  private async limparConexaoAtivaSilenciosamente() {
    if (this.escritorSerial) {
      try {
        this.escritorSerial.releaseLock()
      } catch {
        // Ignora erro ao liberar lock.
      }
    }

    if (this.portaSerial) {
      try {
        await this.portaSerial.close()
      } catch {
        // Ignora erro ao fechar porta serial.
      }
    }

    if (this.dispositivo && this.listenerDesconexao) {
      try {
        this.dispositivo.removeEventListener('gattserverdisconnected', this.listenerDesconexao)
      } catch {
        // Ignora erro ao remover listener antigo.
      }
    }

    if (this.servidor?.connected) {
      try {
        this.servidor.disconnect()
      } catch {
        // Ignora erro ao desconectar servidor GATT anterior.
      }
    }

    this.dispositivo = null
    this.servidor = null
    this.caracteristica = null
    this.portaSerial = null
    this.escritorSerial = null
    this.transporte = null
    this.infoDispositivo = null
    this.listenerDesconexao = null
  }

  private async estabilizarConexao(token: number) {
    await aguardar(TEMPO_ESTABILIZACAO_MS)

    if (!this.tokenConexaoValido(token)) {
      throw new Error('A tentativa de conexao foi substituida por outra.')
    }

    if (this.transporte === 'bluetooth-le' && !this.servidor?.connected) {
      throw new Error('A impressora BLE desconectou logo apos conectar.')
    }

    if (this.transporte === 'serial-rfcomm' && (!this.portaSerial || !this.escritorSerial)) {
      throw new Error('A porta serial nao permaneceu disponivel apos abrir a conexao.')
    }
  }

  private async conectarAoDispositivo(dispositivo: BluetoothDevice): Promise<DispositivoBluetooth | null> {
    const token = this.criarTokenConexao()
    this.desconexaoSolicitada = true
    await this.limparConexaoAtivaSilenciosamente()

    try {
      const servidor = dispositivo.gatt?.connected
        ? dispositivo.gatt
        : await dispositivo.gatt?.connect()

      if (!servidor) {
        throw new Error('Nao foi possivel conectar ao servidor GATT.')
      }

      this.dispositivo = dispositivo
      this.servidor = servidor
      this.transporte = 'bluetooth-le'
      this.caracteristica = await this.buscarCaracteristicaEscrita(servidor)

      if (!this.caracteristica) {
        throw new Error(
          'Nenhuma characteristic gravavel foi encontrada via BLE. Se a impressora usa Bluetooth Classico/SPP, conecte pelo modo Serial do navegador.'
        )
      }

      this.infoDispositivo = {
        id: dispositivo.id,
        nome: dispositivo.name || 'Impressora Bluetooth',
        linguagem: 'esc-pos',
        mapeamentoCodepage: 'ascii-folded',
      }

      this.registrarListenerDesconexao(dispositivo, token)
      await this.estabilizarConexao(token)
      this.desconexaoSolicitada = false
      this.ultimaMensagemErro = null
      this.atualizarStatus('conectado')
      return this.infoDispositivo
    } catch (erro) {
      await this.limparConexaoAtivaSilenciosamente()
      this.desconexaoSolicitada = false
      this.registrarErro(erro, 'Falha ao conectar via Bluetooth BLE.')
      throw erro
    }
  }

  private async conectarViaSerial(porta?: SerialPort | null): Promise<DispositivoBluetooth | null> {
    if (!this.suportaSerial()) {
      return null
    }

    const token = this.criarTokenConexao()
    this.desconexaoSolicitada = true
    await this.limparConexaoAtivaSilenciosamente()

    try {
      const portaSelecionada = porta ?? await navigator.serial.requestPort()
      await portaSelecionada.open({
        baudRate: BAUD_RATE_SERIAL,
        bufferSize: 8192,
      })

      const escritor = portaSelecionada.writable?.getWriter()
      if (!escritor) {
        throw new Error('A porta serial foi aberta, mas nao disponibilizou canal de escrita.')
      }

      this.portaSerial = portaSelecionada
      this.escritorSerial = escritor
      this.transporte = 'serial-rfcomm'
      this.infoDispositivo = {
        id: ID_DISPOSITIVO_SERIAL,
        nome: NOME_DISPOSITIVO_SERIAL,
        linguagem: 'esc-pos',
        mapeamentoCodepage: 'ascii-folded',
      }

      await this.estabilizarConexao(token)
      this.desconexaoSolicitada = false
      this.ultimaMensagemErro = null
      this.atualizarStatus('conectado')
      return this.infoDispositivo
    } catch (erro) {
      await this.limparConexaoAtivaSilenciosamente()
      this.desconexaoSolicitada = false
      this.registrarErro(erro, 'Falha ao conectar pela porta serial da impressora.')
      throw erro
    }
  }

  async conectar(): Promise<DispositivoBluetooth | null> {
    if (!this.verificarSuporte()) {
      return null
    }

    this.atualizarStatus('conectando')

    const tentativas: Array<() => Promise<DispositivoBluetooth | null>> = []

    if (preferirSerialNoDesktop()) {
      tentativas.push(() => this.conectarViaSerial())
    }

    if (this.suportaBluetoothLE()) {
      tentativas.push(async () => {
        const dispositivo = await navigator.bluetooth.requestDevice({
          acceptAllDevices: true,
          optionalServices: UUIDS_SERVICO_IMPRESSORA,
        })
        return this.conectarAoDispositivo(dispositivo)
      })
    }

    if (!preferirSerialNoDesktop() && this.suportaSerial()) {
      tentativas.push(() => this.conectarViaSerial())
    }

    let ultimoErro: unknown = null

    for (const tentativa of tentativas) {
      try {
        const dispositivo = await tentativa()
        if (dispositivo) {
          return dispositivo
        }
      } catch (erro) {
        if (erroCanceladoPeloUsuario(erro)) {
          continue
        }

        ultimoErro = erro
        this.registrarErro(erro, 'Falha ao conectar com a impressora.')
        console.error('[Bluetooth] Falha em uma tentativa de conexao:', erro)
      }
    }

    if (ultimoErro) {
      this.atualizarStatus('erro')
      return null
    }

    this.atualizarStatus('desconectado')
    return null
  }

  private async buscarCaracteristicaEscrita(
    servidor: BluetoothRemoteGATTServer
  ): Promise<BluetoothRemoteGATTCharacteristic | null> {
    for (const uuidServico of UUIDS_SERVICO_IMPRESSORA) {
      try {
        const servico = await servidor.getPrimaryService(uuidServico)
        const caracteristica = await this.buscarCaracteristicaNoServico(servico)
        if (caracteristica) return caracteristica
      } catch {
        // Continua para o próximo serviço conhecido.
      }
    }

    try {
      const servicos = await servidor.getPrimaryServices()
      for (const servico of servicos) {
        const caracteristica = await this.buscarCaracteristicaNoServico(servico)
        if (caracteristica) return caracteristica
      }
    } catch (erro) {
      console.error('[Bluetooth] Erro ao inspecionar servicos GATT:', erro)
    }

    return null
  }

  private async buscarCaracteristicaNoServico(
    servico: BluetoothRemoteGATTService
  ): Promise<BluetoothRemoteGATTCharacteristic | null> {
    for (const uuidCaract of UUIDS_CARACTERISTICA_ESCRITA) {
      try {
        const caracteristica = await servico.getCharacteristic(uuidCaract)
        if (caracteristica.properties.write || caracteristica.properties.writeWithoutResponse) {
          return caracteristica
        }
      } catch {
        // Continua procurando.
      }
    }

    const caracteristicas = await servico.getCharacteristics()
    for (const caracteristica of caracteristicas) {
      if (caracteristica.properties.write || caracteristica.properties.writeWithoutResponse) {
        return caracteristica
      }
    }

    return null
  }

  async reconectar(opcoes: OpcaoReconexao = {}): Promise<DispositivoBluetooth | null> {
    if (!this.verificarSuporte()) {
      return null
    }

    this.atualizarStatus('conectando')

    try {
      const tentarSerialPrimeiro =
        opcoes.dispositivoId === ID_DISPOSITIVO_SERIAL ||
        (!opcoes.dispositivoId && preferirSerialNoDesktop())

      if (this.suportaSerial() && tentarSerialPrimeiro) {
        const portas = await navigator.serial.getPorts()
        const portaPreferida = portas.find((porta) => porta.connected !== false) || portas[0] || null
        if (portaPreferida) {
          return await this.conectarViaSerial(portaPreferida)
        }
      }

      if (this.suportaBluetoothLE() && navigator.bluetooth.getDevices) {
        const dispositivos = await navigator.bluetooth.getDevices()
        const dispositivo =
          dispositivos.find((item) => item.id === opcoes.dispositivoId) ||
          dispositivos.find((item) => (item.name || '') === (opcoes.dispositivoNome || '')) ||
          null

        if (dispositivo) {
          return await this.conectarAoDispositivo(dispositivo)
        }
      }

      if (this.suportaSerial() && !tentarSerialPrimeiro) {
        const portas = await navigator.serial.getPorts()
        const portaPreferida = portas.find((porta) => porta.connected !== false) || portas[0] || null
        if (portaPreferida) {
          return await this.conectarViaSerial(portaPreferida)
        }
      }

      this.atualizarStatus('desconectado')
      return null
    } catch (erro) {
      console.error('[Bluetooth] Erro ao reconectar:', erro)
      this.registrarErro(erro, 'Falha ao reconectar com a impressora.')
      this.atualizarStatus('desconectado')
      return null
    }
  }

  async desconectar(): Promise<void> {
    this.desconexaoSolicitada = true
    this.criarTokenConexao()

    try {
      if (this.escritorSerial) {
        try {
          this.escritorSerial.releaseLock()
        } catch {
          // Ignora erro ao liberar lock do writer serial.
        }
      }

      if (this.portaSerial) {
        await this.portaSerial.close().catch((erro) => {
          console.error('[Bluetooth] Erro ao fechar porta serial:', erro)
        })
      }

      if (this.servidor?.connected) {
        this.servidor.disconnect()
      }
    } catch (erro) {
      console.error('[Bluetooth] Erro ao desconectar:', erro)
    } finally {
      this.aoDesconectar()
    }
  }

  private aoDesconectar(): void {
    this.desconexaoSolicitada = false

    if (this.dispositivo && this.listenerDesconexao) {
      this.dispositivo.removeEventListener('gattserverdisconnected', this.listenerDesconexao)
    }

    this.dispositivo = null
    this.servidor = null
    this.caracteristica = null
    this.portaSerial = null
    this.escritorSerial = null
    this.transporte = null
    this.infoDispositivo = null
    this.listenerDesconexao = null
    this.ultimaMensagemErro = null
    this.atualizarStatus('desconectado')
  }

  async enviar(dados: Uint8Array): Promise<boolean> {
    if (this.transporte === 'serial-rfcomm') {
      if (!this.escritorSerial) {
        return false
      }

      try {
        for (let indice = 0; indice < dados.length; indice += TAMANHO_CHUNK_SERIAL) {
          const chunk = dados.slice(indice, Math.min(indice + TAMANHO_CHUNK_SERIAL, dados.length))
          await this.escritorSerial.write(chunk)

          if (indice + TAMANHO_CHUNK_SERIAL < dados.length) {
            await aguardar(INTERVALO_CHUNK_MS)
          }
        }

        return true
      } catch (erro) {
        console.error('[Bluetooth] Erro ao enviar dados pela porta serial:', erro)
        this.registrarErro(erro, 'Falha ao enviar dados para a impressora pela porta serial.')
        this.aoDesconectar()
        return false
      }
    }

    if (!this.caracteristica) {
      return false
    }

    try {
      const chunkSize = this.caracteristica.properties.writeWithoutResponse
        ? TAMANHO_CHUNK_PADRAO
        : Math.min(512, dados.length || 512)

      for (let indice = 0; indice < dados.length; indice += chunkSize) {
        const chunk = dados.slice(indice, Math.min(indice + chunkSize, dados.length))

        if (this.caracteristica.properties.writeWithoutResponse) {
          await this.caracteristica.writeValueWithoutResponse(chunk)
        } else {
          await this.caracteristica.writeValue(chunk)
        }

        if (indice + chunkSize < dados.length) {
          await new Promise((resolve) => setTimeout(resolve, INTERVALO_CHUNK_MS))
        }
      }

      return true
    } catch (erro) {
      console.error('[Bluetooth] Erro ao enviar dados para a impressora:', erro)
      this.registrarErro(erro, 'Falha ao enviar dados para a impressora Bluetooth.')

      if (!this.servidor?.connected) {
        this.aoDesconectar()
      } else {
        this.atualizarStatus('erro')
      }

      return false
    }
  }

  estaConectado(): boolean {
    if (this.transporte === 'serial-rfcomm') {
      return this.status === 'conectado' && Boolean(this.portaSerial && this.escritorSerial)
    }

    return this.status === 'conectado' && Boolean(this.caracteristica)
  }
}

export const gerenciadorBluetooth = new GerenciadorBluetooth()
export { GerenciadorBluetooth }
