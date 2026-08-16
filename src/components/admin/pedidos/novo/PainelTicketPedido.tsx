'use client'

import { ShoppingCart, Trash2, X, Minus, Plus, Pencil } from 'lucide-react'
import { AdicionalPedidoNovo, ProdutoSelecionadoPedidoNovo } from './tipos'
import { cn } from '@/lib/utils'

type PainelTicketPedidoProps = {
  produtosSelecionados: ProdutoSelecionadoPedidoNovo[]
  totalItensPedido: number
  subtotalBrutoPedido: number
  subtotalPedido: number
  descontoItensTotal: number
  descontoPedidoInput: string
  descontoPedidoAplicado: number
  taxaEntregaPedido: number
  taxaServicoPedido: number
  totalPedido: number
  tipoEntrega: string
  aplicarTaxaServico: boolean
  adicionaisDisponiveis: AdicionalPedidoNovo[]
  produtoSelecionadoParaAdicional: string | null
  onAlterarProdutoSelecionadoParaAdicional: (produtoId: string | null) => void
  onAtualizarQuantidade: (produtoId: string, quantidade: number) => void
  onRemoverProduto: (produtoId: string) => void
  onRemoverAdicional: (produtoId: string, adicionalId: string) => void
  onAdicionarAdicional: (produtoId: string, adicional: AdicionalPedidoNovo) => void
  onAtualizarDescontoItem: (produtoId: string, valor: string) => void
  onAlterarDescontoPedido: (valor: string) => void
  onAtualizarObservacoes: (produtoId: string, observacoes: string) => void
  onAbrirEditorItem?: (produto: ProdutoSelecionadoPedidoNovo) => void
  enviarParaImpressao: boolean
  onAlterarEnviarParaImpressao: (ativo: boolean) => void
  observacoesPedido?: string
  onAlterarObservacoesPedido?: (valor: string) => void
  stickyResumo?: boolean
}

const paraNumeroMonetario = (valor: string) => {
  const normalizado = valor.replace(',', '.').trim()
  if (!normalizado) return 0
  const numero = Number(normalizado)
  if (!Number.isFinite(numero) || numero < 0) return 0
  return numero
}

const calcularSubtotalBrutoProduto = (produto: ProdutoSelecionadoPedidoNovo) => {
  const precoAdicionais = produto.adicionais.reduce((total, adicional) => total + adicional.preco, 0)
  return (produto.preco + precoAdicionais) * produto.quantidade
}

export default function PainelTicketPedido({
  produtosSelecionados,
  totalItensPedido,
  subtotalBrutoPedido,
  subtotalPedido,
  descontoItensTotal,
  descontoPedidoInput,
  descontoPedidoAplicado,
  taxaEntregaPedido,
  taxaServicoPedido,
  totalPedido,
  tipoEntrega,
  aplicarTaxaServico,
  adicionaisDisponiveis,
  produtoSelecionadoParaAdicional,
  onAlterarProdutoSelecionadoParaAdicional,
  onAtualizarQuantidade,
  onRemoverProduto,
  onRemoverAdicional,
  onAdicionarAdicional,
  onAtualizarDescontoItem,
  onAlterarDescontoPedido,
  onAtualizarObservacoes,
  onAbrirEditorItem,
  enviarParaImpressao,
  onAlterarEnviarParaImpressao,
  observacoesPedido = '',
  onAlterarObservacoesPedido,
  stickyResumo = false,
}: PainelTicketPedidoProps) {
  return (
    <div className="space-y-4">
      {/* Itens */}
      <div className="rounded-xl border border-border/70 bg-card p-5">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-medium text-foreground">
            <ShoppingCart strokeWidth={1.6} className="size-4 text-muted-foreground" />
            Pedido
          </h3>
          <span className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {totalItensPedido} {totalItensPedido === 1 ? 'item' : 'itens'}
          </span>
        </div>

        {produtosSelecionados.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/70 p-8 text-center">
            <ShoppingCart strokeWidth={1.6} className="mx-auto mb-2 size-8 text-muted-foreground/60" />
            <p className="text-sm font-medium text-foreground">Nenhum item selecionado</p>
            <p className="mt-1 text-xs text-muted-foreground">Escolha itens no catálogo ao lado.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {produtosSelecionados.map((produto) => {
              const subtotalBrutoProduto = calcularSubtotalBrutoProduto(produto)
              const descontoItem = Math.min(
                subtotalBrutoProduto,
                paraNumeroMonetario(produto.descontoManualInput || ''),
              )
              const subtotalProduto = Math.max(0, subtotalBrutoProduto - descontoItem)
              const adicionaisUnitarios = produto.adicionais.reduce(
                (total, adicional) => total + adicional.preco,
                0,
              )

              return (
                <article
                  key={produto.id}
                  className="rounded-lg border border-border/70 bg-muted/30 p-3"
                >
                  <button
                    type="button"
                    onClick={onAbrirEditorItem ? () => onAbrirEditorItem(produto) : undefined}
                    className={cn(
                      'group mb-2 flex w-full items-start justify-between gap-2 text-left rounded-md',
                      onAbrirEditorItem ? 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2' : 'cursor-default',
                    )}
                    aria-label={onAbrirEditorItem ? `Editar ${produto.nome}` : undefined}
                  >
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 truncate text-sm font-medium text-foreground">
                        <span className="truncate group-hover:underline group-hover:underline-offset-4">{produto.nome}</span>
                        {onAbrirEditorItem && (
                          <Pencil strokeWidth={1.6} className="size-3 shrink-0 text-muted-foreground/70 transition-opacity group-hover:text-foreground" />
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        R$ {produto.preco.toFixed(2)}
                        {adicionaisUnitarios > 0
                          ? ` + R$ ${adicionaisUnitarios.toFixed(2)} adicionais/un.`
                          : ''}
                        {descontoItem > 0 ? ` · desc. R$ ${descontoItem.toFixed(2)}` : ''}
                      </p>
                    </div>
                    <p className="shrink-0 font-mono text-sm font-medium tabular-nums text-foreground">
                      R$ {subtotalProduto.toFixed(2)}
                    </p>
                  </button>

                  <div className="mb-2 flex items-center justify-between">
                    <div className="inline-flex items-center rounded-md border border-border/70 bg-card p-0.5">
                      <button
                        type="button"
                        onClick={() => onAtualizarQuantidade(produto.id, produto.quantidade - 1)}
                        disabled={produto.quantidade <= 1}
                        className="flex size-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
                        aria-label="Diminuir"
                      >
                        <Minus strokeWidth={1.6} className="size-3.5" />
                      </button>
                      <span className="min-w-8 text-center font-mono text-sm font-medium tabular-nums text-foreground">
                        {produto.quantidade}
                      </span>
                      <button
                        type="button"
                        onClick={() => onAtualizarQuantidade(produto.id, produto.quantidade + 1)}
                        className="flex size-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                        aria-label="Aumentar"
                      >
                        <Plus strokeWidth={1.6} className="size-3.5" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => onRemoverProduto(produto.id)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-destructive"
                    >
                      <Trash2 strokeWidth={1.6} className="size-3.5" />
                      Remover
                    </button>
                  </div>

                  <div className="mb-2 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
                        Desconto do item (R$)
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={produto.descontoManualInput}
                        onChange={(e) => onAtualizarDescontoItem(produto.id, e.target.value)}
                        placeholder="0,00"
                        className="h-8 w-full rounded-md border border-input bg-card px-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/60"
                      />
                    </div>
                    <div className="rounded-md border border-border/70 bg-card px-2.5 py-1.5 text-[11px] text-muted-foreground">
                      <p>
                        Bruto:{' '}
                        <span className="font-mono font-medium tabular-nums text-foreground">
                          R$ {subtotalBrutoProduto.toFixed(2)}
                        </span>
                      </p>
                      <p>
                        Desconto:{' '}
                        <span className="font-mono font-medium tabular-nums text-foreground">
                          R$ {descontoItem.toFixed(2)}
                        </span>
                      </p>
                    </div>
                  </div>

                  {produto.adicionais.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {produto.adicionais.map((adicional) => (
                        <span
                          key={adicional.id}
                          className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-card px-2 py-0.5 text-[11px] text-foreground"
                        >
                          {adicional.nome}
                          <button
                            type="button"
                            onClick={() => onRemoverAdicional(produto.id, adicional.id)}
                            className="rounded-sm text-muted-foreground hover:text-destructive"
                            aria-label={`Remover ${adicional.nome}`}
                          >
                            <X strokeWidth={1.6} className="size-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {adicionaisDisponiveis.length > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        onAlterarProdutoSelecionadoParaAdicional(
                          produtoSelecionadoParaAdicional === produto.id ? null : produto.id,
                        )
                      }
                      className="mb-2 w-full rounded-md border border-border/70 bg-card px-2.5 py-1.5 text-left text-xs font-medium text-foreground transition-colors hover:bg-accent"
                    >
                      {produtoSelecionadoParaAdicional === produto.id
                        ? 'Ocultar complementos'
                        : 'Adicionar complementos'}
                    </button>
                  )}

                  {produtoSelecionadoParaAdicional === produto.id && adicionaisDisponiveis.length > 0 && (
                    <div className="mb-2 grid grid-cols-1 gap-1.5">
                      {adicionaisDisponiveis.map((adicional) => {
                        const jaAdicionado = produto.adicionais.some((item) => item.id === adicional.id)
                        return (
                          <button
                            key={adicional.id}
                            type="button"
                            onClick={() => onAdicionarAdicional(produto.id, adicional)}
                            disabled={jaAdicionado}
                            className="flex items-center justify-between rounded-md border border-border/70 bg-card px-2.5 py-1.5 text-xs text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <span>{adicional.nome}</span>
                            <span className="font-mono font-medium tabular-nums">
                              + R$ {adicional.preco.toFixed(2)}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  )}

                  <input
                    type="text"
                    value={produto.observacoes}
                    onChange={(e) => onAtualizarObservacoes(produto.id, e.target.value)}
                    placeholder="Observação do item"
                    className="h-8 w-full rounded-md border border-input bg-card px-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/60"
                  />
                </article>
              )
            })}
          </div>
        )}
      </div>

      <div
        className={cn(
          'rounded-xl border border-border/70 bg-card p-5',
          stickyResumo && 'xl:sticky xl:bottom-0 xl:z-10 xl:bg-card xl:shadow-none',
        )}
      >
        <h4 className="mb-3 text-sm font-medium text-foreground">Resumo</h4>

        <div className="mb-4 space-y-1.5">
          <label className="block text-[11px] font-medium text-muted-foreground">
            Desconto geral do pedido (R$)
          </label>
          <input
            type="text"
            inputMode="decimal"
            value={descontoPedidoInput}
            onChange={(e) => onAlterarDescontoPedido(e.target.value)}
            placeholder="0,00"
            className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/60"
          />
        </div>

        {onAlterarObservacoesPedido && (
          <div className="mb-4 space-y-1.5">
            <label className="block text-[11px] font-medium text-muted-foreground" htmlFor="obs-pedido-geral">
              Observação geral do pedido
            </label>
            <textarea
              id="obs-pedido-geral"
              value={observacoesPedido}
              onChange={(e) => onAlterarObservacoesPedido(e.target.value)}
              placeholder="Ex.: entregar até 20h, cliente busca de moto…"
              rows={2}
              className="w-full resize-none rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/60"
            />
          </div>
        )}

        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Subtotal bruto</span>
            <span className="font-mono tabular-nums text-foreground">
              R$ {subtotalBrutoPedido.toFixed(2)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Descontos por item</span>
            <span className="font-mono tabular-nums text-foreground">
              − R$ {descontoItensTotal.toFixed(2)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Desconto geral</span>
            <span className="font-mono tabular-nums text-foreground">
              − R$ {descontoPedidoAplicado.toFixed(2)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Subtotal com descontos</span>
            <span className="font-mono tabular-nums text-foreground">
              R$ {subtotalPedido.toFixed(2)}
            </span>
          </div>
          {tipoEntrega === 'entrega' && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Taxa de entrega</span>
              <span className="font-mono tabular-nums text-foreground">
                {taxaEntregaPedido === 0 ? 'Grátis' : `R$ ${taxaEntregaPedido.toFixed(2)}`}
              </span>
            </div>
          )}
          {tipoEntrega === 'local' && aplicarTaxaServico && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Taxa de serviço</span>
              <span className="font-mono tabular-nums text-foreground">
                R$ {taxaServicoPedido.toFixed(2)}
              </span>
            </div>
          )}
          <div className="border-t border-border/70 pt-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">Total</span>
              <span className="font-mono text-lg font-semibold tabular-nums text-foreground">
                R$ {totalPedido.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-muted/30 p-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">Enviar para impressão</p>
            <p className="text-xs text-muted-foreground">Dispara impressão automática ao confirmar.</p>
          </div>
          <button
            type="button"
            onClick={() => onAlterarEnviarParaImpressao(!enviarParaImpressao)}
            role="switch"
            aria-checked={enviarParaImpressao}
            className={cn(
              'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
              enviarParaImpressao ? 'bg-foreground' : 'bg-muted-foreground/30',
            )}
          >
            <span
              className={cn(
                'inline-block size-4 transform rounded-full bg-background transition-transform',
                enviarParaImpressao ? 'translate-x-[18px]' : 'translate-x-0.5',
              )}
            />
          </button>
        </div>
      </div>
    </div>
  )
}
