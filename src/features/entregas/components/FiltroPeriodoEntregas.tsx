'use client'

import { CalendarDays } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { CHIP_FILTRO_DEFAULT } from '@/components/admin/filtros/chip-classes'
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
  const valorToggle = periodo === 'personalizado' ? undefined : periodo

  return (
    <section className="rounded-xl border border-border/70 bg-card p-4" aria-label="Filtro de período">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2">
            <CalendarDays className="size-4 text-muted-foreground" strokeWidth={1.6} />
            <h2 className="text-sm font-semibold">Período</h2>
          </div>
          <div className="w-full overflow-x-auto">
            <ToggleGroup
              type="single"
              value={valorToggle}
              onValueChange={(valor) => {
                if (!valor || carregando) return
                onPeriodoChange(valor as Exclude<PeriodoEntrega, 'personalizado'>)
              }}
              aria-label="Atalhos de período"
              className="flex w-max items-center justify-start gap-2"
            >
              {ATALHOS.map((atalho) => (
                <ToggleGroupItem
                  key={atalho.valor}
                  value={atalho.valor}
                  disabled={carregando}
                  className={CHIP_FILTRO_DEFAULT}
                >
                  {atalho.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Data inicial</span>
            <Input
              type="date"
              value={dataInicio}
              max={dataFim}
              disabled={carregando}
              onChange={(event) => onDataInicioChange(event.target.value)}
              className="h-9 min-w-44 rounded-lg border-border/70 shadow-none"
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Data final</span>
            <Input
              type="date"
              value={dataFim}
              min={dataInicio}
              disabled={carregando}
              onChange={(event) => onDataFimChange(event.target.value)}
              className="h-9 min-w-44 rounded-lg border-border/70 shadow-none"
            />
          </label>
        </div>
      </div>
    </section>
  )
}
