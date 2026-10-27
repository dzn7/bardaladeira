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
    total: 'Total a receber',
    centro: 'Recebido',
    cor: 'hsl(142, 76%, 36%)',
  },
    outcoming: {
      parcial: 'Pago até o momento',
      falta: 'Ainda falta',
      total: 'Total a pagar',
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
            <h3 className="text-base font-semibold text-foreground">{titulo}</h3>
            <p className="text-sm text-muted-foreground">{descricao}</p>
          </div>

          {carregando ? (
            <div className="space-y-2">
              <div className="h-9 animate-pulse rounded-lg bg-muted" />
              <div className="h-9 animate-pulse rounded-lg bg-muted" />
              <div className="h-9 animate-pulse rounded-lg bg-muted" />
            </div>
          ) : (
            <dl className="divide-y divide-border/70">
              {[
                { rotulo: cfg.parcial, valor: parcial, ponto: 'bg-emerald-500' },
                { rotulo: cfg.falta, valor: falta, ponto: 'bg-amber-500' },
                { rotulo: cfg.total, valor: total, ponto: 'bg-muted-foreground/40' },
              ].map((linha) => (
                <div key={linha.rotulo} className="flex items-center justify-between gap-3 py-2.5">
                  <dt className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className={cn('size-2 rounded-full', linha.ponto)} aria-hidden />
                    {linha.rotulo}
                  </dt>
                  <dd className="text-base font-semibold tabular-nums text-foreground">{mostrar(linha.valor)}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        <div className="relative flex h-48 w-full shrink-0 items-center justify-center xl:h-auto xl:w-56">
          {carregando ? (
            <div className="size-40 animate-pulse rounded-full bg-muted" />
          ) : (
            <>
              <div className="size-40">
                <Doughnut data={chartData} options={options} />
              </div>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-base font-semibold tabular-nums text-foreground">{mostrar(parcial)}</p>
                <p className="text-xs text-muted-foreground">{cfg.centro}</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
