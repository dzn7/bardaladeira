'use client'

import type { ReactNode } from 'react'
import { ArrowDown, ArrowUp, Minus } from '@phosphor-icons/react'
import { Cartao, Esqueleto } from '@/components/admin/ui'
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
  if (valor === 0) {
    return (
      <span className="flex items-center gap-1 text-[13px] text-muted-foreground">
        <Minus className="size-3.5" aria-hidden />
        igual a ontem
      </span>
    )
  }
  const subiu = valor > 0
  return (
    <span
      className={cn(
        'flex items-center gap-1 text-[13px] font-medium tabular-nums',
        subiu ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive',
      )}
    >
      {subiu ? <ArrowUp className="size-3.5" aria-hidden /> : <ArrowDown className="size-3.5" aria-hidden />}
      {Math.abs(valor).toFixed(1)}%
      <span className="font-normal text-muted-foreground">vs. ontem</span>
    </span>
  )
}

/** Números do dia em uma faixa só: 2 colunas no celular, 4 no desktop. */
export const FaixaKpiAnalise = ({ itens, carregando, acoes }: FaixaKpiAnaliseProps) => {
  return (
    <div className="space-y-3">
      <Cartao className="grid grid-cols-2 md:grid-cols-4">
        {itens.map((item, indice) => (
          <div
            key={item.id}
            className={cn(
              'min-w-0 px-4 py-3.5 md:px-5 md:py-4',
              indice % 2 === 1 && 'border-l border-border/70',
              indice >= 2 && 'border-t border-border/70 md:border-t-0',
              indice === 2 && 'md:border-l',
            )}
          >
            <p className="truncate text-[13px] text-muted-foreground">{item.label}</p>
            {carregando ? (
              <Esqueleto className="mt-1.5 h-6 w-20" />
            ) : (
              <p
                className={cn(
                  'mt-1 truncate text-lg font-semibold tabular-nums tracking-tight text-foreground md:text-xl',
                  item.destaque === 'destructive' && 'text-destructive',
                  item.destaque === 'muted' && 'text-muted-foreground',
                )}
              >
                {item.valor}
              </p>
            )}
            {typeof item.variacao === 'number' && !carregando ? (
              <div className="mt-0.5">
                <IndicadorVariacao valor={item.variacao} />
              </div>
            ) : null}
          </div>
        ))}
      </Cartao>
      {acoes}
    </div>
  )
}
