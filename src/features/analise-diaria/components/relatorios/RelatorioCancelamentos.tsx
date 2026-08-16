'use client'

import type { CancelamentosDia } from '../../types'
import { formatarMoeda } from '../../lib/formatadores'

type RelatorioCancelamentosProps = {
  cancelamentos: CancelamentosDia
}

export const RelatorioCancelamentos = ({ cancelamentos }: RelatorioCancelamentosProps) => {
  if (cancelamentos.quantidade === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Nenhum cancelamento neste dia.</p>
  }

  return (
    <div className="flex flex-wrap gap-x-8 gap-y-3">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Quantidade</p>
        <p className="mt-0.5 text-xl font-semibold tabular-nums text-foreground">{cancelamentos.quantidade}</p>
      </div>
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Valor perdido</p>
        <p className="mt-0.5 text-xl font-semibold tabular-nums text-destructive">
          {formatarMoeda(cancelamentos.valorPerdido)}
        </p>
      </div>
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">% sobre bruto</p>
        <p className="mt-0.5 text-xl font-semibold tabular-nums text-foreground">
          {cancelamentos.percentualSobreBruto.toFixed(1)}%
        </p>
      </div>
    </div>
  )
}
