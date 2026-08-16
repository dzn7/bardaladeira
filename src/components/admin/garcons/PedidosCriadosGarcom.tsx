'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AvatarUsuario } from '@/components/admin/AvatarUsuario'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  ArrowLeft,
  Bike,
  Edit2,
  Eye,
  FileText,
  Loader2,
  Printer,
  RefreshCw,
  Search,
  ShoppingBag,
  Trash2,
  UserRound,
  Wallet,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MenuAcoes, type MenuAcaoItem } from '@/components/ui/menu-acoes'
import { ListaVazia, TabelaSkeleton } from '@/components/admin/filtros/ListaEstado'
import { FiltrosAtivosChips, type ChipFiltroAtivo } from '@/components/admin/filtros/FiltrosAtivosChips'
import {
  FiltroPedidosGarcom,
  type FiltroPagamentoGarcom,
  type FiltroSituacaoGarcom,
} from '@/components/admin/garcons/FiltroPedidosGarcom'
import {
  criarIntervaloEntregas,
  obterDatasPeriodoEntrega,
} from '@/features/entregas/lib/intervalo-entregas'
import type { PeriodoEntrega } from '@/features/entregas/types'
import PaginacaoPedidos from '@/features/pedidos/components/PaginacaoPedidos'
import type { Pedido } from '@/components/admin/CardPedido'
import ModalEditarPedido from '@/components/admin/ModalEditarPedido'
import ModalDetalhesPedido from '@/components/admin/ModalDetalhesPedido'
import ModalNotificacao from '@/components/ModalNotificacao'
import { gerarPDFPedido } from '@/lib/pdf-generator'
import { obterDataInicioAnoAtual } from '@/lib/filtros-ano'
import { enfileirarImpressao, gerarHashEventoImpressao } from '@/lib/filaImpressao'
import {
  carregarCrediarioPorPedido,
  normalizarStatusPedido,
  pedidoEstaEmCrediarioAberto,
  pedidoEstaEncerrado,
  pedidoTemPagamentoPendente,
} from '@/lib/pedidos-utils'
import { obterIntervaloDiaOperacionalAtual } from '@/lib/dia-operacional'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import {
  TEMPO_AVISO_MESA_MINUTOS,
  TEMPO_PADRAO_MESA_MINUTOS,
  calcularLiberacaoMesa,
} from '@/lib/mesas-tempo'

const PEDIDOS_POR_PAGINA_PADRAO = 15

type AcaoPedido = 'pagamento' | 'impressao' | 'concluir' | 'restaurarMesa'
type AcoesPedido = Partial<Record<AcaoPedido, boolean>>
type FiltroSituacao = FiltroSituacaoGarcom
type FiltroPagamento = FiltroPagamentoGarcom

type GarcomDetalhe = {
  id: string
  nome: string
  nome_usuario: string
  avatar_url: string | null
  cor_avatar: string | null
  ativo: boolean
}

type PedidoMesaDados = {
  identificador?: string | null
  tipo?: string | null
  status?: string | null
  pedido_id?: string | null
  liberar_em?: string | null
  tempo_limite_minutos?: number | null
} | null

type PedidoBanco = {
  id: string
  nome_cliente: string | null
  telefone: string | null
  endereco: string | null
  bairro: string | null
  tipo_entrega: string | null
  status: string | null
  subtotal: number | null
  taxa_entrega: number | null
  taxa_servico: number | null
  total: number | null
  created_at: string
  mesa: number | null
  comanda: number | null
  mesa_id: string | null
  forma_pagamento: string | null
  pagamento_online: boolean | null
  pagamento_online_status: string | null
  garcom_id: string | null
  mesa_dados?: PedidoMesaDados
}

type ModalNotificacaoState = {
  aberto: boolean
  tipo: 'sucesso' | 'erro' | 'aviso' | 'info' | 'confirmacao'
  titulo: string
  mensagem: string
  onConfirmar: () => void
}

type PedidosCriadosGarcomProps = {
  garcomId: string
}

const STATUS_LABEL: Record<string, string> = {
  pendente: 'Pendente',
  confirmado: 'Confirmado',
  preparando: 'Preparando',
  pronto: 'Pronto',
  saiu_para_entrega: 'Em entrega',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
}

const TIPOS_LABEL: Record<string, string> = {
  local: 'Salão',
  entrega: 'Entrega',
  retirada: 'Retirada',
}

const LABEL_PERIODO: Record<Exclude<PeriodoEntrega, 'personalizado'>, string> = {
  todos: 'Todos',
  hoje: 'Hoje',
  '7dias': '7 dias',
  '30dias': '30 dias',
  semana: 'Semana',
  mes: 'Mês',
}

const moeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const criarModalInicial = (): ModalNotificacaoState => ({
  aberto: false,
  tipo: 'info',
  titulo: '',
  mensagem: '',
  onConfirmar: () => {},
})

const rotuloStatus = (status: string) => {
  return STATUS_LABEL[normalizarStatusPedido(status)] || status
}

const rotuloTipo = (tipo: string) => {
  return TIPOS_LABEL[String(tipo || '').toLowerCase()] || tipo
}

const classeStatus = (status: string) => {
  const s = normalizarStatusPedido(status)
  if (s === 'entregue') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300'
  }
  if (s === 'cancelado') {
    return 'border-border/70 bg-muted/40 text-muted-foreground'
  }
  if (s === 'pendente' || s === 'confirmado') {
    return 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/40 dark:text-amber-200'
  }
  return 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-800/60 dark:bg-sky-950/40 dark:text-sky-200'
}

const pontoSalao = (pedido: Pedido) => {
  if (pedido.mesa_identificador) return pedido.mesa_identificador
  if (pedido.mesa) return `Mesa ${pedido.mesa}`
  if (pedido.comanda) return `Comanda ${pedido.comanda}`
  return '—'
}

const rotuloPagamento = (pedido: Pedido) => {
  if (pedidoEstaEmCrediarioAberto(pedido)) return 'Fiado'
  if (String(pedido.forma_pagamento || '').toLowerCase().includes('credi')) return 'Concluído'
  if (pedidoTemPagamentoPendente(pedido)) return 'PIX pendente'
  if (pedido.pagamento_online && normalizarStatusPedido(pedido.pagamento_online_status) === 'pago') {
    return 'PIX pago'
  }
  return pedido.forma_pagamento || '—'
}

const iconeTipo = (tipo: string) => {
  const t = String(tipo || '').toLowerCase()
  if (t === 'entrega') return Bike
  if (t === 'retirada') return ShoppingBag
  return UserRound
}

const classeBordaTipo = (tipo: string) => {
  const t = String(tipo || '').toLowerCase()
  if (t === 'entrega') return 'bg-sky-500'
  if (t === 'retirada') return 'bg-amber-500'
  return 'bg-emerald-500'
}

export default function PedidosCriadosGarcom({ garcomId }: PedidosCriadosGarcomProps) {
  const router = useRouter()
  const [garcom, setGarcom] = useState<GarcomDetalhe | null>(null)
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [loading, setLoading] = useState(true)
  const [totalPedidos, setTotalPedidos] = useState(0)
  const [totalAbertos, setTotalAbertos] = useState(0)
  const [valorTotalPeriodo, setValorTotalPeriodo] = useState(0)
  const [paginaAtual, setPaginaAtual] = useState(1)
  const [itensPorPagina, setItensPorPagina] = useState(PEDIDOS_POR_PAGINA_PADRAO)
  const [busca, setBusca] = useState('')
  const [buscaAplicada, setBuscaAplicada] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('todos')
  const [filtroTipo, setFiltroTipo] = useState('todos')
  const [filtroSituacao, setFiltroSituacao] = useState<FiltroSituacao>('todos')
  const [filtroPagamento, setFiltroPagamento] = useState<FiltroPagamento>('todos')
  const [periodo, setPeriodo] = useState<PeriodoEntrega>('hoje')
  const [datasPeriodo, setDatasPeriodo] = useState(() => obterDatasPeriodoEntrega('hoje'))
  const [pedidoSelecionado, setPedidoSelecionado] = useState<Pedido | null>(null)
  const [modalEditarAberto, setModalEditarAberto] = useState(false)
  const [modalDetalhesAberto, setModalDetalhesAberto] = useState(false)
  const [pedidoDetalhesId, setPedidoDetalhesId] = useState<string | null>(null)
  const [acoesPedido, setAcoesPedido] = useState<Record<string, AcoesPedido>>({})
  const [modalNotificacao, setModalNotificacao] = useState<ModalNotificacaoState>(criarModalInicial)

  const intervalo = useMemo(() => {
    if (periodo === 'todos') return null
    if (periodo === 'hoje') {
      const { inicio, fim } = obterIntervaloDiaOperacionalAtual()
      return {
        dataInicio: datasPeriodo.dataInicio,
        dataFim: datasPeriodo.dataFim,
        inicioIso: inicio.toISOString(),
        fimExclusivoIso: fim.toISOString(),
      }
    }
    return criarIntervaloEntregas(datasPeriodo.dataInicio, datasPeriodo.dataFim)
  }, [periodo, datasPeriodo.dataInicio, datasPeriodo.dataFim])

  const carregarGarcom = useCallback(async () => {
    const { data, error } = await supabase
      .from('usuarios_sistema')
      .select('id, nome, nome_usuario, avatar_url, cor_avatar, ativo')
      .eq('id', garcomId)
      .eq('papel', 'garcom')
      .single()

    if (error) throw error

    setGarcom({
      id: String(data.id),
      nome: String(data.nome || 'Garçom'),
      nome_usuario: String(data.nome_usuario || ''),
      avatar_url: data.avatar_url ? String(data.avatar_url) : null,
      cor_avatar: data.cor_avatar ? String(data.cor_avatar) : null,
      ativo: Boolean(data.ativo),
    })
  }, [garcomId])

  const mapearPedidos = useCallback(
    async (lista: PedidoBanco[]): Promise<Pedido[]> => {
      const idsPedidos = lista.map((pedido) => String(pedido.id))
      const crediarioPorPedido = await carregarCrediarioPorPedido(idsPedidos)

      return lista.map((pedido): Pedido => {
        const crediario = crediarioPorPedido.get(String(pedido.id))
        const mesaDados = pedido.mesa_dados

        return {
          id: String(pedido.id),
          nome_cliente: String(pedido.nome_cliente || 'Cliente'),
          telefone: pedido.telefone || '',
          endereco: pedido.endereco || undefined,
          bairro: pedido.bairro || undefined,
          tipo_entrega: String(pedido.tipo_entrega || 'retirada'),
          status: String(pedido.status || 'pendente'),
          subtotal: Number(pedido.subtotal || 0),
          taxa_entrega: Number(pedido.taxa_entrega || 0),
          taxa_servico: Number(pedido.taxa_servico || 0),
          total: Number(pedido.total || 0),
          created_at: pedido.created_at,
          mesa: pedido.mesa === null || pedido.mesa === undefined ? null : Number(pedido.mesa),
          comanda: pedido.comanda === null || pedido.comanda === undefined ? null : Number(pedido.comanda),
          mesa_id: pedido.mesa_id || null,
          mesa_identificador: mesaDados?.identificador ?? null,
          mesa_tipo: mesaDados?.tipo ?? null,
          mesa_status: mesaDados?.status ?? null,
          mesa_pedido_id: mesaDados?.pedido_id ? String(mesaDados.pedido_id) : null,
          mesa_liberar_em: mesaDados?.liberar_em ?? null,
          mesa_tempo_limite_minutos:
            mesaDados?.tempo_limite_minutos === null || mesaDados?.tempo_limite_minutos === undefined
              ? null
              : Number(mesaDados.tempo_limite_minutos),
          forma_pagamento: pedido.forma_pagamento || undefined,
          pagamento_online: Boolean(pedido.pagamento_online),
          pagamento_online_status: pedido.pagamento_online_status || undefined,
          garcom_id: pedido.garcom_id || null,
          nome_garcom: garcom?.nome || null,
          itens: [],
          crediario_status: crediario?.status ?? null,
          crediario_saldo: crediario?.saldo_atual ?? null,
          valor_pago_parcial: 0,
          valor_em_crediario: 0,
          itens_pagos_count: 0,
        }
      })
    },
    [garcom?.nome],
  )

  const carregarPedidos = useCallback(
    async (opcoes?: { silencioso?: boolean }) => {
      const silencioso = Boolean(opcoes?.silencioso)
      if (!silencioso) setLoading(true)

      try {
        const offset = (paginaAtual - 1) * itensPorPagina
        const inicioIso = intervalo
          ? new Date(
              Math.max(
                new Date(intervalo.inicioIso).getTime(),
                new Date(obterDataInicioAnoAtual()).getTime(),
              ),
            ).toISOString()
          : null

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const aplicarFiltros = (query: any) => {
          let q = query.eq('garcom_id', garcomId)

          if (inicioIso && intervalo) {
            q = q.gte('created_at', inicioIso).lt('created_at', intervalo.fimExclusivoIso)
          }

          if (filtroStatus !== 'todos') {
            q = q.eq('status', filtroStatus)
          }

          if (filtroTipo !== 'todos') {
            q = q.eq('tipo_entrega', filtroTipo)
          }

          if (filtroSituacao === 'abertos') {
            q = q.not('status', 'in', '("entregue","cancelado")')
          }

          if (filtroSituacao === 'encerrados') {
            q = q.in('status', ['entregue', 'cancelado'])
          }

          if (filtroPagamento === 'pix_pendente') {
            q = q
              .eq('pagamento_online', true)
              .not('pagamento_online_status', 'in', '("pago","aprovado","approved")')
          }

          if (filtroPagamento === 'fiado') {
            q = q.ilike('forma_pagamento', '%credi%')
          }

          if (buscaAplicada) {
            const termoSeguro = buscaAplicada.replace(/[,%()]/g, ' ').trim()
            const telefone = buscaAplicada.replace(/\D/g, '')
            const filtrosBusca = [`nome_cliente.ilike.%${termoSeguro}%`]

            if (telefone) {
              filtrosBusca.push(`telefone.ilike.%${telefone}%`)
            }

            if (
              /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
                buscaAplicada,
              )
            ) {
              filtrosBusca.push(`id.eq.${buscaAplicada}`)
            }

            q = q.or(filtrosBusca.join(','))
          }

          return q
        }

        let query = aplicarFiltros(
          supabase.from('pedidos').select(
            'id, nome_cliente, telefone, endereco, bairro, tipo_entrega, status, subtotal, taxa_entrega, taxa_servico, total, created_at, mesa, comanda, mesa_id, forma_pagamento, pagamento_online, pagamento_online_status, garcom_id, mesa_dados:mesas!pedidos_mesa_id_fkey(identificador, tipo, status, pedido_id, liberar_em, tempo_limite_minutos)',
            { count: 'exact' },
          ),
        )

        const queryValor = aplicarFiltros(supabase.from('pedidos').select('total, status'))

        const [{ data, error, count }, { data: totaisData, error: erroTotais }] = await Promise.all([
          query
            .order('created_at', { ascending: false })
            .order('id', { ascending: false })
            .range(offset, offset + itensPorPagina - 1),
          queryValor,
        ])

        if (error) throw error
        if (erroTotais) throw erroTotais

        setTotalPedidos(count || 0)
        setPedidos(await mapearPedidos((data || []) as PedidoBanco[]))
        setValorTotalPeriodo(
          (totaisData || []).reduce((soma: number, item: { total: number | null; status: string | null }) => {
            const status = String(item.status || '').toLowerCase()
            if (status === 'cancelado' || status === 'aguardando_pagamento') return soma
            return soma + Number(item.total || 0)
          }, 0),
        )

        let queryAbertos = supabase
          .from('pedidos')
          .select('id', { count: 'exact', head: true })
          .eq('garcom_id', garcomId)
          .not('status', 'in', '("entregue","cancelado")')

        if (inicioIso && intervalo) {
          queryAbertos = queryAbertos
            .gte('created_at', inicioIso)
            .lt('created_at', intervalo.fimExclusivoIso)
        }

        const { count: countAbertos, error: erroAbertos } = await queryAbertos

        if (erroAbertos) throw erroAbertos
        setTotalAbertos(countAbertos || 0)
      } catch (erro) {
        console.error('[GarconsPedidos] Erro ao carregar pedidos:', erro)
        toast.error('Não foi possível carregar os pedidos do garçom')
        setPedidos([])
        setTotalPedidos(0)
        setTotalAbertos(0)
        setValorTotalPeriodo(0)
      } finally {
        if (!silencioso) setLoading(false)
      }
    },
    [
      buscaAplicada,
      filtroPagamento,
      filtroSituacao,
      filtroStatus,
      filtroTipo,
      garcomId,
      intervalo,
      itensPorPagina,
      mapearPedidos,
      paginaAtual,
    ],
  )

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setBuscaAplicada(busca.trim())
      setPaginaAtual(1)
    }, 350)
    return () => window.clearTimeout(timer)
  }, [busca])

  useEffect(() => {
    async function iniciar() {
      try {
        setLoading(true)
        await carregarGarcom()
      } catch (erro) {
        console.error('[GarconsPedidos] Erro ao carregar garçom:', erro)
        toast.error('Não foi possível carregar o garçom')
        setLoading(false)
      }
    }
    void iniciar()
  }, [carregarGarcom])

  useEffect(() => {
    void carregarPedidos()
  }, [carregarPedidos])

  useEffect(() => {
    const totalPaginas = Math.max(1, Math.ceil(totalPedidos / itensPorPagina))
    if (paginaAtual > totalPaginas) setPaginaAtual(totalPaginas)
  }, [paginaAtual, totalPedidos, itensPorPagina])

  const recarregar = (silencioso = true) => void carregarPedidos({ silencioso })

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
        itens: (itens || []).map((item) => ({
          nome_item: item.nome_item || 'Produto',
          quantidade: item.quantidade,
          preco_unitario: item.preco_unitario,
          subtotal: item.subtotal,
          adicionais: item.adicionais,
          observacoes: item.observacoes,
        })),
      })
    } catch (erro) {
      console.error('[GarconsPedidos] Erro ao gerar PDF:', erro)
      toast.error('Não foi possível gerar o PDF')
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
      recarregar(true)
      setModalNotificacao({
        aberto: true,
        tipo: 'sucesso',
        titulo: 'Pagamento confirmado',
        mensagem: `O pagamento do pedido de ${pedido.nome_cliente} foi marcado como pago.`,
        onConfirmar: () => {},
      })
    } catch (erro) {
      console.error('[GarconsPedidos] Erro ao confirmar pagamento:', erro)
      setModalNotificacao({
        aberto: true,
        tipo: 'erro',
        titulo: 'Erro ao confirmar pagamento',
        mensagem: 'Não foi possível confirmar o pagamento.',
        onConfirmar: () => {},
      })
    }
  }

  const concluirPedido = async (pedido: Pedido) => {
    if (pedidoEstaEncerrado(pedido.status)) return

    try {
      const agoraIso = new Date().toISOString()
      const { error } = await supabase
        .from('pedidos')
        .update({
          status: 'entregue',
          updated_at: agoraIso,
        })
        .eq('id', pedido.id)

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

      recarregar(true)
      setModalNotificacao({
        aberto: true,
        tipo: 'sucesso',
        titulo: 'Pedido concluído',
        mensagem: `O pedido de ${pedido.nome_cliente} foi marcado como entregue.`,
        onConfirmar: () => {},
      })
    } catch (erro) {
      console.error('[GarconsPedidos] Erro ao concluir pedido:', erro)
      setModalNotificacao({
        aberto: true,
        tipo: 'erro',
        titulo: 'Erro ao concluir pedido',
        mensagem: 'Não foi possível concluir o pedido.',
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

    const { inicio, fim } = obterIntervaloDiaOperacionalAtual()
    const criado = new Date(pedido.created_at)
    if (criado < inicio || criado >= fim) {
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

      if (!mesa || mesa.tipo !== 'mesa') throw new Error('Ponto vinculado não é uma mesa do salão.')

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
      const tempoLimiteSalvo = Number(
        mesa.tempo_limite_minutos || pedido.mesa_tempo_limite_minutos || TEMPO_PADRAO_MESA_MINUTOS,
      )
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

      recarregar(true)
      setModalNotificacao({
        aberto: true,
        tipo: 'sucesso',
        titulo: 'Mesa restaurada',
        mensagem: `O pedido voltou para a Mesa ${mesa.numero}.`,
        onConfirmar: () => {},
      })
    } catch (erro) {
      console.error('[GarconsPedidos] Erro ao voltar pedido para mesa:', erro)
      setModalNotificacao({
        aberto: true,
        tipo: 'erro',
        titulo: 'Erro ao voltar para mesa',
        mensagem: 'Não foi possível recolocar o pedido no salão.',
        onConfirmar: () => {},
      })
    }
  }

  const enviarParaCrediario = async (pedido: Pedido) => {
    if (String(pedido.forma_pagamento || '').toLowerCase().includes('credi')) return

    try {
      const { error } = await supabase.rpc('enviar_pedido_crediario', {
        p_pedido_id: pedido.id,
      })

      if (error) throw error
      recarregar(true)
      setModalNotificacao({
        aberto: true,
        tipo: 'sucesso',
        titulo: 'Pedido enviado ao crediário',
        mensagem: `O pedido de ${pedido.nome_cliente} foi vinculado ao crediário.`,
        onConfirmar: () => {},
      })
    } catch (erro) {
      console.error('[GarconsPedidos] Erro ao enviar pedido para crediário:', erro)
      setModalNotificacao({
        aberto: true,
        tipo: 'erro',
        titulo: 'Erro no crediário',
        mensagem: 'Não foi possível enviar o pedido ao crediário.',
        onConfirmar: () => {},
      })
    }
  }

  const enviarParaImpressao = async (pedidoId: string, tipo: 'cozinha' | 'cliente') => {
    try {
      const hashEvento = gerarHashEventoImpressao(
        pedidoId,
        tipo,
        'pedido_completo',
        null,
        'admin_garcons_pedidos',
      )
      const resultado = await enfileirarImpressao({
        pedidoId,
        tipo,
        escopo: 'pedido_completo',
        origem: 'admin_garcons_pedidos',
        hashEvento,
        automatico: false,
      })

      if (resultado.duplicado) {
        setModalNotificacao({
          aberto: true,
          tipo: 'aviso',
          titulo: 'Já está na fila',
          mensagem: `Este pedido já está na fila de impressão (${tipo}).`,
          onConfirmar: () => {},
        })
        return
      }

      if (!resultado.sucesso) throw new Error(resultado.erro || 'Falha ao enfileirar impressão.')

      setModalNotificacao({
        aberto: true,
        tipo: 'sucesso',
        titulo: 'Enviado para impressão',
        mensagem: `Pedido enviado para impressão (${tipo}).`,
        onConfirmar: () => {},
      })
    } catch (erro) {
      console.error('[GarconsPedidos] Erro ao enviar para impressão:', erro)
      setModalNotificacao({
        aberto: true,
        tipo: 'erro',
        titulo: 'Erro na impressão',
        mensagem: 'Não foi possível enviar para impressão.',
        onConfirmar: () => {},
      })
    }
  }

  const handleExcluirPedido = (pedidoId: string) => {
    setModalNotificacao({
      aberto: true,
      tipo: 'confirmacao',
      titulo: 'Excluir pedido',
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

          recarregar(true)
          toast.success('Pedido excluído')
        } catch (erro) {
          console.error('[GarconsPedidos] Erro ao excluir pedido:', erro)
          toast.error('Não foi possível excluir o pedido')
        }
      },
    })
  }

  const handlePeriodoChange = (novoPeriodo: Exclude<PeriodoEntrega, 'personalizado'>) => {
    setPeriodo(novoPeriodo)
    setDatasPeriodo(obterDatasPeriodoEntrega(novoPeriodo))
    setPaginaAtual(1)
  }

  const handleFiltrosChange = (proximo: {
    periodo?: PeriodoEntrega
    dataInicio?: string
    dataFim?: string
    situacao?: FiltroSituacao
    tipo?: string
    pagamento?: FiltroPagamento
    status?: string
  }) => {
    if (proximo.periodo && proximo.periodo !== 'personalizado') {
      handlePeriodoChange(proximo.periodo)
    } else if (proximo.periodo === 'personalizado') {
      setPeriodo('personalizado')
    }

    if (proximo.dataInicio !== undefined || proximo.dataFim !== undefined) {
      setDatasPeriodo((atual) => ({
        dataInicio: proximo.dataInicio ?? atual.dataInicio,
        dataFim: proximo.dataFim ?? atual.dataFim,
      }))
      setPaginaAtual(1)
    }

    if (proximo.situacao !== undefined) {
      setFiltroSituacao(proximo.situacao)
      setPaginaAtual(1)
    }
    if (proximo.tipo !== undefined) {
      setFiltroTipo(proximo.tipo)
      setPaginaAtual(1)
    }
    if (proximo.pagamento !== undefined) {
      setFiltroPagamento(proximo.pagamento)
      setPaginaAtual(1)
    }
    if (proximo.status !== undefined) {
      setFiltroStatus(proximo.status)
      setPaginaAtual(1)
    }
  }

  const handleLimparFiltros = () => {
    setBusca('')
    setBuscaAplicada('')
    setFiltroStatus('todos')
    setFiltroTipo('todos')
    setFiltroSituacao('todos')
    setFiltroPagamento('todos')
    setPeriodo('hoje')
    setDatasPeriodo(obterDatasPeriodoEntrega('hoje'))
    setPaginaAtual(1)
  }

  const hasFilterAvancado =
    filtroSituacao !== 'todos' ||
    filtroTipo !== 'todos' ||
    filtroStatus !== 'todos' ||
    filtroPagamento !== 'todos' ||
    (periodo !== 'todos' && periodo !== 'hoje')

  const chipsFiltro: ChipFiltroAtivo[] = useMemo(() => {
    const chips: ChipFiltroAtivo[] = []
    if (periodo !== 'todos') {
      chips.push({
        key: 'periodo',
        label: 'Período',
        value:
          periodo === 'personalizado' && intervalo
            ? `${intervalo.dataInicio} → ${intervalo.dataFim}`
            : LABEL_PERIODO[periodo as Exclude<PeriodoEntrega, 'personalizado'>] ||
              'Personalizado',
      })
    }
    if (buscaAplicada) chips.push({ key: 'busca', label: 'Busca', value: buscaAplicada })
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
        value: STATUS_LABEL[filtroStatus] ?? filtroStatus,
      })
    }
    if (filtroTipo !== 'todos') {
      chips.push({
        key: 'tipo',
        label: 'Tipo',
        value: TIPOS_LABEL[filtroTipo] ?? filtroTipo,
      })
    }
    if (filtroPagamento !== 'todos') {
      chips.push({
        key: 'pagamento',
        label: 'Pagamento',
        value: filtroPagamento === 'pix_pendente' ? 'PIX pendente' : 'Fiado',
      })
    }
    return chips
  }, [
    buscaAplicada,
    filtroPagamento,
    filtroSituacao,
    filtroStatus,
    filtroTipo,
    intervalo,
    periodo,
  ])

  const totalPaginas = Math.max(1, Math.ceil(totalPedidos / itensPorPagina))

  const itensAcao = (pedido: Pedido): MenuAcaoItem[] => {
    const processando = acoesPedido[pedido.id]
    const itens: MenuAcaoItem[] = [
      {
        key: 'detalhes',
        label: 'Ver detalhes',
        icon: <Eye className="h-3.5 w-3.5" />,
        onSelect: () => {
          setPedidoDetalhesId(pedido.id)
          setModalDetalhesAberto(true)
        },
      },
      {
        key: 'editar',
        label: 'Editar',
        icon: <Edit2 className="h-3.5 w-3.5" />,
        onSelect: () => {
          setPedidoSelecionado(pedido)
          setModalEditarAberto(true)
        },
      },
      {
        key: 'pdf',
        label: 'Gerar PDF',
        icon: <FileText className="h-3.5 w-3.5" />,
        onSelect: () => void handleGerarPDF(pedido.id),
      },
      {
        key: 'imprimir',
        label: 'Imprimir cozinha',
        icon: <Printer className="h-3.5 w-3.5" />,
        disabled: Boolean(processando?.impressao),
        onSelect: () =>
          void executarAcaoPedido(pedido.id, 'impressao', () =>
            enviarParaImpressao(pedido.id, 'cozinha'),
          ),
      },
    ]

    if (pedidoTemPagamentoPendente(pedido)) {
      itens.push({
        key: 'pagamento',
        label: 'Confirmar PIX',
        disabled: Boolean(processando?.pagamento),
        onSelect: () =>
          void executarAcaoPedido(pedido.id, 'pagamento', () => confirmarPagamento(pedido)),
      })
    }

    if (!pedidoEstaEncerrado(pedido.status)) {
      itens.push({
        key: 'concluir',
        label: 'Concluir',
        disabled: Boolean(processando?.concluir),
        onSelect: () =>
          void executarAcaoPedido(pedido.id, 'concluir', () => concluirPedido(pedido)),
      })
    }

    if (pedido.mesa_id && pedido.mesa_tipo === 'mesa') {
      itens.push({
        key: 'restaurar',
        label: 'Voltar ao salão',
        disabled: Boolean(processando?.restaurarMesa),
        onSelect: () =>
          void executarAcaoPedido(pedido.id, 'restaurarMesa', () =>
            restaurarPedidoParaMesa(pedido),
          ),
      })
    }

    if (!String(pedido.forma_pagamento || '').toLowerCase().includes('credi') && !pedido.crediario_status) {
      itens.push({
        key: 'crediario',
        label: 'Enviar ao fiado',
        icon: <Wallet className="h-3.5 w-3.5" />,
        onSelect: () => void enviarParaCrediario(pedido),
      })
    }

    itens.push({
      key: 'excluir',
      label: 'Excluir',
      icon: <Trash2 className="h-3.5 w-3.5" />,
      separatorBefore: true,
      variant: 'destructive',
      onSelect: () => handleExcluirPedido(pedido.id),
    })

    return itens
  }

  return (
    <div className="space-y-5">
      <div className="flex w-full min-w-0 flex-col gap-3 overflow-hidden rounded-xl border border-border/70 bg-card p-4 shadow-sm md:flex-row md:items-center md:justify-between md:p-5">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0 shadow-none"
            onClick={() => router.push('/admin/garcons')}
            aria-label="Voltar para garçons"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <AvatarUsuario
            nome={garcom?.nome || 'Garçom'}
            src={garcom?.avatar_url}
            cor={garcom?.cor_avatar || '#0296F9'}
            size="md"
          />
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold tracking-tight text-foreground">
              Pedidos de {garcom?.nome || 'garçom'}
            </h1>
            <p className="truncate text-sm text-muted-foreground">
              @{garcom?.nome_usuario || 'usuario'}
              {garcom && !garcom.ativo ? ' · inativo' : ''}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-4 md:gap-6">
          <div className="min-w-[70px]">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              No período
            </p>
            <p className="mt-0.5 text-xl font-semibold tabular-nums text-foreground">{totalPedidos}</p>
          </div>
          <div className="min-w-[70px]">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              Em aberto
            </p>
            <p className="mt-0.5 text-xl font-semibold tabular-nums text-foreground">{totalAbertos}</p>
          </div>
          <div className="min-w-[100px]">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              Vendas
            </p>
            <p className="mt-0.5 text-xl font-semibold tabular-nums text-foreground">
              {moeda.format(valorTotalPeriodo)}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 shadow-none"
            onClick={() => void carregarPedidos()}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Atualizar
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/70 bg-card p-3.5 shadow-sm md:p-5">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-base font-medium text-foreground/90">Pedidos</span>
          <span className="inline-flex items-center rounded-full border border-border/70 bg-muted/40 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            {totalPedidos} {totalPedidos === 1 ? 'pedido' : 'pedidos'}
          </span>
        </div>

        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1 sm:max-w-[260px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-9 border-border/70 bg-background pl-9 pr-9 shadow-none"
              onChange={(event) => setBusca(event.target.value)}
              placeholder="Cliente, telefone ou ID"
              value={busca}
              aria-label="Buscar pedidos do garçom"
            />
            {busca ? (
              <button
                aria-label="Limpar busca"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => setBusca('')}
                type="button"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          <FiltroPedidosGarcom
            hasFilter={hasFilterAvancado}
            onLimpar={handleLimparFiltros}
            valor={{
              periodo,
              dataInicio: datasPeriodo.dataInicio,
              dataFim: datasPeriodo.dataFim,
              situacao: filtroSituacao,
              tipo: filtroTipo,
              pagamento: filtroPagamento,
              status: filtroStatus,
            }}
            onChange={handleFiltrosChange}
          />
        </div>

        <FiltrosAtivosChips chips={chipsFiltro} onLimpar={handleLimparFiltros} className="mb-4" />

        {loading ? (
          <TabelaSkeleton linhas={6} />
        ) : pedidos.length === 0 ? (
          <ListaVazia
            icone={<UserRound className="h-5 w-5" />}
            titulo="Nenhum pedido encontrado"
            descricao="Ajuste o período ou os filtros para monitorar este garçom."
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[820px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/30">
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Horário</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Cliente</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Local</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">Pagamento</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Total</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {pedidos.map((pedido) => (
                    <tr
                      key={pedido.id}
                      className="border-b border-border/40 last:border-0 hover:bg-muted/20"
                    >
                      <td className="px-4 py-3 tabular-nums text-muted-foreground">
                        {format(new Date(pedido.created_at), 'dd/MM HH:mm', { locale: ptBR })}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{pedido.nome_cliente}</p>
                        <p className="text-xs text-muted-foreground">{rotuloTipo(pedido.tipo_entrega)}</p>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{pontoSalao(pedido)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium',
                            classeStatus(pedido.status),
                          )}
                        >
                          {rotuloStatus(pedido.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{rotuloPagamento(pedido)}</td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums text-foreground">
                        {moeda.format(pedido.total)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <MenuAcoes ariaLabel={`Ações do pedido de ${pedido.nome_cliente}`} items={itensAcao(pedido)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-border/50 md:hidden">
              {pedidos.map((pedido) => {
                const Icone = iconeTipo(pedido.tipo_entrega)
                return (
                  <div
                    key={pedido.id}
                    className="relative flex items-start gap-3 py-3.5 pl-3"
                  >
                    <span
                      className={cn(
                        'absolute bottom-3 left-0 top-3 w-0.5 rounded-full',
                        classeBordaTipo(pedido.tipo_entrega),
                      )}
                    />
                    <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted/70 text-muted-foreground">
                      <Icone className="h-4 w-4" strokeWidth={1.6} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {pedido.nome_cliente}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {format(new Date(pedido.created_at), 'dd/MM HH:mm', { locale: ptBR })}
                            {' · '}
                            {rotuloTipo(pedido.tipo_entrega)}
                            {pontoSalao(pedido) !== '—' ? ` · ${pontoSalao(pedido)}` : ''}
                          </p>
                        </div>
                        <MenuAcoes
                          ariaLabel={`Ações do pedido de ${pedido.nome_cliente}`}
                          items={itensAcao(pedido)}
                        />
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium',
                            classeStatus(pedido.status),
                          )}
                        >
                          {rotuloStatus(pedido.status)}
                        </span>
                        <span className="inline-flex items-center rounded-md border border-border/60 px-1.5 py-0.5 text-[11px] text-muted-foreground">
                          {rotuloPagamento(pedido)}
                        </span>
                        <span className="ml-auto text-sm font-semibold tabular-nums text-foreground">
                          {moeda.format(pedido.total)}
                        </span>
                      </div>
                      <div className="mt-2 flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 flex-1 shadow-none"
                          onClick={() => {
                            setPedidoDetalhesId(pedido.id)
                            setModalDetalhesAberto(true)
                          }}
                        >
                          Detalhes
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 flex-1 shadow-none"
                          onClick={() => {
                            setPedidoSelecionado(pedido)
                            setModalEditarAberto(true)
                          }}
                        >
                          Editar
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <PaginacaoPedidos
              paginaAtual={paginaAtual}
              totalPaginas={totalPaginas}
              itensPorPagina={itensPorPagina}
              totalItens={totalPedidos}
              carregando={loading}
              onPaginaChange={setPaginaAtual}
              onItensPorPaginaChange={(quantidade) => {
                setItensPorPagina(quantidade)
                setPaginaAtual(1)
              }}
            />
          </>
        )}
      </div>

      <ModalEditarPedido
        pedido={pedidoSelecionado}
        aberto={modalEditarAberto}
        onFechar={() => {
          setModalEditarAberto(false)
          setPedidoSelecionado(null)
        }}
        onSucesso={() => recarregar(true)}
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
        onGerarPDF={(pedido) => void handleGerarPDF(pedido.id)}
      />

      <ModalNotificacao
        aberto={modalNotificacao.aberto}
        tipo={modalNotificacao.tipo}
        titulo={modalNotificacao.titulo}
        mensagem={modalNotificacao.mensagem}
        onFechar={() => setModalNotificacao((atual) => ({ ...atual, aberto: false }))}
        onConfirmar={modalNotificacao.onConfirmar}
        textoBotaoConfirmar="Excluir"
        textoBotaoCancelar="Cancelar"
      />
    </div>
  )
}
