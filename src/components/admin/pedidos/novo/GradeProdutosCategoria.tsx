'use client'

import { ItemCatalogoPedido } from './tipos'

type GradeProdutosCategoriaProps = {
  itens: ItemCatalogoPedido[]
  quantidadesSelecionadas: Record<string, number>
  onAdicionarItem: (item: ItemCatalogoPedido) => void
}

export default function GradeProdutosCategoria({
  itens,
  quantidadesSelecionadas,
  onAdicionarItem,
}: GradeProdutosCategoriaProps) {
  if (itens.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border/70 p-6 text-center text-sm text-muted-foreground">
        Nenhum item disponível nesta categoria.
      </div>
    )
  }

  return (
    <div className="grid w-full min-w-0 grid-cols-2 gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
      {itens.map((item) => {
        const quantidadeSelecionada = quantidadesSelecionadas[item.id] || 0
        const selecionado = quantidadeSelecionada > 0

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onAdicionarItem(item)}
            className={`flex min-h-[72px] w-full min-w-0 flex-col justify-between overflow-hidden rounded-lg border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 ${
              selecionado
                ? 'border-foreground/15 bg-accent text-foreground'
                : 'border-border/70 bg-card hover:border-foreground/15'
            }`}
          >
            <p className="line-clamp-2 text-[13px] font-medium leading-tight text-foreground">
              {item.nome}
            </p>
            <div className="mt-1.5 flex items-center justify-between gap-1">
              <span className="font-mono text-sm font-medium tabular-nums text-foreground">
                R$ {item.preco.toFixed(2)}
              </span>
              {quantidadeSelecionada > 0 && (
                <span className="shrink-0 rounded-md bg-foreground px-1.5 py-0.5 text-[11px] font-medium text-background">
                  {quantidadeSelecionada}x
                </span>
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}
