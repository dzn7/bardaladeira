/**
 * Geração de comandos ESC/POS alinhada ao ticket do app Electron.
 * Mantém a semântica do ticket de referência, adaptando o layout para texto térmico.
 */

import {
  CARACTERES_POR_LINHA,
  DadosPedidoImpressao,
  EscopoImpressao,
  TamanhoPapel,
  TipoTicket,
} from './types'

const codificarTexto = (conteudo: string) =>
  Array.from(normalizarTextoImpressao(conteudo)).map((caractere) => caractere.charCodeAt(0) & 0xff)

export class ConstrutorESCPOS {
  private buffer: number[] = []
  private largura: number

  constructor(tamanhoPapel: TamanhoPapel = '80mm') {
    this.largura = CARACTERES_POR_LINHA[tamanhoPapel]
    this.inicializar()
  }

  inicializar(): this {
    this.buffer.push(0x1b, 0x40)
    return this
  }

  alinhar(alinhamento: 'esquerda' | 'centro' | 'direita'): this {
    const valores = { esquerda: 0, centro: 1, direita: 2 }
    this.buffer.push(0x1b, 0x61, valores[alinhamento])
    return this
  }

  tamanhoFonte(tamanho: 'normal' | 'dupla-altura' | 'dupla-largura' | 'dupla'): this {
    const valores = {
      normal: 0x00,
      'dupla-altura': 0x01,
      'dupla-largura': 0x10,
      dupla: 0x11,
    }
    this.buffer.push(0x1d, 0x21, valores[tamanho])
    return this
  }

  negrito(ativo: boolean): this {
    this.buffer.push(0x1b, 0x45, ativo ? 1 : 0)
    return this
  }

  texto(conteudo: string): this {
    this.buffer.push(...codificarTexto(conteudo))
    return this
  }

  novaLinha(quantidade = 1): this {
    for (let indice = 0; indice < quantidade; indice += 1) {
      this.buffer.push(0x0a)
    }
    return this
  }

  linhaHorizontal(caractere = '-'): this {
    this.texto(caractere.repeat(this.largura))
    this.novaLinha()
    return this
  }

  adicionarLinhas(linhas: string[], alinhamento: 'esquerda' | 'centro' | 'direita' = 'esquerda'): this {
    this.alinhar(alinhamento)
    for (const linha of linhas) {
      this.texto(linha)
      this.novaLinha()
    }
    if (alinhamento !== 'esquerda') {
      this.alinhar('esquerda')
    }
    return this
  }

  alimentarPapel(linhas = 3): this {
    this.buffer.push(0x1b, 0x64, linhas)
    return this
  }

  cortarPapel(): this {
    this.alimentarPapel(4)
    this.buffer.push(0x1d, 0x56, 0x01)
    return this
  }

  construir(): Uint8Array {
    return new Uint8Array(this.buffer)
  }
}

function normalizarTextoImpressao(valor: string) {
  return String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7e]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function formatarMoeda(valor: number) {
  return `R$ ${Number(valor || 0).toFixed(2).replace('.', ',')}`
}

function formatarDataHora(data: Date) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(data)
}

function formatarFormaPagamentoTicket(forma?: string | null) {
  const chave = String(forma || '').trim().toLowerCase()

  if (chave === 'pix') return 'PIX'
  if (chave === 'dinheiro') return 'Dinheiro'
  if (chave === 'credito' || chave === 'cartao credito' || chave === 'cartao de credito')
    return 'Cartao de Credito'
  if (chave === 'debito' || chave === 'cartao debito' || chave === 'cartao de debito')
    return 'Cartao de Debito'
  if (chave === 'cartao') return 'Cartao'
  if (chave === 'dividido') return 'Dividido'

  return normalizarTextoImpressao(String(forma || ''))
}

function formatarEntrega(dados: DadosPedidoImpressao) {
  if (dados.tipoEntrega === 'local') {
    if (dados.comanda) return `No local - Comanda ${dados.comanda}`
    return 'No local'
  }

  if (dados.tipoEntrega === 'retirada') {
    return 'Retirada'
  }

  return 'Entrega'
}

function formatarEntregaCabecalho(dados: DadosPedidoImpressao) {
  if (dados.tipoEntrega === 'local') {
    if (dados.comanda) return `COMANDA ${dados.comanda}`
    if (dados.mesa) return `MESA ${dados.mesa}`
    return 'NO LOCAL'
  }

  if (dados.tipoEntrega === 'retirada') {
    return 'RETIRADA NO LOCAL'
  }

  return 'ENTREGA'
}

function quebrarTexto(valor: string, largura: number) {
  const texto = normalizarTextoImpressao(valor)
  if (!texto) return ['']

  const palavras = texto.split(' ')
  const linhas: string[] = []
  let linhaAtual = ''

  for (const palavra of palavras) {
    if (!palavra) continue
    const tentativa = linhaAtual ? `${linhaAtual} ${palavra}` : palavra

    if (tentativa.length <= largura) {
      linhaAtual = tentativa
      continue
    }

    if (linhaAtual) {
      linhas.push(linhaAtual)
    }

    if (palavra.length <= largura) {
      linhaAtual = palavra
      continue
    }

    let restante = palavra
    while (restante.length > largura) {
      linhas.push(restante.slice(0, largura))
      restante = restante.slice(largura)
    }
    linhaAtual = restante
  }

  if (linhaAtual) {
    linhas.push(linhaAtual)
  }

  return linhas.length > 0 ? linhas : ['']
}

function montarLinhaRotulo(largura: number, rotulo: string, valor: string) {
  const esquerda = normalizarTextoImpressao(rotulo)
  const direita = normalizarTextoImpressao(valor)

  if (!direita) {
    return quebrarTexto(esquerda, largura)
  }

  const espacoDisponivel = largura - direita.length - 1
  if (espacoDisponivel <= 0) {
    return [direita.slice(-largura)]
  }

  const linhasEsquerda = quebrarTexto(esquerda, espacoDisponivel)
  return linhasEsquerda.map((linha, indice) => {
    if (indice !== linhasEsquerda.length - 1) {
      return linha
    }

    const espacos = Math.max(1, largura - linha.length - direita.length)
    return `${linha}${' '.repeat(espacos)}${direita}`
  })
}

function montarLinhasItens(largura: number, itens: DadosPedidoImpressao['itens']) {
  if (itens.length === 0) {
    return ['Sem itens para impressao.']
  }

  const linhas: string[] = []

  itens.forEach((item) => {
    const prefixo = `${item.quantidade}x `
    const nomeLinhas = quebrarTexto(item.nome, Math.max(8, largura - prefixo.length))

    linhas.push(`${prefixo}${nomeLinhas[0]}`)
    for (const linha of nomeLinhas.slice(1)) {
      linhas.push(`${' '.repeat(prefixo.length)}${linha}`)
    }

    for (const adicional of item.adicionais || []) {
      const prefixoAdicional = `+ ${Math.max(1, Number(adicional.quantidade || 1))}x `
      const linhasAdicional = quebrarTexto(adicional.nome, Math.max(6, largura - prefixoAdicional.length - 2))
      linhas.push(`  ${prefixoAdicional}${linhasAdicional[0]}`)
      for (const linha of linhasAdicional.slice(1)) {
        linhas.push(`${' '.repeat(prefixoAdicional.length + 2)}${linha}`)
      }
    }

    if (item.observacoes) {
      const observacoes = quebrarTexto(`OBS: ${item.observacoes}`, Math.max(8, largura - 2))
      observacoes.forEach((linha) => linhas.push(`  ${linha}`))
    }
  })

  return linhas
}

function montarLinhasPagamento(largura: number, dados: DadosPedidoImpressao) {
  const pagamentosDivididos = (dados.pagamentosDivididos || []).filter((pagamento) => Number(pagamento.valor) > 0)

  if (formatarFormaPagamentoTicket(dados.formaPagamento).toLowerCase() === 'dividido' && pagamentosDivididos.length > 0) {
    const linhas = montarLinhaRotulo(largura, 'Pagamento:', 'Dividido')
    linhas.push('Divisao:')

    pagamentosDivididos.forEach((pagamento) => {
      linhas.push(
        ...montarLinhaRotulo(
          largura,
          `- ${formatarFormaPagamentoTicket(pagamento.forma)}:`,
          formatarMoeda(Number(pagamento.valor))
        )
      )
    })

    return linhas
  }

  return montarLinhaRotulo(largura, 'Pagamento:', formatarFormaPagamentoTicket(dados.formaPagamento || '-'))
}

function montarLinhasTicket(
  dados: DadosPedidoImpressao,
  tipo: Exclude<TipoTicket, 'completo'>,
  largura: number,
  escopo: EscopoImpressao
) {
  const subtotalItens = Number(
    dados.itens.reduce((acumulador, item) => acumulador + Number(item.precoTotal || 0), 0).toFixed(2)
  )
  const subtotalExibido = subtotalItens > 0 ? subtotalItens : Number(dados.subtotal || 0)
  const trocoPara = Number(dados.trocoPara || 0) > 0
    ? Number(dados.trocoPara || 0)
    : Number(dados.valorTroco || 0) > 0 && dados.total > 0
      ? Number((dados.total + Number(dados.valorTroco || 0)).toFixed(2))
      : null

  const linhas: string[] = [
    '-'.repeat(largura),
    ...montarLinhaRotulo(largura, 'Cliente:', dados.nomeCliente || 'Cliente'),
  ]

  if (tipo !== 'cozinha') {
    linhas.push(...montarLinhaRotulo(largura, 'Entrega:', formatarEntrega(dados)))
  }

  if (dados.mesa) {
    linhas.push(...montarLinhaRotulo(largura, 'Mesa:', String(dados.mesa)))
  }

  if (dados.comanda) {
    linhas.push(...montarLinhaRotulo(largura, 'Comanda:', String(dados.comanda)))
  }

  linhas.push(
    ...montarLinhaRotulo(largura, 'Telefone:', dados.telefone || '-'),
    ...montarLinhaRotulo(largura, 'Endereco:', dados.endereco || '-'),
    ...montarLinhaRotulo(largura, 'Bairro:', dados.bairro || '-'),
    ...montarLinhaRotulo(largura, 'Data:', formatarDataHora(dados.dataHora)),
    '-'.repeat(largura),
    'ITENS',
    ...montarLinhasItens(largura, dados.itens),
    '-'.repeat(largura),
    ...montarLinhaRotulo(largura, 'Subtotal:', formatarMoeda(subtotalExibido)),
  )

  if (Number(dados.taxaEntrega || 0) > 0) {
    linhas.push(...montarLinhaRotulo(largura, 'Taxa:', formatarMoeda(dados.taxaEntrega)))
  }

  if (Number(dados.taxaServico || 0) > 0) {
    linhas.push(...montarLinhaRotulo(largura, 'Taxa servico:', formatarMoeda(dados.taxaServico || 0)))
  }

  linhas.push(
    ...montarLinhaRotulo(largura, 'TOTAL:', formatarMoeda(dados.total)),
    ...montarLinhasPagamento(largura, dados)
  )

  if (trocoPara && trocoPara > 0) {
    linhas.push(...montarLinhaRotulo(largura, 'Troco para:', formatarMoeda(trocoPara)))
  }

  if (Number(dados.valorTroco || 0) > 0) {
    linhas.push(...montarLinhaRotulo(largura, 'Valor do troco:', formatarMoeda(Number(dados.valorTroco || 0))))
  }

  if (dados.observacoes) {
    linhas.push(...montarLinhaRotulo(largura, 'Obs geral:', dados.observacoes))
  }

  linhas.push(
    '-'.repeat(largura),
    ...montarLinhaRotulo(largura, 'Impresso em', formatarDataHora(dados.impressoEm || new Date()))
  )

  return linhas
}

function gerarTicketBase(
  dados: DadosPedidoImpressao,
  tamanhoPapel: TamanhoPapel,
  tipo: Exclude<TipoTicket, 'completo'>,
  escopo: EscopoImpressao = dados.escopo || 'pedido_completo'
) {
  const construtor = new ConstrutorESCPOS(tamanhoPapel)
  const largura = CARACTERES_POR_LINHA[tamanhoPapel]

  construtor
    .alinhar('centro')
    .negrito(true)
    .tamanhoFonte('dupla')
    .texto('BAR DA LADEIRA')
    .novaLinha()
    .tamanhoFonte('normal')
    .texto(tipo === 'cozinha' ? 'TICKET COZINHA' : 'TICKET CLIENTE')
    .novaLinha()
    .texto(escopo === 'itens_novos' ? 'NOVOS ITENS' : 'PEDIDO COMPLETO')
    .novaLinha()
    .novaLinha()
    .tamanhoFonte('dupla-altura')
    .texto(`PEDIDO ${dados.numeroPedido}`)
    .novaLinha()
    .tamanhoFonte('normal')
    .texto(formatarEntregaCabecalho(dados))
    .novaLinha()
    .negrito(false)
    .alinhar('esquerda')

  construtor.adicionarLinhas(montarLinhasTicket(dados, tipo, largura, escopo))
  construtor.novaLinha().cortarPapel()

  return construtor.construir()
}

export function gerarTicketCliente(
  dados: DadosPedidoImpressao,
  tamanhoPapel: TamanhoPapel = '80mm'
): Uint8Array {
  return gerarTicketBase(dados, tamanhoPapel, 'cliente')
}

export function gerarTicketCozinha(
  dados: DadosPedidoImpressao,
  tamanhoPapel: TamanhoPapel = '80mm'
): Uint8Array {
  return gerarTicketBase(dados, tamanhoPapel, 'cozinha')
}

export function gerarTicketCompleto(
  dados: DadosPedidoImpressao,
  tamanhoPapel: TamanhoPapel = '80mm'
): Uint8Array {
  const ticketCliente = gerarTicketBase(dados, tamanhoPapel, 'cliente')
  const ticketCozinha = gerarTicketBase(dados, tamanhoPapel, 'cozinha')
  const resultado = new Uint8Array(ticketCliente.length + ticketCozinha.length)
  resultado.set(ticketCliente, 0)
  resultado.set(ticketCozinha, ticketCliente.length)
  return resultado
}

export function gerarTicketTeste(tamanhoPapel: TamanhoPapel = '80mm'): Uint8Array {
  const construtor = new ConstrutorESCPOS(tamanhoPapel)

  construtor
    .alinhar('centro')
    .negrito(true)
    .tamanhoFonte('dupla')
    .texto('TESTE IMPRESSAO')
    .novaLinha(2)
    .tamanhoFonte('normal')
    .negrito(false)
    .texto('Bar da Ladeira')
    .novaLinha()
    .texto(`Papel ${tamanhoPapel}`)
    .novaLinha()
    .texto(`${CARACTERES_POR_LINHA[tamanhoPapel]} caracteres`)
    .novaLinha()
    .linhaHorizontal()
    .alinhar('esquerda')
    .adicionarLinhas([
      'Pedido: #321',
      'Cliente: Teste Bluetooth',
      'Entrega: Entrega',
      'Telefone: (86) 99999-9999',
      'Endereco: Rua Teste, 123',
      'Bairro: Centro',
      'Data: ' + formatarDataHora(new Date()),
      '-'.repeat(CARACTERES_POR_LINHA[tamanhoPapel]),
      'ITENS',
      '1x X-Bacon',
      '  + 1x Queijo extra',
      '  OBS: Sem cebola',
      '-'.repeat(CARACTERES_POR_LINHA[tamanhoPapel]),
      'Subtotal: R$ 18,00',
      'Taxa: R$ 4,00',
      'TOTAL: R$ 22,00',
      'Pagamento: PIX',
    ])
    .novaLinha()
    .alinhar('centro')
    .texto('Impressora configurada')
    .novaLinha(2)
    .cortarPapel()

  return construtor.construir()
}

export function gerarTicket(
  dados: DadosPedidoImpressao,
  tipo: TipoTicket,
  tamanhoPapel: TamanhoPapel = '80mm'
): Uint8Array {
  switch (tipo) {
    case 'cliente':
      return gerarTicketCliente(dados, tamanhoPapel)
    case 'cozinha':
      return gerarTicketCozinha(dados, tamanhoPapel)
    case 'completo':
      return gerarTicketCompleto(dados, tamanhoPapel)
    default:
      return gerarTicketCliente(dados, tamanhoPapel)
  }
}
