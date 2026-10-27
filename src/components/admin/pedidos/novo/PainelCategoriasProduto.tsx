'use client'

import { RefObject, useMemo } from 'react'
import { MagnifyingGlass as Search, X, ShoppingBag, PencilSimple as Pencil } from '@phosphor-icons/react'
import { CategoriaCatalogoPedido, ItemCatalogoPedido } from './tipos'
import { cn } from '@/lib/utils'
import { Botao, Esqueleto, ListaVazia, Selo } from '@/components/admin/ui'

type PainelCategoriasProdutoProps = {
  carregando: boolean
  referenciaBusca?: RefObject<HTMLInputElement>
  termoBusca: string
  onAlterarBusca: (valor: string) => void
  onLimparBusca: () => void
  categorias: CategoriaCatalogoPedido[]
  categoriaExpandida: string | null
  onExpandirCategoria: (categoriaId: string | null) => void
  quantidadesSelecionadas: Record<string, number>
  onAdicionarItem: (item: ItemCatalogoPedido) => void
  onPersonalizarItem?: (item: ItemCatalogoPedido) => void
}

export default function PainelCategoriasProduto({
  carregando,
  referenciaBusca,
  termoBusca,
  onAlterarBusca,
  onLimparBusca,
  categorias,
  categoriaExpandida,
  onExpandirCategoria,
  quantidadesSelecionadas,
  onAdicionarItem,
  onPersonalizarItem,
}: PainelCategoriasProdutoProps) {
  const categoriaAtiva = useMemo(() => {
    if (categoriaExpandida) {
      return categorias.find((c) => c.id === categoriaExpandida) || null
    }
    return categorias[0] || null
  }, [categorias, categoriaExpandida])

  const todosItens = useMemo(() => categorias.flatMap((c) => c.itens), [categorias])

  const itensFiltrados = useMemo(() => {
    if (!termoBusca.trim()) return null
    const termo = termoBusca.toLowerCase()
    return todosItens.filter((item) => item.nome.toLowerCase().includes(termo))
  }, [todosItens, termoBusca])

  const itensParaExibir = itensFiltrados || categoriaAtiva?.itens || []

  return (
    <section className="flex h-full max-h-[calc(100dvh-200px)] xl:max-h-full xl:min-h-0 min-h-[420px] w-full min-w-0 flex-col overflow-hidden rounded-xl border border-border/70 bg-card sm:min-h-[500px]">
      <div className="shrink-0 border-b border-border/70 px-4 py-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-sm font-medium text-foreground">Cardápio</h3>
          <Selo>{todosItens.length} produtos</Selo>
        </div>

        <div className="relative">
          <Search
           
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            ref={referenciaBusca}
            type="text"
            value={termoBusca}
            onChange={(e) => onAlterarBusca(e.target.value)}
            placeholder="Buscar produto"
            className="h-11 w-full rounded-lg border border-input bg-background pl-9 pr-11 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 md:h-10 md:text-sm"
          />
          {termoBusca && (
            <button
              type="button"
              onClick={onLimparBusca}
              className="absolute right-0 top-0 flex size-11 items-center justify-center rounded-r-lg text-muted-foreground hover:text-foreground md:size-10"
              aria-label="Limpar busca"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>

      {!termoBusca && (
        <div className="shrink-0 border-b border-border/70">
          <div
            className="flex min-w-0 gap-1 overflow-x-auto px-2 pt-1 scrollbar-hide"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {categorias.map((categoria) => {
              const ativa = categoriaAtiva?.id === categoria.id
              return (
                <button
                  key={categoria.id}
                  type="button"
                  onClick={() => onExpandirCategoria(categoria.id)}
                  className={cn(
                    'flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-1',
                    ativa
                      ? 'border-foreground text-foreground'
                      : 'border-transparent text-muted-foreground hover:text-foreground',
                  )}
                >
                  {categoria.nome}
                  <span
                    className={cn(
                      'rounded-md px-1.5 py-0.5 text-[10px] font-medium tabular-nums',
                      ativa ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {categoria.total}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="min-w-0 flex-1 overflow-y-auto p-4">
        {carregando ? (
          <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4" aria-busy="true" aria-label="Carregando cardápio">
            {Array.from({ length: 6 }).map((_, indice) => (
              <Esqueleto key={indice} className="h-[76px] rounded-lg" />
            ))}
          </div>
        ) : itensParaExibir.length === 0 ? (
          <ListaVazia
            icone={<ShoppingBag />}
            titulo={termoBusca ? 'Nenhum produto encontrado' : 'Categoria vazia'}
            acao={
              termoBusca ? (
                <Botao variante="contorno" onClick={onLimparBusca}>
                  Limpar busca
                </Botao>
              ) : undefined
            }
          />
        ) : (
          <>
            {termoBusca && (
              <p className="mb-3 text-[13px] text-muted-foreground">
                {itensFiltrados?.length} resultado{itensFiltrados?.length === 1 ? '' : 's'} para
                {' '}&ldquo;{termoBusca}&rdquo;
              </p>
            )}
            <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {itensParaExibir.map((item) => {
                const qtd = quantidadesSelecionadas[item.id] || 0
                const selecionado = qtd > 0

                return (
                  <div
                    key={item.id}
                    className={cn(
                      'relative flex min-w-0 flex-col rounded-lg border text-left transition-colors',
                      selecionado
                        ? 'border-foreground/15 bg-accent text-foreground'
                        : 'border-border/70 bg-card',
                    )}
                  >
                    {selecionado && (
                      <span className="absolute -right-2 -top-2 z-10 flex size-5 items-center justify-center rounded-full bg-foreground text-[10px] font-medium text-background">
                        {qtd}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => onAdicionarItem(item)}
                      className="min-w-0 flex-1 rounded-t-lg p-3 text-left transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-inset"
                      aria-label={`Adicionar ${item.nome}`}
                    >
                      <p className="mb-2 line-clamp-2 text-sm font-medium leading-tight text-foreground">
                        {item.nome}
                      </p>
                      <p className="font-mono text-sm font-medium tabular-nums text-foreground">
                        R$ {item.preco.toFixed(2)}
                      </p>
                    </button>
                    {onPersonalizarItem && (
                      <button
                        type="button"
                        onClick={() => onPersonalizarItem(item)}
                        className="flex h-10 items-center justify-center gap-1.5 rounded-b-lg border-t border-border/70 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-inset"
                        aria-label={`Personalizar ${item.nome}`}
                      >
                        <Pencil className="size-3" />
                        Personalizar
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </section>
  )
}
