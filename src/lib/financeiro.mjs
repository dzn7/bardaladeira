const STATUS_NAO_REALIZADO = new Set(['cancelado', 'pendente', 'aguardando_pagamento'])

const paraCentavos = (valor) => {
  const numero = Number(valor ?? 0)
  if (!Number.isFinite(numero)) return 0
  return Math.round((numero + Math.sign(numero) * Number.EPSILON) * 100)
}

const deCentavos = (valor) => Number((valor / 100).toFixed(2))

export const somarDinheiro = (valores) =>
  deCentavos((Array.isArray(valores) ? valores : []).reduce((total, valor) => total + paraCentavos(valor), 0))

export const pedidoContaComoReceita = (pedido) => {
  const status = String(pedido?.status || '').trim().toLowerCase()
  const pagamentoOnlineStatus = String(pedido?.pagamento_online_status || '').trim().toLowerCase()
  return Boolean(status)
    && !STATUS_NAO_REALIZADO.has(status)
    && pagamentoOnlineStatus !== 'aguardando_pagamento'
}

export const filtrarRegistrosNoPeriodo = (registros, inicio, fim) => {
  const inicioMs = new Date(inicio).getTime()
  const fimMs = new Date(fim).getTime()
  if (!Number.isFinite(inicioMs) || !Number.isFinite(fimMs)) return []

  return (Array.isArray(registros) ? registros : []).filter((registro) => {
    const instante = new Date(registro?.created_at).getTime()
    return Number.isFinite(instante) && instante >= inicioMs && instante <= fimMs
  })
}

export const calcularResumoFinanceiro = ({
  pedidos = [],
  movimentacoes = [],
  pedidosNaoPagos = [],
  crediarios = [],
} = {}) => {
  const pedidosRealizados = pedidos.filter(pedidoContaComoReceita)
  const receitaPedidos = somarDinheiro(pedidosRealizados.map((pedido) => pedido.total))
  const receitaExtra = somarDinheiro(
    movimentacoes
      .filter((movimentacao) => movimentacao?.tipo === 'entrada' && !movimentacao?.pedido_id)
      .map((movimentacao) => movimentacao.valor),
  )
  const despesas = somarDinheiro(
    movimentacoes
      .filter((movimentacao) => movimentacao?.tipo === 'saida')
      .map((movimentacao) => movimentacao.valor),
  )
  const receitaTotal = somarDinheiro([receitaPedidos, receitaExtra])
  const resultadoCaixa = somarDinheiro([receitaTotal, -despesas])
  const pedidosNaoPagosTotal = somarDinheiro(pedidosNaoPagos.map((pedido) => pedido.total))
  const crediarioAberto = somarDinheiro(crediarios.map((conta) => conta.saldo_atual))

  return {
    receitaPedidos,
    receitaExtra,
    receitaTotal,
    despesas,
    resultadoCaixa,
    pedidosCount: pedidosRealizados.length,
    ticketMedio: pedidosRealizados.length > 0
      ? deCentavos(Math.round(paraCentavos(receitaPedidos) / pedidosRealizados.length))
      : 0,
    pedidosNaoPagosTotal,
    pedidosNaoPagosCount: pedidosNaoPagos.length,
    crediarioAberto,
    crediarioCount: crediarios.length,
    aReceberTotal: somarDinheiro([pedidosNaoPagosTotal, crediarioAberto]),
  }
}

export const calcularLucroBruto = (itens = []) => {
  let receitaComCustoCentavos = 0
  let custoConhecidoCentavos = 0
  let receitaSemCustoCentavos = 0
  let unidadesSemCusto = 0

  for (const item of Array.isArray(itens) ? itens : []) {
    const quantidade = Math.max(0, Number(item?.quantidade) || 0)
    const subtotalCentavos = paraCentavos(item?.subtotal)

    if (item?.custo_unitario === null || item?.custo_unitario === undefined) {
      receitaSemCustoCentavos += subtotalCentavos
      unidadesSemCusto += quantidade
      continue
    }

    receitaComCustoCentavos += subtotalCentavos
    custoConhecidoCentavos += paraCentavos(Number(item.custo_unitario) * quantidade)
  }

  const lucroCentavos = receitaComCustoCentavos - custoConhecidoCentavos
  const margem = receitaComCustoCentavos > 0
    ? Number(((lucroCentavos / receitaComCustoCentavos) * 100).toFixed(2))
    : 0

  return {
    receitaComCusto: deCentavos(receitaComCustoCentavos),
    custoConhecido: deCentavos(custoConhecidoCentavos),
    lucroBrutoConhecido: deCentavos(lucroCentavos),
    margemBrutaConhecida: margem,
    receitaSemCusto: deCentavos(receitaSemCustoCentavos),
    unidadesSemCusto,
  }
}
