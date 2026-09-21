import test from 'node:test'
import assert from 'node:assert/strict'
import { deveRegistrarPagamentoGlobal, resolverFormaPagamentoPrincipal } from '../src/lib/pedido-forma-pagamento.mjs'

test('pedido sem pagamento não cria pagamento global', () => {
  assert.equal(resolverFormaPagamentoPrincipal({ formaPagamento: '' }), null)
  assert.equal(deveRegistrarPagamentoGlobal({ formaPagamento: null }), false)
  assert.equal(deveRegistrarPagamentoGlobal({ formaPagamento: 'PIX' }), true)
})
