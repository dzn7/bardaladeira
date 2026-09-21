import { BrowserWindow } from 'electron'
import { gerarHtmlTicket } from './formatadorTicket'
import { ConfiguracaoAplicacao, DadosTicketImpressao } from './tipos'

export class ServicoImpressao {
  private obterJanelaPrincipal: () => BrowserWindow | null

  constructor(obterJanelaPrincipal: () => BrowserWindow | null) {
    this.obterJanelaPrincipal = obterJanelaPrincipal
  }

  async obterImpressorasDisponiveis(): Promise<string[]> {
    const janela = this.obterJanelaPrincipal()
    if (!janela) {
      return []
    }

    const impressoras = await janela.webContents.getPrintersAsync()
    return impressoras
      .map((impressora) => impressora.name)
      .filter((nome) => nome && nome.trim().length > 0)
      .sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }

  async imprimir(
    dadosTicket: DadosTicketImpressao,
    configuracao: ConfiguracaoAplicacao
  ): Promise<{ sucesso: boolean; erro?: string }> {
    if (!configuracao.nomeImpressora) {
      return { sucesso: false, erro: 'Nenhuma impressora foi configurada.' }
    }

    const htmlTicket = gerarHtmlTicket(dadosTicket, configuracao)

    for (let copiaAtual = 1; copiaAtual <= configuracao.copias; copiaAtual += 1) {
      const resultado = await this.imprimirCopiaSilenciosa(
        htmlTicket,
        configuracao.nomeImpressora,
        configuracao.larguraPapelMm
      )

      if (!resultado.sucesso) {
        return resultado
      }
    }

    return { sucesso: true }
  }

  private async imprimirCopiaSilenciosa(
    htmlTicket: string,
    nomeImpressora: string,
    larguraPapelMm: number
  ): Promise<{ sucesso: boolean; erro?: string }> {
    const janelaImpressao = new BrowserWindow({
      show: false,
      width: 700,
      height: 1000,
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        offscreen: false
      }
    })

    try {
      const aguardarCarregamento = new Promise<void>((resolve, reject) => {
        const aoFalhar = (
          _evento: Electron.Event,
          codigo: number,
          descricao: string
        ) => {
          janelaImpressao.webContents.removeListener('did-finish-load', aoCarregar)
          reject(new Error(`Falha ao carregar HTML do ticket (${codigo}): ${descricao}`))
        }
        const aoCarregar = () => {
          janelaImpressao.webContents.removeListener('did-fail-load', aoFalhar)
          resolve()
        }
        janelaImpressao.webContents.once('did-fail-load', aoFalhar)
        janelaImpressao.webContents.once('did-finish-load', aoCarregar)
      })

      const urlHtml = `data:text/html;charset=UTF-8,${encodeURIComponent(htmlTicket)}`
      janelaImpressao.loadURL(urlHtml).catch(() => { /* tratado por did-fail-load */ })

      await aguardarCarregamento

      // Garante ciclo de paint antes do print — sem isso o driver recebe página em branco.
      await new Promise<void>((resolve) => setTimeout(resolve, 250))

      const larguraMicrons = Math.round(Math.max(48, Math.min(120, larguraPapelMm)) * 1000)
      // Altura generosa (2m) para papel térmico contínuo: o driver corta automaticamente
      // pelo conteúdo. 297mm (A4) cortava tickets longos com muitos itens.
      const alturaMicrons = 2_000_000

      const impressoComSucesso = await new Promise<boolean>((resolve) => {
        janelaImpressao.webContents.print(
          {
            silent: true,
            printBackground: true,
            deviceName: nomeImpressora,
            color: false,
            margins: { marginType: 'none' },
            pageSize: { width: larguraMicrons, height: alturaMicrons }
          },
          (sucesso, erro) => {
            if (!sucesso && erro) {
              console.error('[Impressao] Falha ao imprimir:', erro)
            }
            resolve(sucesso)
          }
        )
      })

      if (!impressoComSucesso) {
        return {
          sucesso: false,
          erro: `Falha ao imprimir na impressora "${nomeImpressora}".`
        }
      }

      return { sucesso: true }
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : 'Erro desconhecido ao imprimir.'
      return { sucesso: false, erro: mensagem }
    } finally {
      if (!janelaImpressao.isDestroyed()) {
        janelaImpressao.destroy()
      }
    }
  }
}
