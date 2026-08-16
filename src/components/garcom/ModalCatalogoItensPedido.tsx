'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, Check, Loader2, Minus, Plus, Search, ShoppingBag, X } from 'lucide-react'
import { ModalSheet } from '@/components/ui/modal-sheet'

export type ItemCatalogoGarcom = {
  id: string
  nome: string
  preco: number
  categoria: string
  tipo_item: 'produto' | 'bebida' | 'combo'
}

export type CategoriaCatalogoGarcom = {
  nome: string
  total: number
}

type ModalCatalogoItensPedidoProps = {
  aberto: boolean
  carregando: boolean
  carregandoAdicao: boolean
  erro: string | null
  termoBusca: string
  onAlterarBusca: (valor: string) => void
  onLimparBusca: () => void
  categorias: CategoriaCatalogoGarcom[]
  categoriaAtiva: string
  onSelecionarCategoria: (categoria: string) => void
  itensVisiveis: ItemCatalogoGarcom[]
  itemSelecionado: ItemCatalogoGarcom | null
  onSelecionarItem: (item: ItemCatalogoGarcom) => void
  quantidadeSelecionada: number
  onAlterarQuantidade: (quantidade: number) => void
  observacaoSelecionada: string
  onAlterarObservacao: (observacao: string) => void
  onFechar: () => void
  onTentarNovamente: () => void
  onConfirmarAdicao: () => void
}

const obterLabelTipoItem = (tipoItem: ItemCatalogoGarcom['tipo_item']) => {
  if (tipoItem === 'produto') return 'Produto'
  if (tipoItem === 'bebida') return 'Bebida'
  return 'Combo'
}

export default function ModalCatalogoItensPedido({
  aberto,
  carregando,
  carregandoAdicao,
  erro,
  termoBusca,
  onAlterarBusca,
  onLimparBusca,
  categorias,
  categoriaAtiva,
  onSelecionarCategoria,
  itensVisiveis,
  itemSelecionado,
  onSelecionarItem,
  quantidadeSelecionada,
  onAlterarQuantidade,
  observacaoSelecionada,
  onAlterarObservacao,
  onFechar,
  onTentarNovamente,
  onConfirmarAdicao,
}: ModalCatalogoItensPedidoProps) {
  const [abaMobileAtiva, setAbaMobileAtiva] = useState<'catalogo' | 'configuracao'>('catalogo')

  useEffect(() => {
    const classeModalAberto = 'modal-garcom-aberto'
    const overflowAnterior = document.body.style.overflow

    if (!aberto) {
      document.body.classList.remove(classeModalAberto)
      document.documentElement.classList.remove(classeModalAberto)
      document.body.style.overflow = ''
      return
    }

    document.body.classList.add(classeModalAberto)
    document.documentElement.classList.add(classeModalAberto)
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.classList.remove(classeModalAberto)
      document.documentElement.classList.remove(classeModalAberto)
      document.body.style.overflow = overflowAnterior
    }
  }, [aberto])

  useEffect(() => {
    if (!aberto) return
    setAbaMobileAtiva('catalogo')
  }, [aberto])

  useEffect(() => {
    if (!itemSelecionado) return
    setAbaMobileAtiva('configuracao')
  }, [itemSelecionado])

  return (
    <ModalSheet
      open={aberto}
      onOpenChange={(open) => {
        if (!open) onFechar()
      }}
      title="Adicionar item ao pedido"
      description="Fluxo em tela cheia para buscar, selecionar e confirmar sem travar a visão."
      showCloseButton={false}
      className="h-[96dvh] max-h-[96dvh] overflow-hidden sm:max-w-5xl"
    >
          <div className="flex h-[96dvh] max-h-[96dvh] w-full flex-col overflow-hidden">
            <header className="flex items-start justify-between gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
              <div className="min-w-0">
                <h3 className="text-base font-bold text-zinc-900 dark:text-white sm:text-lg">
                  Adicionar item ao pedido
                </h3>
                <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400 sm:text-sm">
                  Fluxo em tela cheia para buscar, selecionar e confirmar sem travar a visão.
                </p>
              </div>
              <button
                type="button"
                onClick={onFechar}
                aria-label="Fechar catálogo"
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-100 text-zinc-600 transition-colors hover:bg-zinc-200 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type="text"
                  value={termoBusca}
                  onChange={(evento) => onAlterarBusca(evento.target.value)}
                  placeholder="Buscar por item ou categoria..."
                  className="w-full h-11 pl-10 pr-10 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm text-zinc-900 dark:text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-bordo-500"
                  autoFocus
                />
                {termoBusca && (
                  <button
                    type="button"
                    onClick={onLimparBusca}
                    aria-label="Limpar busca"
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-lg text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors flex items-center justify-center"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {!termoBusca.trim() && categorias.length > 0 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
                  {categorias.map((categoria) => {
                    const ativa = categoria.nome === categoriaAtiva
                    return (
                      <button
                        key={categoria.nome}
                        type="button"
                        onClick={() => onSelecionarCategoria(categoria.nome)}
                        className={`flex items-center gap-1.5 min-h-[44px] px-3 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                          ativa
                            ? 'bg-bordo-600 text-white'
                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                        }`}
                      >
                        <span>{categoria.nome}</span>
                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                          ativa
                            ? 'bg-white/20 text-white'
                            : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300'
                        }`}>
                          {categoria.total}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="px-4 pt-2 md:hidden">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAbaMobileAtiva('catalogo')}
                  className={`min-h-[42px] rounded-lg text-xs font-semibold transition-colors ${
                    abaMobileAtiva === 'catalogo'
                      ? 'bg-bordo-600 text-white'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300'
                  }`}
                >
                  Catálogo
                </button>
                <button
                  type="button"
                  onClick={() => setAbaMobileAtiva('configuracao')}
                  disabled={!itemSelecionado}
                  className={`min-h-[42px] rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 ${
                    abaMobileAtiva === 'configuracao'
                      ? 'bg-bordo-600 text-white'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300'
                  }`}
                >
                  Configurar
                </button>
              </div>
            </div>

            <div className="flex-1 min-h-0 flex flex-col md:grid md:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
              <section
                className={`min-w-0 min-h-[230px] md:min-h-0 flex-1 border-r-0 md:border-r border-zinc-200 dark:border-zinc-800 p-4 overflow-y-auto ${
                  abaMobileAtiva === 'catalogo' ? 'block' : 'hidden md:block'
                }`}
              >
                {carregando ? (
                  <div className="h-full flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-bordo-600" />
                  </div>
                ) : erro ? (
                  <div className="h-full flex flex-col items-center justify-center text-center px-4">
                    <AlertCircle className="w-10 h-10 text-red-500 mb-2" />
                    <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Falha ao carregar catálogo</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">{erro}</p>
                    <button
                      type="button"
                      onClick={onTentarNovamente}
                      className="mt-3 min-h-[44px] px-4 rounded-lg bg-bordo-600 hover:bg-bordo-700 text-white text-sm font-semibold transition-colors"
                    >
                      Tentar novamente
                    </button>
                  </div>
                ) : itensVisiveis.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center px-4">
                    <ShoppingBag className="w-10 h-10 text-zinc-300 dark:text-zinc-600 mb-2" />
                    <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Nenhum item encontrado</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                      Ajuste os filtros ou limpe a busca para ver mais opções.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {itensVisiveis.map((item) => {
                      const selecionado = itemSelecionado?.id === item.id && itemSelecionado?.tipo_item === item.tipo_item
                      return (
                        <button
                          key={`${item.tipo_item}-${item.id}`}
                          type="button"
                          onClick={() => onSelecionarItem(item)}
                          className={`relative min-h-[86px] p-3 rounded-xl border text-left transition-all cursor-pointer ${
                            selecionado
                              ? 'border-bordo-500 bg-bordo-50 dark:bg-bordo-950/25 ring-1 ring-bordo-500/30'
                              : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:border-bordo-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/80'
                          }`}
                        >
                          {selecionado && (
                            <span className="absolute top-2 right-2 h-5 w-5 rounded-full bg-bordo-600 text-white flex items-center justify-center">
                              <Check className="w-3 h-3" />
                            </span>
                          )}
                          <p className="text-sm font-semibold text-zinc-900 dark:text-white line-clamp-2 leading-tight pr-5">
                            {item.nome}
                          </p>
                          <div className="mt-2 flex items-center justify-between gap-2">
                            <span className="text-sm font-bold text-bordo-700 dark:text-bordo-400">
                              R$ {item.preco.toFixed(2)}
                            </span>
                            <span className="text-[10px] px-2 py-1 rounded-full bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300">
                              {obterLabelTipoItem(item.tipo_item)}
                            </span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </section>

              <aside
                className={`min-w-0 p-4 border-t md:border-t-0 border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/40 overflow-y-auto ${
                  abaMobileAtiva === 'configuracao' ? 'block' : 'hidden md:block'
                }`}
              >
                {!itemSelecionado ? (
                  <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 px-3 py-2.5 flex items-center gap-2.5">
                    <ShoppingBag className="w-5 h-5 text-zinc-400 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                        Selecione um item para configurar
                      </p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        Quantidade e observação aparecem aqui.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3">
                      <p className="text-sm font-semibold text-zinc-900 dark:text-white">{itemSelecionado.nome}</p>
                      <div className="mt-2 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                        <span>{itemSelecionado.categoria}</span>
                        <span>{obterLabelTipoItem(itemSelecionado.tipo_item)}</span>
                      </div>
                      <p className="mt-2 text-lg font-bold text-bordo-700 dark:text-bordo-400">
                        R$ {itemSelecionado.preco.toFixed(2)}
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-2">
                        Quantidade
                      </label>
                      <div className="inline-flex items-center rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-1">
                        <button
                          type="button"
                          onClick={() => onAlterarQuantidade(Math.max(1, quantidadeSelecionada - 1))}
                          disabled={quantidadeSelecionada <= 1 || carregandoAdicao}
                          className="h-11 w-11 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 disabled:opacity-40 transition-colors flex items-center justify-center"
                          aria-label="Diminuir quantidade"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="min-w-12 text-center text-base font-bold text-zinc-900 dark:text-white">
                          {quantidadeSelecionada}
                        </span>
                        <button
                          type="button"
                          onClick={() => onAlterarQuantidade(quantidadeSelecionada + 1)}
                          disabled={carregandoAdicao}
                          className="h-11 w-11 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors flex items-center justify-center"
                          aria-label="Aumentar quantidade"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-2">
                        Observação do item (opcional)
                      </label>
                      <textarea
                        value={observacaoSelecionada}
                        onChange={(evento) => onAlterarObservacao(evento.target.value)}
                        rows={3}
                        placeholder="Ex: sem cebola, ponto da carne..."
                        className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2.5 text-sm text-zinc-900 dark:text-white placeholder-zinc-500 resize-none focus:outline-none focus:ring-2 focus:ring-bordo-500"
                      />
                    </div>

                    <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-3 flex items-center justify-between">
                      <span className="text-sm text-zinc-600 dark:text-zinc-300">Subtotal do item</span>
                      <span className="text-lg font-bold text-bordo-700 dark:text-bordo-400">
                        R$ {(itemSelecionado.preco * quantidadeSelecionada).toFixed(2)}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={onFechar}
                        className="min-h-[44px] rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 text-sm font-semibold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={onConfirmarAdicao}
                        disabled={carregandoAdicao}
                        className="min-h-[44px] rounded-xl bg-bordo-600 hover:bg-bordo-700 text-white text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {carregandoAdicao ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Incluindo...
                          </>
                        ) : (
                          'Adicionar ao pedido'
                        )}
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setAbaMobileAtiva('catalogo')}
                      className="md:hidden min-h-[42px] w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                      Voltar ao catálogo
                    </button>
                  </div>
                )}
              </aside>
            </div>
          </div>
    </ModalSheet>
  )
}
