import { supabase } from '@/lib/supabase'

export type TipoFilaImpressao = 'cozinha' | 'cliente'
export type EscopoFilaImpressao = 'pedido_completo' | 'itens_novos'

export type AdicionalSnapshotImpressao = {
  nome: string
  preco: number
  quantidade: number
}

export type ItemSnapshotImpressao = {
  nome_item: string
  quantidade: number
  preco_unitario: number
  subtotal: number
  observacoes?: string | null
  item_adicionais?: AdicionalSnapshotImpressao[]
}

export type PedidoSnapshotImpressao = {
  id: string
  numero_pedido?: number | string | null
  nome_cliente?: string | null
  tipo_entrega?: string | null
  telefone?: string | null
  mesa?: number | null
  comanda?: number | null
  mesa_numero?: number | null
  endereco?: string | null
  bairro?: string | null
  observacoes?: string | null
  subtotal?: number | null
  taxa_entrega?: number | null
  taxa_servico?: number | null
  total?: number | null
  forma_pagamento?: string | null
  pagamentos_divididos?: Array<{
    forma_pagamento: string
    valor: number
  }> | null
  troco_para?: number | null
  origem_conferencia?: boolean | null
  modo_taxa_conferencia?: 'com_taxa' | 'sem_taxa' | null
  created_at?: string | null
}

type ParametrosEnfileirarImpressao = {
  pedidoId: string
  tipo: TipoFilaImpressao
  escopo?: EscopoFilaImpressao
  itensSnapshot?: ItemSnapshotImpressao[] | null
  pedidoSnapshot?: PedidoSnapshotImpressao | null
  origem?: string | null
  hashEvento?: string | null
  automatico?: boolean
}

type RetornoEnfileirarImpressao = {
  sucesso: boolean
  duplicado: boolean
  ignorado: boolean
  erro?: string
}

export type ConfiguracaoFilaImpressao = {
  filaAutomaticaAtiva: boolean
  horarioInicio: string
  horarioFim: string
  imprimirItensEditados: boolean
}

export type ResultadoSalvarConfiguracaoFila = {
  cancelados: number
}

const CHAVES_CONFIGURACAO_FILA = {
  filaAutomaticaAtiva: 'fila_impressao_automatica_ativa',
  horarioInicio: 'fila_impressao_horario_inicio',
  horarioFim: 'fila_impressao_horario_fim',
  imprimirItensEditados: 'impressao_itens_editados_ativa',
} as const

export const CONFIGURACAO_FILA_IMPRESSAO_PADRAO: ConfiguracaoFilaImpressao = {
  filaAutomaticaAtiva: true,
  horarioInicio: '00:00',
  horarioFim: '00:00',
  imprimirItensEditados: true,
}

const HORARIO_VALIDO = /^(?:[01]\d|2[0-3]):[0-5]\d$/

const normalizarBooleanoConfiguracao = (valor: unknown, fallback: boolean) => {
  if (typeof valor !== 'string') return fallback
  const normalizado = valor.trim().toLowerCase()
  if (['true', '1', 'sim', 'on'].includes(normalizado)) return true
  if (['false', '0', 'nao', 'não', 'off'].includes(normalizado)) return false
  return fallback
}

const normalizarHorarioConfiguracao = (valor: unknown, fallback: string) => {
  if (typeof valor !== 'string') return fallback
  const normalizado = valor.trim()
  return HORARIO_VALIDO.test(normalizado) ? normalizado : fallback
}

export const carregarConfiguracaoFilaImpressao = async (): Promise<ConfiguracaoFilaImpressao> => {
  const { data, error } = await supabase
    .from('configuracoes_loja')
    .select('chave, valor')
    .in('chave', Object.values(CHAVES_CONFIGURACAO_FILA))

  if (error) throw error

  const valores = new Map((data || []).map((item) => [String(item.chave), item.valor]))

  return {
    filaAutomaticaAtiva: normalizarBooleanoConfiguracao(
      valores.get(CHAVES_CONFIGURACAO_FILA.filaAutomaticaAtiva),
      CONFIGURACAO_FILA_IMPRESSAO_PADRAO.filaAutomaticaAtiva,
    ),
    horarioInicio: normalizarHorarioConfiguracao(
      valores.get(CHAVES_CONFIGURACAO_FILA.horarioInicio),
      CONFIGURACAO_FILA_IMPRESSAO_PADRAO.horarioInicio,
    ),
    horarioFim: normalizarHorarioConfiguracao(
      valores.get(CHAVES_CONFIGURACAO_FILA.horarioFim),
      CONFIGURACAO_FILA_IMPRESSAO_PADRAO.horarioFim,
    ),
    imprimirItensEditados: normalizarBooleanoConfiguracao(
      valores.get(CHAVES_CONFIGURACAO_FILA.imprimirItensEditados),
      CONFIGURACAO_FILA_IMPRESSAO_PADRAO.imprimirItensEditados,
    ),
  }
}

export const salvarConfiguracaoFilaImpressao = async (
  configuracao: ConfiguracaoFilaImpressao,
): Promise<ResultadoSalvarConfiguracaoFila> => {
  if (!HORARIO_VALIDO.test(configuracao.horarioInicio) || !HORARIO_VALIDO.test(configuracao.horarioFim)) {
    throw new Error('Informe horários válidos para a fila de impressão.')
  }

  const { data, error } = await supabase.rpc('configurar_fila_impressao', {
    p_fila_ativa: configuracao.filaAutomaticaAtiva,
    p_horario_inicio: configuracao.horarioInicio,
    p_horario_fim: configuracao.horarioFim,
    p_imprimir_itens_editados: configuracao.imprimirItensEditados,
  })

  if (error) throw error

  const resultado = data && typeof data === 'object' ? data as { cancelados?: unknown } : null
  const cancelados = Number(resultado?.cancelados || 0)

  return { cancelados: Number.isFinite(cancelados) ? cancelados : 0 }
}

const gerarHashSimples = (valor: string): string => {
  let hash = 0
  for (let indice = 0; indice < valor.length; indice += 1) {
    hash = ((hash << 5) - hash) + valor.charCodeAt(indice)
    hash |= 0
  }
  return Math.abs(hash).toString(16)
}

export const gerarHashEventoImpressao = (
  pedidoId: string,
  tipo: TipoFilaImpressao,
  escopo: EscopoFilaImpressao,
  itensSnapshot?: ItemSnapshotImpressao[] | null,
  origem?: string | null
) => {
  const carga = JSON.stringify({
    pedidoId,
    tipo,
    escopo,
    itensSnapshot: itensSnapshot || [],
    origem: origem || null
  })
  return `${pedidoId}:${tipo}:${escopo}:${gerarHashSimples(carga)}`
}

export const enfileirarImpressao = async ({
  pedidoId,
  tipo,
  escopo = 'pedido_completo',
  itensSnapshot = null,
  pedidoSnapshot = null,
  origem = null,
  hashEvento = null,
  automatico = true,
}: ParametrosEnfileirarImpressao): Promise<RetornoEnfileirarImpressao> => {
  try {
    const { data, error } = await supabase
      .from('fila_impressao')
      .insert({
        pedido_id: pedidoId,
        tipo,
        status: 'pendente',
        escopo,
        itens_snapshot: itensSnapshot,
        pedido_snapshot: pedidoSnapshot,
        origem,
        hash_evento: hashEvento,
        automatico,
      })
      .select('id')

    if (error) {
      if (error.code === '23505') {
        return { sucesso: false, duplicado: true, ignorado: false }
      }

      return {
        sucesso: false,
        duplicado: false,
        ignorado: false,
        erro: error.message
      }
    }

    const ignorado = !data || data.length === 0
    return { sucesso: true, duplicado: false, ignorado }
  } catch (erro: unknown) {
    return {
      sucesso: false,
      duplicado: false,
      ignorado: false,
      erro: erro instanceof Error ? erro.message : 'Erro desconhecido ao enfileirar impressão.'
    }
  }
}
