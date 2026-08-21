import test from 'node:test'
import assert from 'node:assert/strict'

import {
  obterVencimentoMensal,
  situacaoPagamentoFuncionario,
  validarConfiguracaoPagamento,
} from '../src/lib/pagamentos-funcionarios.mjs'

test('vencimento mensal preserva o dia configurado', () => {
  assert.equal(obterVencimentoMensal('2026-08-01', 20), '2026-08-20')
})

test('dia inexistente é ajustado ao último dia do mês', () => {
  assert.equal(obterVencimentoMensal('2026-02-01', 31), '2026-02-28')
  assert.equal(obterVencimentoMensal('2028-02-01', 31), '2028-02-29')
})

test('pagamento entra em atenção dentro da antecedência configurada', () => {
  assert.deepEqual(situacaoPagamentoFuncionario({
    competencia: '2026-08-01', diaVencimento: 23, antecedenciaDias: 3, hoje: '2026-08-20', pagoEm: null,
  }), { estado: 'proximo', vencimento: '2026-08-23', dias: 3 })
})

test('pagamento atrasado permanece urgente até ser pago', () => {
  assert.deepEqual(situacaoPagamentoFuncionario({
    competencia: '2026-07-01', diaVencimento: 15, antecedenciaDias: 3, hoje: '2026-08-20', pagoEm: null,
  }), { estado: 'atrasado', vencimento: '2026-07-15', dias: 36 })
})

test('competência paga não permanece pendente', () => {
  assert.deepEqual(situacaoPagamentoFuncionario({
    competencia: '2026-08-01', diaVencimento: 20, antecedenciaDias: 3, hoje: '2026-08-20', pagoEm: '2026-08-19T15:00:00Z',
  }), { estado: 'pago', vencimento: '2026-08-20', dias: 0 })
})

test('configuração rejeita limites e dinheiro inválidos', () => {
  assert.equal(validarConfiguracaoPagamento({ diaVencimento: 1, antecedenciaDias: 0, valorPrevisto: null }).valida, true)
  assert.equal(validarConfiguracaoPagamento({ diaVencimento: 32, antecedenciaDias: 3, valorPrevisto: 100 }).valida, false)
  assert.equal(validarConfiguracaoPagamento({ diaVencimento: 10, antecedenciaDias: 31, valorPrevisto: 100 }).valida, false)
  assert.equal(validarConfiguracaoPagamento({ diaVencimento: 10, antecedenciaDias: 3, valorPrevisto: -1 }).valida, false)
})
