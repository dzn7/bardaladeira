export const ESTOQUE_QUANTIDADE_PADRAO = 0
export const ESTOQUE_MINIMO_PADRAO = 5

const inteiroNaoNegativo = (valor, padrao, campo) => {
  const efetivo = valor === '' || valor === null || valor === undefined ? padrao : Number(valor)
  if (!Number.isInteger(efetivo) || efetivo < 0) {
    throw new Error(`${campo} deve ser um inteiro não negativo`)
  }
  return efetivo
}

const quantidadeProduto = (produto) => produto.estoque_quantidade ?? produto.quantidade
const minimoProduto = (produto) => produto.estoque_minimo ?? produto.minimo
const bloqueioProduto = (produto) => (
  produto.bloquear_venda_sem_estoque ?? produto.bloquear
) === true

export const normalizarConfiguracaoEstoque = (configuracao = {}) => ({
  quantidade: inteiroNaoNegativo(
    configuracao.quantidade,
    ESTOQUE_QUANTIDADE_PADRAO,
    'Quantidade',
  ),
  minimo: inteiroNaoNegativo(configuracao.minimo, ESTOQUE_MINIMO_PADRAO, 'Estoque mínimo'),
  bloquear: configuracao.bloquear === true,
})

export const obterSituacaoEstoque = (produto) => {
  const configuracao = normalizarConfiguracaoEstoque({
    quantidade: quantidadeProduto(produto),
    minimo: minimoProduto(produto),
  })
  if (configuracao.quantidade === 0) return 'esgotado'
  if (configuracao.quantidade <= configuracao.minimo) return 'baixo'
  return 'em_estoque'
}

export const obterSituacaoEstoqueProduto = obterSituacaoEstoque

export const produtoBloqueadoPorEstoque = (produto) => (
  bloqueioProduto(produto)
  && inteiroNaoNegativo(quantidadeProduto(produto), 0, 'Quantidade') === 0
)

export const produtoDisponivelParaCompra = (produto) => (
  produto.disponivel !== false && !produtoBloqueadoPorEstoque(produto)
)

export const ajustarQuantidadeEstoque = (quantidadeAtual, delta) => {
  const atual = inteiroNaoNegativo(quantidadeAtual, 0, 'Quantidade atual')
  if (!Number.isInteger(delta)) throw new Error('Delta deve ser um inteiro')
  const resultado = atual + delta
  if (resultado < 0) throw new Error('Ajuste não pode resultar em estoque negativo')
  return resultado
}

export const avaliarCompraProduto = (produto, quantidadeNoCarrinho, quantidadeAdicionar) => {
  const noCarrinho = inteiroNaoNegativo(quantidadeNoCarrinho, 0, 'Quantidade no carrinho')
  const aAdicionar = inteiroNaoNegativo(quantidadeAdicionar, 0, 'Quantidade a adicionar')

  if (produto.disponivel === false) {
    return { permitido: false, quantidadeMaxima: 0, motivo: 'indisponivel' }
  }

  if (!bloqueioProduto(produto)) {
    return { permitido: true, quantidadeMaxima: null, motivo: null }
  }

  const quantidade = inteiroNaoNegativo(quantidadeProduto(produto), 0, 'Quantidade')
  const quantidadeMaxima = Math.max(0, quantidade - noCarrinho)
  return {
    permitido: aAdicionar <= quantidadeMaxima,
    quantidadeMaxima,
    motivo: aAdicionar <= quantidadeMaxima ? null : 'estoque_insuficiente',
  }
}

export const normalizarDinheiro = (valor, { opcional = false } = {}) => {
  if (valor === '' || valor === null || valor === undefined) {
    if (opcional) return null
    throw new Error('Valor monetário é obrigatório')
  }

  const texto = String(valor).trim().replace(',', '.')
  if (texto.startsWith('-')) throw new Error('Valor monetário deve ser não negativo')
  if (!/^\d+(?:\.\d+)?$/.test(texto)) throw new Error('Valor monetário inválido')

  const [inteirosBrutos, decimaisBrutos = ''] = texto.split('.')
  let inteiros = BigInt(inteirosBrutos)
  const decimais = decimaisBrutos.padEnd(3, '0')
  let centavos = Number(decimais.slice(0, 2))
  if (Number(decimais[2]) >= 5) centavos += 1
  if (centavos === 100) {
    inteiros += 1n
    centavos = 0
  }
  if (inteiros > 9_999_999_999n) throw new Error('Valor monetário excede o limite permitido')
  return `${inteiros}.${String(centavos).padStart(2, '0')}`
}

export const camposEstoqueParaCatalogo = (tipoCatalogo, configuracao) => {
  if (tipoCatalogo !== 'produto') return {}
  const estoque = normalizarConfiguracaoEstoque(configuracao)
  return {
    custo_unitario: normalizarDinheiro(configuracao.custoUnitario, { opcional: true }),
    estoque_quantidade: estoque.quantidade,
    estoque_minimo: estoque.minimo,
    bloquear_venda_sem_estoque: estoque.bloquear,
  }
}

export const camposEstoqueParaPersistenciaCatalogo = (tipoCatalogo, configuracao) => {
  const campos = camposEstoqueParaCatalogo(tipoCatalogo, configuracao)
  if (!('estoque_quantidade' in campos)) return campos
  const { estoque_quantidade: _quantidade, ...persistidos } = campos
  return persistidos
}

const DIACRITICOS = /[\u0300-\u036f]/g

export const normalizarTextoBusca = (valor) =>
  String(valor || '')
    .normalize('NFD')
    .replace(DIACRITICOS, '')
    .toLowerCase()
    .trim()

export const produtoCorrespondeBuscaEstoque = (produto, termo) => {
  const busca = normalizarTextoBusca(termo)
  if (!busca) return true
  return (
    normalizarTextoBusca(produto?.nome).includes(busca)
    || normalizarTextoBusca(produto?.categoria).includes(busca)
  )
}

export const somarQuantidadeProdutoNoCarrinho = (itens, produtoId) =>
  (Array.isArray(itens) ? itens : []).reduce((total, item) => {
    const id = item?.produto?.id || item?.produtoId
    const quantidade = Number(item?.quantidade)
    if (id !== produtoId || !Number.isInteger(quantidade) || quantidade <= 0) return total
    return total + quantidade
  }, 0)

export const mensagemAvaliacaoCompra = (produto, avaliacao) => {
  if (!avaliacao || avaliacao.permitido) return null
  if (avaliacao.motivo === 'indisponivel') {
    return `${produto?.nome || 'Este produto'} está indisponível.`
  }
  const disponivel = Number.isInteger(avaliacao.quantidadeMaxima) ? avaliacao.quantidadeMaxima : 0
  return `Estoque insuficiente para ${produto?.nome || 'o produto'}. Disponível: ${disponivel}.`
}

const mensagemDoErro = (erro) => {
  if (erro instanceof Error) return erro.message
  if (erro && typeof erro === 'object' && typeof erro.message === 'string') return erro.message
  return String(erro || 'Não foi possível atualizar o estoque')
}

export const formatarErroEstoque = (erro) => {
  const mensagem = mensagemDoErro(erro)
  const encontrado = mensagem.match(/ESTOQUE_INSUFICIENTE:([^:]+):(.+):(\d+)(?:\s|$)/)
  if (!encontrado) return mensagem
  return `Estoque insuficiente para ${encontrado[2]}. Disponível: ${encontrado[3]}.`
}
