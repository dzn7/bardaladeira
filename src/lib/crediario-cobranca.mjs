const moeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const dataFortaleza = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Fortaleza',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

const paraNumero = (valor) => {
  const numero = Number(valor || 0)
  return Number.isFinite(numero) ? numero : 0
}

const formatarMoeda = (valor) => moeda.format(valor).replace(/\u00a0/g, ' ')

const limparTexto = (valor, limite = 90) => {
  return String(valor || '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[*_~`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limite)
}

const dataDoMovimento = (movimento, fallback = null) => {
  const valor = movimento?.realizado_em || movimento?.criado_em || fallback
  if (!valor) return null
  const data = new Date(valor)
  return Number.isNaN(data.getTime()) ? null : data
}

const sinalMovimento = (movimento) => {
  const valor = Math.max(0, paraNumero(movimento?.valor))
  if (movimento?.tipo === 'consumo' || movimento?.tipo === 'ajuste') return valor
  if (movimento?.tipo === 'pagamento' || movimento?.tipo === 'estorno') return -valor
  return 0
}

const ordenarMovimentos = (movimentos) => {
  return [...movimentos]
    .filter((movimento) => movimento?.status === 'ativo')
    .sort((a, b) => {
      const dataA = dataDoMovimento(a)?.getTime() || 0
      const dataB = dataDoMovimento(b)?.getTime() || 0
      return dataA - dataB
    })
}

const movimentosDoCicloAberto = (movimentos, saldoAtual) => {
  const ativos = ordenarMovimentos(movimentos)
  const saldoEsperado = Math.max(0, paraNumero(saldoAtual))

  if (saldoEsperado > 0) {
    let saldoSufixo = 0
    let temConsumo = false

    for (let indice = ativos.length - 1; indice >= 0; indice -= 1) {
      const movimento = ativos[indice]
      saldoSufixo += sinalMovimento(movimento)
      if (movimento.tipo === 'consumo' || movimento.tipo === 'ajuste') temConsumo = true
      if (temConsumo && Math.abs(saldoSufixo - saldoEsperado) <= 0.009) {
        return ativos.slice(indice)
      }
    }
  }

  let saldo = 0
  let ultimoQuitado = -1
  ativos.forEach((movimento, indice) => {
    saldo += sinalMovimento(movimento)
    if (saldo <= 0.009) ultimoQuitado = indice
  })
  return ativos.slice(ultimoQuitado + 1)
}

const extrairItens = (movimento) => {
  if (!Array.isArray(movimento?.itens)) return []
  return movimento.itens.map((item) => ({
    nome: limparTexto(item?.nome || item?.name || 'Item'),
    quantidade: Math.max(1, Math.round(paraNumero(item?.quantidade || item?.quantity || 1))),
  })).filter((item) => item.nome)
}

const tituloMovimento = (movimento, referenciaEm) => {
  const descricao = limparTexto(movimento?.descricao)
  const numeroPedido = descricao.match(/pedido\s*#?\s*(\d+)/i)?.[1]
  const data = dataDoMovimento(movimento, referenciaEm)
  const dia = data ? dataFortaleza.format(data) : 'data não informada'
  return numeroPedido ? `pedido #${numeroPedido} · ${dia}` : `compra do dia ${dia}`
}

const resumoMovimento = (movimento, referenciaEm) => {
  const itens = extrairItens(movimento)
  const linhasItens = itens.slice(0, 4).map((item) => `• ${item.quantidade}x ${item.nome}`)
  if (itens.length > 4) linhasItens.push(`• e mais ${itens.length - 4} itens`)
  if (linhasItens.length === 0) {
    const descricao = limparTexto(movimento?.descricao)
    linhasItens.push(`• ${descricao || 'compra anotada no crediário'}`)
  }

  return [
    `*${tituloMovimento(movimento, referenciaEm)}*`,
    ...linhasItens,
    `valor anotado: ${formatarMoeda(Math.max(0, paraNumero(movimento?.valor)))}`,
  ].join('\n')
}

export const normalizarTelefoneCobranca = (valor) => {
  const digitos = String(valor || '').replace(/\D/g, '')
  if (digitos.startsWith('55') && (digitos.length === 12 || digitos.length === 13)) return digitos
  if (digitos.length === 10 || digitos.length === 11) return `55${digitos}`
  return ''
}

export const resolverTelefoneCobranca = (telefoneCadastrado, telefoneInformado) => {
  const cadastrado = normalizarTelefoneCobranca(telefoneCadastrado)
  if (cadastrado) return { telefone: cadastrado, deveCadastrar: false }

  const informado = normalizarTelefoneCobranca(telefoneInformado)
  return {
    telefone: informado,
    deveCadastrar: Boolean(informado),
  }
}

/**
 * @param {{
 *   clienteNome?: string | null,
 *   saldoAtual: number | string,
 *   movimentos?: Array<{
 *     tipo?: string,
 *     status?: string,
 *     valor?: number | string,
 *     descricao?: string | null,
 *     itens?: Array<Record<string, unknown>> | null,
 *     realizado_em?: string | null,
 *     criado_em?: string | null
 *   }>,
 *   referenciaEm?: string | null
 * }} dados
 */
export const montarMensagemCobrancaCrediario = ({
  clienteNome,
  saldoAtual,
  movimentos = [],
  referenciaEm = null,
}) => {
  const saldo = Math.max(0, paraNumero(saldoAtual))
  if (saldo <= 0) throw new Error('saldo_crediario_invalido')

  const primeiroNome = limparTexto(clienteNome, 40).split(' ')[0] || ''
  const consumos = movimentosDoCicloAberto(movimentos, saldo)
    .filter((movimento) => movimento.tipo === 'consumo' || movimento.tipo === 'ajuste')
    .sort((a, b) => (dataDoMovimento(b)?.getTime() || 0) - (dataDoMovimento(a)?.getTime() || 0))

  const exibidos = consumos.slice(0, 3)
  const blocos = exibidos.length > 0
    ? exibidos.map((movimento) => resumoMovimento(movimento, referenciaEm))
    : [resumoMovimento({
        tipo: 'ajuste',
        status: 'ativo',
        valor: saldo,
        descricao: 'Compra anotada no crediário',
        realizado_em: referenciaEm,
        itens: [],
      }, referenciaEm)]

  if (consumos.length > exibidos.length) {
    blocos.push(`e mais ${consumos.length - exibidos.length} compras anotadas`)
  }

  return [
    primeiroNome ? `oi, ${primeiroNome} 😊 tudo bem?` : 'oi 😊 tudo bem?',
    '',
    'passando pra lembrar que ficou um saldo em aberto no seu crediário aqui do Bar da Ladeira.',
    '',
    ...blocos.flatMap((bloco, indice) => indice === blocos.length - 1 ? [bloco] : [bloco, '']),
    '',
    `*saldo total em aberto: ${formatarMoeda(saldo)}*`,
    '',
    'quando puder, fala com a gente por aqui pra regularizar sua conta, tá bem?',
    'se você já pagou, pode desconsiderar esta mensagem 😊',
  ].join('\n')
}
