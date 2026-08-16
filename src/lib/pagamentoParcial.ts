import { supabase } from '@/lib/supabase'

type ItemPagoSnapshotMinimo = {
  id?: unknown
  subtotal?: unknown
}

/**
 * Remove de `pagamentos_pedido.itens_pagos` quaisquer snapshots cujos `id`
 * estejam em `itemIdsRemovidos`. Para cada registro afetado:
 *   - se restou >= 1 snapshot, atualiza `itens_pagos` + recalcula `valor`.
 *   - se zerou e o pagamento era 100% por itens (parcial), deleta o registro.
 *
 * Use sempre que itens forem removidos do pedido (edição). Mantém consistência
 * para que o valor pago não fique inflado com snapshots órfãos.
 */
export async function limparSnapshotsOrfaosPagamentos(
  pedidoId: string,
  itemIdsRemovidos: Set<string>,
): Promise<void> {
  if (!pedidoId || itemIdsRemovidos.size === 0) return

  const { data, error } = await supabase
    .from('pagamentos_pedido')
    .select('id, itens_pagos')
    .eq('pedido_id', pedidoId)

  if (error) throw error
  if (!data || data.length === 0) return

  for (const registro of data) {
    const lista = Array.isArray(registro.itens_pagos)
      ? (registro.itens_pagos as ItemPagoSnapshotMinimo[])
      : []
    if (lista.length === 0) continue

    const restantes = lista.filter((snapshot) => !itemIdsRemovidos.has(String(snapshot?.id ?? '')))
    if (restantes.length === lista.length) continue

    if (restantes.length === 0) {
      const { error: erroDelete } = await supabase
        .from('pagamentos_pedido')
        .delete()
        .eq('id', registro.id)
      if (erroDelete) throw erroDelete
    } else {
      const novoValor = Number(
        restantes.reduce((sum, snapshot) => sum + Number(snapshot?.subtotal || 0), 0).toFixed(2),
      )
      const { error: erroUpdate } = await supabase
        .from('pagamentos_pedido')
        .update({ itens_pagos: restantes, valor: novoValor })
        .eq('id', registro.id)
      if (erroUpdate) throw erroUpdate
    }
  }
}

/**
 * Quantidade de cada item já coberta por pagamentos efetivos (dinheiro/PIX/cartão)
 * e por crediário (fiado, separado). Crediário NÃO conta como pago — é dívida em
 * aberto que vai bater no saldo da conta do cliente.
 */
export type PagamentoParcialAgregado = {
  /** Valor efetivamente pago (entrou no caixa). Soma subtotal proporcional à quantidade paga. */
  valor_pago_parcial: number
  /** Valor que está no crediário (fiado, dívida em aberto). */
  valor_em_crediario: number
  /** Mapa itemId → quantidade paga (somando todos os pagamentos não-crediário). */
  quantidade_paga_por_item: Record<string, number>
  /** Mapa itemId → quantidade que foi para crediário. */
  quantidade_crediario_por_item: Record<string, number>
}

type ItemAggregable = {
  id: string
  quantidade?: number | null
  subtotal?: number | null
  preco_unitario?: number | null
}

const FORMAS_CREDIARIO = ['credi', 'fiado', 'conta']

const ehFormaCrediario = (forma: string | null | undefined): boolean => {
  const normalizada = String(forma || '').toLowerCase()
  return FORMAS_CREDIARIO.some((token) => normalizada.includes(token))
}

const somarQuantidade = (
  mapa: Map<string, number>,
  itemId: string,
  quantidade: number,
) => {
  mapa.set(itemId, (mapa.get(itemId) || 0) + quantidade)
}

const acumularItensSnapshot = (
  destino: Map<string, number>,
  lista: Array<{ id?: unknown; quantidade?: unknown }> | null | undefined,
) => {
  if (!Array.isArray(lista) || lista.length === 0) return
  lista.forEach((registro) => {
    if (!registro?.id) return
    const id = String(registro.id)
    const qtd = Number(registro.quantidade)
    somarQuantidade(destino, id, Number.isFinite(qtd) && qtd > 0 ? qtd : 1)
  })
}

/**
 * Carrega pagamentos parciais (pagamentos_pedido.itens_pagos) e itens
 * registrados em crediario_movimentos.itens para um conjunto de pedidos.
 *
 * Crediário fica em campo separado (valor_em_crediario) — NÃO entra em
 * valor_pago_parcial. Quem decide visual/cálculo final é o consumidor.
 */
export async function carregarPagamentosParciaisPorPedido(
  pedidoIds: string[],
  itensPorPedido: Map<string, ItemAggregable[]>,
): Promise<Map<string, PagamentoParcialAgregado>> {
  const resultado = new Map<string, PagamentoParcialAgregado>()
  if (pedidoIds.length === 0) return resultado

  const [pagamentosRes, crediarioRes] = await Promise.all([
    supabase
      .from('pagamentos_pedido')
      .select('pedido_id, forma_pagamento, itens_pagos')
      .in('pedido_id', pedidoIds),
    supabase
      .from('crediario_movimentos')
      .select('pedido_id, itens')
      .in('pedido_id', pedidoIds)
      .eq('origem', 'pedido')
      .eq('tipo', 'consumo')
      .eq('status', 'ativo'),
  ])

  const qtdPagaPorPedido = new Map<string, Map<string, number>>()
  const qtdCrediarioPorPedido = new Map<string, Map<string, number>>()

  ;(pagamentosRes.data || []).forEach((registro) => {
    const pedidoId = String(registro.pedido_id || '')
    if (!pedidoId) return
    const lista = Array.isArray(registro.itens_pagos)
      ? (registro.itens_pagos as Array<{ id?: unknown; quantidade?: unknown }>)
      : null
    if (!lista) return
    const destino = ehFormaCrediario(registro.forma_pagamento)
      ? (qtdCrediarioPorPedido.get(pedidoId) || new Map<string, number>())
      : (qtdPagaPorPedido.get(pedidoId) || new Map<string, number>())
    acumularItensSnapshot(destino, lista)
    if (ehFormaCrediario(registro.forma_pagamento)) {
      qtdCrediarioPorPedido.set(pedidoId, destino)
    } else {
      qtdPagaPorPedido.set(pedidoId, destino)
    }
  })

  ;(crediarioRes.data || []).forEach((registro) => {
    const pedidoId = String(registro.pedido_id || '')
    if (!pedidoId) return
    const destino = qtdCrediarioPorPedido.get(pedidoId) || new Map<string, number>()
    acumularItensSnapshot(
      destino,
      Array.isArray(registro.itens) ? (registro.itens as Array<{ id?: unknown; quantidade?: unknown }>) : null,
    )
    qtdCrediarioPorPedido.set(pedidoId, destino)
  })

  const pedidosTocados = new Set<string>()
  qtdPagaPorPedido.forEach((_, pedidoId) => pedidosTocados.add(pedidoId))
  qtdCrediarioPorPedido.forEach((_, pedidoId) => pedidosTocados.add(pedidoId))

  pedidosTocados.forEach((pedidoId) => {
    const itens = itensPorPedido.get(pedidoId) || []
    const pagas = qtdPagaPorPedido.get(pedidoId) || new Map<string, number>()
    const crediario = qtdCrediarioPorPedido.get(pedidoId) || new Map<string, number>()

    let valorPago = 0
    let valorCrediario = 0
    const quantidadePagaPorItem: Record<string, number> = {}
    const quantidadeCrediarioPorItem: Record<string, number> = {}

    itens.forEach((item) => {
      const total = Number(item.quantidade || 0) || 1
      const subtotal = Number(item.subtotal || 0)
      const precoUnitario = total > 0 ? subtotal / total : Number(item.preco_unitario || 0)

      const qtdPaga = Math.min(pagas.get(item.id) || 0, total)
      const qtdCrediario = Math.min(crediario.get(item.id) || 0, total - qtdPaga)

      if (qtdPaga > 0) {
        valorPago += qtdPaga * precoUnitario
        quantidadePagaPorItem[item.id] = qtdPaga
      }
      if (qtdCrediario > 0) {
        valorCrediario += qtdCrediario * precoUnitario
        quantidadeCrediarioPorItem[item.id] = qtdCrediario
      }
    })

    resultado.set(pedidoId, {
      valor_pago_parcial: Number(valorPago.toFixed(2)),
      valor_em_crediario: Number(valorCrediario.toFixed(2)),
      quantidade_paga_por_item: quantidadePagaPorItem,
      quantidade_crediario_por_item: quantidadeCrediarioPorItem,
    })
  })

  return resultado
}
