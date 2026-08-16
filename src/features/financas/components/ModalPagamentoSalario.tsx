'use client'

import { useId, useMemo, useState, type ReactNode } from 'react'
import { Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ActionDialog } from './ActionDialog'
import type { CategoriaCaixa, Funcionario } from '@/lib/tipos-caixa'
import { isoDoDia } from '../lib/formatadores'

interface ModalPagamentoSalarioProps {
  funcionarios: Funcionario[]
  categorias: CategoriaCaixa[]
  onSubmit: (entrada: {
    tipo: 'saida'
    valor: number
    descricao?: string | null
    categoria_id?: string | null
    funcionario_id?: string | null
    forma_pagamento?: string | null
    data?: string
  }) => Promise<void>
  trigger?: ReactNode
}

const FORMAS = [
  { valor: 'pix', rotulo: 'Pix' },
  { valor: 'dinheiro', rotulo: 'Dinheiro' },
  { valor: 'transferencia', rotulo: 'Transferência' },
  { valor: 'cheque', rotulo: 'Cheque' },
]

const TIPOS_PAGAMENTO = [
  { valor: 'salario', rotulo: 'Salário' },
  { valor: 'adiantamento', rotulo: 'Adiantamento' },
  { valor: 'bonus', rotulo: 'Bônus' },
  { valor: 'comissao', rotulo: 'Comissão' },
  { valor: 'ferias', rotulo: 'Férias' },
  { valor: 'decimo_terceiro', rotulo: '13º' },
]

export function ModalPagamentoSalario({ funcionarios, categorias, onSubmit, trigger }: ModalPagamentoSalarioProps) {
  const idValor = useId()
  const idData = useId()
  const idFunc = useId()
  const idTipo = useId()
  const idCategoria = useId()
  const idForma = useId()
  const idObs = useId()

  const [funcionarioId, setFuncionarioId] = useState('')
  const [tipoPagamento, setTipoPagamento] = useState('salario')
  const [categoriaId, setCategoriaId] = useState('')
  const [formaPagamento, setFormaPagamento] = useState('pix')

  const categoriasSaida = useMemo(() => categorias.filter((c) => c.tipo === 'saida'), [categorias])
  const funcionarioSelecionado = funcionarios.find((f) => f.id === funcionarioId)

  async function handleSubmit(formData: FormData) {
    const valorBruto = String(formData.get('valor') ?? '').replace(',', '.')
    const valor = Number.parseFloat(valorBruto)
    if (!Number.isFinite(valor) || valor <= 0) {
      throw new Error('Informe um valor válido maior que zero.')
    }
    if (!funcionarioId) {
      throw new Error('Selecione o funcionário.')
    }

    const obs = String(formData.get('observacoes') ?? '').trim()
    const rotuloTipo = TIPOS_PAGAMENTO.find((t) => t.valor === tipoPagamento)?.rotulo ?? 'Salário'
    const descricaoBase = `${rotuloTipo} – ${funcionarioSelecionado?.nome ?? 'funcionário'}`
    const descricao = obs ? `${descricaoBase} (${obs})` : descricaoBase

    const dataStr = String(formData.get('data') ?? '')
    const dataIso = dataStr ? new Date(dataStr + 'T12:00:00').toISOString() : undefined

    await onSubmit({
      tipo: 'saida',
      valor,
      descricao,
      categoria_id: categoriaId || null,
      funcionario_id: funcionarioId,
      forma_pagamento: formaPagamento || null,
      data: dataIso,
    })

    setFuncionarioId('')
    setTipoPagamento('salario')
    setCategoriaId('')
    setFormaPagamento('pix')
  }

  return (
    <ActionDialog
      trigger={
        trigger ?? (
          <Button variant="outline" size="sm" className="h-9 gap-2">
            <Users strokeWidth={1.6} className="h-4 w-4" />
            Pagar salário
          </Button>
        )
      }
      title="Registrar pagamento de funcionário"
      description="O lançamento entra como saída do caixa, vinculado ao funcionário."
      submitLabel="Registrar pagamento"
      action={handleSubmit}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor={idFunc}>Funcionário</Label>
          <Select value={funcionarioId} onValueChange={setFuncionarioId}>
            <SelectTrigger id={idFunc}>
              <SelectValue placeholder={funcionarios.length ? 'Selecionar' : 'Sem funcionários ativos'} />
            </SelectTrigger>
            <SelectContent>
              {funcionarios.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.nome}
                  {f.cargo ? <span className="ml-1 text-muted-foreground">· {f.cargo}</span> : null}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={idTipo}>Tipo</Label>
          <Select value={tipoPagamento} onValueChange={setTipoPagamento}>
            <SelectTrigger id={idTipo}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIPOS_PAGAMENTO.map((t) => (
                <SelectItem key={t.valor} value={t.valor}>
                  {t.rotulo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={idValor}>Valor</Label>
          <Input id={idValor} name="valor" type="text" inputMode="decimal" placeholder="0,00" required />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={idData}>Data</Label>
          <Input id={idData} name="data" type="date" defaultValue={isoDoDia(new Date())} />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={idForma}>Forma</Label>
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
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={idCategoria}>Categoria</Label>
        <Select value={categoriaId} onValueChange={setCategoriaId}>
          <SelectTrigger id={idCategoria}>
            <SelectValue placeholder={categoriasSaida.length ? 'Selecionar' : 'Sem categorias de saída'} />
          </SelectTrigger>
          <SelectContent>
            {categoriasSaida.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={idObs}>Observações</Label>
        <Textarea id={idObs} name="observacoes" rows={2} placeholder="Opcional. Ex: referente à 1ª quinzena." />
      </div>
    </ActionDialog>
  )
}
