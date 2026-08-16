'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Truck, MapPin, Clock, User, CheckCircle2, XCircle, RefreshCw, BarChart3,
  TrendingUp, Package, Timer, Users, Wallet, CircleDollarSign,
  PauseCircle, ChevronDown, ChevronUp, Loader2, Power, PowerOff, Ban, Undo2,
} from 'lucide-react'
import {
  format, eachDayOfInterval,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement,
  Title, Tooltip, Legend, Filler,
} from 'chart.js'
import { Bar, Line, Doughnut } from 'react-chartjs-2'
import ProtectedRoute from '@/components/admin/ProtectedRoute'
import AdminLayout from '@/components/admin/AdminLayout'
import ModalNotificacao from '@/components/ModalNotificacao'
import { FiltrosAtivosChips, type ChipFiltroAtivo } from '@/components/admin/filtros/FiltrosAtivosChips'
import { ListaSkeleton, ListaVazia } from '@/components/admin/filtros/ListaEstado'
import { Skeleton } from '@/components/ui/skeleton'
import { useEntregas } from '@/lib/useEntregas'
import { usePagamentosEntregadores } from '@/lib/usePagamentosEntregadores'
import DialogPagarEntregador from '@/components/admin/entregas/DialogPagarEntregador'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import type {
  StatusEntrega,
  ResumoEntregadorDia,
  StatusPagamentoEntregador,
  Entrega,
} from '@/lib/tipos-entregas'
import { FiltroEntregasAdmin } from '@/features/entregas/components/FiltroEntregasAdmin'
import {
  criarIntervaloEntregas,
  obterDatasPeriodoEntrega,
} from '@/features/entregas/lib/intervalo-entregas'
import type { PeriodoEntrega } from '@/features/entregas/types'

ChartJS.register(
  CategoryScale, LinearScale, BarElement, LineElement, PointElement,
  ArcElement, Title, Tooltip, Legend, Filler
)

type Aba = 'entregas' | 'pagamentos' | 'relatorios'

const formatarMoeda = (valor: number) =>
  `R$ ${Number(valor || 0).toFixed(2).replace('.', ',')}`

const CHAVE_ENTREGAS_ONLINE = 'entregas_online_ativas'

const corDotStatus: Record<StatusEntrega, string> = {
  pendente: 'bg-amber-500',
  em_rota: 'bg-blue-500',
  entregue: 'bg-emerald-500',
  cancelada: 'bg-destructive',
}

const labelStatus: Record<StatusEntrega, string> = {
  pendente: 'Pendente',
  em_rota: 'Em rota',
  entregue: 'Entregue',
  cancelada: 'Cancelada',
}

const LABEL_PERIODO: Record<PeriodoEntrega, string> = {
  todos: 'Todos',
  hoje: 'Hoje',
  '7dias': '7 dias',
  '30dias': '30 dias',
  semana: 'Semana',
  mes: 'Mês',
  personalizado: 'Personalizado',
}

const corPagamentoBadge: Record<StatusPagamentoEntregador, string> = {
  pendente: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400',
  parcial: 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400',
  pago: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  acumulado: 'border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-400',
}

const labelPagamento: Record<StatusPagamentoEntregador, string> = {
  pendente: 'Pendente',
  parcial: 'Pago parcial',
  pago: 'Pago',
  acumulado: 'Acumulado',
}

const corDotPagamento: Record<StatusPagamentoEntregador, string> = {
  pendente: 'bg-amber-500',
  parcial: 'bg-blue-500',
  pago: 'bg-emerald-500',
  acumulado: 'bg-violet-500',
}

export default function EntregasPage() {
  const [abaAtiva, setAbaAtiva] = useState<Aba>('entregas')
  const [periodo, setPeriodo] = useState<PeriodoEntrega>('7dias')
  const [datasPeriodo, setDatasPeriodo] = useState(() => obterDatasPeriodoEntrega('7dias'))
  const intervalo = useMemo(
    () => criarIntervaloEntregas(datasPeriodo.dataInicio, datasPeriodo.dataFim),
    [datasPeriodo.dataFim, datasPeriodo.dataInicio],
  )

  const {
    entregas, entregadores, estatisticas, carregando, notificacao,
    carregarDados, atualizarStatusEntrega, atribuirEntregador, alternarExclusaoRepasse,
    mostrarNotificacao, fecharNotificacao,
  } = useEntregas({
    inicioIso: intervalo.inicioIso,
    fimExclusivoIso: intervalo.fimExclusivoIso,
  })

  const {
    resumoPorDia, totaisGerais, salvando: salvandoPagamento,
    pagar, acumular, reabrir,
  } = usePagamentosEntregadores(entregas, entregadores, intervalo)

  const [filtroStatus, setFiltroStatus] = useState<StatusEntrega | 'todos'>('todos')
  const [registroPagamento, setRegistroPagamento] = useState<ResumoEntregadorDia | null>(null)
  const [dialogPagarAberto, setDialogPagarAberto] = useState(false)
  const [filtroEntregador, setFiltroEntregador] = useState<string>('todos')
  const [agruparPorEntregador, setAgruparPorEntregador] = useState(true)
  const [entregadoresExpandidos, setEntregadoresExpandidos] = useState<Set<string>>(new Set())
  const [entregasOnlineAtivas, setEntregasOnlineAtivas] = useState(true)
  const [carregandoConfigEntrega, setCarregandoConfigEntrega] = useState(true)
  const [salvandoConfigEntrega, setSalvandoConfigEntrega] = useState(false)

  const chipsFiltroAtivo = useMemo((): ChipFiltroAtivo[] => {
    const chips: ChipFiltroAtivo[] = []
    if (periodo !== '7dias') {
      chips.push({
        key: 'periodo',
        label: 'Período',
        value:
          periodo === 'personalizado'
            ? `${intervalo.dataInicio} → ${intervalo.dataFim}`
            : LABEL_PERIODO[periodo],
      })
    }
    if (filtroStatus !== 'todos') {
      chips.push({ key: 'status', label: 'Status', value: labelStatus[filtroStatus] })
    }
    if (abaAtiva === 'pagamentos' && filtroEntregador !== 'todos') {
      const nome = entregadores.find((item) => item.id === filtroEntregador)?.nome
      chips.push({ key: 'entregador', label: 'Entregador', value: nome ?? filtroEntregador })
    }
    return chips
  }, [periodo, intervalo.dataInicio, intervalo.dataFim, filtroStatus, filtroEntregador, abaAtiva, entregadores])

  const handleLimparFiltros = () => {
    setPeriodo('7dias')
    setDatasPeriodo(obterDatasPeriodoEntrega('7dias'))
    setFiltroStatus('todos')
    setFiltroEntregador('todos')
  }
  const carregarConfigEntrega = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('configuracoes_loja')
        .select('valor')
        .eq('chave', CHAVE_ENTREGAS_ONLINE)
        .maybeSingle()

      if (error) throw error

      setEntregasOnlineAtivas((data?.valor ?? 'true') !== 'false')
    } catch (error) {
      console.error('[Entregas] Erro ao carregar configuração de entregas:', error)
      mostrarNotificacao('erro', 'Erro nas entregas', 'Não foi possível carregar o status das entregas online.')
    } finally {
      setCarregandoConfigEntrega(false)
    }
  }, [mostrarNotificacao])

  const alterarEntregasOnline = async (ativo: boolean) => {
    const valorAnterior = entregasOnlineAtivas
    setEntregasOnlineAtivas(ativo)
    setSalvandoConfigEntrega(true)

    try {
      const agora = new Date().toISOString()
      const payload = {
        chave: CHAVE_ENTREGAS_ONLINE,
        valor: ativo ? 'true' : 'false',
        tipo: 'boolean',
        descricao: 'Controla se a opção de entrega fica disponível no site do cliente',
        updated_at: agora,
      }

      const { error: erroUpdate } = await supabase
        .from('configuracoes_loja')
        .update(payload)
        .eq('chave', CHAVE_ENTREGAS_ONLINE)

      if (erroUpdate) throw erroUpdate

      const { data: existente, error: erroSelect } = await supabase
        .from('configuracoes_loja')
        .select('chave')
        .eq('chave', CHAVE_ENTREGAS_ONLINE)
        .maybeSingle()

      if (erroSelect) throw erroSelect

      if (!existente) {
        const { error: erroInsert } = await supabase
          .from('configuracoes_loja')
          .insert(payload)

        if (erroInsert) throw erroInsert
      }

      mostrarNotificacao(
        'sucesso',
        ativo ? 'Entregas ativadas' : 'Entregas desligadas',
        ativo
          ? 'O site já pode aceitar pedidos para entrega.'
          : 'A opção Entrega foi removida do checkout em tempo real.'
      )
    } catch (error) {
      console.error('[Entregas] Erro ao alterar entregas online:', error)
      setEntregasOnlineAtivas(valorAnterior)
      mostrarNotificacao('erro', 'Erro ao salvar', 'Não foi possível alterar o status das entregas.')
    } finally {
      setSalvandoConfigEntrega(false)
    }
  }

  useEffect(() => {
    carregarConfigEntrega()

    const canal = supabase
      .channel('config-entregas-online-admin')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'configuracoes_loja',
          filter: `chave=eq.${CHAVE_ENTREGAS_ONLINE}`,
        },
        (payload) => {
          const novaConfig = payload.new as { valor?: string } | null
          if (novaConfig?.valor) {
            setEntregasOnlineAtivas(novaConfig.valor !== 'false')
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(canal)
    }
  }, [carregarConfigEntrega])

  const confirmarTodasPendentes = async () => {
    const pendentes = entregas.filter(e => e.status === 'pendente' || e.status === 'em_rota')
    if (pendentes.length === 0) {
      mostrarNotificacao('info', 'Nenhuma pendente', 'Não há entregas pendentes para confirmar.')
      return
    }

    mostrarNotificacao('confirmacao', 'Confirmar todas',
      `Deseja marcar ${pendentes.length} entrega(s) como entregue?`,
      async () => {
        for (const entrega of pendentes) {
          await atualizarStatusEntrega(entrega.id, 'entregue')
        }
        mostrarNotificacao('sucesso', 'Sucesso', `${pendentes.length} entrega(s) confirmada(s).`)
      }
    )
  }

  const dataInicioGrafico = useMemo(
    () => new Date(`${intervalo.dataInicio}T00:00:00`),
    [intervalo.dataInicio],
  )
  const dataFimGrafico = useMemo(
    () => new Date(`${intervalo.dataFim}T00:00:00`),
    [intervalo.dataFim],
  )

  const entregasNoPeriodo = useMemo(() => {
    const inicio = new Date(intervalo.inicioIso).getTime()
    const fim = new Date(intervalo.fimExclusivoIso).getTime()

    return entregas.filter((entrega) => {
      const criadaEm = new Date(entrega.created_at).getTime()
      return criadaEm >= inicio && criadaEm < fim
    })
  }, [entregas, intervalo.fimExclusivoIso, intervalo.inicioIso])

  const entregasFiltradas = useMemo(() => {
    if (filtroStatus === 'todos') return entregasNoPeriodo
    return entregasNoPeriodo.filter((entrega) => entrega.status === filtroStatus)
  }, [entregasNoPeriodo, filtroStatus])

  const estatisticasPeriodo = useMemo(() => {
    const concluidas = entregasNoPeriodo.filter(e => e.status === 'entregue')
    const temposReais = concluidas.filter(e => e.tempo_real).map(e => e.tempo_real!)
    return {
      total: entregasNoPeriodo.length,
      pendentes: entregasNoPeriodo.filter(e => e.status === 'pendente').length,
      emRota: entregasNoPeriodo.filter(e => e.status === 'em_rota').length,
      concluidas: concluidas.length,
      canceladas: entregasNoPeriodo.filter(e => e.status === 'cancelada').length,
      tempoMedio: temposReais.length > 0
        ? Math.round(temposReais.reduce((a, b) => a + b, 0) / temposReais.length)
        : 0,
      totalTaxas: concluidas.reduce((acc, e) => acc + (e.taxa_entrega || 0), 0),
      taxaSucesso: entregasNoPeriodo.length > 0
        ? Math.round((concluidas.length / entregasNoPeriodo.length) * 100)
        : 0,
    }
  }, [entregasNoPeriodo])

  const dadosEntregasDia = useMemo(() => {
    const dias = eachDayOfInterval({ start: dataInicioGrafico, end: dataFimGrafico })
    const entregasPorDia = dias.map(dia => entregasNoPeriodo.filter(e => {
      const dataE = new Date(e.created_at)
      return format(dataE, 'yyyy-MM-dd') === format(dia, 'yyyy-MM-dd') && e.status === 'entregue'
    }).length)
    return {
      labels: dias.map(d => format(d, 'dd/MM', { locale: ptBR })),
      datasets: [{ label: 'Entregas', data: entregasPorDia, backgroundColor: '#22c55e', borderRadius: 6 }],
    }
  }, [dataFimGrafico, dataInicioGrafico, entregasNoPeriodo])

  const dadosPorEntregador = useMemo(() => {
    const porEntregador: Record<string, number> = {}
    entregasNoPeriodo.filter(e => e.status === 'entregue' && e.entregador).forEach(e => {
      const nome = e.entregador?.nome || 'Sem entregador'
      porEntregador[nome] = (porEntregador[nome] || 0) + 1
    })
    const sorted = Object.entries(porEntregador).sort((a, b) => b[1] - a[1])
    return {
      labels: sorted.map(([nome]) => nome),
      datasets: [{
        label: 'Entregas',
        data: sorted.map(([, qtd]) => qtd),
        backgroundColor: ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'],
        borderRadius: 6,
      }],
    }
  }, [entregasNoPeriodo])

  const dadosStatus = useMemo(() => ({
    labels: ['Pendentes', 'Em Rota', 'Entregues', 'Canceladas'],
    datasets: [{
      data: [
        estatisticasPeriodo.pendentes,
        estatisticasPeriodo.emRota,
        estatisticasPeriodo.concluidas,
        estatisticasPeriodo.canceladas,
      ],
      backgroundColor: ['#f59e0b', '#3b82f6', '#22c55e', '#ef4444'],
      borderWidth: 0,
    }],
  }), [estatisticasPeriodo])

  const dadosTempoMedio = useMemo(() => {
    const dias = eachDayOfInterval({ start: dataInicioGrafico, end: dataFimGrafico })
    const tempoPorDia = dias.map(dia => {
      const entregasDia = entregasNoPeriodo.filter(e => {
        const dataE = new Date(e.created_at)
        return format(dataE, 'yyyy-MM-dd') === format(dia, 'yyyy-MM-dd') && e.tempo_real
      })
      if (entregasDia.length === 0) return 0
      return Math.round(entregasDia.reduce((acc, e) => acc + (e.tempo_real || 0), 0) / entregasDia.length)
    })
    return {
      labels: dias.map(d => format(d, 'dd/MM', { locale: ptBR })),
      datasets: [{
        label: 'Tempo médio (min)',
        data: tempoPorDia,
        borderColor: '#8b5cf6',
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        fill: true,
        tension: 0.4,
      }],
    }
  }, [dataFimGrafico, dataInicioGrafico, entregasNoPeriodo])

  const opcoesGrafico = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: { y: { beginAtZero: true } },
  }

  const opcoesPizza = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: true, position: 'bottom' as const } },
  }

  // Mapa: entregador_id::dataYYYY-MM-DD → lista de entregas daquele dia (com pedido)
  const entregasPorEntregadorDia = useMemo(() => {
    const mapa = new Map<string, Entrega[]>()
    for (const entrega of entregas) {
      if (!entrega.entregador_id) continue
      const ref = new Date(entrega.data_entrega || entrega.created_at)
      const dataRef = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, '0')}-${String(ref.getDate()).padStart(2, '0')}`
      const chave = `${entrega.entregador_id}::${dataRef}`
      const lista = mapa.get(chave) || []
      lista.push(entrega)
      mapa.set(chave, lista)
    }
    return mapa
  }, [entregas])

  // Pagamentos: filtros e agrupamentos
  const resumoFiltrado = useMemo(() => {
    if (filtroEntregador === 'todos') return resumoPorDia
    return resumoPorDia.filter(r => r.entregador_id === filtroEntregador)
  }, [resumoPorDia, filtroEntregador])

  const resumoAgrupadoPorEntregador = useMemo(() => {
    const mapa = new Map<string, {
      entregador_id: string
      entregador_nome: string
      dias: ResumoEntregadorDia[]
      total_devido: number
      saldo_total: number
      total_entregas: number
      total_pago: number
    }>()

    for (const linha of resumoFiltrado) {
      const atual = mapa.get(linha.entregador_id)
      if (atual) {
        atual.dias.push(linha)
        atual.total_devido += linha.total_devido
        atual.saldo_total += linha.status === 'pago' ? 0 : linha.saldo
        atual.total_entregas += linha.total_entregas
        atual.total_pago += linha.valor_pago
      } else {
        mapa.set(linha.entregador_id, {
          entregador_id: linha.entregador_id,
          entregador_nome: linha.entregador_nome,
          dias: [linha],
          total_devido: linha.total_devido,
          saldo_total: linha.status === 'pago' ? 0 : linha.saldo,
          total_entregas: linha.total_entregas,
          total_pago: linha.valor_pago,
        })
      }
    }

    return Array.from(mapa.values()).sort((a, b) => {
      if (b.saldo_total !== a.saldo_total) return b.saldo_total - a.saldo_total
      return a.entregador_nome.localeCompare(b.entregador_nome, 'pt-BR')
    })
  }, [resumoFiltrado])

  const toggleEntregador = (id: string) => {
    setEntregadoresExpandidos(prev => {
      const novo = new Set(prev)
      if (novo.has(id)) novo.delete(id)
      else novo.add(id)
      return novo
    })
  }

  const abrirDialogPagar = (registro: ResumoEntregadorDia) => {
    if (!registro.registro_id || registro.saldo <= 0) {
      mostrarNotificacao('aviso', 'Sem saldo a pagar', 'Esta diária já está quitada.')
      return
    }
    setRegistroPagamento(registro)
    setDialogPagarAberto(true)
  }

  const confirmarAcumular = (registro: ResumoEntregadorDia) => {
    if (!registro.registro_id) return
    if (registro.saldo <= 0) {
      mostrarNotificacao('aviso', 'Sem saldo', 'Esta diária já foi quitada.')
      return
    }
    mostrarNotificacao('confirmacao', 'Acumular diária',
      `Marcar a diária de ${registro.entregador_nome} (${formatarMoeda(registro.saldo)}) como acumulada?`,
      async () => {
        const ok = await acumular(registro.registro_id!)
        if (ok) mostrarNotificacao('sucesso', 'Acumulado', 'Diária marcada como acumulada.')
      }
    )
  }

  const confirmarReabrir = (registro: ResumoEntregadorDia) => {
    if (!registro.registro_id) return
    mostrarNotificacao('confirmacao', 'Reabrir diária',
      'Voltar esta diária para o status pendente?',
      async () => {
        const ok = await reabrir(registro.registro_id!)
        if (ok) mostrarNotificacao('sucesso', 'Reaberto', 'Diária reaberta.')
      }
    )
  }

  const alterarPeriodo = (novoPeriodo: Exclude<PeriodoEntrega, 'personalizado'>) => {
    setPeriodo(novoPeriodo)
    setDatasPeriodo(obterDatasPeriodoEntrega(novoPeriodo))
  }

  const alterarDataInicio = (dataInicio: string) => {
    if (!dataInicio) return
    setPeriodo('personalizado')
    setDatasPeriodo((atual) => ({
      dataInicio,
      dataFim: dataInicio > atual.dataFim ? dataInicio : atual.dataFim,
    }))
  }

  const alterarDataFim = (dataFim: string) => {
    if (!dataFim) return
    setPeriodo('personalizado')
    setDatasPeriodo((atual) => ({
      dataInicio: dataFim < atual.dataInicio ? dataFim : atual.dataInicio,
      dataFim,
    }))
  }

  return (
    <ProtectedRoute><AdminLayout>
      <div className="space-y-5">

        {/* Cabeçalho */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Entregas</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Acompanhe entregas, repasses e relatórios em tempo real.
            </p>
          </div>
          <button
            onClick={carregarDados}
            className="h-9 w-9 inline-flex items-center justify-center border border-border/70 rounded-lg hover:bg-muted transition-colors self-start"
            title="Atualizar"
            aria-label="Atualizar entregas"
          >
            <RefreshCw className={cn('w-4 h-4', carregando && 'animate-spin')} strokeWidth={1.6} />
          </button>
        </div>

        <div className="rounded-lg border border-border/70 bg-card p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <div className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border',
                entregasOnlineAtivas
                  ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                  : 'border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-400'
              )}>
                {entregasOnlineAtivas ? <Truck className="h-5 w-5" /> : <PowerOff className="h-5 w-5" />}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-sm font-semibold">Entregas online</h2>
                  <span className={cn(
                    'rounded-md border px-2 py-0.5 text-xs font-medium',
                    entregasOnlineAtivas
                      ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                      : 'border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-400'
                  )}>
                    {entregasOnlineAtivas ? 'ativas' : 'desligadas'}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Controla a opção Entrega no site do cliente em tempo real.
                </p>
              </div>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={entregasOnlineAtivas}
              disabled={carregandoConfigEntrega || salvandoConfigEntrega}
              onClick={() => alterarEntregasOnline(!entregasOnlineAtivas)}
              className={cn(
                'inline-flex h-10 min-w-[156px] items-center justify-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-60',
                entregasOnlineAtivas
                  ? 'border-border/70 bg-background hover:bg-muted'
                  : 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-400'
              )}
            >
              {salvandoConfigEntrega ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : entregasOnlineAtivas ? (
                <PowerOff className="h-4 w-4" />
              ) : (
                <Power className="h-4 w-4" />
              )}
              {entregasOnlineAtivas ? 'Desligar' : 'Ativar'}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <FiltroEntregasAdmin
            hasFilter={
              periodo !== '7dias' ||
              filtroStatus !== 'todos' ||
              (abaAtiva === 'pagamentos' && filtroEntregador !== 'todos')
            }
            mostrarEntregador={abaAtiva === 'pagamentos'}
            entregadores={entregadores.map((item) => ({ id: item.id, nome: item.nome }))}
            valor={{
              periodo,
              dataInicio: intervalo.dataInicio,
              dataFim: intervalo.dataFim,
              status: filtroStatus,
              entregadorId: filtroEntregador,
            }}
            onLimpar={handleLimparFiltros}
            onChange={(proximo) => {
              if (proximo.periodo && proximo.periodo !== 'personalizado') {
                alterarPeriodo(proximo.periodo)
              } else if (proximo.periodo === 'personalizado') {
                setPeriodo('personalizado')
              }
              if (proximo.dataInicio !== undefined) alterarDataInicio(proximo.dataInicio)
              if (proximo.dataFim !== undefined) alterarDataFim(proximo.dataFim)
              if (proximo.status !== undefined) setFiltroStatus(proximo.status)
              if (proximo.entregadorId !== undefined) setFiltroEntregador(proximo.entregadorId)
            }}
          />
        </div>

        <FiltrosAtivosChips chips={chipsFiltroAtivo} onLimpar={handleLimparFiltros} />

        {/* Cards de resumo do período selecionado */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {carregando ? (
            Array.from({ length: 4 }).map((_, indice) => (
              <div key={indice} className="rounded-lg border border-border/70 bg-card p-4 space-y-3">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-7 w-16" />
              </div>
            ))
          ) : (
            <>
          <div className="bg-card border border-border/70 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-muted-foreground">Pendentes no período</p>
              <Package className="w-4 h-4 text-muted-foreground" strokeWidth={1.6} />
            </div>
            <p className="text-xl font-semibold font-mono tabular-nums">
              {estatisticasPeriodo.pendentes}
            </p>
          </div>
          <div className="bg-card border border-border/70 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-muted-foreground">Total no período</p>
              <Truck className="w-4 h-4 text-muted-foreground" strokeWidth={1.6} />
            </div>
            <p className="text-xl font-semibold font-mono tabular-nums">
              {estatisticasPeriodo.total}
            </p>
          </div>
          <div className="bg-card border border-border/70 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-muted-foreground">Concluídas no período</p>
              <CheckCircle2 className="w-4 h-4 text-muted-foreground" strokeWidth={1.6} />
            </div>
            <p className="text-xl font-semibold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
              {estatisticasPeriodo.concluidas}
            </p>
          </div>
          <div className="bg-card border border-border/70 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-muted-foreground">Tempo médio</p>
              <Timer className="w-4 h-4 text-muted-foreground" strokeWidth={1.6} />
            </div>
            <p className="text-xl font-semibold font-mono tabular-nums">
              {estatisticasPeriodo.tempoMedio} min
            </p>
          </div>
            </>
          )}
        </div>

        {/* Abas */}
        <div className="flex border-b border-border/70">
          {([
            { id: 'entregas' as const, label: 'Entregas', icon: Truck },
            { id: 'pagamentos' as const, label: 'Repasse', icon: Wallet },
            { id: 'relatorios' as const, label: 'Relatórios', icon: BarChart3 },
          ]).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setAbaAtiva(id)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2.5 text-xs sm:text-sm font-medium transition-colors relative ${
                abaAtiva === id ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="w-4 h-4" strokeWidth={1.6} />
              <span>{label}</span>
              {id === 'pagamentos' && totaisGerais.totalDevido > 0 && (
                <span className="bg-foreground text-background text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                  {formatarMoeda(totaisGerais.totalDevido).replace('R$ ', '')}
                </span>
              )}
              {abaAtiva === id && (
                <motion.div
                  layoutId="entregasTabIndicator"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground"
                />
              )}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">

          {/* Aba: Entregas */}
          {abaAtiva === 'entregas' && (
            <motion.div key="entregas" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3">

              {(estatisticas.entregasPendentes > 0 || estatisticas.entregasEmRota > 0) && (
                <div className="flex justify-end">
                  <button
                    onClick={confirmarTodasPendentes}
                    className="h-9 px-3 bg-foreground text-background rounded-lg text-xs font-medium flex items-center gap-1.5 hover:bg-foreground/90 transition-colors"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={1.6} />
                    Confirmar todas
                  </button>
                </div>
              )}

              {/* Lista */}
              {carregando ? (
                <ListaSkeleton quantidade={5} />
              ) : entregasFiltradas.length === 0 ? (
                <ListaVazia
                  icone={<Truck className="h-6 w-6" strokeWidth={1.6} />}
                  titulo="Nenhuma entrega encontrada"
                  descricao="Ajuste o período ou o status para ver outras entregas."
                />
              ) : (
                <div className="space-y-2">
                  {entregasFiltradas.map((entrega) => (
                    <div
                      key={entrega.id}
                      className="bg-card border border-border/70 rounded-lg p-3.5"
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${corDotStatus[entrega.status]}`} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-medium truncate">
                                {entrega.pedido?.nome_cliente || 'Cliente'}
                              </p>
                              <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                {labelStatus[entrega.status]}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 truncate">
                              {entrega.pedido?.telefone || '—'}
                            </p>
                          </div>
                        </div>
                        <p className="text-sm font-semibold font-mono tabular-nums whitespace-nowrap">
                          {formatarMoeda(entrega.pedido?.total || 0)}
                        </p>
                      </div>

                      {(entrega.endereco_entrega || entrega.pedido?.endereco) && (
                        <div className="flex items-start gap-1.5 text-xs text-muted-foreground mb-2 ml-4">
                          <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" strokeWidth={1.6} />
                          <span className="truncate">{entrega.endereco_entrega || entrega.pedido?.endereco}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between gap-2 ml-4 flex-wrap">
                        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap min-w-0 flex-1">
                          <label className="flex items-center gap-1.5">
                            <User className="w-3 h-3 flex-shrink-0" strokeWidth={1.6} />
                            <select
                              value={entrega.entregador_id || ''}
                              onChange={(e) => atribuirEntregador(entrega.id, e.target.value || null)}
                              className="h-7 rounded-md border border-border/70 bg-card px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring/60"
                              aria-label="Atribuir entregador"
                            >
                              <option value="">Sem entregador</option>
                              {entregadores.map((ent) => (
                                <option key={ent.id} value={ent.id}>{ent.nome}</option>
                              ))}
                            </select>
                          </label>
                          {entrega.tempo_real && (
                            <span className="flex items-center gap-1">
                              <Clock className="w-3 h-3 flex-shrink-0" strokeWidth={1.6} />
                              {entrega.tempo_real} min
                            </span>
                          )}
                          {entrega.taxa_entrega > 0 && (
                            <span className="flex items-center gap-1 font-mono tabular-nums">
                              <CircleDollarSign className="w-3 h-3 flex-shrink-0" strokeWidth={1.6} />
                              {formatarMoeda(entrega.taxa_entrega)}
                            </span>
                          )}
                          {entrega.excluida_repasse && (
                            <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                              <Ban className="w-3 h-3" strokeWidth={1.6} />
                              Fora do repasse
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => alternarExclusaoRepasse(entrega.id, !entrega.excluida_repasse)}
                            className={cn(
                              'h-7 w-7 flex items-center justify-center rounded-md transition-colors',
                              entrega.excluida_repasse
                                ? 'border border-amber-500/40 bg-amber-500/10 text-amber-700 hover:bg-amber-500/15 dark:text-amber-400'
                                : 'text-muted-foreground hover:bg-muted',
                            )}
                            title={entrega.excluida_repasse ? 'Voltar para o repasse' : 'Excluir do repasse'}
                          >
                            {entrega.excluida_repasse
                              ? <Undo2 className="w-3.5 h-3.5" strokeWidth={1.6} />
                              : <Ban className="w-3.5 h-3.5" strokeWidth={1.6} />}
                          </button>
                          {(entrega.status === 'pendente' || entrega.status === 'em_rota') && (
                            <>
                              <button
                                onClick={() => atualizarStatusEntrega(entrega.id, 'entregue')}
                                className="h-7 w-7 flex items-center justify-center border border-border/70 rounded-md hover:bg-muted transition-colors"
                                title="Confirmar entrega"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={1.6} />
                              </button>
                              <button
                                onClick={() => atualizarStatusEntrega(entrega.id, 'cancelada')}
                                className="h-7 w-7 flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/5 rounded-md transition-colors"
                                title="Cancelar"
                              >
                                <XCircle className="w-3.5 h-3.5" strokeWidth={1.6} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* Aba: Pagamentos / Repasse */}
          {abaAtiva === 'pagamentos' && (
            <motion.div key="pagamentos" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">

              {/* Cards de totais */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-card border border-border/70 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs text-muted-foreground">A pagar no período</p>
                    <Wallet className="w-4 h-4 text-muted-foreground" strokeWidth={1.6} />
                  </div>
                  <p className="text-xl font-semibold font-mono tabular-nums">
                    {formatarMoeda(totaisGerais.totalDevido)}
                  </p>
                </div>
                <div className="bg-card border border-border/70 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs text-muted-foreground">Pendente no período</p>
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                  </div>
                  <p className="text-xl font-semibold font-mono tabular-nums">
                    {formatarMoeda(totaisGerais.totalPendente)}
                  </p>
                </div>
                <div className="bg-card border border-border/70 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs text-muted-foreground">Acumulado no período</p>
                    <span className="w-2 h-2 rounded-full bg-violet-500" />
                  </div>
                  <p className="text-xl font-semibold font-mono tabular-nums">
                    {formatarMoeda(totaisGerais.totalAcumulado)}
                  </p>
                </div>
                <div className="bg-card border border-border/70 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs text-muted-foreground">Pago nas diárias do período</p>
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  </div>
                  <p className="text-xl font-semibold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                    {formatarMoeda(totaisGerais.totalPagoPeriodo)}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex h-9 overflow-hidden rounded-lg border border-border/70">
                  <button
                    onClick={() => setAgruparPorEntregador(true)}
                    className={`px-3 text-xs font-medium transition-colors ${
                      agruparPorEntregador
                        ? 'bg-foreground text-background'
                        : 'hover:bg-muted text-muted-foreground'
                    }`}
                  >
                    Por entregador
                  </button>
                  <button
                    onClick={() => setAgruparPorEntregador(false)}
                    className={`border-l border-border/70 px-3 text-xs font-medium transition-colors ${
                      !agruparPorEntregador
                        ? 'bg-foreground text-background'
                        : 'hover:bg-muted text-muted-foreground'
                    }`}
                  >
                    Por dia
                  </button>
                </div>
              </div>

              {/* Lista agrupada por entregador */}
              {agruparPorEntregador ? (
                resumoAgrupadoPorEntregador.length === 0 ? (
                  <div className="bg-card border border-border/70 rounded-lg p-12 text-center">
                    <Wallet className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" strokeWidth={1.2} />
                    <p className="text-sm text-muted-foreground">Nenhum repasse registrado ainda</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {resumoAgrupadoPorEntregador.map(grupo => {
                      const expandido = entregadoresExpandidos.has(grupo.entregador_id)
                      const diasPendentes = grupo.dias.filter(d => d.status !== 'pago')
                      return (
                        <div
                          key={grupo.entregador_id}
                          className="bg-card border border-border/70 rounded-lg overflow-hidden"
                        >
                          <button
                            onClick={() => toggleEntregador(grupo.entregador_id)}
                            className="w-full flex items-center gap-3 p-4 hover:bg-muted/30 transition-colors text-left"
                          >
                            <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                              <User className="w-4 h-4 text-muted-foreground" strokeWidth={1.6} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{grupo.entregador_nome}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {grupo.total_entregas} entregas · {diasPendentes.length} {diasPendentes.length === 1 ? 'dia em aberto' : 'dias em aberto'}
                              </p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-base font-semibold font-mono tabular-nums">
                                {formatarMoeda(grupo.saldo_total)}
                              </p>
                              <p className="text-[10px] text-muted-foreground">a pagar</p>
                            </div>
                            {expandido ? (
                              <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" strokeWidth={1.6} />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" strokeWidth={1.6} />
                            )}
                          </button>

                          {expandido && (
                            <div className="border-t border-border/70 divide-y divide-border/70">
                              {grupo.dias.map(dia => (
                                <DiaRepasseRow
                                  key={`${dia.entregador_id}-${dia.data_referencia}`}
                                  dia={dia}
                                  entregasDoDia={entregasPorEntregadorDia.get(`${dia.entregador_id}::${dia.data_referencia}`) || []}
                                  salvando={salvandoPagamento === dia.registro_id}
                                  onPagar={() => abrirDialogPagar(dia)}
                                  onAcumular={() => confirmarAcumular(dia)}
                                  onReabrir={() => confirmarReabrir(dia)}
                                  onAlternarExclusao={alternarExclusaoRepasse}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              ) : (
                resumoFiltrado.length === 0 ? (
                  <div className="bg-card border border-border/70 rounded-lg p-12 text-center">
                    <Wallet className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" strokeWidth={1.2} />
                    <p className="text-sm text-muted-foreground">Nenhum repasse registrado ainda</p>
                  </div>
                ) : (
                  <div className="bg-card border border-border/70 rounded-lg divide-y divide-border/70 overflow-hidden">
                    {resumoFiltrado.map(dia => (
                      <DiaRepasseRow
                        key={`${dia.entregador_id}-${dia.data_referencia}`}
                        dia={dia}
                        entregasDoDia={entregasPorEntregadorDia.get(`${dia.entregador_id}::${dia.data_referencia}`) || []}
                        mostrarEntregador
                        salvando={salvandoPagamento === dia.registro_id}
                        onPagar={() => abrirDialogPagar(dia)}
                        onAcumular={() => confirmarAcumular(dia)}
                        onReabrir={() => confirmarReabrir(dia)}
                        onAlternarExclusao={alternarExclusaoRepasse}
                      />
                    ))}
                  </div>
                )
              )}
            </motion.div>
          )}

          {/* Aba: Relatórios */}
          {abaAtiva === 'relatorios' && (
            <motion.div key="relatorios" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-card border border-border/70 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs text-muted-foreground">Total</p>
                    <Truck className="w-4 h-4 text-muted-foreground" strokeWidth={1.6} />
                  </div>
                  <p className="text-xl font-semibold font-mono tabular-nums">{estatisticasPeriodo.total}</p>
                </div>
                <div className="bg-card border border-border/70 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs text-muted-foreground">Taxa de sucesso</p>
                    <TrendingUp className="w-4 h-4 text-muted-foreground" strokeWidth={1.6} />
                  </div>
                  <p className="text-xl font-semibold font-mono tabular-nums">{estatisticasPeriodo.taxaSucesso}%</p>
                </div>
                <div className="bg-card border border-border/70 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs text-muted-foreground">Tempo médio</p>
                    <Timer className="w-4 h-4 text-muted-foreground" strokeWidth={1.6} />
                  </div>
                  <p className="text-xl font-semibold font-mono tabular-nums">{estatisticasPeriodo.tempoMedio} min</p>
                </div>
                <div className="bg-card border border-border/70 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs text-muted-foreground">Total taxas</p>
                    <CircleDollarSign className="w-4 h-4 text-muted-foreground" strokeWidth={1.6} />
                  </div>
                  <p className="text-xl font-semibold font-mono tabular-nums">{formatarMoeda(estatisticasPeriodo.totalTaxas)}</p>
                </div>
              </div>

              {/* Gráficos */}
              <div className="bg-card border border-border/70 rounded-lg p-4">
                <h3 className="text-sm font-medium mb-3">Entregas por dia</h3>
                <div className="h-40">
                  <Bar data={dadosEntregasDia} options={opcoesGrafico} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-card border border-border/70 rounded-lg p-4">
                  <h3 className="text-sm font-medium mb-3">Por entregador</h3>
                  <div className="h-36">
                    {dadosPorEntregador.labels.length > 0 ? (
                      <Bar data={dadosPorEntregador} options={opcoesGrafico} />
                    ) : (
                      <div className="h-full flex items-center justify-center text-muted-foreground text-xs">
                        Sem dados
                      </div>
                    )}
                  </div>
                </div>
                <div className="bg-card border border-border/70 rounded-lg p-4">
                  <h3 className="text-sm font-medium mb-3">Por status</h3>
                  <div className="h-36">
                    <Doughnut data={dadosStatus} options={opcoesPizza} />
                  </div>
                </div>
              </div>

              <div className="bg-card border border-border/70 rounded-lg p-4">
                <h3 className="text-sm font-medium mb-3">Tempo médio por dia</h3>
                <div className="h-40">
                  <Line data={dadosTempoMedio} options={{ ...opcoesGrafico, plugins: { legend: { display: true } } }} />
                </div>
              </div>

              <div className="bg-card border border-border/70 rounded-lg overflow-hidden">
                <div className="px-4 py-3 border-b border-border/70 flex items-center gap-2">
                  <Users className="w-4 h-4 text-muted-foreground" strokeWidth={1.6} />
                  <h3 className="text-sm font-medium">Ranking de entregadores</h3>
                </div>
                {dadosPorEntregador.labels.length > 0 ? (
                  <div className="divide-y divide-border/70">
                    {dadosPorEntregador.labels.map((nome, i) => (
                      <div key={nome} className="px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-mono tabular-nums font-semibold">
                            {i + 1}
                          </span>
                          <span className="text-sm font-medium">{nome}</span>
                        </div>
                        <span className="text-sm font-semibold font-mono tabular-nums">
                          {dadosPorEntregador.datasets[0].data[i]}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    Nenhum entregador com entregas no período
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <DialogPagarEntregador
        registro={registroPagamento}
        aberto={dialogPagarAberto}
        salvando={salvandoPagamento === registroPagamento?.registro_id}
        onFechar={() => {
          setDialogPagarAberto(false)
          setRegistroPagamento(null)
        }}
        onConfirmar={async (params) => {
          const ok = await pagar(params)
          if (ok) mostrarNotificacao('sucesso', 'Pagamento registrado', 'O pagamento foi registrado.')
          else mostrarNotificacao('erro', 'Erro', 'Não foi possível registrar o pagamento.')
          return ok
        }}
      />

      <ModalNotificacao
        aberto={!!notificacao}
        tipo={notificacao?.tipo || 'info'}
        titulo={notificacao?.titulo || ''}
        mensagem={notificacao?.mensagem || ''}
        onFechar={fecharNotificacao}
        onConfirmar={notificacao?.onConfirm}
      />
    </AdminLayout></ProtectedRoute>
  )
}

type DiaRepasseRowProps = {
  dia: ResumoEntregadorDia
  entregasDoDia?: Entrega[]
  mostrarEntregador?: boolean
  salvando: boolean
  onPagar: () => void
  onAcumular: () => void
  onReabrir: () => void
  onAlternarExclusao?: (entregaId: string, excluir: boolean) => Promise<boolean> | void
}

function DiaRepasseRow({
  dia, entregasDoDia = [], mostrarEntregador, salvando, onPagar, onAcumular, onReabrir, onAlternarExclusao,
}: DiaRepasseRowProps) {
  const [expandido, setExpandido] = useState(false)
  const dataObj = new Date(dia.data_referencia + 'T00:00:00')
  const dataFormatada = format(dataObj, "EEE, dd 'de' MMM", { locale: ptBR })
  const finalizado = dia.status === 'pago'
  const acumulado = dia.status === 'acumulado'
  const temDetalhes = entregasDoDia.length > 0

  return (
    <div className="hover:bg-muted/20 transition-colors">
      <div className="flex items-center gap-3 p-4">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${corDotPagamento[dia.status]}`} />

        <button
          type="button"
          onClick={() => temDetalhes && setExpandido((v) => !v)}
          disabled={!temDetalhes}
          className="flex-1 min-w-0 text-left disabled:cursor-default"
        >
          <div className="flex items-center gap-2 flex-wrap">
            {mostrarEntregador && (
              <span className="text-sm font-medium truncate">{dia.entregador_nome}</span>
            )}
            <span className="text-sm text-muted-foreground capitalize">{dataFormatada}</span>
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${corPagamentoBadge[dia.status]}`}>
              {labelPagamento[dia.status]}
            </span>
            {temDetalhes && (
              expandido
                ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={1.6} />
                : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={1.6} />
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
            <span className="flex items-center gap-1">
              <Truck className="w-3 h-3" strokeWidth={1.6} />
              {dia.total_entregas} {dia.total_entregas === 1 ? 'entrega' : 'entregas'}
            </span>
            {dia.valor_pago > 0 && (
              <span className="font-mono tabular-nums">
                Pago: {formatarMoeda(dia.valor_pago)}
              </span>
            )}
            {dia.metodo_pagamento && finalizado && (
              <span>via {dia.metodo_pagamento}</span>
            )}
          </div>
        </button>

        <div className="text-right flex-shrink-0">
          <p className="text-sm font-semibold font-mono tabular-nums">
            {formatarMoeda(finalizado ? dia.valor_pago : dia.saldo)}
          </p>
          {!finalizado && dia.total_devido !== dia.saldo && (
            <p className="text-[10px] text-muted-foreground font-mono tabular-nums">
              de {formatarMoeda(dia.total_devido)}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {finalizado ? (
            <button
              onClick={onReabrir}
              disabled={salvando}
              className="h-8 px-3 text-xs border border-border/70 rounded-md hover:bg-muted disabled:opacity-50 transition-colors"
              title="Reabrir"
            >
              {salvando ? <RefreshCw className="w-3 h-3 animate-spin" strokeWidth={1.6} /> : 'Reabrir'}
            </button>
          ) : (
            <>
              {!acumulado && dia.saldo > 0 && (
                <button
                  onClick={onAcumular}
                  disabled={salvando}
                  className="h-8 px-3 text-xs border border-border/70 rounded-md hover:bg-muted disabled:opacity-50 transition-colors flex items-center gap-1"
                  title="Acumular para outro dia"
                >
                  <PauseCircle className="w-3 h-3" strokeWidth={1.6} />
                  Acumular
                </button>
              )}
              {dia.saldo > 0 && (
                <button
                  onClick={onPagar}
                  disabled={salvando}
                  className="h-8 px-3 bg-foreground text-background text-xs font-medium rounded-md hover:bg-foreground/90 disabled:opacity-50 transition-colors flex items-center gap-1"
                >
                  {salvando ? <RefreshCw className="w-3 h-3 animate-spin" strokeWidth={1.6} /> : <Wallet className="w-3 h-3" strokeWidth={1.6} />}
                  Pagar
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {expandido && temDetalhes && (
        <div className="border-t border-border/60 bg-muted/10 px-4 py-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
            Pedidos do dia
          </p>
          <ul className="space-y-1.5">
            {entregasDoDia
              .slice()
              .sort((a, b) => new Date(b.data_entrega || b.created_at).getTime() - new Date(a.data_entrega || a.created_at).getTime())
              .map((entrega) => {
                const hora = format(new Date(entrega.data_entrega || entrega.created_at), 'HH:mm', { locale: ptBR })
                return (
                  <li
                    key={entrega.id}
                    className={cn(
                      'flex flex-col gap-2 rounded-md border border-border/60 bg-card px-3 py-2 text-xs sm:flex-row sm:items-center sm:gap-3',
                      entrega.excluida_repasse && 'opacity-60',
                    )}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <span className="w-10 shrink-0 font-mono tabular-nums text-muted-foreground sm:w-12">{hora}</span>
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium">
                          {entrega.pedido?.nome_cliente || 'Cliente'}
                        </p>
                        {(entrega.endereco_entrega || entrega.pedido?.endereco) && (
                          <p className="truncate text-xs text-muted-foreground">
                            {entrega.endereco_entrega || entrega.pedido?.endereco}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 sm:flex-shrink-0">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium">
                        <span className={cn('size-1.5 rounded-full', corDotStatus[entrega.status])} />
                        {labelStatus[entrega.status]}
                      </span>
                      <span className="font-mono tabular-nums text-sm font-semibold ml-auto sm:ml-0 sm:w-20 sm:text-right">
                        {formatarMoeda(entrega.taxa_entrega || 0)}
                      </span>
                      {onAlternarExclusao && (
                        <button
                          type="button"
                          onClick={() => onAlternarExclusao(entrega.id, !entrega.excluida_repasse)}
                          className={cn(
                            'h-7 w-7 flex items-center justify-center rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                            entrega.excluida_repasse
                              ? 'border border-amber-500/40 bg-amber-500/10 text-amber-700 hover:bg-amber-500/15 dark:text-amber-400'
                              : 'border border-border/70 text-muted-foreground hover:bg-muted',
                          )}
                          title={entrega.excluida_repasse ? 'Voltar ao repasse' : 'Excluir do repasse'}
                          aria-label={entrega.excluida_repasse ? 'Voltar ao repasse' : 'Excluir do repasse'}
                        >
                          {entrega.excluida_repasse
                            ? <Undo2 className="w-3.5 h-3.5" strokeWidth={1.6} />
                            : <Ban className="w-3.5 h-3.5" strokeWidth={1.6} />}
                        </button>
                      )}
                    </div>
                  </li>
                )
              })}
          </ul>
        </div>
      )}
    </div>
  )
}
