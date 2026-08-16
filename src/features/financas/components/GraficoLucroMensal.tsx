'use client'

import { useMemo } from 'react'
import { Bar } from 'react-chartjs-2'
import type { ChartData, ChartOptions } from 'chart.js'
import { ensureChartJsRegistered } from '../lib/setup-chartjs'
import { CORES_GRAFICOS, formatarMoeda, formatarMoedaCompacta } from '../lib/formatadores'
import type { ResumoMensal } from '../types'

ensureChartJsRegistered()

interface GraficoLucroMensalProps {
  dados: ResumoMensal[]
  carregando?: boolean
}

export function GraficoLucroMensal({ dados, carregando }: GraficoLucroMensalProps) {
  const totalLucro = useMemo(() => dados.reduce((acc, d) => acc + d.lucro, 0), [dados])
  const sempreVazio = dados.every((d) => d.receita === 0 && d.despesa === 0)

  const chartData = useMemo<ChartData<'bar'>>(
    () => ({
      labels: dados.map((d) => d.rotulo),
      datasets: [
        {
          label: 'Lucro',
          data: dados.map((d) => d.lucro),
          backgroundColor: dados.map((d) => (d.lucro >= 0 ? CORES_GRAFICOS.lucro : CORES_GRAFICOS.lucroNeg)),
          borderRadius: 6,
          maxBarThickness: 36,
        },
      ],
    }),
    [dados],
  )

  const options = useMemo<ChartOptions<'bar'>>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const item = dados[ctx.dataIndex]
              if (!item) return formatarMoeda(Number(ctx.parsed.y) || 0)
              return [
                `Lucro: ${formatarMoeda(item.lucro)}`,
                `Receita: ${formatarMoeda(item.receita)}`,
                `Despesa: ${formatarMoeda(item.despesa)}`,
                `${item.pedidos} pedidos`,
              ]
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: 'hsl(220, 10%, 45%)', font: { size: 11 } },
        },
        y: {
          grid: { color: 'hsla(220, 14%, 70%, 0.18)' },
          ticks: {
            color: 'hsl(220, 10%, 45%)',
            font: { size: 11 },
            callback: (value) => formatarMoedaCompacta(Number(value)),
          },
        },
      },
    }),
    [dados],
  )

  return (
    <div className="rounded-xl border border-border/70 bg-card p-5">
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-base font-semibold tracking-tight text-foreground">Lucro mensal</h3>
          <p className="text-sm text-muted-foreground">12 meses encerrando no período selecionado.</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Acumulado</p>
          <p className="text-lg font-semibold tabular-nums text-foreground">{formatarMoeda(totalLucro)}</p>
        </div>
      </div>

      <div className="h-[260px]">
        {carregando ? (
          <div className="h-full w-full animate-pulse rounded-lg bg-muted" />
        ) : sempreVazio ? (
          <div className="flex h-full flex-col items-center justify-center gap-1">
            <p className="text-sm font-medium text-foreground">Ainda sem histórico</p>
            <p className="text-xs text-muted-foreground">Os meses anteriores aparecem assim que houver dados.</p>
          </div>
        ) : (
          <Bar data={chartData} options={options} />
        )}
      </div>
    </div>
  )
}
