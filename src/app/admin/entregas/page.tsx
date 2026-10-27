'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Truck, MapPin, Clock, User, CheckCircle as CheckCircle2, XCircle, ArrowsClockwise as RefreshCw, Wallet, CurrencyCircleDollar as CircleDollarSign, PauseCircle, CaretDown as ChevronDown, CaretUp as ChevronUp, Prohibit as Ban, ArrowUUpLeft as Undo2 } from '@phosphor-icons/react'
import { toast } from 'sonner'
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
import {
  Botao,
  CabecalhoPagina,
  Cartao,
  Esqueleto,
  LinhaInterruptor,
  Lista,
  ListaCarregando,
  ListaVazia,
  Pagina,
  Secao,
  Segmentos,
  Selecao,
  Selo,
  useConfirmar,
} from '@/components/admin/ui'
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

type Tom = 'neutro' | 'primario' | 'sucesso' | 'alerta' | 'perigo'

const tomStatus: Record<StatusEntrega, Tom> = {
  pendente: 'alerta',
  em_rota: 'primario',
  entregue: 'sucesso',
  cancelada: 'perigo',
}

const labelStatus: Record<StatusEntrega, string> = {
  pendente: 'Pendente',
  em_rota: 'Em rota',
  entregue: 'Entregue',
  cancelada: 'Cancelada',
}

const tomPagamento: Record<StatusPagamentoEntregador, Tom> = {
  pendente: 'alerta',
  parcial: 'primario',
  pago: 'sucesso',
  acumulado: 'neutro',
}

const labelPagamento: Record<StatusPagamentoEntregador, string> = {
  pendente: 'A pagar',
  parcial: 'Pago em parte',
  pago: 'Pago',
  acumulado: 'Guardado',
}

const ABAS: Array<{ valor: Aba; rotulo: string }> = [
  { valor: 'entregas', rotulo: 'Entregas' },
  { valor: 'pagamentos', rotulo: 'Repasse' },
  { valor: 'relatorios', rotulo: 'Relatórios' },
]

/** Número de resumo: rótulo pequeno em cima, valor grande embaixo. */
function Indicador({ rotulo, valor, destaque }: { rotulo: string; valor: ReactNode; destaque?: boolean }) {
  return (
    <Cartao className="p-4">
      <p className="text-[13px] text-muted-foreground">{rotulo}</p>
      <p className={cn('mt-1 text-xl font-semibold tabular-nums', destaque && 'text-emerald-700 dark:text-emerald-400')}>
        {valor}
      </p>
    </Cartao>
  )
}

export default function EntregasPage() {
  const confirmar = useConfirmar()
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
    fecharNotificacao,
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

  // Avisos vindos do hook useEntregas viram toast (ou confirmação, se pedirem).
  useEffect(() => {
    if (!notificacao) return
    const { tipo, titulo, mensagem, onConfirm } = notificacao
    fecharNotificacao()
    if (tipo === 'confirmacao') {
      void confirmar({ titulo, descricao: mensagem }).then((ok) => ok && onConfirm?.())
      return
    }
    const mostrar = { sucesso: toast.success, erro: toast.error, aviso: toast.warning, info: toast.info }[tipo]
    mostrar(titulo, { description: mensagem })
  }, [notificacao, fecharNotificacao, confirmar])

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
      toast.error('Erro nas entregas', { description: 'Não foi possível carregar o status das entregas online.' })
    } finally {
      setCarregandoConfigEntrega(false)
    }
  }, [])

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

      toast.success(ativo ? 'Entregas ativadas' : 'Entregas desligadas', {
        description: ativo
          ? 'O site já pode aceitar pedidos para entrega.'
          : 'A opção Entrega saiu do site na hora.',
      })
    } catch (error) {
      console.error('[Entregas] Erro ao alterar entregas online:', error)
      setEntregasOnlineAtivas(valorAnterior)
      toast.error('Erro ao salvar', { description: 'Não foi possível alterar o status das entregas.' })
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
      toast.info('Nenhuma pendente', { description: 'Não há entregas pendentes para confirmar.' })
      return
    }

    const ok = await confirmar({
      titulo: 'Marcar todas como entregues?',
      descricao: `${pendentes.length} entrega(s) pendente(s) ou em rota vão para Entregue.`,
      confirmar: 'Marcar entregues',
    })
    if (!ok) return
    for (const entrega of pendentes) {
      await atualizarStatusEntrega(entrega.id, 'entregue')
    }
    toast.success('Sucesso', { description: `${pendentes.length} entrega(s) confirmada(s).` })
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
      toast.warning('Sem saldo a pagar', { description: 'Esta diária já está quitada.' })
      return
    }
    setRegistroPagamento(registro)
    setDialogPagarAberto(true)
  }

  const confirmarAcumular = async (registro: ResumoEntregadorDia) => {
    if (!registro.registro_id) return
    if (registro.saldo <= 0) {
      toast.warning('Sem saldo', { description: 'Esta diária já foi quitada.' })
      return
    }
    const ok = await confirmar({
      titulo: 'Guardar para outro dia?',
      descricao: `A diária de ${registro.entregador_nome} (${formatarMoeda(registro.saldo)}) fica marcada como acumulada para pagar depois.`,
      confirmar: 'Guardar',
    })
    if (!ok) return
    const feito = await acumular(registro.registro_id)
    if (feito) toast.success('Acumulado', { description: 'Diária marcada como acumulada.' })
  }

  const confirmarReabrir = async (registro: ResumoEntregadorDia) => {
    if (!registro.registro_id) return
    const ok = await confirmar({
      titulo: 'Reabrir diária?',
      descricao: 'Ela volta a aparecer como a pagar.',
      confirmar: 'Reabrir',
    })
    if (!ok) return
    const feito = await reabrir(registro.registro_id)
    if (feito) toast.success('Reaberto', { description: 'Diária reaberta.' })
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

  const temPendentes = estatisticas.entregasPendentes > 0 || estatisticas.entregasEmRota > 0

  return (
    <ProtectedRoute><AdminLayout>
      <Pagina>
        <CabecalhoPagina
          titulo="Entregas"
          descricao="Entregas, pagamento dos entregadores e relatórios."
          acoes={
            <Botao variante="contorno" onClick={carregarDados} aria-label="Atualizar entregas" className="h-11 md:h-10">
              <RefreshCw className={cn('size-4', carregando && 'animate-spin')} />
              Atualizar
            </Botao>
          }
        />

        <LinhaInterruptor
          titulo="Entregas pelo site"
          descricao={
            carregandoConfigEntrega
              ? 'Carregando…'
              : entregasOnlineAtivas
                ? 'Ligado: o cliente pode pedir entrega no site.'
                : 'Desligado: a opção Entrega não aparece no site.'
          }
          marcado={entregasOnlineAtivas}
          aoMudar={(ativo) => void alterarEntregasOnline(ativo)}
          desabilitado={carregandoConfigEntrega || salvandoConfigEntrega}
          rotuloAcessivel={entregasOnlineAtivas ? 'Desligar entregas pelo site' : 'Ligar entregas pelo site'}
        />

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

        {/* Resumo do período */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {carregando ? (
            Array.from({ length: 4 }).map((_, indice) => (
              <Cartao key={indice} className="space-y-2 p-4">
                <Esqueleto className="h-3 w-24" />
                <Esqueleto className="h-6 w-16" />
              </Cartao>
            ))
          ) : (
            <>
              <Indicador rotulo="Pendentes" valor={estatisticasPeriodo.pendentes} />
              <Indicador rotulo="Total" valor={estatisticasPeriodo.total} />
              <Indicador rotulo="Entregues" valor={estatisticasPeriodo.concluidas} destaque />
              <Indicador rotulo="Tempo médio" valor={`${estatisticasPeriodo.tempoMedio} min`} />
            </>
          )}
        </div>

        {/* Abas */}
        <div role="tablist" aria-label="Seções de entregas" className="grid grid-cols-3 rounded-xl bg-muted p-1">
          {ABAS.map(({ valor, rotulo }) => (
            <button
              key={valor}
              type="button"
              role="tab"
              aria-selected={abaAtiva === valor}
              onClick={() => setAbaAtiva(valor)}
              className={cn(
                'flex h-11 items-center justify-center gap-1.5 rounded-lg px-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-9',
                abaAtiva === valor ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {rotulo}
              {valor === 'pagamentos' && totaisGerais.totalDevido > 0 && (
                <span className="hidden text-xs tabular-nums text-muted-foreground sm:inline">
                  {formatarMoeda(totaisGerais.totalDevido)}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Aba: Entregas */}
        {abaAtiva === 'entregas' && (
          <Secao
            titulo={`${entregasFiltradas.length} ${entregasFiltradas.length === 1 ? 'entrega' : 'entregas'}`}
            acao={
              temPendentes ? (
                <Botao variante="contorno" tamanho="sm" onClick={() => void confirmarTodasPendentes()} className="h-10">
                  <CheckCircle2 className="size-4" />
                  Marcar todas entregues
                </Botao>
              ) : null
            }
          >
            {carregando ? (
              <ListaCarregando linhas={5} />
            ) : entregasFiltradas.length === 0 ? (
              <ListaVazia
                icone={<Truck />}
                titulo="Nenhuma entrega aqui"
                descricao="Troque o período ou a situação para ver outras entregas."
              />
            ) : (
              <Lista>
                {entregasFiltradas.map((entrega) => {
                  const emAberto = entrega.status === 'pendente' || entrega.status === 'em_rota'
                  const endereco = entrega.endereco_entrega || entrega.pedido?.endereco
                  return (
                    <li key={entrega.id} className="space-y-3 px-4 py-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate font-medium">{entrega.pedido?.nome_cliente || 'Cliente'}</p>
                            <Selo tom={tomStatus[entrega.status]}>{labelStatus[entrega.status]}</Selo>
                            {entrega.excluida_repasse && <Selo tom="alerta">Fora do repasse</Selo>}
                          </div>
                          <p className="mt-0.5 truncate text-sm text-muted-foreground">
                            {entrega.pedido?.telefone || '—'}
                          </p>
                        </div>
                        <p className="whitespace-nowrap font-semibold tabular-nums">
                          {formatarMoeda(entrega.pedido?.total || 0)}
                        </p>
                      </div>

                      {(endereco || entrega.tempo_real || entrega.taxa_entrega > 0) && (
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                          {endereco && (
                            <span className="flex min-w-0 items-center gap-1.5">
                              <MapPin className="size-4 shrink-0" />
                              <span className="truncate">{endereco}</span>
                            </span>
                          )}
                          {entrega.tempo_real && (
                            <span className="flex items-center gap-1.5">
                              <Clock className="size-4 shrink-0" />
                              {entrega.tempo_real} min
                            </span>
                          )}
                          {entrega.taxa_entrega > 0 && (
                            <span className="flex items-center gap-1.5 tabular-nums">
                              <CircleDollarSign className="size-4 shrink-0" />
                              Taxa {formatarMoeda(entrega.taxa_entrega)}
                            </span>
                          )}
                        </div>
                      )}

                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <div className="min-w-0 sm:w-56">
                          <Selecao
                            value={entrega.entregador_id || ''}
                            onChange={(e) => atribuirEntregador(entrega.id, e.target.value || null)}
                            aria-label="Atribuir entregador"
                          >
                            <option value="">Sem entregador</option>
                            {entregadores.map((ent) => (
                              <option key={ent.id} value={ent.id}>{ent.nome}</option>
                            ))}
                          </Selecao>
                        </div>
                        <div className="flex gap-2 sm:ml-auto">
                          <Botao
                            variante="fantasma"
                            tamanho="icone"
                            onClick={() => alternarExclusaoRepasse(entrega.id, !entrega.excluida_repasse)}
                            className="size-11 shrink-0 text-muted-foreground md:size-10"
                            title={entrega.excluida_repasse ? 'Voltar para o repasse' : 'Excluir do repasse'}
                            aria-label={entrega.excluida_repasse ? 'Voltar para o repasse' : 'Excluir do repasse'}
                          >
                            {entrega.excluida_repasse ? <Undo2 /> : <Ban />}
                          </Botao>
                          {emAberto && (
                            <>
                              <Botao
                                variante="perigoSuave"
                                onClick={() => atualizarStatusEntrega(entrega.id, 'cancelada')}
                                className="h-11 flex-1 sm:flex-none md:h-10"
                              >
                                <XCircle />
                                Cancelar
                              </Botao>
                              <Botao
                                variante="contorno"
                                onClick={() => atualizarStatusEntrega(entrega.id, 'entregue')}
                                className="h-11 flex-1 sm:flex-none md:h-10"
                              >
                                <CheckCircle2 />
                                Entregue
                              </Botao>
                            </>
                          )}
                        </div>
                      </div>
                    </li>
                  )
                })}
              </Lista>
            )}
          </Secao>
        )}

        {/* Aba: Pagamentos / Repasse */}
        {abaAtiva === 'pagamentos' && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Indicador rotulo="Total do período" valor={formatarMoeda(totaisGerais.totalDevido)} />
              <Indicador rotulo="A pagar" valor={formatarMoeda(totaisGerais.totalPendente)} />
              <Indicador rotulo="Guardado" valor={formatarMoeda(totaisGerais.totalAcumulado)} />
              <Indicador rotulo="Já pago" valor={formatarMoeda(totaisGerais.totalPagoPeriodo)} destaque />
            </div>

            <Segmentos
              rotuloAcessivel="Agrupar repasse"
              opcoes={[
                { valor: 'entregador', rotulo: 'Por entregador' },
                { valor: 'dia', rotulo: 'Por dia' },
              ]}
              valor={agruparPorEntregador ? 'entregador' : 'dia'}
              aoMudar={(valor) => setAgruparPorEntregador(valor === 'entregador')}
            />

            {(agruparPorEntregador ? resumoAgrupadoPorEntregador.length : resumoFiltrado.length) === 0 ? (
              <ListaVazia
                icone={<Wallet />}
                titulo="Nenhum repasse no período"
                descricao="Quando houver entregas com entregador, o valor de cada um aparece aqui."
              />
            ) : agruparPorEntregador ? (
              <div className="space-y-2">
                {resumoAgrupadoPorEntregador.map(grupo => {
                  const expandido = entregadoresExpandidos.has(grupo.entregador_id)
                  const diasPendentes = grupo.dias.filter(d => d.status !== 'pago')
                  return (
                    <Cartao key={grupo.entregador_id} className="overflow-hidden">
                      <button
                        type="button"
                        onClick={() => toggleEntregador(grupo.entregador_id)}
                        aria-expanded={expandido}
                        className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                      >
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                          <User className="size-5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{grupo.entregador_nome}</p>
                          <p className="mt-0.5 text-sm text-muted-foreground">
                            {grupo.total_entregas} entregas · {diasPendentes.length} {diasPendentes.length === 1 ? 'dia em aberto' : 'dias em aberto'}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="font-semibold tabular-nums">{formatarMoeda(grupo.saldo_total)}</p>
                          <p className="text-xs text-muted-foreground">a pagar</p>
                        </div>
                        {expandido
                          ? <ChevronUp className="size-4 shrink-0 text-muted-foreground" />
                          : <ChevronDown className="size-4 shrink-0 text-muted-foreground" />}
                      </button>

                      {expandido && (
                        <div className="divide-y divide-border/70 border-t border-border/70">
                          {grupo.dias.map(dia => (
                            <DiaRepasseRow
                              key={`${dia.entregador_id}-${dia.data_referencia}`}
                              dia={dia}
                              entregasDoDia={entregasPorEntregadorDia.get(`${dia.entregador_id}::${dia.data_referencia}`) || []}
                              salvando={salvandoPagamento === dia.registro_id}
                              onPagar={() => abrirDialogPagar(dia)}
                              onAcumular={() => void confirmarAcumular(dia)}
                              onReabrir={() => void confirmarReabrir(dia)}
                              onAlternarExclusao={alternarExclusaoRepasse}
                            />
                          ))}
                        </div>
                      )}
                    </Cartao>
                  )
                })}
              </div>
            ) : (
              <Cartao className="divide-y divide-border/70 overflow-hidden">
                {resumoFiltrado.map(dia => (
                  <DiaRepasseRow
                    key={`${dia.entregador_id}-${dia.data_referencia}`}
                    dia={dia}
                    entregasDoDia={entregasPorEntregadorDia.get(`${dia.entregador_id}::${dia.data_referencia}`) || []}
                    mostrarEntregador
                    salvando={salvandoPagamento === dia.registro_id}
                    onPagar={() => abrirDialogPagar(dia)}
                    onAcumular={() => void confirmarAcumular(dia)}
                    onReabrir={() => void confirmarReabrir(dia)}
                    onAlternarExclusao={alternarExclusaoRepasse}
                  />
                ))}
              </Cartao>
            )}
          </div>
        )}

        {/* Aba: Relatórios */}
        {abaAtiva === 'relatorios' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Indicador rotulo="Total" valor={estatisticasPeriodo.total} />
              <Indicador rotulo="Entregues" valor={`${estatisticasPeriodo.taxaSucesso}%`} />
              <Indicador rotulo="Tempo médio" valor={`${estatisticasPeriodo.tempoMedio} min`} />
              <Indicador rotulo="Taxas recebidas" valor={formatarMoeda(estatisticasPeriodo.totalTaxas)} />
            </div>

            <Cartao className="p-4">
              <h3 className="mb-3 text-sm font-medium">Entregas por dia</h3>
              <div className="h-48">
                <Bar data={dadosEntregasDia} options={opcoesGrafico} />
              </div>
            </Cartao>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Cartao className="p-4">
                <h3 className="mb-3 text-sm font-medium">Por entregador</h3>
                <div className="h-44">
                  {dadosPorEntregador.labels.length > 0 ? (
                    <Bar data={dadosPorEntregador} options={opcoesGrafico} />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                      Sem dados
                    </div>
                  )}
                </div>
              </Cartao>
              <Cartao className="p-4">
                <h3 className="mb-3 text-sm font-medium">Por situação</h3>
                <div className="h-44">
                  <Doughnut data={dadosStatus} options={opcoesPizza} />
                </div>
              </Cartao>
            </div>

            <Cartao className="p-4">
              <h3 className="mb-3 text-sm font-medium">Tempo médio por dia</h3>
              <div className="h-48">
                <Line data={dadosTempoMedio} options={{ ...opcoesGrafico, plugins: { legend: { display: true } } }} />
              </div>
            </Cartao>

            <Secao titulo="Ranking de entregadores">
              {dadosPorEntregador.labels.length > 0 ? (
                <Lista>
                  {dadosPorEntregador.labels.map((nome, i) => (
                    <li key={nome} className="flex min-h-12 items-center gap-3 px-4 py-3">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold tabular-nums">
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">{nome}</span>
                      <span className="text-sm font-semibold tabular-nums">
                        {dadosPorEntregador.datasets[0].data[i]}
                      </span>
                    </li>
                  ))}
                </Lista>
              ) : (
                <ListaVazia titulo="Nenhum entregador com entregas no período" />
              )}
            </Secao>
          </div>
        )}
      </Pagina>

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
          if (ok) toast.success('Pagamento registrado', { description: 'O pagamento foi registrado.' })
          else toast.error('Erro', { description: 'Não foi possível registrar o pagamento.' })
          return ok
        }}
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
    <div>
      <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={() => temDetalhes && setExpandido((v) => !v)}
          disabled={!temDetalhes}
          aria-expanded={temDetalhes ? expandido : undefined}
          className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default"
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {mostrarEntregador && (
                <span className="truncate font-medium">{dia.entregador_nome}</span>
              )}
              <span className={cn('text-sm capitalize', mostrarEntregador ? 'text-muted-foreground' : 'font-medium')}>
                {dataFormatada}
              </span>
              <Selo tom={tomPagamento[dia.status]}>{labelPagamento[dia.status]}</Selo>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-sm text-muted-foreground">
              <span>{dia.total_entregas} {dia.total_entregas === 1 ? 'entrega' : 'entregas'}</span>
              {dia.valor_pago > 0 && (
                <span className="tabular-nums">Pago {formatarMoeda(dia.valor_pago)}</span>
              )}
              {dia.metodo_pagamento && finalizado && (
                <span>via {dia.metodo_pagamento}</span>
              )}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-semibold tabular-nums">
              {formatarMoeda(finalizado ? dia.valor_pago : dia.saldo)}
            </p>
            {!finalizado && dia.total_devido !== dia.saldo && (
              <p className="text-xs tabular-nums text-muted-foreground">
                de {formatarMoeda(dia.total_devido)}
              </p>
            )}
          </div>
          {temDetalhes && (
            expandido
              ? <ChevronUp className="size-4 shrink-0 text-muted-foreground" />
              : <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
          )}
        </button>

        <div className="flex shrink-0 gap-2 [&>*]:flex-1 sm:[&>*]:flex-none">
          {finalizado ? (
            <Botao
              variante="contorno"
              onClick={onReabrir}
              carregando={salvando}
              className="h-11 md:h-9"
            >
              Reabrir
            </Botao>
          ) : (
            <>
              {!acumulado && dia.saldo > 0 && (
                <Botao
                  variante="contorno"
                  onClick={onAcumular}
                  disabled={salvando}
                  className="h-11 md:h-9"
                  title="Guardar para pagar em outro dia"
                >
                  <PauseCircle />
                  Guardar
                </Botao>
              )}
              {dia.saldo > 0 && (
                <Botao
                  onClick={onPagar}
                  carregando={salvando}
                  className="h-11 md:h-9"
                >
                  {!salvando && <Wallet />}
                  Pagar
                </Botao>
              )}
            </>
          )}
        </div>
      </div>

      {expandido && temDetalhes && (
        <div className="border-t border-border/70 bg-muted/30 px-4 py-3">
          <p className="mb-2 text-sm font-medium text-muted-foreground">Pedidos do dia</p>
          <ul className="space-y-2">
            {entregasDoDia
              .slice()
              .sort((a, b) => new Date(b.data_entrega || b.created_at).getTime() - new Date(a.data_entrega || a.created_at).getTime())
              .map((entrega) => {
                const hora = format(new Date(entrega.data_entrega || entrega.created_at), 'HH:mm', { locale: ptBR })
                const endereco = entrega.endereco_entrega || entrega.pedido?.endereco
                return (
                  <li
                    key={entrega.id}
                    className={cn(
                      'flex items-center gap-3 rounded-lg border border-border/70 bg-card px-3 py-2',
                      entrega.excluida_repasse && 'opacity-60',
                    )}
                  >
                    <span className="w-11 shrink-0 text-sm tabular-nums text-muted-foreground">{hora}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{entrega.pedido?.nome_cliente || 'Cliente'}</p>
                      <p className="truncate text-[13px] text-muted-foreground">
                        {labelStatus[entrega.status]}
                        {endereco ? ` · ${endereco}` : ''}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold tabular-nums">
                      {formatarMoeda(entrega.taxa_entrega || 0)}
                    </span>
                    {onAlternarExclusao && (
                      <Botao
                        variante="fantasma"
                        tamanho="icone"
                        onClick={() => onAlternarExclusao(entrega.id, !entrega.excluida_repasse)}
                        className={cn(
                          'size-11 shrink-0 md:size-9',
                          entrega.excluida_repasse ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground',
                        )}
                        title={entrega.excluida_repasse ? 'Voltar ao repasse' : 'Excluir do repasse'}
                        aria-label={entrega.excluida_repasse ? 'Voltar ao repasse' : 'Excluir do repasse'}
                      >
                        {entrega.excluida_repasse ? <Undo2 /> : <Ban />}
                      </Botao>
                    )}
                  </li>
                )
              })}
          </ul>
        </div>
      )}
    </div>
  )
}
