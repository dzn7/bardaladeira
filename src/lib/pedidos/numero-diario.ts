import type { SupabaseClient } from '@supabase/supabase-js'
import { getZonedDateKey } from '@/lib/caixa-automacao'

export const TIMEZONE_PEDIDO = 'America/Fortaleza'
const JANELA_HORAS_NUMERO_PEDIDO = 48

type PedidoBaseNumeroDiario = {
  id: string
  created_at?: string | null
  numero_pedido?: number | string | null
  numero_pedido_diario?: number | null
}

type ClientePedidosNumeroDiario = Pick<SupabaseClient<any>, 'from'>

function criarDataSegura(valor?: string | null): Date | null {
  if (!valor) return null
  const data = new Date(valor)
  return Number.isNaN(data.getTime()) ? null : data
}

function ordenarPedidosPorCriacao<T extends Pick<PedidoBaseNumeroDiario, 'id' | 'created_at'>>(a: T, b: T) {
  const dataA = criarDataSegura(a.created_at)?.getTime() ?? 0
  const dataB = criarDataSegura(b.created_at)?.getTime() ?? 0

  if (dataA !== dataB) {
    return dataA - dataB
  }

  return String(a.id || '').localeCompare(String(b.id || ''))
}

export function normalizarNumeroPedido(valor?: number | string | null): number | null {
  if (valor === null || valor === undefined || valor === '') return null
  const numero = typeof valor === 'number' ? valor : Number(valor)
  if (!Number.isFinite(numero) || numero <= 0) return null
  return Math.trunc(numero)
}

export function obterChaveDiaPedido(valor?: string | null, timezone = TIMEZONE_PEDIDO): string {
  const data = criarDataSegura(valor)
  if (!data) return ''
  return getZonedDateKey(data, timezone)
}

export function criarMapaNumeroPedidoDiario<T extends Pick<PedidoBaseNumeroDiario, 'id' | 'created_at'>>(
  pedidos: T[],
  timezone = TIMEZONE_PEDIDO
) {
  const contagemPorDia = new Map<string, number>()
  const numeroPorPedido = new Map<string, number>()

  for (const pedido of [...pedidos].sort(ordenarPedidosPorCriacao)) {
    const chaveDia = obterChaveDiaPedido(pedido.created_at, timezone)
    if (!chaveDia || !pedido.id) continue

    const proximoNumero = (contagemPorDia.get(chaveDia) ?? 0) + 1
    contagemPorDia.set(chaveDia, proximoNumero)
    numeroPorPedido.set(pedido.id, proximoNumero)
  }

  return numeroPorPedido
}

export function atribuirNumeroPedidoDiario<T extends PedidoBaseNumeroDiario>(
  pedidos: T[],
  timezone = TIMEZONE_PEDIDO
): Array<T & { numero_pedido_diario: number | null }> {
  const numeroPorPedido = criarMapaNumeroPedidoDiario(pedidos, timezone)

  return pedidos.map((pedido) => ({
    ...pedido,
    numero_pedido_diario: numeroPorPedido.get(pedido.id) ?? null,
  }))
}

export function obterNumeroPedidoExibicao<T extends PedidoBaseNumeroDiario>(pedido: T): number | null {
  return normalizarNumeroPedido(pedido.numero_pedido_diario) ?? normalizarNumeroPedido(pedido.numero_pedido)
}

async function buscarPedidosRecentesParaNumeracao(
  supabase: ClientePedidosNumeroDiario,
  lookbackHoras = JANELA_HORAS_NUMERO_PEDIDO
) {
  const inicioBusca = new Date(Date.now() - lookbackHoras * 60 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from('pedidos')
    .select('id, created_at, numero_pedido')
    .gte('created_at', inicioBusca)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })

  if (error) throw error

  return (data || []) as PedidoBaseNumeroDiario[]
}

export async function buscarProximoNumeroPedidoDiario(
  supabase: ClientePedidosNumeroDiario,
  options?: {
    agora?: Date
    timezone?: string
    lookbackHoras?: number
  }
) {
  const timezone = options?.timezone || TIMEZONE_PEDIDO
  const agora = options?.agora || new Date()
  const pedidosRecentes = await buscarPedidosRecentesParaNumeracao(
    supabase,
    options?.lookbackHoras ?? JANELA_HORAS_NUMERO_PEDIDO
  )
  const chaveHoje = getZonedDateKey(agora, timezone)
  const totalHoje = pedidosRecentes.filter(
    (pedido) => obterChaveDiaPedido(pedido.created_at, timezone) === chaveHoje
  ).length

  return totalHoje + 1
}

export async function sincronizarNumeroPedidoDiario(
  supabase: ClientePedidosNumeroDiario,
  pedido: Pick<PedidoBaseNumeroDiario, 'id' | 'created_at' | 'numero_pedido'>,
  options?: {
    timezone?: string
    lookbackHoras?: number
  }
) {
  const pedidosRecentes = await buscarPedidosRecentesParaNumeracao(
    supabase,
    options?.lookbackHoras ?? JANELA_HORAS_NUMERO_PEDIDO
  )
  const numeroPorPedido = criarMapaNumeroPedidoDiario(
    pedidosRecentes,
    options?.timezone || TIMEZONE_PEDIDO
  )
  const numeroCalculado = numeroPorPedido.get(pedido.id) ?? null

  if (!numeroCalculado) {
    return normalizarNumeroPedido(pedido.numero_pedido)
  }

  if (normalizarNumeroPedido(pedido.numero_pedido) !== numeroCalculado) {
    const { error } = await supabase
      .from('pedidos')
      .update({ numero_pedido: numeroCalculado })
      .eq('id', pedido.id)

    if (error) throw error
  }

  return numeroCalculado
}
