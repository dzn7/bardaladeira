'use client'

import type { GarcomDia } from '../../types'
import { formatarMoeda } from '../../lib/formatadores'

type RelatorioEquipeProps = {
  equipe: GarcomDia[]
}

export const RelatorioEquipe = ({ equipe }: RelatorioEquipeProps) => {
  if (!equipe.length) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Nenhum pedido com garçom/PDV identificado neste dia.
      </p>
    )
  }

  return (
    <div className="divide-y divide-border/50">
      {equipe.map((item, index) => (
        <div key={item.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">
              {index + 1}. {item.nome}
            </p>
            <p className="text-xs text-muted-foreground">
              {item.quantidade} {item.quantidade === 1 ? 'pedido' : 'pedidos'}
            </p>
          </div>
          <p className="shrink-0 text-sm font-semibold tabular-nums">{formatarMoeda(item.faturamento)}</p>
        </div>
      ))}
    </div>
  )
}
