'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, Suspense } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  CheckSquare,
  Loader2,
  Package,
  Plus,
  RefreshCw,
  Search,
  Square,
  Trash2,
  X,
} from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import ProtectedRoute from '@/components/admin/ProtectedRoute'
import AdminLayout from '@/components/admin/AdminLayout'
import { FiltrosAtivosChips, type ChipFiltroAtivo } from '@/components/admin/filtros/FiltrosAtivosChips'
import { GradeSkeleton, ListaVazia } from '@/components/admin/filtros/ListaEstado'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'
import { gerarPDFPedido } from '@/lib/pdf-generator'
import ModalEditarPedido from '@/components/admin/ModalEditarPedido'
import ModalNotificacao from '@/components/ModalNotificacao'
import ModalDetalhesPedido from '@/components/admin/ModalDetalhesPedido'
import CardPedido, { type Pedido } from '@/components/admin/CardPedido'
import {
  carregarCrediarioPorPedido,
  carregarGarconsPorIds,
  carregarItensPorPedido,
  pedidoEstaEncerrado,
} from '@/lib/pedidos-utils'
import { carregarPagamentosParciaisPorPedido } from '@/lib/pagamentoParcial'
import { enfileirarImpressao, gerarHashEventoImpressao } from '@/lib/filaImpressao'
import { cn } from '@/lib/utils'
import { estaNoDiaOperacionalAtual } from '@/lib/dia-operacional'
import { TEMPO_AVISO_MESA_MINUTOS, TEMPO_PADRAO_MESA_MINUTOS, calcularLiberacaoMesa } from '@/lib/mesas-tempo'
import {
  criarIntervaloEntregas,
  obterDatasPeriodoEntrega,
} from '@/features/entregas/lib/intervalo-entregas'
import type { PeriodoEntrega } from '@/features/entregas/types'
import PaginacaoPedidos from '@/features/pedidos/components/PaginacaoPedidos'
import {
  FiltroPedidosAdmin,
  LABEL_PERIODO_PEDIDOS,
  STATUS_PEDIDO_ADMIN,
  TIPOS_PEDIDO_ADMIN,
  type FiltroCanalSalaoAdmin,
  type FiltroGarcomPedidoAdmin,
  type FiltroPagamentoPedidoAdmin,
  type FiltroSituacaoPedidoAdmin,
  type FiltroStatusPedidoAdmin,
  type FiltroTipoPedidoAdmin,
} from '@/features/pedidos/components/FiltroPedidosAdmin'

const PEDIDOS_POR_PAGINA_PADRAO = 15

type AcaoPedido = 'pagamento' | 'impressao' | 'concluir' | 'restaurarMesa'
type AcoesPedido = Partial<Record<AcaoPedido, boolean>>
type FiltroStatusPedido = FiltroStatusPedidoAdmin
type FiltroTipoPedido = FiltroTipoPedidoAdmin

const STATUS_PEDIDO = STATUS_PEDIDO_ADMIN
const TIPOS_PEDIDO = TIPOS_PEDIDO_ADMIN

const pedidoDentroDoDiaOperacional = (createdAt: string) => estaNoDiaOperacionalAtual(createdAt)

export default function PedidosPage() {
  return (
    <Suspense
      fallback={
        <ProtectedRoute>
          <AdminLayout>
            <div className="flex min-h-[60vh] items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          </AdminLayout>
        </ProtectedRoute>
      }
    >
      <PedidosContent />
    </Suspense>
  )
}

function PedidosContent() {
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [loading, setLoading] = useState(true)
  const [totalPedidos, setTotalPedidos] = useState(0)
  const [paginaAtual, setPaginaAtual] = useState(1)
  const [itensPorPagina, setItensPorPagina] = useState(PEDIDOS_POR_PAGINA_PADRAO)
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatusPedido>('todos')
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipoPedido>('todos')
  const [filtroSituacao, setFiltroSituacao] = useState<FiltroSituacaoPedidoAdmin>('todos')
  const [filtroPagamento, setFiltroPagamento] = useState<FiltroPagamentoPedidoAdmin>('todos')
  const [filtroGarcom, setFiltroGarcom] = useState<FiltroGarcomPedidoAdmin>('todos')
  const [filtroCanalSalao, setFiltroCanalSalao] = useState<FiltroCanalSalaoAdmin>('todos')
  const [periodo, setPeriodo] = useState<PeriodoEntrega>('todos')
  const [datasPeriodo, setDatasPeriodo] = useState(() => obterDatasPeriodoEntrega('hoje'))
  const [busca, setBusca] = useState('')
  const [buscaAplicada, setBuscaAplicada] = useState('')
  const [pedidoSelecionado, setPedidoSelecionado] = useState<Pedido | null>(null)
  const [modalEditarAberto, setModalEditarAberto] = useState(false)
  const [modalDetalhesAberto, setModalDetalhesAberto] = useState(false)
  const [pedidoDetalhesId, setPedidoDetalhesId] = useState<string | null>(null)
  const [acoesPedido, setAcoesPedido] = useState<Record<string, AcoesPedido>>({})
  const requisicaoAtualRef = useRef(0)

  const [modoSelecao, setModoSelecao] = useState(false)
  const [idsSelecionados, setIdsSelecionados] = useState<Set<string>>(new Set())
  const [excluindoEmMassa, setExcluindoEmMassa] = useState(false)

  const [modalNotificacao, setModalNotificacao] = useState<{
    aberto: boolean
    tipo: 'sucesso' | 'erro' | 'aviso' | 'info' | 'confirmacao'
    titulo: string
    mensagem: string
    onConfirmar: () => void
  }>({
    aberto: false,
    tipo: 'info',
    titulo: '',
    mensagem: '',
    onConfirmar: () => {},
  })
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const pedidoIdParam = searchParams.get('pedido')
    if (!pedidoIdParam) return

    setPedidoDetalhesId(pedidoIdParam)
    setModalDetalhesAberto(true)
    router.replace('/admin/pedidos', { scroll: false })
  }, [searchParams, router])

  const intervaloPeriodo = useMemo(() => {
    if (periodo === 'todos') return null
    if (periodo !== 'personalizado') {
      const datas = obterDatasPeriodoEntrega(periodo)
      return criarIntervaloEntregas(datas.dataInicio, datas.dataFim)
    }
    return criarIntervaloEntregas(datasPeriodo.dataInicio, datasPeriodo.dataFim)
  }, [periodo, datasPeriodo.dataInicio, datasPeriodo.dataFim])

  const chipsFiltroAtivo = useMemo((): ChipFiltroAtivo[] => {
    const chips: ChipFiltroAtivo[] = []
    if (buscaAplicada) {
      chips.push({ key: 'busca', label: 'Busca', value: buscaAplicada })
    }
    if (periodo !== 'todos') {
      chips.push({
        key: 'periodo',
        label: 'Período',
        value:
          periodo === 'personalizado'
            ? `${datasPeriodo.dataInicio} → ${datasPeriodo.dataFim}`
            : LABEL_PERIODO_PEDIDOS[periodo],
      })
    }
    if (filtroSituacao !== 'todos') {
      chips.push({
        key: 'situacao',
        label: 'Situação',
        value: filtroSituacao === 'abertos' ? 'Em aberto' : 'Encerrados',
      })
    }
    if (filtroStatus !== 'todos') {
      chips.push({
        key: 'status',
        label: 'Status',
        value: STATUS_PEDIDO.find((item) => item.valor === filtroStatus)?.label ?? filtroStatus,
      })
    }
    if (filtroTipo !== 'todos') {
      chips.push({
        key: 'tipo',
        label: 'Tipo',
        value: TIPOS_PEDIDO.find((item) => item.valor === filtroTipo)?.label ?? filtroTipo,
      })
    }
    if (filtroPagamento !== 'todos') {
      const labelsPagamento: Record<FiltroPagamentoPedidoAdmin, string> = {
        todos: 'Todos',
        pix_pendente: 'PIX pendente',
        fiado: 'Fiado',
        dinheiro: 'Dinheiro',
        cartao: 'Cartão',
        pix: 'PIX',
      }
      chips.push({ key: 'pagamento', label: 'Pagamento', value: labelsPagamento[filtroPagamento] })
    }
    if (filtroGarcom !== 'todos') {
      chips.push({
        key: 'garcom',
        label: 'Garçom',
        value: filtroGarcom === 'com_garcom' ? 'Com garçom' : 'Sem garçom',
      })
    }
    if (filtroCanalSalao !== 'todos') {
      chips.push({
        key: 'canal',
        label: 'Salão',
        value: filtroCanalSalao === 'mesa' ? 'Mesa' : 'Comanda',
      })
    }
    return chips
  }, [
    buscaAplicada,
    datasPeriodo.dataFim,
    datasPeriodo.dataInicio,
    filtroCanalSalao,
    filtroGarcom,
    filtroPagamento,
    filtroSituacao,
    filtroStatus,
    filtroTipo,
    periodo,
  ])

  const handleLimparFiltros = () => {
    setBusca('')
    setBuscaAplicada('')
    setFiltroStatus('todos')
    setFiltroTipo('todos')
    setFiltroSituacao('todos')
    setFiltroPagamento('todos')
    setFiltroGarcom('todos')
    setFiltroCanalSalao('todos')
    setPeriodo('todos')
    setDatasPeriodo(obterDatasPeriodoEntrega('hoje'))
    setPaginaAtual(1)
  }
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setBuscaAplicada(busca.trim())
      setPaginaAtual(1)
    }, 350)

    return () => window.clearTimeout(timer)
  }, [busca])

  const carregarPedidos = useCallback(async (silencioso = false) => {
    const requisicaoId = ++requisicaoAtualRef.current
    if (!silencioso) setLoading(true)

    try {
      const offset = (paginaAtual - 1) * itensPorPagina
      let query = supabase
        .from('pedidos')
        .select(
          'id, nome_cliente, telefone, endereco, bairro, tipo_entrega, status, subtotal, taxa_entrega, taxa_servico, total, created_at, mesa, comanda, mesa_id, forma_pagamento, pagamento_online, pagamento_online_status, garcom_id, mesa_dados:mesas!pedidos_mesa_id_fkey(identificador, tipo, status, pedido_id, liberar_em, tempo_limite_minutos)',
          { count: 'exact' },
        )

      if (intervaloPeriodo) {
        query = query
          .gte('created_at', intervaloPeriodo.inicioIso)
          .lt('created_at', intervaloPeriodo.fimExclusivoIso)
      }

      if (filtroStatus !== 'todos') {
        query = query.eq('status', filtroStatus)
      }

      if (filtroTipo !== 'todos') {
        query = query.eq('tipo_entrega', filtroTipo)
      }

      if (filtroSituacao === 'abertos') {
        query = query.not('status', 'in', '("entregue","cancelado")')
      }

      if (filtroSituacao === 'encerrados') {
        query = query.in('status', ['entregue', 'cancelado'])
      }

      if (filtroPagamento === 'pix_pendente') {
        query = query
          .eq('pagamento_online', true)
          .not('pagamento_online_status', 'in', '("pago","aprovado","approved")')
      }

      if (filtroPagamento === 'fiado') {
        query = query.ilike('forma_pagamento', '%credi%')
      }

      if (filtroPagamento === 'dinheiro') {
        query = query.ilike('forma_pagamento', '%dinheiro%')
      }

      if (filtroPagamento === 'cartao') {
        query = query.or('forma_pagamento.ilike.%cart%,forma_pagamento.ilike.%crédito%,forma_pagamento.ilike.%credito%,forma_pagamento.ilike.%débito%,forma_pagamento.ilike.%debito%')
      }

      if (filtroPagamento === 'pix') {
        query = query.ilike('forma_pagamento', '%pix%')
      }

      if (filtroGarcom === 'com_garcom') {
        query = query.not('garcom_id', 'is', null)
      }

      if (filtroGarcom === 'sem_garcom') {
        query = query.is('garcom_id', null)
      }

      if (filtroCanalSalao === 'mesa') {
        query = query.not('mesa', 'is', null).neq('mesa', '')
      }

      if (filtroCanalSalao === 'comanda') {
        query = query.not('comanda', 'is', null).neq('comanda', '')
      }

      if (buscaAplicada) {
        const termoSeguro = buscaAplicada.replace(/[,%()]/g, ' ').trim()
        const telefone = buscaAplicada.replace(/\D/g, '')
        const filtrosBusca = [`nome_cliente.ilike.%${termoSeguro}%`]

        if (telefone) {
          filtrosBusca.push(`telefone.ilike.%${telefone}%`)
        }

        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(buscaAplicada)) {
          filtrosBusca.push(`id.eq.${buscaAplicada}`)
        }

        query = query.or(filtrosBusca.join(','))
      }

      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .range(offset, offset + itensPorPagina - 1)

      if (error) throw error

      const lista = data || []
      const idsPedidos = lista.map((p) => String(p.id))
      const idsGarcons = Array.from(
        new Set(lista.map((p) => p.garcom_id).filter(Boolean)),
      ) as string[]

      const [itensPorPedido, crediarioPorPedido, garconsPorId] = await Promise.all([
        carregarItensPorPedido(idsPedidos),
        carregarCrediarioPorPedido(idsPedidos),
        carregarGarconsPorIds(idsGarcons),
      ])

      const pagamentoParcialPorPedido = await carregarPagamentosParciaisPorPedido(
        idsPedidos,
        itensPorPedido,
      ).catch((erro) => {
        console.error('[AdminPedidos] Erro ao carregar pagamentos parciais:', erro)
        return new Map<string, import("@/lib/pagamentoParcial").PagamentoParcialAgregado>()
      })

      const pedidosComItens: Pedido[] = lista.map((pedido) => {
        const crediario = crediarioPorPedido.get(String(pedido.id))
        const mesaDados = (pedido as {
          mesa_dados?: {
            identificador?: string | null
            tipo?: string | null
            status?: string | null
            pedido_id?: string | null
            liberar_em?: string | null
            tempo_limite_minutos?: number | null
          } | null
        }).mesa_dados
        const pagamentoParcial = pagamentoParcialPorPedido.get(String(pedido.id))
        return {
          ...pedido,
          mesa_identificador: mesaDados?.identificador ?? null,
          mesa_tipo: mesaDados?.tipo ?? null,
          mesa_status: mesaDados?.status ?? null,
          mesa_pedido_id: mesaDados?.pedido_id ? String(mesaDados.pedido_id) : null,
          mesa_liberar_em: mesaDados?.liberar_em ?? null,
          mesa_tempo_limite_minutos:
            mesaDados?.tempo_limite_minutos === null || mesaDados?.tempo_limite_minutos === undefined
              ? null
              : Number(mesaDados.tempo_limite_minutos),
          itens: itensPorPedido.get(String(pedido.id)) || [],
          nome_garcom: pedido.garcom_id ? garconsPorId.get(pedido.garcom_id) || null : null,
          crediario_status: crediario?.status ?? null,
          crediario_saldo: crediario?.saldo_atual ?? null,
          valor_pago_parcial: pagamentoParcial?.valor_pago_parcial ?? 0,
          valor_em_crediario: pagamentoParcial?.valor_em_crediario ?? 0,
          itens_pagos_count: pagamentoParcial ? Object.keys(pagamentoParcial.quantidade_paga_por_item).length : 0,
        }
      })

      if (requisicaoId !== requisicaoAtualRef.current) return
      setTotalPedidos(count || 0)
      setPedidos(pedidosComItens)
    } catch (error) {
      if (requisicaoId !== requisicaoAtualRef.current) return
      console.error('Erro ao carregar pedidos:', error)
      setPedidos([])
      setTotalPedidos(0)
    } finally {
      if (requisicaoId === requisicaoAtualRef.current) {
        setLoading(false)
      }
    }
  }, [
    buscaAplicada,
    filtroCanalSalao,
    filtroGarcom,
    filtroPagamento,
    filtroSituacao,
    filtroStatus,
    filtroTipo,
    intervaloPeriodo,
    itensPorPagina,
    paginaAtual,
  ])

  useEffect(() => {
    void carregarPedidos()
  }, [carregarPedidos])

  useEffect(() => {
    return () => {
      requisicaoAtualRef.current += 1
    }
  }, [])

  useLayoutEffect(() => {
    const main = document.querySelector<HTMLElement>('[data-admin-scroll-container]')
    main?.scrollTo({ top: 0, behavior: 'auto' })
  }, [
    buscaAplicada,
    filtroCanalSalao,
    filtroGarcom,
    filtroPagamento,
    filtroSituacao,
    filtroStatus,
    filtroTipo,
    intervaloPeriodo,
    itensPorPagina,
    paginaAtual,
  ])

  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null
    const agendarRecarga = () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        debounceTimer = null
        void carregarPedidos(true)
      }, 300)
    }

    const channel = supabase
      .channel(`pedidos-lista-${paginaAtual}-${itensPorPagina}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, agendarRecarga)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pagamentos_pedido' }, agendarRecarga)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crediario_movimentos' }, agendarRecarga)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'itens_pedido' }, agendarRecarga)
      .subscribe()

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      supabase.removeChannel(channel)
    }
  }, [carregarPedidos, itensPorPagina, paginaAtual])

  const totalPaginas = Math.max(1, Math.ceil(totalPedidos / itensPorPagina))

  useEffect(() => {
    if (paginaAtual > totalPaginas) {
      setPaginaAtual(totalPaginas)
    }
  }, [paginaAtual, totalPaginas])

  const handleGerarPDF = async (pedidoId: string) => {
    try {
      const { data: pedido, error: pedidoError } = await supabase
        .from('pedidos')
        .select(
          'id, nome_cliente, telefone, endereco, bairro, tipo_entrega, status, subtotal, taxa_entrega, taxa_servico, total, created_at, mesa, comanda, forma_pagamento, pagamento_online, pagamento_online_status, troco_para, observacoes',
        )
        .eq('id', pedidoId)
        .single()
      if (pedidoError) throw pedidoError

      const { data: itens, error: itensError } = await supabase
        .from('itens_pedido')
        .select('nome_item, quantidade, preco_unitario, subtotal, adicionais, observacoes')
        .eq('pedido_id', pedidoId)
      if (itensError) throw itensError

      gerarPDFPedido({
        ...pedido,
        itens: itens.map((item) => ({
          nome_item: item.nome_item || 'Produto',
          quantidade: item.quantidade,
          preco_unitario: item.preco_unitario,
          subtotal: item.subtotal,
          adicionais: item.adicionais,
          observacoes: item.observacoes,
        })),
      })
    } catch (error) {
      console.error('Erro ao gerar PDF:', error)
    }
  }

  const handleExcluirPedido = async (pedidoId: string) => {
    setModalNotificacao({
      aberto: true,
      tipo: 'confirmacao',
      titulo: 'Confirmar Exclusão',
      mensagem: 'Tem certeza que deseja excluir este pedido? Esta ação não pode ser desfeita.',
      onConfirmar: async () => {
        try {
          await supabase
            .from('mesas')
            .update({
              status: 'livre',
              nome_cliente: null,
              ocupada_em: null,
              liberar_em: null,
              pedido_id: null,
              observacoes: null,
            })
            .eq('pedido_id', pedidoId)

          const { error } = await supabase.from('pedidos').delete().eq('id', pedidoId)
          if (error) throw error

          void carregarPedidos()
          setModalNotificacao({
            aberto: true,
            tipo: 'sucesso',
            titulo: 'Pedido Excluído',
            mensagem: 'O pedido foi excluído com sucesso.',
            onConfirmar: () => {},
          })
        } catch (error) {
          console.error('Erro ao excluir pedido:', error)
          setModalNotificacao({
            aberto: true,
            tipo: 'erro',
            titulo: 'Erro ao Excluir',
            mensagem: 'Não foi possível excluir o pedido. Tente novamente.',
            onConfirmar: () => {},
          })
        }
      },
    })
  }

  const enviarParaCrediario = async (pedido: Pedido) => {
    if (String(pedido.forma_pagamento || '').toLowerCase().includes('credi')) return

    try {
      const { error } = await supabase.rpc('enviar_pedido_crediario', {
        p_pedido_id: pedido.id,
      })

      if (error) throw error

      setPedidos((prev) => prev.map((item) => (
        item.id === pedido.id ? { ...item, forma_pagamento: 'Crediário' } : item
      )))
      setModalNotificacao({
        aberto: true,
        tipo: 'sucesso',
        titulo: 'Pedido enviado ao crediário',
        mensagem: `O pedido de ${pedido.nome_cliente} foi vinculado ao crediário.`,
        onConfirmar: () => {},
      })
    } catch (erro) {
      console.error('Erro ao enviar pedido para crediário:', erro)
      setModalNotificacao({
        aberto: true,
        tipo: 'erro',
        titulo: 'Erro no crediário',
        mensagem: 'Não foi possível enviar o pedido ao crediário.',
        onConfirmar: () => {},
      })
    }
  }

  const confirmarPagamento = async (pedido: Pedido) => {
    if (pedido.pagamento_online_status === 'pago') return

    try {
      const agoraIso = new Date().toISOString()
      const { error } = await supabase
        .from('pedidos')
        .update({
          pagamento_online_status: 'pago',
          pagamento_online_pago_em: agoraIso,
          updated_at: agoraIso,
        })
        .eq('id', pedido.id)

      if (error) throw error

      setPedidos((prev) =>
        prev.map((item) =>
          item.id === pedido.id
            ? { ...item, pagamento_online_status: 'pago' }
            : item,
        ),
      )

      setModalNotificacao({
        aberto: true,
        tipo: 'sucesso',
        titulo: 'Pagamento confirmado',
        mensagem: `O pagamento do pedido de ${pedido.nome_cliente} foi marcado como pago.`,
        onConfirmar: () => {},
      })
    } catch (erro) {
      console.error('Erro ao confirmar pagamento:', erro)
      setModalNotificacao({
        aberto: true,
        tipo: 'erro',
        titulo: 'Erro ao confirmar pagamento',
        mensagem: 'Não foi possível confirmar o pagamento. Tente novamente.',
        onConfirmar: () => {},
      })
    }
  }

  const executarAcaoPedido = async (
    pedidoId: string,
    acao: AcaoPedido,
    executar: () => Promise<void>,
  ) => {
    setAcoesPedido((atual) => ({
      ...atual,
      [pedidoId]: { ...atual[pedidoId], [acao]: true },
    }))

    try {
      await executar()
    } finally {
      setAcoesPedido((atual) => ({
        ...atual,
        [pedidoId]: { ...atual[pedidoId], [acao]: false },
      }))
    }
  }

  const concluirPedido = async (pedido: Pedido) => {
    if (pedidoEstaEncerrado(pedido.status)) return

    try {
      const agoraIso = new Date().toISOString()
      const { data: pedidoConcluido, error } = await supabase
        .from('pedidos')
        .update({
          status: 'entregue',
          updated_at: agoraIso,
        })
        .eq('id', pedido.id)
        .select('status, forma_pagamento')
        .single()

      if (error) throw error

      if (pedido.tipo_entrega === 'local' || pedido.mesa || pedido.comanda) {
        const { error: mesaError } = await supabase
          .from('mesas')
          .update({
            status: 'livre',
            nome_cliente: null,
            ocupada_em: null,
            liberar_em: null,
            pedido_id: null,
            observacoes: null,
            updated_at: agoraIso,
          })
          .eq('pedido_id', pedido.id)

        if (mesaError) throw mesaError
      }

      setPedidos((prev) =>
        prev.map((item) =>
          item.id === pedido.id
            ? {
                ...item,
                status: String(pedidoConcluido.status || 'entregue'),
                forma_pagamento: pedidoConcluido.forma_pagamento || undefined,
                crediario_status: null,
                crediario_saldo: 0,
                valor_em_crediario: 0,
              }
            : item,
        ),
      )

      setModalNotificacao({
        aberto: true,
        tipo: 'sucesso',
        titulo: 'Pedido concluído',
        mensagem: String(pedido.forma_pagamento || '').toLowerCase().includes('credi')
          ? `O pedido de ${pedido.nome_cliente} foi entregue e quitado no crediário.`
          : `O pedido de ${pedido.nome_cliente} foi marcado como entregue.`,
        onConfirmar: () => {},
      })
    } catch (erro) {
      console.error('Erro ao concluir pedido:', erro)
      setModalNotificacao({
        aberto: true,
        tipo: 'erro',
        titulo: 'Erro ao concluir pedido',
        mensagem: 'Não foi possível concluir o pedido. Tente novamente.',
        onConfirmar: () => {},
      })
    }
  }

  const restaurarPedidoParaMesa = async (pedido: Pedido) => {
    if (!pedido.mesa_id) {
      setModalNotificacao({
        aberto: true,
        tipo: 'erro',
        titulo: 'Mesa não encontrada',
        mensagem: 'Este pedido não possui vínculo com uma mesa.',
        onConfirmar: () => {},
      })
      return
    }

    if (!pedidoDentroDoDiaOperacional(pedido.created_at)) {
      setModalNotificacao({
        aberto: true,
        tipo: 'aviso',
        titulo: 'Pedido fora do dia',
        mensagem: 'Só é possível voltar para o salão pedidos do dia operacional atual.',
        onConfirmar: () => {},
      })
      return
    }

    try {
      const { data: mesa, error: erroMesa } = await supabase
        .from('mesas')
        .select('id, numero, tipo, status, pedido_id, tempo_limite_minutos')
        .eq('id', pedido.mesa_id)
        .single()

      if (erroMesa) throw erroMesa

      if (!mesa || mesa.tipo !== 'mesa') {
        throw new Error('Ponto vinculado não é uma mesa do salão.')
      }

      if (mesa.status === 'ocupada' && mesa.pedido_id && String(mesa.pedido_id) !== pedido.id) {
        setModalNotificacao({
          aberto: true,
          tipo: 'aviso',
          titulo: 'Mesa ocupada',
          mensagem: `A Mesa ${mesa.numero} já está vinculada a outro pedido.`,
          onConfirmar: () => {},
        })
        return
      }

      const agoraIso = new Date().toISOString()
      const tempoLimiteSalvo = Number(mesa.tempo_limite_minutos || pedido.mesa_tempo_limite_minutos || TEMPO_PADRAO_MESA_MINUTOS)
      const tempoLimite = Math.max(
        TEMPO_PADRAO_MESA_MINUTOS,
        Number.isFinite(tempoLimiteSalvo) ? tempoLimiteSalvo : TEMPO_PADRAO_MESA_MINUTOS,
      )
      const liberarEm = calcularLiberacaoMesa(
        new Date(),
        Math.max(TEMPO_AVISO_MESA_MINUTOS, tempoLimite),
      ).toISOString()

      const { error } = await supabase
        .from('mesas')
        .update({
          status: 'ocupada',
          nome_cliente: pedido.nome_cliente || null,
          ocupada_em: pedido.created_at || agoraIso,
          liberar_em: liberarEm,
          tempo_limite_minutos: tempoLimite,
          pedido_id: pedido.id,
          updated_at: agoraIso,
        })
        .eq('id', pedido.mesa_id)

      if (error) throw error

      setPedidos((prev) =>
        prev.map((item) =>
          item.id === pedido.id
            ? {
                ...item,
                mesa_status: 'ocupada',
                mesa_pedido_id: pedido.id,
                mesa_liberar_em: liberarEm,
              }
            : item,
        ),
      )

      setModalNotificacao({
        aberto: true,
        tipo: 'sucesso',
        titulo: 'Mesa restaurada',
        mensagem: `O pedido voltou para a Mesa ${mesa.numero}.`,
        onConfirmar: () => {},
      })
    } catch (erro) {
      console.error('Erro ao voltar pedido para mesa:', erro)
      setModalNotificacao({
        aberto: true,
        tipo: 'erro',
        titulo: 'Erro ao voltar para mesa',
        mensagem: 'Não foi possível recolocar o pedido no salão.',
        onConfirmar: () => {},
      })
    }
  }

  const toggleSelecaoPedido = (pedidoId: string) => {
    setIdsSelecionados((prev) => {
      const novo = new Set(prev)
      if (novo.has(pedidoId)) novo.delete(pedidoId)
      else novo.add(pedidoId)
      return novo
    })
  }

  const selecionarTodos = () => {
    const idsFiltrados = pedidosFiltrados.map((p) => p.id)
    const todosJaSelecionados = idsFiltrados.every((id) => idsSelecionados.has(id))
    setIdsSelecionados(todosJaSelecionados ? new Set() : new Set(idsFiltrados))
  }

  const cancelarSelecao = () => {
    setModoSelecao(false)
    setIdsSelecionados(new Set())
  }

  const handleExcluirSelecionados = () => {
    if (idsSelecionados.size === 0) return
    setModalNotificacao({
      aberto: true,
      tipo: 'confirmacao',
      titulo: 'Excluir Pedidos Selecionados',
      mensagem: `Tem certeza que deseja excluir ${idsSelecionados.size} pedido${idsSelecionados.size > 1 ? 's' : ''}? Esta ação não pode ser desfeita.`,
      onConfirmar: async () => {
        setExcluindoEmMassa(true)
        try {
          const ids = Array.from(idsSelecionados)

          await supabase
            .from('mesas')
            .update({
              status: 'livre',
              nome_cliente: null,
              ocupada_em: null,
              liberar_em: null,
              pedido_id: null,
              observacoes: null,
            })
            .in('pedido_id', ids)

          const { error } = await supabase.from('pedidos').delete().in('id', ids)
          if (error) throw error

          cancelarSelecao()
          void carregarPedidos()
          setModalNotificacao({
            aberto: true,
            tipo: 'sucesso',
            titulo: 'Pedidos Excluídos',
            mensagem: `${ids.length} pedido${ids.length > 1 ? 's foram excluídos' : ' foi excluído'} com sucesso.`,
            onConfirmar: () => {},
          })
        } catch (error) {
          console.error('Erro ao excluir pedidos em massa:', error)
          setModalNotificacao({
            aberto: true,
            tipo: 'erro',
            titulo: 'Erro ao Excluir',
            mensagem: 'Não foi possível excluir os pedidos. Tente novamente.',
            onConfirmar: () => {},
          })
        } finally {
          setExcluindoEmMassa(false)
        }
      },
    })
  }

  const enviarParaImpressao = async (pedidoId: string, tipo: 'cozinha' | 'cliente') => {
    try {
      const hashEvento = gerarHashEventoImpressao(pedidoId, tipo, 'pedido_completo', null, 'admin_pedidos_lista')
      const resultado = await enfileirarImpressao({
        pedidoId,
        tipo,
        escopo: 'pedido_completo',
        origem: 'admin_pedidos_lista',
        hashEvento,
        automatico: false,
      })

      if (resultado.duplicado) {
        setModalNotificacao({
          aberto: true,
          tipo: 'aviso',
          titulo: 'Já na Fila',
          mensagem: `Este pedido já está na fila de impressão (${tipo}).`,
          onConfirmar: () => {},
        })
        return
      }
      if (!resultado.sucesso) throw new Error(resultado.erro || 'Falha ao enfileirar impressão.')

      setModalNotificacao({
        aberto: true,
        tipo: 'sucesso',
        titulo: 'Enviado para Impressão',
        mensagem: `Pedido enviado para impressão (${tipo}).`,
        onConfirmar: () => {},
      })
    } catch (error) {
      console.error('Erro ao enviar para impressão:', error)
      setModalNotificacao({
        aberto: true,
        tipo: 'erro',
        titulo: 'Erro',
        mensagem: 'Não foi possível enviar para impressão.',
        onConfirmar: () => {},
      })
    }
  }

  const pedidosFiltrados = pedidos

  const todosVisivelSelecionados =
    pedidosFiltrados.length > 0 && pedidosFiltrados.every((p) => idsSelecionados.has(p.id))

  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="space-y-4 sm:space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            <div className="min-w-0">
              <h2 className="text-xl sm:text-2xl font-semibold text-foreground truncate">
                Gerenciar Pedidos
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {totalPedidos} pedido{totalPedidos === 1 ? '' : 's'} encontrado{totalPedidos === 1 ? '' : 's'}
              </p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              {!modoSelecao ? (
                <button
                  onClick={() => setModoSelecao(true)}
                  className="flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 text-sm font-medium text-foreground border border-border/70 bg-card rounded-lg hover:bg-accent transition-colors"
                >
                  <CheckSquare strokeWidth={1.6} className="w-4 h-4" />
                  <span className="hidden sm:inline">Selecionar</span>
                </button>
              ) : (
                <button
                  onClick={cancelarSelecao}
                  className="flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 text-sm font-medium text-foreground border border-border/70 bg-card rounded-lg hover:bg-accent transition-colors"
                >
                  <X strokeWidth={1.6} className="w-4 h-4" />
                  <span className="hidden sm:inline">Cancelar</span>
                </button>
              )}
              <button
                onClick={() => void carregarPedidos()}
                disabled={loading}
                className="flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 text-sm font-medium text-foreground border border-border/70 bg-card rounded-lg hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw strokeWidth={1.6} className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Atualizar</span>
              </button>
              <button
                onClick={() => router.push('/admin/pedidos/novo')}
                className="flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2 text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 rounded-lg transition-colors"
              >
                <Plus strokeWidth={1.6} className="w-4 h-4" />
                <span className="hidden xs:inline">Novo</span>
                <span className="hidden sm:inline"> Pedido</span>
              </button>
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-border/70 bg-card p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative min-w-0 flex-1 sm:max-w-[280px]">
                <Search strokeWidth={1.6} className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Buscar por nome, telefone ou ID..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="h-9 rounded-lg border-border/70 bg-background pl-9 pr-9 shadow-none"
                  aria-label="Buscar pedidos"
                />
                {busca ? (
                  <button
                    type="button"
                    onClick={() => setBusca('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label="Limpar busca"
                  >
                    <X strokeWidth={1.6} className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
              <FiltroPedidosAdmin
                hasFilter={
                  filtroStatus !== 'todos' ||
                  filtroTipo !== 'todos' ||
                  filtroSituacao !== 'todos' ||
                  filtroPagamento !== 'todos' ||
                  filtroGarcom !== 'todos' ||
                  filtroCanalSalao !== 'todos' ||
                  periodo !== 'todos'
                }
                onLimpar={handleLimparFiltros}
                valor={{
                  status: filtroStatus,
                  tipo: filtroTipo,
                  situacao: filtroSituacao,
                  pagamento: filtroPagamento,
                  garcom: filtroGarcom,
                  canalSalao: filtroCanalSalao,
                  periodo,
                  dataInicio: datasPeriodo.dataInicio,
                  dataFim: datasPeriodo.dataFim,
                }}
                onChange={(proximo) => {
                  if (proximo.periodo && proximo.periodo !== 'personalizado') {
                    setPeriodo(proximo.periodo)
                    setDatasPeriodo(obterDatasPeriodoEntrega(proximo.periodo))
                    setPaginaAtual(1)
                  } else if (proximo.periodo === 'personalizado') {
                    setPeriodo('personalizado')
                    setDatasPeriodo((atual) => ({
                      dataInicio: proximo.dataInicio ?? atual.dataInicio,
                      dataFim: proximo.dataFim ?? atual.dataFim,
                    }))
                    setPaginaAtual(1)
                  } else if (proximo.dataInicio !== undefined || proximo.dataFim !== undefined) {
                    setPeriodo('personalizado')
                    setDatasPeriodo((atual) => ({
                      dataInicio: proximo.dataInicio ?? atual.dataInicio,
                      dataFim: proximo.dataFim ?? atual.dataFim,
                    }))
                    setPaginaAtual(1)
                  }
                  if (proximo.status !== undefined) {
                    setFiltroStatus(proximo.status)
                    setPaginaAtual(1)
                  }
                  if (proximo.tipo !== undefined) {
                    setFiltroTipo(proximo.tipo)
                    setPaginaAtual(1)
                  }
                  if (proximo.situacao !== undefined) {
                    setFiltroSituacao(proximo.situacao)
                    setPaginaAtual(1)
                  }
                  if (proximo.pagamento !== undefined) {
                    setFiltroPagamento(proximo.pagamento)
                    setPaginaAtual(1)
                  }
                  if (proximo.garcom !== undefined) {
                    setFiltroGarcom(proximo.garcom)
                    setPaginaAtual(1)
                  }
                  if (proximo.canalSalao !== undefined) {
                    setFiltroCanalSalao(proximo.canalSalao)
                    setPaginaAtual(1)
                  }
                }}
              />
            </div>

            <FiltrosAtivosChips chips={chipsFiltroAtivo} onLimpar={handleLimparFiltros} />

            {modoSelecao && pedidosFiltrados.length > 0 && (
              <div className="flex items-center gap-3 border-t border-border/70 pt-3">
                <button
                  onClick={selecionarTodos}
                  className="flex items-center gap-2 text-sm font-medium text-foreground transition-colors hover:text-muted-foreground"
                >
                  {todosVisivelSelecionados ? (
                    <CheckSquare strokeWidth={1.6} className="h-4 w-4" />
                  ) : (
                    <Square strokeWidth={1.6} className="h-4 w-4" />
                  )}
                  {todosVisivelSelecionados
                    ? 'Desmarcar todos'
                    : `Selecionar todos (${pedidosFiltrados.length})`}
                </button>
                {idsSelecionados.size > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {idsSelecionados.size} selecionado{idsSelecionados.size > 1 ? 's' : ''}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Conteúdo */}
          {loading && pedidosFiltrados.length === 0 ? (
            <GradeSkeleton quantidade={6} />
          ) : pedidosFiltrados.length === 0 ? (
            <ListaVazia
              icone={<Package className="h-6 w-6" strokeWidth={1.6} />}
              titulo="Nenhum pedido encontrado"
              descricao="Tente ajustar os filtros ou criar um novo pedido"
              acao={
                <Button onClick={() => router.push('/admin/pedidos/novo')} className="mt-2 gap-1.5">
                  <Plus className="h-4 w-4" strokeWidth={1.6} />
                  Novo pedido
                </Button>
              }
            />
          ) : (
            <>
              <div
                aria-busy={loading}
                className={cn(
                  'grid items-stretch gap-3 transition-opacity md:grid-cols-2 lg:grid-cols-3',
                  loading && 'pointer-events-none opacity-60',
                )}
              >
                {pedidosFiltrados.map((pedido, idx) => (
                  <CardPedido
                    key={pedido.id}
                    pedido={pedido}
                    index={idx}
                    modoSelecao={modoSelecao}
                    estaSelecionado={idsSelecionados.has(pedido.id)}
                    onToggleSelecao={toggleSelecaoPedido}
                    onVerDetalhes={(p) => {
                      setPedidoDetalhesId(p.id)
                      setModalDetalhesAberto(true)
                    }}
                    onEditar={(p) => {
                      setPedidoSelecionado(p)
                      setModalEditarAberto(true)
                    }}
                    onConfirmarPagamento={(p) =>
                      void executarAcaoPedido(p.id, 'pagamento', () => confirmarPagamento(p))
                    }
                    onConcluirPedido={(p) =>
                      void executarAcaoPedido(p.id, 'concluir', () => concluirPedido(p))
                    }
                    onImprimirCozinha={(p) =>
                      void executarAcaoPedido(p.id, 'impressao', () => enviarParaImpressao(p.id, 'cozinha'))
                    }
                    onGerarPDF={(p) => handleGerarPDF(p.id)}
                    onExcluir={(p) => handleExcluirPedido(p.id)}
                    onEnviarCrediario={(p) => enviarParaCrediario(p)}
                    onRestaurarMesa={(p) =>
                      void executarAcaoPedido(p.id, 'restaurarMesa', () => restaurarPedidoParaMesa(p))
                    }
                    acoesEmAndamento={acoesPedido[pedido.id]}
                  />
                ))}
              </div>

              <PaginacaoPedidos
                paginaAtual={paginaAtual}
                totalPaginas={totalPaginas}
                itensPorPagina={itensPorPagina}
                totalItens={totalPedidos}
                carregando={loading}
                onPaginaChange={(pagina) => {
                  setIdsSelecionados(new Set())
                  setPaginaAtual(pagina)
                }}
                onItensPorPaginaChange={(quantidade) => {
                  setIdsSelecionados(new Set())
                  setItensPorPagina(quantidade)
                  setPaginaAtual(1)
                }}
              />
            </>
          )}

          {/* Barra flutuante seleção em massa */}
          <AnimatePresence>
            {modoSelecao && idsSelecionados.size > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 80 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 80 }}
                className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-xl border border-border/70 bg-card px-5 py-3 shadow-lg"
              >
                <span className="text-sm font-medium text-foreground">
                  {idsSelecionados.size} selecionado{idsSelecionados.size > 1 ? 's' : ''}
                </span>
                <div className="h-4 w-px bg-border/70" />
                <button
                  onClick={handleExcluirSelecionados}
                  disabled={excluindoEmMassa}
                  className="flex items-center gap-1.5 rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50"
                >
                  {excluindoEmMassa ? (
                    <Loader2 strokeWidth={1.6} className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 strokeWidth={1.6} className="w-4 h-4" />
                  )}
                  Excluir
                </button>
                <button
                  onClick={cancelarSelecao}
                  className="flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                >
                  <X strokeWidth={1.6} className="w-4 h-4" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <ModalEditarPedido
          pedido={pedidoSelecionado}
          aberto={modalEditarAberto}
          onFechar={() => {
            setModalEditarAberto(false)
            setPedidoSelecionado(null)
          }}
          onSucesso={() => void carregarPedidos()}
        />

        <ModalDetalhesPedido
          pedidoId={pedidoDetalhesId}
          aberto={modalDetalhesAberto}
          onFechar={() => {
            setModalDetalhesAberto(false)
            setPedidoDetalhesId(null)
          }}
          onEditar={(pedido) => {
            setPedidoSelecionado(pedido)
            setModalEditarAberto(true)
          }}
          onGerarPDF={(pedido) => handleGerarPDF(pedido.id)}
        />

        <ModalNotificacao
          aberto={modalNotificacao.aberto}
          tipo={modalNotificacao.tipo}
          titulo={modalNotificacao.titulo}
          mensagem={modalNotificacao.mensagem}
          onFechar={() => setModalNotificacao({ ...modalNotificacao, aberto: false })}
          onConfirmar={modalNotificacao.onConfirmar}
          textoBotaoConfirmar="Excluir"
          textoBotaoCancelar="Cancelar"
        />
      </AdminLayout>
    </ProtectedRoute>
  )
}
