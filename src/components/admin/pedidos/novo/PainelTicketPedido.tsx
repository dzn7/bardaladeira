'use client'

import { ShoppingCart, Trash as Trash2, X, Minus, Plus, PencilSimple as Pencil } from '@phosphor-icons/react'
import { AdicionalPedidoNovo, ProdutoSelecionadoPedidoNovo } from './tipos'
import { cn } from '@/lib/utils'
import { AreaTexto, Botao, Entrada, EntradaPreco, LinhaInterruptor, ListaVazia, Selo } from '@/components/admin/ui'

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
            <ShoppingCart className="size-4 text-muted-foreground" />
            Pedido
          </h3>
          <Selo>
            {totalItensPedido} {totalItensPedido === 1 ? 'item' : 'itens'}
          </Selo>
        </div>

        {produtosSelecionados.length === 0 ? (
          <ListaVazia
            icone={<ShoppingCart />}
            titulo="Nenhum item ainda"
            descricao="Toque num produto do cardápio para adicionar."
          />
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
                          <Pencil className="size-3 shrink-0 text-muted-foreground/70 transition-opacity group-hover:text-foreground" />
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
                    <div className="inline-flex items-center rounded-lg border border-border/70 bg-card">
                      <button
                        type="button"
                        onClick={() => onAtualizarQuantidade(produto.id, produto.quantidade - 1)}
                        disabled={produto.quantidade <= 1}
                        className="flex size-11 items-center justify-center rounded-l-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40 md:size-9"
                        aria-label="Diminuir"
                      >
                        <Minus className="size-4" />
                      </button>
                      <span className="min-w-8 text-center font-mono text-sm font-medium tabular-nums text-foreground">
                        {produto.quantidade}
                      </span>
                      <button
                        type="button"
                        onClick={() => onAtualizarQuantidade(produto.id, produto.quantidade + 1)}
                        className="flex size-11 items-center justify-center rounded-r-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:size-9"
                        aria-label="Aumentar"
                      >
                        <Plus className="size-4" />
                      </button>
                    </div>

                    <Botao variante="perigoSuave" tamanho="sm" className="h-11 md:h-9" onClick={() => onRemoverProduto(produto.id)}>
                      <Trash2 />
                      Remover
                    </Botao>
                  </div>

                  <div className="mb-2 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                    <div>
                      <label className="mb-1 block text-[13px] font-medium text-muted-foreground" htmlFor={`desconto-item-${produto.id}`}>
                        Desconto do item
                      </label>
                      <EntradaPreco
                        id={`desconto-item-${produto.id}`}
                        valor={produto.descontoManualInput}
                        aoMudar={(valor) => onAtualizarDescontoItem(produto.id, valor)}
                      />
                    </div>
                    <div className="rounded-lg border border-border/70 bg-card px-2.5 py-1.5 text-[13px] text-muted-foreground">
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
                          className="inline-flex h-8 items-center gap-1 rounded-full border border-border/70 bg-card pl-3 pr-1 text-[13px] text-foreground"
                        >
                          {adicional.nome}
                          <button
                            type="button"
                            onClick={() => onRemoverAdicional(produto.id, adicional.id)}
                            className="relative flex size-6 items-center justify-center rounded-full text-muted-foreground before:absolute before:-inset-2 before:content-[''] hover:bg-accent hover:text-destructive"
                            aria-label={`Remover ${adicional.nome}`}
                          >
                            <X className="size-3.5" />
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
                      className="mb-2 flex min-h-11 w-full items-center rounded-lg border border-border/70 bg-card px-3 text-left text-sm font-medium text-foreground transition-colors hover:bg-accent md:min-h-9"
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
                            className="flex min-h-11 items-center justify-between rounded-lg border border-border/70 bg-card px-3 text-sm text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50 md:min-h-9"
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

                  <Entrada
                    type="text"
                    value={produto.observacoes}
                    onChange={(e) => onAtualizarObservacoes(produto.id, e.target.value)}
                    placeholder="Observação do item"
                    aria-label={`Observação de ${produto.nome}`}
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
          <label className="block text-[13px] font-medium text-muted-foreground" htmlFor="desconto-pedido-geral">
            Desconto geral do pedido
          </label>
          <EntradaPreco id="desconto-pedido-geral" valor={descontoPedidoInput} aoMudar={onAlterarDescontoPedido} />
        </div>

        {onAlterarObservacoesPedido && (
          <div className="mb-4 space-y-1.5">
            <label className="block text-[13px] font-medium text-muted-foreground" htmlFor="obs-pedido-geral">
              Observação geral do pedido
            </label>
            <AreaTexto
              id="obs-pedido-geral"
              value={observacoesPedido}
              onChange={(e) => onAlterarObservacoesPedido(e.target.value)}
              placeholder="Ex.: entregar até 20h, cliente busca de moto…"
              rows={2}
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

        <div className="mt-4">
          <LinhaInterruptor
            titulo="Enviar para impressão"
            descricao="Imprime sozinho ao confirmar."
            marcado={enviarParaImpressao}
            aoMudar={onAlterarEnviarParaImpressao}
          />
        </div>
      </div>
    </div>
  )
}
