import test from 'node:test'
import assert from 'node:assert/strict'

import {
  PRIORIDADES_NOTIFICACAO,
  TIPOS_NOTIFICACAO_ADMIN,
  aplicarLeituraLocal,
  descreverNotificacaoEstoque,
  descreverNotificacaoPedido,
  lerRespostaApiNotificacoes,
  notificacaoAbreModal,
  resumirNotificacoes,
  rotaDaNotificacao,
  selecionarNotificacoesDoModal,
  tipoPermitidoPelasPreferencias,
} from '../src/lib/notificacoes-admin.mjs'

const notificacao = (sobrescritas = {}) => ({
  id: 'n1',
  tipo: 'estoque_baixo',
  prioridade: 'urgente',
  estado: 'ativa',
  entidade_tipo: 'produto',
  entidade_id: 'produto-1',
  criada_em: '2026-08-20T12:00:00.000Z',
  apresentada_em: null,
  lida_em: null,
  silenciada_em: null,
  ...sobrescritas,
})

test('estoque baixo e esgotado usam a fonte de verdade do estoque e são urgentes', () => {
  const baixo = descreverNotificacaoEstoque({
    id: 'p1', nome: 'Coca-Cola 2L', estoque_quantidade: 2, estoque_minimo: 5,
  })
  const esgotado = descreverNotificacaoEstoque({
    id: 'p1', nome: 'Coca-Cola 2L', estoque_quantidade: 0, estoque_minimo: 5,
  })

  assert.equal(baixo.tipo, TIPOS_NOTIFICACAO_ADMIN.ESTOQUE_BAIXO)
  assert.equal(esgotado.tipo, TIPOS_NOTIFICACAO_ADMIN.ESTOQUE_ESGOTADO)
  assert.equal(baixo.prioridade, PRIORIDADES_NOTIFICACAO.URGENTE)
  assert.equal(esgotado.prioridade, PRIORIDADES_NOTIFICACAO.URGENTE)
  assert.equal(baixo.chave_dedupe, 'estoque_baixo:p1')
  assert.equal(esgotado.chave_dedupe, 'estoque_esgotado:p1')
})

test('produto acima do mínimo não gera alerta', () => {
  assert.equal(descreverNotificacaoEstoque({
    id: 'p1', nome: 'Coca-Cola 2L', estoque_quantidade: 6, estoque_minimo: 5,
  }), null)
})

test('pedido novo gera notificação normal apenas enquanto aguarda ação', () => {
  const base = { id: 'pedido-1', numero_pedido: 10, nome_cliente: 'Ana', status: 'confirmado' }
  assert.equal(descreverNotificacaoPedido(base).prioridade, PRIORIDADES_NOTIFICACAO.NORMAL)
  assert.equal(descreverNotificacaoPedido({ ...base, status: 'pendente' }).tipo, 'pedido_novo')
  assert.equal(descreverNotificacaoPedido({ ...base, status: 'preparando' }), null)
  assert.equal(descreverNotificacaoPedido({ ...base, status: 'cancelado' }), null)
})

test('badge conta somente ocorrências ativas, visíveis e ainda não lidas', () => {
  assert.deepEqual(resumirNotificacoes([
    notificacao(),
    notificacao({ id: 'n2', prioridade: 'normal' }),
    notificacao({ id: 'n3', lida_em: '2026-08-20T12:10:00.000Z' }),
    notificacao({ id: 'n4', estado: 'resolvida' }),
    notificacao({ id: 'n5', silenciada_em: '2026-08-20T12:10:00.000Z' }),
  ]), {
    urgentes: 2,
    urgentesNaoLidas: 1,
    normais: 1,
    naoLidas: 2,
    total: 3,
  })
})

test('marcar como lida preserva a ocorrência e atualiza o estado local', () => {
  const agora = '2026-08-20T13:00:00.000Z'
  assert.deepEqual(aplicarLeituraLocal(notificacao(), agora), {
    ...notificacao(),
    apresentada_em: agora,
    lida_em: agora,
  })
})

test('modal só recebe ocorrência ativa ainda não apresentada, lida ou silenciada', () => {
  assert.equal(notificacaoAbreModal(notificacao()), true)
  assert.equal(notificacaoAbreModal(notificacao({ apresentada_em: 'x' })), false)
  assert.equal(notificacaoAbreModal(notificacao({ lida_em: 'x' })), false)
  assert.equal(notificacaoAbreModal(notificacao({ silenciada_em: 'x' })), false)
  assert.equal(notificacaoAbreModal(notificacao({ estado: 'resolvida' })), false)
})

test('modal prioriza urgentes e limita o conjunto apresentado', () => {
  const itens = [
    notificacao({ id: 'normal-recente', prioridade: 'normal', criada_em: '2026-08-20T14:00:00Z' }),
    notificacao({ id: 'urgente-antiga', criada_em: '2026-08-20T11:00:00Z' }),
    notificacao({ id: 'urgente-recente', criada_em: '2026-08-20T13:00:00Z' }),
  ]
  assert.deepEqual(selecionarNotificacoesDoModal(itens, 2).map((item) => item.id), [
    'urgente-recente', 'urgente-antiga',
  ])
})

test('notificação de produto navega para o estoque contextual', () => {
  assert.equal(rotaDaNotificacao(notificacao()), '/admin/estoque?produto=produto-1')
  assert.equal(
    rotaDaNotificacao(notificacao({ entidade_tipo: 'pedido', entidade_id: 'pedido-1' })),
    '/admin/pedidos',
  )
})

test('pagamento de funcionário navega para finanças', () => {
  assert.equal(
    rotaDaNotificacao(notificacao({
      tipo: 'pagamento_funcionario', entidade_tipo: 'funcionario', dados: { competencia: '2026-07-01' },
    })),
    '/admin/financas?secao=pagamentos-equipe&funcionario=produto-1&competencia=2026-07-01',
  )
})

test('preferências desligam categorias sem misturar seus eventos', () => {
  const preferencias = { estoque: false, pedidos: true, pagamentosFuncionarios: false }
  assert.equal(tipoPermitidoPelasPreferencias('estoque_baixo', preferencias), false)
  assert.equal(tipoPermitidoPelasPreferencias('estoque_esgotado', preferencias), false)
  assert.equal(tipoPermitidoPelasPreferencias('pedido_novo', preferencias), true)
  assert.equal(tipoPermitidoPelasPreferencias('pagamento_funcionario', preferencias), false)
})

test('resposta vazia da API vira erro legível em vez de falha de JSON', async () => {
  await assert.rejects(
    () => lerRespostaApiNotificacoes(new Response('', { status: 500 })),
    /Central de notificações indisponível/,
  )
})

test('resposta JSON de erro preserva a mensagem operacional', async () => {
  await assert.rejects(
    () => lerRespostaApiNotificacoes(new Response(
      JSON.stringify({ sucesso: false, erro: 'Serviço temporariamente indisponível.' }),
      { status: 503, headers: { 'content-type': 'application/json' } },
    )),
    /Serviço temporariamente indisponível/,
  )
})
