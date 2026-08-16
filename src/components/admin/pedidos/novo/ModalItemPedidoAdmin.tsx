'use client'

import { useEffect, useState } from 'react'
import { Minus, Plus, Trash2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

export type ItemPedidoModalDadosAdmin = {
  id: string
  nome: string
  preco: number
  categoria?: string | null
  quantidade: number
  observacoes: string
  descontoManualInput: string
}

type ModalItemPedidoAdminProps = {
  aberto: boolean
  modoEdicao: boolean
  dados: ItemPedidoModalDadosAdmin | null
  descontosAtivos: boolean
  onFechar: () => void
  onConfirmar: (atualizado: { quantidade: number; observacoes: string; descontoManualInput: string }) => void
  onRemover?: () => void
}

const normalizarInputMonetario = (valor: string) => {
  const limpo = valor.replace(',', '.').replace(/[^\d.]/g, '')
  if (!limpo) return ''
  const partes = limpo.split('.')
  if (partes.length === 1) return partes[0]
  const inteira = partes[0]
  const decimal = partes.slice(1).join('').slice(0, 2)
  return decimal.length > 0 ? `${inteira}.${decimal}` : `${inteira}.`
}

const paraNumero = (valor: string) => {
  const n = Number(valor.replace(',', '.').trim())
  return Number.isFinite(n) && n >= 0 ? n : 0
}

export default function ModalItemPedidoAdmin({
  aberto,
  modoEdicao,
  dados,
  descontosAtivos,
  onFechar,
  onConfirmar,
  onRemover,
}: ModalItemPedidoAdminProps) {
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
    <Dialog open={aberto} onOpenChange={(estado) => { if (!estado) onFechar() }}>
      <DialogContent className="mb-0 flex max-h-[92dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="shrink-0 space-y-1 border-b border-border/60 px-5 pb-4 pt-5 pr-12 text-left">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {modoEdicao ? 'Editar item' : 'Adicionar item'}
          </p>
          <DialogTitle className="line-clamp-2 text-base font-semibold leading-tight tracking-tight">
            {dados.nome}
          </DialogTitle>
          <DialogDescription>
            <span className="font-mono tabular-nums">R$ {dados.preco.toFixed(2)}</span>
            <span className="text-muted-foreground/70"> · cada</span>
            {dados.categoria ? <span className="text-muted-foreground/70"> · {dados.categoria}</span> : null}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-4">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-muted/30 px-3 py-2.5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Quantidade
              </p>
              <p className="mt-0.5 font-mono text-2xl font-bold tabular-nums leading-none">
                {quantidade}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                size="icon"
                variant="outline"
                className="size-10 rounded-lg"
                onClick={() => setQuantidade((q) => Math.max(1, q - 1))}
                disabled={quantidade <= 1}
                aria-label="Diminuir quantidade"
              >
                <Minus className="size-4" strokeWidth={1.6} />
              </Button>
              <Button
                type="button"
                size="icon"
                className="size-10 rounded-lg"
                onClick={() => setQuantidade((q) => Math.min(99, q + 1))}
                disabled={quantidade >= 99}
                aria-label="Aumentar quantidade"
              >
                <Plus className="size-4" strokeWidth={1.6} />
              </Button>
            </div>
          </div>

          {descontosAtivos && (
            <div className="grid gap-1.5">
              <Label htmlFor="modal-item-desconto" className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Desconto do item (R$)
              </Label>
              <Input
                id="modal-item-desconto"
                type="text"
                inputMode="decimal"
                value={desconto}
                onChange={(e) => setDesconto(normalizarInputMonetario(e.target.value))}
                placeholder="0,00"
                className="font-mono tabular-nums"
              />
              <p className="text-xs text-muted-foreground">
                Aplicado uma vez sobre o subtotal bruto do item.
              </p>
            </div>
          )}

          <div className="grid gap-1.5">
            <Label htmlFor="modal-item-obs" className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Observações
            </Label>
            <Textarea
              id="modal-item-obs"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Ex: sem cebola, ponto da carne, embalagem"
              rows={2}
              className="resize-none"
            />
          </div>

          <div className="rounded-xl border border-border/70 bg-muted/30 px-3 py-3 text-sm">
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span className="font-mono tabular-nums">R$ {subtotalBruto.toFixed(2)}</span>
            </div>
            {descontosAtivos && descontoValor > 0 && (
              <div className="mt-1 flex items-center justify-between text-destructive">
                <span>Desconto</span>
                <span className="font-mono tabular-nums">- R$ {descontoValor.toFixed(2)}</span>
              </div>
            )}
            <Separator className="my-2" />
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground">Total do item</span>
              <span className="font-mono text-lg font-bold tabular-nums">
                R$ {subtotalFinal.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter
          className={cn(
            'gap-2 border-t border-border/60 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:gap-2 sm:px-5 sm:pb-4',
            modoEdicao && onRemover ? 'sm:justify-between' : 'sm:justify-end',
          )}
        >
          {modoEdicao && onRemover ? (
            <Button
              type="button"
              variant="ghost"
              className="h-11 w-full text-destructive hover:bg-destructive/10 hover:text-destructive sm:mr-auto sm:h-9 sm:w-auto"
              onClick={() => { onRemover(); onFechar() }}
            >
              <Trash2 className="size-4" strokeWidth={1.6} />
              Remover
            </Button>
          ) : null}
          <Button type="button" variant="outline" className="h-11 w-full shadow-none sm:h-9 sm:w-auto" onClick={onFechar}>
            Cancelar
          </Button>
          <Button type="button" onClick={confirmar} className="h-11 w-full font-semibold shadow-none sm:h-9 sm:w-auto">
            {modoEdicao ? 'Atualizar' : 'Adicionar'}
            <span className="font-mono font-bold tabular-nums"> · R$ {subtotalFinal.toFixed(2)}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
