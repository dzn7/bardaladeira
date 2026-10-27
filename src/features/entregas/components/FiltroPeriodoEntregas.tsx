'use client'

import { Campo, Cartao, Chip, Entrada } from '@/components/admin/ui'
import type { PeriodoEntrega } from '../types'

type FiltroPeriodoEntregasProps = {
  periodo: PeriodoEntrega
  dataInicio: string
  dataFim: string
  carregando?: boolean
  onPeriodoChange: (periodo: Exclude<PeriodoEntrega, 'personalizado'>) => void
  onDataInicioChange: (data: string) => void
  onDataFimChange: (data: string) => void
}

const ATALHOS: Array<{
  valor: Exclude<PeriodoEntrega, 'personalizado'>
  label: string
}> = [
  { valor: 'hoje', label: 'Hoje' },
  { valor: '7dias', label: '7 dias' },
  { valor: '30dias', label: '30 dias' },
  { valor: 'semana', label: 'Semana' },
  { valor: 'mes', label: 'Mês' },
]

export default function FiltroPeriodoEntregas({
  periodo,
  dataInicio,
  dataFim,
  carregando = false,
  onPeriodoChange,
  onDataInicioChange,
  onDataFimChange,
}: FiltroPeriodoEntregasProps) {
  return (
    <Cartao className="space-y-4 p-4" aria-label="Filtro de período">
      <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Atalhos de período">
        {ATALHOS.map((atalho) => (
          <Chip
            key={atalho.valor}
            ativo={periodo === atalho.valor}
            disabled={carregando}
            onClick={() => onPeriodoChange(atalho.valor)}
            className="h-10"
          >
            {atalho.label}
          </Chip>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="De">
          <Entrada
            type="date"
            value={dataInicio}
            max={dataFim}
            disabled={carregando}
            aria-label="Data inicial"
            onChange={(event) => onDataInicioChange(event.target.value)}
          />
        </Campo>
        <Campo rotulo="Até">
          <Entrada
            type="date"
            value={dataFim}
            min={dataInicio}
            disabled={carregando}
            aria-label="Data final"
            onChange={(event) => onDataFimChange(event.target.value)}
          />
        </Campo>
      </div>
    </Cartao>
  )
}
