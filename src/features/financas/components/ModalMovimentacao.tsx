'use client'

import { type ReactNode, useEffect, useId, useMemo, useState } from 'react'
import { Banknote, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ActionDialog } from './ActionDialog'
import type { CategoriaCaixa, MovimentacaoCaixa } from '@/lib/tipos-caixa'
import type { TipoMovimentacao } from '../types'
import { isoDoDia } from '../lib/formatadores'

export type PayloadMovimentacao = {
  tipo: TipoMovimentacao
  valor: number
  descricao?: string | null
  categoria_id?: string | null
  forma_pagamento?: string | null
  data?: string
}

interface ModalMovimentacaoProps {
  tipo: TipoMovimentacao
  categorias: CategoriaCaixa[]
  onSubmit: (entrada: PayloadMovimentacao) => Promise<void>
  trigger?: ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  movimentacao?: MovimentacaoCaixa | null
}

const FORMAS_PAGAMENTO = [
  { valor: 'pix', rotulo: 'Pix' },
  { valor: 'dinheiro', rotulo: 'Dinheiro' },
  { valor: 'cartao_credito', rotulo: 'Cartão de crédito' },
  { valor: 'cartao_debito', rotulo: 'Cartão de débito' },
  { valor: 'transferencia', rotulo: 'Transferência' },
  { valor: 'boleto', rotulo: 'Boleto' },
]

const formatarValorInput = (valor: number) =>
  Number.isFinite(valor) ? valor.toFixed(2).replace('.', ',') : ''

export function ModalMovimentacao({
  tipo,
  categorias,
  onSubmit,
  trigger,
  open,
  onOpenChange,
  movimentacao = null,
}: ModalMovimentacaoProps) {
  const editando = Boolean(movimentacao)
  const idValor = useId()
  const idDescricao = useId()
  const idCategoria = useId()
  const idForma = useId()
  const idData = useId()

  const [categoriaId, setCategoriaId] = useState('')
  const [formaPagamento, setFormaPagamento] = useState('')
  const [valorStr, setValorStr] = useState('')
  const [descricao, setDescricao] = useState('')
  const [dataStr, setDataStr] = useState(isoDoDia(new Date()))
  const [abertoInterno, setAbertoInterno] = useState(false)

  const controlado = open !== undefined
  const aberto = controlado ? Boolean(open) : abertoInterno

  const handleOpenChange = (proximo: boolean) => {
    if (!controlado) setAbertoInterno(proximo)
    onOpenChange?.(proximo)
  }

  const resetarFormulario = () => {
    setCategoriaId('')
    setFormaPagamento('')
    setValorStr('')
    setDescricao('')
    setDataStr(isoDoDia(new Date()))
  }

  const categoriasFiltradas = useMemo(
    () => categorias.filter((c) => c.tipo === (movimentacao?.tipo ?? tipo)),
    [categorias, tipo, movimentacao?.tipo],
  )

  const tipoEfetivo = movimentacao?.tipo ?? tipo
  const titulo = editando
    ? tipoEfetivo === 'entrada'
      ? 'Editar receita'
      : 'Editar despesa'
    : tipoEfetivo === 'entrada'
      ? 'Nova receita'
      : 'Nova despesa'
  const descricaoModal = editando
    ? 'Atualize os dados do lançamento.'
    : tipoEfetivo === 'entrada'
      ? 'Informe a descrição e o valor da receita.'
      : 'Informe a descrição e o valor da despesa.'

  useEffect(() => {
    if (!aberto) return
    if (movimentacao) {
      setCategoriaId(movimentacao.categoria_id ?? '')
      setFormaPagamento(movimentacao.forma_pagamento ?? '')
      setValorStr(formatarValorInput(Number(movimentacao.valor)))
      setDescricao(movimentacao.descricao ?? '')
      setDataStr(isoDoDia(new Date(movimentacao.created_at)))
      return
    }
    resetarFormulario()
  }, [movimentacao, aberto])

  const triggerPadrao = (
    <Button
      size="sm"
      className={
        tipoEfetivo === 'entrada'
          ? 'h-9 gap-2 border border-emerald-500/20 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-400'
          : 'h-9 gap-2 border border-rose-500/20 bg-rose-500/10 text-rose-700 hover:bg-rose-500/20 dark:text-rose-400'
      }
    >
      <Plus strokeWidth={1.6} className="h-4 w-4" />
      {tipoEfetivo === 'entrada' ? 'Receita' : 'Despesa'}
    </Button>
  )

  const handleSubmit = async (formData: FormData) => {
    const valorFinal = Number.parseFloat(String(formData.get('valor') ?? valorStr).replace(',', '.'))
    if (!Number.isFinite(valorFinal) || valorFinal <= 0) {
      throw new Error('Informe um valor válido maior que zero.')
    }

    const desc = String(formData.get('descricao') ?? descricao).trim() || null
    if (!desc) {
      throw new Error('Informe a descrição do lançamento.')
    }

    const dataCampo = String(formData.get('data') ?? dataStr)
    const dataIso = dataCampo ? new Date(dataCampo + 'T12:00:00').toISOString() : undefined

    await onSubmit({
      tipo: tipoEfetivo,
      valor: valorFinal,
      descricao: desc,
      categoria_id: categoriaId || null,
      forma_pagamento: formaPagamento || null,
      data: dataIso,
    })

    resetarFormulario()
  }

  return (
    <ActionDialog
      trigger={controlado ? undefined : trigger ?? triggerPadrao}
      open={aberto}
      onOpenChange={handleOpenChange}
      title={titulo}
      description={descricaoModal}
      submitLabel={editando ? 'Atualizar' : 'Confirmar'}
      action={handleSubmit}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={idDescricao}>Descrição</Label>
        <Textarea
          id={idDescricao}
          name="descricao"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder={
            tipoEfetivo === 'entrada'
              ? 'Informe a descrição da receita'
              : 'Informe a descrição da despesa'
          }
          rows={2}
          required
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={idValor}>Valor</Label>
          <div className="relative">
            <Banknote className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id={idValor}
              name="valor"
              type="text"
              inputMode="decimal"
              placeholder="00,00"
              className="pl-9"
              value={valorStr}
              onChange={(e) => setValorStr(e.target.value)}
              required
              autoFocus={!editando}
            />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={idData}>Data</Label>
          <Input
            id={idData}
            name="data"
            type="date"
            value={dataStr}
            onChange={(e) => setDataStr(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={idCategoria}>Categoria (opcional)</Label>
          <Select value={categoriaId || undefined} onValueChange={setCategoriaId}>
            <SelectTrigger id={idCategoria}>
              <SelectValue placeholder={categoriasFiltradas.length ? 'Selecionar' : 'Sem categorias'} />
            </SelectTrigger>
            <SelectContent>
              {categoriasFiltradas.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={idForma}>Forma de pagamento</Label>
          <Select value={formaPagamento || undefined} onValueChange={setFormaPagamento}>
            <SelectTrigger id={idForma}>
              <SelectValue placeholder="Selecionar" />
            </SelectTrigger>
            <SelectContent>
              {FORMAS_PAGAMENTO.map((f) => (
                <SelectItem key={f.valor} value={f.valor}>
                  {f.rotulo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </ActionDialog>
  )
}
