'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { 
  Users, DollarSign, Calendar, RefreshCw, TrendingDown,
  User, Briefcase
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { supabase } from '@/lib/supabase'
import { obterDataInicioAno, obterDataFimAno } from '@/lib/filtros-ano'

type PagamentoFuncionario = {
  id: string
  funcionario_nome: string
  cargo: string
  valor: number
  data: string
}

type ResumoFuncionario = {
  nome: string
  cargo: string
  totalPago: number
  quantidadePagamentos: number
}

type SalariosAnoAnteriorProps = {
  ano: number
}

export default function SalariosAnoAnterior({ ano }: SalariosAnoAnteriorProps) {
  const [pagamentos, setPagamentos] = useState<PagamentoFuncionario[]>([])
  const [resumoPorFuncionario, setResumoPorFuncionario] = useState<ResumoFuncionario[]>([])
  const [totalGeral, setTotalGeral] = useState(0)
  const [carregando, setCarregando] = useState(true)

  const formatarMoeda = (valor: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(valor)
  }

  const carregarDados = useCallback(async () => {
    setCarregando(true)
    try {
      const dataInicio = obterDataInicioAno(ano)
      const dataFim = obterDataFimAno(ano)

      // Buscar ID da categoria "Pagamento Funcionário" dinamicamente
      const { data: categoriaData } = await supabase
        .from('categorias_caixa')
        .select('id')
        .eq('nome', 'Pagamento Funcionário')
        .single()

      if (!categoriaData) {
        setCarregando(false)
        return
      }

      const { data: pagamentosData, error } = await supabase
        .from('movimentacoes_caixa')
        .select(`
          id,
          valor,
          created_at,
          funcionario:funcionarios(nome, cargo)
        `)
        .eq('categoria_id', categoriaData.id)
        .gte('created_at', dataInicio)
        .lt('created_at', dataFim)
        .order('created_at', { ascending: false })

      if (error) throw error

      const pagamentosFormatados: PagamentoFuncionario[] = (pagamentosData || []).map((p: any) => ({
        id: p.id,
        funcionario_nome: p.funcionario?.nome || 'Não informado',
        cargo: p.funcionario?.cargo || 'Não informado',
        valor: Number(p.valor) || 0,
        data: p.created_at
      }))

      setPagamentos(pagamentosFormatados)

      const resumoMap = new Map<string, ResumoFuncionario>()
      let total = 0

      pagamentosFormatados.forEach(p => {
        total += p.valor
        const existing = resumoMap.get(p.funcionario_nome)
        if (existing) {
          existing.totalPago += p.valor
          existing.quantidadePagamentos += 1
        } else {
          resumoMap.set(p.funcionario_nome, {
            nome: p.funcionario_nome,
            cargo: p.cargo,
            totalPago: p.valor,
            quantidadePagamentos: 1
          })
        }
      })

      const resumoArray = Array.from(resumoMap.values())
        .sort((a, b) => b.totalPago - a.totalPago)

      setResumoPorFuncionario(resumoArray)
      setTotalGeral(total)
    } catch (erro) {
      console.error('Erro ao carregar salários:', erro)
    } finally {
      setCarregando(false)
    }
  }, [ano])

  useEffect(() => {
    carregarDados()
  }, [carregarDados])

  if (carregando) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <RefreshCw className="w-8 h-8 text-amber-600 animate-spin" />
        <p className="text-zinc-600 dark:text-zinc-400">Carregando salários de {ano}...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Card Total Geral */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-6 text-white"
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="w-6 h-6" />
              <span className="text-lg font-medium">Total Gasto com Salários</span>
            </div>
            <p className="text-4xl font-bold">{formatarMoeda(totalGeral)}</p>
            <p className="text-red-100 text-sm mt-2">
              {pagamentos.length} pagamentos em {ano}
            </p>
          </div>
          <div className="text-right">
            <p className="text-red-100 text-sm">Funcionários pagos</p>
            <p className="text-3xl font-bold">{resumoPorFuncionario.length}</p>
          </div>
        </div>
      </motion.div>

      {/* Resumo por Funcionário */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-700">
          <h3 className="font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-600" />
            Resumo por Funcionário - {ano}
          </h3>
        </div>

        {resumoPorFuncionario.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-16 h-16 mx-auto text-zinc-300 dark:text-zinc-700 mb-4" />
            <p className="text-zinc-500 dark:text-zinc-400">Nenhum pagamento de salário em {ano}</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-200 dark:divide-zinc-700">
            {resumoPorFuncionario.map((funcionario, index) => (
              <motion.div
                key={funcionario.nome}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-white font-bold text-lg">
                      {funcionario.nome.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-zinc-900 dark:text-white text-lg">
                        {funcionario.nome}
                      </p>
                      <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
                        <Briefcase className="w-4 h-4" />
                        {funcionario.cargo}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                      {formatarMoeda(funcionario.totalPago)}
                    </p>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      {funcionario.quantidadePagamentos} pagamento{funcionario.quantidadePagamentos !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>

                {/* Barra de proporção */}
                <div className="mt-3">
                  <div className="h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-red-500 to-red-400 rounded-full"
                      style={{ width: `${(funcionario.totalPago / totalGeral) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 text-right">
                    {((funcionario.totalPago / totalGeral) * 100).toFixed(1)}% do total
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Histórico de Pagamentos */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-700">
          <h3 className="font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-amber-600" />
            Histórico de Pagamentos - {ano}
          </h3>
        </div>

        {pagamentos.length === 0 ? (
          <div className="p-12 text-center">
            <DollarSign className="w-16 h-16 mx-auto text-zinc-300 dark:text-zinc-700 mb-4" />
            <p className="text-zinc-500 dark:text-zinc-400">Nenhum pagamento registrado</p>
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full">
              <thead className="bg-zinc-50 dark:bg-zinc-800 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase">
                    Funcionário
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase">
                    Cargo
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase">
                    Data
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase">
                    Valor
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
                {pagamentos.map((pagamento) => (
                  <tr 
                    key={pagamento.id}
                    className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-zinc-400" />
                        <span className="font-medium text-zinc-900 dark:text-white">
                          {pagamento.funcionario_nome}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {pagamento.cargo}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                      {format(new Date(pagamento.data), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-semibold text-red-600 dark:text-red-400">
                        {formatarMoeda(pagamento.valor)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
