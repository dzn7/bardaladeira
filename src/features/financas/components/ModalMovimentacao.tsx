'use client'

import { type ReactNode, useEffect, useId, useMemo, useState } from 'react'
import { Plus } from '@phosphor-icons/react'
import { AreaTexto, Botao, Campo, Entrada, EntradaPreco, Segmentos, Selecao } from '@/components/admin/ui'
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
  { valor: 'cartao_credito', rotulo: 'Crédito' },
  { valor: 'cartao_debito', rotulo: 'Débito' },
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
      ? 'Dinheiro que entrou no caixa.'
      : 'Dinheiro que saiu do caixa.'

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
    <Botao variante="contorno" tamanho="sm">
      <Plus className="size-4" />
      {tipoEfetivo === 'entrada' ? 'Receita' : 'Despesa'}
    </Botao>
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
      submitLabel={editando ? 'Salvar' : tipoEfetivo === 'entrada' ? 'Lançar receita' : 'Lançar despesa'}
      action={handleSubmit}
    >
      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Valor" htmlFor={idValor}>
          <EntradaPreco
            id={idValor}
            name="valor"
            valor={valorStr}
            aoMudar={setValorStr}
            required
            autoFocus={!editando}
          />
        </Campo>
        <Campo rotulo="Data" htmlFor={idData}>
          <Entrada id={idData} name="data" type="date" value={dataStr} onChange={(e) => setDataStr(e.target.value)} />
        </Campo>
      </div>

      <Campo rotulo="Descrição" htmlFor={idDescricao}>
        <AreaTexto
          id={idDescricao}
          name="descricao"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder={tipoEfetivo === 'entrada' ? 'Ex.: Venda no balcão' : 'Ex.: Compra de gelo'}
          rows={2}
          required
        />
      </Campo>

      <Campo rotulo="Forma de pagamento">
        <Segmentos
          opcoes={FORMAS_PAGAMENTO}
          valor={formaPagamento}
          aoMudar={(valor) => setFormaPagamento((atual) => (atual === valor ? '' : valor))}
          rotuloAcessivel="Forma de pagamento"
        />
      </Campo>

      <Campo rotulo="Categoria" htmlFor={idCategoria} opcional>
        <Selecao
          id={idCategoria}
          value={categoriaId}
          onChange={(e) => setCategoriaId(e.target.value)}
          disabled={categoriasFiltradas.length === 0}
        >
          <option value="">{categoriasFiltradas.length ? 'Sem categoria' : 'Nenhuma categoria cadastrada'}</option>
          {categoriasFiltradas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </Selecao>
      </Campo>
    </ActionDialog>
  )
}
