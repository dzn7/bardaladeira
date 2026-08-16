'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Wallet, TrendingUp, TrendingDown, Calendar, Download, 
  ArrowUpCircle, ArrowDownCircle, Clock, FileText, 
  ChevronLeft, ChevronRight, Filter, Search, Eye,
  DollarSign, CreditCard, Banknote, RefreshCw, Plus, Minus, X
} from 'lucide-react'
import { format, subDays, startOfMonth, endOfMonth, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { supabase } from '@/lib/supabase'
import AdminLayout from '@/components/admin/AdminLayout'
import ProtectedRoute from '@/components/admin/ProtectedRoute'
import Link from 'next/link'
import { obterDataInicioAnoAtual } from '@/lib/filtros-ano'

type Caixa = {
  id: string
  data_abertura: string
  data_fechamento: string | null
  valor_abertura: number
  valor_fechamento: number | null
  total_entradas: number
  total_saidas: number
  saldo_esperado: number
  diferenca: number | null
  responsavel_abertura: string
  responsavel_fechamento: string | null
  status: 'aberto' | 'fechado'
  observacoes: string | null
}

type Movimentacao = {
  id: string
  caixa_id: string
  tipo: 'entrada' | 'saida'
  valor: number
  descricao: string | null
  forma_pagamento: string | null
  created_at: string
  categoria: { nome: string; cor: string; icone: string } | null
  funcionario: { nome: string } | null
}

type ResumoSaldos = {
  saldoAtual: number
  totalEntradas: number
  totalSaidas: number
  totalCaixasFechados: number
  mediaFaturamentoDiario: number
  maiorFaturamento: number
  menorFaturamento: number
  diferencaAcumulada: number
  caixaAberto: boolean
}

export default function SaldosPage() {
  const [caixas, setCaixas] = useState<Caixa[]>([])
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([])
  const [resumo, setResumo] = useState<ResumoSaldos>({
    saldoAtual: 0,
    totalEntradas: 0,
    totalSaidas: 0,
    totalCaixasFechados: 0,
    mediaFaturamentoDiario: 0,
    maiorFaturamento: 0,
    menorFaturamento: 0,
    diferencaAcumulada: 0,
    caixaAberto: false,
  })
  const [carregando, setCarregando] = useState(true)
  const [periodoFiltro, setPeriodoFiltro] = useState<'7dias' | '30dias' | 'mes' | 'todos'>('30dias')
  const [caixaSelecionado, setCaixaSelecionado] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  
  // Modal de ajuste de saldo
  const [modalAjuste, setModalAjuste] = useState(false)
  const [tipoAjuste, setTipoAjuste] = useState<'entrada' | 'saida'>('entrada')
  const [valorAjuste, setValorAjuste] = useState('')
  const [descricaoAjuste, setDescricaoAjuste] = useState('')
  const [processandoAjuste, setProcessandoAjuste] = useState(false)
  const [caixaAberto, setCaixaAberto] = useState<Caixa | null>(null)

  const carregarDados = useCallback(async () => {
    setCarregando(true)
    try {
      // Data mínima: início do ano atual (2026)
      const dataInicioAnoAtual = obterDataInicioAnoAtual()

      // Calcular datas do filtro
      let dataInicio: Date | null = null
      const hoje = new Date()

      switch (periodoFiltro) {
        case '7dias':
          dataInicio = subDays(hoje, 7)
          break
        case '30dias':
          dataInicio = subDays(hoje, 30)
          break
        case 'mes':
          dataInicio = startOfMonth(hoje)
          break
        case 'todos':
          // "Todos" agora significa desde o início de 2026
          dataInicio = new Date(dataInicioAnoAtual)
          break
      }

      // Garantir que a data de início não seja anterior a 01/01/2026
      const dataInicioAno = new Date(dataInicioAnoAtual)
      if (dataInicio && dataInicio < dataInicioAno) {
        dataInicio = dataInicioAno
      }

      // Buscar caixas (apenas de 2026+)
      let queryCaixas = supabase
        .from('caixas')
        .select('*')
        .gte('data_abertura', dataInicioAnoAtual)
        .order('data_abertura', { ascending: false })

      if (dataInicio) {
        queryCaixas = queryCaixas.gte('data_abertura', dataInicio.toISOString())
      }

      const { data: caixasData } = await queryCaixas

      // Buscar movimentações (apenas de 2026+)
      let queryMovs = supabase
        .from('movimentacoes_caixa')
        .select('*, categoria:categorias_caixa(*), funcionario:funcionarios(*)')
        .gte('created_at', dataInicioAnoAtual)
        .order('created_at', { ascending: false })

      if (dataInicio) {
        queryMovs = queryMovs.gte('created_at', dataInicio.toISOString())
      }

      const { data: movsData } = await queryMovs

      const caixasFormatados = (caixasData || []).map(c => ({
        ...c,
        valor_abertura: Number(c.valor_abertura),
        valor_fechamento: c.valor_fechamento ? Number(c.valor_fechamento) : null,
        total_entradas: Number(c.total_entradas || 0),
        total_saidas: Number(c.total_saidas || 0),
        saldo_esperado: Number(c.saldo_esperado || 0),
        diferenca: c.diferenca ? Number(c.diferenca) : null
      }))

      const movsFormatadas = (movsData || []).map(m => ({
        ...m,
        valor: Number(m.valor)
      }))

      setCaixas(caixasFormatados)
      setMovimentacoes(movsFormatadas)

      // Calcular resumo
      const caixasFechados = caixasFormatados.filter(c => c.status === 'fechado')
      const caixaAberto = caixasFormatados.find(c => c.status === 'aberto')
      
      // Total de entradas e saídas de todas as movimentações do período
      const totalEntradas = movsFormatadas.filter(m => m.tipo === 'entrada').reduce((acc, m) => acc + m.valor, 0)
      const totalSaidas = movsFormatadas.filter(m => m.tipo === 'saida').reduce((acc, m) => acc + m.valor, 0)
      
      // Saldo atual: se há caixa aberto, calcular apenas com as movimentações DELE
      // O valor_abertura do caixa aberto já é o saldo do caixa anterior
      let saldoAtual = 0
      if (caixaAberto) {
        // Movimentações apenas do caixa aberto
        const movsDoAberto = movsFormatadas.filter(m => m.caixa_id === caixaAberto.id)
        const entradasAberto = movsDoAberto.filter(m => m.tipo === 'entrada').reduce((acc, m) => acc + m.valor, 0)
        const saidasAberto = movsDoAberto.filter(m => m.tipo === 'saida').reduce((acc, m) => acc + m.valor, 0)
        saldoAtual = caixaAberto.valor_abertura + entradasAberto - saidasAberto
      } else {
        // Se não há caixa aberto, usar o saldo do último caixa fechado
        const ultimoFechado = caixasFechados[0] // Já está ordenado por data desc
        saldoAtual = ultimoFechado ? (ultimoFechado.valor_fechamento || ultimoFechado.saldo_esperado) : 0
      }

      const faturamentos = caixasFechados.map(c => c.total_entradas)
      const mediaFaturamento = faturamentos.length > 0 
        ? faturamentos.reduce((a, b) => a + b, 0) / faturamentos.length 
        : 0
      const diferencaAcumulada = caixasFechados.reduce((acc, caixa) => acc + Number(caixa.diferenca || 0), 0)

      setResumo({
        saldoAtual,
        totalEntradas,
        totalSaidas,
        totalCaixasFechados: caixasFechados.length,
        mediaFaturamentoDiario: mediaFaturamento,
        maiorFaturamento: Math.max(...faturamentos, 0),
        menorFaturamento: faturamentos.length > 0 ? Math.min(...faturamentos) : 0,
        diferencaAcumulada,
        caixaAberto: Boolean(caixaAberto),
      })

    // Verificar se há caixa aberto
      const caixaAbertoEncontrado = caixasData?.find(c => c.status === 'aberto') || null
      setCaixaAberto(caixaAbertoEncontrado as Caixa | null)

    } catch (erro) {
      console.error('Erro ao carregar dados:', erro)
    } finally {
      setCarregando(false)
    }
  }, [periodoFiltro])

  useEffect(() => {
    carregarDados()
  }, [carregarDados])

  useEffect(() => {
    const canal = supabase
      .channel('saldos-realtime-' + Date.now())
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'caixas' },
        () => {
          carregarDados()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'movimentacoes_caixa' },
        () => {
          carregarDados()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(canal)
    }
  }, [carregarDados])

  // Função para registrar ajuste de saldo
  const registrarAjuste = async () => {
    if (!caixaAberto || !valorAjuste || !descricaoAjuste) return

    setProcessandoAjuste(true)
    try {
      // Buscar categoria "Ajuste de Saldo" ou criar uma genérica
      const { data: categorias } = await supabase
        .from('categorias_caixa')
        .select('id')
        .eq('nome', 'Ajuste de Saldo')
        .maybeSingle()

      let categoriaId = categorias?.id

      // Se não existir, buscar "Outros" ou a primeira categoria disponível
      if (!categoriaId) {
        const { data: outrasCategorias } = await supabase
          .from('categorias_caixa')
          .select('id')
          .eq('ativo', true)
          .limit(1)
          .single()
        categoriaId = outrasCategorias?.id
      }

      // Inserir movimentação de ajuste
      const { error } = await supabase.from('movimentacoes_caixa').insert({
        caixa_id: caixaAberto.id,
        categoria_id: categoriaId,
        tipo: tipoAjuste,
        valor: Math.abs(parseFloat(valorAjuste)),
        descricao: `Ajuste de Saldo: ${descricaoAjuste}`,
        forma_pagamento: 'Ajuste'
      })

      if (error) throw error

      // Fechar modal e recarregar dados
      setModalAjuste(false)
      setValorAjuste('')
      setDescricaoAjuste('')
      carregarDados()
    } catch (erro) {
      console.error('Erro ao registrar ajuste:', erro)
    } finally {
      setProcessandoAjuste(false)
    }
  }

  const abrirModalAjuste = (tipo: 'entrada' | 'saida') => {
    setTipoAjuste(tipo)
    setModalAjuste(true)
  }

  // Filtrar movimentações por caixa selecionado e busca
  const movimentacoesFiltradas = movimentacoes.filter(m => {
    const passaCaixa = !caixaSelecionado || m.caixa_id === caixaSelecionado
    const passaBusca = !busca || 
      m.descricao?.toLowerCase().includes(busca.toLowerCase()) ||
      m.categoria?.nome.toLowerCase().includes(busca.toLowerCase()) ||
      m.funcionario?.nome.toLowerCase().includes(busca.toLowerCase())
    return passaCaixa && passaBusca
  })

  // Agrupar movimentações por data
  const movimentacoesAgrupadas = movimentacoesFiltradas.reduce((acc, mov) => {
    const data = format(parseISO(mov.created_at), 'yyyy-MM-dd')
    if (!acc[data]) {
      acc[data] = []
    }
    acc[data].push(mov)
    return acc
  }, {} as Record<string, Movimentacao[]>)

  const entradasPorFormaPagamento = useMemo(() => {
    const agrupado = movimentacoesFiltradas.reduce<Record<string, number>>((acc, mov) => {
      if (mov.tipo !== 'entrada') return acc
      const forma = (mov.forma_pagamento || 'Não informado').trim() || 'Não informado'
      acc[forma] = (acc[forma] || 0) + Number(mov.valor || 0)
      return acc
    }, {})

    const total = Object.values(agrupado).reduce((sum, valor) => sum + valor, 0)

    return Object.entries(agrupado)
      .map(([forma, valor]) => ({
        forma,
        valor,
        percentual: total > 0 ? (valor / total) * 100 : 0,
      }))
      .sort((a, b) => b.valor - a.valor)
  }, [movimentacoesFiltradas])

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)
  }

  if (carregando) {
    return (
      <ProtectedRoute><AdminLayout>
        <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
          <RefreshCw className="w-10 h-10 text-bordo-600 animate-spin" />
          <p className="text-zinc-600 dark:text-zinc-400">Carregando saldos...</p>
        </div>
      </AdminLayout></ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute><AdminLayout>
      <div className="space-y-3">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Link 
              href="/admin/caixa"
              className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors flex-shrink-0"
            >
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <Wallet className="w-5 h-5 text-bordo-600 flex-shrink-0" />
                <span className="truncate">Extrato de Saldos</span>
              </h1>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 truncate">
                Visão consolidada de todos os caixas
              </p>
            </div>
          </div>
          <button
            onClick={carregarDados}
            className="p-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-xl transition-colors flex-shrink-0"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        
        {/* Botões de ajuste */}
        {caixaAberto && (
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => abrirModalAjuste('entrada')}
              className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2 text-sm"
            >
              <Plus className="w-4 h-4" />
              Entrada
            </button>
            <button
              onClick={() => abrirModalAjuste('saida')}
              className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2 text-sm"
            >
              <Minus className="w-4 h-4" />
              Saída
            </button>
          </div>
        )}

        {/* Aviso se não há caixa aberto */}
        {!caixaAberto && (
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
            <p className="text-amber-700 dark:text-amber-400 text-xs sm:text-sm">
              <strong>Atenção:</strong> Não há caixa aberto. Abra um caixa para poder registrar ajustes de saldo.
            </p>
          </div>
        )}

        {/* Cards de Resumo */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <div className="rounded-2xl border border-bordo-200 bg-gradient-to-br from-bordo-50 to-white p-3 shadow-sm dark:border-bordo-500/30 dark:from-bordo-900/20 dark:to-zinc-900">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[11px] font-medium text-zinc-600 dark:text-zinc-300">Saldo Atual</span>
              <Wallet className="h-4 w-4 text-bordo-600 dark:text-amber-300" />
            </div>
            <p className="truncate text-base font-bold text-bordo-700 dark:text-amber-300">{formatarMoeda(resumo.saldoAtual)}</p>
            <p className="mt-1 text-[10px] text-zinc-500">{resumo.caixaAberto ? 'Caixa aberto' : 'Último fechamento'}</p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[11px] text-zinc-600 dark:text-zinc-400">Entradas</span>
              <ArrowUpCircle className="h-4 w-4 text-green-500" />
            </div>
            <p className="truncate text-base font-bold text-green-600">{formatarMoeda(resumo.totalEntradas)}</p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[11px] text-zinc-600 dark:text-zinc-400">Saídas</span>
              <ArrowDownCircle className="h-4 w-4 text-red-500" />
            </div>
            <p className="truncate text-base font-bold text-red-600">{formatarMoeda(resumo.totalSaidas)}</p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[11px] text-zinc-600 dark:text-zinc-400">Média diária</span>
              <TrendingUp className="h-4 w-4 text-blue-500" />
            </div>
            <p className="truncate text-base font-bold text-blue-600">{formatarMoeda(resumo.mediaFaturamentoDiario)}</p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[11px] text-zinc-600 dark:text-zinc-400">Caixas fechados</span>
              <Calendar className="h-4 w-4 text-zinc-500" />
            </div>
            <p className="truncate text-base font-bold text-zinc-800 dark:text-zinc-100">{resumo.totalCaixasFechados}</p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[11px] text-zinc-600 dark:text-zinc-400">Diferença acumulada</span>
              <DollarSign className="h-4 w-4 text-violet-500" />
            </div>
            <p className={`truncate text-base font-bold ${resumo.diferencaAcumulada >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {resumo.diferencaAcumulada >= 0 ? '+' : ''}{formatarMoeda(resumo.diferencaAcumulada)}
            </p>
          </div>
        </div>

        {/* Entradas por forma de pagamento */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              <CreditCard className="h-4 w-4 text-bordo-600 dark:text-amber-300" />
              Saldos por forma de pagamento
            </h2>
            <span className="text-xs text-zinc-500">Somente entradas</span>
          </div>

          {entradasPorFormaPagamento.length === 0 ? (
            <p className="text-xs text-zinc-500">Sem dados no período selecionado.</p>
          ) : (
            <div className="space-y-2">
              {entradasPorFormaPagamento.slice(0, 6).map((item) => (
                <div key={item.forma} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-zinc-700 dark:text-zinc-200">{item.forma}</span>
                    <span className="text-zinc-500">{formatarMoeda(item.valor)} • {item.percentual.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-zinc-100 dark:bg-zinc-800">
                    <div
                      className="h-2 rounded-full bg-bordo-500 dark:bg-amber-400"
                      style={{ width: `${Math.max(4, item.percentual)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Filtros */}
        <div className="flex flex-col gap-2">
          {/* Período */}
          <div className="grid grid-cols-4 bg-zinc-100 dark:bg-zinc-800 rounded-xl p-1">
            {[
              { valor: '7dias', label: '7d' },
              { valor: '30dias', label: '30d' },
              { valor: 'mes', label: 'Mês' },
              { valor: 'todos', label: 'Todos' }
            ].map(({ valor, label }) => (
              <button
                key={valor}
                onClick={() => setPeriodoFiltro(valor as typeof periodoFiltro)}
                className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-colors text-center ${
                  periodoFiltro === valor
                    ? 'bg-white dark:bg-zinc-700 text-bordo-600 shadow-sm'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Busca */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar movimentação..."
              className="w-full pl-9 pr-3 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-xl text-sm
                       border-0 focus:ring-2 focus:ring-bordo-500"
            />
          </div>
        </div>

        {/* Lista de Caixas */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <div className="p-3 sm:p-4 border-b border-zinc-200 dark:border-zinc-800">
            <h2 className="font-semibold text-zinc-900 dark:text-white flex items-center gap-2 text-sm sm:text-base">
              <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-bordo-600" />
              Histórico de Caixas
            </h2>
          </div>

          <div className="divide-y divide-zinc-100 dark:divide-zinc-800 max-h-[400px] overflow-y-auto">
            {caixas.length === 0 ? (
              <div className="p-8 text-center text-zinc-500">
                Nenhum caixa encontrado no período selecionado
              </div>
            ) : (
              caixas.map((caixa) => (
                <motion.div
                  key={caixa.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className={`p-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer transition-colors ${
                    caixaSelecionado === caixa.id ? 'bg-amber-50 dark:bg-amber-950/20' : ''
                  }`}
                  onClick={() => setCaixaSelecionado(caixaSelecionado === caixa.id ? null : caixa.id)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className={`p-1.5 sm:p-2 rounded-xl flex-shrink-0 ${
                        caixa.status === 'aberto' 
                          ? 'bg-green-100 dark:bg-green-900/30' 
                          : 'bg-zinc-100 dark:bg-zinc-800'
                      }`}>
                        <Calendar className={`w-4 h-4 sm:w-5 sm:h-5 ${
                          caixa.status === 'aberto' ? 'text-green-600' : 'text-zinc-500'
                        }`} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-zinc-900 dark:text-white text-sm truncate">
                          {format(parseISO(caixa.data_abertura), "dd 'de' MMMM", { locale: ptBR })}
                        </p>
                        <p className="text-xs text-zinc-500 truncate">
                          {caixa.responsavel_abertura} • {caixa.status === 'aberto' ? 'Aberto' : 'Fechado'}
                        </p>
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <p className={`font-bold text-sm ${
                        caixa.status === 'aberto' ? 'text-green-600' : 'text-zinc-900 dark:text-white'
                      }`}>
                        {formatarMoeda(caixa.valor_fechamento || caixa.saldo_esperado)}
                      </p>
                      <div className="flex flex-col items-end gap-0.5 text-[10px]">
                        <span className="text-green-600 font-mono">+{formatarMoeda(caixa.total_entradas)}</span>
                        <span className="text-red-600 font-mono">-{formatarMoeda(caixa.total_saidas)}</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>

        {/* Extrato de Movimentações */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <div className="p-3 border-b border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold text-zinc-900 dark:text-white flex items-center gap-2 text-sm">
                <Banknote className="w-4 h-4 text-bordo-600 flex-shrink-0" />
                Extrato Detalhado
              </h2>
              <span className="text-xs text-zinc-500 flex-shrink-0">
                {movimentacoesFiltradas.length} mov.
              </span>
            </div>
          </div>

          <div className="max-h-[500px] overflow-y-auto">
            {Object.keys(movimentacoesAgrupadas).length === 0 ? (
              <div className="p-8 text-center text-zinc-500">
                Nenhuma movimentação encontrada
              </div>
            ) : (
              Object.entries(movimentacoesAgrupadas).map(([data, movs]) => (
                <div key={data}>
                  {/* Cabeçalho da data */}
                  <div className="sticky top-0 bg-zinc-50 dark:bg-zinc-800 px-4 py-2 border-b border-zinc-200 dark:border-zinc-700">
                    <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                      {format(parseISO(data), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                    </p>
                  </div>

                  {/* Movimentações do dia */}
                  <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {movs.map((mov) => (
                      <div key={mov.id} className="p-3 sm:p-4 flex items-center gap-2 sm:gap-4">
                        {/* Ícone */}
                        <div className={`p-1.5 sm:p-2 rounded-xl flex-shrink-0 ${
                          mov.tipo === 'entrada' 
                            ? 'bg-green-100 dark:bg-green-900/30' 
                            : 'bg-red-100 dark:bg-red-900/30'
                        }`}>
                          {mov.tipo === 'entrada' ? (
                            <ArrowUpCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                          ) : (
                            <ArrowDownCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-600" />
                          )}
                        </div>

                        {/* Detalhes */}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-zinc-900 dark:text-white truncate">
                            {mov.categoria?.nome || 'Sem categoria'}
                          </p>
                          <p className="text-xs text-zinc-500 truncate">
                            {mov.descricao || 'Sem descrição'}
                            {mov.funcionario && ` • ${mov.funcionario.nome}`}
                          </p>
                          <p className="text-xs text-zinc-400">
                            {format(parseISO(mov.created_at), 'HH:mm')}
                            {mov.forma_pagamento && ` • ${mov.forma_pagamento}`}
                          </p>
                        </div>

                        {/* Valor */}
                        <div className="text-right">
                          <p className={`font-bold ${
                            mov.tipo === 'entrada' ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {mov.tipo === 'entrada' ? '+' : '-'}{formatarMoeda(mov.valor)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Modal de Ajuste de Saldo */}
      <AnimatePresence>
        {modalAjuste && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={() => !processandoAjuste && setModalAjuste(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-zinc-900 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md overflow-hidden max-h-[90dvh] flex flex-col"
            >
              <div className={`p-6 border-b border-zinc-200 dark:border-zinc-800 ${
                tipoAjuste === 'entrada' 
                  ? 'bg-green-50 dark:bg-green-950/20' 
                  : 'bg-red-50 dark:bg-red-950/20'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${
                      tipoAjuste === 'entrada'
                        ? 'bg-green-100 dark:bg-green-900/30'
                        : 'bg-red-100 dark:bg-red-900/30'
                    }`}>
                      {tipoAjuste === 'entrada' ? (
                        <Plus className={`w-6 h-6 text-green-600`} />
                      ) : (
                        <Minus className={`w-6 h-6 text-red-600`} />
                      )}
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
                        {tipoAjuste === 'entrada' ? 'Adicionar ao Saldo' : 'Retirar do Saldo'}
                      </h2>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400">
                        Ajuste manual no caixa atual
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setModalAjuste(false)}
                    disabled={processandoAjuste}
                    className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-xl transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    Valor (R$) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={valorAjuste}
                    onChange={(e) => setValorAjuste(e.target.value)}
                    placeholder="0,00"
                    disabled={processandoAjuste}
                    autoFocus
                    className={`w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border-2 rounded-xl 
                             text-zinc-900 dark:text-white text-lg font-bold
                             focus:ring-2 focus:border-transparent
                             disabled:opacity-50 disabled:cursor-not-allowed ${
                               tipoAjuste === 'entrada'
                                 ? 'border-green-300 focus:ring-green-500'
                                 : 'border-red-300 focus:ring-red-500'
                             }`}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    Descrição / Motivo *
                  </label>
                  <textarea
                    value={descricaoAjuste}
                    onChange={(e) => setDescricaoAjuste(e.target.value)}
                    placeholder="Ex: Troco inicial, Sangria, Correção de valor..."
                    rows={3}
                    disabled={processandoAjuste}
                    className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 
                             dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white resize-none
                             focus:ring-2 focus:ring-bordo-500 focus:border-transparent
                             disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>

                {caixaAberto && (
                  <div className="bg-zinc-50 dark:bg-zinc-800 rounded-xl p-3 text-sm">
                    <p className="text-zinc-600 dark:text-zinc-400">
                      Caixa: <span className="font-medium text-zinc-900 dark:text-white">
                        {format(parseISO(caixaAberto.data_abertura), "dd/MM/yyyy 'às' HH:mm")}
                      </span>
                    </p>
                    <p className="text-zinc-600 dark:text-zinc-400">
                      Responsável: <span className="font-medium text-zinc-900 dark:text-white">
                        {caixaAberto.responsavel_abertura}
                      </span>
                    </p>
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-zinc-200 dark:border-zinc-800 flex gap-3">
                <button
                  onClick={() => setModalAjuste(false)}
                  disabled={processandoAjuste}
                  className="flex-1 px-4 py-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 
                           dark:text-zinc-300 rounded-xl font-medium hover:bg-zinc-200 
                           dark:hover:bg-zinc-700 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={registrarAjuste}
                  disabled={!valorAjuste || !descricaoAjuste || processandoAjuste}
                  className={`flex-1 px-4 py-3 text-white rounded-xl font-medium 
                           transition-colors flex items-center justify-center gap-2 
                           disabled:opacity-50 disabled:cursor-not-allowed ${
                             tipoAjuste === 'entrada'
                               ? 'bg-green-600 hover:bg-green-700'
                               : 'bg-red-600 hover:bg-red-700'
                           }`}
                >
                  {processandoAjuste ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      {tipoAjuste === 'entrada' ? <Plus className="w-5 h-5" /> : <Minus className="w-5 h-5" />}
                      {tipoAjuste === 'entrada' ? 'Adicionar' : 'Retirar'}
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AdminLayout></ProtectedRoute>
  )
}
