export interface PedidoResumoFinanceiro { status?: string | null; pagamento_online_status?: string | null; total?: number | string | null }
export interface MovimentacaoResumoFinanceiro { tipo?: string | null; pedido_id?: string | null; valor?: number | string | null }
export interface ItemLucroBruto { quantidade?: number | string | null; subtotal?: number | string | null; custo_unitario?: number | string | null }
export function somarDinheiro(valores: unknown[]): number
export function pedidoContaComoReceita(pedido: PedidoResumoFinanceiro): boolean
export function filtrarRegistrosNoPeriodo<T extends { created_at?: string | null }>(registros: T[], inicio: string, fim: string): T[]
export function calcularResumoFinanceiro(entrada?: {
  pedidos?: PedidoResumoFinanceiro[]
  movimentacoes?: MovimentacaoResumoFinanceiro[]
  pedidosNaoPagos?: Array<{ total?: number | string | null }>
  crediarios?: Array<{ saldo_atual?: number | string | null }>
}): {
  receitaPedidos: number; receitaExtra: number; receitaTotal: number; despesas: number
  resultadoCaixa: number; pedidosCount: number; ticketMedio: number
  pedidosNaoPagosTotal: number; pedidosNaoPagosCount: number; crediarioAberto: number
  crediarioCount: number; aReceberTotal: number
}
export function calcularLucroBruto(itens?: ItemLucroBruto[]): {
  receitaComCusto: number; custoConhecido: number; lucroBrutoConhecido: number
  margemBrutaConhecida: number; receitaSemCusto: number; unidadesSemCusto: number
}
