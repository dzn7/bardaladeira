'use client'

import type { FiadoDia } from '../../types'
import { formatarMoeda } from '../../lib/formatadores'

type RelatorioFiadoProps = {
  fiado: FiadoDia
}

export const RelatorioFiado = ({ fiado }: RelatorioFiadoProps) => {
  if (fiado.quantidadePedidos === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Nenhum fiado lançado neste dia.</p>
  }

  return (
    <div className="flex flex-wrap gap-x-8 gap-y-3">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Valor fiado</p>
        <p className="mt-0.5 text-xl font-semibold tabular-nums text-foreground">{formatarMoeda(fiado.valor)}</p>
      </div>
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Pedidos no fiado</p>
        <p className="mt-0.5 text-xl font-semibold tabular-nums text-foreground">{fiado.quantidadePedidos}</p>
      </div>
    </div>
  )
}
