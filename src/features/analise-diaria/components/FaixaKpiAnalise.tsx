'use client'

import type { ReactNode } from 'react'
import { ArrowDown, ArrowUp, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

export type KpiItem = {
  id: string
  label: string
  valor: string
  variacao?: number
  destaque?: 'default' | 'destructive' | 'muted'
}

type FaixaKpiAnaliseProps = {
  itens: KpiItem[]
  carregando?: boolean
  acoes?: ReactNode
}

const IndicadorVariacao = ({ valor }: { valor: number }) => {
  if (valor === 0) return <Minus className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.6} />
  if (valor > 0) {
    return (
      <span className="flex items-center gap-0.5 text-xs font-medium text-emerald-600">
        <ArrowUp className="h-3.5 w-3.5" strokeWidth={1.6} />
        {valor.toFixed(1)}%
      </span>
    )
  }
  return (
    <span className="flex items-center gap-0.5 text-xs font-medium text-destructive">
      <ArrowDown className="h-3.5 w-3.5" strokeWidth={1.6} />
      {Math.abs(valor).toFixed(1)}%
    </span>
  )
}

export const FaixaKpiAnalise = ({ itens, carregando, acoes }: FaixaKpiAnaliseProps) => {
  return (
    <div className="flex flex-wrap items-end gap-4 md:gap-6">
      {itens.map((item) => (
        <div key={item.id} className="min-w-[70px]">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            {item.label}
          </p>
          <p
            className={cn(
              'mt-0.5 text-xl font-semibold tabular-nums text-foreground',
              item.destaque === 'destructive' && 'text-destructive',
              item.destaque === 'muted' && 'text-muted-foreground',
            )}
          >
            {carregando ? '—' : item.valor}
          </p>
          {typeof item.variacao === 'number' && !carregando ? (
            <div className="mt-1">
              <IndicadorVariacao valor={item.variacao} />
            </div>
          ) : null}
        </div>
      ))}
      {acoes}
    </div>
  )
}
