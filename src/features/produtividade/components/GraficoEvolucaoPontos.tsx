'use client'

import { useMemo } from 'react'
import { Line } from 'react-chartjs-2'
import type { ChartData, ChartOptions } from 'chart.js'
import { LineChart } from 'lucide-react'
import { ListaVazia } from '@/components/admin/filtros/ListaEstado'
import { Skeleton } from '@/components/ui/skeleton'
import { ensureChartJsRegistered } from '@/features/financas/lib/setup-chartjs'
import { formatarPontos, rotularDia } from '../lib/periodo'
import type { GarcomProdutividade, PontoSerieProdutividade } from '../types'

ensureChartJsRegistered()

type Props = {
  serie: PontoSerieProdutividade[]
  /** Fallback: um período de um dia só não desenha evolução nenhuma. */
  serieMes: PontoSerieProdutividade[]
  garcons: GarcomProdutividade[]
  carregando: boolean
}

const PALETA = [
  'hsl(202, 97%, 49%)',
  'hsl(160, 84%, 39%)',
  'hsl(38, 92%, 50%)',
  'hsl(347, 77%, 50%)',
  'hsl(262, 83%, 58%)',
  'hsl(199, 89%, 48%)',
  'hsl(24, 95%, 53%)',
  'hsl(142, 71%, 45%)',
]

export function GraficoEvolucaoPontos({ serie, serieMes, garcons, carregando }: Props) {
  const { dias, series, usandoFallback } = useMemo(() => {
    const diasDoPeriodo = new Set(serie.map((ponto) => ponto.dia))
    // Com um único dia não há evolução para desenhar: caímos no mês corrente,
    // que já vem carregado para as metas (nenhuma requisição extra).
    const fallback = diasDoPeriodo.size < 2 && serieMes.length > 0
    const fonte = fallback ? serieMes : serie

    const diasUnicos = Array.from(new Set(fonte.map((ponto) => ponto.dia))).sort()
    const nomePorId = new Map(garcons.map((garcom) => [garcom.garcomId, garcom.nome]))

    const pontosPorGarcom = new Map<string, Map<string, number>>()
    for (const ponto of fonte) {
      if (!pontosPorGarcom.has(ponto.garcomId)) pontosPorGarcom.set(ponto.garcomId, new Map())
      pontosPorGarcom.get(ponto.garcomId)!.set(ponto.dia, ponto.pontos)
    }

    const seriesOrdenadas = Array.from(pontosPorGarcom.entries())
      .map(([garcomId, porDia]) => ({
        garcomId,
        nome: nomePorId.get(garcomId) ?? 'Sem vínculo atual',
        total: Array.from(porDia.values()).reduce((soma, valor) => soma + valor, 0),
        porDia,
      }))
      .sort((a, b) => b.total - a.total)

    return { dias: diasUnicos, series: seriesOrdenadas, usandoFallback: fallback }
  }, [serie, serieMes, garcons])

  const chartData = useMemo<ChartData<'line'>>(
    () => ({
      labels: dias.map(rotularDia),
      datasets: series.map((item, indice) => {
        const cor = PALETA[indice % PALETA.length]
        return {
          label: item.nome,
          data: dias.map((dia) => item.porDia.get(dia) ?? 0),
          borderColor: cor,
          backgroundColor: cor,
          borderWidth: 2,
          pointRadius: dias.length > 20 ? 0 : 3,
          pointHoverRadius: 5,
          tension: 0.3,
        }
      }),
    }),
    [dias, series],
  )

  const options = useMemo<ChartOptions<'line'>>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index' as const, intersect: false },
      plugins: {
        legend: {
          position: 'bottom' as const,
          labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true, font: { size: 11 } },
        },
        tooltip: {
          callbacks: {
            label: (contexto) =>
              `${contexto.dataset.label}: ${formatarPontos(Number(contexto.parsed.y) || 0)} pts`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: 'hsl(220, 10%, 45%)',
            font: { size: 11 },
            maxRotation: 0,
            autoSkipPadding: 16,
          },
        },
        y: {
          grid: { color: 'hsla(220, 14%, 70%, 0.18)' },
          ticks: { color: 'hsl(220, 10%, 45%)', font: { size: 11 } },
        },
      },
    }),
    [],
  )

  return (
    <section className="rounded-xl border border-border/70 bg-card p-4 shadow-sm md:p-5">
      <div className="mb-4">
        <h2 className="text-sm font-medium text-foreground">Evolução dos pontos</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {usandoFallback
            ? 'Mês corrente — um dia sozinho não forma evolução. Escolha Semana ou Mês para seguir o filtro.'
            : 'Pontos por dia operacional (03h às 03h), um traço por garçom.'}
        </p>
      </div>

      {carregando ? (
        <Skeleton className="h-[280px] w-full rounded-lg" />
      ) : dias.length === 0 ? (
        <ListaVazia
          icone={<LineChart className="h-5 w-5" />}
          titulo="Sem histórico no período"
          descricao="Escolha um período maior ou aguarde a movimentação do dia."
        />
      ) : (
        <div className="h-[300px]">
          <Line data={chartData} options={options} />
        </div>
      )}
    </section>
  )
}
