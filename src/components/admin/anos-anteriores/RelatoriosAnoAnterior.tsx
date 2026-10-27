'use client'

import { Money as Banknote, CreditCard, DeviceMobile as Smartphone, Wallet } from '@phosphor-icons/react'
import { Cartao, ListaVazia, Secao } from '@/components/admin/ui'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'
import { Bar, Line, Doughnut } from 'react-chartjs-2'
import type {
  RelatorioVendasPorDia,
  RelatorioProdutosMaisVendidos,
  RelatorioVendasPorCategoria,
  RelatorioHorariosPico,
  RelatorioFaturamentoPagamento
} from '@/lib/tipos-anos-anteriores'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

type RelatoriosAnoAnteriorProps = {
  vendasPorDia: RelatorioVendasPorDia[]
  produtosMaisVendidos: RelatorioProdutosMaisVendidos[]
  vendasPorCategoria: RelatorioVendasPorCategoria[]
  horariosPico: RelatorioHorariosPico[]
  faturamentoPorPagamento: RelatorioFaturamentoPagamento[]
  ano: number
}

const formatarMoeda = (valor: number): string => {
  return valor.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

const CORES_PAGAMENTO: Record<string, { cor: string; icone: typeof Banknote }> = {
  'Dinheiro': { cor: 'rgba(34, 197, 94, 0.8)', icone: Banknote },
  'PIX': { cor: 'rgba(168, 85, 247, 0.8)', icone: Smartphone },
  'Crédito': { cor: 'rgba(59, 130, 246, 0.8)', icone: CreditCard },
  'Débito': { cor: 'rgba(245, 158, 11, 0.8)', icone: CreditCard },
  'Vale Refeição': { cor: 'rgba(239, 68, 68, 0.8)', icone: Wallet },
}

const CORES_CATEGORIAS = [
  'rgba(245, 158, 11, 0.8)',
  'rgba(59, 130, 246, 0.8)',
  'rgba(34, 197, 94, 0.8)',
  'rgba(168, 85, 247, 0.8)',
  'rgba(239, 68, 68, 0.8)',
  'rgba(236, 72, 153, 0.8)',
]

export default function RelatoriosAnoAnterior({
  vendasPorDia,
  produtosMaisVendidos,
  vendasPorCategoria,
  horariosPico,
  faturamentoPorPagamento,
  ano
}: RelatoriosAnoAnteriorProps) {
  // Limitar vendas por dia aos últimos 30 registros para não sobrecarregar o gráfico
  const vendasLimitadas = vendasPorDia.slice(-30)

  if (!vendasPorDia.length && !produtosMaisVendidos.length && !faturamentoPorPagamento.length) {
    return <ListaVazia icone={<Wallet />} titulo={`Nenhuma venda registrada em ${ano}`} />
  }

  return (
    <div className="space-y-5">
      <Secao titulo="Vendas por dia">
        <Cartao className="p-4 md:p-5">
        <div className="h-72">
          <Line
            data={{
              labels: vendasLimitadas.map(v => v.data),
              datasets: [{
                label: 'Receita (R$)',
                data: vendasLimitadas.map(v => v.total),
                borderColor: 'rgb(245, 158, 11)',
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                fill: true,
                tension: 0.4
              }]
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { display: false },
                tooltip: {
                  callbacks: {
                    label: (ctx) => `R$ ${formatarMoeda(ctx.raw as number)}`
                  }
                }
              },
              scales: {
                y: {
                  beginAtZero: true,
                  ticks: {
                    callback: (value) => `R$ ${formatarMoeda(value as number)}`
                  }
                }
              }
            }}
          />
        </div>
        </Cartao>
        </Secao>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Secao titulo="Produtos mais vendidos">
          <Cartao className="p-4 md:p-5">
          <div className="h-64">
            <Bar
              data={{
                labels: produtosMaisVendidos.map(p => p.nome.length > 20 ? p.nome.substring(0, 20) + '...' : p.nome),
                datasets: [{
                  label: 'Quantidade',
                  data: produtosMaisVendidos.map(p => p.quantidade),
                  backgroundColor: 'rgba(59, 130, 246, 0.8)',
                  borderRadius: 6
                }]
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                plugins: {
                  legend: { display: false }
                }
              }}
            />
          </div>
          </Cartao>
        </Secao>

        <Secao titulo="Vendas por categoria">

          <Cartao className="p-4 md:p-5">
          <div className="h-64">
            <Doughnut
              data={{
                labels: vendasPorCategoria.map(c => c.categoria),
                datasets: [{
                  data: vendasPorCategoria.map(c => c.receita),
                  backgroundColor: CORES_CATEGORIAS,
                  borderWidth: 0
                }]
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { position: 'bottom' },
                  tooltip: {
                    callbacks: {
                      label: (ctx) => `R$ ${formatarMoeda(ctx.raw as number)}`
                    }
                  }
                }
              }}
            />
          </div>
          </Cartao>
        </Secao>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Secao titulo="Horários de mais movimento">
          <Cartao className="p-4 md:p-5">
          <div className="h-64">
            <Bar
              data={{
                labels: horariosPico.map(h => `${h.hora}h`),
                datasets: [{
                  label: 'Pedidos',
                  data: horariosPico.map(h => h.quantidade),
                  backgroundColor: 'rgba(168, 85, 247, 0.8)',
                  borderRadius: 6
                }]
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { display: false }
                }
              }}
            />
          </div>
          </Cartao>
        </Secao>

        <Secao titulo="Vendas por forma de pagamento">

          <Cartao className="p-4 md:p-5">
          <div className="space-y-3">
            {faturamentoPorPagamento.map((pagamento, index) => {
              const config = CORES_PAGAMENTO[pagamento.forma] || { cor: 'rgba(156, 163, 175, 0.8)', icone: Banknote }
              const Icone = config.icone
              const totalGeral = faturamentoPorPagamento.reduce((sum, p) => sum + p.total, 0)
              const percentual = totalGeral > 0 ? (pagamento.total / totalGeral) * 100 : 0

              return (
                <div key={pagamento.forma} className="flex items-center gap-3">
                  <Icone className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-foreground">{pagamento.forma}</span>
                      <span className="shrink-0 text-[13px] text-muted-foreground">{pagamento.quantidade} {pagamento.quantidade === 1 ? 'pedido' : 'pedidos'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${percentual}%`,
                            backgroundColor: config.cor
                          }}
                        />
                      </div>
                      <span className="w-24 shrink-0 text-right text-sm font-semibold tabular-nums text-foreground">
                        R$ {formatarMoeda(pagamento.total)}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          </Cartao>
        </Secao>
      </div>
    </div>
  )
}
