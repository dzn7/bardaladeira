'use client'

import { Doughnut } from 'react-chartjs-2'
import type { ChartData, ChartOptions } from 'chart.js'
import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { ensureChartJsRegistered } from '../lib/setup-chartjs'
import { formatarMoeda } from '../lib/formatadores'

ensureChartJsRegistered()

type TipoCard = 'incoming' | 'outcoming'

interface CardRadialFinancasProps {
  titulo: string
  descricao: string
  parcial: number
  total: number
  tipo: TipoCard
  carregando?: boolean
  valoresOcultos?: boolean
}

const rotulos = {
  incoming: {
    parcial: 'Recebido até o momento',
    falta: 'Ainda falta',
    total: 'Valor Total a receber',
    centro: 'Recebido',
    cor: 'hsl(142, 76%, 36%)',
  },
    outcoming: {
      parcial: 'Pago até o momento',
      falta: 'Ainda falta',
      total: 'Valor Total a pagar',
      centro: 'Pago',
      cor: 'hsl(348, 76%, 36%)',
    },
}

export function CardRadialFinancas({
  titulo,
  descricao,
  parcial,
  total,
  tipo,
  carregando,
  valoresOcultos,
}: CardRadialFinancasProps) {
  const cfg = rotulos[tipo]
  const falta = Math.max(total - parcial, 0)
  const pct = total > 0 ? Math.min((parcial / total) * 100, 100) : 0
  const restante = Math.max(100 - pct, 0)
  const mostrar = (v: number) => (valoresOcultos ? '••••••' : formatarMoeda(v))

  const chartData = useMemo<ChartData<'doughnut'>>(
    () => ({
      labels: [cfg.centro, 'Restante'],
      datasets: [
        {
          data: total > 0 ? [pct, restante] : [0, 100],
          backgroundColor: [cfg.cor, 'hsl(210, 40%, 80%)'],
          borderWidth: 0,
          hoverOffset: 2,
        },
      ],
    }),
    [cfg.centro, cfg.cor, pct, restante, total],
  )

  const options = useMemo<ChartOptions<'doughnut'>>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      cutout: '72%',
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
      },
    }),
    [],
  )

  return (
    <div className="w-full overflow-hidden rounded-xl border border-border/70 bg-card">
      <div className="flex flex-col gap-4 p-4 xl:flex-row xl:justify-between">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-foreground">{titulo}</h3>
            <p className="text-sm text-muted-foreground">{descricao}</p>
          </div>

          {carregando ? (
            <div className="space-y-2">
              <div className="h-16 animate-pulse rounded-lg bg-muted" />
              <div className="h-16 animate-pulse rounded-lg bg-muted" />
              <div className="h-14 animate-pulse rounded-lg bg-muted" />
            </div>
          ) : (
            <div className="flex flex-col gap-2 pt-1">
              <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-1 dark:border-green-800 dark:bg-green-950/20">
                <p className="flex items-center gap-2 text-sm font-medium text-green-700 dark:text-green-300">
                  <span className="h-2 w-2 rounded-full bg-green-500" />
                  {cfg.parcial}
                </p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-green-800 dark:text-green-200">
                  {mostrar(parcial)}
                </p>
              </div>

              <div className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-1 dark:border-orange-800 dark:bg-orange-950/20">
                <p className="flex items-center gap-2 text-sm font-medium text-orange-700 dark:text-orange-300">
                  <span className="h-2 w-2 rounded-full bg-orange-500" />
                  {cfg.falta}
                </p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-orange-800 dark:text-orange-200">
                  {mostrar(falta)}
                </p>
              </div>

              <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1 dark:border-blue-800 dark:bg-blue-950/20">
                <p className="flex items-center gap-2 text-sm font-medium text-blue-700 dark:text-blue-300">
                  <span className="h-2 w-2 rounded-full bg-blue-500" />
                  {cfg.total}
                </p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-blue-800 dark:text-blue-200">
                  {mostrar(total)}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="relative flex h-56 w-full shrink-0 items-center justify-center xl:h-auto xl:w-64">
          {carregando ? (
            <div className="h-44 w-44 animate-pulse rounded-full bg-muted" />
          ) : (
            <>
              <div className="h-44 w-44">
                <Doughnut data={chartData} options={options} />
              </div>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <p className={cn('text-base font-bold tabular-nums text-foreground')}>{mostrar(parcial)}</p>
                <p className="text-xs text-muted-foreground">{cfg.centro}</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
