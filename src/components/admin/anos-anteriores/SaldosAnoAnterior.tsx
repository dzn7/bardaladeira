'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { 
  Wallet, TrendingUp, TrendingDown, Calendar, 
  ArrowUpCircle, ArrowDownCircle, Clock, RefreshCw, Eye, X
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { supabase } from '@/lib/supabase'
import { obterDataInicioAno, obterDataFimAno } from '@/lib/filtros-ano'

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
  totalEntradas: number
  totalSaidas: number
  totalCaixasFechados: number
  mediaFaturamentoDiario: number
  maiorFaturamento: number
  menorFaturamento: number
  saldoFinal: number
}

type SaldosAnoAnteriorProps = {
  ano: number
}

const formatarMoeda = (valor: number): string => {
  return valor.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

export default function SaldosAnoAnterior({ ano }: SaldosAnoAnteriorProps) {
  const [caixas, setCaixas] = useState<Caixa[]>([])
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([])
  const [resumo, setResumo] = useState<ResumoSaldos>({
    totalEntradas: 0,
    totalSaidas: 0,
    totalCaixasFechados: 0,
    mediaFaturamentoDiario: 0,
    maiorFaturamento: 0,
    menorFaturamento: 0,
    saldoFinal: 0
  })
  const [carregando, setCarregando] = useState(true)
  const [caixaSelecionado, setCaixaSelecionado] = useState<string | null>(null)

  const carregarDados = useCallback(async () => {
    setCarregando(true)
    try {
      const dataInicio = obterDataInicioAno(ano)
      const dataFim = obterDataFimAno(ano)

      const [caixasRes, movsRes] = await Promise.all([
        supabase
          .from('caixas')
          .select('*')
          .gte('data_abertura', dataInicio)
          .lt('data_abertura', dataFim)
          .order('data_abertura', { ascending: false }),
        supabase
          .from('movimentacoes_caixa')
          .select('*, categoria:categorias_caixa(*), funcionario:funcionarios(*)')
          .gte('created_at', dataInicio)
          .lt('created_at', dataFim)
          .order('created_at', { ascending: false })
      ])

      const caixasFormatados = (caixasRes.data || []).map(c => ({
        ...c,
        valor_abertura: Number(c.valor_abertura),
        valor_fechamento: c.valor_fechamento ? Number(c.valor_fechamento) : null,
        total_entradas: Number(c.total_entradas || 0),
        total_saidas: Number(c.total_saidas || 0),
        saldo_esperado: Number(c.saldo_esperado || 0),
        diferenca: c.diferenca ? Number(c.diferenca) : null
      }))

      const movsFormatadas = (movsRes.data || []).map(m => ({
        ...m,
        valor: Number(m.valor)
      }))

      setCaixas(caixasFormatados)
      setMovimentacoes(movsFormatadas)

      const caixasFechados = caixasFormatados.filter(c => c.status === 'fechado')
      const totalEntradas = movsFormatadas.filter(m => m.tipo === 'entrada').reduce((acc, m) => acc + m.valor, 0)
      const totalSaidas = movsFormatadas.filter(m => m.tipo === 'saida').reduce((acc, m) => acc + m.valor, 0)
      
      const faturamentos = caixasFechados.map(c => c.total_entradas)
      const mediaFaturamento = faturamentos.length > 0 
        ? faturamentos.reduce((a, b) => a + b, 0) / faturamentos.length 
        : 0

      const ultimoCaixa = caixasFechados[0]
      const saldoFinal = ultimoCaixa 
        ? (ultimoCaixa.valor_fechamento || ultimoCaixa.saldo_esperado) 
        : 0

      setResumo({
        totalEntradas,
        totalSaidas,
        totalCaixasFechados: caixasFechados.length,
        mediaFaturamentoDiario: mediaFaturamento,
        maiorFaturamento: Math.max(...faturamentos, 0),
        menorFaturamento: faturamentos.length > 0 ? Math.min(...faturamentos) : 0,
        saldoFinal
      })
    } catch (erro) {
      console.error('Erro ao carregar saldos:', erro)
    } finally {
      setCarregando(false)
    }
  }, [ano])

  useEffect(() => {
    carregarDados()
  }, [carregarDados])

  const movimentacoesDoCaixa = caixaSelecionado 
    ? movimentacoes.filter(m => m.caixa_id === caixaSelecionado)
    : []

  if (carregando) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <RefreshCw className="w-8 h-8 text-amber-600 animate-spin" />
        <p className="text-zinc-600 dark:text-zinc-400">Carregando saldos de {ano}...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Cards de Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-4 text-white"
        >
          <div className="flex items-center gap-2 mb-2">
            <ArrowUpCircle className="w-5 h-5" />
            <span className="text-sm font-medium">Entradas</span>
          </div>
          <p className="text-2xl font-bold">R$ {formatarMoeda(resumo.totalEntradas)}</p>
          <p className="text-green-100 text-xs mt-1">Total do ano {ano}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-4 text-white"
        >
          <div className="flex items-center gap-2 mb-2">
            <ArrowDownCircle className="w-5 h-5" />
            <span className="text-sm font-medium">Saídas</span>
          </div>
          <p className="text-2xl font-bold">R$ {formatarMoeda(resumo.totalSaidas)}</p>
          <p className="text-red-100 text-xs mt-1">Total do ano {ano}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-4 text-white"
        >
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5" />
            <span className="text-sm font-medium">Média Diária</span>
          </div>
          <p className="text-2xl font-bold">R$ {formatarMoeda(resumo.mediaFaturamentoDiario)}</p>
          <p className="text-amber-100 text-xs mt-1">{resumo.totalCaixasFechados} caixas</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white"
        >
          <div className="flex items-center gap-2 mb-2">
            <Wallet className="w-5 h-5" />
            <span className="text-sm font-medium">Saldo Final</span>
          </div>
          <p className="text-2xl font-bold">R$ {formatarMoeda(resumo.saldoFinal)}</p>
          <p className="text-blue-100 text-xs mt-1">31/12/{ano}</p>
        </motion.div>
      </div>

      {/* Estatísticas adicionais */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-green-600" />
            <span className="text-sm text-zinc-600 dark:text-zinc-400">Maior Faturamento</span>
          </div>
          <p className="text-xl font-bold text-zinc-900 dark:text-white">
            R$ {formatarMoeda(resumo.maiorFaturamento)}
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="w-5 h-5 text-red-600" />
            <span className="text-sm text-zinc-600 dark:text-zinc-400">Menor Faturamento</span>
          </div>
          <p className="text-xl font-bold text-zinc-900 dark:text-white">
            R$ {formatarMoeda(resumo.menorFaturamento)}
          </p>
        </div>
      </div>

      {/* Lista de Caixas */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-700">
          <h3 className="font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-amber-600" />
            Histórico de Caixas - {ano}
          </h3>
        </div>

        {caixas.length === 0 ? (
          <div className="p-12 text-center">
            <Wallet className="w-16 h-16 mx-auto text-zinc-300 dark:text-zinc-700 mb-4" />
            <p className="text-zinc-500 dark:text-zinc-400">Nenhum caixa encontrado em {ano}</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-200 dark:divide-zinc-700">
            {caixas.map((caixa, index) => (
              <motion.div
                key={caixa.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: index * 0.05 }}
                className="p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-lg ${
                      caixa.status === 'aberto' 
                        ? 'bg-green-100 dark:bg-green-900/30' 
                        : 'bg-zinc-100 dark:bg-zinc-800'
                    }`}>
                      <Calendar className={`w-5 h-5 ${
                        caixa.status === 'aberto' ? 'text-green-600' : 'text-zinc-500'
                      }`} />
                    </div>
                    <div>
                      <p className="font-medium text-zinc-900 dark:text-white">
                        {format(new Date(caixa.data_abertura), "dd/MM/yyyy", { locale: ptBR })}
                      </p>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">
                        {caixa.responsavel_abertura}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">Entradas</p>
                      <p className="font-medium text-green-600">
                        R$ {formatarMoeda(caixa.total_entradas)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">Saídas</p>
                      <p className="font-medium text-red-600">
                        R$ {formatarMoeda(caixa.total_saidas)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">Saldo</p>
                      <p className="font-bold text-amber-600">
                        R$ {formatarMoeda(caixa.valor_fechamento || caixa.saldo_esperado)}
                      </p>
                    </div>
                    <button
                      onClick={() => setCaixaSelecionado(caixa.id)}
                      className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors"
                    >
                      <Eye className="w-5 h-5 text-zinc-500" />
                    </button>
                  </div>
                </div>

                {caixa.diferenca && caixa.diferenca !== 0 && (
                  <div className={`mt-2 text-sm ${
                    caixa.diferenca > 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    Diferença: R$ {formatarMoeda(caixa.diferenca)}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de Detalhes */}
      {caixaSelecionado && (
        <>
          <div 
            className="fixed inset-0 bg-black/50 z-50"
            onClick={() => setCaixaSelecionado(null)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden"
            >
              <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
                <h3 className="font-bold text-zinc-900 dark:text-white">
                  Movimentações do Caixa
                </h3>
                <button 
                  onClick={() => setCaixaSelecionado(null)}
                  className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-4 max-h-[60vh] overflow-y-auto">
                {movimentacoesDoCaixa.length === 0 ? (
                  <p className="text-center text-zinc-500 py-8">
                    Nenhuma movimentação encontrada
                  </p>
                ) : (
                  <div className="space-y-2">
                    {movimentacoesDoCaixa.map((mov) => (
                      <div 
                        key={mov.id}
                        className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${
                            mov.tipo === 'entrada' 
                              ? 'bg-green-100 dark:bg-green-900/30' 
                              : 'bg-red-100 dark:bg-red-900/30'
                          }`}>
                            {mov.tipo === 'entrada' 
                              ? <ArrowUpCircle className="w-4 h-4 text-green-600" />
                              : <ArrowDownCircle className="w-4 h-4 text-red-600" />
                            }
                          </div>
                          <div>
                            <p className="font-medium text-zinc-900 dark:text-white text-sm">
                              {mov.descricao || mov.categoria?.nome || 'Movimentação'}
                            </p>
                            <p className="text-xs text-zinc-500">
                              {format(new Date(mov.created_at), "dd/MM HH:mm", { locale: ptBR })}
                            </p>
                          </div>
                        </div>
                        <span className={`font-bold ${
                          mov.tipo === 'entrada' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {mov.tipo === 'entrada' ? '+' : '-'} R$ {formatarMoeda(mov.valor)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </div>
  )
}
