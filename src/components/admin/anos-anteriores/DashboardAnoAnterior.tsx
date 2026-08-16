'use client'

import { motion } from 'framer-motion'
import {
  DollarSign,
  ShoppingCart,
  TrendingUp,
  Truck,
  Store,
  Package,
  MapPin
} from 'lucide-react'
import CartaoEstatistica from './CartaoEstatistica'
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
  return (
    <div className="space-y-6">
      {/* Cards principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <CartaoEstatistica
          titulo="Receita Total"
          valor={`R$ ${formatarMoeda(estatisticas.receitaTotal)}`}
          icone={DollarSign}
          corGradiente="from-green-500 to-green-600"
          delay={0}
        />
        <CartaoEstatistica
          titulo="Total de Pedidos"
          valor={estatisticas.totalPedidos}
          icone={ShoppingCart}
          corGradiente="from-blue-500 to-blue-600"
          delay={0.1}
        />
        <CartaoEstatistica
          titulo="Ticket Médio"
          valor={`R$ ${formatarMoeda(estatisticas.ticketMedio)}`}
          icone={TrendingUp}
          corGradiente="from-amber-500 to-amber-600"
          delay={0.2}
        />
        <CartaoEstatistica
          titulo="Entregas Realizadas"
          valor={estatisticas.totalEntregas}
          subtitulo={`R$ ${formatarMoeda(estatisticas.totalTaxasEntrega)} em taxas`}
          icone={Truck}
          corGradiente="from-purple-500 to-purple-600"
          delay={0.3}
        />
      </div>

      {/* Pedidos por tipo */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6"
      >
        <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
          <Package className="w-5 h-5 text-amber-600" />
          Pedidos por Tipo - {ano}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Entregas */}
          <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-xl p-4 text-center">
            <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-green-500/20 flex items-center justify-center">
              <Truck className="w-6 h-6 text-green-600" />
            </div>
            <p className="text-2xl font-bold text-green-600">{estatisticas.pedidosEntrega}</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Entregas</p>
            <p className="text-sm font-medium text-green-600 mt-1">
              R$ {formatarMoeda(estatisticas.receitaEntrega)}
            </p>
          </div>

          {/* Retiradas */}
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl p-4 text-center">
            <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-blue-500/20 flex items-center justify-center">
              <Package className="w-6 h-6 text-blue-600" />
            </div>
            <p className="text-2xl font-bold text-blue-600">{estatisticas.pedidosRetirada}</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Retiradas</p>
            <p className="text-sm font-medium text-blue-600 mt-1">
              R$ {formatarMoeda(estatisticas.receitaRetirada)}
            </p>
          </div>

          {/* No Local */}
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-xl p-4 text-center">
            <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-purple-500/20 flex items-center justify-center">
              <Store className="w-6 h-6 text-purple-600" />
            </div>
            <p className="text-2xl font-bold text-purple-600">{estatisticas.pedidosLocal}</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">No Local</p>
            <p className="text-sm font-medium text-purple-600 mt-1">
              R$ {formatarMoeda(estatisticas.receitaLocal)}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Entregas por bairro */}
      {entregasPorBairro.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6"
        >
          <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-green-600" />
            Entregas por Bairro - {ano}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {entregasPorBairro.slice(0, 6).map((bairro, index) => (
              <div
                key={bairro.bairro}
                className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800 rounded-xl"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center text-sm font-bold text-green-600">
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-medium text-zinc-900 dark:text-white">{bairro.bairro}</p>
                    <p className="text-xs text-zinc-500">R$ {formatarMoeda(bairro.taxaTotal)} em taxas</p>
                  </div>
                </div>
                <p className="text-xl font-bold text-green-600">{bairro.quantidade}</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  )
}
