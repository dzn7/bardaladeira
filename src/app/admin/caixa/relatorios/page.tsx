'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { 
  BarChart3, TrendingUp, TrendingDown, Calendar, Users, DollarSign,
  ArrowLeft, Download, Filter, RefreshCw, Wallet, ShoppingCart
} from 'lucide-react'
import { format, subDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek, 
  eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval, subMonths, isWithinInterval } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import Link from 'next/link'
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
import ProtectedRoute from '@/components/admin/ProtectedRoute'
import AdminLayout from '@/components/admin/AdminLayout'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'
import type { MovimentacaoCaixa, Funcionario, CategoriaCaixa } from '@/lib/tipos-caixa'

ChartJS.register(
  CategoryScale, LinearScale, BarElement, LineElement, PointElement,
  ArcElement, Title, Tooltip, Legend, Filler
)

type Periodo = '7dias' | '30dias' | 'mes' | 'semana' | 'personalizado'

type MovimentacaoCompleta = MovimentacaoCaixa & {
  categoria?: CategoriaCaixa
  funcionario?: Funcionario
}

export default function RelatoriosCaixaPage() {
  const [carregando, setCarregando] = useState(true)
  const [periodo, setPeriodo] = useState<Periodo>('30dias')
  const [dataInicio, setDataInicio] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'))
  const [dataFim, setDataFim] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [movimentacoes, setMovimentacoes] = useState<MovimentacaoCompleta[]>([])
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])
  const [categorias, setCategorias] = useState<CategoriaCaixa[]>([])

  // Calcular datas baseado no período
  useEffect(() => {
    const hoje = new Date()
    let inicio: Date
    let fim: Date = hoje

    switch (periodo) {
      case '7dias':
        inicio = subDays(hoje, 7)
        break
      case '30dias':
        inicio = subDays(hoje, 30)
        break
      case 'mes':
        inicio = startOfMonth(hoje)
        fim = endOfMonth(hoje)
        break
      case 'semana':
        inicio = startOfWeek(hoje, { locale: ptBR })
        fim = endOfWeek(hoje, { locale: ptBR })
        break
      default:
        return
    }

    setDataInicio(format(inicio, 'yyyy-MM-dd'))
    setDataFim(format(fim, 'yyyy-MM-dd'))
  }, [periodo])

  // Carregar dados
  useEffect(() => {
    async function carregarDados() {
      setCarregando(true)
      try {
        const inicioISO = new Date(dataInicio).toISOString()
        const fimISO = new Date(dataFim + 'T23:59:59').toISOString()

        const [movRes, funcRes, catRes] = await Promise.all([
          supabase
            .from('movimentacoes_caixa')
            .select('*, categoria:categorias_caixa(*), funcionario:funcionarios(*)')
            .gte('created_at', inicioISO)
            .lte('created_at', fimISO)
            .order('created_at', { ascending: false }),
          supabase.from('funcionarios').select('*').eq('ativo', true),
          supabase.from('categorias_caixa').select('*').eq('ativo', true)
        ])

        if (movRes.data) setMovimentacoes(movRes.data)
        if (funcRes.data) setFuncionarios(funcRes.data)
        if (catRes.data) setCategorias(catRes.data)
      } catch (erro) {
        console.error('Erro ao carregar dados:', erro)
      } finally {
        setCarregando(false)
      }
    }

    carregarDados()
  }, [dataInicio, dataFim])

  // Cálculos
  const estatisticas = useMemo(() => {
    const entradas = movimentacoes.filter(m => m.tipo === 'entrada')
    const saidas = movimentacoes.filter(m => m.tipo === 'saida')
    
    return {
      totalEntradas: entradas.reduce((acc, m) => acc + Number(m.valor), 0),
      totalSaidas: saidas.reduce((acc, m) => acc + Number(m.valor), 0),
      quantidadeEntradas: entradas.length,
      quantidadeSaidas: saidas.length,
      saldoPeriodo: entradas.reduce((acc, m) => acc + Number(m.valor), 0) - 
                   saidas.reduce((acc, m) => acc + Number(m.valor), 0)
    }
  }, [movimentacoes])

  // Dados por funcionário
  const gastosPorFuncionario = useMemo(() => {
    const gastos: Record<string, { nome: string, total: number, quantidade: number }> = {}
    
    movimentacoes
      .filter(m => m.tipo === 'saida' && m.funcionario)
      .forEach(m => {
        const id = m.funcionario!.id
        if (!gastos[id]) {
          gastos[id] = { nome: m.funcionario!.nome, total: 0, quantidade: 0 }
        }
        gastos[id].total += Number(m.valor)
        gastos[id].quantidade++
      })

    return Object.values(gastos).sort((a, b) => b.total - a.total)
  }, [movimentacoes])

  // Dados por categoria
  const movimentacoesPorCategoria = useMemo(() => {
    const porCategoria: Record<string, { nome: string, tipo: string, total: number, cor: string }> = {}
    
    movimentacoes.forEach(m => {
      const catId = m.categoria?.id || 'sem-categoria'
      const catNome = m.categoria?.nome || 'Sem categoria'
      const catCor = m.categoria?.cor || '#6b7280'
      
      if (!porCategoria[catId]) {
        porCategoria[catId] = { nome: catNome, tipo: m.tipo, total: 0, cor: catCor }
      }
      porCategoria[catId].total += Number(m.valor)
    })

    return Object.values(porCategoria).sort((a, b) => b.total - a.total)
  }, [movimentacoes])

  // Dados para gráfico de linha (evolução diária)
  const dadosEvolucaoDiaria = useMemo(() => {
    const inicio = new Date(dataInicio)
    const fim = new Date(dataFim)
    const dias = eachDayOfInterval({ start: inicio, end: fim })

    const entradasPorDia = dias.map(dia => {
      const movsDia = movimentacoes.filter(m => {
        const dataMov = new Date(m.created_at)
        return format(dataMov, 'yyyy-MM-dd') === format(dia, 'yyyy-MM-dd')
      })
      return movsDia.filter(m => m.tipo === 'entrada').reduce((acc, m) => acc + Number(m.valor), 0)
    })

    const saidasPorDia = dias.map(dia => {
      const movsDia = movimentacoes.filter(m => {
        const dataMov = new Date(m.created_at)
        return format(dataMov, 'yyyy-MM-dd') === format(dia, 'yyyy-MM-dd')
      })
      return movsDia.filter(m => m.tipo === 'saida').reduce((acc, m) => acc + Number(m.valor), 0)
    })

    return {
      labels: dias.map(d => format(d, 'dd/MM', { locale: ptBR })),
      datasets: [
        {
          label: 'Entradas',
          data: entradasPorDia,
          borderColor: '#22c55e',
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          fill: true,
          tension: 0.4
        },
        {
          label: 'Saídas',
          data: saidasPorDia,
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          fill: true,
          tension: 0.4
        }
      ]
    }
  }, [movimentacoes, dataInicio, dataFim])

  // Dados para gráfico de barras (por categoria de saída)
  const dadosCategoriasSaida = useMemo(() => {
    const saidasPorCategoria = movimentacoesPorCategoria.filter(c => c.tipo === 'saida')
    
    return {
      labels: saidasPorCategoria.map(c => c.nome),
      datasets: [{
        label: 'Gastos por Categoria',
        data: saidasPorCategoria.map(c => c.total),
        backgroundColor: saidasPorCategoria.map(c => c.cor),
        borderRadius: 8
      }]
    }
  }, [movimentacoesPorCategoria])

  // Dados para gráfico de pizza (distribuição de gastos)
  const dadosDistribuicaoGastos = useMemo(() => {
    const saidasPorCategoria = movimentacoesPorCategoria.filter(c => c.tipo === 'saida')
    
    return {
      labels: saidasPorCategoria.map(c => c.nome),
      datasets: [{
        data: saidasPorCategoria.map(c => c.total),
        backgroundColor: saidasPorCategoria.map(c => c.cor),
        borderWidth: 0
      }]
    }
  }, [movimentacoesPorCategoria])

  // Dados para gráfico de barras (gastos por funcionário)
  const dadosGastosFuncionario = useMemo(() => {
    return {
      labels: gastosPorFuncionario.map(f => f.nome),
      datasets: [{
        label: 'Gastos por Funcionário',
        data: gastosPorFuncionario.map(f => f.total),
        backgroundColor: ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6'],
        borderRadius: 8
      }]
    }
  }, [gastosPorFuncionario])

  const opcoesGrafico = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          callback: (value: number | string) => `R$ ${Number(value).toFixed(0)}`
        }
      }
    }
  }

  const opcoesLinha = {
    ...opcoesGrafico,
    plugins: {
      legend: { display: true, position: 'top' as const }
    }
  }

  const opcoesPizza = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: 'right' as const }
    }
  }

  if (carregando) {
    return (
      <ProtectedRoute><AdminLayout>
        <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
          <RefreshCw className="w-10 h-10 text-purple-600 animate-spin" />
          <p className="text-zinc-600 dark:text-zinc-400">Carregando relatórios...</p>
        </div>
      </AdminLayout></ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute><AdminLayout>
      <div className="space-y-4 min-w-0">
        {/* Cabeçalho */}
        <div className="flex items-center gap-3">
          <Link href="/admin/caixa" className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors flex-shrink-0">
            <ArrowLeft className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-purple-600 flex-shrink-0" />
              Relatórios
            </h1>
            <p className="text-zinc-600 dark:text-zinc-400 text-sm truncate">
              Análise de movimentações
            </p>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-zinc-500" />
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Período:</span>
          </div>
          <div className="flex flex-wrap gap-2 mb-3">
            {[
              { valor: '7dias', label: '7 dias' },
              { valor: '30dias', label: '30 dias' },
              { valor: 'semana', label: 'Semana' },
              { valor: 'mes', label: 'Mês' },
              { valor: 'personalizado', label: 'Custom' }
            ].map(p => (
              <button
                key={p.valor}
                onClick={() => setPeriodo(p.valor as Periodo)}
                className={`px-2.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                  periodo === p.valor
                    ? 'bg-purple-600 text-white'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {periodo === 'personalizado' && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 mb-3">
              <Input
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="h-9 w-full sm:w-auto"
              />
              <span className="text-zinc-500 text-sm">até</span>
              <Input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="h-9 w-full sm:w-auto"
              />
            </div>
          )}
          <p className="text-xs text-zinc-500">
            {format(new Date(dataInicio), "dd/MM/yyyy", { locale: ptBR })} até {format(new Date(dataFim), "dd/MM/yyyy", { locale: ptBR })}
          </p>
        </div>

        {/* Cards de Resumo */}
        <div className="grid grid-cols-2 gap-3">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white dark:bg-zinc-900 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-green-600" />
              <span className="text-xs text-zinc-500">Entradas</span>
            </div>
            <p className="text-base sm:text-lg font-bold text-green-600">R$ {estatisticas.totalEntradas.toFixed(2)}</p>
            <p className="text-xs text-zinc-500">{estatisticas.quantidadeEntradas} mov.</p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white dark:bg-zinc-900 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="w-4 h-4 text-red-600" />
              <span className="text-xs text-zinc-500">Saídas</span>
            </div>
            <p className="text-base sm:text-lg font-bold text-red-600">R$ {estatisticas.totalSaidas.toFixed(2)}</p>
            <p className="text-xs text-zinc-500">{estatisticas.quantidadeSaidas} mov.</p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white dark:bg-zinc-900 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="w-4 h-4 text-amber-600" />
              <span className="text-xs text-zinc-500">Saldo</span>
            </div>
            <p className={`text-base sm:text-lg font-bold ${estatisticas.saldoPeriodo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              R$ {estatisticas.saldoPeriodo.toFixed(2)}
            </p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-white dark:bg-zinc-900 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-4 h-4 text-blue-600" />
              <span className="text-xs text-zinc-500">Funcionários</span>
            </div>
            <p className="text-base sm:text-lg font-bold text-blue-600">{gastosPorFuncionario.length}</p>
          </motion.div>
        </div>

        {/* Gráficos */}
        <div className="space-y-3">
          {/* Evolução Diária */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white dark:bg-zinc-900 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-2">Evolução Diária</h3>
            <div className="h-40 sm:h-56">
              <Line data={dadosEvolucaoDiaria} options={opcoesLinha} />
            </div>
          </motion.div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {/* Gastos por Categoria */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-white dark:bg-zinc-900 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-2">Categoria</h3>
              <div className="h-40 sm:h-48">
                <Bar data={dadosCategoriasSaida} options={opcoesGrafico} />
              </div>
            </motion.div>

            {/* Gastos por Funcionário */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="bg-white dark:bg-zinc-900 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-2">Funcionário</h3>
              <div className="h-40 sm:h-48">
                {gastosPorFuncionario.length > 0 ? (
                  <Bar data={dadosGastosFuncionario} options={opcoesGrafico} />
                ) : (
                  <div className="h-full flex items-center justify-center text-zinc-500 text-xs">
                    Sem dados
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </div>

        {/* Tabela Detalhada por Funcionário */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
            <h3 className="text-base font-semibold text-zinc-900 dark:text-white">Por Funcionário</h3>
          </div>
          {gastosPorFuncionario.length > 0 ? (
            <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {gastosPorFuncionario.map((func, i) => {
                const funcionarioInfo = funcionarios.find(f => f.nome === func.nome)
                return (
                  <div key={i} className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                        <Users className="w-4 h-4 text-purple-600" />
                      </div>
                      <div>
                        <p className="font-medium text-zinc-900 dark:text-white text-sm">{func.nome}</p>
                        <p className="text-xs text-zinc-500">{funcionarioInfo?.cargo || '-'} • {func.quantidade} mov.</p>
                      </div>
                    </div>
                    <p className="font-bold text-red-600">R$ {func.total.toFixed(2)}</p>
                  </div>
                )
              })}
              <div className="p-4 bg-zinc-50 dark:bg-zinc-800 flex justify-between">
                <span className="font-semibold text-zinc-700 dark:text-zinc-300">Total:</span>
                <span className="font-bold text-red-600">R$ {gastosPorFuncionario.reduce((acc, f) => acc + f.total, 0).toFixed(2)}</span>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-zinc-500 text-sm">
              Nenhum gasto com funcionário no período
            </div>
          )}
        </motion.div>

        {/* Tabela Detalhada por Categoria */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }} className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
            <h3 className="text-base font-semibold text-zinc-900 dark:text-white">Por Categoria</h3>
          </div>
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {movimentacoesPorCategoria.map((cat, i) => {
              const totalGeral = cat.tipo === 'entrada' ? estatisticas.totalEntradas : estatisticas.totalSaidas
              const percentual = totalGeral > 0 ? (cat.total / totalGeral) * 100 : 0
              return (
                <div key={i} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.cor }} />
                    <div>
                      <p className="font-medium text-zinc-900 dark:text-white text-sm">{cat.nome}</p>
                      <p className="text-xs text-zinc-500">{percentual.toFixed(1)}% do total</p>
                    </div>
                  </div>
                  <p className={`font-bold ${cat.tipo === 'entrada' ? 'text-green-600' : 'text-red-600'}`}>
                    R$ {cat.total.toFixed(2)}
                  </p>
                </div>
              )
            })}
          </div>
        </motion.div>
      </div>
    </AdminLayout></ProtectedRoute>
  )
}
