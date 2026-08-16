export type ChaveConfigProdutividade =
  | 'pontos_pedido_criado'
  | 'pontos_pedido_fechado'
  | 'pontos_item_adicionado'
  | 'pontos_pedido_editado'
  | 'bonus_cadastro_completo'
  | 'penalidade_nome_generico'
  | 'penalidade_contato_ausente'
  | 'penalidade_pedido_cancelado'
  | 'meta_pontos_dia'
  | 'meta_pontos_semana'
  | 'meta_pontos_mes'

export type ConfigProdutividade = Record<ChaveConfigProdutividade, number>

export type MotivoOcorrencia = 'nome_generico' | 'contato_ausente'

export type GarcomProdutividade = {
  garcomId: string
  nome: string
  nomeUsuario: string
  avatarUrl: string | null
  corAvatar: string
  ativo: boolean
  ultimoAcesso: string | null
  pedidosCriados: number
  pedidosFechados: number
  pedidosCancelados: number
  pedidosAbertos: number
  itensAdicionados: number
  edicoes: number
  vendas: number
  ticketMedio: number
  ocorrenciasNome: number
  ocorrenciasContato: number
  cadastrosCompletos: number
  pontosPositivos: number
  pontosNegativos: number
  pontos: number
}

export type PontoSerieProdutividade = {
  dia: string
  garcomId: string
  pontos: number
  pedidosCriados: number
  pedidosFechados: number
}

export type OcorrenciaProdutividade = {
  pedidoId: string
  numeroPedido: number
  garcomId: string
  garcomNome: string
  nomeCliente: string
  tipoEntrega: string
  status: string
  total: number
  criadoEm: string
  motivos: MotivoOcorrencia[]
  pontosPerdidos: number
}

export type RespostaProdutividade = {
  garcons: GarcomProdutividade[]
  serie: PontoSerieProdutividade[]
  config: ConfigProdutividade
  periodo: { inicio: string; fim: string }
}

export type RespostaOcorrencias = {
  ocorrencias: OcorrenciaProdutividade[]
  total: number
}

export type PeriodoProdutividade = 'dia' | 'semana' | 'mes' | 'personalizado'

export const CONFIG_PRODUTIVIDADE_PADRAO: ConfigProdutividade = {
  pontos_pedido_criado: 10,
  pontos_pedido_fechado: 15,
  pontos_item_adicionado: 2,
  pontos_pedido_editado: 3,
  bonus_cadastro_completo: 5,
  penalidade_nome_generico: 8,
  penalidade_contato_ausente: 5,
  penalidade_pedido_cancelado: 0,
  meta_pontos_dia: 150,
  meta_pontos_semana: 900,
  meta_pontos_mes: 3600,
}

export const CHAVES_CONFIG_PRODUTIVIDADE = Object.keys(
  CONFIG_PRODUTIVIDADE_PADRAO,
) as ChaveConfigProdutividade[]

export const ROTULO_MOTIVO: Record<MotivoOcorrencia, string> = {
  nome_generico: 'Sem nome do cliente',
  contato_ausente: 'Sem telefone/endereço',
}
