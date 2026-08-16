'use client'

import { useMemo } from 'react'
import { Doughnut } from 'react-chartjs-2'
import type { ChartData, ChartOptions } from 'chart.js'
import { ensureChartJsRegistered } from '../lib/setup-chartjs'
import { formatarMoeda } from '../lib/formatadores'
import type { ComposicaoReceita } from '../types'

ensureChartJsRegistered()

interface GraficoComposicaoProps {
  dados: ComposicaoReceita[]
  total: number
  carregando?: boolean
}

export function GraficoComposicao({ dados, total, carregando }: GraficoComposicaoProps) {
  const temDados = dados.length > 0 && total > 0

  const chartData = useMemo<ChartData<'doughnut'>>(
    () => ({
      labels: dados.map((d) => d.nome),
      datasets: [
        {
          data: dados.map((d) => d.valor),
          backgroundColor: dados.map((d) => d.cor),
          borderColor: 'hsl(0, 0%, 100%)',
          borderWidth: 2,
          hoverOffset: 4,
        },
      ],
    }),
    [dados],
  )

  const options = useMemo<ChartOptions<'doughnut'>>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      cutout: '64%',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.label}: ${formatarMoeda(Number(ctx.parsed) || 0)}`,
          },
        },
      },
    }),
    [],
  )

  return (
    <div className="rounded-xl border border-border/70 bg-card p-5">
      <div className="mb-4">
        <h3 className="text-base font-semibold tracking-tight text-foreground">Receita por forma de pagamento</h3>
        <p className="text-sm text-muted-foreground">Distribuição dos pedidos no período.</p>
      </div>

      <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-[180px_1fr] xl:grid-cols-1">
        <div className="h-[180px]">
          {carregando ? (
            <div className="h-full w-full animate-pulse rounded-full bg-muted" />
          ) : !temDados ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-xs text-muted-foreground">Sem dados</p>
            </div>
          ) : (
            <Doughnut data={chartData} options={options} />
          )}
        </div>

        <ul className="space-y-2">
          {temDados ? (
            dados.map((item, index) => {
              const pct = total > 0 ? (item.valor / total) * 100 : 0
              return (
                <li key={`${item.nome}-${index}`} className="flex items-center justify-between gap-3 text-sm">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: item.cor }} aria-hidden />
                    <span className="truncate text-foreground">{item.nome}</span>
                  </div>
                  <div className="flex items-center gap-3 tabular-nums">
                    <span className="text-muted-foreground">{pct.toFixed(0)}%</span>
                    <span className="font-medium text-foreground">{formatarMoeda(item.valor)}</span>
                  </div>
                </li>
              )
            })
          ) : (
            <li className="text-xs text-muted-foreground">Lance pedidos pagos para popular esta visão.</li>
          )}
        </ul>
      </div>
    </div>
  )
}
