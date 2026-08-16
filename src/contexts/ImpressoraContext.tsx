'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { type RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { gerenciadorBluetooth, gerarTicket, gerarTicketTeste } from '@/lib/impressora'
import {
  buscarPendenciasImpressao,
  liberarFilaTravada,
  marcarFilaComoErro,
  marcarFilaComoImpressa,
  montarTrabalhoImpressaoFila,
  reivindicarFilaImpressao,
} from '@/lib/impressora/fila'
import {
  CONFIGURACAO_PADRAO,
  type ConfiguracaoImpressora,
  type DadosPedidoImpressao,
  type DispositivoBluetooth,
  type StatusConexao,
  type TipoTicket,
  type TamanhoPapel,
} from '@/lib/impressora/types'

const CHAVES_CONFIG = {
  DISPOSITIVO_ID: 'impressora_dispositivo_id',
  DISPOSITIVO_NOME: 'impressora_dispositivo_nome',
  TAMANHO_PAPEL: 'impressora_tamanho_papel',
  AUTO_IMPRIMIR: 'impressora_auto_imprimir',
  IMPRIMIR_CLIENTE: 'impressora_imprimir_cliente',
  IMPRIMIR_COZINHA: 'impressora_imprimir_cozinha',
  COPIAS_CLIENTE: 'impressora_copias_cliente',
  COPIAS_COZINHA: 'impressora_copias_cozinha',
} as const

interface ImpressoraContextType {
  status: StatusConexao
  dispositivo: DispositivoBluetooth | null
  configuracao: ConfiguracaoImpressora
  erroConexao: string | null
  suportado: boolean
  carregando: boolean
  conectar: () => Promise<boolean>
  desconectar: () => Promise<void>
  imprimir: (dados: DadosPedidoImpressao, tipo: TipoTicket) => Promise<boolean>
  testarImpressao: () => Promise<boolean>
  atualizarConfiguracao: (config: Partial<ConfiguracaoImpressora>) => Promise<void>
}

const ImpressoraContext = createContext<ImpressoraContextType | null>(null)

interface ImpressoraProviderProps {
  children: ReactNode
}

async function carregarConfiguracoesPersistidas() {
  const { data, error } = await supabase
    .from('configuracoes_loja')
    .select('chave, valor')
    .in('chave', Object.values(CHAVES_CONFIG))

  if (error) {
    throw error
  }

  const mapa: Record<string, string> = {}
  for (const item of data || []) {
    mapa[item.chave] = item.valor
  }

  return {
    dispositivoId: mapa[CHAVES_CONFIG.DISPOSITIVO_ID] || null,
    dispositivoNome: mapa[CHAVES_CONFIG.DISPOSITIVO_NOME] || null,
    tamanhoPapel: (mapa[CHAVES_CONFIG.TAMANHO_PAPEL] as TamanhoPapel) || '80mm',
    autoImprimir: mapa[CHAVES_CONFIG.AUTO_IMPRIMIR] === 'true',
    imprimirTicketCliente: mapa[CHAVES_CONFIG.IMPRIMIR_CLIENTE] !== 'false',
    imprimirTicketCozinha: mapa[CHAVES_CONFIG.IMPRIMIR_COZINHA] !== 'false',
    copiasCliente: parseInt(mapa[CHAVES_CONFIG.COPIAS_CLIENTE] || '1', 10) || 1,
    copiasCozinha: parseInt(mapa[CHAVES_CONFIG.COPIAS_COZINHA] || '1', 10) || 1,
  } satisfies ConfiguracaoImpressora
}

async function salvarConfiguracaoPersistida(chave: string, valor: string) {
  const { error } = await supabase
    .from('configuracoes_loja')
    .upsert(
      {
        chave,
        valor,
        tipo: 'string',
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'chave',
      }
    )

  if (error) {
    throw error
  }
}

export function ImpressoraProvider({ children }: ImpressoraProviderProps) {
  const [status, setStatus] = useState<StatusConexao>('desconectado')
  const [dispositivo, setDispositivo] = useState<DispositivoBluetooth | null>(null)
  const [configuracao, setConfiguracao] = useState<ConfiguracaoImpressora>(CONFIGURACAO_PADRAO)
  const [erroConexao, setErroConexao] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)

  const processandoFilaRef = useRef(false)
  const intervaloFilaRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const canalFilaRef = useRef<RealtimeChannel | null>(null)
  const reconexaoTentadaRef = useRef(false)
  const configuracaoInicialRef = useRef<ConfiguracaoImpressora | null>(null)

  const suportado = useMemo(
    () => typeof window !== 'undefined' && gerenciadorBluetooth.verificarSuporte(),
    []
  )

  const enviarTicket = useCallback(async (
    dados: DadosPedidoImpressao,
    tipo: TipoTicket,
    configuracaoAtual: ConfiguracaoImpressora
  ) => {
    const ticket = gerarTicket(dados, tipo, configuracaoAtual.tamanhoPapel)
    const copias =
      tipo === 'cliente'
        ? configuracaoAtual.copiasCliente
        : tipo === 'cozinha'
          ? configuracaoAtual.copiasCozinha
          : 1

    for (let copia = 0; copia < copias; copia += 1) {
      const sucesso = await gerenciadorBluetooth.enviar(ticket)
      if (!sucesso) {
        return false
      }

      if (copia < copias - 1) {
        await new Promise((resolve) => setTimeout(resolve, 450))
      }
    }

    return true
  }, [])

  const processarFila = useCallback(async () => {
    const executar = async () => {
      if (
        processandoFilaRef.current ||
        !configuracao.autoImprimir ||
        !gerenciadorBluetooth.estaConectado()
      ) {
        return
      }

      processandoFilaRef.current = true

      try {
        const itensRecuperados = await liberarFilaTravada().catch((erro) => {
          console.error('[Impressora] Falha ao liberar itens travados da fila:', erro)
          return 0
        })

        if (itensRecuperados > 0) {
          console.warn(`[Impressora] ${itensRecuperados} item(ns) travado(s) retornaram para pendente.`)
        }

        const pendencias = await buscarPendenciasImpressao(20)

        for (const registro of pendencias) {
          const reservado = await reivindicarFilaImpressao(registro.id).catch((erro) => {
            console.error('[Impressora] Falha ao reservar item da fila:', erro)
            return false
          })

          if (!reservado) {
            continue
          }

          const trabalho = montarTrabalhoImpressaoFila(registro)

          if (!trabalho) {
            await marcarFilaComoErro(
              registro.id,
              registro.tentativas,
              'Nao foi possivel montar o ticket para impressao.'
            ).catch((erro) => {
              console.error('[Impressora] Falha ao marcar erro na fila:', erro)
            })
            continue
          }

          const tipoDesativado =
            (trabalho.tipoTicket === 'cliente' && !configuracao.imprimirTicketCliente) ||
            (trabalho.tipoTicket === 'cozinha' && !configuracao.imprimirTicketCozinha)

          if (tipoDesativado) {
            await marcarFilaComoImpressa(registro.id).catch((erro) => {
              console.error('[Impressora] Falha ao finalizar item desativado da fila:', erro)
            })
            continue
          }

          try {
            const sucesso = await enviarTicket(trabalho.dados, trabalho.tipoTicket, configuracao)

            if (!sucesso) {
              throw new Error('Falha ao enviar ticket para a impressora Bluetooth.')
            }

            await marcarFilaComoImpressa(registro.id)
          } catch (erro) {
            const mensagem = erro instanceof Error ? erro.message : 'Erro desconhecido ao imprimir.'
            await marcarFilaComoErro(registro.id, registro.tentativas, mensagem).catch((erroFila) => {
              console.error('[Impressora] Falha ao registrar erro da fila:', erroFila)
            })
            setErroConexao(mensagem)
          }
        }
      } catch (erro) {
        console.error('[Impressora] Erro ao processar fila:', erro)
        setErroConexao(
          erro instanceof Error ? erro.message : 'Erro ao processar fila de impressao.'
        )
      } finally {
        processandoFilaRef.current = false
      }
    }

    const locks = typeof navigator !== 'undefined'
      ? (navigator as Navigator & {
          locks?: {
            request: (
              name: string,
              options: { ifAvailable: boolean },
              callback: (lock: unknown) => Promise<void>
            ) => Promise<void>
          }
        }).locks
      : undefined

    if (locks?.request) {
      await locks.request('bar-da-ladeira-impressao-fila', { ifAvailable: true }, async (lock) => {
        if (!lock) return
        await executar()
      })
      return
    }

    await executar()
  }, [configuracao, enviarTicket])

  useEffect(() => {
    let ativo = true

    carregarConfiguracoesPersistidas()
      .then((configuracoesCarregadas) => {
        if (!ativo) return
        configuracaoInicialRef.current = configuracoesCarregadas
        setConfiguracao(configuracoesCarregadas)
      })
      .catch((erro) => {
        console.error('[Impressora] Erro ao carregar configuracoes:', erro)
      })
      .finally(() => {
        if (ativo) {
          setCarregando(false)
        }
      })

    const cancelarStatus = gerenciadorBluetooth.aoMudarStatus((novoStatus) => {
      setStatus(novoStatus)
      setDispositivo(gerenciadorBluetooth.obterDispositivo())

      if (novoStatus === 'erro') {
        setErroConexao(
          gerenciadorBluetooth.obterUltimoErro() || 'Erro na conexao com a impressora.'
        )
      } else if (novoStatus === 'desconectado') {
        setDispositivo(null)
      } else {
        setErroConexao(null)
      }
    })

    return () => {
      ativo = false
      cancelarStatus()
    }
  }, [])

  useEffect(() => {
    const configuracaoInicial = configuracaoInicialRef.current

    if (carregando || !suportado || reconexaoTentadaRef.current || !configuracaoInicial?.dispositivoId) {
      return
    }

    reconexaoTentadaRef.current = true

    gerenciadorBluetooth
      .reconectar({
        dispositivoId: configuracaoInicial.dispositivoId,
        dispositivoNome: configuracaoInicial.dispositivoNome,
      })
      .then((disp) => {
        if (disp) {
          setDispositivo(disp)
        }
      })
      .catch((erro) => {
        console.error('[Impressora] Reconexao automatica falhou:', erro)
      })
  }, [carregando, suportado])

  useEffect(() => {
    if (intervaloFilaRef.current) {
      clearInterval(intervaloFilaRef.current)
      intervaloFilaRef.current = null
    }

    if (canalFilaRef.current) {
      supabase.removeChannel(canalFilaRef.current)
      canalFilaRef.current = null
    }

    if (!configuracao.autoImprimir || status !== 'conectado') {
      return
    }

    processarFila()

    intervaloFilaRef.current = setInterval(() => {
      processarFila()
    }, 5000)

    canalFilaRef.current = supabase
      .channel(`fila-impressao-web-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fila_impressao' }, (payload: {
        eventType: 'INSERT' | 'UPDATE' | 'DELETE'
        new?: unknown
      }) => {
        const registroNovo = (payload.new || {}) as { status?: string }

        if (
          payload.eventType === 'INSERT' ||
          (payload.eventType === 'UPDATE' && registroNovo.status === 'pendente')
        ) {
          processarFila()
        }
      })
      .subscribe()

    return () => {
      if (intervaloFilaRef.current) {
        clearInterval(intervaloFilaRef.current)
        intervaloFilaRef.current = null
      }

      if (canalFilaRef.current) {
        supabase.removeChannel(canalFilaRef.current)
        canalFilaRef.current = null
      }
    }
  }, [configuracao.autoImprimir, processarFila, status])

  const conectar = useCallback(async () => {
    if (!suportado) {
      setErroConexao('O navegador nao suporta os recursos necessarios para conectar a impressora.')
      return false
    }

    try {
      setErroConexao(null)
      const disp = await gerenciadorBluetooth.conectar()

      if (!disp) {
        const mensagemErro = gerenciadorBluetooth.obterUltimoErro()
        if (mensagemErro) {
          setErroConexao(mensagemErro)
        }
        return false
      }

      setDispositivo(disp)
      setConfiguracao((atual: ConfiguracaoImpressora) => ({
        ...atual,
        dispositivoId: disp.id,
        dispositivoNome: disp.nome,
      }))

      await Promise.all([
        salvarConfiguracaoPersistida(CHAVES_CONFIG.DISPOSITIVO_ID, disp.id),
        salvarConfiguracaoPersistida(CHAVES_CONFIG.DISPOSITIVO_NOME, disp.nome),
      ])

      return true
    } catch (erro) {
      console.error('[Impressora] Erro ao conectar manualmente:', erro)
      setErroConexao(
        erro instanceof Error ? erro.message : 'Nao foi possivel conectar a impressora.'
      )
      return false
    }
  }, [suportado])

  const desconectar = useCallback(async () => {
    await gerenciadorBluetooth.desconectar()
    setDispositivo(null)
    setErroConexao(null)
    configuracaoInicialRef.current = null
    setConfiguracao((atual: ConfiguracaoImpressora) => ({
      ...atual,
      dispositivoId: null,
      dispositivoNome: null,
    }))

    await Promise.all([
      salvarConfiguracaoPersistida(CHAVES_CONFIG.DISPOSITIVO_ID, ''),
      salvarConfiguracaoPersistida(CHAVES_CONFIG.DISPOSITIVO_NOME, ''),
    ])
  }, [])

  const imprimir = useCallback(async (dados: DadosPedidoImpressao, tipo: TipoTicket) => {
    if (!gerenciadorBluetooth.estaConectado()) {
      setErroConexao('Impressora nao conectada.')
      return false
    }

    try {
      const sucesso = await enviarTicket(dados, tipo, configuracao)

      if (!sucesso) {
        setErroConexao('Falha ao enviar dados para a impressora.')
      }

      return sucesso
    } catch (erro) {
      console.error('[Impressora] Erro ao imprimir:', erro)
      setErroConexao('Erro ao imprimir.')
      return false
    }
  }, [configuracao, enviarTicket])

  const testarImpressao = useCallback(async () => {
    if (!gerenciadorBluetooth.estaConectado()) {
      setErroConexao('Impressora nao conectada.')
      return false
    }

    try {
      const ticket = gerarTicketTeste(configuracao.tamanhoPapel)
      return await gerenciadorBluetooth.enviar(ticket)
    } catch (erro) {
      console.error('[Impressora] Erro ao testar impressao:', erro)
      setErroConexao('Erro no teste de impressao.')
      return false
    }
  }, [configuracao.tamanhoPapel])

  const atualizarConfiguracao = useCallback(async (novaConfig: Partial<ConfiguracaoImpressora>) => {
    setConfiguracao((atual: ConfiguracaoImpressora) => ({ ...atual, ...novaConfig }))

    const persistencias: Promise<void>[] = []

    if (novaConfig.tamanhoPapel !== undefined) {
      persistencias.push(salvarConfiguracaoPersistida(CHAVES_CONFIG.TAMANHO_PAPEL, novaConfig.tamanhoPapel))
    }
    if (novaConfig.autoImprimir !== undefined) {
      persistencias.push(
        salvarConfiguracaoPersistida(CHAVES_CONFIG.AUTO_IMPRIMIR, String(novaConfig.autoImprimir))
      )
    }
    if (novaConfig.imprimirTicketCliente !== undefined) {
      persistencias.push(
        salvarConfiguracaoPersistida(
          CHAVES_CONFIG.IMPRIMIR_CLIENTE,
          String(novaConfig.imprimirTicketCliente)
        )
      )
    }
    if (novaConfig.imprimirTicketCozinha !== undefined) {
      persistencias.push(
        salvarConfiguracaoPersistida(
          CHAVES_CONFIG.IMPRIMIR_COZINHA,
          String(novaConfig.imprimirTicketCozinha)
        )
      )
    }
    if (novaConfig.copiasCliente !== undefined) {
      persistencias.push(
        salvarConfiguracaoPersistida(CHAVES_CONFIG.COPIAS_CLIENTE, String(novaConfig.copiasCliente))
      )
    }
    if (novaConfig.copiasCozinha !== undefined) {
      persistencias.push(
        salvarConfiguracaoPersistida(CHAVES_CONFIG.COPIAS_COZINHA, String(novaConfig.copiasCozinha))
      )
    }

    await Promise.all(persistencias)
  }, [])

  const valor = useMemo<ImpressoraContextType>(() => ({
    status,
    dispositivo,
    configuracao,
    erroConexao,
    suportado,
    carregando,
    conectar,
    desconectar,
    imprimir,
    testarImpressao,
    atualizarConfiguracao,
  }), [
    status,
    dispositivo,
    configuracao,
    erroConexao,
    suportado,
    carregando,
    conectar,
    desconectar,
    imprimir,
    testarImpressao,
    atualizarConfiguracao,
  ])

  return <ImpressoraContext.Provider value={valor}>{children}</ImpressoraContext.Provider>
}

export function useImpressora() {
  const contexto = useContext(ImpressoraContext)

  if (!contexto) {
    throw new Error('useImpressora deve ser usado dentro de ImpressoraProvider')
  }

  return contexto
}

export function useImpressoraOpcional() {
  return useContext(ImpressoraContext)
}
