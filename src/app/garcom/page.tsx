'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  RefreshCw,
  Plus,
  Search,
  Filter,
  X,
  ChevronDown,
  Loader2,
  Clock,
  MapPin,
  Phone,
  Store,
  Package,
  CreditCard,
  FileText,
  Copy,
  Check,
  ClipboardList,
  Layers3,
  Pencil,
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import Link from 'next/link'
import GarcomLayout from '@/components/garcom/GarcomLayout'
import RotaProtegidaGarcom from '@/components/garcom/RotaProtegidaGarcom'
import { supabase } from '@/lib/supabase'
import { gerarPDFPedido } from '@/lib/pdf-generator'
import { carregarPagamentosParciaisPorPedido } from '@/lib/pagamentoParcial'
import { BarraPagamentoParcial } from '@/components/admin/BarraPagamentoParcial'
import ModalDetalhesPedido from '@/components/admin/ModalDetalhesPedido'
import { useControleAcesso } from '@/contexts/ControleAcessoContext'

type ItemPedido = {
  id: string
  nome_item?: string
  quantidade: number
  preco_unitario: number
  subtotal: number
  observacoes?: string
}

type Pedido = {
  id: string
  nome_cliente: string
  telefone?: string
  endereco?: string
  bairro?: string
  tipo_entrega: string
  status: string
  subtotal: number
  taxa_entrega: number
  total: number
  created_at: string
  forma_pagamento?: string
  troco_para?: number | null
  observacoes?: string
  mesa?: number | null
  comanda?: number | null
  garcom_id?: string | null
  itens?: ItemPedido[]
  valor_pago_parcial?: number
  valor_em_crediario?: number
  itens_pagos_count?: number
}

const PEDIDOS_POR_PAGINA = 30
const STATUS_ABERTOS = ['pendente', 'confirmado', 'preparando', 'em preparo', 'pronto']
const FILTRO_PEDIDOS_GARCOM =
  'tipo_entrega.eq.local,and(tipo_entrega.eq.retirada,garcom_id.not.is.null)'
const COLUNAS_PEDIDO_LISTAGEM =
  'id, nome_cliente, telefone, endereco, bairro, tipo_entrega, status, subtotal, taxa_entrega, total, created_at, forma_pagamento, troco_para, observacoes, mesa, comanda, garcom_id'
const CAMPOS_RELEVANTES_REALTIME_PEDIDO = [
  'status',
  'nome_cliente',
  'telefone',
  'endereco',
  'bairro',
  'tipo_entrega',
  'subtotal',
  'taxa_entrega',
  'total',
  'forma_pagamento',
  'troco_para',
  'observacoes',
  'mesa',
  'comanda',
  'garcom_id',
  'pagamento_online_status',
  'pagamento_online_pago_em',
] as const
const CAMPOS_NUMERICOS_REALTIME_PEDIDO = new Set(['subtotal', 'taxa_entrega', 'total', 'troco_para', 'mesa', 'comanda'])

const normalizarStatus = (status?: string | null) => String(status || '').trim().toLowerCase()
const normalizarTipo = (tipo?: string | null) => String(tipo || '').trim().toLowerCase()

const HORA_INICIO_DIA_OPERACIONAL = 3
const obterInicioDiaOperacional = (referencia: Date = new Date()) => {
  const inicio = new Date(referencia)
  if (inicio.getHours() < HORA_INICIO_DIA_OPERACIONAL) inicio.setDate(inicio.getDate() - 1)
  inicio.setHours(HORA_INICIO_DIA_OPERACIONAL, 0, 0, 0)
  return inicio
}

const itensSaoIguais = (anteriores: ItemPedido[] = [], atuais: ItemPedido[] = []) => {
  if (anteriores.length !== atuais.length) return false
  for (let i = 0; i < anteriores.length; i++) {
    const a = anteriores[i]; const b = atuais[i]
    if (!a || !b) return false
    if (a.id !== b.id) return false
    if ((a.nome_item || '') !== (b.nome_item || '')) return false
    if (Number(a.quantidade || 0) !== Number(b.quantidade || 0)) return false
    if (Number(a.preco_unitario || 0) !== Number(b.preco_unitario || 0)) return false
    if (Number(a.subtotal || 0) !== Number(b.subtotal || 0)) return false
    if ((a.observacoes || '') !== (b.observacoes || '')) return false
  }
  return true
}

const pedidoEhIgual = (anterior: Pedido, atual: Pedido) =>
  anterior.id === atual.id &&
  anterior.nome_cliente === atual.nome_cliente &&
  (anterior.telefone || '') === (atual.telefone || '') &&
  (anterior.endereco || '') === (atual.endereco || '') &&
  (anterior.bairro || '') === (atual.bairro || '') &&
  anterior.tipo_entrega === atual.tipo_entrega &&
  anterior.status === atual.status &&
  Number(anterior.subtotal || 0) === Number(atual.subtotal || 0) &&
  Number(anterior.taxa_entrega || 0) === Number(atual.taxa_entrega || 0) &&
  Number(anterior.total || 0) === Number(atual.total || 0) &&
  anterior.created_at === atual.created_at &&
  (anterior.forma_pagamento || '') === (atual.forma_pagamento || '') &&
  Number(anterior.troco_para || 0) === Number(atual.troco_para || 0) &&
  (anterior.observacoes || '') === (atual.observacoes || '') &&
  Number(anterior.mesa || 0) === Number(atual.mesa || 0) &&
  Number(anterior.comanda || 0) === Number(atual.comanda || 0) &&
  (anterior.garcom_id || '') === (atual.garcom_id || '') &&
  itensSaoIguais(anterior.itens || [], atual.itens || [])

const listasPedidosSaoIguais = (anteriores: Pedido[], atuais: Pedido[]) => {
  if (anteriores.length !== atuais.length) return false
  for (let i = 0; i < anteriores.length; i++) {
    const a = anteriores[i]; const b = atuais[i]
    if (!a || !b || !pedidoEhIgual(a, b)) return false
  }
  return true
}

const normalizarValorRealtimePedido = (campo: (typeof CAMPOS_RELEVANTES_REALTIME_PEDIDO)[number], valor: unknown) =>
  CAMPOS_NUMERICOS_REALTIME_PEDIDO.has(campo) ? Number(valor || 0) : (valor ?? null)

const houveMudancaRelevantePedido = (
  antigo: Record<string, unknown> | null,
  novo: Record<string, unknown> | null
) => {
  if (!antigo || !novo) return true
  return CAMPOS_RELEVANTES_REALTIME_PEDIDO.some(
    (campo) => normalizarValorRealtimePedido(campo, antigo[campo]) !== normalizarValorRealtimePedido(campo, novo[campo])
  )
}

const getStatusDot = (status: string) => {
  switch (normalizarStatus(status)) {
    case 'pendente': return 'bg-amber-500'
    case 'confirmado':
    case 'em preparo':
    case 'preparando': return 'bg-sky-500'
    case 'pronto': return 'bg-emerald-500'
    case 'cancelado': return 'bg-destructive'
    default: return 'bg-muted-foreground/50'
  }
}

const formatarStatus = (status: string) => {
  const texto = (status || '').replaceAll('_', ' ').trim()
  if (!texto) return '-'
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

const getTipoEntregaLabel = (pedido: Pedido) => {
  const tipo = normalizarTipo(pedido.tipo_entrega)
  if (tipo === 'local') {
    if (pedido.comanda) return `Comanda ${pedido.comanda}`
    if (pedido.mesa) return `Mesa ${pedido.mesa}`
    return 'Salão'
  }
  if (tipo === 'retirada') return 'Retirada'
  return pedido.tipo_entrega || '-'
}

const getTipoEntregaIcon = (tipo: string) => {
  const t = normalizarTipo(tipo)
  if (t === 'local') return <Store className="w-3.5 h-3.5" strokeWidth={1.6} />
  return <Package className="w-3.5 h-3.5" strokeWidth={1.6} />
}

export default function GarcomPedidosPage() {
  const { pode, emManutencao } = useControleAcesso()
  const podeCriar = pode('garcom.pedidos', 'criar') && !emManutencao('garcom.pedidos')
  const podeEditar = pode('garcom.pedidos', 'editar') && !emManutencao('garcom.pedidos')
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [loading, setLoading] = useState(true)
  const [carregandoMais, setCarregandoMais] = useState(false)
  const [totalPedidos, setTotalPedidos] = useState(0)
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<Date | null>(null)
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [filtroTipo, setFiltroTipo] = useState('todos')
  const [busca, setBusca] = useState('')
  const [somenteAbertos, setSomenteAbertos] = useState(true)
  const [pedidoExpandido, setPedidoExpandido] = useState<string | null>(null)
  const [copiadoResumoId, setCopiadoResumoId] = useState<string | null>(null)

  const realtimeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pedidosRef = useRef<Pedido[]>([])
  const totalPedidosRef = useRef(0)
  const quantidadePedidosRef = useRef(0)
  const [pedidoIdDetalhes, setPedidoIdDetalhes] = useState<string | null>(null)

  useEffect(() => {
    quantidadePedidosRef.current = pedidos.length
    pedidosRef.current = pedidos
  }, [pedidos])

  useEffect(() => {
    totalPedidosRef.current = totalPedidos
  }, [totalPedidos])

  const montarPedidosComItens = useCallback(async (pedidosBase: Omit<Pedido, 'itens'>[]) => {
    if (pedidosBase.length === 0) return []
    const idsPedidos = pedidosBase.map((p) => p.id)
    const { data: itensData, error: erroItens } = await supabase
      .from('itens_pedido')
      .select('id, nome_item, quantidade, preco_unitario, subtotal, observacoes, pedido_id')
      .in('pedido_id', idsPedidos)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
    if (erroItens) throw erroItens
    const itensPorPedido = (itensData || []).reduce((acc, item) => {
      if (!acc[item.pedido_id]) acc[item.pedido_id] = []
      acc[item.pedido_id].push({
        id: item.id,
        nome_item: item.nome_item,
        quantidade: Number(item.quantidade || 0),
        preco_unitario: Number(item.preco_unitario || 0),
        subtotal: Number(item.subtotal || 0),
        observacoes: item.observacoes || undefined,
      })
      return acc
    }, {} as Record<string, ItemPedido[]>)

    const itensMapa = new Map<string, ItemPedido[]>(Object.entries(itensPorPedido))
    const pagamentoParcialPorPedido = await carregarPagamentosParciaisPorPedido(
      idsPedidos,
      itensMapa,
    ).catch((erro) => {
      console.error('[Garçom] Erro ao carregar pagamentos parciais:', erro)
      return new Map<string, import("@/lib/pagamentoParcial").PagamentoParcialAgregado>()
    })

    return pedidosBase.map((p) => {
      const pagamento = pagamentoParcialPorPedido.get(p.id)
      return {
        ...p,
        itens: itensPorPedido[p.id] || [],
        valor_pago_parcial: pagamento?.valor_pago_parcial ?? 0,
        valor_em_crediario: pagamento?.valor_em_crediario ?? 0,
        itens_pagos_count: pagamento ? Object.keys(pagamento.quantidade_paga_por_item).length : 0,
      }
    })
  }, [])

  const atualizarSilenciosamente = useCallback(async () => {
    try {
      const limite = Math.max(PEDIDOS_POR_PAGINA, Math.min(Math.max(quantidadePedidosRef.current, PEDIDOS_POR_PAGINA), 90))
      const inicioDia = obterInicioDiaOperacional().toISOString()
      const { data: pedidosRecentes, error } = await supabase
        .from('pedidos')
        .select(COLUNAS_PEDIDO_LISTAGEM)
        .or(FILTRO_PEDIDOS_GARCOM)
        .gte('created_at', inicioDia)
        .order('created_at', { ascending: false })
        .range(0, limite - 1)
      if (error) throw error
      if (!pedidosRecentes) return
      const pedidosComItens = await montarPedidosComItens(pedidosRecentes)
      const idsAtualizados = new Set(pedidosComItens.map((p) => p.id))
      const anterioresNaoAtualizados = pedidosRef.current.filter((p) => !idsAtualizados.has(p.id))
      const listaMesclada = [...pedidosComItens, ...anterioresNaoAtualizados]
      if (!listasPedidosSaoIguais(pedidosRef.current, listaMesclada)) setPedidos(listaMesclada)
      const { count } = await supabase
        .from('pedidos')
        .select('id', { count: 'exact', head: true })
        .or(FILTRO_PEDIDOS_GARCOM)
        .gte('created_at', inicioDia)
      const totalAtualizado = typeof count === 'number' ? count : totalPedidosRef.current
      if (totalAtualizado !== totalPedidosRef.current) setTotalPedidos(totalAtualizado)
      setUltimaAtualizacao(new Date())
    } catch (error) {
      console.error('[Garçom] Erro na atualização silenciosa:', error)
    }
  }, [montarPedidosComItens])

  const agendarAtualizacaoRealtime = useCallback((atrasoMs = 300) => {
    if (realtimeDebounceRef.current) clearTimeout(realtimeDebounceRef.current)
    realtimeDebounceRef.current = setTimeout(() => void atualizarSilenciosamente(), atrasoMs)
  }, [atualizarSilenciosamente])

  const carregarPedidos = useCallback(async (resetar = true, offsetPersonalizado = 0) => {
    if (resetar) { setLoading(true); setPedidos([]) } else setCarregandoMais(true)
    try {
      const inicioDia = obterInicioDiaOperacional().toISOString()
      const { count } = await supabase
        .from('pedidos').select('id', { count: 'exact', head: true })
        .or(FILTRO_PEDIDOS_GARCOM)
        .gte('created_at', inicioDia)
      setTotalPedidos(count || 0)
      const offset = resetar ? 0 : offsetPersonalizado
      const { data, error } = await supabase
        .from('pedidos').select(COLUNAS_PEDIDO_LISTAGEM).or(FILTRO_PEDIDOS_GARCOM)
        .gte('created_at', inicioDia)
        .order('created_at', { ascending: false }).range(offset, offset + PEDIDOS_POR_PAGINA - 1)
      if (error) throw error
      const pedidosComItens = await montarPedidosComItens(data || [])
      if (resetar) setPedidos(pedidosComItens)
      else setPedidos((prev) => [...prev, ...pedidosComItens])
      setUltimaAtualizacao(new Date())
    } catch (error) {
      console.error('[Garçom] Erro ao carregar pedidos:', error)
    } finally { setLoading(false); setCarregandoMais(false) }
  }, [montarPedidosComItens])

  const handleGerarPDF = async (pedidoId: string) => {
    try {
      const { data: pedido, error: pedidoError } = await supabase.from('pedidos').select('*').eq('id', pedidoId).single()
      if (pedidoError) throw pedidoError
      const { data: itens, error: itensError } = await supabase.from('itens_pedido').select('*').eq('pedido_id', pedidoId)
      if (itensError) throw itensError
      gerarPDFPedido({
        ...pedido,
        itens: (itens || []).map((item) => ({
          nome_item: item.nome_item || 'Produto',
          quantidade: item.quantidade,
          preco_unitario: item.preco_unitario,
          subtotal: item.subtotal,
          adicionais: item.adicionais,
          observacoes: item.observacoes,
        })),
      })
    } catch (error) { console.error('[Garçom] Erro ao gerar PDF:', error) }
  }

  const handleCopiarResumo = async (pedido: Pedido) => {
    const itens = (pedido.itens || [])
      .map((item) => `- ${item.quantidade}x ${item.nome_item || 'Produto'} (R$ ${Number(item.subtotal || 0).toFixed(2)})`)
      .join('\n')
    const resumo = [
      `Pedido #${pedido.id.slice(0, 8).toUpperCase()}`,
      `Cliente: ${pedido.nome_cliente}`,
      `Tipo: ${getTipoEntregaLabel(pedido)}`,
      `Status: ${formatarStatus(pedido.status)}`,
      pedido.telefone ? `Telefone: ${pedido.telefone}` : null,
      pedido.endereco ? `Endereço: ${pedido.endereco}` : null,
      pedido.forma_pagamento ? `Pagamento: ${pedido.forma_pagamento}` : null,
      '', 'Itens:', itens || '- sem itens', '',
      `Total: R$ ${Number(pedido.total || 0).toFixed(2)}`,
    ].filter(Boolean).join('\n')
    try {
      await navigator.clipboard.writeText(resumo)
      setCopiadoResumoId(pedido.id)
      setTimeout(() => setCopiadoResumoId((atual) => (atual === pedido.id ? null : atual)), 1800)
    } catch (error) { console.error('[Garçom] Erro ao copiar resumo:', error) }
  }

  useEffect(() => {
    void carregarPedidos(true)
    const canal = supabase
      .channel(`garcom-pedidos-realtime-${Date.now()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pedidos' }, () => agendarAtualizacaoRealtime(120))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pedidos' }, (payload) => {
        const antigo = (payload.old || null) as Record<string, unknown> | null
        const novo = (payload.new || null) as Record<string, unknown> | null
        if (!houveMudancaRelevantePedido(antigo, novo)) return
        agendarAtualizacaoRealtime(180)
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'pedidos' }, () => agendarAtualizacaoRealtime(120))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'itens_pedido' }, () => agendarAtualizacaoRealtime(240))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'itens_pedido' }, (payload) => {
        const antigo = (payload.old || null) as Record<string, unknown> | null
        const novo = (payload.new || null) as Record<string, unknown> | null
        if (!antigo || !novo) { agendarAtualizacaoRealtime(240); return }
        const mudou =
          Number(antigo.quantidade || 0) !== Number(novo.quantidade || 0) ||
          Number(antigo.subtotal || 0) !== Number(novo.subtotal || 0) ||
          String(antigo.observacoes || '') !== String(novo.observacoes || '') ||
          String(antigo.nome_item || '') !== String(novo.nome_item || '')
        if (!mudou) return
        agendarAtualizacaoRealtime(240)
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'itens_pedido' }, () => agendarAtualizacaoRealtime(180))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pagamentos_pedido' }, () => agendarAtualizacaoRealtime(180))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crediario_movimentos' }, () => agendarAtualizacaoRealtime(180))
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') { agendarAtualizacaoRealtime(80); return }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') agendarAtualizacaoRealtime(1200)
      })
    const sincronizar = () => {
      if (typeof document !== 'undefined' && document.hidden) return
      agendarAtualizacaoRealtime(120)
    }
    window.addEventListener('online', sincronizar)
    window.addEventListener('focus', sincronizar)
    window.addEventListener('pwa-garcom-reconectar', sincronizar)
    document.addEventListener('visibilitychange', sincronizar)
    return () => {
      if (realtimeDebounceRef.current) clearTimeout(realtimeDebounceRef.current)
      void supabase.removeChannel(canal)
      window.removeEventListener('online', sincronizar)
      window.removeEventListener('focus', sincronizar)
      window.removeEventListener('pwa-garcom-reconectar', sincronizar)
      document.removeEventListener('visibilitychange', sincronizar)
    }
  }, [agendarAtualizacaoRealtime, carregarPedidos])

  const pedidosFiltrados = useMemo(() => {
    return pedidos.filter((pedido) => {
      const statusNorm = normalizarStatus(pedido.status)
      const tipoNorm = normalizarTipo(pedido.tipo_entrega)
      const matchStatus = filtroStatus === 'todos' || statusNorm === filtroStatus
      const matchTipo = filtroTipo === 'todos' || tipoNorm === filtroTipo
      const matchAbertos = !somenteAbertos || STATUS_ABERTOS.includes(statusNorm)
      const matchBusca =
        busca.trim() === '' ||
        pedido.nome_cliente.toLowerCase().includes(busca.toLowerCase()) ||
        (pedido.telefone && pedido.telefone.includes(busca)) ||
        pedido.id.toLowerCase().includes(busca.toLowerCase()) ||
        String(pedido.mesa || '').includes(busca) ||
        String(pedido.comanda || '').includes(busca)
      return matchStatus && matchTipo && matchAbertos && matchBusca
    })
  }, [pedidos, filtroStatus, filtroTipo, busca, somenteAbertos])

  const metricas = useMemo(() => ({
    abertos: pedidos.filter((p) => STATUS_ABERTOS.includes(normalizarStatus(p.status))).length,
    pendentes: pedidos.filter((p) => normalizarStatus(p.status) === 'pendente').length,
    emPreparo: pedidos.filter((p) => ['confirmado', 'preparando', 'em preparo'].includes(normalizarStatus(p.status))).length,
    prontos: pedidos.filter((p) => normalizarStatus(p.status) === 'pronto').length,
    noLocal: pedidos.filter((p) => normalizarTipo(p.tipo_entrega) === 'local' && STATUS_ABERTOS.includes(normalizarStatus(p.status))).length,
  }), [pedidos])

  const textoUltimaAtualizacao = useMemo(() => {
    if (!ultimaAtualizacao) return 'Aguardando sincronização'
    return `Atualizado às ${format(ultimaAtualizacao, 'HH:mm:ss', { locale: ptBR })}`
  }, [ultimaAtualizacao])

  const temMaisPedidos = pedidos.length < totalPedidos
  const limparFiltros = () => { setBusca(''); setFiltroStatus('todos'); setFiltroTipo('todos'); setSomenteAbertos(true) }
  const filtrosAtivos = busca || filtroStatus !== 'todos' || filtroTipo !== 'todos' || !somenteAbertos

  return (
    <RotaProtegidaGarcom>
      <GarcomLayout>
        <div className="space-y-4">

          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-foreground">Central de Pedidos</h1>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {pedidosFiltrados.length} de {totalPedidos} pedido{totalPedidos !== 1 ? 's' : ''} hoje · zera às 03h · {textoUltimaAtualizacao}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => carregarPedidos(true)}
                disabled={loading}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border/70 bg-background px-3 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} strokeWidth={1.6} />
                <span className="hidden sm:inline">Atualizar</span>
              </button>
              {podeCriar ? (
                <Link
                  href="/garcom/novo"
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-foreground px-3 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
                >
                  <Plus className="h-3.5 w-3.5" strokeWidth={1.6} />
                  Novo pedido
                </Link>
              ) : null}
            </div>
          </div>

          {/* Stat tiles */}
          <div className="grid grid-cols-5 gap-1.5">
            {[
              {
                label: 'Abertos', valor: metricas.abertos,
                ativo: somenteAbertos && filtroStatus === 'todos' && filtroTipo === 'todos',
                acao: () => { setSomenteAbertos(true); setFiltroStatus('todos'); setFiltroTipo('todos') },
              },
              {
                label: 'Pend.', valor: metricas.pendentes,
                ativo: filtroStatus === 'pendente',
                acao: () => { setSomenteAbertos(false); setFiltroStatus('pendente') },
              },
              {
                label: 'Preparo', valor: metricas.emPreparo,
                ativo: filtroStatus === 'preparando',
                acao: () => { setSomenteAbertos(false); setFiltroStatus('preparando') },
              },
              {
                label: 'Prontos', valor: metricas.prontos,
                ativo: filtroStatus === 'pronto',
                acao: () => { setSomenteAbertos(false); setFiltroStatus('pronto') },
              },
              {
                label: 'Local', valor: metricas.noLocal,
                ativo: filtroTipo === 'local',
                acao: () => { setSomenteAbertos(false); setFiltroTipo('local') },
              },
            ].map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={item.acao}
                className={`min-h-[56px] rounded-lg border px-1.5 py-2 text-center transition-colors ${
                  item.ativo
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-border/70 bg-card text-foreground hover:bg-muted'
                }`}
              >
                <span className="block font-mono text-base font-bold leading-none tabular-nums sm:text-lg">
                  {item.valor}
                </span>
                <span className="mt-1 block truncate text-[10px] font-medium leading-tight text-inherit opacity-70 sm:text-xs">
                  {item.label}
                </span>
              </button>
            ))}
          </div>

          {/* Filtros */}
          <div className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1.5fr)_minmax(130px,0.7fr)_minmax(120px,0.65fr)_auto_auto]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" strokeWidth={1.6} />
              <input
                type="text"
                placeholder="Cliente, ID, telefone, mesa..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="h-9 w-full rounded-lg border border-border/70 bg-background pl-9 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {busca && (
                <button onClick={() => setBusca('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" strokeWidth={1.6} />
                </button>
              )}
            </div>

            <div className="relative">
              <Filter className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" strokeWidth={1.6} />
              <select
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value)}
                className="h-9 w-full cursor-pointer appearance-none rounded-lg border border-border/70 bg-background pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="todos">Todos os status</option>
                <option value="pendente">Pendente</option>
                <option value="confirmado">Confirmado</option>
                <option value="preparando">Em preparo</option>
                <option value="pronto">Pronto</option>
                <option value="entregue">Entregue</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>

            <div className="relative">
              <Layers3 className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" strokeWidth={1.6} />
              <select
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value)}
                className="h-9 w-full cursor-pointer appearance-none rounded-lg border border-border/70 bg-background pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="todos">Todos os tipos</option>
                <option value="retirada">Retirada</option>
                <option value="local">Salão</option>
              </select>
            </div>

            <button
              type="button"
              onClick={() => setSomenteAbertos((v) => !v)}
              className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors ${
                somenteAbertos
                  ? 'border-foreground bg-foreground text-background'
                  : 'border-border/70 bg-background hover:bg-muted'
              }`}
            >
              <Clock className="h-3.5 w-3.5" strokeWidth={1.6} />
              Abertos
            </button>

            {filtrosAtivos && (
              <button
                type="button"
                onClick={limparFiltros}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border/70 bg-background px-3 text-sm font-medium transition-colors hover:bg-muted"
              >
                <X className="h-3.5 w-3.5" strokeWidth={1.6} />
                Limpar
              </button>
            )}
          </div>

          {/* Conteúdo */}
          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-foreground" />
            </div>
          ) : pedidosFiltrados.length === 0 ? (
            <div className="rounded-xl border border-border/70 bg-card p-12 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl border border-border/70 bg-muted/30">
                <ClipboardList className="h-6 w-6 text-muted-foreground" strokeWidth={1.6} />
              </div>
              <h3 className="text-base font-semibold tracking-tight text-foreground">Nenhum pedido encontrado</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {podeCriar ? 'Ajuste os filtros ou abra um novo pedido.' : 'Ajuste os filtros para pesquisar novamente.'}
              </p>
              {podeCriar ? (
                <Link
                  href="/garcom/novo"
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-foreground/90"
                >
                  <Plus className="h-4 w-4" strokeWidth={1.6} />
                  Criar pedido
                </Link>
              ) : null}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3 xl:grid-cols-3">
                {pedidosFiltrados.map((pedido, index) => {
                  const expandido = pedidoExpandido === pedido.id
                  return (
                    <motion.div
                      key={pedido.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(index * 0.02, 0.3) }}
                      className="min-w-0 overflow-hidden rounded-xl border border-border/70 bg-card transition-colors hover:border-border"
                    >
                      {/* Cabeçalho clicável */}
                      <button
                        type="button"
                        onClick={() => setPedidoExpandido(expandido ? null : pedido.id)}
                        className="w-full cursor-pointer p-3 text-left"
                      >
                        <div className="flex items-start gap-3">
                          {/* Stamp de mesa/comanda/tipo */}
                          {(() => {
                            const tipoNorm = normalizarTipo(pedido.tipo_entrega)
                            const ehLocal = tipoNorm === 'local'
                            const numero = pedido.mesa ?? pedido.comanda ?? null
                            if (ehLocal && numero != null) {
                              return (
                                <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl border border-bordo-500/30 bg-bordo-50 text-bordo-700 dark:border-bordo-500/40 dark:bg-bordo-950/40 dark:text-dourado-400">
                                  <span className="text-[8px] font-semibold uppercase leading-none tracking-wider opacity-70">
                                    {pedido.comanda ? 'Comanda' : 'Mesa'}
                                  </span>
                                  <span className="mt-1 font-mono text-xl font-bold leading-none tabular-nums">
                                    {numero}
                                  </span>
                                </div>
                              )
                            }
                            return (
                              <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl border border-border/70 bg-muted/40 text-muted-foreground">
                                {getTipoEntregaIcon(pedido.tipo_entrega)}
                                <span className="mt-1 text-[8px] font-semibold uppercase leading-none tracking-wider">
                                  {tipoNorm === 'retirada' ? 'Retira' : tipoNorm === 'entrega' ? 'Delivery' : 'Salão'}
                                </span>
                              </div>
                            )
                          })()}

                          <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 items-center gap-2">
                              <span className="inline-flex min-w-0 items-center gap-1.5 text-xs font-medium text-foreground">
                                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${getStatusDot(pedido.status)}`} />
                                <span className="truncate">{formatarStatus(pedido.status)}</span>
                              </span>
                              <span className="ml-auto shrink-0 text-[11px] text-muted-foreground tabular-nums">
                                {format(new Date(pedido.created_at), 'HH:mm', { locale: ptBR })}
                              </span>
                            </div>

                            <h4 className="mt-1 truncate text-sm font-semibold text-foreground">
                              {pedido.nome_cliente}
                            </h4>
                            <p className="font-mono text-[10px] tabular-nums text-muted-foreground">
                              #{pedido.id.slice(0, 8).toUpperCase()}
                            </p>
                          </div>

                          <ChevronDown
                            className={`h-4 w-4 shrink-0 self-center text-muted-foreground transition-transform ${expandido ? 'rotate-180' : ''}`}
                            strokeWidth={1.6}
                          />
                        </div>
                      </button>

                      {/* Pagamento parcial / Crediário */}
                      {((pedido.valor_pago_parcial ?? 0) > 0 ||
                        (pedido.valor_em_crediario ?? 0) > 0) && (
                        <div className="px-3 pb-2">
                          <BarraPagamentoParcial
                            total={Number(pedido.total || 0)}
                            valorPago={pedido.valor_pago_parcial ?? 0}
                            valorEmCrediario={pedido.valor_em_crediario ?? 0}
                          />
                        </div>
                      )}

                      {/* Total */}
                      <div className="flex items-center justify-between gap-2 px-3 pb-2 text-xs">
                        <span className="text-muted-foreground">Total</span>
                        <span className="font-mono text-sm font-bold tabular-nums text-bordo-600 dark:text-dourado-400">
                          R$ {Number(pedido.total || 0).toFixed(2)}
                        </span>
                      </div>

                      {/* Ações rápidas */}
                      {podeEditar ? <div className="flex gap-1.5 border-t border-border/50 px-3 pb-3 pt-2">
                        <Link
                          href={`/garcom/editar/${pedido.id}?acao=adicionar-item`}
                          className="inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-foreground px-2 py-1.5 text-xs font-medium text-background transition-colors hover:bg-foreground/90 active:bg-foreground/80"
                        >
                          <Plus className="h-3.5 w-3.5" strokeWidth={1.6} />
                          Adicionar
                        </Link>
                        <Link
                          href={`/garcom/editar/${pedido.id}`}
                          aria-label="Editar pedido"
                          className="inline-flex min-h-9 min-w-9 items-center justify-center gap-1.5 rounded-lg border border-border/70 px-2 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
                        >
                          <Pencil className="h-3.5 w-3.5" strokeWidth={1.6} />
                          <span className="hidden sm:inline">Editar</span>
                        </Link>
                      </div> : null}

                      {/* Detalhes expandidos */}
                      {expandido && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="border-t border-border/50"
                        >
                          <div className="space-y-3 p-3">
                            {/* Infos do pedido */}
                            <div className="space-y-1.5 text-xs">
                              {pedido.telefone && (
                                <div className="flex items-center gap-2 text-muted-foreground">
                                  <Phone className="h-3.5 w-3.5 shrink-0" strokeWidth={1.6} />
                                  <span>{pedido.telefone}</span>
                                </div>
                              )}
                              {pedido.forma_pagamento && (
                                <div className="flex items-center gap-2 text-muted-foreground">
                                  <CreditCard className="h-3.5 w-3.5 shrink-0" strokeWidth={1.6} />
                                  <span>{pedido.forma_pagamento}</span>
                                  {pedido.troco_para && (
                                    <span className="text-emerald-600 dark:text-emerald-400">
                                      (troco p/ R$ {pedido.troco_para})
                                    </span>
                                  )}
                                </div>
                              )}
                              {pedido.endereco && (
                                <div className="flex items-start gap-2 text-muted-foreground">
                                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.6} />
                                  <span>{pedido.endereco}</span>
                                </div>
                              )}
                              {pedido.observacoes && (
                                <div className="flex items-start gap-2 text-muted-foreground">
                                  <ClipboardList className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.6} />
                                  <span>{pedido.observacoes}</span>
                                </div>
                              )}
                            </div>

                            {/* Itens */}
                            {pedido.itens && pedido.itens.length > 0 && (
                              <div className="rounded-lg border border-border/70 bg-muted/30 p-3">
                                <p className="mb-2 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                                  Itens
                                </p>
                                <div className="space-y-1.5">
                                  {pedido.itens.map((item, idx) => (
                                    <div key={item.id || idx} className="flex justify-between gap-2 text-xs">
                                      <div className="min-w-0 flex-1">
                                        <span className="text-foreground">{item.quantidade}x {item.nome_item || 'Produto'}</span>
                                        {item.observacoes && (
                                          <p className="mt-0.5 italic text-muted-foreground">{item.observacoes}</p>
                                        )}
                                      </div>
                                      <span className="font-mono tabular-nums text-foreground">
                                        R$ {Number(item.subtotal || 0).toFixed(2)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                                <div className="mt-2 space-y-1 border-t border-border/50 pt-2">
                                  <div className="flex justify-between text-xs text-muted-foreground">
                                    <span>Subtotal</span>
                                    <span className="font-mono tabular-nums">R$ {Number(pedido.subtotal || 0).toFixed(2)}</span>
                                  </div>
                                  {Number(pedido.taxa_entrega || 0) > 0 && (
                                    <div className="flex justify-between text-xs text-muted-foreground">
                                      <span>Taxa</span>
                                      <span className="font-mono tabular-nums">R$ {Number(pedido.taxa_entrega || 0).toFixed(2)}</span>
                                    </div>
                                  )}
                                  <div className="flex justify-between text-sm font-semibold text-foreground">
                                    <span>Total</span>
                                    <span className="font-mono tabular-nums text-bordo-600 dark:text-dourado-400">
                                      R$ {Number(pedido.total || 0).toFixed(2)}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Ações secundárias */}
                            <div className="flex flex-wrap gap-1.5">
                              <button
                                onClick={() => setPedidoIdDetalhes(pedido.id)}
                                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border/70 bg-foreground/5 px-3 text-xs font-medium text-foreground transition-colors hover:bg-foreground/10"
                                aria-label="Abrir detalhes do pedido"
                                title="Detalhes · imprimir/pagar por item"
                              >
                                <Layers3 className="h-3.5 w-3.5" strokeWidth={1.6} />
                                Detalhes
                              </button>

                              <button
                                onClick={() => handleCopiarResumo(pedido)}
                                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border/70 px-3 text-xs font-medium transition-colors hover:bg-muted"
                              >
                                {copiadoResumoId === pedido.id
                                  ? <Check className="h-3.5 w-3.5 text-emerald-500" strokeWidth={1.6} />
                                  : <Copy className="h-3.5 w-3.5" strokeWidth={1.6} />}
                                {copiadoResumoId === pedido.id ? 'Copiado' : 'Copiar'}
                              </button>

                              <button
                                onClick={() => handleGerarPDF(pedido.id)}
                                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border/70 px-3 text-xs font-medium transition-colors hover:bg-muted"
                              >
                                <FileText className="h-3.5 w-3.5" strokeWidth={1.6} />
                                PDF
                              </button>

                              {podeCriar ? (
                                <Link
                                  href={`/garcom/novo?repetir=${pedido.id}`}
                                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border/70 px-3 text-xs font-medium transition-colors hover:bg-muted"
                                >
                                  <Plus className="h-3.5 w-3.5" strokeWidth={1.6} />
                                  Repetir
                                </Link>
                              ) : null}

                              {podeCriar && normalizarTipo(pedido.tipo_entrega) === 'local' && (pedido.mesa || pedido.comanda) && (
                                <Link
                                  href={`/garcom/novo?${pedido.comanda ? `comanda=${pedido.comanda}` : `mesa=${pedido.mesa}`}`}
                                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border/70 px-3 text-xs font-medium transition-colors hover:bg-muted"
                                >
                                  <Store className="h-3.5 w-3.5" strokeWidth={1.6} />
                                  Novo · {pedido.comanda ? `Comanda ${pedido.comanda}` : `Mesa ${pedido.mesa}`}
                                </Link>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </motion.div>
                  )
                })}
              </div>

              {temMaisPedidos && (
                <div className="flex justify-center">
                  <button
                    onClick={() => carregarPedidos(false, pedidos.length)}
                    disabled={carregandoMais}
                    className="inline-flex h-9 items-center gap-2 rounded-lg border border-border/70 px-6 text-sm font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {carregandoMais ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.6} />
                        Carregando...
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-3.5 w-3.5" strokeWidth={1.6} />
                        Ver mais ({totalPedidos - pedidos.length} restantes)
                      </>
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* FAB mobile */}
        {podeCriar ? (
          <Link
            href="/garcom/novo"
            data-acao-rapida-garcom="novo"
            className="fixed bottom-20 right-4 z-40 inline-flex min-h-[52px] items-center gap-2 rounded-2xl bg-foreground px-4 py-3 text-sm font-semibold text-background shadow-lg transition-colors hover:bg-foreground/90 active:bg-foreground/80 md:hidden"
          >
            <Plus className="h-5 w-5" strokeWidth={1.6} />
            Novo
          </Link>
        ) : null}

        <ModalDetalhesPedido
          pedidoId={pedidoIdDetalhes}
          aberto={Boolean(pedidoIdDetalhes)}
          onFechar={() => {
            setPedidoIdDetalhes(null)
            void atualizarSilenciosamente()
          }}
        />
      </GarcomLayout>
    </RotaProtegidaGarcom>
  )
}
