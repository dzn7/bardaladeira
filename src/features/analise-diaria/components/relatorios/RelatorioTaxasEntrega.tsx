'use client'

import type { TaxasEntregaDia } from '../../types'
import { formatarMoeda } from '../../lib/formatadores'

type RelatorioTaxasEntregaProps = {
  taxas: TaxasEntregaDia
}

export const RelatorioTaxasEntrega = ({ taxas }: RelatorioTaxasEntregaProps) => {
  if (taxas.quantidadeEntregas === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma entrega neste dia.</p>
  }

  return (
    <div className="flex flex-wrap gap-x-8 gap-y-3">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Total em taxas</p>
        <p className="mt-0.5 text-xl font-semibold tabular-nums text-foreground">{formatarMoeda(taxas.totalTaxas)}</p>
      </div>
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Entregas</p>
        <p className="mt-0.5 text-xl font-semibold tabular-nums text-foreground">{taxas.quantidadeEntregas}</p>
      </div>
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Média / entrega</p>
        <p className="mt-0.5 text-xl font-semibold tabular-nums text-foreground">
          {formatarMoeda(taxas.mediaPorEntrega)}
        </p>
      </div>
    </div>
  )
}
