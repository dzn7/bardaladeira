import test from 'node:test'
import assert from 'node:assert/strict'

import { criarVinculoCatalogoItemPedido } from '../src/lib/vinculo-catalogo-item-pedido.mjs'

test('preserva produto_id no payload de item', () => {
  assert.deepEqual(criarVinculoCatalogoItemPedido('produto', 'produto-1'), {
    produto_id: 'produto-1',
    bebida_id: null,
    combo_id: null,
  })
})

test('preserva bebida_id no payload de item', () => {
  assert.deepEqual(criarVinculoCatalogoItemPedido('bebida', 'bebida-1'), {
    produto_id: null,
    bebida_id: 'bebida-1',
    combo_id: null,
  })
})

test('preserva combo_id no payload de item', () => {
  assert.deepEqual(criarVinculoCatalogoItemPedido('combo', 'combo-1'), {
    produto_id: null,
    bebida_id: null,
    combo_id: 'combo-1',
  })
})

test('rejeita catalogo desconhecido ou id vazio', () => {
  assert.throws(() => criarVinculoCatalogoItemPedido('adicional', 'adicional-1'), /tipo de catálogo/i)
  assert.throws(() => criarVinculoCatalogoItemPedido('produto', ''), /identificador/i)
})
