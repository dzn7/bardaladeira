'use client'

import { useState, useEffect, useMemo } from 'react'
import { ChartBar, Users, ArrowLeft } from '@phosphor-icons/react'
import { format, subDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval } from 'date-fns'
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
import {
  CabecalhoPagina,
  Campo,
  Cartao,
  Entrada,
  Lista,
  ListaCarregando,
  ListaVazia,
  Pagina,
  Secao,
  Segmentos,
} from '@/components/admin/ui'
import { cn } from '@/lib/utils'
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

  const moeda = (valor: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)

  const resumoCards = [
    {
      rotulo: 'Entradas',
      valor: moeda(estatisticas.totalEntradas),
      detalhe: `${estatisticas.quantidadeEntradas} movimentações`,
      classe: 'text-emerald-700 dark:text-emerald-400',
    },
    {
      rotulo: 'Saídas',
      valor: moeda(estatisticas.totalSaidas),
      detalhe: `${estatisticas.quantidadeSaidas} movimentações`,
      classe: 'text-destructive',
    },
    {
      rotulo: 'Saldo do período',
      valor: moeda(estatisticas.saldoPeriodo),
      detalhe: 'Entradas menos saídas',
      classe: estatisticas.saldoPeriodo >= 0 ? 'text-foreground' : 'text-destructive',
    },
    {
      rotulo: 'Funcionários',
      valor: String(gastosPorFuncionario.length),
      detalhe: 'Com gastos no período',
      classe: 'text-foreground',
    },
  ]

  return (
    <ProtectedRoute><AdminLayout>
      <Pagina className="min-w-0">
        <div className="flex items-start gap-2">
          <Link
            href="/admin/caixa"
            aria-label="Voltar para o caixa"
            className="-ml-2 flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <CabecalhoPagina
              titulo="Relatórios do caixa"
              descricao={`${format(new Date(dataInicio), 'dd/MM/yyyy', { locale: ptBR })} até ${format(new Date(dataFim), 'dd/MM/yyyy', { locale: ptBR })}`}
            />
          </div>
        </div>

        <div className="space-y-3">
          <Segmentos
            rotuloAcessivel="Período"
            valor={periodo}
            aoMudar={setPeriodo}
            opcoes={[
              { valor: '7dias', rotulo: '7 dias' },
              { valor: '30dias', rotulo: '30 dias' },
              { valor: 'semana', rotulo: 'Esta semana' },
              { valor: 'mes', rotulo: 'Este mês' },
              { valor: 'personalizado', rotulo: 'Escolher datas' },
            ]}
          />
          {periodo === 'personalizado' && (
            <div className="grid grid-cols-2 gap-2 sm:max-w-md">
              <Campo rotulo="De" htmlFor="relatorio-inicio">
                <Entrada id="relatorio-inicio" type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
              </Campo>
              <Campo rotulo="Até" htmlFor="relatorio-fim">
                <Entrada id="relatorio-fim" type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
              </Campo>
            </div>
          )}
        </div>

        {carregando ? (
          <ListaCarregando linhas={4} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              {resumoCards.map((card) => (
                <Cartao key={card.rotulo} className="p-3">
                  <p className="truncate text-[13px] text-muted-foreground">{card.rotulo}</p>
                  <p className={cn('mt-0.5 truncate text-lg font-semibold tabular-nums', card.classe)}>{card.valor}</p>
                  <p className="truncate text-[13px] text-muted-foreground">{card.detalhe}</p>
                </Cartao>
              ))}
            </div>

            <Secao titulo="Entradas e saídas por dia">
              <Cartao className="p-3">
                <div className="h-48 sm:h-60">
                  <Line data={dadosEvolucaoDiaria} options={opcoesLinha} />
                </div>
              </Cartao>
            </Secao>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-3">
              <Secao titulo="Gastos por categoria">
                <Cartao className="p-3">
                  <div className="h-44 sm:h-48">
                    <Bar data={dadosCategoriasSaida} options={opcoesGrafico} />
                  </div>
                </Cartao>
              </Secao>
              <Secao titulo="Gastos por funcionário">
                <Cartao className="p-3">
                  <div className="h-44 sm:h-48">
                    {gastosPorFuncionario.length > 0 ? (
                      <Bar data={dadosGastosFuncionario} options={opcoesGrafico} />
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                        Sem gastos com funcionários
                      </div>
                    )}
                  </div>
                </Cartao>
              </Secao>
            </div>

            <Secao
              titulo="Por funcionário"
              acao={
                gastosPorFuncionario.length > 0 ? (
                  <span className="text-sm font-semibold tabular-nums text-destructive">
                    {moeda(gastosPorFuncionario.reduce((acc, f) => acc + f.total, 0))}
                  </span>
                ) : null
              }
            >
              {gastosPorFuncionario.length > 0 ? (
                <Lista>
                  {gastosPorFuncionario.map((func, i) => {
                    const funcionarioInfo = funcionarios.find(f => f.nome === func.nome)
                    return (
                      <li key={i} className="flex min-h-14 items-center justify-between gap-3 px-4 py-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">{func.nome}</p>
                          <p className="truncate text-sm text-muted-foreground">
                            {funcionarioInfo?.cargo || 'Sem cargo'} · {func.quantidade} {func.quantidade === 1 ? 'movimentação' : 'movimentações'}
                          </p>
                        </div>
                        <p className="shrink-0 font-semibold tabular-nums text-destructive">{moeda(func.total)}</p>
                      </li>
                    )
                  })}
                </Lista>
              ) : (
                <ListaVazia icone={<Users />} titulo="Nenhum gasto com funcionário no período" />
              )}
            </Secao>

            <Secao titulo="Por categoria">
              {movimentacoesPorCategoria.length > 0 ? (
                <Lista>
                  {movimentacoesPorCategoria.map((cat, i) => {
                    const totalGeral = cat.tipo === 'entrada' ? estatisticas.totalEntradas : estatisticas.totalSaidas
                    const percentual = totalGeral > 0 ? (cat.total / totalGeral) * 100 : 0
                    return (
                      <li key={i} className="flex min-h-14 items-center justify-between gap-3 px-4 py-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: cat.cor }} aria-hidden />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-foreground">{cat.nome}</p>
                            <p className="text-sm text-muted-foreground">
                              {percentual.toFixed(1)}% das {cat.tipo === 'entrada' ? 'entradas' : 'saídas'}
                            </p>
                          </div>
                        </div>
                        <p
                          className={cn(
                            'shrink-0 font-semibold tabular-nums',
                            cat.tipo === 'entrada' ? 'text-emerald-700 dark:text-emerald-400' : 'text-destructive',
                          )}
                        >
                          {moeda(cat.total)}
                        </p>
                      </li>
                    )
                  })}
                </Lista>
              ) : (
                <ListaVazia icone={<ChartBar />} titulo="Nenhuma movimentação no período" descricao="Escolha outro período acima." />
              )}
            </Secao>
          </>
        )}
      </Pagina>
    </AdminLayout></ProtectedRoute>
  )
}
