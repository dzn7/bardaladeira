'use client'

import { Money as Banknote, CreditCard, Minus, Plus, QrCode, Wallet } from '@phosphor-icons/react'
import { Botao, Gaveta } from '@/components/admin/ui'
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
    <Gaveta
      aberto={aberto}
      aoFechar={onFechar}
      titulo="Forma de pagamento"
      descricao={
        <span className="block truncate">
          {itemUnico
            ? `${totalUnidadesSelecionadas}/${itensQuantidadeModal[0]?.maxQtd || 0} ${itemUnico.nome}`
            : `${itens.length} ${itens.length === 1 ? 'item' : 'itens'} · ${totalUnidadesSelecionadas} ${
                totalUnidadesSelecionadas === 1 ? 'unidade' : 'unidades'
              }`}{' '}
          · <span className="font-mono tabular-nums">R$ {totalDescricao.toFixed(2)}</span>
        </span>
      }
      bloqueada={processando}
    >
      <div className="space-y-5">
        <ul className="divide-y divide-border/70 overflow-hidden rounded-xl border border-border/70 bg-card">
          {itensQuantidadeModal.map(({ item, maxQtd, qtdEscolhida, valor }) => (
            <li key={`pagamento-qtd-${item.id}`} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <div className="min-w-0">
                <span className="block truncate text-sm font-medium text-foreground">{item.nome}</span>
                <span className="block truncate text-[13px] text-muted-foreground">
                  {maxQtd} {maxQtd === 1 ? 'unidade restante' : 'unidades restantes'} ·{' '}
                  <span className="font-mono tabular-nums">R$ {valor.toFixed(2)}</span>
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Botao
                  variante="contorno"
                  tamanho="icone"
                  className="size-11"
                  onClick={() => onQuantidadeChange(item.id, qtdEscolhida - 1)}
                  disabled={qtdEscolhida <= 1 || maxQtd <= 1 || processando}
                  aria-label={`Diminuir quantidade de ${item.nome}`}
                >
                  <Minus />
                </Botao>
                <span className="min-w-[2.5ch] text-center font-mono text-lg font-semibold tabular-nums text-foreground">{qtdEscolhida}</span>
                <Botao
                  variante="contorno"
                  tamanho="icone"
                  className="size-11"
                  onClick={() => onQuantidadeChange(item.id, qtdEscolhida + 1)}
                  disabled={qtdEscolhida >= maxQtd || processando}
                  aria-label={`Aumentar quantidade de ${item.nome}`}
                >
                  <Plus />
                </Botao>
              </div>
            </li>
          ))}
        </ul>

        <div>
          <p className="mb-2 text-sm font-medium text-foreground">Como vai pagar?</p>
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
                    'flex min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-xl border border-border/70 bg-card p-3 text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:cursor-not-allowed disabled:opacity-50',
                    isCrediario
                      ? 'hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive'
                      : 'hover:border-primary/50 hover:bg-primary/10 hover:text-primary',
                  )}
                >
                  <IconeForma className="size-5" />
                  <span className="text-sm font-medium">{opcao.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </Gaveta>
  )
}
