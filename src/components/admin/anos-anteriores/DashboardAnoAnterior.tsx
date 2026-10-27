'use client'

import { CurrencyDollar as DollarSign, ShoppingCart, TrendUp as TrendingUp, Truck, Storefront as Store, Package } from '@phosphor-icons/react'
import CartaoEstatistica from './CartaoEstatistica'
import { Cartao, Lista, Secao } from '@/components/admin/ui'
import { cn } from '@/lib/utils'
import type { EstatisticasAnuais, RelatorioEntregasPorBairro } from '@/lib/tipos-anos-anteriores'

type DashboardAnoAnteriorProps = {
  estatisticas: EstatisticasAnuais
  entregasPorBairro: RelatorioEntregasPorBairro[]
  ano: number
}

const formatarMoeda = (valor: number): string => {
  return valor.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

export default function DashboardAnoAnterior({
  estatisticas,
  entregasPorBairro,
  ano
}: DashboardAnoAnteriorProps) {
  const kpis = [
    { titulo: 'Vendas', valor: `R$ ${formatarMoeda(estatisticas.receitaTotal)}`, icone: DollarSign },
    { titulo: 'Pedidos', valor: estatisticas.totalPedidos, icone: ShoppingCart },
    { titulo: 'Ticket médio', valor: `R$ ${formatarMoeda(estatisticas.ticketMedio)}`, icone: TrendingUp },
    {
      titulo: 'Entregas feitas',
      valor: estatisticas.totalEntregas,
      subtitulo: `R$ ${formatarMoeda(estatisticas.totalTaxasEntrega)} em taxas`,
      icone: Truck,
    },
  ]

  const tipos = [
    { rotulo: 'Entregas', icone: Truck, quantidade: estatisticas.pedidosEntrega, total: estatisticas.receitaEntrega },
    { rotulo: 'Retiradas', icone: Package, quantidade: estatisticas.pedidosRetirada, total: estatisticas.receitaRetirada },
    { rotulo: 'No local', icone: Store, quantidade: estatisticas.pedidosLocal, total: estatisticas.receitaLocal },
  ]

  return (
    <div className="space-y-5">
      <Cartao className="grid grid-cols-2 md:grid-cols-4">
        {kpis.map((kpi, indice) => (
          <CartaoEstatistica
            key={kpi.titulo}
            titulo={kpi.titulo}
            valor={kpi.valor}
            subtitulo={kpi.subtitulo}
            icone={kpi.icone}
            className={cn(
              indice % 2 === 1 && 'border-l border-border/70',
              indice >= 2 && 'border-t border-border/70 md:border-t-0',
              indice === 2 && 'md:border-l',
            )}
          />
        ))}
      </Cartao>

      <Secao titulo={`Pedidos por tipo em ${ano}`}>
        <Lista>
          {tipos.map((tipo) => {
            const Icone = tipo.icone
            return (
              <li key={tipo.rotulo} className="flex min-h-12 items-center gap-3 px-4 py-2.5">
                <Icone className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{tipo.rotulo}</span>
                <span className="shrink-0 text-sm tabular-nums text-muted-foreground">{tipo.quantidade}</span>
                <span className="w-28 shrink-0 text-right text-sm font-semibold tabular-nums text-foreground">
                  R$ {formatarMoeda(tipo.total)}
                </span>
              </li>
            )
          })}
        </Lista>
      </Secao>

      {entregasPorBairro.length > 0 && (
        <Secao titulo={`Bairros com mais entregas em ${ano}`}>
          <Lista>
            {entregasPorBairro.slice(0, 6).map((bairro, index) => (
              <li key={bairro.bairro} className="flex min-h-12 items-center gap-3 px-4 py-2.5">
                <span className="w-5 shrink-0 text-right text-sm tabular-nums text-muted-foreground">{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{bairro.bairro}</p>
                  <p className="text-[13px] tabular-nums text-muted-foreground">
                    R$ {formatarMoeda(bairro.taxaTotal)} em taxas
                  </p>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                  {bairro.quantidade} {bairro.quantidade === 1 ? 'entrega' : 'entregas'}
                </span>
              </li>
            ))}
          </Lista>
        </Secao>
      )}
    </div>
  )
}
