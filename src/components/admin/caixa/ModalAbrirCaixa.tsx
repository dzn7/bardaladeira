'use client'

import { useEffect, useMemo, useState } from 'react'
import { Unlock } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatarMoedaCaixa } from '@/lib/caixa-gaveta'
import type { Funcionario } from '@/lib/tipos-caixa'
import type { PedidoDia } from '@/lib/useCaixa'

type ModoAbertura = 'manual' | 'pedidos' | 'saldo_atual'

type Props = {
  aberto: boolean
  funcionarios: Funcionario[]
  pedidosHoje: PedidoDia[]
  totalPedidosHoje: number
  onFechar: () => void
  onConfirmar: (
    valor: number,
    responsavel: string,
    dataReferencia?: Date,
    modoAbertura?: ModoAbertura,
  ) => Promise<boolean>
}

export default function ModalAbrirCaixa({
  aberto,
  funcionarios,
  totalPedidosHoje,
  onFechar,
  onConfirmar,
}: Props) {
  const ativos = useMemo(
    () => funcionarios.filter((f) => f.ativo).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    [funcionarios],
  )
  const [modo, setModo] = useState<ModoAbertura>('manual')
  const [valor, setValor] = useState('0')
  const [responsavel, setResponsavel] = useState('')
  const [processando, setProcessando] = useState(false)

  useEffect(() => {
    if (!aberto) return
    setModo('manual')
    setValor('0')
    setResponsavel(ativos[0]?.nome || '')
  }, [aberto, ativos])

  useEffect(() => {
    if (modo === 'pedidos') setValor(totalPedidosHoje.toFixed(2))
    if (modo === 'manual' && valor === '') setValor('0')
  }, [modo, totalPedidosHoje, valor])

  const handleConfirmar = async () => {
    if (!responsavel.trim()) {
      toast.error('Selecione o responsável')
      return
    }
    const numero = Number(valor.replace(',', '.'))
    if (Number.isNaN(numero) || numero < 0) {
      toast.error('Informe um valor válido')
      return
    }
    setProcessando(true)
    const ok = await onConfirmar(numero, responsavel.trim(), undefined, modo)
    setProcessando(false)
    if (ok) onFechar()
  }

  return (
    <Dialog open={aberto} onOpenChange={(open) => !open && !processando && onFechar()}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="border-b border-border/70 px-5 py-4">
          <DialogTitle className="flex items-center gap-2">
            <Unlock className="h-4 w-4 text-primary" strokeWidth={1.6} />
            Abrir caixa
          </DialogTitle>
          <DialogDescription>Inicia a sessão do dia com o fundo de gaveta.</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="space-y-2">
            <Label>Responsável</Label>
            <Select value={responsavel} onValueChange={setResponsavel}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {ativos.map((f) => (
                  <SelectItem key={f.id} value={f.nome}>
                    {f.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Modo de abertura</Label>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { id: 'manual' as const, label: 'Fundo manual' },
                  { id: 'pedidos' as const, label: 'Com pedidos do dia' },
                ] as const
              ).map((opcao) => (
                <button
                  key={opcao.id}
                  type="button"
                  onClick={() => setModo(opcao.id)}
                  className={
                    modo === opcao.id
                      ? 'rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-left text-sm font-medium text-primary'
                      : 'rounded-lg border border-border/70 bg-card px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted'
                  }
                >
                  {opcao.label}
                </button>
              ))}
            </div>
            {modo === 'pedidos' && (
              <p className="text-xs text-muted-foreground">
                Abertura em R$ 0 e sincroniza pedidos do dia como entradas (
                {formatarMoedaCaixa(totalPedidosHoje)}).
              </p>
            )}
          </div>

          {modo === 'manual' && (
            <div className="space-y-2">
              <Label htmlFor="valor-abertura">Dinheiro na gaveta (abertura)</Label>
              <Input
                id="valor-abertura"
                inputMode="decimal"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                className="h-11 font-mono tabular-nums"
              />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 border-t border-border/70 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:gap-2">
          <Button type="button" variant="outline" className="h-11 w-full sm:w-auto" onClick={onFechar} disabled={processando}>
            Cancelar
          </Button>
          <Button type="button" className="h-11 w-full sm:w-auto" onClick={() => void handleConfirmar()} disabled={processando}>
            {processando ? 'Abrindo…' : 'Abrir caixa'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
