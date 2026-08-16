'use client'

import { ArrowDown, ArrowUp, Minus } from 'lucide-react'
import type { ComparativoDia } from '../../types'
import { formatarMoeda } from '../../lib/formatadores'

type RelatorioComparativoProps = {
  atual: { faturamento: number; pedidos: number; ticketMedio: number }
  comparativo: ComparativoDia
}

const ChipVariacao = ({ valor }: { valor: number }) => {
  if (valor === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
        <Minus className="h-3 w-3" strokeWidth={1.6} />
        0%
      </span>
    )
  }
  if (valor > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-medium text-emerald-600">
        <ArrowUp className="h-3 w-3" strokeWidth={1.6} />
        {valor.toFixed(1)}%
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-xs font-medium text-destructive">
      <ArrowDown className="h-3 w-3" strokeWidth={1.6} />
      {Math.abs(valor).toFixed(1)}%
    </span>
  )
}

export const RelatorioComparativo = ({ atual, comparativo }: RelatorioComparativoProps) => {
  const linhas = [
    {
      metrica: 'Faturamento',
      atual: formatarMoeda(atual.faturamento),
      ontem: formatarMoeda(comparativo.ontem.faturamento),
      semana: formatarMoeda(comparativo.semanaPassada.faturamento),
      varOntem: comparativo.variacaoOntem.faturamento,
      varSemana: comparativo.variacaoSemana.faturamento,
    },
    {
      metrica: 'Pedidos',
      atual: String(atual.pedidos),
      ontem: String(comparativo.ontem.pedidos),
      semana: String(comparativo.semanaPassada.pedidos),
      varOntem: comparativo.variacaoOntem.pedidos,
      varSemana: comparativo.variacaoSemana.pedidos,
    },
    {
      metrica: 'Ticket médio',
      atual: formatarMoeda(atual.ticketMedio),
      ontem: formatarMoeda(comparativo.ontem.ticketMedio),
      semana: formatarMoeda(comparativo.semanaPassada.ticketMedio),
      varOntem: comparativo.variacaoOntem.ticketMedio,
      varSemana: comparativo.variacaoSemana.ticketMedio,
    },
  ]

  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 text-left text-xs text-muted-foreground">
              <th className="pb-2 font-medium">Métrica</th>
              <th className="pb-2 text-right font-medium">Dia</th>
              <th className="pb-2 text-right font-medium">Ontem</th>
              <th className="pb-2 text-right font-medium">Δ Ontem</th>
              <th className="pb-2 text-right font-medium">Mesmo dia −7</th>
              <th className="pb-2 text-right font-medium">Δ Semana</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((linha) => (
              <tr key={linha.metrica} className="border-b border-border/40 last:border-0">
                <td className="py-2.5 font-medium text-foreground">{linha.metrica}</td>
                <td className="py-2.5 text-right tabular-nums text-foreground">{linha.atual}</td>
                <td className="py-2.5 text-right tabular-nums text-muted-foreground">{linha.ontem}</td>
                <td className="py-2.5 text-right">
                  <ChipVariacao valor={linha.varOntem} />
                </td>
                <td className="py-2.5 text-right tabular-nums text-muted-foreground">{linha.semana}</td>
                <td className="py-2.5 text-right">
                  <ChipVariacao valor={linha.varSemana} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-3 md:hidden">
        {linhas.map((linha) => (
          <div key={linha.metrica} className="rounded-lg border border-border/60 bg-muted/20 p-3">
            <p className="text-sm font-medium text-foreground">{linha.metrica}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{linha.atual}</p>
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                Ontem {linha.ontem} <ChipVariacao valor={linha.varOntem} />
              </span>
              <span className="inline-flex items-center gap-1">
                −7d {linha.semana} <ChipVariacao valor={linha.varSemana} />
              </span>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
