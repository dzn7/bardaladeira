export const normalizarFormaPagamentoPedido = (valor) => {
  const forma = typeof valor === 'string' ? valor.trim() : ''
  return forma || null
}

export const resolverFormaPagamentoPrincipal = ({ formaPagamento, pagamentoDividido = false } = {}) =>
  pagamentoDividido ? 'Dividido' : normalizarFormaPagamentoPedido(formaPagamento)

export const deveRegistrarPagamentoGlobal = ({ formaPagamento, pagamentoDividido = false, temPagamentoParcial = false } = {}) =>
  Boolean(!pagamentoDividido && !temPagamentoParcial && normalizarFormaPagamentoPedido(formaPagamento))
