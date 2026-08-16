'use client'

import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Search, Truck, MapPin, Clock, CheckCircle, Filter, ChevronDown, ChevronUp } from 'lucide-react'
import type { EntregaHistorico } from '@/lib/tipos-anos-anteriores'

type EntregasAnoAnteriorProps = {
  entregas: EntregaHistorico[]
  ano: number
}

const formatarMoeda = (valor: number): string => {
  return valor.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

const formatarDataHora = (data: string | undefined): string => {
  if (!data) return '-'
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
    case 'em_transito':
    case 'em transito':
    case 'em trânsito':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
    case 'entregue':
      return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
    case 'cancelada':
      return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
    default:
      return 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800/20 dark:text-zinc-400'
  }
}

const formatarStatus = (status: string): string => {
  switch (status?.toLowerCase()) {
    case 'pendente': return 'Pendente'
    case 'em_transito':
    case 'em transito':
    case 'em trânsito': return 'Em Trânsito'
    case 'entregue': return 'Entregue'
    case 'cancelada': return 'Cancelada'
    default: return status || 'Desconhecido'
  }
}

export default function EntregasAnoAnterior({ entregas, ano }: EntregasAnoAnteriorProps) {
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<string>('todos')
  const [filtroBairro, setFiltroBairro] = useState<string>('todos')
  const [mostrarFiltros, setMostrarFiltros] = useState(false)
  const [paginaAtual, setPaginaAtual] = useState(1)
  const itensPorPagina = 20

  // Lista de bairros únicos
  const bairrosUnicos = useMemo(() => {
    const bairros = new Set<string>()
    entregas.forEach(e => {
      if (e.bairro) bairros.add(e.bairro)
    })
    return Array.from(bairros).sort()
  }, [entregas])

  const entregasFiltradas = useMemo(() => {
    return entregas.filter(entrega => {
      const buscaLower = busca.toLowerCase()
      const matchBusca = !busca ||
        entrega.entregador_nome?.toLowerCase().includes(buscaLower) ||
        entrega.endereco_entrega?.toLowerCase().includes(buscaLower) ||
        entrega.bairro?.toLowerCase().includes(buscaLower) ||
        entrega.pedido_id?.toLowerCase().includes(buscaLower)

      const matchStatus = filtroStatus === 'todos' || entrega.status?.toLowerCase() === filtroStatus
      const matchBairro = filtroBairro === 'todos' || entrega.bairro === filtroBairro

      return matchBusca && matchStatus && matchBairro
    })
  }, [entregas, busca, filtroStatus, filtroBairro])

  const totalPaginas = Math.ceil(entregasFiltradas.length / itensPorPagina)
  const entregasPaginadas = entregasFiltradas.slice(
    (paginaAtual - 1) * itensPorPagina,
    paginaAtual * itensPorPagina
  )

  // Estatísticas
  const estatisticas = useMemo(() => {
    const total = entregas.length
    const entregues = entregas.filter(e => e.status?.toLowerCase() === 'entregue').length
    const totalTaxas = entregas.reduce((sum, e) => sum + (Number(e.taxa_entrega) || 0), 0)
    const tempoMedio = entregas
      .filter(e => e.tempo_real)
      .reduce((sum, e, _, arr) => sum + (e.tempo_real || 0) / arr.length, 0)

    return { total, entregues, totalTaxas, tempoMedio }
  }, [entregas])

  return (
    <div className="space-y-6">
      {/* Cards de estatísticas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <Truck className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-zinc-900 dark:text-white">{estatisticas.total}</p>
              <p className="text-xs text-zinc-500">Total de Entregas</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-zinc-900 dark:text-white">{estatisticas.entregues}</p>
              <p className="text-xs text-zinc-500">Concluídas</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
              <MapPin className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-600">R$ {formatarMoeda(estatisticas.totalTaxas)}</p>
              <p className="text-xs text-zinc-500">Total em Taxas</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
              <Clock className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-zinc-900 dark:text-white">
                {estatisticas.tempoMedio > 0 ? `${Math.round(estatisticas.tempoMedio)} min` : '-'}
              </p>
              <p className="text-xs text-zinc-500">Tempo Médio</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Barra de busca e filtros */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
            <input
              type="text"
              placeholder="Buscar por endereço, bairro, entregador..."
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
                <option value="em_transito">Em Trânsito</option>
                <option value="entregue">Entregue</option>
                <option value="cancelada">Cancelada</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Bairro
              </label>
              <select
                value={filtroBairro}
                onChange={(e) => {
                  setFiltroBairro(e.target.value)
                  setPaginaAtual(1)
                }}
                className="w-full px-4 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 
                         dark:border-zinc-700 rounded-lg text-zinc-900 dark:text-white"
              >
                <option value="todos">Todos os bairros</option>
                {bairrosUnicos.map(bairro => (
                  <option key={bairro} value={bairro}>{bairro}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between text-sm text-zinc-500">
          <span>{entregasFiltradas.length} entregas encontradas</span>
          <span>Ano: {ano}</span>
        </div>
      </div>

      {/* Lista de entregas */}
      {entregasFiltradas.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-12 text-center">
          <Truck className="w-16 h-16 mx-auto text-zinc-300 dark:text-zinc-700 mb-4" />
          <p className="text-zinc-500 dark:text-zinc-400">Nenhuma entrega encontrada</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {entregasPaginadas.map((entrega, index) => (
            <motion.div
              key={entrega.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
              className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                    <Truck className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      #{entrega.pedido_id?.slice(0, 8).toUpperCase()}
                    </p>
                    {entrega.entregador_nome && (
                      <p className="text-sm font-medium text-zinc-900 dark:text-white">
                        {entrega.entregador_nome}
                      </p>
                    )}
                  </div>
                </div>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getCorStatus(entrega.status)}`}>
                  {formatarStatus(entrega.status)}
                </span>
              </div>

              {entrega.endereco_entrega && (
                <div className="mb-3">
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Endereço:</p>
                  <p className="text-sm text-zinc-700 dark:text-zinc-300 line-clamp-2">
                    {entrega.endereco_entrega}
                  </p>
                </div>
              )}

              <div className="flex flex-wrap gap-2 mb-3">
                {entrega.bairro && (
                  <span className="px-2 py-1 text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-full flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {entrega.bairro}
                  </span>
                )}
                {entrega.tempo_real && (
                  <span className="px-2 py-1 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-full flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {entrega.tempo_real} min
                  </span>
                )}
              </div>

              <div className="pt-3 border-t border-zinc-200 dark:border-zinc-700 flex items-center justify-between">
                <span className="text-xs text-zinc-500">{formatarDataHora(entrega.created_at)}</span>
                <span className="text-sm font-bold text-amber-600">
                  R$ {formatarMoeda(entrega.taxa_entrega)}
                </span>
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
