import { obterSituacaoEstoque } from './estoque-produto.mjs'

export const TIPOS_NOTIFICACAO_ADMIN = {
  ESTOQUE_ESGOTADO: 'estoque_esgotado',
  ESTOQUE_BAIXO: 'estoque_baixo',
  PEDIDO_NOVO: 'pedido_novo',
  PAGAMENTO_FUNCIONARIO: 'pagamento_funcionario',
}

export const PRIORIDADES_NOTIFICACAO = {
  URGENTE: 'urgente',
  NORMAL: 'normal',
}

export const LIMITE_MODAL_NOTIFICACOES = 3

export const lerRespostaApiNotificacoes = async (resposta) => {
  const corpo = await resposta.text()
  if (!corpo.trim()) {
    throw new Error('Central de notificações indisponível. Tente novamente em instantes.')
  }

  let json
  try {
    json = JSON.parse(corpo)
  } catch {
    throw new Error('Central de notificações indisponível. Tente novamente em instantes.')
  }

  if (!resposta.ok || !json?.sucesso) {
    throw new Error(
      typeof json?.erro === 'string' && json.erro.trim()
        ? json.erro
        : 'Falha ao carregar notificações.',
    )
  }
  return json
}

const STATUS_PEDIDO_AGUARDANDO = new Set(['pendente', 'confirmado'])
const chaveDedupe = (tipo, entidadeId) => `${tipo}:${entidadeId}`
const concordar = (valor, singular, plural) => `${valor} ${valor === 1 ? singular : plural}`

export const descreverNotificacaoEstoque = (produto) => {
  if (!produto?.id) return null
  const situacao = obterSituacaoEstoque(produto)
  if (situacao === 'em_estoque') return null

  const quantidade = Number(produto.estoque_quantidade ?? produto.quantidade) || 0
  const minimo = Number(produto.estoque_minimo ?? produto.minimo) || 0
  const nome = produto.nome || 'Produto'
  const esgotado = situacao === 'esgotado'
  const tipo = esgotado
    ? TIPOS_NOTIFICACAO_ADMIN.ESTOQUE_ESGOTADO
    : TIPOS_NOTIFICACAO_ADMIN.ESTOQUE_BAIXO

  return {
    tipo,
    prioridade: PRIORIDADES_NOTIFICACAO.URGENTE,
    titulo: esgotado ? 'Produto esgotado' : 'Estoque baixo',
    mensagem: esgotado
      ? `${nome} está sem estoque.`
      : `${nome} possui apenas ${concordar(quantidade, 'unidade', 'unidades')}.`,
    entidade_tipo: 'produto',
    entidade_id: produto.id,
    dados: { quantidade, minimo },
    chave_dedupe: chaveDedupe(tipo, produto.id),
  }
}

export const descreverNotificacaoPedido = (pedido) => {
  if (!pedido?.id) return null
  const status = String(pedido.status || '').trim().toLowerCase()
  if (!STATUS_PEDIDO_AGUARDANDO.has(status)) return null

  const numero = pedido.numero_pedido ?? '—'
  const cliente = pedido.nome_cliente || 'cliente não identificado'
  return {
    tipo: TIPOS_NOTIFICACAO_ADMIN.PEDIDO_NOVO,
    prioridade: PRIORIDADES_NOTIFICACAO.NORMAL,
    titulo: 'Pedido novo',
    mensagem: `Pedido #${numero} de ${cliente} aguarda atendimento.`,
    entidade_tipo: 'pedido',
    entidade_id: pedido.id,
    dados: { numero_pedido: pedido.numero_pedido ?? null },
    chave_dedupe: chaveDedupe(TIPOS_NOTIFICACAO_ADMIN.PEDIDO_NOVO, pedido.id),
  }
}

export const notificacaoAbreModal = (notificacao) =>
  notificacao?.estado === 'ativa'
  && !notificacao.apresentada_em
  && !notificacao.lida_em
  && !notificacao.silenciada_em

export const selecionarNotificacoesDoModal = (lista, limite = LIMITE_MODAL_NOTIFICACOES) =>
  (Array.isArray(lista) ? lista : [])
    .filter(notificacaoAbreModal)
    .sort((a, b) => {
      const prioridadeA = a?.prioridade === PRIORIDADES_NOTIFICACAO.URGENTE ? 0 : 1
      const prioridadeB = b?.prioridade === PRIORIDADES_NOTIFICACAO.URGENTE ? 0 : 1
      return prioridadeA - prioridadeB || new Date(b?.criada_em || 0).getTime() - new Date(a?.criada_em || 0).getTime()
    })
    .slice(0, Math.max(0, limite))

export const notificacaoVisivelNaCentral = (notificacao) =>
  notificacao?.estado === 'ativa' && !notificacao.silenciada_em

export const resumirNotificacoes = (lista) => {
  const resumo = { urgentes: 0, urgentesNaoLidas: 0, normais: 0, naoLidas: 0, total: 0 }
  for (const item of Array.isArray(lista) ? lista : []) {
    if (!notificacaoVisivelNaCentral(item)) continue
    const urgente = item.prioridade === PRIORIDADES_NOTIFICACAO.URGENTE
    const naoLida = !item.lida_em
    resumo.total += 1
    resumo.urgentes += urgente ? 1 : 0
    resumo.normais += urgente ? 0 : 1
    resumo.naoLidas += naoLida ? 1 : 0
    resumo.urgentesNaoLidas += urgente && naoLida ? 1 : 0
  }
  return resumo
}

export const aplicarLeituraLocal = (notificacao, agora = new Date().toISOString()) => ({
  ...notificacao,
  apresentada_em: notificacao?.apresentada_em || agora,
  lida_em: agora,
})

export const tipoPermitidoPelasPreferencias = (tipo, preferencias = {}) => {
  if (tipo === TIPOS_NOTIFICACAO_ADMIN.ESTOQUE_BAIXO || tipo === TIPOS_NOTIFICACAO_ADMIN.ESTOQUE_ESGOTADO) {
    return preferencias.estoque !== false
  }
  if (tipo === TIPOS_NOTIFICACAO_ADMIN.PEDIDO_NOVO) return preferencias.pedidos !== false
  if (tipo === TIPOS_NOTIFICACAO_ADMIN.PAGAMENTO_FUNCIONARIO) {
    return preferencias.pagamentosFuncionarios !== false
  }
  return true
}

export const rotaDaNotificacao = (notificacao) => {
  const id = notificacao?.entidade_id
  if (!id) return null
  if (notificacao.entidade_tipo === 'produto') {
    return `/admin/estoque?produto=${encodeURIComponent(String(id))}`
  }
  if (notificacao.entidade_tipo === 'pedido') return '/admin/pedidos'
  if (notificacao.entidade_tipo === 'funcionario') {
    const competencia = notificacao?.dados?.competencia
    const sufixo = typeof competencia === 'string' && /^\d{4}-\d{2}-01$/.test(competencia)
      ? `&competencia=${encodeURIComponent(competencia)}`
      : ''
    return `/admin/financas?secao=pagamentos-equipe&funcionario=${encodeURIComponent(String(id))}${sufixo}`
  }
  return null
}
