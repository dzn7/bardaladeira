import type { LucideIcon } from 'lucide-react'
import { Banknote, CreditCard, Smartphone, Wallet } from 'lucide-react'

export type CanalResumo = { total: number; quantidade: number }

export type PagamentoResumo = { forma: string; total: number; quantidade: number }

export type HorarioPico = { hora: number; quantidade: number }

export type ProdutoVendido = {
  nome: string
  quantidade: number
  receita: number
  pedidos: number
}

export type BairroEntrega = { bairro: string; quantidade: number; taxaTotal: number }

export type CancelamentosDia = {
  quantidade: number
  valorPerdido: number
  percentualSobreBruto: number
}

export type PeriodoComparativo = {
  faturamento: number
  pedidos: number
  ticketMedio: number
}

export type ComparativoDia = {
  ontem: PeriodoComparativo
  semanaPassada: PeriodoComparativo
  variacaoOntem: { faturamento: number; pedidos: number; ticketMedio: number }
  variacaoSemana: { faturamento: number; pedidos: number; ticketMedio: number }
}

export type TaxasEntregaDia = {
  totalTaxas: number
  quantidadeEntregas: number
  mediaPorEntrega: number
}

export type GarcomDia = {
  id: string
  nome: string
  quantidade: number
  faturamento: number
}

export type FiadoDia = {
  valor: number
  quantidadePedidos: number
}

export type DadosDiarios = {
  data: Date
  faturamentoTotal: number
  totalPedidos: number
  ticketMedio: number
  pedidosPorTipo: {
    entregas: CanalResumo
    retiradas: CanalResumo
    local: CanalResumo
  }
  faturamentoPorPagamento: PagamentoResumo[]
  horariosPico: HorarioPico[]
  produtosMaisVendidos: ProdutoVendido[]
  entregasPorBairro: BairroEntrega[]
  cancelamentos: CancelamentosDia
  comparativo: ComparativoDia
  taxasEntrega: TaxasEntregaDia
  equipe: GarcomDia[]
  fiado: FiadoDia
}

export type FormaPagamentoConfig = {
  nome: string
  icone: LucideIcon
  chartCor: string
}

export const FORMAS_PAGAMENTO_CONFIG: Record<string, FormaPagamentoConfig> = {
  dinheiro: { nome: 'Dinheiro', icone: Banknote, chartCor: 'rgba(34, 197, 94, 0.75)' },
  pix: { nome: 'PIX', icone: Smartphone, chartCor: 'rgba(168, 85, 247, 0.75)' },
  pix_online: { nome: 'PIX Online', icone: Smartphone, chartCor: 'rgba(20, 184, 166, 0.75)' },
  credito: { nome: 'Crédito', icone: CreditCard, chartCor: 'rgba(59, 130, 246, 0.75)' },
  debito: { nome: 'Débito', icone: CreditCard, chartCor: 'rgba(245, 158, 11, 0.75)' },
  vale_refeicao: { nome: 'Vale Refeição', icone: Wallet, chartCor: 'rgba(239, 68, 68, 0.75)' },
}

export type PedidoAnalise = {
  id: string
  created_at: string
  total: number | null
  tipo_entrega: string | null
  bairro: string | null
  status: string | null
  taxa_entrega: number | null
  forma_pagamento: string | null
  garcom_id: string | null
  itens_pedido?: Array<{
    pedido_id: string
    nome_item: string
    quantidade: number
    subtotal: number
  }>
}
