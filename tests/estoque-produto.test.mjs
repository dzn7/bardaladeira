import test from 'node:test'
import assert from 'node:assert/strict'

import {
  ESTOQUE_MINIMO_PADRAO,
  ESTOQUE_QUANTIDADE_PADRAO,
  ajustarQuantidadeEstoque,
  avaliarCompraProduto,
  camposEstoqueParaCatalogo,
  camposEstoqueParaPersistenciaCatalogo,
  formatarErroEstoque,
  mensagemAvaliacaoCompra,
  normalizarTextoBusca,
  produtoCorrespondeBuscaEstoque,
  somarQuantidadeProdutoNoCarrinho,
  normalizarConfiguracaoEstoque,
  normalizarDinheiro,
  obterSituacaoEstoque,
  obterSituacaoEstoqueProduto,
} from '../src/lib/estoque-produto.mjs'

test('aplica defaults e aceita zero nas configuracoes de estoque', () => {
  assert.deepEqual(normalizarConfiguracaoEstoque({}), {
    quantidade: ESTOQUE_QUANTIDADE_PADRAO,
    minimo: ESTOQUE_MINIMO_PADRAO,
    bloquear: false,
  })
  assert.deepEqual(
    normalizarConfiguracaoEstoque({ quantidade: '0', minimo: 0, bloquear: true }),
    { quantidade: 0, minimo: 0, bloquear: true },
  )
})

test('rejeita quantidade negativa, fracionaria ou nao numerica', () => {
  for (const quantidade of [-1, 1.5, '1.5', 'abc']) {
    assert.throws(() => normalizarConfiguracaoEstoque({ quantidade }), /inteiro não negativo/i)
  }
})

test('classifica os limites zero, minimo e minimo mais um', () => {
  assert.equal(obterSituacaoEstoque({ quantidade: 0, minimo: 5 }), 'esgotado')
  assert.equal(obterSituacaoEstoque({ quantidade: 5, minimo: 5 }), 'baixo')
  assert.equal(obterSituacaoEstoque({ quantidade: 6, minimo: 5 }), 'em_estoque')
  assert.equal(
    obterSituacaoEstoqueProduto({ estoque_quantidade: 5, estoque_minimo: 5 }),
    'baixo',
  )
})

test('bloqueio considera o que ja esta no carrinho', () => {
  const produto = { disponivel: true, quantidade: 3, minimo: 1, bloquear: true }
  assert.deepEqual(avaliarCompraProduto(produto, 2, 1), {
    permitido: true,
    quantidadeMaxima: 1,
    motivo: null,
  })
  assert.deepEqual(avaliarCompraProduto(produto, 2, 2), {
    permitido: false,
    quantidadeMaxima: 1,
    motivo: 'estoque_insuficiente',
  })

  assert.deepEqual(
    avaliarCompraProduto({ ...produto, bloquear: false }, 200, 50),
    { permitido: true, quantidadeMaxima: null, motivo: null },
  )
  assert.equal(
    avaliarCompraProduto({
      disponivel: true,
      estoque_quantidade: 0,
      bloquear_venda_sem_estoque: true,
    }, 0, 1).permitido,
    false,
  )
})

test('ajuste local rejeita resultado negativo e preserva inteiro', () => {
  assert.equal(ajustarQuantidadeEstoque(2, -2), 0)
  assert.equal(ajustarQuantidadeEstoque(2, 3), 5)
  assert.throws(() => ajustarQuantidadeEstoque(2, -3), /negativo/i)
  assert.throws(() => ajustarQuantidadeEstoque(2, 0.5), /inteiro/i)
})

test('normaliza dinheiro com virgula ou ponto e arredonda em centavos', () => {
  assert.equal(normalizarDinheiro('10,2'), '10.20')
  assert.equal(normalizarDinheiro('10.235'), '10.24')
  assert.equal(normalizarDinheiro(0), '0.00')
  assert.equal(normalizarDinheiro('', { opcional: true }), null)
  assert.throws(() => normalizarDinheiro('-0,01'), /não negativo/i)
  assert.throws(() => normalizarDinheiro('NaN'), /monetário/i)
})

test('campos de custo e estoque pertencem somente a produtos', () => {
  const campos = camposEstoqueParaCatalogo('produto', {
    custoUnitario: '12,345',
    quantidade: '4',
    minimo: '1',
    bloquear: true,
  })
  assert.deepEqual(campos, {
    custo_unitario: '12.35',
    estoque_quantidade: 4,
    estoque_minimo: 1,
    bloquear_venda_sem_estoque: true,
  })
  assert.deepEqual(camposEstoqueParaCatalogo('bebida', campos), {})
  assert.deepEqual(camposEstoqueParaCatalogo('combo', campos), {})
})

test('persistencia de catalogo omite quantidade para ir via RPC', () => {
  assert.deepEqual(
    camposEstoqueParaPersistenciaCatalogo('produto', {
      custoUnitario: '8,5',
      quantidade: '3',
      minimo: '2',
      bloquear: false,
    }),
    {
      custo_unitario: '8.50',
      estoque_minimo: 2,
      bloquear_venda_sem_estoque: false,
    },
  )
  assert.deepEqual(camposEstoqueParaPersistenciaCatalogo('bebida', { quantidade: 4 }), {})
})

test('busca de estoque ignora acento e caixa em nome e categoria', () => {
  assert.equal(normalizarTextoBusca('Pão de Alho'), 'pao de alho')
  assert.equal(
    produtoCorrespondeBuscaEstoque({ nome: 'X-Burguer', categoria: 'Lanches' }, 'LANCHE'),
    true,
  )
  assert.equal(
    produtoCorrespondeBuscaEstoque({ nome: 'Pão', categoria: 'Acompanhamentos' }, 'pao'),
    true,
  )
  assert.equal(
    produtoCorrespondeBuscaEstoque({ nome: 'X-Burguer', categoria: 'Lanches' }, 'bebida'),
    false,
  )
})

test('soma quantidade ja no carrinho pelo mesmo produto', () => {
  const itens = [
    { produto: { id: 'a' }, quantidade: 2 },
    { produto: { id: 'b' }, quantidade: 9 },
    { produtoId: 'a', quantidade: 1 },
  ]
  assert.equal(somarQuantidadeProdutoNoCarrinho(itens, 'a'), 3)
  assert.equal(somarQuantidadeProdutoNoCarrinho(itens, 'c'), 0)
})

test('mensagem de compra usa o texto de dominio', () => {
  assert.equal(
    mensagemAvaliacaoCompra({ nome: 'X-Burguer' }, {
      permitido: false,
      quantidadeMaxima: 2,
      motivo: 'estoque_insuficiente',
    }),
    'Estoque insuficiente para X-Burguer. Disponível: 2.',
  )
  assert.equal(
    mensagemAvaliacaoCompra({ nome: 'X-Burguer' }, { permitido: true, quantidadeMaxima: 2, motivo: null }),
    null,
  )
})

test('traduz ESTOQUE_INSUFICIENTE para mensagem de dominio', () => {
  assert.equal(
    formatarErroEstoque({ message: 'ESTOQUE_INSUFICIENTE:abc:X-Burguer:2' }),
    'Estoque insuficiente para X-Burguer. Disponível: 2.',
  )
  assert.equal(formatarErroEstoque(new Error('falha comum')), 'falha comum')
})
