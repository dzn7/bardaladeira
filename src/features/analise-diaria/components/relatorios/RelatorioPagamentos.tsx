'use client'

import { useMemo } from 'react'
import { Wallet } from 'lucide-react'
import { Doughnut } from 'react-chartjs-2'
import { FORMAS_PAGAMENTO_CONFIG } from '../../types'
import type { PagamentoResumo } from '../../types'
import { formatarMoeda } from '../../lib/formatadores'

type RelatorioPagamentosProps = {
  pagamentos: PagamentoResumo[]
}

export const RelatorioPagamentos = ({ pagamentos }: RelatorioPagamentosProps) => {
  const dadosGrafico = useMemo(() => {
    if (!pagamentos.length) return null
    return {
      labels: pagamentos.map((p) => FORMAS_PAGAMENTO_CONFIG[p.forma]?.nome || p.forma),
      datasets: [
        {
          data: pagamentos.map((p) => p.total),
          backgroundColor: pagamentos.map(
            (p) => FORMAS_PAGAMENTO_CONFIG[p.forma]?.chartCor || 'rgba(156, 163, 175, 0.7)',
          ),
          borderWidth: 0,
        },
      ],
    }
  }, [pagamentos])

  if (!pagamentos.length) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Nenhum pagamento neste dia.</p>
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="h-44">
        {dadosGrafico ? (
          <Doughnut
            data={dadosGrafico}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { display: false } },
            }}
          />
        ) : null}
      </div>
      <div className="divide-y divide-border/50">
        {pagamentos.map((pag) => {
          const config = FORMAS_PAGAMENTO_CONFIG[pag.forma]
          const Icone = config?.icone || Wallet
          return (
            <div key={pag.forma} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
              <div className="flex items-center gap-2">
                <Icone className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.6} />
                <span className="text-xs font-medium text-foreground">{config?.nome || pag.forma}</span>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold tabular-nums text-foreground">{formatarMoeda(pag.total)}</p>
                <p className="text-[10px] text-muted-foreground">{pag.quantidade} lançamentos</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
