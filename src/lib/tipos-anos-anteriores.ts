/**
 * Tipos para a funcionalidade de Anos Anteriores
 */

export type EstatisticasAnuais = {
  totalPedidos: number
  receitaTotal: number
  ticketMedio: number
  pedidosEntrega: number
  pedidosRetirada: number
  pedidosLocal: number
  receitaEntrega: number
  receitaRetirada: number
  receitaLocal: number
  totalEntregas: number
  totalTaxasEntrega: number
}

export type PedidoHistorico = {
  id: string
  nome_cliente: string
  telefone?: string
  endereco?: string
  tipo_entrega: string
  forma_pagamento: string
  subtotal: number
  taxa_entrega: number
  total: number
  status: string
  observacoes?: string
  mesa?: number | null
  bairro?: string
  created_at: string
  itens?: ItemPedidoHistorico[]
}

export type ItemPedidoHistorico = {
  id: string
  nome_item?: string
  quantidade: number
  preco_unitario: number
  subtotal: number
  observacoes?: string
  adicionais?: AdicionalHistorico[]
}

export type AdicionalHistorico = {
  id: string
  nome_adicional: string
  preco: number
}

export type EntregaHistorico = {
  id: string
  pedido_id: string
  entregador_nome?: string
  status: string
  endereco_entrega?: string
  bairro?: string
  taxa_entrega: number
  tempo_estimado?: number
  tempo_real?: number
  data_saida?: string
  data_entrega?: string
  created_at: string
}

export type RelatorioVendasPorDia = {
  data: string
  total: number
  quantidade: number
}

export type RelatorioProdutosMaisVendidos = {
  nome: string
  quantidade: number
  receita: number
}

export type RelatorioVendasPorCategoria = {
  categoria: string
  quantidade: number
  receita: number
}

export type RelatorioHorariosPico = {
  hora: number
  quantidade: number
}

export type RelatorioFaturamentoPagamento = {
  forma: string
  total: number
  quantidade: number
}

export type RelatorioEntregasPorBairro = {
  bairro: string
  quantidade: number
  taxaTotal: number
}

export type AbaAnosAnteriores = 'dashboard' | 'pedidos' | 'relatorios' | 'entregas' | 'saldos' | 'salarios'
