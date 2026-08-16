import type { CategoriaCardapio, TipoCategoriaCardapio } from './supabase'

export const CATEGORIA_FILTRO_TODOS = 'Todos'

export const normalizarNomeCategoria = (categoria: string | null | undefined) =>
  (categoria || '').trim().replace(/\s+/g, ' ')

export const categoriasSaoIguais = (categoriaA: string, categoriaB: string) =>
  categoriaA.localeCompare(categoriaB, 'pt-BR', { sensitivity: 'base' }) === 0

export const obterNomesCategoriasPorTipo = (
  categorias: CategoriaCardapio[],
  tipo: TipoCategoriaCardapio
) =>
  categorias
    .filter((categoria) => categoria.ativo && categoria.tipo === tipo)
    .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, 'pt-BR'))
    .map((categoria) => categoria.nome)

export const ordenarNomesPorCategoriasDoBanco = (
  nomes: string[],
  categorias: CategoriaCardapio[]
) => {
  const nomesNormalizados = Array.from(
    new Set(nomes.map((nome) => normalizarNomeCategoria(nome)).filter(Boolean))
  )

  const ordemPorNome = new Map(
    categorias
      .filter((categoria) => categoria.ativo)
      .map((categoria) => [categoria.nome, categoria.ordem])
  )

  return nomesNormalizados.sort((categoriaA, categoriaB) => {
    const ordemA = ordemPorNome.get(categoriaA)
    const ordemB = ordemPorNome.get(categoriaB)

    if (ordemA !== undefined && ordemB !== undefined && ordemA !== ordemB) {
      return ordemA - ordemB
    }

    if (ordemA !== undefined && ordemB === undefined) return -1
    if (ordemA === undefined && ordemB !== undefined) return 1

    return categoriaA.localeCompare(categoriaB, 'pt-BR')
  })
}

export const obterCategoriaCombo = (categorias: CategoriaCardapio[]) =>
  obterNomesCategoriasPorTipo(categorias, 'combo')[0] || ''

export const obterCategoriaDestinoParaExclusao = (
  categoriaAtual: string,
  categorias: string[]
) =>
  categorias.find((categoria) => !categoriasSaoIguais(categoria, categoriaAtual)) || ''
