'use client'

import { motion } from 'framer-motion'
import {
  BarChart3,
  TrendingUp,
  Clock,
  Banknote,
  CreditCard,
  Smartphone,
  Wallet
} from 'lucide-react'
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

  return (
    <div className="space-y-6">
      {/* Gráfico de Vendas por Dia */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6"
      >
        <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-amber-600" />
          Vendas por Dia - {ano}
        </h3>
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
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Produtos mais vendidos */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6"
        >
          <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            Produtos Mais Vendidos - {ano}
          </h3>
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
        </motion.div>

        {/* Vendas por Categoria */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6"
        >
          <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-amber-600" />
            Vendas por Categoria - {ano}
          </h3>
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
                  legend: { position: 'right' },
                  tooltip: {
                    callbacks: {
                      label: (ctx) => `R$ ${formatarMoeda(ctx.raw as number)}`
                    }
                  }
                }
              }}
            />
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Horários de Pico */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6"
        >
          <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-purple-600" />
            Horários de Pico - {ano}
          </h3>
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
        </motion.div>

        {/* Faturamento por Forma de Pagamento */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6"
        >
          <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
            <Banknote className="w-5 h-5 text-green-600" />
            Faturamento por Pagamento - {ano}
          </h3>
          <div className="space-y-3">
            {faturamentoPorPagamento.map((pagamento, index) => {
              const config = CORES_PAGAMENTO[pagamento.forma] || { cor: 'rgba(156, 163, 175, 0.8)', icone: Banknote }
              const Icone = config.icone
              const totalGeral = faturamentoPorPagamento.reduce((sum, p) => sum + p.total, 0)
              const percentual = totalGeral > 0 ? (pagamento.total / totalGeral) * 100 : 0

              return (
                <div key={pagamento.forma} className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center"
                       style={{ backgroundColor: config.cor.replace('0.8', '0.2') }}>
                    <Icone className="w-5 h-5" style={{ color: config.cor.replace('0.8', '1') }} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-zinc-900 dark:text-white">{pagamento.forma}</span>
                      <span className="text-sm text-zinc-500">{pagamento.quantidade} pedidos</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${percentual}%`,
                            backgroundColor: config.cor
                          }}
                        />
                      </div>
                      <span className="text-sm font-medium text-amber-600 dark:text-amber-400 w-24 text-right">
                        R$ {formatarMoeda(pagamento.total)}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
