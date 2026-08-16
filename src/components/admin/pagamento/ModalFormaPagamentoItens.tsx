'use client'

import { Banknote, CreditCard, Minus, Plus, QrCode, Wallet, X } from 'lucide-react'
import { ModalSheet } from '@/components/ui/modal-sheet'
import { cn } from '@/lib/utils'
import {
  construirSnapshotItensPagos,
  normalizarQuantidadeUnidades,
  valorUnitarioItem,
  type FormaPagamentoItens,
  type ItemPagamento,
  type ItemPagoSnapshot,
} from './pagamentoItens'

type ModalFormaPagamentoItensProps = {
  aberto: boolean
  itens: ItemPagamento[]
  quantidadesPorItem: Record<string, number>
  quantidadesDisponiveis: Record<string, number>
  formasDisponiveis?: FormaPagamentoItens[]
  processando?: boolean
  onFechar: () => void
  onQuantidadeChange: (itemId: string, quantidade: number) => void
  onSelecionarForma: (forma: FormaPagamentoItens, itensPagos: ItemPagoSnapshot[]) => void
}

const OPCOES_FORMA = [
  { id: 'pix' as const, label: 'PIX', icone: QrCode, cor: 'emerald' as const },
  { id: 'dinheiro' as const, label: 'Dinheiro', icone: Banknote, cor: 'emerald' as const },
  { id: 'cartao' as const, label: 'Cartão', icone: CreditCard, cor: 'emerald' as const },
  { id: 'crediario' as const, label: 'Crediário', icone: Wallet, cor: 'red' as const },
]

export function ModalFormaPagamentoItens({
  aberto,
  itens,
  quantidadesPorItem,
  quantidadesDisponiveis,
  formasDisponiveis = OPCOES_FORMA.map((opcao) => opcao.id),
  processando = false,
  onFechar,
  onQuantidadeChange,
  onSelecionarForma,
}: ModalFormaPagamentoItensProps) {
  const itensQuantidadeModal = itens.map((item) => {
    const maxQtd = Math.floor(quantidadesDisponiveis[item.id] ?? item.quantidade)
    const qtdEscolhida = normalizarQuantidadeUnidades(quantidadesPorItem[item.id], maxQtd)
    const precoUnit = valorUnitarioItem(item)
    return {
      item,
      maxQtd,
      qtdEscolhida,
      valor: Number((precoUnit * qtdEscolhida).toFixed(2)),
    }
  })
  const totalUnidadesSelecionadas = itensQuantidadeModal.reduce((sum, item) => sum + item.qtdEscolhida, 0)
  const totalDescricao = Number(itensQuantidadeModal.reduce((sum, item) => sum + item.valor, 0).toFixed(2))
  const itemUnico = itens.length === 1 ? itens[0] : null

  return (
    <ModalSheet
      open={aberto}
      onOpenChange={(open) => {
        if (!open) onFechar()
      }}
      title="Forma de pagamento"
      showCloseButton={false}
      className="sm:max-w-sm"
    >
      <div className="p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-foreground">Forma de pagamento</h3>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {itemUnico
                ? `${totalUnidadesSelecionadas}/${itensQuantidadeModal[0]?.maxQtd || 0} ${itemUnico.nome}`
                : `${itens.length} ${itens.length === 1 ? 'item' : 'itens'} · ${totalUnidadesSelecionadas} ${
                    totalUnidadesSelecionadas === 1 ? 'unidade' : 'unidades'
                  }`}{' '}
              · R$ {totalDescricao.toFixed(2)}
            </p>
          </div>
          <button
            type="button"
            onClick={onFechar}
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X strokeWidth={1.6} className="size-4" />
          </button>
        </div>

        <div className="mb-4 max-h-[42vh] space-y-2 overflow-y-auto pr-1">
          {itensQuantidadeModal.map(({ item, maxQtd, qtdEscolhida, valor }) => (
            <div key={`pagamento-qtd-${item.id}`} className="rounded-lg border border-border/70 bg-muted/30 px-3 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="block truncate text-xs font-semibold text-foreground">{item.nome}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {maxQtd} {maxQtd === 1 ? 'unidade restante' : 'unidades restantes'} · R$ {valor.toFixed(2)}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onQuantidadeChange(item.id, qtdEscolhida - 1)}
                    disabled={qtdEscolhida <= 1 || maxQtd <= 1 || processando}
                    aria-label={`Diminuir quantidade de ${item.nome}`}
                    className="flex size-9 items-center justify-center rounded-md border border-border/70 bg-card text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Minus strokeWidth={1.8} className="size-4" />
                  </button>
                  <span className="min-w-[2.5ch] text-center font-mono text-lg font-semibold tabular-nums text-foreground">{qtdEscolhida}</span>
                  <button
                    type="button"
                    onClick={() => onQuantidadeChange(item.id, qtdEscolhida + 1)}
                    disabled={qtdEscolhida >= maxQtd || processando}
                    aria-label={`Aumentar quantidade de ${item.nome}`}
                    className="flex size-9 items-center justify-center rounded-md border border-border/70 bg-card text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Plus strokeWidth={1.8} className="size-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {OPCOES_FORMA.filter((opcao) => formasDisponiveis.includes(opcao.id)).map((opcao) => {
            const IconeForma = opcao.icone
            const isCrediario = opcao.cor === 'red'
            return (
              <button
                key={opcao.id}
                type="button"
                disabled={processando || totalUnidadesSelecionadas <= 0}
                onClick={() =>
                  onSelecionarForma(
                    opcao.id,
                    construirSnapshotItensPagos(itens, quantidadesPorItem, quantidadesDisponiveis),
                  )
                }
                className={cn(
                  'flex min-h-[68px] flex-col items-center justify-center gap-1.5 rounded-lg border border-border/70 bg-card p-3 text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:cursor-not-allowed disabled:opacity-50',
                  isCrediario
                    ? 'hover:border-red-400/70 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/30 dark:hover:text-red-300'
                    : 'hover:border-emerald-400/70 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950/30 dark:hover:text-emerald-300',
                )}
              >
                <IconeForma strokeWidth={1.6} className="size-5" />
                <span className="text-xs font-medium">{opcao.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </ModalSheet>
  )
}
