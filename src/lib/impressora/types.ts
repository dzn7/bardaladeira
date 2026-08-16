/**
 * Tipos para o sistema de impressão térmica via Bluetooth
 */

// Tamanhos de papel suportados
export type TamanhoPapel = '58mm' | '80mm'

// Configuração de caracteres por linha baseado no tamanho
export const CARACTERES_POR_LINHA: Record<TamanhoPapel, number> = {
  '58mm': 32,
  '80mm': 48
}

// Status da conexão Bluetooth
export type StatusConexao = 'desconectado' | 'conectando' | 'conectado' | 'erro'

// Tipo de ticket para impressão
export type TipoTicket = 'cliente' | 'cozinha' | 'completo'
export type EscopoImpressao = 'pedido_completo' | 'itens_novos'

// Dispositivo Bluetooth conectado
export interface DispositivoBluetooth {
  id: string
  nome: string
  linguagem: 'esc-pos' | 'star-prnt'
  mapeamentoCodepage?: string
}

// Configurações da impressora salvas
export interface ConfiguracaoImpressora {
  dispositivoId: string | null
  dispositivoNome: string | null
  tamanhoPapel: TamanhoPapel
  autoImprimir: boolean
  imprimirTicketCliente: boolean
  imprimirTicketCozinha: boolean
  copiasCozinha: number
  copiasCliente: number
}

// Configurações padrão
export const CONFIGURACAO_PADRAO: ConfiguracaoImpressora = {
  dispositivoId: null,
  dispositivoNome: null,
  tamanhoPapel: '80mm',
  autoImprimir: false,
  imprimirTicketCliente: true,
  imprimirTicketCozinha: true,
  copiasCozinha: 1,
  copiasCliente: 1
}

// Item do pedido para impressão
export interface ItemImpressao {
  nome: string
  quantidade: number
  precoUnitario: number
  precoTotal: number
  observacoes?: string
  adicionais?: Array<{
    nome: string
    preco: number
    quantidade?: number
  }>
}

export interface PagamentoDivididoImpressao {
  forma: string
  valor: number
}

// Dados do pedido para impressão
export interface DadosPedidoImpressao {
  idPedido?: string
  numeroPedido: string
  dataHora: Date
  tipoEntrega: 'entrega' | 'retirada' | 'local'
  nomeCliente: string
  telefone?: string
  endereco?: string
  bairro?: string
  itens: ItemImpressao[]
  subtotal: number
  taxaEntrega: number
  taxaServico?: number
  total: number
  formaPagamento: string
  pagamentosDivididos?: PagamentoDivididoImpressao[]
  observacoes?: string
  mesa?: number
  comanda?: number
  trocoPara?: number
  valorTroco?: number
  escopo?: EscopoImpressao
  impressoEm?: Date
}

// Estado do contexto de impressora
export interface EstadoImpressora {
  status: StatusConexao
  dispositivo: DispositivoBluetooth | null
  configuracao: ConfiguracaoImpressora
  filaImpressao: string[]
  erroConexao: string | null
  suportado: boolean
}

// Ações do contexto
export interface AcoesImpressora {
  conectar: () => Promise<boolean>
  desconectar: () => Promise<void>
  reconectar: () => Promise<boolean>
  imprimir: (dados: DadosPedidoImpressao, tipo: TipoTicket) => Promise<boolean>
  testarImpressao: () => Promise<boolean>
  atualizarConfiguracao: (config: Partial<ConfiguracaoImpressora>) => Promise<void>
  verificarSuporte: () => boolean
}

// Comandos ESC/POS básicos
export const ESCPOS = {
  // Inicialização
  INIT: new Uint8Array([0x1B, 0x40]),
  
  // Alinhamento
  ALIGN_LEFT: new Uint8Array([0x1B, 0x61, 0x00]),
  ALIGN_CENTER: new Uint8Array([0x1B, 0x61, 0x01]),
  ALIGN_RIGHT: new Uint8Array([0x1B, 0x61, 0x02]),
  
  // Tamanho da fonte
  FONT_NORMAL: new Uint8Array([0x1D, 0x21, 0x00]),
  FONT_DOUBLE_HEIGHT: new Uint8Array([0x1D, 0x21, 0x01]),
  FONT_DOUBLE_WIDTH: new Uint8Array([0x1D, 0x21, 0x10]),
  FONT_DOUBLE: new Uint8Array([0x1D, 0x21, 0x11]),
  
  // Estilo
  BOLD_ON: new Uint8Array([0x1B, 0x45, 0x01]),
  BOLD_OFF: new Uint8Array([0x1B, 0x45, 0x00]),
  UNDERLINE_ON: new Uint8Array([0x1B, 0x2D, 0x01]),
  UNDERLINE_OFF: new Uint8Array([0x1B, 0x2D, 0x00]),
  
  // Corte de papel
  CUT_PARTIAL: new Uint8Array([0x1D, 0x56, 0x01]),
  CUT_FULL: new Uint8Array([0x1D, 0x56, 0x00]),
  
  // Alimentação de papel
  FEED_LINE: new Uint8Array([0x0A]),
  FEED_LINES: (n: number) => new Uint8Array([0x1B, 0x64, n]),
  
  // Caracteres especiais
  HORIZONTAL_LINE: '─'.repeat(48),
  DOUBLE_LINE: '═'.repeat(48),
}
