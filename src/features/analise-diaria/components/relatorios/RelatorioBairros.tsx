'use client'

import type { BairroEntrega } from '../../types'
import { formatarMoeda } from '../../lib/formatadores'

type RelatorioBairrosProps = {
  bairros: BairroEntrega[]
}

export const RelatorioBairros = ({ bairros }: RelatorioBairrosProps) => {
  if (!bairros.length) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma entrega por bairro neste dia.</p>
  }

  return (
    <div className="divide-y divide-border/50">
      {bairros.map((item, index) => (
        <div key={item.bairro} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">
              {index + 1}. {item.bairro}
            </p>
            <p className="text-xs text-muted-foreground">
              {item.quantidade} {item.quantidade === 1 ? 'entrega' : 'entregas'}
            </p>
          </div>
          <p className="shrink-0 text-sm font-semibold tabular-nums">{formatarMoeda(item.taxaTotal)}</p>
        </div>
      ))}
    </div>
  )
}
