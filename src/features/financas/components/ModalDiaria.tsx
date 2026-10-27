'use client'

import { useEffect, useId, useState, type ReactNode } from 'react'
import { AreaTexto, Campo, Entrada, Segmentos, Selecao } from '@/components/admin/ui'
import type { Funcionario } from '@/lib/tipos-caixa'
import { isoDoDia } from '../lib/formatadores'
import type { EntradaDiaria } from '../types'
import { ActionDialog } from './ActionDialog'

const FORMAS = [
  { valor: 'pix', rotulo: 'Pix' },
  { valor: 'dinheiro', rotulo: 'Dinheiro' },
  { valor: 'transferencia', rotulo: 'Transferência' },
  { valor: 'cartao_debito', rotulo: 'Débito' },
  { valor: 'cartao_credito', rotulo: 'Crédito' },
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
      description="Entra como despesa no caixa e aparece no calendário."
      submitLabel="Lançar diária"
      successMessage={undefined}
      action={handleSubmit}
    >
      <Campo rotulo="Nome da pessoa" htmlFor={idNome}>
        <Entrada id={idNome} name="nome_pessoa" placeholder="Ex.: João (cozinha)" required autoComplete="name" />
      </Campo>

      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Valor" htmlFor={idValor}>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
            <Entrada
              id={idValor}
              name="valor"
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              required
              className="pl-10 font-mono tabular-nums"
            />
          </div>
        </Campo>
        <Campo rotulo="Data" htmlFor={idData}>
          <Entrada
            id={idData}
            name="data"
            type="date"
            value={dataValor}
            onChange={(e) => setDataValor(e.target.value)}
            required
          />
        </Campo>
      </div>

      <Campo rotulo="Forma de pagamento">
        <Segmentos
          opcoes={FORMAS}
          valor={formaPagamento}
          aoMudar={setFormaPagamento}
          rotuloAcessivel="Forma de pagamento"
        />
      </Campo>

      <Campo rotulo="Funcionário" htmlFor={idFunc} opcional>
        <Selecao id={idFunc} value={funcionarioId} onChange={(e) => setFuncionarioId(e.target.value)}>
          <option value={SEM_FUNCIONARIO}>Avulso, sem cadastro</option>
          {funcionarios.map((f) => (
            <option key={f.id} value={f.id}>
              {f.nome}
              {f.cargo ? ` · ${f.cargo}` : ''}
            </option>
          ))}
        </Selecao>
      </Campo>

      <Campo rotulo="Observações" htmlFor={idObs} opcional>
        <AreaTexto id={idObs} name="observacoes" rows={2} placeholder="Turno, função etc." />
      </Campo>
    </ActionDialog>
  )
}
