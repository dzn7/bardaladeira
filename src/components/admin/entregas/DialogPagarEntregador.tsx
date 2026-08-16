'use client'

import { useEffect, useState } from 'react'
import { Wallet, Save, RefreshCw } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import type { ResumoEntregadorDia } from '@/lib/tipos-entregas'

const FORMAS_PAGAMENTO = ['Dinheiro', 'PIX', 'Transferência', 'Cartão']

const formatarMoeda = (valor: number) =>
  `R$ ${Number(valor || 0).toFixed(2).replace('.', ',')}`

type Props = {
  registro: ResumoEntregadorDia | null
  aberto: boolean
  salvando: boolean
  onFechar: () => void
  onConfirmar: (params: {
    registroId: string
    valor: number
    acumularRestante: boolean
    metodoPagamento: string
    observacoes?: string
  }) => Promise<boolean>
}

export default function DialogPagarEntregador({
  registro,
  aberto,
  salvando,
  onFechar,
  onConfirmar,
}: Props) {
  const [valor, setValor] = useState('')
  const [acumularRestante, setAcumularRestante] = useState(true)
  const [metodoPagamento, setMetodoPagamento] = useState('Dinheiro')
  const [observacoes, setObservacoes] = useState('')

  useEffect(() => {
    if (registro && aberto) {
      setValor(registro.saldo.toFixed(2))
      setAcumularRestante(true)
      setMetodoPagamento('Dinheiro')
      setObservacoes('')
    }
  }, [registro, aberto])

  if (!registro) return null

  const valorNumero = Number(valor.replace(',', '.')) || 0
  const restante = Math.max(0, registro.saldo - valorNumero)
  const valorValido = valorNumero > 0 && valorNumero <= registro.saldo
  const pagandoTudo = restante <= 0.001

  const handleConfirmar = async () => {
    if (!valorValido || !registro.registro_id) return
    const ok = await onConfirmar({
      registroId: registro.registro_id,
      valor: valorNumero,
      acumularRestante: !pagandoTudo && acumularRestante,
      metodoPagamento,
      observacoes,
    })
    if (ok) onFechar()
  }

  const dataFormatada = new Date(registro.data_referencia + 'T00:00:00').toLocaleDateString(
    'pt-BR',
    { day: '2-digit', month: 'long', year: 'numeric' }
  )

  return (
    <Dialog open={aberto} onOpenChange={(open) => !open && !salvando && onFechar()}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold tracking-tight">
            <Wallet className="w-4 h-4 text-muted-foreground" strokeWidth={1.6} />
            Pagar entregador
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {registro.entregador_nome} · {dataFormatada}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Resumo */}
          <div className="rounded-lg border border-border/70 bg-muted/30 p-3 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Entregas no dia</span>
              <span className="font-mono tabular-nums font-medium">{registro.total_entregas}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Total devido</span>
              <span className="font-mono tabular-nums font-medium">{formatarMoeda(registro.total_devido)}</span>
            </div>
            {registro.valor_pago > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Já pago</span>
                <span className="font-mono tabular-nums font-medium text-emerald-600 dark:text-emerald-400">
                  {formatarMoeda(registro.valor_pago)}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-border/70 pt-1.5 text-sm">
              <span className="font-medium">A pagar</span>
              <span className="font-mono tabular-nums font-semibold">{formatarMoeda(registro.saldo)}</span>
            </div>
          </div>

          {/* Valor */}
          <div className="space-y-1.5">
            <Label htmlFor="valor-pagamento" className="text-xs font-medium">
              Valor do pagamento (R$)
            </Label>
            <input
              id="valor-pagamento"
              type="number"
              step="0.01"
              min="0"
              max={registro.saldo}
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              disabled={salvando}
              className="w-full h-10 rounded-lg border border-border/70 bg-background px-3 text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            />
            <div className="flex gap-1.5 mt-1">
              <button
                type="button"
                onClick={() => setValor(registro.saldo.toFixed(2))}
                className="flex-1 h-7 px-2 text-xs border border-border/70 rounded-md hover:bg-muted transition-colors"
              >
                Total
              </button>
              <button
                type="button"
                onClick={() => setValor((registro.saldo / 2).toFixed(2))}
                className="flex-1 h-7 px-2 text-xs border border-border/70 rounded-md hover:bg-muted transition-colors"
              >
                Metade
              </button>
            </div>
          </div>

          {/* Restante */}
          {!pagandoTudo && valorNumero > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-lg border border-border/70 bg-muted/20 px-3 py-2">
                <span className="text-xs text-muted-foreground">Restante após pagamento</span>
                <span className="text-sm font-mono tabular-nums font-medium">{formatarMoeda(restante)}</span>
              </div>
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={acumularRestante}
                  onChange={(e) => setAcumularRestante(e.target.checked)}
                  disabled={salvando}
                  className="w-4 h-4 mt-0.5 rounded border-border accent-foreground"
                />
                <div>
                  <p className="text-sm font-medium">Acumular o restante</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    O saldo fica registrado para pagamento em outro dia.
                  </p>
                </div>
              </label>
            </div>
          )}

          {/* Forma de pagamento */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Forma de pagamento</Label>
            <div className="grid grid-cols-4 gap-1.5">
              {FORMAS_PAGAMENTO.map((forma) => (
                <button
                  key={forma}
                  type="button"
                  onClick={() => setMetodoPagamento(forma)}
                  disabled={salvando}
                  className={`h-9 px-2 rounded-lg text-xs font-medium transition-colors ${
                    metodoPagamento === forma
                      ? 'bg-foreground text-background'
                      : 'border border-border/70 text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {forma}
                </button>
              ))}
            </div>
          </div>

          {/* Observações */}
          <div className="space-y-1.5">
            <Label htmlFor="observacoes-pagamento" className="text-xs font-medium">
              Observações (opcional)
            </Label>
            <textarea
              id="observacoes-pagamento"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              disabled={salvando}
              placeholder="Anote qualquer detalhe sobre este pagamento..."
              rows={2}
              className="w-full rounded-lg border border-border/70 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none disabled:opacity-50"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <button
            type="button"
            onClick={onFechar}
            disabled={salvando}
            className="h-9 px-4 border border-border/70 rounded-lg text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirmar}
            disabled={!valorValido || salvando}
            className="h-9 px-4 bg-foreground text-background rounded-lg text-sm font-medium flex items-center gap-1.5 hover:bg-foreground/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {salvando ? (
              <RefreshCw className="w-4 h-4 animate-spin" strokeWidth={1.6} />
            ) : (
              <Save className="w-4 h-4" strokeWidth={1.6} />
            )}
            Confirmar pagamento
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
