import type {
  BairroEntrega,
  CanalResumo,
  CancelamentosDia,
  GarcomDia,
  HorarioPico,
  PedidoAnalise,
  ProdutoVendido,
  TaxasEntregaDia,
} from '../types'

export const processarPedidosPorTipo = (pedidos: PedidoAnalise[]) => {
  const tipos = {
    entregas: { total: 0, quantidade: 0 } satisfies CanalResumo,
    retiradas: { total: 0, quantidade: 0 } satisfies CanalResumo,
    local: { total: 0, quantidade: 0 } satisfies CanalResumo,
  }

  for (const pedido of pedidos) {
    if (!pedido?.id) continue
    const tipo = (pedido.tipo_entrega || 'local').toLowerCase()
    const valor = Number(pedido.total) || 0
    if (tipo === 'entrega') {
      tipos.entregas.total += valor
      tipos.entregas.quantidade++
    } else if (tipo === 'retirada') {
      tipos.retiradas.total += valor
      tipos.retiradas.quantidade++
    } else {
      tipos.local.total += valor
      tipos.local.quantidade++
    }
  }

  return tipos
}

export const processarHorariosPico = (pedidos: PedidoAnalise[]): HorarioPico[] => {
  const horarios: Record<number, number> = {}
  pedidos.forEach((p) => {
    const hora = new Date(p.created_at).getHours()
    horarios[hora] = (horarios[hora] || 0) + 1
  })
  return Array.from({ length: 24 }, (_, h) => ({ hora: h, quantidade: horarios[h] || 0 }))
}

export const processarProdutosMaisVendidos = (pedidos: PedidoAnalise[]): ProdutoVendido[] => {
  const produtos: Record<string, { quantidade: number; receita: number; pedidos: Set<string> }> = {}
  for (const pedido of pedidos) {
    if (!pedido?.id || !Array.isArray(pedido.itens_pedido)) continue
    const nomesNoPedido = new Set<string>()
    for (const item of pedido.itens_pedido) {
      const nome = item?.nome_item
      if (!item || !nome) continue
      if (!produtos[nome]) produtos[nome] = { quantidade: 0, receita: 0, pedidos: new Set() }
      produtos[nome].quantidade += Number(item.quantidade) || 1
      produtos[nome].receita += Number(item.subtotal) || 0
      nomesNoPedido.add(nome)
    }
    for (const nome of Array.from(nomesNoPedido)) {
      produtos[nome].pedidos.add(pedido.id)
    }
  }
  return Object.entries(produtos)
    .map(([nome, v]) => ({
      nome,
      quantidade: v.quantidade,
      receita: v.receita,
      pedidos: v.pedidos.size,
    }))
    .filter((p) => p.quantidade > 0)
    .sort((a, b) => b.quantidade - a.quantidade || b.receita - a.receita)
}

export const processarEntregasPorBairro = (pedidos: PedidoAnalise[]): BairroEntrega[] => {
  const bairros: Record<string, { quantidade: number; taxaTotal: number }> = {}
  for (const pedido of pedidos) {
    if (!pedido?.id) continue
    const tipo = (pedido.tipo_entrega || '').toLowerCase()
    const status = (pedido.status || '').toLowerCase()
    const bairro = (pedido.bairro || '').trim()
    if (tipo !== 'entrega' || status !== 'entregue' || !bairro) continue
    if (!bairros[bairro]) bairros[bairro] = { quantidade: 0, taxaTotal: 0 }
    bairros[bairro].quantidade += 1
    bairros[bairro].taxaTotal += Number(pedido.taxa_entrega) || 0
  }
  return Object.entries(bairros)
    .map(([bairro, v]) => ({ bairro, ...v }))
    .filter((b) => b.quantidade > 0)
    .sort((a, b) => b.quantidade - a.quantidade)
}

export const processarTaxasEntrega = (pedidos: PedidoAnalise[]): TaxasEntregaDia => {
  let totalTaxas = 0
  let quantidadeEntregas = 0
  for (const pedido of pedidos) {
    const tipo = (pedido.tipo_entrega || '').toLowerCase()
    if (tipo !== 'entrega') continue
    quantidadeEntregas += 1
    totalTaxas += Number(pedido.taxa_entrega) || 0
  }
  return {
    totalTaxas,
    quantidadeEntregas,
    mediaPorEntrega: quantidadeEntregas > 0 ? totalTaxas / quantidadeEntregas : 0,
  }
}

export const processarCancelamentos = (
  cancelados: Array<{ total: number | null }>,
  faturamentoValido: number,
): CancelamentosDia => {
  const quantidade = cancelados.length
  const valorPerdido = cancelados.reduce((s, p) => s + Number(p.total || 0), 0)
  const bruto = faturamentoValido + valorPerdido
  return {
    quantidade,
    valorPerdido,
    percentualSobreBruto: bruto > 0 ? (valorPerdido / bruto) * 100 : 0,
  }
}

export const processarEquipe = (
  pedidos: PedidoAnalise[],
  nomes: Map<string, string>,
): GarcomDia[] => {
  const mapa: Record<string, { quantidade: number; faturamento: number }> = {}
  for (const pedido of pedidos) {
    const id = pedido.garcom_id
    if (!id) continue
    if (!mapa[id]) mapa[id] = { quantidade: 0, faturamento: 0 }
    mapa[id].quantidade += 1
    mapa[id].faturamento += Number(pedido.total) || 0
  }
  return Object.entries(mapa)
    .map(([id, v]) => ({
      id,
      nome: nomes.get(id) || 'Sem nome',
      ...v,
    }))
    .sort((a, b) => b.quantidade - a.quantidade)
}
