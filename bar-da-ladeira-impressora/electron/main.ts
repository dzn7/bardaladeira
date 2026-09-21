import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import Store from 'electron-store'
import { ServicoImpressao } from './servicos/servicoImpressao'
import { ServicoFilaImpressao } from './servicos/servicoFilaImpressao'
import { ConfiguracaoAplicacao, EstadoAplicacao } from './servicos/tipos'
import { decidirCredenciaisSupabase } from './servicos/politicaFila.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const carregarVariaveisAmbiente = () => {
  const caminhosPossiveis = [
    join(process.cwd(), '.env'),
    join(process.cwd(), '.env.local'),
    join(process.cwd(), '..', '.env.local'),
    join(process.cwd(), '..', '.env')
  ]

  for (const caminho of caminhosPossiveis) {
    if (!existsSync(caminho)) continue

    const conteudo = readFileSync(caminho, 'utf8')
    for (const linha of conteudo.split(/\r?\n/)) {
      const linhaLimpa = linha.trim()
      if (!linhaLimpa || linhaLimpa.startsWith('#')) continue

      const indiceIgual = linhaLimpa.indexOf('=')
      if (indiceIgual <= 0) continue

      const chave = linhaLimpa.slice(0, indiceIgual).trim()
      const valorBruto = linhaLimpa.slice(indiceIgual + 1).trim()
      const valor = valorBruto.replace(/^['"]|['"]$/g, '')

      if (!process.env[chave]) {
        process.env[chave] = valor
      }
    }
  }
}

carregarVariaveisAmbiente()

const lockUnicaInstancia = app.requestSingleInstanceLock()

if (!lockUnicaInstancia) {
  app.quit()
  process.exit(0)
}

app.on('second-instance', () => {
  if (!janelaPrincipal) return
  if (janelaPrincipal.isMinimized()) janelaPrincipal.restore()
  if (!janelaPrincipal.isVisible()) janelaPrincipal.show()
  janelaPrincipal.focus()
})

// Projeto Supabase do Bar da Ladeira. Variaveis de ambiente permitem
// configurar outro projeto sem recompilar o aplicativo.
const SUPABASE_URL_PADRAO = process.env.SUPABASE_URL
  || process.env.NEXT_PUBLIC_SUPABASE_URL
  || 'https://olkzbualikbyudupizxz.supabase.co'
const SUPABASE_ANON_KEY_PADRAO = process.env.SUPABASE_ANON_KEY
  || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9sa3pidWFsaWtieXVkdXBpenh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4MzkyODUsImV4cCI6MjEwMjQxNTI4NX0.Fqkmj-VTpzzx5ve59oiblv7xesqTBJF0To8EV0zB7Wc'

const configuracaoPadrao: ConfiguracaoAplicacao = {
  supabaseUrl: SUPABASE_URL_PADRAO,
  supabaseAnonKey: SUPABASE_ANON_KEY_PADRAO,
  nomeImpressora: '',
  larguraPapelMm: 80,
  tamanhoFonteBasePx: 15,
  espacamentoLinha: 1.35,
  espacamentoItensPx: 8,
  intervaloPollingSegundos: 5,
  copias: 1,
  autoImpressao: true,
  tema: 'sistema'
}

const armazenamento = new Store<{ configuracao: ConfiguracaoAplicacao }>({
  name: 'bar-da-ladeira-impressao-configuracoes',
  defaults: {
    configuracao: configuracaoPadrao
  }
})

let janelaPrincipal: BrowserWindow | null = null
let servicoFila: ServicoFilaImpressao | null = null

const normalizarConfiguracao = (
  configuracaoAtual: ConfiguracaoAplicacao,
  novaConfiguracaoParcial: Partial<ConfiguracaoAplicacao>
): ConfiguracaoAplicacao => {
  const merged = {
    ...configuracaoAtual,
    ...novaConfiguracaoParcial
  }

  const normalizarNumero = (valor: unknown, fallback: number) => {
    const numero = Number(valor)
    return Number.isFinite(numero) ? numero : fallback
  }

  const limitar = (valor: number, minimo: number, maximo: number) =>
    Math.min(Math.max(valor, minimo), maximo)

  const mergedLegado = merged as Record<string, unknown>
  const larguraLegada = typeof mergedLegado.larguraPapel === 'string'
    ? Number.parseFloat(mergedLegado.larguraPapel)
    : NaN
  const larguraNormalizada = normalizarNumero(
    mergedLegado.larguraPapelMm ?? larguraLegada,
    80
  )

  // O codigo anterior sobrescrevia url/chave com a constante em TODA
  // normalizacao — inclusive ao salvar. Efeito: a tela de configuracao nao
  // conseguia trocar de projeto e a unica forma de mudar era reempacotar.
  const credenciais = decidirCredenciaisSupabase({
    urlPersistida: merged.supabaseUrl,
    chavePersistida: merged.supabaseAnonKey,
    urlPadrao: SUPABASE_URL_PADRAO,
    chavePadrao: SUPABASE_ANON_KEY_PADRAO
  })

  return {
    ...merged,
    supabaseUrl: credenciais.url,
    supabaseAnonKey: credenciais.anonKey,
    nomeImpressora: (merged.nomeImpressora || '').trim(),
    larguraPapelMm: limitar(larguraNormalizada, 48, 120),
    tamanhoFonteBasePx: limitar(normalizarNumero(mergedLegado.tamanhoFonteBasePx, 15), 10, 24),
    espacamentoLinha: limitar(normalizarNumero(mergedLegado.espacamentoLinha, 1.35), 1, 2.2),
    espacamentoItensPx: limitar(normalizarNumero(mergedLegado.espacamentoItensPx, 8), 0, 24),
    intervaloPollingSegundos: Math.max(1, Number(merged.intervaloPollingSegundos || 2)),
    copias: Math.max(1, Number(merged.copias || 1)),
    autoImpressao: Boolean(merged.autoImpressao),
    tema: merged.tema === 'claro' || merged.tema === 'escuro' ? merged.tema : 'sistema'
  }
}

const obterConfiguracaoAtual = (): ConfiguracaoAplicacao => {
  const configuracaoPersistida = armazenamento.get('configuracao') as Partial<ConfiguracaoAplicacao>
  return normalizarConfiguracao(configuracaoPadrao, configuracaoPersistida)
}

let estadoAtual: EstadoAplicacao = {
  fila: [],
  pedidos: [],
  impressoras: [],
  conexao: {
    conectado: false,
    mensagem: 'Inicializando aplicacao...',
    ultimaAtualizacao: new Date().toISOString()
  },
  configuracao: obterConfiguracaoAtual(),
  logs: []
}

const enviarEstadoParaRenderer = (estadoParcial: Partial<EstadoAplicacao>) => {
  estadoAtual = {
    ...estadoAtual,
    ...estadoParcial
  }

  if (janelaPrincipal && !janelaPrincipal.isDestroyed()) {
    janelaPrincipal.webContents.send('estado:atualizado', estadoAtual)
  }
}

const criarJanelaPrincipal = () => {
  const caminhoIconeDesenvolvimento = join(process.cwd(), 'public', 'icon.ico')
  const caminhoIconePacote = join(process.resourcesPath, 'icon.ico')

  const icone = existsSync(caminhoIconePacote)
    ? caminhoIconePacote
    : (existsSync(caminhoIconeDesenvolvimento) ? caminhoIconeDesenvolvimento : undefined)

  janelaPrincipal = new BrowserWindow({
    width: 1366,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    title: 'Bar da Ladeira Impressao',
    icon: icone,
    autoHideMenuBar: true,
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false
    }
  })

  janelaPrincipal.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  janelaPrincipal.webContents.on('will-navigate', (evento, url) => {
    if (url !== janelaPrincipal?.webContents.getURL()) {
      evento.preventDefault()
    }
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    janelaPrincipal.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    janelaPrincipal.loadFile(join(__dirname, '../dist/index.html'))
  }

  janelaPrincipal.on('closed', () => {
    janelaPrincipal = null
  })
}

const registrarIpc = () => {
  ipcMain.handle('app:obter-estado-inicial', async () => estadoAtual)

  ipcMain.handle('app:salvar-configuracao', async (_, novaConfiguracaoParcial: Partial<ConfiguracaoAplicacao>) => {
    const configuracaoAtual = armazenamento.get('configuracao')
    const configuracaoNormalizada = normalizarConfiguracao(configuracaoAtual, novaConfiguracaoParcial)

    armazenamento.set('configuracao', configuracaoNormalizada)
    estadoAtual.configuracao = configuracaoNormalizada

    if (servicoFila) {
      await servicoFila.atualizarConfiguracao(configuracaoNormalizada)
    }

    enviarEstadoParaRenderer({ configuracao: configuracaoNormalizada })
    return configuracaoNormalizada
  })

  ipcMain.handle('app:atualizar-impressoras', async () => {
    if (!servicoFila) return []
    const impressoras = await servicoFila.carregarImpressorasDisponiveis()
    enviarEstadoParaRenderer({ impressoras })
    return impressoras
  })

  ipcMain.handle('app:atualizar-painel', async () => {
    if (!servicoFila) return false
    await servicoFila.atualizarPedidosEFila()
    return true
  })

  ipcMain.handle('fila:imprimir-manual', async (_, pedidoId: string, tipo: 'cozinha' | 'cliente') => {
    if (!servicoFila) {
      return { sucesso: false, duplicado: false, erro: 'Servico de fila nao inicializado.' }
    }
    return servicoFila.enfileirarImpressaoManual(pedidoId, tipo)
  })

  ipcMain.handle('fila:reimprimir', async (_, idFila: string) => {
    if (!servicoFila) {
      return { sucesso: false, erro: 'Servico de fila nao inicializado.' }
    }
    return servicoFila.reimprimirRegistroFila(idFila)
  })

  ipcMain.handle('fila:processar-agora', async () => {
    if (!servicoFila) return false
    await servicoFila.processarFilaAgora()
    return true
  })
}

app.whenReady().then(async () => {
  criarJanelaPrincipal()

  const servicoImpressao = new ServicoImpressao(() => janelaPrincipal)
  const configuracaoInicial = obterConfiguracaoAtual()
  armazenamento.set('configuracao', configuracaoInicial)

  servicoFila = new ServicoFilaImpressao(
    configuracaoInicial,
    servicoImpressao,
    {
      onAtualizarEstado: (estadoParcial) => {
        enviarEstadoParaRenderer(estadoParcial)
      },
      onLog: () => {
        // O log completo já é publicado em onAtualizarEstado.
      }
    }
  )

  estadoAtual.configuracao = configuracaoInicial
  enviarEstadoParaRenderer({ configuracao: configuracaoInicial })

  registrarIpc()

  const impressoras = await servicoFila.carregarImpressorasDisponiveis()
  enviarEstadoParaRenderer({ impressoras })

  await servicoFila.iniciar()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      criarJanelaPrincipal()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', async () => {
  if (servicoFila) {
    await servicoFila.parar()
    servicoFila = null
  }
})
