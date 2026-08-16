export type TipoOrdenacaoProdutosSite = 'manual' | 'preco_crescente' | 'preco_decrescente'

export const CHAVE_ORDENACAO_PRODUTOS_SITE = 'ordenacao_produtos_site'
export const CHAVE_ORDEM_CATEGORIAS_PRODUTOS = 'ordem_categorias_produtos'

export const TIPO_ORDENACAO_PADRAO: TipoOrdenacaoProdutosSite = 'manual'

const TIPOS_ORDENACAO_VALIDOS: TipoOrdenacaoProdutosSite[] = [
  'manual',
  'preco_crescente',
  'preco_decrescente'
]

export const normalizarTipoOrdenacaoProdutos = (valor?: string | null): TipoOrdenacaoProdutosSite => {
  if (!valor) return TIPO_ORDENACAO_PADRAO

  const valorNormalizado = valor.trim().toLowerCase()
  if (TIPOS_ORDENACAO_VALIDOS.includes(valorNormalizado as TipoOrdenacaoProdutosSite)) {
    return valorNormalizado as TipoOrdenacaoProdutosSite
  }

  return TIPO_ORDENACAO_PADRAO
}

export const parsearOrdemCategoriasProdutos = (valor?: string | null): string[] => {
  if (!valor) return []

  try {
    const valorParseado = JSON.parse(valor)
    if (!Array.isArray(valorParseado)) return []

    return valorParseado
      .map((categoria) => (typeof categoria === 'string' ? categoria.trim() : ''))
      .filter(Boolean)
  } catch {
    return []
  }
}

export const ordenarCategoriasPorPreferencia = (
  categoriasDisponiveis: string[],
  ordemPreferida: string[]
): string[] => {
  const categoriasNormalizadas = Array.from(
    new Set(categoriasDisponiveis.map((categoria) => categoria.trim()).filter(Boolean))
  )

  const ordemFiltrada = ordemPreferida.filter((categoria) => categoriasNormalizadas.includes(categoria))
  const categoriasRestantes = categoriasNormalizadas
    .filter((categoria) => !ordemFiltrada.includes(categoria))
    .sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }))

  return [...ordemFiltrada, ...categoriasRestantes]
}
