'use client'

import type { ReactNode } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ResumoPeriodo } from '../types'
import { formatarMoeda } from '../lib/formatadores'

interface StatCardsFinanceirosProps {
  resumo: ResumoPeriodo
  carregando?: boolean
  valoresOcultos: boolean
  onAlternarOcultos: () => void
  receitaTrigger: ReactNode
  despesaTrigger: ReactNode
}

export function StatCardsFinanceiros({
  resumo,
  carregando,
  valoresOcultos,
  onAlternarOcultos,
  receitaTrigger,
  despesaTrigger,
}: StatCardsFinanceirosProps) {
  const mostrar = (valor: number) => (valoresOcultos ? '••••••' : formatarMoeda(valor))
  const margem = resumo.receitaTotal > 0 ? (resumo.lucroLiquido / resumo.receitaTotal) * 100 : 0

  return (
    <div className="flex w-full min-w-0 flex-col gap-4 overflow-hidden rounded-lg border border-border/80 bg-card p-4 lg:flex-row lg:items-center lg:justify-between lg:gap-6 lg:px-6 lg:py-[1.125rem]">
      <div className="flex w-full flex-col gap-4 md:flex-row md:items-center">
        <div className="min-w-0 w-full md:max-w-[200px]">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm text-muted-foreground">Lucro do período</p>
              {carregando ? (
                <div className="mt-1 h-7 w-28 animate-pulse rounded-md bg-muted" />
              ) : (
                <p
                  className={cn(
                    'text-xl font-semibold tabular-nums',
                    resumo.lucroLiquido >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400',
                  )}
                >
                  {mostrar(resumo.lucroLiquido)}
                </p>
              )}
              {!carregando && resumo.receitaTotal > 0 ? (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {valoresOcultos ? '—' : `${margem.toFixed(1)}% margem`}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onAlternarOcultos}
              aria-label={valoresOcultos ? 'Mostrar valores' : 'Ocultar valores'}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {valoresOcultos ? (
                <EyeOff className="h-4 w-4" strokeWidth={1.6} />
              ) : (
                <Eye className="h-4 w-4" strokeWidth={1.6} />
              )}
            </button>
          </div>
        </div>

        <div className="min-w-0 w-full md:max-w-[200px]">
          <p className="text-sm text-muted-foreground">Pedidos</p>
          {carregando ? (
            <div className="mt-1 h-7 w-24 animate-pulse rounded-md bg-muted" />
          ) : (
            <p className="text-xl font-semibold tabular-nums text-foreground">
              {valoresOcultos ? '••••' : resumo.pedidosCount}
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {valoresOcultos ? '' : `ticket ${formatarMoeda(resumo.ticketMedio)}`}
              </span>
            </p>
          )}
          {!carregando ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {valoresOcultos ? '—' : `${formatarMoeda(resumo.receitaPedidos)} em pedidos`}
              {resumo.receitaExtra > 0 && !valoresOcultos ? ` + ${formatarMoeda(resumo.receitaExtra)} extras` : ''}
            </p>
          ) : null}
        </div>

        <div className="min-w-0 w-full md:max-w-[180px]">
          <p className="text-sm text-muted-foreground">A receber</p>
          {carregando ? (
            <div className="mt-1 h-7 w-24 animate-pulse rounded-md bg-muted" />
          ) : (
            <p className="text-xl font-semibold tabular-nums text-foreground">{mostrar(resumo.aReceberTotal)}</p>
          )}
          {!carregando ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {resumo.crediarioCount + resumo.pedidosNaoPagosCount > 0
                ? `${resumo.crediarioCount + resumo.pedidosNaoPagosCount} contas`
                : 'Nada pendente'}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex w-full flex-col items-stretch gap-3 md:flex-row md:w-auto md:items-center">
        {receitaTrigger}
        {despesaTrigger}
      </div>
    </div>
  )
}
