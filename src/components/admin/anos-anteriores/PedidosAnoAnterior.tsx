'use client'

import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Search, Eye, ShoppingCart, Filter, ChevronDown, ChevronUp } from 'lucide-react'
import type { PedidoHistorico } from '@/lib/tipos-anos-anteriores'

type PedidosAnoAnteriorProps = {
  pedidos: PedidoHistorico[]
  ano: number
  onVerDetalhes: (pedido: PedidoHistorico) => void
}

const formatarMoeda = (valor: number): string => {
  return valor.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

const formatarDataHora = (data: string): string => {
  return new Date(data).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo'
  })
}

const getCorStatus = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'pendente':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400'
    case 'preparando':
    case 'em preparo':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
    case 'pronto':
      return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
    case 'entregue':
      return 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800/20 dark:text-zinc-400'
    case 'cancelado':
      return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
    default:
      return 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800/20 dark:text-zinc-400'
  }
}

const getCorTipoEntrega = (tipo: string) => {
  switch (tipo?.toLowerCase()) {
    case 'entrega':
      return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
    case 'retirada':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
    case 'local':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400'
    default:
      return 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800/20 dark:text-zinc-400'
  }
}

export default function PedidosAnoAnterior({
  pedidos,
  ano,
  onVerDetalhes
}: PedidosAnoAnteriorProps) {
  const [busca, setBusca] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<string>('todos')
  const [filtroStatus, setFiltroStatus] = useState<string>('todos')
  const [mostrarFiltros, setMostrarFiltros] = useState(false)
  const [paginaAtual, setPaginaAtual] = useState(1)
  const itensPorPagina = 20

  const pedidosFiltrados = useMemo(() => {
    return pedidos.filter(pedido => {
      const buscaLower = busca.toLowerCase()
      const matchBusca = !busca || 
        pedido.nome_cliente.toLowerCase().includes(buscaLower) ||
        pedido.telefone?.toLowerCase().includes(buscaLower) ||
        pedido.id.toLowerCase().includes(buscaLower)

      const matchTipo = filtroTipo === 'todos' || pedido.tipo_entrega === filtroTipo
      const matchStatus = filtroStatus === 'todos' || pedido.status?.toLowerCase() === filtroStatus

      return matchBusca && matchTipo && matchStatus
    })
  }, [pedidos, busca, filtroTipo, filtroStatus])

  const totalPaginas = Math.ceil(pedidosFiltrados.length / itensPorPagina)
  const pedidosPaginados = pedidosFiltrados.slice(
    (paginaAtual - 1) * itensPorPagina,
    paginaAtual * itensPorPagina
  )

  return (
    <div className="space-y-4">
      {/* Barra de busca e filtros */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
            <input
              type="text"
              placeholder="Buscar por nome, telefone ou ID..."
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value)
                setPaginaAtual(1)
              }}
              className="w-full pl-10 pr-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 
                       dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white"
            />
          </div>
          <button
            onClick={() => setMostrarFiltros(!mostrarFiltros)}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-100 dark:bg-zinc-800 
                     text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700"
          >
            <Filter className="w-4 h-4" />
            Filtros
            {mostrarFiltros ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {mostrarFiltros && (
          <div className="mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-700 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Tipo de Pedido
              </label>
              <select
                value={filtroTipo}
                onChange={(e) => {
                  setFiltroTipo(e.target.value)
                  setPaginaAtual(1)
                }}
                className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 
                         dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white"
              >
                <option value="todos">Todos</option>
                <option value="entrega">Entrega</option>
                <option value="retirada">Retirada</option>
                <option value="local">No Local</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Status
              </label>
              <select
                value={filtroStatus}
                onChange={(e) => {
                  setFiltroStatus(e.target.value)
                  setPaginaAtual(1)
                }}
                className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 
                         dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white"
              >
                <option value="todos">Todos</option>
                <option value="pendente">Pendente</option>
                <option value="preparando">Preparando</option>
                <option value="pronto">Pronto</option>
                <option value="entregue">Entregue</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between text-sm text-zinc-500">
          <span>{pedidosFiltrados.length} pedidos encontrados</span>
          <span>Ano: {ano}</span>
        </div>
      </div>

      {/* Lista de pedidos */}
      {pedidosFiltrados.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-12 text-center">
          <ShoppingCart className="w-16 h-16 mx-auto text-zinc-300 dark:text-zinc-700 mb-4" />
          <p className="text-zinc-500 dark:text-zinc-400">Nenhum pedido encontrado</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {pedidosPaginados.map((pedido, index) => (
            <motion.div
              key={pedido.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
              className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 
                       hover:shadow-lg transition-all duration-300 overflow-hidden"
            >
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h4 className="font-semibold text-zinc-900 dark:text-white text-base mb-1">
                      {pedido.nome_cliente}
                    </h4>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      #{pedido.id.slice(0, 8).toUpperCase()}
                    </p>
                  </div>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getCorStatus(pedido.status)}`}>
                    {pedido.status}
                  </span>
                </div>

                <div className="space-y-2 mb-4">
                  {pedido.telefone && (
                    <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                      <span className="font-medium">Tel:</span>
                      <span>{pedido.telefone}</span>
                    </div>
                  )}
                  {pedido.endereco && (
                    <div className="flex items-start gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                      <span className="font-medium">End:</span>
                      <span className="flex-1 line-clamp-2">{pedido.endereco}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-xs">
                    <span className={`px-2 py-1 rounded-full ${getCorTipoEntrega(pedido.tipo_entrega)}`}>
                      {pedido.tipo_entrega === 'entrega' ? 'Entrega' : 
                       pedido.tipo_entrega === 'local' ? 'No Local' : 'Retirada'}
                    </span>
                    <span className="text-zinc-500 dark:text-zinc-400">
                      {formatarDataHora(pedido.created_at)}
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Total:</span>
                    <span className="text-xl font-bold text-amber-600 dark:text-amber-400">
                      R$ {formatarMoeda(pedido.total)}
                    </span>
                  </div>
                  <button
                    onClick={() => onVerDetalhes(pedido)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium 
                             text-zinc-700 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 
                             dark:hover:bg-zinc-700 dark:text-zinc-300 rounded-lg transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                    Ver Detalhes
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Paginação */}
      {totalPaginas > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => setPaginaAtual(p => Math.max(1, p - 1))}
            disabled={paginaAtual === 1}
            className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 
                     rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-50 
                     disabled:cursor-not-allowed transition-colors"
          >
            Anterior
          </button>
          <span className="px-4 py-2 text-zinc-600 dark:text-zinc-400">
            Página {paginaAtual} de {totalPaginas}
          </span>
          <button
            onClick={() => setPaginaAtual(p => Math.min(totalPaginas, p + 1))}
            disabled={paginaAtual === totalPaginas}
            className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 
                     rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-50 
                     disabled:cursor-not-allowed transition-colors"
          >
            Próxima
          </button>
        </div>
      )}
    </div>
  )
}
