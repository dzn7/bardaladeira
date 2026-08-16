export type FormaPagamentoItens = 'pix' | 'dinheiro' | 'cartao' | 'crediario'

export type ItemPagamento = {
  id: string
  nome: string
  quantidade: number
  precoUnitario: number
  subtotal: number
  observacoes?: string | null
  criadoEm?: string | null
}

export type ItemPagoSnapshot = {
  id: string
  nome: string
  quantidade: number
  preco_unitario: number
  subtotal: number
  observacoes: string | null
  created_at: string
}

export const FORMAS_PAGAMENTO_BANCO: Record<FormaPagamentoItens, string> = {
  pix: 'pix',
  dinheiro: 'dinheiro',
  cartao: 'cartao',
  crediario: 'crediario',
}

export const FORMAS_PAGAMENTO_LABEL: Record<FormaPagamentoItens, string> = {
  pix: 'PIX',
  dinheiro: 'Dinheiro',
  cartao: 'Cartão',
  crediario: 'Crediário',
}

export const normalizarQuantidadeUnidades = (valor: unknown, maximo: number, fallback = 1) => {
  const limite = Math.max(0, Math.floor(Number(maximo || 0)))
  if (limite <= 0) return 0
  const numerico = Math.floor(Number(valor))
  const base = Number.isFinite(numerico) && numerico > 0 ? numerico : fallback
  return Math.min(Math.max(1, base), limite)
}

export const valorUnitarioItem = (item: ItemPagamento) => {
  const quantidade = Number(item.quantidade || 1)
  const subtotal = Number(item.subtotal || 0)
  return quantidade > 0 ? subtotal / quantidade : Number(item.precoUnitario || 0)
}

export const construirSnapshotItensPagos = (
  itens: ItemPagamento[],
  quantidadesSelecionadas: Record<string, number>,
  quantidadesDisponiveis: Record<string, number>,
): ItemPagoSnapshot[] =>
  itens
    .map((item) => {
      const quantidade = normalizarQuantidadeUnidades(
        quantidadesSelecionadas[item.id],
        quantidadesDisponiveis[item.id] ?? item.quantidade,
      )
      if (quantidade <= 0) return null
      const precoUnitario = valorUnitarioItem(item)
      return {
        id: item.id,
        nome: item.nome,
        quantidade,
        preco_unitario: Number(precoUnitario.toFixed(2)),
        subtotal: Number((precoUnitario * quantidade).toFixed(2)),
        observacoes: item.observacoes || null,
        created_at: item.criadoEm || new Date().toISOString(),
      } satisfies ItemPagoSnapshot
    })
    .filter((item): item is ItemPagoSnapshot => item !== null)
