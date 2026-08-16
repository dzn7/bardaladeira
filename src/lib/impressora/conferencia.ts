import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { DadosPedidoImpressao } from './types'

export type OpcaoTaxaConferencia = 'com_taxa' | 'sem_taxa'

export type AdicionalConferenciaPedido = {
  nome: string
  preco?: number | null
  quantidade?: number | null
}

export type ItemConferenciaPedido = {
  id?: string | null
  nome: string
  quantidade: number
  subtotal: number
  observacoes?: string | null
  adicionais?: AdicionalConferenciaPedido[]
}

export type DadosConferenciaPedido = {
  id: string
  numeroPedido?: number | string | null
  nomeCliente: string
  telefone?: string | null
  tipoEntrega: string
  mesa?: number | null
  comanda?: number | null
  endereco?: string | null
  bairro?: string | null
  createdAt?: string | null
  formaPagamento?: string | null
  pagamentosDivididos?: Array<{
    forma_pagamento: string
    valor: number
  }>
  trocoPara?: number | null
  observacoes?: string | null
  subtotal: number
  taxaEntrega: number
  taxaServico: number
  total: number
  itens: ItemConferenciaPedido[]
}

export type ModeloConferencia = {
  opcaoTaxa: OpcaoTaxaConferencia
  totalItens: number
  subtotal: number
  taxaEntrega: number
  taxaServico: number
  total: number
  linhasTicket: string[]
}

const LARGURA_TICKET = 32

const formatarMoeda = (valor: number) => `R$ ${Number(valor || 0).toFixed(2).replace('.', ',')}`

const formatarFormaPagamento = (forma: string) => {
  const chave = normalizarTextoTicket(forma).toLowerCase()
  if (chave === 'pix') return 'PIX'
  if (chave === 'dinheiro') return 'DINHEIRO'
  if (chave === 'credito' || chave === 'cartao credito' || chave === 'cartão crédito' || chave === 'cartao de credito' || chave === 'cartão de crédito') return 'CARTAO CREDITO'
  if (chave === 'debito' || chave === 'cartao debito' || chave === 'cartão débito' || chave === 'cartao de debito' || chave === 'cartão de débito') return 'CARTAO DEBITO'
  if (chave === 'cartao' || chave === 'cartão') return 'CARTAO'
  if (chave === 'dividido') return 'DIVIDIDO'
  return normalizarTextoTicket(forma).toUpperCase()
}

const textoSemAcentoInseguro = (valor: string) =>
  valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

const normalizarTextoTicket = (valor: string) => textoSemAcentoInseguro(String(valor || '')).replace(/\s+/g, ' ').trim()

const limitarTexto = (valor: string, limite: number) => {
  const texto = normalizarTextoTicket(valor)
  if (texto.length <= limite) return texto
  return `${texto.slice(0, Math.max(0, limite - 1))}…`
}

const montarLinhaDuasColunas = (esquerda: string, direita: string) => {
  const esquerdaTratada = normalizarTextoTicket(esquerda)
  const direitaTratada = normalizarTextoTicket(direita)

  const espacoDisponivel = LARGURA_TICKET - direitaTratada.length - 1
  if (espacoDisponivel <= 0) {
    return direitaTratada.slice(-LARGURA_TICKET)
  }

  const esquerdaFinal = limitarTexto(esquerdaTratada, espacoDisponivel)
  const espacos = Math.max(1, LARGURA_TICKET - esquerdaFinal.length - direitaTratada.length)

  return `${esquerdaFinal}${' '.repeat(espacos)}${direitaTratada}`
}

const obterTipoEntrega = (tipoEntrega: string) => {
  const tipo = normalizarTextoTicket(tipoEntrega).toLowerCase()
  if (tipo.includes('entrega')) return 'entrega'
  if (tipo.includes('retirada') || tipo.includes('balcao')) return 'retirada'
  return 'local'
}

const obterDescricaoAtendimento = (dados: DadosConferenciaPedido) => {
  const tipo = obterTipoEntrega(dados.tipoEntrega)
  if (tipo === 'entrega') return 'ENTREGA'
  if (tipo === 'retirada') return 'RETIRADA'

  if (dados.comanda) return `COMANDA ${dados.comanda}`
  if (dados.mesa) return `MESA ${dados.mesa}`
  return 'CONSUMO LOCAL'
}

const obterNumeroPedido = (dados: DadosConferenciaPedido) => {
  if (dados.numeroPedido !== undefined && dados.numeroPedido !== null && String(dados.numeroPedido).trim() !== '') {
    return String(dados.numeroPedido)
  }
  return dados.id.slice(0, 8).toUpperCase()
}

const calcularTotais = (dados: DadosConferenciaPedido, opcaoTaxa: OpcaoTaxaConferencia) => {
  const subtotal = Number(dados.subtotal || 0)
  const taxaEntrega = Number(dados.taxaEntrega || 0)
  const taxaServicoOriginal = Number(dados.taxaServico || 0)
  const taxaServico = opcaoTaxa === 'sem_taxa' ? 0 : taxaServicoOriginal
  const total = Number((subtotal + taxaEntrega + taxaServico).toFixed(2))

  return {
    subtotal: Number(subtotal.toFixed(2)),
    taxaEntrega: Number(taxaEntrega.toFixed(2)),
    taxaServico: Number(taxaServico.toFixed(2)),
    total,
  }
}

export const montarModeloConferencia = (
  dados: DadosConferenciaPedido,
  opcaoTaxa: OpcaoTaxaConferencia
): ModeloConferencia => {
  const totais = calcularTotais(dados, opcaoTaxa)
  const linhasTicket: string[] = []
  const dataReferencia = dados.createdAt ? new Date(dados.createdAt) : new Date()

  linhasTicket.push('BAR DA LADEIRA')
  linhasTicket.push(obterDescricaoAtendimento(dados))
  linhasTicket.push('')
  linhasTicket.push(`PEDIDO ${obterNumeroPedido(dados)}`)
  linhasTicket.push(format(dataReferencia, 'dd/MM/yyyy HH:mm', { locale: ptBR }))
  linhasTicket.push('-'.repeat(LARGURA_TICKET))
  linhasTicket.push(`Cliente: ${limitarTexto(dados.nomeCliente || 'Cliente', LARGURA_TICKET - 9)}`)

  if (dados.telefone) {
    linhasTicket.push(`Telefone: ${limitarTexto(dados.telefone, LARGURA_TICKET - 10)}`)
  }

  if (dados.comanda) {
    linhasTicket.push(`Comanda: ${dados.comanda}`)
  } else if (dados.mesa) {
    linhasTicket.push(`Mesa: ${dados.mesa}`)
  }

  linhasTicket.push('-'.repeat(LARGURA_TICKET))
  linhasTicket.push('ITENS')

  dados.itens.forEach((item, indice) => {
    const nomeLinha = `${item.quantidade}x ${limitarTexto(item.nome, 24)}`
    linhasTicket.push(montarLinhaDuasColunas(`(${indice + 1}) ${nomeLinha}`, formatarMoeda(item.subtotal)))

    ;(item.adicionais || []).forEach((adicional) => {
      const quantidadeAdicional = Number(adicional.quantidade || 1)
      linhasTicket.push(`   + ${quantidadeAdicional}x ${limitarTexto(adicional.nome, 24)}`)
    })

    if (item.observacoes) {
      linhasTicket.push(`   Obs: ${limitarTexto(item.observacoes, 24)}`)
    }
  })

  linhasTicket.push('-'.repeat(LARGURA_TICKET))
  linhasTicket.push(montarLinhaDuasColunas('Subtotal', formatarMoeda(totais.subtotal)))

  if (totais.taxaEntrega > 0) {
    linhasTicket.push(montarLinhaDuasColunas('Taxa entrega', formatarMoeda(totais.taxaEntrega)))
  }

  if (totais.taxaServico > 0) {
    linhasTicket.push(montarLinhaDuasColunas('Taxa servico', formatarMoeda(totais.taxaServico)))
  }

  linhasTicket.push('='.repeat(LARGURA_TICKET))
  linhasTicket.push(montarLinhaDuasColunas('TOTAL', formatarMoeda(totais.total)))

  const pagamentosDivididosValidos = (dados.pagamentosDivididos || [])
    .filter((pagamento) => Number.isFinite(Number(pagamento?.valor)))
    .filter((pagamento) => Number(pagamento.valor) > 0)

  if (dados.formaPagamento && formatarFormaPagamento(dados.formaPagamento) === 'DIVIDIDO' && pagamentosDivididosValidos.length > 0) {
    linhasTicket.push('-'.repeat(LARGURA_TICKET))
    linhasTicket.push('Pagamento: DIVIDIDO')

    pagamentosDivididosValidos.forEach((pagamento) => {
      linhasTicket.push(
        montarLinhaDuasColunas(
          `- ${formatarFormaPagamento(pagamento.forma_pagamento)}`,
          formatarMoeda(Number(pagamento.valor))
        )
      )
    })
  } else if (dados.formaPagamento) {
    linhasTicket.push('-'.repeat(LARGURA_TICKET))
    linhasTicket.push(`Pagamento: ${limitarTexto(formatarFormaPagamento(dados.formaPagamento), 20)}`)
  }

  if (dados.trocoPara && dados.trocoPara > 0) {
    linhasTicket.push(montarLinhaDuasColunas('Troco para', formatarMoeda(dados.trocoPara)))
  }

  if (dados.observacoes) {
    linhasTicket.push('-'.repeat(LARGURA_TICKET))
    linhasTicket.push(`Obs: ${limitarTexto(dados.observacoes, 28)}`)
  }

  linhasTicket.push('')
  linhasTicket.push('Obrigado pela preferencia!')

  return {
    opcaoTaxa,
    totalItens: dados.itens.reduce((total, item) => total + Number(item.quantidade || 0), 0),
    subtotal: totais.subtotal,
    taxaEntrega: totais.taxaEntrega,
    taxaServico: totais.taxaServico,
    total: totais.total,
    linhasTicket,
  }
}

export const converterConferenciaParaEscpos = (
  dados: DadosConferenciaPedido,
  opcaoTaxa: OpcaoTaxaConferencia
): DadosPedidoImpressao => {
  const totais = calcularTotais(dados, opcaoTaxa)
  const tipoEntrega = obterTipoEntrega(dados.tipoEntrega)
  const pagamentosDivididos = (dados.pagamentosDivididos || [])
    .map((pagamento) => ({
      forma: String(pagamento.forma_pagamento || ''),
      valor: Number(pagamento.valor || 0),
    }))
    .filter((pagamento) => pagamento.forma && pagamento.valor > 0)

  return {
    numeroPedido: obterNumeroPedido(dados),
    dataHora: dados.createdAt ? new Date(dados.createdAt) : new Date(),
    tipoEntrega,
    nomeCliente: dados.nomeCliente || 'Cliente',
    telefone: dados.telefone || undefined,
    endereco: dados.endereco || undefined,
    bairro: dados.bairro || undefined,
    itens: dados.itens.map((item) => ({
      nome: item.nome,
      quantidade: Number(item.quantidade || 0),
      precoUnitario: Number((item.subtotal / Math.max(1, Number(item.quantidade || 1))).toFixed(2)),
      precoTotal: Number(item.subtotal || 0),
      observacoes: item.observacoes || undefined,
      adicionais: (item.adicionais || []).map((adicional) => ({
        nome: adicional.nome,
        preco: Number(adicional.preco || 0),
        quantidade: Number(adicional.quantidade || 1),
      })),
    })),
    subtotal: totais.subtotal,
    taxaEntrega: totais.taxaEntrega,
    taxaServico: totais.taxaServico,
    total: totais.total,
    formaPagamento: dados.formaPagamento || 'Nao informado',
    pagamentosDivididos: pagamentosDivididos.length > 0 ? pagamentosDivididos : undefined,
    observacoes: dados.observacoes || undefined,
    mesa: dados.mesa || undefined,
    comanda: dados.comanda || undefined,
    trocoPara: dados.trocoPara || undefined,
    valorTroco:
      dados.trocoPara && dados.trocoPara > totais.total
        ? Number((dados.trocoPara - totais.total).toFixed(2))
        : undefined,
  }
}
