export function normalizarFormaPagamentoPedido(valor?: unknown): string | null
export function resolverFormaPagamentoPrincipal(entrada?: { formaPagamento?: unknown; pagamentoDividido?: boolean }): string | null
export function deveRegistrarPagamentoGlobal(entrada?: { formaPagamento?: unknown; pagamentoDividido?: boolean; temPagamentoParcial?: boolean }): boolean
