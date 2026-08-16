'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { 
  Archive, 
  LayoutDashboard, 
  ShoppingCart, 
  BarChart3, 
  Truck,
  RefreshCw,
  Calendar,
  Wallet,
  Users
} from 'lucide-react'
import ProtectedRoute from '@/components/admin/ProtectedRoute'
import AdminLayout from '@/components/admin/AdminLayout'
import { useAnosAnteriores } from '@/lib/useAnosAnteriores'
import { obterAnosAnterioresDisponiveis } from '@/lib/filtros-ano'
import {
  DashboardAnoAnterior,
  PedidosAnoAnterior,
  RelatoriosAnoAnterior,
  EntregasAnoAnterior,
  ModalDetalhesPedidoHistorico,
  SaldosAnoAnterior,
  SalariosAnoAnterior
} from '@/components/admin/anos-anteriores'
import type { PedidoHistorico, AbaAnosAnteriores } from '@/lib/tipos-anos-anteriores'

const abas: { id: AbaAnosAnteriores; label: string; icone: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Visão Geral', icone: LayoutDashboard },
  { id: 'pedidos', label: 'Pedidos', icone: ShoppingCart },
  { id: 'relatorios', label: 'Relatórios', icone: BarChart3 },
  { id: 'entregas', label: 'Entregas', icone: Truck },
  { id: 'saldos', label: 'Saldos', icone: Wallet },
  { id: 'salarios', label: 'Salários', icone: Users },
]

export default function AnosAnterioresPage() {
  const anosDisponiveis = obterAnosAnterioresDisponiveis()
  const [anoSelecionado, setAnoSelecionado] = useState(anosDisponiveis[0] || 2025)
  const [abaAtiva, setAbaAtiva] = useState<AbaAnosAnteriores>('dashboard')
  const [pedidoDetalhes, setPedidoDetalhes] = useState<PedidoHistorico | null>(null)
  const [modalDetalhesAberto, setModalDetalhesAberto] = useState(false)

  const { dados, carregando, erro, recarregar } = useAnosAnteriores(anoSelecionado)

  const handleVerDetalhesPedido = (pedido: PedidoHistorico) => {
    setPedidoDetalhes(pedido)
    setModalDetalhesAberto(true)
  }

  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-zinc-900 dark:text-white flex items-center gap-3">
                <Archive className="w-8 h-8 text-amber-600" />
                Anos Anteriores
              </h1>
              <p className="text-zinc-600 dark:text-zinc-400 mt-1">
                Histórico completo de pedidos, relatórios e entregas
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Seletor de ano */}
              <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 px-4 py-2">
                <Calendar className="w-5 h-5 text-amber-600" />
                <select
                  value={anoSelecionado}
                  onChange={(e) => setAnoSelecionado(Number(e.target.value))}
                  className="bg-transparent text-zinc-900 dark:text-white font-medium focus:outline-none"
                >
                  {anosDisponiveis.map(ano => (
                    <option key={ano} value={ano}>{ano}</option>
                  ))}
                </select>
              </div>

              <button
                onClick={recarregar}
                disabled={carregando}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 
                         text-white rounded-xl transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${carregando ? 'animate-spin' : ''}`} />
                Atualizar
              </button>
            </div>
          </div>

          {/* Abas */}
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-1.5">
            <div className="flex flex-wrap gap-1">
              {abas.map((aba) => {
                const Icone = aba.icone
                const ativo = abaAtiva === aba.id
                return (
                  <button
                    key={aba.id}
                    onClick={() => setAbaAtiva(aba.id)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      ativo
                        ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                        : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <Icone className="w-4 h-4" />
                    {aba.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Conteúdo */}
          {carregando ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <RefreshCw className="w-8 h-8 text-amber-600 animate-spin" />
              <p className="text-zinc-600 dark:text-zinc-400">Carregando dados de {anoSelecionado}...</p>
            </div>
          ) : erro ? (
            <div className="bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800 p-6 text-center">
              <p className="text-red-600 dark:text-red-400 mb-4">{erro}</p>
              <button
                onClick={recarregar}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                Tentar Novamente
              </button>
            </div>
          ) : (
            <motion.div
              key={abaAtiva}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              {abaAtiva === 'dashboard' && (
                <DashboardAnoAnterior
                  estatisticas={dados.estatisticas}
                  entregasPorBairro={dados.entregasPorBairro}
                  ano={anoSelecionado}
                />
              )}

              {abaAtiva === 'pedidos' && (
                <PedidosAnoAnterior
                  pedidos={dados.pedidos}
                  ano={anoSelecionado}
                  onVerDetalhes={handleVerDetalhesPedido}
                />
              )}

              {abaAtiva === 'relatorios' && (
                <RelatoriosAnoAnterior
                  vendasPorDia={dados.vendasPorDia}
                  produtosMaisVendidos={dados.produtosMaisVendidos}
                  vendasPorCategoria={dados.vendasPorCategoria}
                  horariosPico={dados.horariosPico}
                  faturamentoPorPagamento={dados.faturamentoPorPagamento}
                  ano={anoSelecionado}
                />
              )}

              {abaAtiva === 'entregas' && (
                <EntregasAnoAnterior
                  entregas={dados.entregas}
                  ano={anoSelecionado}
                />
              )}

              {abaAtiva === 'saldos' && (
                <SaldosAnoAnterior ano={anoSelecionado} />
              )}

              {abaAtiva === 'salarios' && (
                <SalariosAnoAnterior ano={anoSelecionado} />
              )}
            </motion.div>
          )}

          {/* Informação sobre dados históricos */}
          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800 p-4">
            <p className="text-sm text-amber-700 dark:text-amber-400">
              <strong>Dados históricos:</strong> Esta página exibe apenas os registros do ano de {anoSelecionado}. 
              Os dados do ano atual ({new Date().getFullYear()}) estão disponíveis nas páginas regulares do sistema.
            </p>
          </div>
        </div>

        {/* Modal de detalhes do pedido */}
        <ModalDetalhesPedidoHistorico
          pedido={pedidoDetalhes}
          aberto={modalDetalhesAberto}
          onFechar={() => {
            setModalDetalhesAberto(false)
            setPedidoDetalhes(null)
          }}
        />
      </AdminLayout>
    </ProtectedRoute>
  )
}
