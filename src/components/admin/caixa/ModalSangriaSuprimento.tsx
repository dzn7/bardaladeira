'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowDownCircle, ArrowUpCircle } from 'lucide-react'
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
import type { Funcionario } from '@/lib/tipos-caixa'

type TipoOperacao = 'sangria' | 'suprimento'

type Props = {
  aberto: boolean
  tipo: TipoOperacao
  funcionarios: Funcionario[]
  onFechar: () => void
  onConfirmar: (valor: number, descricao?: string, funcionarioId?: string) => Promise<boolean>
}

export default function ModalSangriaSuprimento({
  aberto,
  tipo,
  funcionarios,
  onFechar,
  onConfirmar,
}: Props) {
  const ativos = useMemo(
    () => funcionarios.filter((f) => f.ativo).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    [funcionarios],
  )
  const [valor, setValor] = useState('')
  const [descricao, setDescricao] = useState('')
  const [funcionarioId, setFuncionarioId] = useState<string>('')
  const [processando, setProcessando] = useState(false)

  const ehSangria = tipo === 'sangria'
  const Icone = ehSangria ? ArrowDownCircle : ArrowUpCircle

  useEffect(() => {
    if (!aberto) return
    setValor('')
    setDescricao('')
    setFuncionarioId('')
  }, [aberto, tipo])

  const handleConfirmar = async () => {
    const numero = Number(String(valor).replace(',', '.'))
    if (!numero || numero <= 0) {
      toast.error('Informe um valor maior que zero')
      return
    }
    setProcessando(true)
    const ok = await onConfirmar(numero, descricao.trim() || undefined, funcionarioId || undefined)
    setProcessando(false)
    if (ok) onFechar()
  }

  return (
    <Dialog open={aberto} onOpenChange={(open) => !open && !processando && onFechar()}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
        <DialogHeader className="border-b border-border/70 px-5 py-4">
          <DialogTitle className="flex items-center gap-2">
            <Icone className={ehSangria ? 'h-4 w-4 text-destructive' : 'h-4 w-4 text-emerald-600'} strokeWidth={1.6} />
            {ehSangria ? 'Sangria' : 'Suprimento'}
          </DialogTitle>
          <DialogDescription>
            {ehSangria
              ? 'Retira dinheiro da gaveta (saída em dinheiro).'
              : 'Coloca dinheiro na gaveta (entrada em dinheiro).'}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="space-y-2">
            <Label htmlFor="valor-op">Valor</Label>
            <Input
              id="valor-op"
              inputMode="decimal"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              className="h-11 font-mono tabular-nums"
              placeholder="0,00"
            />
          </div>
          <div className="space-y-2">
            <Label>Funcionário (opcional)</Label>
            <Select value={funcionarioId || '__none'} onValueChange={(v) => setFuncionarioId(v === '__none' ? '' : v)}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Nenhum" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">Nenhum</SelectItem>
                {ativos.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="desc-op">Descrição</Label>
            <Textarea
              id="desc-op"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={2}
              placeholder="Opcional"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 border-t border-border/70 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:gap-2">
          <Button type="button" variant="outline" className="h-11 w-full sm:w-auto" onClick={onFechar} disabled={processando}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant={ehSangria ? 'destructive' : 'default'}
            className="h-11 w-full sm:w-auto"
            onClick={() => void handleConfirmar()}
            disabled={processando}
          >
            {processando ? 'Salvando…' : ehSangria ? 'Registrar sangria' : 'Registrar suprimento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
