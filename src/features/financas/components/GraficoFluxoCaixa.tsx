'use client'

import { useMemo } from 'react'
import { Line } from 'react-chartjs-2'
import type { ChartData, ChartOptions } from 'chart.js'
import { ensureChartJsRegistered } from '../lib/setup-chartjs'
import { CORES_GRAFICOS, formatarMoeda, formatarMoedaCompacta } from '../lib/formatadores'
import type { PontoFluxoCaixa } from '../types'

ensureChartJsRegistered()

interface GraficoFluxoCaixaProps {
  dados: PontoFluxoCaixa[]
  carregando?: boolean
}

export function GraficoFluxoCaixa({ dados, carregando }: GraficoFluxoCaixaProps) {
  const sempreVazio = useMemo(() => dados.every((d) => d.receita === 0 && d.despesa === 0), [dados])

  const chartData = useMemo<ChartData<'line'>>(
    () => ({
      labels: dados.map((d) => d.rotulo),
      datasets: [
        {
          label: 'Receita',
          data: dados.map((d) => d.receita),
          borderColor: CORES_GRAFICOS.receita,
          backgroundColor: CORES_GRAFICOS.receitaArea,
          fill: true,
          tension: 0.35,
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
        },
        {
          label: 'Despesa',
          data: dados.map((d) => d.despesa),
          borderColor: CORES_GRAFICOS.despesa,
          backgroundColor: CORES_GRAFICOS.despesaArea,
          fill: true,
          tension: 0.35,
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
        },
        {
          label: 'Lucro',
          data: dados.map((d) => d.lucro),
          borderColor: CORES_GRAFICOS.lucro,
          backgroundColor: 'transparent',
          fill: false,
          tension: 0.35,
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
          borderDash: [4, 4],
        },
      ],
    }),
    [dados],
  )

  const options = useMemo<ChartOptions<'line'>>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            usePointStyle: true,
            pointStyle: 'circle',
            padding: 12,
            color: 'hsl(220, 10%, 45%)',
            font: { size: 11 },
          },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${formatarMoeda(Number(ctx.parsed.y) || 0)}`,
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
    [],
  )

  return (
    <div className="rounded-xl border border-border/70 bg-card p-5">
      <div className="mb-4">
        <h3 className="text-base font-semibold tracking-tight text-foreground">Fluxo de caixa</h3>
        <p className="text-sm text-muted-foreground">Receita, despesa e lucro ao longo do período.</p>
      </div>

      <div className="h-[280px]">
        {carregando ? (
          <div className="h-full w-full animate-pulse rounded-lg bg-muted" />
        ) : sempreVazio ? (
          <div className="flex h-full flex-col items-center justify-center gap-1 text-center">
            <p className="text-sm font-medium text-foreground">Sem movimentação no período</p>
            <p className="text-xs text-muted-foreground">Lance receitas e despesas para ver o fluxo aqui.</p>
          </div>
        ) : (
          <Line data={chartData} options={options} />
        )}
      </div>
    </div>
  )
}
