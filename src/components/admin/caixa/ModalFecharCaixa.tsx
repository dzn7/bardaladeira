'use client'

import { useEffect, useMemo, useState } from 'react'
import { Lock } from 'lucide-react'
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
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { formatarMoedaCaixa, type ResumoFormasCaixa } from '@/lib/caixa-gaveta'
import type { Caixa, EstatisticasCaixa, Funcionario } from '@/lib/tipos-caixa'

type Props = {
  aberto: boolean
  caixa: Caixa | null
  funcionarios: Funcionario[]
  estatisticas: EstatisticasCaixa
  resumoFormas: ResumoFormasCaixa
  onFechar: () => void
  onConfirmar: (contadoDinheiro: number, responsavel: string, observacoes?: string) => Promise<boolean>
}

export default function ModalFecharCaixa({
  aberto,
  caixa,
  funcionarios,
  estatisticas,
  resumoFormas,
  onFechar,
  onConfirmar,
}: Props) {
  const ativos = useMemo(
    () => funcionarios.filter((f) => f.ativo).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    [funcionarios],
  )
  const esperado = estatisticas.esperadoDinheiro
  const [contado, setContado] = useState('')
  const [responsavel, setResponsavel] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [processando, setProcessando] = useState(false)

  useEffect(() => {
    if (!aberto) return
    setContado(esperado.toFixed(2))
    setResponsavel(ativos[0]?.nome || '')
    setObservacoes('')
  }, [aberto, esperado, ativos])

  const contadoNumero = Number(String(contado).replace(',', '.')) || 0
  const diferenca = contadoNumero - esperado

  const handleConfirmar = async () => {
    if (!responsavel.trim()) {
      toast.error('Selecione o responsável')
      return
    }
    setProcessando(true)
    const ok = await onConfirmar(contadoNumero, responsavel.trim(), observacoes.trim() || undefined)
    setProcessando(false)
    if (ok) onFechar()
  }

  if (!caixa) return null

  return (
    <Dialog open={aberto} onOpenChange={(open) => !open && !processando && onFechar()}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-b border-border/70 px-5 py-4">
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-primary" strokeWidth={1.6} />
            Fechar caixa
          </DialogTitle>
          <DialogDescription>
            Confira o dinheiro da gaveta. PIX e cartão são só informativos.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-2 gap-2 rounded-xl border border-border/70 bg-muted/30 p-3">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Esperado (dinheiro)</p>
              <p className="mt-1 font-mono text-lg font-semibold tabular-nums">{formatarMoedaCaixa(esperado)}</p>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Diferença</p>
              <p
                className={cn(
                  'mt-1 font-mono text-lg font-semibold tabular-nums',
                  diferenca === 0 ? 'text-foreground' : diferenca > 0 ? 'text-emerald-600' : 'text-destructive',
                )}
              >
                {formatarMoedaCaixa(diferenca)}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="contado-dinheiro">Dinheiro contado na gaveta</Label>
            <Input
              id="contado-dinheiro"
              inputMode="decimal"
              value={contado}
              onChange={(e) => setContado(e.target.value)}
              className="h-11 font-mono tabular-nums"
            />
          </div>

          <div className="space-y-2 rounded-lg border border-border/60 p-3">
            <p className="text-xs font-medium text-muted-foreground">Resumo esperado por forma (não entra na gaveta)</p>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div>
                <p className="text-[11px] text-muted-foreground">PIX</p>
                <p className="font-mono tabular-nums">{formatarMoedaCaixa(resumoFormas.pix)}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Cartão</p>
                <p className="font-mono tabular-nums">{formatarMoedaCaixa(resumoFormas.cartao)}</p>
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Outros</p>
                <p className="font-mono tabular-nums">{formatarMoedaCaixa(resumoFormas.outros)}</p>
              </div>
            </div>
          </div>

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
            <Label htmlFor="obs-fechamento">Observações</Label>
            <Textarea
              id="obs-fechamento"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={2}
              placeholder="Opcional"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 border-t border-border/70 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:gap-2">
          <Button type="button" variant="outline" className="h-11 w-full sm:w-auto" onClick={onFechar} disabled={processando}>
            Cancelar
          </Button>
          <Button type="button" className="h-11 w-full sm:w-auto" onClick={() => void handleConfirmar()} disabled={processando}>
            {processando ? 'Fechando…' : 'Fechar caixa'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
