'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users,
  Clock,
  RefreshCw,
  Trash2,
  CheckCircle,
  Plus,
  Timer,
  X,
  Hash,
  ShoppingCart,
  Pencil,
  QrCode,
  Printer,
  Download,
  Layers,
  Percent,
  Save,
  Package,
  Eye,
  Loader2,
} from 'lucide-react'
import { QRCodeCanvas } from 'qrcode.react'
import IconeMesa from '@/components/icons/IconeMesa'
import { format, differenceInMinutes } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import ProtectedRoute from '@/components/admin/ProtectedRoute'
import AdminLayout from '@/components/admin/AdminLayout'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { obterIntervaloDiaOperacionalAtual, estaNoDiaOperacionalAtual } from '@/lib/dia-operacional'
import { TEMPO_PADRAO_MESA_MINUTOS } from '@/lib/mesas-tempo'
import { supabase } from '@/lib/supabase'
import ModalNotificacao from '@/components/ModalNotificacao'
import { useRouter } from 'next/navigation'
import { useImpressoraOpcional } from '@/contexts/ImpressoraContext'
import {
  converterConferenciaParaEscpos,
  DadosConferenciaPedido,
  montarModeloConferencia,
  OpcaoTaxaConferencia,
} from '@/lib/impressora/conferencia'
import {
  enfileirarImpressao,
  gerarHashEventoImpressao,
  ItemSnapshotImpressao,
  PedidoSnapshotImpressao,
} from '@/lib/filaImpressao'

const TEMPO_PADRAO_MINUTOS = TEMPO_PADRAO_MESA_MINUTOS
const LIMITE_PEDIDOS_SALAO = 50

type TipoPontoSalao = 'mesa' | 'comanda'
type AbaSalao = 'mesas' | 'comandas' | 'taxa_servico'

type PontoSalao = {
  id: string
  numero: number
  tipo: TipoPontoSalao
  status: 'livre' | 'ocupada'
  nome_cliente: string | null
  ocupada_em: string | null
  liberar_em: string | null
  tempo_limite_minutos: number | null
  pedido_id: string | null
  codigo_qr: string
  identificador: string | null
  updated_at: string
}

type ItemPedidoSalao = {
  id: string
  nome_item: string | null
  quantidade: number
  subtotal: number
  observacoes: string | null
  item_adicionais: Array<{
    nome: string
    preco: number
    quantidade: number
  }>
}

type PedidoSalao = {
  id: string
  numero_pedido: number | null
  nome_cliente: string
  telefone: string | null
  endereco: string | null
  bairro: string | null
  status: string
  created_at: string
  observacoes: string | null
  forma_pagamento: string | null
  troco_para: number | null
  subtotal: number
  taxa_entrega: number
  taxa_servico: number
  total: number
  mesa: number | null
  comanda: number | null
  mesa_id: string | null
  pagamentos_divididos: Array<{
    forma_pagamento: string
    valor: number
  }>
  itens_pedido: ItemPedidoSalao[]
}

type ModalConfirmacao = {
  aberto: boolean
  tipo: 'sucesso' | 'erro' | 'aviso' | 'info' | 'confirmacao'
  titulo: string
  mensagem: string
  onConfirmar: () => void
}

type ModalCriarLote = {
  aberto: boolean
  tipo: TipoPontoSalao
}

type ModalEditarPonto = {
  aberto: boolean
  ponto: PontoSalao | null
  numero: string
  identificador: string
}

const ABAS_SALAO: Array<{ id: AbaSalao; titulo: string; descricao: string; icone: typeof Layers }> = [
  {
    id: 'mesas',
    titulo: 'Mesas - QR Code',
    descricao: 'Gerencie mesas físicas e impressão dos códigos.',
    icone: Layers,
  },
  {
    id: 'comandas',
    titulo: 'Comandas',
    descricao: 'Organize comandas com QR e abertura rápida de pedido.',
    icone: Package,
  },
  {
    id: 'taxa_servico',
    titulo: 'Taxa de serviço',
    descricao: 'Configure a taxa padrão e ajuste por pedido.',
    icone: Percent,
  },
]

const formatarMoeda = (valor: number) => `R$ ${Number(valor || 0).toFixed(2).replace('.', ',')}`

const normalizarNumero = (valor: unknown, fallback = 0) => {
  const numero = Number(valor)
  if (!Number.isFinite(numero)) return fallback
  return numero
}

const obterTipoAba = (abaAtiva: AbaSalao): TipoPontoSalao => (abaAtiva === 'comandas' ? 'comanda' : 'mesa')

const obterTituloPonto = (tipo: TipoPontoSalao) => (tipo === 'comanda' ? 'Comanda' : 'Mesa')

const gerarCodigoQrLocal = (tipo: TipoPontoSalao, numero: number) =>
  `${tipo}-${numero}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

const obterUrlBaseQr = (tipo: TipoPontoSalao) => {
  if (tipo === 'mesa') {
    const configuradaMesa = process.env.NEXT_PUBLIC_URL_QR_MESA_BASE?.trim()
    if (configuradaMesa) return configuradaMesa
    if (typeof window !== 'undefined') return window.location.origin
    return ''
  }

  const configuradaComanda = process.env.NEXT_PUBLIC_URL_QR_SALAO_BASE?.trim()
  if (configuradaComanda) return configuradaComanda
  if (typeof window !== 'undefined') return `${window.location.origin}/admin/pedidos/novo`
  return '/admin/pedidos/novo'
}

const montarUrlQrPonto = (ponto: PontoSalao) => {
  const base = obterUrlBaseQr(ponto.tipo)
  const separador = base.includes('?') ? '&' : '?'
  const parametros =
    ponto.tipo === 'comanda'
      ? `comanda=${ponto.numero}&token=${encodeURIComponent(ponto.codigo_qr)}`
      : `mesa=${ponto.numero}&origem=qr_mesa&abrirCarrinho=1&token=${encodeURIComponent(ponto.codigo_qr)}`

  return `${base}${separador}${parametros}`
}

const statusPedidoEncerrado = (status: string) => {
  const normalizado = String(status || '').trim().toLowerCase()
  return normalizado === 'entregue' || normalizado === 'cancelado'
}

export default function MesasPage() {
  const [abaAtiva, setAbaAtiva] = useState<AbaSalao>('mesas')
  const [pontosSalao, setPontosSalao] = useState<PontoSalao[]>([])
  const [pedidosSalao, setPedidosSalao] = useState<PedidoSalao[]>([])
  const [loading, setLoading] = useState(true)
  const [atualizandoPonto, setAtualizandoPonto] = useState<string | null>(null)
  const [salvandoTaxaServico, setSalvandoTaxaServico] = useState(false)
  const [salvandoTaxaPedido, setSalvandoTaxaPedido] = useState<string | null>(null)
  const [idsSelecionados, setIdsSelecionados] = useState<string[]>([])

  const [taxaServicoAtiva, setTaxaServicoAtiva] = useState(false)
  const [taxaServicoPercentual, setTaxaServicoPercentual] = useState('10')
  const [taxaServicoPorPedido, setTaxaServicoPorPedido] = useState<Record<string, string>>({})
  const [pedidoTicketSelecionadoId, setPedidoTicketSelecionadoId] = useState<string | null>(null)
  const [opcaoTaxaConferencia, setOpcaoTaxaConferencia] = useState<OpcaoTaxaConferencia>('com_taxa')
  const [imprimindoConferencia, setImprimindoConferencia] = useState(false)
  const botaoFecharConferenciaRef = useRef<HTMLButtonElement | null>(null)

  const [modalCriarLote, setModalCriarLote] = useState<ModalCriarLote>({ aberto: false, tipo: 'mesa' })
  const [numeroInicialLote, setNumeroInicialLote] = useState('1')
  const [quantidadeLote, setQuantidadeLote] = useState('1')
  const [criandoLote, setCriandoLote] = useState(false)

  const [modalEditarPonto, setModalEditarPonto] = useState<ModalEditarPonto>({
    aberto: false,
    ponto: null,
    numero: '',
    identificador: '',
  })
  const [salvandoEdicao, setSalvandoEdicao] = useState(false)

  const [modalNotificacao, setModalNotificacao] = useState<ModalConfirmacao>({
    aberto: false,
    tipo: 'info',
    titulo: '',
    mensagem: '',
    onConfirmar: () => {},
  })

  const router = useRouter()
  const impressora = useImpressoraOpcional()

  const carregarPontosSalao = useCallback(async () => {
    try {
      await supabase.rpc('limpar_mesas_expiradas')

      const { data, error } = await supabase
        .from('mesas')
        .select('*')
        .order('tipo', { ascending: true })
        .order('numero', { ascending: true })

      if (error) throw error

      const pontos = (data || []).map((registro) => ({
        id: String(registro.id),
        numero: normalizarNumero(registro.numero),
        tipo: (String(registro.tipo || 'mesa').toLowerCase() === 'comanda' ? 'comanda' : 'mesa') as TipoPontoSalao,
        status: (String(registro.status || 'livre').toLowerCase() === 'ocupada' ? 'ocupada' : 'livre') as 'livre' | 'ocupada',
        nome_cliente: registro.nome_cliente,
        ocupada_em: registro.ocupada_em,
        liberar_em: registro.liberar_em,
        tempo_limite_minutos: registro.tempo_limite_minutos,
        pedido_id: registro.pedido_id,
        codigo_qr: String(registro.codigo_qr || gerarCodigoQrLocal('mesa', normalizarNumero(registro.numero))),
        identificador: registro.identificador,
        updated_at: String(registro.updated_at || ''),
      }))

      setPontosSalao(pontos)
    } catch (erro) {
      console.error('Erro ao carregar pontos do salão:', erro)
      setModalNotificacao({
        aberto: true,
        tipo: 'erro',
        titulo: 'Falha ao carregar salão',
        mensagem: 'Não foi possível carregar mesas e comandas.',
        onConfirmar: () => {},
      })
    }
  }, [])

  const carregarPedidosSalao = useCallback(async () => {
    try {
      const { inicio, fim } = obterIntervaloDiaOperacionalAtual()
      const { data, error } = await supabase
        .from('pedidos')
        .select(`
          id,
          numero_pedido,
          nome_cliente,
          telefone,
          endereco,
          bairro,
          status,
          created_at,
          observacoes,
          forma_pagamento,
          troco_para,
          subtotal,
          taxa_entrega,
          taxa_servico,
          total,
          mesa,
          comanda,
          mesa_id,
          itens_pedido (
            id,
            nome_item,
            quantidade,
            subtotal,
            observacoes,
            item_adicionais (
              nome,
              preco,
              quantidade
            )
          )
        `)
        .eq('tipo_entrega', 'local')
        .gte('created_at', inicio.toISOString())
        .lt('created_at', fim.toISOString())
        .order('created_at', { ascending: false })
        .limit(LIMITE_PEDIDOS_SALAO)

      if (error) throw error

      const idsPedidos = (data || []).map((registro) => String(registro.id))
      const pagamentosPorPedido = new Map<string, Array<{ forma_pagamento: string; valor: number }>>()

      if (idsPedidos.length > 0) {
        const { data: pagamentosData, error: pagamentosError } = await supabase
          .from('pagamentos_pedido')
          .select('pedido_id, forma_pagamento, valor')
          .in('pedido_id', idsPedidos)

        if (pagamentosError) {
          console.error('Erro ao carregar pagamentos do salão:', pagamentosError)
        } else {
          ;(pagamentosData || []).forEach((pagamento) => {
            const pedidoId = String(pagamento.pedido_id || '')
            if (!pedidoId) return

            const listaAtual = pagamentosPorPedido.get(pedidoId) || []
            listaAtual.push({
              forma_pagamento: String(pagamento.forma_pagamento || ''),
              valor: normalizarNumero(pagamento.valor),
            })
            pagamentosPorPedido.set(pedidoId, listaAtual)
          })
        }
      }

      const pedidos = (data || [])
        .map((registro) => ({
          id: String(registro.id),
          numero_pedido:
            registro.numero_pedido === null || registro.numero_pedido === undefined
              ? null
              : normalizarNumero(registro.numero_pedido),
          nome_cliente: String(registro.nome_cliente || 'Cliente'),
          telefone: registro.telefone || null,
          endereco: registro.endereco || null,
          bairro: registro.bairro || null,
          status: String(registro.status || ''),
          created_at: String(registro.created_at || ''),
          observacoes: registro.observacoes || null,
          forma_pagamento: registro.forma_pagamento || null,
          troco_para:
            registro.troco_para === null || registro.troco_para === undefined
              ? null
              : normalizarNumero(registro.troco_para),
          subtotal: normalizarNumero(registro.subtotal),
          taxa_entrega: normalizarNumero(registro.taxa_entrega),
          taxa_servico: normalizarNumero(registro.taxa_servico),
          total: normalizarNumero(registro.total),
          mesa: registro.mesa === null || registro.mesa === undefined ? null : normalizarNumero(registro.mesa),
          comanda: registro.comanda === null || registro.comanda === undefined ? null : normalizarNumero(registro.comanda),
          mesa_id: registro.mesa_id ? String(registro.mesa_id) : null,
          pagamentos_divididos: pagamentosPorPedido.get(String(registro.id)) || [],
          itens_pedido: Array.isArray(registro.itens_pedido)
            ? registro.itens_pedido.map((item) => ({
                id: String(item.id),
                nome_item: item.nome_item,
                quantidade: normalizarNumero(item.quantidade, 1),
                subtotal: normalizarNumero(item.subtotal),
                observacoes: item.observacoes || null,
                item_adicionais: Array.isArray(item.item_adicionais)
                  ? item.item_adicionais.map((adicional) => ({
                      nome: String(adicional.nome || 'Adicional'),
                      preco: normalizarNumero(adicional.preco),
                      quantidade: normalizarNumero(adicional.quantidade, 1),
                    }))
                  : [],
              }))
            : [],
        }))
        .filter((pedido) => !statusPedidoEncerrado(pedido.status) && estaNoDiaOperacionalAtual(pedido.created_at))

      setPedidosSalao(pedidos)
      setTaxaServicoPorPedido((estadoAnterior) => {
        const proximoEstado = { ...estadoAnterior }
        pedidos.forEach((pedido) => {
          if (!proximoEstado[pedido.id]) {
            proximoEstado[pedido.id] = pedido.taxa_servico.toFixed(2)
          }
        })
        return proximoEstado
      })
    } catch (erro) {
      console.error('Erro ao carregar pedidos de salão:', erro)
    }
  }, [])

  const carregarConfigTaxaServico = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('configuracoes_loja')
        .select('chave, valor')
        .in('chave', ['salao_taxa_servico_ativa', 'salao_taxa_servico_percentual'])

      if (error) throw error

      const ativa = data?.find((item) => item.chave === 'salao_taxa_servico_ativa')?.valor
      const percentual = data?.find((item) => item.chave === 'salao_taxa_servico_percentual')?.valor

      setTaxaServicoAtiva(String(ativa || 'false').toLowerCase() === 'true')
      setTaxaServicoPercentual(String(percentual || '10'))
    } catch (erro) {
      console.error('Erro ao carregar configurações da taxa de serviço:', erro)
    }
  }, [])

  const carregarTudo = useCallback(async () => {
    setLoading(true)
    try {
      await Promise.all([
        carregarPontosSalao(),
        carregarPedidosSalao(),
        carregarConfigTaxaServico(),
      ])
    } finally {
      setLoading(false)
    }
  }, [carregarConfigTaxaServico, carregarPedidosSalao, carregarPontosSalao])

  useEffect(() => {
    carregarTudo()

    const intervalo = setInterval(() => {
      carregarPontosSalao()
      carregarPedidosSalao()
    }, 30000)

    const canalMesas = supabase
      .channel(`mesas-admin-salao-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mesas' }, () => {
        carregarPontosSalao()
      })
      .subscribe()

    const canalPedidos = supabase
      .channel(`pedidos-admin-salao-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, () => {
        carregarPedidosSalao()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'itens_pedido' }, () => {
        carregarPedidosSalao()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pagamentos_pedido' }, () => {
        carregarPedidosSalao()
      })
      .subscribe()

    return () => {
      clearInterval(intervalo)
      supabase.removeChannel(canalMesas)
      supabase.removeChannel(canalPedidos)
    }
  }, [carregarTudo, carregarPontosSalao, carregarPedidosSalao])

  const tipoAbaAtual = obterTipoAba(abaAtiva)

  const pontosVisiveis = useMemo(() => {
    if (abaAtiva === 'taxa_servico') return []
    return pontosSalao.filter((ponto) => ponto.tipo === tipoAbaAtual)
  }, [abaAtiva, pontosSalao, tipoAbaAtual])

  useEffect(() => {
    setIdsSelecionados((estadoAnterior) => estadoAnterior.filter((id) => pontosVisiveis.some((ponto) => ponto.id === id)))
  }, [pontosVisiveis])

  const idsSelecionadosSet = useMemo(() => new Set(idsSelecionados), [idsSelecionados])

  const pontosSelecionados = useMemo(
    () => pontosVisiveis.filter((ponto) => idsSelecionadosSet.has(ponto.id)),
    [idsSelecionadosSet, pontosVisiveis]
  )

  const pedidoTicketSelecionado = useMemo(
    () => pedidosSalao.find((pedido) => pedido.id === pedidoTicketSelecionadoId) || null,
    [pedidosSalao, pedidoTicketSelecionadoId]
  )

  const converterPedidoParaConferencia = useCallback(
    (pedido: PedidoSalao): DadosConferenciaPedido => ({
      id: pedido.id,
      numeroPedido: pedido.numero_pedido,
      nomeCliente: pedido.nome_cliente || 'Cliente',
      telefone: pedido.telefone,
      tipoEntrega: 'local',
      mesa: pedido.mesa,
      comanda: pedido.comanda,
      endereco: pedido.endereco,
      bairro: pedido.bairro,
      createdAt: pedido.created_at,
      formaPagamento: pedido.forma_pagamento,
      pagamentosDivididos: pedido.pagamentos_divididos,
      trocoPara: pedido.troco_para,
      observacoes: pedido.observacoes,
      subtotal: pedido.subtotal,
      taxaEntrega: pedido.taxa_entrega,
      taxaServico: pedido.taxa_servico,
      total: pedido.total,
      itens: pedido.itens_pedido.map((item) => ({
        id: item.id,
        nome: item.nome_item || 'Item',
        quantidade: item.quantidade,
        subtotal: item.subtotal,
        observacoes: item.observacoes,
        adicionais: item.item_adicionais.map((adicional) => ({
          nome: adicional.nome,
          preco: adicional.preco,
          quantidade: adicional.quantidade,
        })),
      })),
    }),
    []
  )

  const dadosConferenciaSelecionado = useMemo(
    () => (pedidoTicketSelecionado ? converterPedidoParaConferencia(pedidoTicketSelecionado) : null),
    [converterPedidoParaConferencia, pedidoTicketSelecionado]
  )

  const modeloConferenciaComTaxa = useMemo(
    () =>
      dadosConferenciaSelecionado
        ? montarModeloConferencia(dadosConferenciaSelecionado, 'com_taxa')
        : null,
    [dadosConferenciaSelecionado]
  )

  const modeloConferenciaSemTaxa = useMemo(
    () =>
      dadosConferenciaSelecionado
        ? montarModeloConferencia(dadosConferenciaSelecionado, 'sem_taxa')
        : null,
    [dadosConferenciaSelecionado]
  )

  const modeloConferenciaSelecionado = useMemo(
    () => (opcaoTaxaConferencia === 'sem_taxa' ? modeloConferenciaSemTaxa : modeloConferenciaComTaxa),
    [modeloConferenciaComTaxa, modeloConferenciaSemTaxa, opcaoTaxaConferencia]
  )

  const obterPedidoAtivoDoPonto = useCallback(
    (ponto: PontoSalao) => {
      if (ponto.pedido_id) {
        const porPedidoId = pedidosSalao.find((pedido) => pedido.id === ponto.pedido_id)
        if (porPedidoId) return porPedidoId
      }

      const porMesaId = pedidosSalao.find((pedido) => pedido.mesa_id === ponto.id)
      if (porMesaId) return porMesaId

      return pedidosSalao.find((pedido) =>
        ponto.tipo === 'comanda'
          ? pedido.comanda === ponto.numero
          : pedido.mesa === ponto.numero
      ) || null
    },
    [pedidosSalao]
  )

  const quantidadeLivres = useMemo(
    () => pontosVisiveis.filter((ponto) => ponto.status === 'livre').length,
    [pontosVisiveis]
  )

  const quantidadeOcupadas = useMemo(
    () => pontosVisiveis.filter((ponto) => ponto.status === 'ocupada').length,
    [pontosVisiveis]
  )

  useEffect(() => {
    if (!pedidoTicketSelecionadoId) return
    const aindaExiste = pedidosSalao.some((pedido) => pedido.id === pedidoTicketSelecionadoId)
    if (!aindaExiste) {
      setPedidoTicketSelecionadoId(null)
    }
  }, [pedidosSalao, pedidoTicketSelecionadoId])

  useEffect(() => {
    if (!pedidoTicketSelecionadoId) return
    setOpcaoTaxaConferencia('com_taxa')
    window.setTimeout(() => {
      botaoFecharConferenciaRef.current?.focus()
    }, 0)
  }, [pedidoTicketSelecionadoId])

  useEffect(() => {
    if (!pedidoTicketSelecionadoId) return

    const aoPressionarEscape = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') {
        setPedidoTicketSelecionadoId(null)
      }
    }

    window.addEventListener('keydown', aoPressionarEscape)
    return () => window.removeEventListener('keydown', aoPressionarEscape)
  }, [pedidoTicketSelecionadoId])

  const calcularTempoRestante = (ponto: PontoSalao) => {
    if (!ponto.liberar_em && !ponto.ocupada_em) {
      return { texto: 'Sem limite', porcentagem: 0, urgente: false }
    }

    const agora = new Date()
    const tempoLimite = ponto.tempo_limite_minutos || TEMPO_PADRAO_MINUTOS

    let limite: Date
    if (ponto.liberar_em) {
      limite = new Date(ponto.liberar_em)
    } else {
      const inicio = new Date(ponto.ocupada_em as string)
      limite = new Date(inicio.getTime() + tempoLimite * 60 * 1000)
    }

    const minutosRestantes = differenceInMinutes(limite, agora)

    if (minutosRestantes <= 0) return { texto: 'Expirando...', porcentagem: 100, urgente: true }

    const horas = Math.floor(minutosRestantes / 60)
    const minutos = minutosRestantes % 60
    const porcentagem = ((tempoLimite - minutosRestantes) / tempoLimite) * 100

    if (horas > 0) {
      return { texto: `${horas}h ${minutos}min`, porcentagem, urgente: minutosRestantes < 15 }
    }
    return { texto: `${minutos}min`, porcentagem, urgente: minutosRestantes < 15 }
  }

  const obterCanvasQr = (idPonto: string) => document.getElementById(`qr-${idPonto}`) as HTMLCanvasElement | null

  const exportarQrPng = (ponto: PontoSalao) => {
    const canvas = obterCanvasQr(ponto.id)
    if (!canvas) {
      setModalNotificacao({
        aberto: true,
        tipo: 'aviso',
        titulo: 'QR indisponível',
        mensagem: 'Aguarde o carregamento do QR para exportar.',
        onConfirmar: () => {},
      })
      return
    }

    const dataUrl = canvas.toDataURL('image/png')
    const link = document.createElement('a')
    link.href = dataUrl
    link.download = `${obterTituloPonto(ponto.tipo).toLowerCase()}-${ponto.numero}.png`
    link.click()
  }

  const exportarSelecionados = () => {
    if (pontosSelecionados.length === 0) {
      setModalNotificacao({
        aberto: true,
        tipo: 'aviso',
        titulo: 'Nenhum item selecionado',
        mensagem: 'Selecione ao menos um QR para exportar.',
        onConfirmar: () => {},
      })
      return
    }

    pontosSelecionados.forEach((ponto, indice) => {
      window.setTimeout(() => exportarQrPng(ponto), indice * 140)
    })
  }

  const imprimirSelecionados = () => {
    if (pontosSelecionados.length === 0) {
      setModalNotificacao({
        aberto: true,
        tipo: 'aviso',
        titulo: 'Nenhum item selecionado',
        mensagem: 'Selecione ao menos um QR para imprimir.',
        onConfirmar: () => {},
      })
      return
    }

    const blocos = pontosSelecionados
      .map((ponto) => {
        const canvas = obterCanvasQr(ponto.id)
        if (!canvas) return null
        const imagem = canvas.toDataURL('image/png')
        const titulo = ponto.identificador || `${obterTituloPonto(ponto.tipo)} ${ponto.numero}`
        const url = montarUrlQrPonto(ponto)

        return `
          <article class="cartao">
            <h2>${titulo}</h2>
            <img src="${imagem}" alt="QR ${titulo}" />
            <p>${url}</p>
          </article>
        `
      })
      .filter(Boolean)
      .join('')

    if (!blocos) {
      setModalNotificacao({
        aberto: true,
        tipo: 'aviso',
        titulo: 'QR indisponível',
        mensagem: 'Não foi possível montar os QR Codes para impressão.',
        onConfirmar: () => {},
      })
      return
    }

    const janela = window.open('', '_blank', 'width=900,height=700')
    if (!janela) {
      setModalNotificacao({
        aberto: true,
        tipo: 'erro',
        titulo: 'Popup bloqueado',
        mensagem: 'Permita popups do navegador para imprimir os QR Codes.',
        onConfirmar: () => {},
      })
      return
    }

    janela.document.write(`
      <!doctype html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <title>Impressão QR - Bar da Ladeira</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 24px; color: #111827; }
            h1 { margin: 0 0 16px; font-size: 20px; }
            .grade { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 18px; }
            .cartao { border: 1px solid #d4d4d8; border-radius: 12px; padding: 14px; text-align: center; }
            .cartao img { width: 140px; height: 140px; object-fit: contain; }
            .cartao h2 { font-size: 16px; margin: 0 0 10px; }
            .cartao p { font-size: 11px; color: #52525b; word-break: break-all; margin: 8px 0 0; }
            @media print {
              body { margin: 0; padding: 14px; }
            }
          </style>
        </head>
        <body>
          <h1>Bar da Ladeira • QR Codes do salão</h1>
          <section class="grade">${blocos}</section>
          <script>
            window.onload = () => {
              window.print();
            };
          </script>
        </body>
      </html>
    `)
    janela.document.close()
  }

  const alternarSelecao = (idPonto: string) => {
    setIdsSelecionados((estadoAnterior) =>
      estadoAnterior.includes(idPonto)
        ? estadoAnterior.filter((id) => id !== idPonto)
        : [...estadoAnterior, idPonto]
    )
  }

  const selecionarTodosVisiveis = () => {
    if (pontosVisiveis.length === 0) return

    const todosSelecionados = pontosVisiveis.every((ponto) => idsSelecionadosSet.has(ponto.id))
    if (todosSelecionados) {
      setIdsSelecionados((estadoAnterior) => estadoAnterior.filter((id) => !pontosVisiveis.some((ponto) => ponto.id === id)))
      return
    }

    const idsNovos = pontosVisiveis.map((ponto) => ponto.id)
    setIdsSelecionados((estadoAnterior) => Array.from(new Set([...estadoAnterior, ...idsNovos])))
  }

  const abrirCriacaoLote = (tipo: TipoPontoSalao) => {
    const pontosTipo = pontosSalao.filter((ponto) => ponto.tipo === tipo)
    const proximoNumero = pontosTipo.length > 0 ? Math.max(...pontosTipo.map((ponto) => ponto.numero)) + 1 : 1

    setModalCriarLote({ aberto: true, tipo })
    setNumeroInicialLote(String(proximoNumero))
    setQuantidadeLote('1')
  }

  const criarLote = async () => {
    const numeroInicial = parseInt(numeroInicialLote, 10)
    const quantidade = parseInt(quantidadeLote, 10)

    if (!Number.isFinite(numeroInicial) || numeroInicial <= 0) {
      setModalNotificacao({
        aberto: true,
        tipo: 'aviso',
        titulo: 'Número inicial inválido',
        mensagem: 'Informe um número inicial maior que zero.',
        onConfirmar: () => {},
      })
      return
    }

    if (!Number.isFinite(quantidade) || quantidade <= 0 || quantidade > 200) {
      setModalNotificacao({
        aberto: true,
        tipo: 'aviso',
        titulo: 'Quantidade inválida',
        mensagem: 'A quantidade deve estar entre 1 e 200 itens.',
        onConfirmar: () => {},
      })
      return
    }

    const tipo = modalCriarLote.tipo
    const numerosNovos = Array.from({ length: quantidade }, (_, indice) => numeroInicial + indice)
    const numerosExistentes = new Set(
      pontosSalao
        .filter((ponto) => ponto.tipo === tipo)
        .map((ponto) => ponto.numero)
    )

    const conflituosos = numerosNovos.filter((numero) => numerosExistentes.has(numero))
    if (conflituosos.length > 0) {
      setModalNotificacao({
        aberto: true,
        tipo: 'aviso',
        titulo: 'Numeração em uso',
        mensagem: `Já existem ${obterTituloPonto(tipo).toLowerCase()}s com os números: ${conflituosos.join(', ')}.`,
        onConfirmar: () => {},
      })
      return
    }

    setCriandoLote(true)
    try {
      const registros = numerosNovos.map((numero) => ({
        numero,
        tipo,
        status: 'livre',
        tempo_limite_minutos: TEMPO_PADRAO_MINUTOS,
        codigo_qr: gerarCodigoQrLocal(tipo, numero),
        identificador: `${obterTituloPonto(tipo)} ${numero}`,
      }))

      const { error } = await supabase.from('mesas').insert(registros)
      if (error) throw error

      setModalCriarLote({ ...modalCriarLote, aberto: false })
      await carregarPontosSalao()
      setModalNotificacao({
        aberto: true,
        tipo: 'sucesso',
        titulo: 'Cadastro concluído',
        mensagem: `${quantidade} ${obterTituloPonto(tipo).toLowerCase()}${quantidade > 1 ? 's' : ''} criada${quantidade > 1 ? 's' : ''} com sucesso.`,
        onConfirmar: () => {},
      })
    } catch (erro) {
      console.error('Erro ao criar lote:', erro)
      setModalNotificacao({
        aberto: true,
        tipo: 'erro',
        titulo: 'Falha ao criar lote',
        mensagem: `Não foi possível criar ${obterTituloPonto(tipo).toLowerCase()}s neste momento.`,
        onConfirmar: () => {},
      })
    } finally {
      setCriandoLote(false)
    }
  }

  const abrirEdicaoPonto = (ponto: PontoSalao) => {
    setModalEditarPonto({
      aberto: true,
      ponto,
      numero: String(ponto.numero),
      identificador: ponto.identificador || `${obterTituloPonto(ponto.tipo)} ${ponto.numero}`,
    })
  }

  const salvarEdicaoPonto = async () => {
    const ponto = modalEditarPonto.ponto
    if (!ponto) return

    const numeroNovo = parseInt(modalEditarPonto.numero, 10)
    if (!Number.isFinite(numeroNovo) || numeroNovo <= 0) {
      setModalNotificacao({
        aberto: true,
        tipo: 'aviso',
        titulo: 'Número inválido',
        mensagem: 'Informe um número maior que zero.',
        onConfirmar: () => {},
      })
      return
    }

    const duplicado = pontosSalao.some(
      (registro) => registro.id !== ponto.id && registro.tipo === ponto.tipo && registro.numero === numeroNovo
    )

    if (duplicado) {
      setModalNotificacao({
        aberto: true,
        tipo: 'aviso',
        titulo: 'Numeração em uso',
        mensagem: `Já existe ${obterTituloPonto(ponto.tipo).toLowerCase()} ${numeroNovo}.`,
        onConfirmar: () => {},
      })
      return
    }

    setSalvandoEdicao(true)
    try {
      const { error } = await supabase
        .from('mesas')
        .update({
          numero: numeroNovo,
          identificador: modalEditarPonto.identificador.trim() || `${obterTituloPonto(ponto.tipo)} ${numeroNovo}`,
        })
        .eq('id', ponto.id)

      if (error) throw error

      setModalEditarPonto({ aberto: false, ponto: null, numero: '', identificador: '' })
      await carregarPontosSalao()
    } catch (erro) {
      console.error('Erro ao editar ponto:', erro)
      setModalNotificacao({
        aberto: true,
        tipo: 'erro',
        titulo: 'Erro ao salvar',
        mensagem: 'Não foi possível salvar as alterações.',
        onConfirmar: () => {},
      })
    } finally {
      setSalvandoEdicao(false)
    }
  }

  const excluirPonto = async (ponto: PontoSalao) => {
    if (ponto.status === 'ocupada') {
      setModalNotificacao({
        aberto: true,
        tipo: 'aviso',
        titulo: `${obterTituloPonto(ponto.tipo)} ocupada`,
        mensagem: `Libere ${ponto.identificador || `${obterTituloPonto(ponto.tipo)} ${ponto.numero}`} antes de excluir.`,
        onConfirmar: () => {},
      })
      return
    }

    setModalNotificacao({
      aberto: true,
      tipo: 'confirmacao',
      titulo: `Excluir ${obterTituloPonto(ponto.tipo)}`,
      mensagem: `Deseja excluir permanentemente ${ponto.identificador || `${obterTituloPonto(ponto.tipo)} ${ponto.numero}`}?`,
      onConfirmar: async () => {
        try {
          const { error } = await supabase.from('mesas').delete().eq('id', ponto.id)
          if (error) throw error

          setIdsSelecionados((estadoAnterior) => estadoAnterior.filter((id) => id !== ponto.id))
          await carregarPontosSalao()
        } catch (erro) {
          console.error('Erro ao excluir ponto:', erro)
        }
      },
    })
  }

  const excluirSelecionados = () => {
    if (pontosSelecionados.length === 0) {
      setModalNotificacao({
        aberto: true,
        tipo: 'aviso',
        titulo: 'Nada selecionado',
        mensagem: 'Selecione ao menos um item para excluir.',
        onConfirmar: () => {},
      })
      return
    }

    const ocupados = pontosSelecionados.filter((ponto) => ponto.status === 'ocupada')
    if (ocupados.length > 0) {
      setModalNotificacao({
        aberto: true,
        tipo: 'aviso',
        titulo: 'Itens ocupados',
        mensagem: 'Existem itens ocupados na seleção. Libere antes de excluir em lote.',
        onConfirmar: () => {},
      })
      return
    }

    setModalNotificacao({
      aberto: true,
      tipo: 'confirmacao',
      titulo: 'Excluir seleção',
      mensagem: `Deseja excluir ${pontosSelecionados.length} item(ns) selecionado(s)?`,
      onConfirmar: async () => {
        try {
          const ids = pontosSelecionados.map((ponto) => ponto.id)
          const { error } = await supabase.from('mesas').delete().in('id', ids)
          if (error) throw error

          setIdsSelecionados([])
          await carregarPontosSalao()
        } catch (erro) {
          console.error('Erro ao excluir seleção:', erro)
        }
      },
    })
  }

  const liberarPonto = async (ponto: PontoSalao) => {
    setModalNotificacao({
      aberto: true,
      tipo: 'confirmacao',
      titulo: `Liberar ${obterTituloPonto(ponto.tipo)}`,
      mensagem: `Deseja liberar ${ponto.identificador || `${obterTituloPonto(ponto.tipo)} ${ponto.numero}`}?`,
      onConfirmar: async () => {
        setAtualizandoPonto(ponto.id)
        try {
          const { error } = await supabase
            .from('mesas')
            .update({
              status: 'livre',
              nome_cliente: null,
              ocupada_em: null,
              liberar_em: null,
              pedido_id: null,
              observacoes: null,
            })
            .eq('id', ponto.id)

          if (error) throw error

          await Promise.all([carregarPontosSalao(), carregarPedidosSalao()])
        } catch (erro) {
          console.error('Erro ao liberar ponto:', erro)
          setModalNotificacao({
            aberto: true,
            tipo: 'erro',
            titulo: 'Erro ao liberar',
            mensagem: 'Não foi possível liberar o ponto selecionado.',
            onConfirmar: () => {},
          })
        } finally {
          setAtualizandoPonto(null)
        }
      },
    })
  }

  const estenderTempoPonto = async (ponto: PontoSalao) => {
    setAtualizandoPonto(ponto.id)
    try {
      const liberarEmAtual = ponto.liberar_em ? new Date(ponto.liberar_em) : new Date()
      const novoLiberarEm = new Date(liberarEmAtual.getTime() + 30 * 60 * 1000)

      const { error } = await supabase
        .from('mesas')
        .update({ liberar_em: novoLiberarEm.toISOString() })
        .eq('id', ponto.id)

      if (error) throw error

      await carregarPontosSalao()
    } catch (erro) {
      console.error('Erro ao estender tempo:', erro)
    } finally {
      setAtualizandoPonto(null)
    }
  }

  const abrirPedidoPonto = (ponto: PontoSalao) => {
    const parametro = ponto.tipo === 'comanda' ? `comanda=${ponto.numero}` : `mesa=${ponto.numero}`
    router.push(`/admin/pedidos/novo?${parametro}`)
  }

  const abrirTicketPedido = (pedidoId: string) => {
    setPedidoTicketSelecionadoId(pedidoId)
  }

  const imprimirConferenciaPedido = async (pedido: PedidoSalao) => {
    const dadosConferencia = converterPedidoParaConferencia(pedido)
    const modeloSelecionado = montarModeloConferencia(dadosConferencia, opcaoTaxaConferencia)
    const dadosEscpos = converterConferenciaParaEscpos(dadosConferencia, opcaoTaxaConferencia)

    const itensSnapshot: ItemSnapshotImpressao[] = dadosConferencia.itens.map((item) => ({
      nome_item: item.nome,
      quantidade: item.quantidade,
      preco_unitario: Number((item.subtotal / Math.max(1, item.quantidade)).toFixed(2)),
      subtotal: item.subtotal,
      observacoes: item.observacoes || null,
      item_adicionais: (item.adicionais || []).map((adicional) => ({
        nome: adicional.nome,
        preco: Number(adicional.preco || 0),
        quantidade: Number(adicional.quantidade || 1),
      })),
    }))

    const pedidoSnapshot: PedidoSnapshotImpressao = {
      id: dadosConferencia.id,
      numero_pedido: dadosConferencia.numeroPedido || null,
      nome_cliente: dadosConferencia.nomeCliente,
      tipo_entrega: dadosConferencia.tipoEntrega,
      telefone: dadosConferencia.telefone || null,
      mesa: dadosConferencia.mesa || null,
      comanda: dadosConferencia.comanda || null,
      mesa_numero: dadosConferencia.mesa || null,
      endereco: dadosConferencia.endereco || null,
      bairro: dadosConferencia.bairro || null,
      observacoes: dadosConferencia.observacoes || null,
      subtotal: modeloSelecionado.subtotal,
      taxa_entrega: modeloSelecionado.taxaEntrega,
      taxa_servico: modeloSelecionado.taxaServico,
      total: modeloSelecionado.total,
      forma_pagamento: dadosConferencia.formaPagamento || null,
      pagamentos_divididos: (dadosConferencia.pagamentosDivididos || []).map((pagamento) => ({
        forma_pagamento: String(pagamento.forma_pagamento || ''),
        valor: Number(pagamento.valor || 0),
      })),
      troco_para: dadosConferencia.trocoPara || null,
      origem_conferencia: true,
      modo_taxa_conferencia: opcaoTaxaConferencia,
      created_at: dadosConferencia.createdAt || new Date().toISOString(),
    }

    const origem =
      opcaoTaxaConferencia === 'com_taxa'
        ? 'admin_conferencia_com_taxa'
        : 'admin_conferencia_sem_taxa'

    setImprimindoConferencia(true)
    try {
      let impressoLocal = false

      if (impressora && impressora.status === 'conectado') {
        impressoLocal = await impressora.imprimir(dadosEscpos, 'cliente')
      }

      if (impressoLocal) {
        setModalNotificacao({
          aberto: true,
          tipo: 'sucesso',
          titulo: 'Conferência impressa',
          mensagem: 'A conferência foi impressa na impressora local.',
          onConfirmar: () => {},
        })
        return
      }

      const hashEvento = gerarHashEventoImpressao(
        pedido.id,
        'cliente',
        'pedido_completo',
        itensSnapshot,
        origem
      )

      const resultadoFila = await enfileirarImpressao({
        pedidoId: pedido.id,
        tipo: 'cliente',
        escopo: 'pedido_completo',
        itensSnapshot,
        pedidoSnapshot,
        origem,
        hashEvento,
        automatico: false,
      })

      if (resultadoFila.sucesso || resultadoFila.duplicado) {
        setModalNotificacao({
          aberto: true,
          tipo: 'sucesso',
          titulo: 'Conferência enviada',
          mensagem: 'A conferência foi enviada para a fila de impressão.',
          onConfirmar: () => {},
        })
      } else {
        setModalNotificacao({
          aberto: true,
          tipo: 'erro',
          titulo: 'Falha na impressão',
          mensagem: resultadoFila.erro || 'Não foi possível enviar a conferência para impressão.',
          onConfirmar: () => {},
        })
      }
    } catch (erro) {
      console.error('Erro ao imprimir conferência:', erro)
      setModalNotificacao({
        aberto: true,
        tipo: 'erro',
        titulo: 'Falha na conferência',
        mensagem: 'Não foi possível imprimir a conferência neste momento.',
        onConfirmar: () => {},
      })
    } finally {
      setImprimindoConferencia(false)
    }
  }

  const salvarConfigTaxaServico = async () => {
    const percentual = Number(taxaServicoPercentual.replace(',', '.'))

    if (!Number.isFinite(percentual) || percentual < 0 || percentual > 100) {
      setModalNotificacao({
        aberto: true,
        tipo: 'aviso',
        titulo: 'Percentual inválido',
        mensagem: 'Informe um percentual entre 0 e 100.',
        onConfirmar: () => {},
      })
      return
    }

    setSalvandoTaxaServico(true)
    try {
      const { error } = await supabase.from('configuracoes_loja').upsert(
        [
          {
            chave: 'salao_taxa_servico_ativa',
            valor: String(taxaServicoAtiva),
            tipo: 'boolean',
            descricao: 'Controla aplicação padrão da taxa de serviço no salão',
          },
          {
            chave: 'salao_taxa_servico_percentual',
            valor: percentual.toFixed(2),
            tipo: 'number',
            descricao: 'Percentual padrão da taxa de serviço no salão',
          },
        ],
        { onConflict: 'chave' }
      )

      if (error) throw error

      setModalNotificacao({
        aberto: true,
        tipo: 'sucesso',
        titulo: 'Configuração salva',
        mensagem: 'A taxa de serviço padrão foi atualizada com sucesso.',
        onConfirmar: () => {},
      })
    } catch (erro) {
      console.error('Erro ao salvar configuração da taxa:', erro)
      setModalNotificacao({
        aberto: true,
        tipo: 'erro',
        titulo: 'Erro ao salvar',
        mensagem: 'Não foi possível salvar a configuração da taxa de serviço.',
        onConfirmar: () => {},
      })
    } finally {
      setSalvandoTaxaServico(false)
    }
  }

  const atualizarTaxaServicoPedido = async (pedido: PedidoSalao) => {
    const valorTexto = taxaServicoPorPedido[pedido.id] || '0'
    const valorTaxa = Number(valorTexto.replace(',', '.'))

    if (!Number.isFinite(valorTaxa) || valorTaxa < 0) {
      setModalNotificacao({
        aberto: true,
        tipo: 'aviso',
        titulo: 'Valor inválido',
        mensagem: 'Informe um valor de taxa de serviço válido (igual ou maior que zero).',
        onConfirmar: () => {},
      })
      return
    }

    setSalvandoTaxaPedido(pedido.id)
    try {
      const novoTotal = pedido.subtotal + pedido.taxa_entrega + valorTaxa
      const { error } = await supabase
        .from('pedidos')
        .update({
          taxa_servico: Number(valorTaxa.toFixed(2)),
          total: Number(novoTotal.toFixed(2)),
        })
        .eq('id', pedido.id)

      if (error) throw error

      await carregarPedidosSalao()
    } catch (erro) {
      console.error('Erro ao atualizar taxa do pedido:', erro)
      setModalNotificacao({
        aberto: true,
        tipo: 'erro',
        titulo: 'Falha ao atualizar taxa',
        mensagem: 'Não foi possível atualizar a taxa de serviço deste pedido.',
        onConfirmar: () => {},
      })
    } finally {
      setSalvandoTaxaPedido(null)
    }
  }

  const tituloAbaAtual = abaAtiva === 'taxa_servico' ? 'Taxa de serviço e conferência' : `${obterTituloPonto(tipoAbaAtual)}s do salão`

  if (loading) {
    return (
      <ProtectedRoute>
        <AdminLayout>
          <div className="flex h-[60vh] items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-center">
              <Loader2 strokeWidth={1.6} className="size-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Carregando gestão de salão...</p>
            </div>
          </div>
        </AdminLayout>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="space-y-6">
          <div className="flex flex-col gap-4 rounded-xl border border-border/70 bg-card p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <IconeMesa className="h-5 w-5" />
              </span>
              <div>
                <h1 className="text-xl font-semibold tracking-tight text-foreground">Gestão de Salão</h1>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Mesas e comandas com QR Code, abertura rápida e conferência em tempo real.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {abaAtiva !== 'taxa_servico' && (
                <Button type="button" onClick={() => abrirCriacaoLote(tipoAbaAtual)} className="gap-2">
                  <Plus strokeWidth={1.6} className="size-4" />
                  Criar {obterTituloPonto(tipoAbaAtual).toLowerCase()}s
                </Button>
              )}
              <Button type="button" variant="outline" onClick={() => carregarTudo()} className="gap-2">
                <RefreshCw strokeWidth={1.6} className="size-4" />
                Atualizar
              </Button>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
            <aside className="rounded-xl border border-border/70 bg-card p-2">
              {ABAS_SALAO.map((aba) => {
                const Icone = aba.icone
                const ativa = aba.id === abaAtiva

                return (
                  <button
                    key={aba.id}
                    type="button"
                    onClick={() => setAbaAtiva(aba.id)}
                    aria-current={ativa ? 'page' : undefined}
                    className={cn(
                      'w-full rounded-lg px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                      ativa
                        ? 'bg-accent text-foreground'
                        : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
                    )}
                  >
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <Icone strokeWidth={1.6} className="size-4" />
                      {aba.titulo}
                    </div>
                    <p className="mt-1 text-xs opacity-80">{aba.descricao}</p>
                  </button>
                )
              })}
            </aside>

            <section className="space-y-4">
              <div className="rounded-xl border border-border/70 bg-card p-5">
                <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="text-base font-semibold tracking-tight text-foreground">{tituloAbaAtual}</h2>
                    {abaAtiva !== 'taxa_servico' && (
                      <p className="text-sm text-muted-foreground">
                        Selecione, imprima e exporte os QR Codes para operação do salão.
                      </p>
                    )}
                  </div>

                  {abaAtiva !== 'taxa_servico' && (
                    <div className="flex flex-wrap items-center gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={selecionarTodosVisiveis}>
                        {pontosVisiveis.every((ponto) => idsSelecionadosSet.has(ponto.id))
                          ? 'Desmarcar todos'
                          : 'Selecionar todos'}
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={imprimirSelecionados} className="gap-1.5">
                        <Printer strokeWidth={1.6} className="size-3.5" />
                        Imprimir
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={exportarSelecionados} className="gap-1.5">
                        <Download strokeWidth={1.6} className="size-3.5" />
                        Exportar
                      </Button>
                      <Button type="button" variant="destructive" size="sm" onClick={excluirSelecionados} className="gap-1.5">
                        <Trash2 strokeWidth={1.6} className="size-3.5" />
                        Excluir
                      </Button>
                    </div>
                  )}
                </div>

                {abaAtiva !== 'taxa_servico' ? (
                  <>
                    <div className="mb-4 grid gap-3 sm:grid-cols-3">
                      <div className="rounded-xl border border-border/70 bg-card p-5">
                        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Total</p>
                        <p className="mt-1 font-mono text-3xl font-semibold tabular-nums tracking-tight text-foreground">{pontosVisiveis.length}</p>
                      </div>
                      <div className="rounded-xl border border-border/70 bg-card p-5">
                        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-emerald-600 dark:text-emerald-400">Livres</p>
                        <p className="mt-1 font-mono text-3xl font-semibold tabular-nums tracking-tight text-foreground">{quantidadeLivres}</p>
                      </div>
                      <div className="rounded-xl border border-border/70 bg-card p-5">
                        <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-primary">Ocupadas</p>
                        <p className="mt-1 font-mono text-3xl font-semibold tabular-nums tracking-tight text-foreground">{quantidadeOcupadas}</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {pontosVisiveis.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-border/70 p-8 text-center text-sm text-muted-foreground">
                          Nenhuma {obterTituloPonto(tipoAbaAtual).toLowerCase()} cadastrada.
                        </div>
                      ) : (
                        pontosVisiveis.map((ponto) => {
                          const ocupada = ponto.status === 'ocupada'
                          const tempo = ocupada ? calcularTempoRestante(ponto) : null
                          const pedidoAtivoPonto = ocupada ? obterPedidoAtivoDoPonto(ponto) : null

                          return (
                            <motion.article
                              key={ponto.id}
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              className={cn(
                                'rounded-xl border p-4 transition-colors',
                                ocupada
                                  ? tempo?.urgente
                                    ? 'border-destructive/30 bg-destructive/5'
                                    : 'border-primary/25 bg-primary/5'
                                  : 'border-border/70 bg-muted/20',
                              )}
                            >
                              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-3">
                                  <Checkbox
                                    checked={idsSelecionadosSet.has(ponto.id)}
                                    onCheckedChange={() => alternarSelecao(ponto.id)}
                                    aria-label={`Selecionar ${ponto.identificador || `${obterTituloPonto(ponto.tipo)} ${ponto.numero}`}`}
                                  />
                                  <div>
                                    <h4 className="text-sm font-semibold text-foreground">
                                      {ponto.identificador || `${obterTituloPonto(ponto.tipo)} ${ponto.numero}`}
                                    </h4>
                                    <p className="text-xs text-muted-foreground">
                                      Número {ponto.numero} · QR ativo
                                    </p>
                                  </div>
                                </div>
                                <span
                                  className={`rounded-full px-3 py-1 text-xs font-semibold ${ ocupada ? 'bg-primary/10 text-primary' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' }`}
                                >
                                  {ocupada ? 'Ocupada' : 'Livre'}
                                </span>
                              </div>

                              <div className="grid gap-4 md:grid-cols-[120px_minmax(0,1fr)]">
                                <div className="rounded-xl border border-border/70 bg-card p-2">
                                  <QRCodeCanvas
                                    id={`qr-${ponto.id}`}
                                    value={montarUrlQrPonto(ponto)}
                                    size={100}
                                    marginSize={1}
                                    fgColor="#0f172a"
                                    bgColor="#ffffff"
                                    className="mx-auto"
                                  />
                                </div>

                                <div className="space-y-3">
                                  <div className="grid gap-2 sm:grid-cols-2">
                                    <div className="rounded-lg border border-border/70 bg-card px-3 py-2 text-xs">
                                      <p className="text-muted-foreground">Cliente atual</p>
                                      <p className="font-semibold text-foreground">
                                        {ponto.nome_cliente || 'Sem atendimento em aberto'}
                                      </p>
                                    </div>
                                    <div className="rounded-lg border border-border/70 bg-card px-3 py-2 text-xs">
                                      <p className="text-muted-foreground">Tempo restante</p>
                                      <p className={`font-semibold ${tempo?.urgente ? 'text-destructive' : 'text-foreground'}`}>
                                        {tempo ? tempo.texto : 'Disponível'}
                                      </p>
                                    </div>
                                  </div>

                                  {ocupada && tempo && (
                                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                                      <div
                                        className={`h-full rounded-full ${tempo.urgente ? 'bg-destructive' : 'bg-primary'}`}
                                        style={{ width: `${Math.min(Math.max(tempo.porcentagem, 0), 100)}%` }}
                                      />
                                    </div>
                                  )}

                                  <div className="flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      onClick={() => abrirPedidoPonto(ponto)}
                                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-700"
                                    >
                                      <ShoppingCart className="h-3.5 w-3.5" />
                                      Novo pedido
                                    </button>

                                    {pedidoAtivoPonto && (
                                      <button
                                        type="button"
                                        onClick={() => abrirTicketPedido(pedidoAtivoPonto.id)}
                                        className="inline-flex items-center gap-1 rounded-lg border border-border/70 bg-muted px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-accent"
                                      >
                                        <Eye className="h-3.5 w-3.5" />
                                        Ticket
                                      </button>
                                    )}

                                    {ocupada && (
                                      <button
                                        type="button"
                                        onClick={() => estenderTempoPonto(ponto)}
                                        disabled={atualizandoPonto === ponto.id}
                                        className="inline-flex items-center gap-1 rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100 disabled:opacity-50 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-300"
                                      >
                                        <Timer className="h-3.5 w-3.5" />
                                       30 min
                                      </button>
                                    )}

                                    {ocupada && (
                                      <button
                                        type="button"
                                        onClick={() => liberarPonto(ponto)}
                                        disabled={atualizandoPonto === ponto.id}
                                        className="inline-flex items-center gap-1 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:opacity-50 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300"
                                      >
                                        {atualizandoPonto === ponto.id ? (
                                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                          <Trash2 className="h-3.5 w-3.5" />
                                        )}
                                        Liberar
                                      </button>
                                    )}

                                    <button
                                      type="button"
                                      onClick={() => abrirEdicaoPonto(ponto)}
                                      className="inline-flex items-center gap-1 rounded-lg border border-border/70 bg-muted px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-accent"
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                      Editar
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => exportarQrPng(ponto)}
                                      className="inline-flex items-center gap-1 rounded-lg border border-border/70 bg-muted px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-accent"
                                    >
                                      <Download className="h-3.5 w-3.5" />
                                      PNG
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => excluirPonto(ponto)}
                                      className="inline-flex items-center gap-1 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300"
                                    >
                                      <X className="h-3.5 w-3.5" />
                                      Excluir
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </motion.article>
                          )
                        })
                      )}
                    </div>
                  </>
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-border/70 bg-muted/30 p-4">
                      <h4 className="text-sm font-bold text-foreground">Padrão da taxa de serviço</h4>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Esse padrão é aplicado automaticamente em novos pedidos de salão.
                      </p>

                      <div className="mt-4 grid gap-3 sm:grid-cols-3">
                        <label className="sm:col-span-1 flex items-center gap-2 rounded-lg border border-border/70 bg-card px-3 py-2 text-sm">
                          <input
                            type="checkbox"
                            checked={taxaServicoAtiva}
                            onChange={(evento) => setTaxaServicoAtiva(evento.target.checked)}
                            className="h-4 w-4 rounded border-border text-primary focus:ring-ring"
                          />
                          Aplicar por padrão
                        </label>

                        <div className="sm:col-span-1 rounded-lg border border-border/70 bg-card px-3 py-2">
                          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Percentual
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              step={0.1}
                              value={taxaServicoPercentual}
                              onChange={(evento) => setTaxaServicoPercentual(evento.target.value)}
                              className="w-full rounded-md border border-border/70 bg-muted/40 px-2 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none"
                            />
                            <span className="text-sm font-semibold text-muted-foreground">%</span>
                          </div>
                        </div>

                        <div className="sm:col-span-1 flex items-end">
                          <button
                            type="button"
                            onClick={salvarConfigTaxaServico}
                            disabled={salvandoTaxaServico}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
                          >
                            {salvandoTaxaServico ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            Salvar padrão
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-border/70 bg-muted/30 p-4">
                      <h4 className="text-sm font-bold text-foreground">Conferência em tempo real • Pedidos salão</h4>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Ajuste taxa de serviço por pedido e mantenha o ticket atualizado para impressão/conferência.
                      </p>

                      <div className="mt-4 space-y-3">
                        {pedidosSalao.length === 0 ? (
                          <div className="rounded-lg border border-dashed border-border/70 p-6 text-center text-sm text-muted-foreground">
                            Nenhum pedido de salão ativo no momento.
                          </div>
                        ) : (
                          pedidosSalao.map((pedido) => {
                            const identificadorAtendimento = pedido.comanda
                              ? `Comanda ${pedido.comanda}`
                              : pedido.mesa
                                ? `Mesa ${pedido.mesa}`
                                : 'Salão'

                            return (
                              <article key={pedido.id} className="rounded-xl border border-border/70 bg-card p-4">
                                <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                                  <div>
                                    <h5 className="text-sm font-bold text-foreground">
                                      {identificadorAtendimento} • {pedido.nome_cliente}
                                    </h5>
                                    <p className="text-xs text-muted-foreground">
                                      Pedido #{pedido.id.slice(0, 8).toUpperCase()} • {format(new Date(pedido.created_at), 'dd/MM HH:mm', { locale: ptBR })}
                                    </p>
                                  </div>
                                  <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-foreground">
                                    {pedido.status}
                                  </span>
                                </div>

                                <div className="grid gap-3 border-t border-border/70 pt-3 sm:grid-cols-[1fr_auto]">
                                  <div className="space-y-1 text-xs">
                                    <div className="flex items-center justify-between text-muted-foreground">
                                      <span>Itens</span>
                                      <span className="font-semibold text-foreground">{pedido.itens_pedido.length}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-muted-foreground">
                                      <span>Subtotal</span>
                                      <span className="font-semibold text-foreground">{formatarMoeda(pedido.subtotal)}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-muted-foreground">
                                      <span>Taxa serviço</span>
                                      <span className="font-semibold text-foreground">{formatarMoeda(pedido.taxa_servico)}</span>
                                    </div>
                                    <div className="flex items-center justify-between border-t border-border/70 pt-1 text-sm font-bold text-foreground">
                                      <span>Total</span>
                                      <span>{formatarMoeda(pedido.total)}</span>
                                    </div>
                                  </div>

                                  <div className="flex items-end">
                                    <button
                                      type="button"
                                      onClick={() => abrirTicketPedido(pedido.id)}
                                      className="inline-flex items-center gap-2 rounded-lg border border-border/70 bg-muted px-3 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-accent"
                                    >
                                      <Eye className="h-3.5 w-3.5" />
                                      Abrir ticket
                                    </button>
                                  </div>
                                </div>
                              </article>
                            )
                          })
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>

        <AnimatePresence>
          {pedidoTicketSelecionado &&
            modeloConferenciaComTaxa &&
            modeloConferenciaSemTaxa &&
            modeloConferenciaSelecionado && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setPedidoTicketSelecionadoId(null)}
                  className="fixed inset-0 z-[9998] bg-black/55 backdrop-blur-sm"
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.96, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: 8 }}
                  className="fixed inset-0 z-[9999] flex items-start justify-center overflow-y-auto p-3 sm:items-center sm:p-4"
                >
                  <div
                    role="dialog"
                    aria-modal="true"
                    className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-6xl flex-col rounded-2xl border border-border/70 bg-card shadow-[0_8px_32px_-12px_rgba(15,23,42,0.12)] sm:max-h-[calc(100dvh-2rem)]"
                  >
                    <div className="flex shrink-0 items-start justify-between border-b border-border/70 px-4 py-3 sm:px-5 sm:py-4">
                      <div>
                        <h3 className="text-xl font-bold text-foreground">
                          Imprimir conferência
                        </h3>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {pedidoTicketSelecionado.comanda
                            ? `Comanda ${pedidoTicketSelecionado.comanda}`
                            : pedidoTicketSelecionado.mesa
                              ? `Mesa ${pedidoTicketSelecionado.mesa}`
                              : 'Salão'}{' '}
                          • Pedido #{pedidoTicketSelecionado.id.slice(0, 8).toUpperCase()} •{' '}
                          {format(new Date(pedidoTicketSelecionado.created_at), 'dd/MM HH:mm', { locale: ptBR })}
                        </p>
                      </div>
                      <button
                        ref={botaoFecharConferenciaRef}
                        type="button"
                        onClick={() => setPedidoTicketSelecionadoId(null)}
                        className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent min-h-[44px] min-w-[44px] flex items-center justify-center"
                        aria-label="Fechar conferência"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>

                    <div className="overflow-y-auto p-4 sm:p-5">
                      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                        <div className="space-y-4">
                          <p className="text-sm text-muted-foreground">
                            Escolha a versão do ticket para conferência e impressão. A opção sem taxa altera apenas esta impressão.
                          </p>

                          <div className="grid gap-3 lg:grid-cols-2">
                          <button
                            type="button"
                            role="radio"
                            aria-checked={opcaoTaxaConferencia === 'com_taxa'}
                            onClick={() => setOpcaoTaxaConferencia('com_taxa')}
                            className={`rounded-xl border p-3 text-left transition-colors ${ opcaoTaxaConferencia === 'com_taxa' ? 'border-primary bg-primary/10' : 'border-border/70 bg-muted/40 hover:bg-accent' }`}
                          >
                            <div className="mb-3 flex items-center gap-2">
                              <span
                                className={`h-5 w-5 rounded-full border-2 ${ opcaoTaxaConferencia === 'com_taxa' ? 'border-primary bg-primary' : 'border-muted-foreground/50 bg-transparent' }`}
                              />
                              <span className="text-base font-semibold text-foreground">
                                Com taxa de serviço
                              </span>
                            </div>
                            <div className="max-h-[260px] overflow-auto rounded-lg border border-dashed border-border/70 bg-muted/40 p-3 sm:max-h-[440px]">
                              <pre className="whitespace-pre font-mono text-[11px] leading-[1.3] text-foreground">
                                {modeloConferenciaComTaxa.linhasTicket.join('\n')}
                              </pre>
                            </div>
                          </button>

                          <button
                            type="button"
                            role="radio"
                            aria-checked={opcaoTaxaConferencia === 'sem_taxa'}
                            onClick={() => setOpcaoTaxaConferencia('sem_taxa')}
                            className={`rounded-xl border p-3 text-left transition-colors ${ opcaoTaxaConferencia === 'sem_taxa' ? 'border-primary bg-primary/10' : 'border-border/70 bg-muted/40 hover:bg-accent' }`}
                          >
                            <div className="mb-3 flex items-center gap-2">
                              <span
                                className={`h-5 w-5 rounded-full border-2 ${ opcaoTaxaConferencia === 'sem_taxa' ? 'border-primary bg-primary' : 'border-muted-foreground/50 bg-transparent' }`}
                              />
                              <span className="text-base font-semibold text-foreground">
                                Sem taxa de serviço
                              </span>
                            </div>
                            <div className="max-h-[260px] overflow-auto rounded-lg border border-dashed border-border/70 bg-muted/40 p-3 sm:max-h-[440px]">
                              <pre className="whitespace-pre font-mono text-[11px] leading-[1.3] text-foreground">
                                {modeloConferenciaSemTaxa.linhasTicket.join('\n')}
                              </pre>
                            </div>
                          </button>
                          </div>
                        </div>

                        <aside className="space-y-3">
                          <div className="rounded-xl border border-border/70 bg-muted/30 p-3 text-sm">
                            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Resumo da variante selecionada
                            </p>
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-muted-foreground">
                                <span>Itens</span>
                                <span className="font-semibold text-foreground">{modeloConferenciaSelecionado.totalItens}</span>
                              </div>
                              <div className="flex items-center justify-between text-muted-foreground">
                                <span>Subtotal</span>
                                <span className="font-semibold text-foreground">{formatarMoeda(modeloConferenciaSelecionado.subtotal)}</span>
                              </div>
                              {modeloConferenciaSelecionado.taxaEntrega > 0 && (
                                <div className="flex items-center justify-between text-muted-foreground">
                                  <span>Taxa de entrega</span>
                                  <span className="font-semibold text-foreground">{formatarMoeda(modeloConferenciaSelecionado.taxaEntrega)}</span>
                                </div>
                              )}
                              <div className="flex items-center justify-between text-muted-foreground">
                                <span>Taxa de serviço</span>
                                <span className="font-semibold text-foreground">{formatarMoeda(modeloConferenciaSelecionado.taxaServico)}</span>
                              </div>
                              <div className="flex items-center justify-between border-t border-border/70 pt-2 text-base font-bold text-foreground">
                                <span>Total</span>
                                <span>{formatarMoeda(modeloConferenciaSelecionado.total)}</span>
                              </div>
                            </div>
                          </div>

                          <div className="rounded-xl border border-border/70 bg-card p-3">
                            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                              Ajustar taxa de serviço no pedido (R$)
                            </label>
                            <input
                              type="number"
                              min={0}
                              step={0.01}
                              value={taxaServicoPorPedido[pedidoTicketSelecionado.id] || '0'}
                              onChange={(evento) =>
                                setTaxaServicoPorPedido((estadoAnterior) => ({
                                  ...estadoAnterior,
                                  [pedidoTicketSelecionado.id]: evento.target.value,
                                }))
                              }
                              className="w-full rounded-lg border border-border/70 bg-muted/40 px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                            />

                            <button
                              type="button"
                              onClick={() => atualizarTaxaServicoPedido(pedidoTicketSelecionado)}
                              disabled={salvandoTaxaPedido === pedidoTicketSelecionado.id}
                              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
                            >
                              {salvandoTaxaPedido === pedidoTicketSelecionado.id ? (
                                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Save className="h-3.5 w-3.5" />
                              )}
                              Salvar taxa no pedido
                            </button>
                          </div>
                        </aside>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-border/70 px-4 py-3 sm:flex-row sm:justify-end sm:px-5 sm:py-4">
                      <button
                        type="button"
                        onClick={() => setPedidoTicketSelecionadoId(null)}
                        className="inline-flex items-center justify-center rounded-lg border border-border/70 px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
                      >
                        Fechar
                      </button>
                      <button
                        type="button"
                        onClick={() => imprimirConferenciaPedido(pedidoTicketSelecionado)}
                        disabled={imprimindoConferencia}
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
                      >
                        {imprimindoConferencia ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <Printer className="h-4 w-4" />
                        )}
                        {imprimindoConferencia ? 'Imprimindo...' : 'Imprimir conferência'}
                      </button>
                    </div>
                  </div>
                </motion.div>
              </>
            )}
        </AnimatePresence>

        <AnimatePresence>
          {modalCriarLote.aberto && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setModalCriarLote({ ...modalCriarLote, aberto: false })}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9998]"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4"
              >
                <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-border/70 bg-card p-5 sm:p-6 shadow-[0_8px_32px_-12px_rgba(15,23,42,0.12)]" onClick={(e) => e.stopPropagation()}>
                  <div className="mb-5 flex items-center justify-between">
                    <h3 className="text-lg font-bold text-foreground">
                      Criar lote de {obterTituloPonto(modalCriarLote.tipo).toLowerCase()}s
                    </h3>
                    <button
                      type="button"
                      onClick={() => setModalCriarLote({ ...modalCriarLote, aberto: false })}
                      className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent min-h-[44px] min-w-[44px] flex items-center justify-center"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-foreground">Número inicial</label>
                      <input
                        type="number"
                        min={1}
                        value={numeroInicialLote}
                        onChange={(evento) => setNumeroInicialLote(evento.target.value)}
                        className="w-full rounded-xl border border-border/70 bg-muted/40 px-3 py-2.5 text-foreground focus:border-primary focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-foreground">Quantidade</label>
                      <input
                        type="number"
                        min={1}
                        max={200}
                        value={quantidadeLote}
                        onChange={(evento) => setQuantidadeLote(evento.target.value)}
                        className="w-full rounded-xl border border-border/70 bg-muted/40 px-3 py-2.5 text-foreground focus:border-primary focus:outline-none"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={criarLote}
                      disabled={criandoLote}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
                    >
                      {criandoLote ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      Criar lote
                    </button>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {modalEditarPonto.aberto && modalEditarPonto.ponto && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setModalEditarPonto({ aberto: false, ponto: null, numero: '', identificador: '' })}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9998]"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4"
              >
                <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-border/70 bg-card p-5 sm:p-6 shadow-[0_8px_32px_-12px_rgba(15,23,42,0.12)]" onClick={(e) => e.stopPropagation()}>
                  <div className="mb-5 flex items-center justify-between">
                    <h3 className="text-lg font-bold text-foreground">Editar {obterTituloPonto(modalEditarPonto.ponto.tipo)}</h3>
                    <button
                      type="button"
                      onClick={() => setModalEditarPonto({ aberto: false, ponto: null, numero: '', identificador: '' })}
                      className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent min-h-[44px] min-w-[44px] flex items-center justify-center"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-foreground">Número</label>
                      <input
                        type="number"
                        min={1}
                        value={modalEditarPonto.numero}
                        onChange={(evento) =>
                          setModalEditarPonto((estadoAnterior) => ({
                            ...estadoAnterior,
                            numero: evento.target.value,
                          }))
                        }
                        className="w-full rounded-xl border border-border/70 bg-muted/40 px-3 py-2.5 text-foreground focus:border-primary focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-foreground">Identificador exibido</label>
                      <input
                        type="text"
                        value={modalEditarPonto.identificador}
                        onChange={(evento) =>
                          setModalEditarPonto((estadoAnterior) => ({
                            ...estadoAnterior,
                            identificador: evento.target.value,
                          }))
                        }
                        className="w-full rounded-xl border border-border/70 bg-muted/40 px-3 py-2.5 text-foreground focus:border-primary focus:outline-none"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={salvarEdicaoPonto}
                      disabled={salvandoEdicao}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
                    >
                      {salvandoEdicao ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Salvar alterações
                    </button>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        <ModalNotificacao
          aberto={modalNotificacao.aberto}
          tipo={modalNotificacao.tipo}
          titulo={modalNotificacao.titulo}
          mensagem={modalNotificacao.mensagem}
          onFechar={() => setModalNotificacao({ ...modalNotificacao, aberto: false })}
          onConfirmar={modalNotificacao.onConfirmar}
          textoBotaoConfirmar="Confirmar"
          textoBotaoCancelar="Cancelar"
        />
      </AdminLayout>
    </ProtectedRoute>
  )
}
