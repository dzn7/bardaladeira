import { supabase } from '@/lib/supabase'
import type { ItemPedido } from '@/components/admin/CardPedido'

export type CrediarioInfo = {
  status: string | null
  saldo_atual: number | null
  conta_id?: string | null
  movimento_id?: string | null
}

export type PedidoPagamentoLike = {
  pagamento_online?: boolean | null
  pagamento_online_status?: string | null
}

export type PedidoCrediarioLike = {
  forma_pagamento?: string | null
  crediario_status?: string | null
  crediario_saldo?: number | null
}

export const normalizarStatusPedido = (status?: string | null) => {
  const normalizado = String(status || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s-]+/g, '_')

  if (normalizado === 'em_preparo') return 'preparando'
  if (normalizado === 'saiu_para_entrega' || normalizado === 'saiu_p_entrega') return 'saiu_para_entrega'
  return normalizado
}

export const pedidoTemPagamentoPendente = (pedido: PedidoPagamentoLike) => {
  if (!pedido.pagamento_online) return false
  const status = normalizarStatusPedido(pedido.pagamento_online_status)
  return status !== 'pago' && status !== 'aprovado' && status !== 'approved'
}

export const pedidoEstaEncerrado = (status?: string | null) => {
  const normalizado = normalizarStatusPedido(status)
  return normalizado === 'entregue' || normalizado === 'cancelado'
}

export const pedidoEstaEmCrediarioAberto = (pedido: PedidoCrediarioLike) => {
  const formaPagamento = String(pedido.forma_pagamento || '').trim().toLowerCase()
  const statusCrediario = String(pedido.crediario_status || '').trim().toLowerCase()
  const saldoCrediario =
    pedido.crediario_saldo === null || pedido.crediario_saldo === undefined
      ? null
      : Number(pedido.crediario_saldo)

  return (
    formaPagamento.includes('credi') &&
    statusCrediario !== 'quitado' &&
    statusCrediario !== 'arquivado' &&
    (saldoCrediario === null || saldoCrediario > 0)
  )
}

export async function carregarItensPorPedido(
  pedidoIds: string[],
): Promise<Map<string, ItemPedido[]>> {
  const mapa = new Map<string, ItemPedido[]>()
  if (pedidoIds.length === 0) return mapa

  const { data, error } = await supabase
    .from('itens_pedido')
    .select(
      'id, pedido_id, nome_item, quantidade, preco_unitario, subtotal, created_at, observacoes, item_adicionais(id, nome, preco, quantidade)',
    )
    .in('pedido_id', pedidoIds)
    .order('created_at')

  if (error) {
    console.error('[pedidos-utils] erro ao carregar itens em batch:', error)
    return mapa
  }

  ;(data || []).forEach((item: any) => {
    const lista = mapa.get(item.pedido_id) || []
    lista.push(item)
    mapa.set(item.pedido_id, lista)
  })

  return mapa
}

export async function carregarCrediarioPorPedido(
  pedidoIds: string[],
): Promise<Map<string, CrediarioInfo>> {
  const mapa = new Map<string, CrediarioInfo>()
  if (pedidoIds.length === 0) return mapa

  const { data: movimentos, error: errorMov } = await supabase
    .from('crediario_movimentos')
    .select('id, pedido_id, conta_id')
    .in('pedido_id', pedidoIds)
    .eq('origem', 'pedido')
    .eq('tipo', 'consumo')
    .eq('status', 'ativo')

  if (errorMov) {
    console.error('[pedidos-utils] erro ao carregar movimentos crediário:', errorMov)
    return mapa
  }

  const contaIds = Array.from(
    new Set((movimentos || []).map((m) => String(m.conta_id || '')).filter(Boolean)),
  )
  if (contaIds.length === 0) return mapa

  const { data: contas, error: errorContas } = await supabase
    .from('crediario_contas')
    .select('id, status, saldo_atual')
    .in('id', contaIds)

  if (errorContas) {
    console.error('[pedidos-utils] erro ao carregar contas crediário:', errorContas)
    return mapa
  }

  const contasPorId = new Map<string, { status: string | null; saldo_atual: number | null }>(
    (contas || []).map((c) => [
      String(c.id),
      {
        status: c.status ? String(c.status) : null,
        saldo_atual:
          c.saldo_atual === null || c.saldo_atual === undefined ? null : Number(c.saldo_atual),
      },
    ]),
  )

  ;(movimentos || []).forEach((m) => {
    const pid = String(m.pedido_id || '')
    const conta = contasPorId.get(String(m.conta_id || ''))
    if (pid && conta) {
      mapa.set(pid, {
        ...conta,
        conta_id: String(m.conta_id || ''),
        movimento_id: String(m.id || ''),
      })
    }
  })

  return mapa
}

export async function carregarGarconsPorIds(
  garconIds: string[],
): Promise<Map<string, string>> {
  const mapa = new Map<string, string>()
  if (garconIds.length === 0) return mapa

  const { data, error } = await supabase
    .from('usuarios_sistema')
    .select('id, nome')
    .in('id', garconIds)

  if (error) {
    console.error('[pedidos-utils] erro ao carregar garçons:', error)
    return mapa
  }

  ;(data || []).forEach((g) => mapa.set(g.id, g.nome))
  return mapa
}
