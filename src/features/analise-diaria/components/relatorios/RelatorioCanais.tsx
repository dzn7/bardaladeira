'use client'

import { Package, Store, Truck } from 'lucide-react'
import type { DadosDiarios } from '../../types'
import { formatarMoeda } from '../../lib/formatadores'

type RelatorioCanaisProps = {
  dados: DadosDiarios
}

export const RelatorioCanais = ({ dados }: RelatorioCanaisProps) => {
  const canais = [
    {
      label: 'Entregas',
      icone: Truck,
      quantidade: dados.pedidosPorTipo.entregas.quantidade,
      total: dados.pedidosPorTipo.entregas.total,
    },
    {
      label: 'Retiradas',
      icone: Package,
      quantidade: dados.pedidosPorTipo.retiradas.quantidade,
      total: dados.pedidosPorTipo.retiradas.total,
    },
    {
      label: 'No local',
      icone: Store,
      quantidade: dados.pedidosPorTipo.local.quantidade,
      total: dados.pedidosPorTipo.local.total,
    },
  ]

  const totalPedidos = canais.reduce((s, c) => s + c.quantidade, 0) || 1

  return (
    <div className="divide-y divide-border/50">
      {canais.map((tipo) => {
        const Icone = tipo.icone
        const pct = (tipo.quantidade / totalPedidos) * 100
        return (
          <div key={tipo.label} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
            <div className="flex min-w-0 items-center gap-2.5">
              <Icone className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.6} />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{tipo.label}</p>
                <p className="text-[11px] text-muted-foreground">{pct.toFixed(0)}% dos pedidos</p>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-sm font-semibold tabular-nums text-foreground">{tipo.quantidade}</p>
              <p className="text-[11px] tabular-nums text-muted-foreground">{formatarMoeda(tipo.total)}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
