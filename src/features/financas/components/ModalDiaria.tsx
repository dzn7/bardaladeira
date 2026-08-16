'use client'

import { useEffect, useId, useState, type ReactNode } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Funcionario } from '@/lib/tipos-caixa'
import { isoDoDia } from '../lib/formatadores'
import type { EntradaDiaria } from '../types'
import { ActionDialog } from './ActionDialog'

const FORMAS = [
  { valor: 'pix', rotulo: 'Pix' },
  { valor: 'dinheiro', rotulo: 'Dinheiro' },
  { valor: 'transferencia', rotulo: 'Transferência' },
  { valor: 'cartao_debito', rotulo: 'Cartão débito' },
  { valor: 'cartao_credito', rotulo: 'Cartão crédito' },
]

const SEM_FUNCIONARIO = '__nenhum__'

type ModalDiariaProps = {
  funcionarios: Funcionario[]
  onSubmit: (entrada: EntradaDiaria) => Promise<void>
  trigger?: ReactNode
  open?: boolean
  onOpenChange?: (aberto: boolean) => void
  dataInicial?: string
}

export function ModalDiaria({
  funcionarios,
  onSubmit,
  trigger,
  open,
  onOpenChange,
  dataInicial,
}: ModalDiariaProps) {
  const idNome = useId()
  const idValor = useId()
  const idData = useId()
  const idForma = useId()
  const idFunc = useId()
  const idObs = useId()

  const [formaPagamento, setFormaPagamento] = useState('pix')
  const [funcionarioId, setFuncionarioId] = useState(SEM_FUNCIONARIO)
  const [dataValor, setDataValor] = useState(dataInicial || isoDoDia(new Date()))

  useEffect(() => {
    if (open === false) return
    if (dataInicial) setDataValor(dataInicial)
  }, [dataInicial, open])

  async function handleSubmit(formData: FormData) {
    const nome = String(formData.get('nome_pessoa') ?? '').trim()
    const valorBruto = String(formData.get('valor') ?? '').replace(',', '.')
    const valor = Number.parseFloat(valorBruto)
    const data = String(formData.get('data') ?? dataValor)
    const observacoes = String(formData.get('observacoes') ?? '').trim()

    if (!nome) throw new Error('Informe o nome da pessoa.')
    if (!Number.isFinite(valor) || valor <= 0) {
      throw new Error('Informe um valor válido maior que zero.')
    }
    if (!data) throw new Error('Informe a data da diária.')

    await onSubmit({
      nome_pessoa: nome,
      valor,
      data_referencia: data,
      forma_pagamento: formaPagamento || null,
      funcionario_id: funcionarioId === SEM_FUNCIONARIO ? null : funcionarioId,
      observacoes: observacoes || null,
    })

    setFormaPagamento('pix')
    setFuncionarioId(SEM_FUNCIONARIO)
  }

  return (
    <ActionDialog
      trigger={trigger}
      open={open}
      onOpenChange={onOpenChange}
      title="Nova diária"
      description="Lança o pagamento do diarista como despesa do caixa e registra no calendário."
      submitLabel="Lançar diária"
      successMessage={undefined}
      action={handleSubmit}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor={idNome}>Nome da pessoa *</Label>
          <Input
            id={idNome}
            name="nome_pessoa"
            placeholder="Ex.: João (cozinha)"
            required
            autoComplete="name"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={idValor}>Valor da diária *</Label>
          <Input
            id={idValor}
            name="valor"
            type="text"
            inputMode="decimal"
            placeholder="0,00"
            required
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={idData}>Data *</Label>
          <Input
            id={idData}
            name="data"
            type="date"
            value={dataValor}
            onChange={(e) => setDataValor(e.target.value)}
            required
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={idForma}>Forma de pagamento</Label>
          <Select value={formaPagamento} onValueChange={setFormaPagamento}>
            <SelectTrigger id={idForma}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FORMAS.map((f) => (
                <SelectItem key={f.valor} value={f.valor}>
                  {f.rotulo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={idFunc}>Funcionário (opcional)</Label>
          <Select value={funcionarioId} onValueChange={setFuncionarioId}>
            <SelectTrigger id={idFunc}>
              <SelectValue placeholder="Avulso / sem cadastro" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SEM_FUNCIONARIO}>Avulso / sem cadastro</SelectItem>
              {funcionarios.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.nome}
                  {f.cargo ? <span className="ml-1 text-muted-foreground">· {f.cargo}</span> : null}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor={idObs}>Observações</Label>
          <Textarea
            id={idObs}
            name="observacoes"
            rows={2}
            placeholder="Turno, função, etc."
            className="resize-none"
          />
        </div>
      </div>
    </ActionDialog>
  )
}
