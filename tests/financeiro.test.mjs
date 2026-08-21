import test from 'node:test'
import assert from 'node:assert/strict'

import {
  calcularLucroBruto,
  calcularResumoFinanceiro,
  filtrarRegistrosNoPeriodo,
  pedidoContaComoReceita,
  somarDinheiro,
} from '../src/lib/financeiro.mjs'

test('pedido cancelado, pendente ou aguardando pagamento não entra na receita realizada', () => {
  for (const status of ['cancelado', 'pendente', 'aguardando_pagamento']) {
    assert.equal(pedidoContaComoReceita({ status }), false)
  }
  for (const status of ['confirmado', 'preparando', 'pronto', 'saiu_para_entrega', 'entregue']) {
    assert.equal(pedidoContaComoReceita({ status }), true)
  }
  assert.equal(
    pedidoContaComoReceita({ status: 'confirmado', pagamento_online_status: 'aguardando_pagamento' }),
    false,
  )
})

test('soma monetária preserva centavos', () => {
  assert.equal(somarDinheiro([0.1, 0.2, '10.035']), 10.34)
})

test('resumo separa pedidos realizados, entradas manuais, despesas e resultado de caixa', () => {
  const resumo = calcularResumoFinanceiro({
    pedidos: [
      { id: 'p1', status: 'entregue', total: 30 },
      { id: 'p2', status: 'pendente', total: 99 },
      { id: 'p3', status: 'cancelado', total: 88 },
    ],
    movimentacoes: [
      { tipo: 'entrada', pedido_id: null, valor: 2.25 },
      { tipo: 'entrada', pedido_id: 'p1', valor: 30 },
      { tipo: 'saida', pedido_id: null, valor: 7.1 },
    ],
    pedidosNaoPagos: [{ total: 99 }],
    crediarios: [{ saldo_atual: 12.5 }],
  })

  assert.deepEqual(resumo, {
    receitaPedidos: 30,
    receitaExtra: 2.25,
    receitaTotal: 32.25,
    despesas: 7.1,
    resultadoCaixa: 25.15,
    pedidosCount: 1,
    ticketMedio: 30,
    pedidosNaoPagosTotal: 99,
    pedidosNaoPagosCount: 1,
    crediarioAberto: 12.5,
    crediarioCount: 1,
    aReceberTotal: 111.5,
  })
})

test('lucro bruto usa somente o custo congelado no item vendido', () => {
  const resumo = calcularLucroBruto([
    { quantidade: 2, subtotal: 30, custo_unitario: 10 },
    { quantidade: 1, subtotal: 12, custo_unitario: null },
  ])

  assert.deepEqual(resumo, {
    receitaComCusto: 30,
    custoConhecido: 20,
    lucroBrutoConhecido: 10,
    margemBrutaConhecida: 33.33,
    receitaSemCusto: 12,
    unidadesSemCusto: 1,
  })
})

test('alterar custo de catálogo não muda o lucro de um item já vendido', () => {
  const itemVendido = { quantidade: 1, subtotal: 25, custo_unitario: 10 }
  const produtoAtual = { custo_unitario: 15 }

  assert.equal(calcularLucroBruto([itemVendido]).lucroBrutoConhecido, 15)
  assert.equal(produtoAtual.custo_unitario, 15)
})

test('filtro de período é inclusivo nas duas pontas', () => {
  const registros = [
    { id: 'antes', created_at: '2026-08-01T02:59:59.999Z' },
    { id: 'inicio', created_at: '2026-08-01T03:00:00.000Z' },
    { id: 'fim', created_at: '2026-09-01T02:59:59.999Z' },
    { id: 'depois', created_at: '2026-09-01T03:00:00.000Z' },
  ]

  assert.deepEqual(
    filtrarRegistrosNoPeriodo(
      registros,
      '2026-08-01T03:00:00.000Z',
      '2026-09-01T02:59:59.999Z',
    ).map((item) => item.id),
    ['inicio', 'fim'],
  )
})
