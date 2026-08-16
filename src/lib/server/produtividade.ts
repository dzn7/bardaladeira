import { obterSupabaseAdmin } from '@/lib/server/supabase-admin'
import {
  CHAVES_CONFIG_PRODUTIVIDADE,
  CONFIG_PRODUTIVIDADE_PADRAO,
  type ChaveConfigProdutividade,
  type ConfigProdutividade,
  type GarcomProdutividade,
  type MotivoOcorrencia,
  type OcorrenciaProdutividade,
  type PontoSerieProdutividade,
} from '@/features/produtividade/types'

/** Janela máxima aceita em uma consulta, para não varrer o histórico inteiro sem querer. */
const DIAS_MAXIMOS_PERIODO = 400
const MS_POR_DIA = 24 * 60 * 60 * 1000

export type PeriodoValidado = { inicio: string; fim: string }

export class ErroPeriodoProdutividade extends Error {}

export function validarPeriodo(
  inicioRaw: string | null,
  fimRaw: string | null,
): PeriodoValidado {
  if (!inicioRaw || !fimRaw) {
    throw new ErroPeriodoProdutividade('Informe início e fim do período.')
  }

  const inicio = new Date(inicioRaw)
  const fim = new Date(fimRaw)

  if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime())) {
    throw new ErroPeriodoProdutividade('Período inválido.')
  }
  if (fim.getTime() <= inicio.getTime()) {
    throw new ErroPeriodoProdutividade('O fim do período precisa ser depois do início.')
  }
  if (fim.getTime() - inicio.getTime() > DIAS_MAXIMOS_PERIODO * MS_POR_DIA) {
    throw new ErroPeriodoProdutividade(
      `Período muito longo (máximo ${DIAS_MAXIMOS_PERIODO} dias).`,
    )
  }

  return { inicio: inicio.toISOString(), fim: fim.toISOString() }
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function validarGarcomId(valor: string | null | undefined): string | null {
  if (!valor || !UUID_RE.test(valor)) return null
  return valor
}

const numero = (valor: unknown): number => {
  const convertido = Number(valor)
  return Number.isFinite(convertido) ? convertido : 0
}

const MOTIVOS_VALIDOS: MotivoOcorrencia[] = ['nome_generico', 'contato_ausente']

const normalizarMotivos = (valor: unknown): MotivoOcorrencia[] => {
  if (!Array.isArray(valor)) return []
  return valor.filter((item): item is MotivoOcorrencia =>
    MOTIVOS_VALIDOS.includes(item as MotivoOcorrencia),
  )
}

export async function carregarGarcons(
  periodo: PeriodoValidado,
): Promise<GarcomProdutividade[]> {
  const supabase = obterSupabaseAdmin()
  const { data, error } = await supabase.rpc('produtividade_garcons', {
    p_inicio: periodo.inicio,
    p_fim: periodo.fim,
  })

  if (error) throw new Error(error.message)

  return ((data as Record<string, unknown>[]) || []).map((linha) => ({
    garcomId: String(linha.garcom_id),
    nome: String(linha.nome ?? ''),
    nomeUsuario: String(linha.nome_usuario ?? ''),
    avatarUrl: (linha.avatar_url as string | null) ?? null,
    corAvatar: String(linha.cor_avatar ?? '#0296F9'),
    ativo: linha.ativo !== false,
    ultimoAcesso: (linha.ultimo_acesso as string | null) ?? null,
    pedidosCriados: numero(linha.pedidos_criados),
    pedidosFechados: numero(linha.pedidos_fechados),
    pedidosCancelados: numero(linha.pedidos_cancelados),
    pedidosAbertos: numero(linha.pedidos_abertos),
    itensAdicionados: numero(linha.itens_adicionados),
    edicoes: numero(linha.edicoes),
    vendas: numero(linha.vendas),
    ticketMedio: numero(linha.ticket_medio),
    ocorrenciasNome: numero(linha.ocorrencias_nome),
    ocorrenciasContato: numero(linha.ocorrencias_contato),
    cadastrosCompletos: numero(linha.cadastros_completos),
    pontosPositivos: numero(linha.pontos_positivos),
    pontosNegativos: numero(linha.pontos_negativos),
    pontos: numero(linha.pontos),
  }))
}

export async function carregarSerie(
  periodo: PeriodoValidado,
): Promise<PontoSerieProdutividade[]> {
  const supabase = obterSupabaseAdmin()
  const { data, error } = await supabase.rpc('produtividade_serie_diaria', {
    p_inicio: periodo.inicio,
    p_fim: periodo.fim,
  })

  if (error) throw new Error(error.message)

  return ((data as Record<string, unknown>[]) || []).map((linha) => ({
    dia: String(linha.dia),
    garcomId: String(linha.garcom_id),
    pontos: numero(linha.pontos),
    pedidosCriados: numero(linha.pedidos_criados),
    pedidosFechados: numero(linha.pedidos_fechados),
  }))
}

export async function carregarOcorrencias(
  periodo: PeriodoValidado,
  opcoes: { garcomId?: string | null; limite: number; offset: number },
): Promise<{ ocorrencias: OcorrenciaProdutividade[]; total: number }> {
  const supabase = obterSupabaseAdmin()
  const { data, error } = await supabase.rpc('produtividade_ocorrencias', {
    p_inicio: periodo.inicio,
    p_fim: periodo.fim,
    p_garcom_id: opcoes.garcomId ?? null,
    p_limite: opcoes.limite,
    p_offset: opcoes.offset,
  })

  if (error) throw new Error(error.message)

  const linhas = (data as Record<string, unknown>[]) || []

  return {
    total: linhas.length > 0 ? numero(linhas[0].total_registros) : 0,
    ocorrencias: linhas.map((linha) => ({
      pedidoId: String(linha.pedido_id),
      numeroPedido: numero(linha.numero_pedido),
      garcomId: String(linha.garcom_id),
      garcomNome: String(linha.garcom_nome ?? ''),
      nomeCliente: String(linha.nome_cliente ?? ''),
      tipoEntrega: String(linha.tipo_entrega ?? ''),
      status: String(linha.status ?? ''),
      total: numero(linha.total),
      criadoEm: String(linha.criado_em),
      motivos: normalizarMotivos(linha.motivos),
      pontosPerdidos: numero(linha.pontos_perdidos),
    })),
  }
}

/** A tabela `produtividade_config` não é acessível diretamente: só pelas funções. */
const configDoJson = (valor: unknown): ConfigProdutividade => {
  const config: ConfigProdutividade = { ...CONFIG_PRODUTIVIDADE_PADRAO }
  if (!valor || typeof valor !== 'object') return config

  const bruto = valor as Record<string, unknown>
  for (const chave of CHAVES_CONFIG_PRODUTIVIDADE) {
    if (chave in bruto) config[chave as ChaveConfigProdutividade] = numero(bruto[chave])
  }
  return config
}

export async function carregarConfig(): Promise<ConfigProdutividade> {
  const supabase = obterSupabaseAdmin()
  const { data, error } = await supabase.rpc('produtividade_ler_config')

  if (error) throw new Error(error.message)

  return configDoJson(data)
}

/** Aceita apenas as chaves conhecidas, com valor numérico finito e não negativo. */
export function normalizarConfigRecebida(valor: unknown): Partial<ConfigProdutividade> | null {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return null

  const bruto = valor as Record<string, unknown>
  const saida: Partial<ConfigProdutividade> = {}

  for (const chave of CHAVES_CONFIG_PRODUTIVIDADE) {
    if (!(chave in bruto)) continue
    const convertido = Number(bruto[chave])
    if (!Number.isFinite(convertido) || convertido < 0 || convertido > 100000) return null
    saida[chave] = Math.round(convertido * 100) / 100
  }

  return Object.keys(saida).length > 0 ? saida : null
}

export async function salvarConfig(
  parcial: Partial<ConfigProdutividade>,
): Promise<ConfigProdutividade> {
  const supabase = obterSupabaseAdmin()
  const { data, error } = await supabase.rpc('produtividade_salvar_config', {
    p_config: parcial,
  })

  if (error) throw new Error(error.message)

  return configDoJson(data)
}
