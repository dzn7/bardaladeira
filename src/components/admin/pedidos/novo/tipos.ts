export type TipoItemCatalogoPedido = 'produto' | 'combo'

export type ItemCatalogoPedido = {
  id: string
  nome: string
  preco: number
  categoria: string
  tipo: TipoItemCatalogoPedido
}

export type AdicionalPedidoNovo = {
  id: string
  nome: string
  preco: number
}

export type ProdutoSelecionadoPedidoNovo = {
  id: string
  nome: string
  preco: number
  quantidade: number
  observacoes: string
  adicionais: AdicionalPedidoNovo[]
  descontoManualInput: string
}

export type CategoriaCatalogoPedido = {
  id: string
  nome: string
  total: number
  itens: ItemCatalogoPedido[]
}
