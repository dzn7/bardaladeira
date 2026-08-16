'use client'

import { useMemo } from 'react'
import { Bar } from 'react-chartjs-2'
import type { ChartData, ChartOptions } from 'chart.js'
import { BarChart3 } from 'lucide-react'
import { ListaVazia } from '@/components/admin/filtros/ListaEstado'
import { Skeleton } from '@/components/ui/skeleton'
import { ensureChartJsRegistered } from '@/features/financas/lib/setup-chartjs'
import { formatarPontos } from '../lib/periodo'
import type { GarcomProdutividade } from '../types'

ensureChartJsRegistered()

type Props = {
  garcons: GarcomProdutividade[]
  carregando: boolean
}

const COR_GANHOS = 'hsl(202, 97%, 49%)'
const COR_PERDAS = 'hsl(347, 77%, 50%)'

export function GraficoPontosGarcom({ garcons, carregando }: Props) {
  const dados = useMemo(
    () =>
      garcons
        .filter((garcom) => garcom.pontosPositivos > 0 || garcom.pontosNegativos > 0)
        .sort((a, b) => b.pontos - a.pontos),
    [garcons],
  )

  const chartData = useMemo<ChartData<'bar'>>(
    () => ({
      labels: dados.map((garcom) => garcom.nome),
      datasets: [
        {
          label: 'Pontos ganhos',
          data: dados.map((garcom) => garcom.pontosPositivos),
          backgroundColor: COR_GANHOS,
          borderRadius: 4,
          maxBarThickness: 22,
        },
        {
          label: 'Pontos perdidos',
          data: dados.map((garcom) => -garcom.pontosNegativos),
          backgroundColor: COR_PERDAS,
          borderRadius: 4,
          maxBarThickness: 22,
        },
      ],
    }),
    [dados],
  )

  const options = useMemo<ChartOptions<'bar'>>(
    () => ({
      indexAxis: 'y' as const,
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom' as const,
          labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true, font: { size: 11 } },
        },
        tooltip: {
          callbacks: {
            label: (contexto) => {
              const garcom = dados[contexto.dataIndex]
              const valor = Math.abs(Number(contexto.parsed.x) || 0)
              if (contexto.datasetIndex === 1 && garcom) {
                return `Perdidos: ${formatarPontos(valor)} pts (${garcom.ocorrenciasNome + garcom.ocorrenciasContato} ocorrências)`
              }
              return `Ganhos: ${formatarPontos(valor)} pts`
            },
            footer: (itens) => {
              const garcom = dados[itens[0]?.dataIndex ?? -1]
              return garcom ? `Saldo: ${formatarPontos(garcom.pontos)} pts` : ''
            },
          },
        },
      },
      scales: {
        x: {
          stacked: true,
          grid: { color: 'hsla(220, 14%, 70%, 0.18)' },
          ticks: { color: 'hsl(220, 10%, 45%)', font: { size: 11 } },
        },
        y: {
          stacked: true,
          grid: { display: false },
          ticks: { color: 'hsl(220, 10%, 45%)', font: { size: 11 } },
        },
      },
    }),
    [dados],
  )

  return (
    <section className="rounded-xl border border-border/70 bg-card p-4 shadow-sm md:p-5">
      <div className="mb-4">
        <h2 className="text-sm font-medium text-foreground">Ganhos e perdas por garçom</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Barra azul é o que somou; a vermelha é o que as falhas de cadastro descontaram.
        </p>
      </div>

      {carregando ? (
        <Skeleton className="h-[280px] w-full rounded-lg" />
      ) : dados.length === 0 ? (
        <ListaVazia
          icone={<BarChart3 className="h-5 w-5" />}
          titulo="Sem pontuação no período"
          descricao="Nenhum garçom registrou pedidos ou itens nesta janela."
        />
      ) : (
        <div style={{ height: Math.max(dados.length * 46 + 60, 200) }}>
          <Bar data={chartData} options={options} />
        </div>
      )}
    </section>
  )
}
