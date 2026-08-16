'use client'

import { useEffect, useState } from 'react'
import { Minus, Plus, Trash2, X } from 'lucide-react'
import { ModalSheet } from '@/components/ui/modal-sheet'

export type ItemPedidoModalDados = {
  id: string
  nome: string
  preco: number
  quantidade: number
  observacoes: string
  descontoManualInput: string
}

type ModalItemPedidoProps = {
  aberto: boolean
  modoEdicao: boolean
  dados: ItemPedidoModalDados | null
  descontosAtivos: boolean
  onFechar: () => void
  onConfirmar: (atualizado: { quantidade: number; observacoes: string; descontoManualInput: string }) => void
  onRemover?: () => void
}

const normalizarInputMonetario = (valor: string) => {
  const valorLimpo = valor.replace(',', '.').replace(/[^\d.]/g, '')
  if (!valorLimpo) return ''
  const partes = valorLimpo.split('.')
  if (partes.length === 1) return partes[0]
  const parteInteira = partes[0]
  const parteDecimal = partes.slice(1).join('').slice(0, 2)
  return parteDecimal.length > 0 ? `${parteInteira}.${parteDecimal}` : `${parteInteira}.`
}

const paraNumero = (valor: string) => {
  const n = Number(valor.replace(',', '.').trim())
  return Number.isFinite(n) && n >= 0 ? n : 0
}

export default function ModalItemPedido({
  aberto,
  modoEdicao,
  dados,
  descontosAtivos,
  onFechar,
  onConfirmar,
  onRemover,
}: ModalItemPedidoProps) {
  const [quantidade, setQuantidade] = useState(1)
  const [observacoes, setObservacoes] = useState('')
  const [desconto, setDesconto] = useState('')

  useEffect(() => {
    if (!aberto || !dados) return
    setQuantidade(Math.max(1, dados.quantidade || 1))
    setObservacoes(dados.observacoes || '')
    setDesconto(dados.descontoManualInput || '')
  }, [aberto, dados])

  if (!dados) return null

  const subtotalBruto = dados.preco * quantidade
  const descontoValor = descontosAtivos ? Math.min(subtotalBruto, paraNumero(desconto)) : 0
  const subtotalFinal = Math.max(0, subtotalBruto - descontoValor)

  const confirmar = () => {
    onConfirmar({
      quantidade,
      observacoes: observacoes.trim(),
      descontoManualInput: desconto,
    })
  }

  return (
    <ModalSheet
      open={aberto}
      onOpenChange={(open) => {
        if (!open) onFechar()
      }}
      title={modoEdicao ? 'Editar item' : 'Adicionar item'}
      showCloseButton={false}
      className="sm:max-w-md"
    >
      <div className="flex max-h-[92dvh] flex-col overflow-hidden">
        <div className="flex items-start justify-between gap-3 border-b border-border/70 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {modoEdicao ? 'Editar item' : 'Adicionar item'}
            </p>
            <h3 className="truncate text-base font-semibold tracking-tight text-foreground">{dados.nome}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              R$ {dados.preco.toFixed(2)} <span className="text-muted-foreground/80">cada</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onFechar}
            aria-label="Fechar"
            className="-mr-1 rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-4 py-4">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/40 px-3 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quantidade</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setQuantidade((q) => Math.max(1, q - 1))}
                className="flex h-11 w-11 items-center justify-center rounded-lg border border-border/70 bg-card text-foreground transition-all hover:bg-accent active:scale-95"
                aria-label="Diminuir quantidade"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="w-12 text-center text-xl font-semibold tabular-nums text-foreground">{quantidade}</span>
              <button
                type="button"
                onClick={() => setQuantidade((q) => q + 1)}
                className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-all hover:bg-primary/90 active:scale-95"
                aria-label="Aumentar quantidade"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          {descontosAtivos ? (
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Desconto do item (R$)
              </label>
              <input
                type="text"
                inputMode="decimal"
                value={desconto}
                onChange={(e) => setDesconto(normalizarInputMonetario(e.target.value))}
                placeholder="0,00"
                className="w-full rounded-lg border border-border/70 bg-muted/40 px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          ) : null}

          <div>
            <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Observações
            </label>
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Ex: sem cebola, ponto da carne, embalagem..."
              rows={2}
              className="w-full resize-none rounded-lg border border-border/70 bg-muted/40 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="rounded-xl border border-border/70 bg-muted/40 px-3 py-3 text-sm">
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span className="tabular-nums">R$ {subtotalBruto.toFixed(2)}</span>
            </div>
            {descontosAtivos && descontoValor > 0 ? (
              <div className="mt-1 flex items-center justify-between text-destructive">
                <span>Desconto</span>
                <span className="tabular-nums">- R$ {descontoValor.toFixed(2)}</span>
              </div>
            ) : null}
            <div className="mt-2 flex items-center justify-between border-t border-border/70 pt-2">
              <span className="font-semibold text-foreground">Total do item</span>
              <span className="text-lg font-semibold tabular-nums text-primary">R$ {subtotalFinal.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 border-t border-border/70 px-4 py-3">
          {modoEdicao && onRemover ? (
            <button
              type="button"
              onClick={() => {
                onRemover()
                onFechar()
              }}
              className="inline-flex h-12 items-center justify-center gap-1.5 rounded-lg bg-destructive/10 px-3 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/20"
              aria-label="Remover item"
            >
              <Trash2 className="h-4 w-4" />
              <span className="hidden sm:inline">Remover</span>
            </button>
          ) : null}
          <button
            type="button"
            onClick={onFechar}
            className="h-12 flex-1 rounded-lg bg-muted px-4 text-sm font-semibold text-foreground transition-colors hover:bg-accent sm:flex-none"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={confirmar}
            className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            {modoEdicao ? 'Atualizar' : 'Adicionar'}
            <span className="font-bold tabular-nums">· R$ {subtotalFinal.toFixed(2)}</span>
          </button>
        </div>
      </div>
    </ModalSheet>
  )
}
