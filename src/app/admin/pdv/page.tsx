'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Banknote,
  Check,
  CircleDollarSign,
  Clock3,
  CreditCard,
  Loader2,
  LogOut,
  Maximize2,
  Minus,
  MoreHorizontal,
  PackagePlus,
  Plus,
  Power,
  Printer,
  QrCode,
  ReceiptText,
  RefreshCw,
  RotateCcw,
  Search,
  ShoppingCart,
  Store,
  Trash2,
  UserRound,
  UsersRound,
  Wallet,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { TEMPO_PADRAO_MESA_MINUTOS, calcularLiberacaoMesa } from '@/lib/mesas-tempo'
import {
  limparSessao,
  listarUsuariosSistema,
  loginUsuarioSistema,
  obterSessao,
  salvarSessao,
  type UsuarioSistema,
} from '@/lib/autenticacao'
import {
  enfileirarImpressao,
  gerarHashEventoImpressao,
  type ItemSnapshotImpressao,
  type PedidoSnapshotImpressao,
} from '@/lib/filaImpressao'
import {
  buscarProximoNumeroPedidoDiario,
  sincronizarNumeroPedidoDiario,
} from '@/lib/pedidos/numero-diario'
import { nomeClienteParaPedido, nomeClienteParaPontoSalao, nomeClientePessoalValido } from '@/lib/nome-cliente-local.mjs'
import { carregarGarconsPorIds } from '@/lib/pedidos-utils'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import CardPedido, { type Pedido } from '@/components/admin/CardPedido'
import ModalDetalhesPedido from '@/components/admin/ModalDetalhesPedido'
import ModalEditarPedido from '@/components/admin/ModalEditarPedido'
import PainelSalaoAtual from '@/features/salao/components/PainelSalaoAtual'
import CardPerfilUsuario from '@/components/login/CardPerfilUsuario'
import ModalSenhaLogin from '@/components/login/ModalSenhaLogin'
import TransicaoLogin from '@/components/login/TransicaoLogin'


type TipoCatalogo = 'produto' | 'bebida' | 'combo'
type TipoAtendimento = 'balcao' | 'salao' | 'retirada'
type TipoPontoSalao = 'mesa' | 'comanda' | 'local_externo'
type FormaPagamento = 'dinheiro' | 'pix' | 'debito' | 'credito' | 'crediario'

type ItemCatalogo = {
  id: string
  nome: string
  preco: number
  categoria: string
  tipo: TipoCatalogo
}

type ItemCarrinho = {
  localId: string
  catalogoId: string
  tipo: TipoCatalogo
  nome: string
  preco: number
  quantidade: number
  observacoes: string
  descontoManualInput: string
  criadoEm: string
}

type PagamentoParcialLocal = {
  id: string
  itemLocalId: string
  forma: Exclude<FormaPagamento, 'crediario'>
  quantidade: number
  valorUnitario: number
  valorTotal: number
  criadoEm: string
}

type MesaPdv = {
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

type ClientePdv = {
  id: string
  nome: string | null
  telefone: string
  endereco: string | null
  bairro: string | null
}

type ItemFinalizado = ItemCarrinho & {
  itemPedidoId: string
}

type PedidoFinalizado = {
  id: string
  numero: number | null
  nomeCliente: string
  total: number
  itens: ItemFinalizado[]
}

type PedidoDia = {
  id: string
  numero_pedido: number | null
  nome_cliente: string
  telefone?: string | null
  endereco?: string | null
  bairro?: string | null
  total: number
  subtotal?: number | null
  subtotal_original?: number | null
  desconto_itens_total?: number | null
  desconto_manual?: number | null
  total_original?: number | null
  taxa_entrega?: number | null
  taxa_servico?: number | null
  status: string | null
  tipo_entrega: string | null
  forma_pagamento: string | null
  pagamento_online?: boolean | null
  pagamento_online_status?: string | null
  mesa: number | null
  comanda: number | null
  mesa_id?: string | null
  mesa_identificador?: string | null
  mesa_tipo?: string | null
  garcom_id?: string | null
  nome_garcom?: string | null
  troco_para?: number | null
  observacoes?: string | null
  created_at: string
  itens_pedido?: Array<{
    id?: string | null
    nome_item: string
    quantidade: number | null
    preco_unitario?: number | null
    subtotal?: number | null
    desconto_manual?: number | null
    observacoes?: string | null
    created_at?: string | null
    adicionado_por_garcom_id?: string | null
    nome_garcom?: string | null
  }> | null
  atividades_garcom?: Array<{
    id: string
    garcom_id: string
    tipo_acao: string
    pedido_id: string | null
    item_pedido_id: string | null
    descricao: string | null
    created_at: string | null
    nome_garcom?: string | null
  }> | null
}

const FORMAS_PAGAMENTO: Array<{
  id: FormaPagamento
  label: string
  banco: string
  icon: typeof Banknote
  classe: string
}> = [
  { id: 'dinheiro', label: 'Dinheiro', banco: 'dinheiro', icon: Banknote, classe: 'bg-primary text-primary-foreground hover:bg-primary/90' },
  { id: 'pix', label: 'PIX', banco: 'pix', icon: QrCode, classe: 'bg-primary text-primary-foreground hover:bg-primary/90' },
  { id: 'debito', label: 'Débito', banco: 'debito', icon: CreditCard, classe: 'bg-primary text-primary-foreground hover:bg-primary/90' },
  { id: 'credito', label: 'Crédito', banco: 'credito', icon: CreditCard, classe: 'bg-primary text-primary-foreground hover:bg-primary/90' },
  { id: 'crediario', label: 'Crediário', banco: 'crediario', icon: Wallet, classe: 'bg-destructive text-destructive-foreground hover:bg-destructive/90' },
]

const TIPOS_ATENDIMENTO: Array<{
  id: TipoAtendimento
  label: string
  icon: typeof Store
}> = [
  { id: 'balcao', label: 'Balcão', icon: Store },
  { id: 'salao', label: 'Mesa', icon: UsersRound },
  { id: 'retirada', label: 'Retirada', icon: PackagePlus },
]

const categoriasPrioritarias = ['combos', 'lanches', 'bebidas', 'restaurante', 'sobremesas']

const pdvShellClassName = [
  'min-h-dvh overflow-hidden bg-background text-foreground',
  '[&_button]:focus-visible:ring-ring',
].join(' ')

const pdvCommandClassName = [
  'rounded-lg border border-border/70 bg-card text-card-foreground shadow-[0_8px_32px_-12px_rgba(15,23,42,0.12)]',
  '[&_[cmdk-input-wrapper]]:border-border/70 [&_[cmdk-input-wrapper]]:bg-card',
  '[&_[cmdk-input]]:h-12 [&_[cmdk-input]]:text-foreground [&_[cmdk-input]]:placeholder:text-muted-foreground',
  '[&_[cmdk-group]]:bg-card [&_[cmdk-list]]:bg-card',
  '[&_[cmdk-item]]:my-1 [&_[cmdk-item]]:rounded-md [&_[cmdk-item]]:px-3 [&_[cmdk-item]]:py-3',
  '[&_[cmdk-item]]:text-foreground [&_[cmdk-item][data-selected=true]]:bg-accent',
  '[&_[cmdk-item][data-selected=true]]:text-accent-foreground',
].join(' ')

const pdvOutlineButtonClassName =
  'border border-border/70 bg-card text-foreground shadow-none hover:bg-accent hover:text-accent-foreground'

const formatarMoeda = (valor: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0)

const paraNumeroMonetario = (valor: string) => {
  const normalizado = valor.replace(',', '.').trim()
  if (!normalizado) return 0
  const numero = Number(normalizado)
  if (!Number.isFinite(numero) || numero < 0) return 0
  return numero
}

const gerarIdLocal = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const normalizarTextoBusca = (valor: string) =>
  valor
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

const digitosTelefone = (valor: string) => valor.replace(/\D/g, '')

const labelPontoSalao = (mesa: MesaPdv) => {
  if (mesa.tipo === 'local_externo') return mesa.identificador || `Parceiro ${mesa.numero}`
  if (mesa.tipo === 'comanda') return `Comanda ${mesa.numero}`
  return `Mesa ${mesa.numero}`
}


const obterForma = (id: FormaPagamento) => FORMAS_PAGAMENTO.find((forma) => forma.id === id) || FORMAS_PAGAMENTO[0]

const obterIntervaloDiaOperacional = () => {
  const inicio = new Date()
  if (inicio.getHours() < 3) inicio.setDate(inicio.getDate() - 1)
  inicio.setHours(3, 0, 0, 0)
  const fim = new Date(inicio)
  fim.setDate(fim.getDate() + 1)
  return { inicio, fim }
}

const pedidoTemPagamentoPendente = (pedido: PedidoDia) =>
  Boolean(pedido.pagamento_online) && pedido.pagamento_online_status !== 'pago'

const pedidoEstaEncerrado = (status?: string | null) =>
  ['entregue', 'cancelado'].includes(String(status || '').toLowerCase())

type ConfirmacaoPdv = {
  aberto: boolean
  titulo: string
  mensagem: string
  textoConfirmar: string
  variante: 'perigo' | 'padrao'
  onConfirmar: () => Promise<void>
}

export default function PdvAdminPage() {
  const router = useRouter()
  const buscaClienteTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [usuario, setUsuario] = useState<UsuarioSistema | null>(null)
  const [autenticando, setAutenticando] = useState(true)
  const [usuariosLogin, setUsuariosLogin] = useState<UsuarioSistema[]>([])
  const [carregandoUsuariosLogin, setCarregandoUsuariosLogin] = useState(false)
  const [usuarioLoginSelecionado, setUsuarioLoginSelecionado] = useState<UsuarioSistema | null>(null)
  const [modalSenhaAberto, setModalSenhaAberto] = useState(false)
  const [erroLogin, setErroLogin] = useState('')
  const [loginEmAndamento, setLoginEmAndamento] = useState(false)
  const [transicaoLoginAtiva, setTransicaoLoginAtiva] = useState(false)
  const [usuarioAutenticado, setUsuarioAutenticado] = useState<UsuarioSistema | null>(null)

  const [catalogo, setCatalogo] = useState<ItemCatalogo[]>([])
  const [loadingCatalogo, setLoadingCatalogo] = useState(true)
  const [buscaProduto, setBuscaProduto] = useState('')
  const [categoriaAtiva, setCategoriaAtiva] = useState('todos')
  const [categoriaDialogAberto, setCategoriaDialogAberto] = useState(false)
  const [mesaDialogAberto, setMesaDialogAberto] = useState(false)
  const buscaProdutoRef = useRef<HTMLInputElement | null>(null)

  const [mesas, setMesas] = useState<MesaPdv[]>([])
  const [loadingMesas, setLoadingMesas] = useState(true)
  const [atualizandoPontoSalao, setAtualizandoPontoSalao] = useState<string | null>(null)
  const [tipoAtendimento, setTipoAtendimento] = useState<TipoAtendimento>('balcao')
  const [tipoPontoSalao, setTipoPontoSalao] = useState<TipoPontoSalao>('mesa')
  const [mesaSelecionada, setMesaSelecionada] = useState<MesaPdv | null>(null)

  const [clienteSelecionado, setClienteSelecionado] = useState<ClientePdv | null>(null)
  const [clientesEncontrados, setClientesEncontrados] = useState<ClientePdv[]>([])
  const [buscandoClientes, setBuscandoClientes] = useState(false)
  const [buscaCliente, setBuscaCliente] = useState('')
  const [nomeCliente, setNomeCliente] = useState('')
  const [telefoneCliente, setTelefoneCliente] = useState('')

  const [itens, setItens] = useState<ItemCarrinho[]>([])
  const [itemEditorLocalId, setItemEditorLocalId] = useState<string | null>(null)
  const [pagamentosParciais, setPagamentosParciais] = useState<PagamentoParcialLocal[]>([])
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento>('dinheiro')
  const [observacoesPedido, setObservacoesPedido] = useState('')
  const [descontoPedidoInput, setDescontoPedidoInput] = useState('')
  const [imprimirAutomatico, setImprimirAutomatico] = useState(true)
  const [pdvAtivo, setPdvAtivo] = useState(true)
  const [fullscreenAtivo, setFullscreenAtivo] = useState(false)
  const [abaAtiva, setAbaAtiva] = useState('venda')
  const [salvando, setSalvando] = useState(false)
  const [pedidoFinalizado, setPedidoFinalizado] = useState<PedidoFinalizado | null>(null)
  const [pedidoDetalhesId, setPedidoDetalhesId] = useState<string | null>(null)
  const [modalDetalhesAberto, setModalDetalhesAberto] = useState(false)
  const [pedidoEdicao, setPedidoEdicao] = useState<Pedido | null>(null)
  const [modalEditarAberto, setModalEditarAberto] = useState(false)
  const [pedidosDia, setPedidosDia] = useState<PedidoDia[]>([])
  const [loadingPedidosDia, setLoadingPedidosDia] = useState(false)
  const [buscaPedidosDia, setBuscaPedidosDia] = useState('')
  const [acoesPedido, setAcoesPedido] = useState<Record<string, Partial<Record<'pagamento' | 'impressao' | 'concluir' | 'excluir', boolean>>>>({})
  const [confirmacaoPdv, setConfirmacaoPdv] = useState<ConfirmacaoPdv | null>(null)

  useEffect(() => {
    const sessao = obterSessao()
    if (sessao && (sessao.papel === 'admin' || sessao.papel === 'garcom')) {
      setUsuario(sessao)
      setAutenticando(false)
      return
    }

    setAutenticando(false)
  }, [])

  const carregarUsuariosLogin = useCallback(async () => {
    setCarregandoUsuariosLogin(true)
    try {
      const lista = await listarUsuariosSistema()
      setUsuariosLogin(lista.filter((item) => item.papel === 'admin' || item.papel === 'garcom'))
    } finally {
      setCarregandoUsuariosLogin(false)
    }
  }, [])

  useEffect(() => {
    if (!autenticando && !usuario) {
      void carregarUsuariosLogin()
    }
  }, [autenticando, usuario, carregarUsuariosLogin])

  useEffect(() => {
    const preferencia = localStorage.getItem('admin_pdv_ativo')
    if (preferencia === '0') setPdvAtivo(false)
  }, [])

  const solicitarFullscreen = useCallback(async (silencioso = false) => {
    if (typeof document === 'undefined') return false
    if (document.fullscreenElement) {
      setFullscreenAtivo(true)
      return true
    }

    try {
      await document.documentElement.requestFullscreen()
      setFullscreenAtivo(true)
      return true
    } catch (erro) {
      if (!silencioso) {
        toast.warning('O navegador bloqueou a tela cheia. Toque em "PDV ligado" para habilitar.')
      }
      return false
    }
  }, [])

  const sairFullscreen = useCallback(async () => {
    if (typeof document === 'undefined' || !document.fullscreenElement) {
      setFullscreenAtivo(false)
      return
    }

    try {
      await document.exitFullscreen()
    } finally {
      setFullscreenAtivo(false)
    }
  }, [])

  useEffect(() => {
    const atualizar = () => setFullscreenAtivo(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', atualizar)
    atualizar()
    return () => document.removeEventListener('fullscreenchange', atualizar)
  }, [])

  const alternarModoPdv = async () => {
    const proximo = !pdvAtivo
    setPdvAtivo(proximo)
    localStorage.setItem('admin_pdv_ativo', proximo ? '1' : '0')

    if (proximo) {
      await solicitarFullscreen(false)
      return
    }

    await sairFullscreen()
  }

  const carregarCatalogo = useCallback(async () => {
    setLoadingCatalogo(true)
    try {
      const [produtosRes, bebidasRes, combosRes] = await Promise.all([
        supabase
          .from('produtos')
          .select('id, nome, preco, categoria, ordem')
          .eq('disponivel', true)
          .order('ordem', { ascending: true })
          .order('nome', { ascending: true }),
        supabase
          .from('bebidas')
          .select('id, nome, preco, categoria, ordem')
          .eq('disponivel', true)
          .order('ordem', { ascending: true })
          .order('nome', { ascending: true }),
        supabase
          .from('combos')
          .select('id, nome, preco, ordem')
          .eq('disponivel', true)
          .order('ordem', { ascending: true })
          .order('nome', { ascending: true }),
      ])

      if (produtosRes.error) throw produtosRes.error
      if (bebidasRes.error) throw bebidasRes.error
      if (combosRes.error) throw combosRes.error

      const produtos = (produtosRes.data || []).map((item) => ({
        id: item.id,
        nome: item.nome,
        preco: Number(item.preco || 0),
        categoria: item.categoria || 'Lanches',
        tipo: 'produto' as TipoCatalogo,
      }))
      const bebidas = (bebidasRes.data || []).map((item) => ({
        id: item.id,
        nome: item.nome,
        preco: Number(item.preco || 0),
        categoria: item.categoria || 'Bebidas',
        tipo: 'bebida' as TipoCatalogo,
      }))
      const combos = (combosRes.data || []).map((item) => ({
        id: item.id,
        nome: item.nome,
        preco: Number(item.preco || 0),
        categoria: 'Combos',
        tipo: 'combo' as TipoCatalogo,
      }))

      setCatalogo([...combos, ...produtos, ...bebidas])
    } catch (erro) {
      console.error('[PDV] Erro ao carregar catálogo:', erro)
      toast.error('Não foi possível carregar os produtos do PDV.')
    } finally {
      setLoadingCatalogo(false)
    }
  }, [])

  const carregarMesas = useCallback(async () => {
    setLoadingMesas(true)
    try {
      await supabase.rpc('limpar_mesas_expiradas')

      const { data, error } = await supabase
        .from('mesas')
        .select('id, numero, tipo, status, nome_cliente, ocupada_em, liberar_em, tempo_limite_minutos, pedido_id, codigo_qr, identificador, updated_at')
        .in('tipo', ['mesa', 'comanda', 'local_externo'])
        .order('tipo', { ascending: true })
        .order('numero', { ascending: true })

      if (error) throw error
      setMesas((data || []).map((mesa) => ({
        id: mesa.id,
        numero: Number(mesa.numero),
        tipo: mesa.tipo === 'comanda' ? 'comanda' : mesa.tipo === 'local_externo' ? 'local_externo' : 'mesa',
        status: mesa.status === 'ocupada' ? 'ocupada' : 'livre',
        nome_cliente: mesa.nome_cliente,
        ocupada_em: mesa.ocupada_em || null,
        liberar_em: mesa.liberar_em || null,
        tempo_limite_minutos: mesa.tempo_limite_minutos === null || mesa.tempo_limite_minutos === undefined ? null : Number(mesa.tempo_limite_minutos),
        pedido_id: mesa.pedido_id || null,
        codigo_qr: mesa.codigo_qr || '',
        identificador: mesa.identificador,
        updated_at: mesa.updated_at || new Date().toISOString(),
      })))
    } catch (erro) {
      console.error('[PDV] Erro ao carregar salão:', erro)
      toast.error('Não foi possível carregar salão e parceiros.')
    } finally {
      setLoadingMesas(false)
    }
  }, [])

  const carregarPedidosDia = useCallback(async () => {
    setLoadingPedidosDia(true)
    try {
      const { inicio, fim } = obterIntervaloDiaOperacional()
      const { data, error } = await supabase
        .from('pedidos')
        .select('id, numero_pedido, nome_cliente, telefone, endereco, bairro, subtotal_original, subtotal, desconto_itens_total, desconto_manual, taxa_entrega, taxa_servico, total_original, total, status, tipo_entrega, forma_pagamento, pagamento_online, pagamento_online_status, troco_para, mesa, comanda, mesa_id, garcom_id, observacoes, created_at, mesa_dados:mesas!pedidos_mesa_id_fkey(identificador, tipo), itens_pedido(id, nome_item, quantidade, preco_unitario, subtotal, desconto_manual, observacoes, created_at, adicionado_por_garcom_id)')
        .gte('created_at', inicio.toISOString())
        .lt('created_at', fim.toISOString())
        .order('created_at', { ascending: false })
        .limit(120)

      if (error) throw error
      const registros = data || []
      const idsResponsaveis = Array.from(
        new Set(registros.map((pedido) => pedido.garcom_id).filter(Boolean).map((id) => String(id))),
      )
      const nomesResponsaveis = await carregarGarconsPorIds(idsResponsaveis)

      setPedidosDia(registros.map((pedido) => {
        const responsavelId = pedido.garcom_id ? String(pedido.garcom_id) : null

        return {
          ...pedido,
          mesa_identificador: (pedido as { mesa_dados?: { identificador?: string | null } | null }).mesa_dados?.identificador ?? null,
          mesa_tipo: (pedido as { mesa_dados?: { tipo?: string | null } | null }).mesa_dados?.tipo ?? null,
          nome_garcom: responsavelId ? nomesResponsaveis.get(responsavelId) || null : null,
          atividades_garcom: [],
          total: Number(pedido.total || 0),
          subtotal: Number(pedido.subtotal || 0),
          subtotal_original: Number(pedido.subtotal_original || pedido.subtotal || 0),
          desconto_itens_total: Number(pedido.desconto_itens_total || 0),
          desconto_manual: Number(pedido.desconto_manual || 0),
          taxa_entrega: Number(pedido.taxa_entrega || 0),
          taxa_servico: Number(pedido.taxa_servico || 0),
          total_original: Number(pedido.total_original || pedido.total || 0),
        }
      }) as PedidoDia[])
    } catch (erro) {
      console.error('[PDV] Erro ao carregar pedidos do dia:', erro)
      toast.error('Não foi possível carregar os pedidos do dia.')
    } finally {
      setLoadingPedidosDia(false)
    }
  }, [])

  useEffect(() => {
    if (!usuario) return
    void carregarCatalogo()
    void carregarMesas()
    void carregarPedidosDia()
  }, [usuario, carregarCatalogo, carregarMesas, carregarPedidosDia])

  const categorias = useMemo(() => {
    const mapa = new Map<string, number>()
    catalogo.forEach((item) => {
      mapa.set(item.categoria, (mapa.get(item.categoria) || 0) + 1)
    })

    return Array.from(mapa.entries())
      .map(([nome, total]) => ({ nome, total }))
      .sort((a, b) => {
        const ia = categoriasPrioritarias.indexOf(normalizarTextoBusca(a.nome))
        const ib = categoriasPrioritarias.indexOf(normalizarTextoBusca(b.nome))
        if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
        return a.nome.localeCompare(b.nome)
      })
  }, [catalogo])

  const produtosFiltrados = useMemo(() => {
    const termo = normalizarTextoBusca(buscaProduto)
    return catalogo.filter((item) => {
      const categoriaOk = categoriaAtiva === 'todos' || item.categoria === categoriaAtiva
      const buscaOk = !termo || normalizarTextoBusca(item.nome).includes(termo)
      return categoriaOk && buscaOk
    })
  }, [catalogo, categoriaAtiva, buscaProduto])

  const pontosSalaoDialog = useMemo(
    () => mesas
      .filter((ponto) => ponto.tipo === tipoPontoSalao)
      .sort((a, b) => {
        if (a.tipo === 'local_externo') return a.numero - b.numero
        return Number(b.status === 'ocupada') - Number(a.status === 'ocupada') || a.numero - b.numero
      }),
    [mesas, tipoPontoSalao],
  )

  const pedidoDiaPorId = useMemo(() => new Map(pedidosDia.map((pedido) => [pedido.id, pedido])), [pedidosDia])
  const pedidoDiaPorMesaId = useMemo(() => {
    const mapa = new Map<string, PedidoDia>()
    pedidosDia.forEach((pedido) => {
      if (pedido.mesa_id && !pedidoEstaEncerrado(pedido.status)) mapa.set(pedido.mesa_id, pedido)
    })
    return mapa
  }, [pedidosDia])
  const pedidosParaCards = useMemo<Pedido[]>(() => pedidosDia.map((pedido) => ({
    id: pedido.id,
    numero_pedido: pedido.numero_pedido,
    nome_cliente: pedido.nome_cliente,
    telefone: pedido.telefone || undefined,
    endereco: pedido.endereco || undefined,
    bairro: pedido.bairro || undefined,
    tipo_entrega: pedido.tipo_entrega || 'local',
    status: pedido.status || 'pendente',
    subtotal: Number(pedido.subtotal || 0),
    taxa_entrega: Number(pedido.taxa_entrega || 0),
    taxa_servico: Number(pedido.taxa_servico || 0),
    total: Number(pedido.total || 0),
    created_at: pedido.created_at,
    forma_pagamento: pedido.forma_pagamento || undefined,
    pagamento_online: Boolean(pedido.pagamento_online),
    pagamento_online_status: pedido.pagamento_online_status || undefined,
    troco_para: pedido.troco_para ?? null,
    observacoes: pedido.observacoes || undefined,
    mesa: pedido.mesa,
    comanda: pedido.comanda,
    mesa_id: pedido.mesa_id || null,
    mesa_identificador: pedido.mesa_identificador || null,
    mesa_tipo: pedido.mesa_tipo || null,
    garcom_id: pedido.garcom_id || null,
    nome_garcom: pedido.nome_garcom || null,
    itens: (pedido.itens_pedido || []).map((item) => ({
      id: item.id || `${pedido.id}-${item.nome_item}`,
      nome_item: item.nome_item,
      quantidade: Number(item.quantidade || 1),
      preco_unitario: Number(item.preco_unitario || 0),
      subtotal: Number(item.subtotal || 0),
      observacoes: item.observacoes || undefined,
      item_adicionais: [],
    })),
  })), [pedidosDia])
  const pedidosParaCardsFiltrados = useMemo(() => {
    const termo = normalizarTextoBusca(buscaPedidosDia)
    if (!termo) return pedidosParaCards

    return pedidosParaCards.filter((pedido) => {
      const itens = (pedido.itens || []).map((item) => item.nome_item || '').join(' ')
      const texto = [
        pedido.nome_cliente,
        pedido.telefone,
        pedido.numero_pedido,
        pedido.id,
        pedido.mesa_identificador,
        pedido.mesa,
        pedido.comanda,
        pedido.nome_garcom,
        pedido.status,
        pedido.forma_pagamento,
        itens,
      ]
        .filter((valor) => valor !== null && valor !== undefined)
        .join(' ')

      return normalizarTextoBusca(texto).includes(termo)
    })
  }, [buscaPedidosDia, pedidosParaCards])
  const pedidosParaSalao = useMemo(() => pedidosDia
    .filter((pedido) => !pedidoEstaEncerrado(pedido.status))
    .map((pedido) => ({
      id: pedido.id,
      numero_pedido: pedido.numero_pedido,
      nome_cliente: pedido.nome_cliente,
      telefone: pedido.telefone || null,
      endereco: pedido.endereco || null,
      bairro: pedido.bairro || null,
      tipo_entrega: pedido.tipo_entrega || 'local',
      status: pedido.status || '',
      created_at: pedido.created_at,
      observacoes: pedido.observacoes || null,
      forma_pagamento: pedido.forma_pagamento || null,
      pagamento_online: Boolean(pedido.pagamento_online),
      pagamento_online_status: pedido.pagamento_online_status || null,
      troco_para: pedido.troco_para ?? null,
      subtotal: Number(pedido.subtotal || 0),
      taxa_entrega: Number(pedido.taxa_entrega || 0),
      taxa_servico: Number(pedido.taxa_servico || 0),
      total: Number(pedido.total || 0),
      mesa: pedido.mesa,
      comanda: pedido.comanda,
      mesa_id: pedido.mesa_id || null,
      garcom_id: pedido.garcom_id || null,
      nome_garcom: pedido.nome_garcom || null,
      itens_pedido: (pedido.itens_pedido || []).map((item) => ({
        id: item.id || `${pedido.id}-${item.nome_item}`,
        nome_item: item.nome_item || null,
        quantidade: Number(item.quantidade || 1),
        subtotal: Number(item.subtotal || 0),
        observacoes: item.observacoes || null,
        created_at: item.created_at || null,
        adicionado_por_garcom_id: item.adicionado_por_garcom_id || null,
        nome_garcom: item.nome_garcom || null,
      })),
      atividades_garcom: pedido.atividades_garcom || [],
    })), [pedidosDia])

  const totalItens = useMemo(() => itens.reduce((acc, item) => acc + item.quantidade, 0), [itens])
  const itemEditor = useMemo(
    () => itens.find((item) => item.localId === itemEditorLocalId) || null,
    [itens, itemEditorLocalId],
  )
  const subtotalBruto = useMemo(
    () => Number(itens.reduce((acc, item) => acc + item.quantidade * item.preco, 0).toFixed(2)),
    [itens],
  )
  const calcularDescontoItem = useCallback((item: ItemCarrinho) => {
    const bruto = item.preco * item.quantidade
    return Number(Math.min(bruto, paraNumeroMonetario(item.descontoManualInput || '')).toFixed(2))
  }, [])
  const calcularSubtotalItem = useCallback(
    (item: ItemCarrinho) => Number(Math.max(0, item.preco * item.quantidade - calcularDescontoItem(item)).toFixed(2)),
    [calcularDescontoItem],
  )
  const descontoItensTotal = useMemo(
    () => Number(itens.reduce((acc, item) => acc + calcularDescontoItem(item), 0).toFixed(2)),
    [itens, calcularDescontoItem],
  )
  const subtotalAposDescontosItens = useMemo(
    () => Number(Math.max(0, subtotalBruto - descontoItensTotal).toFixed(2)),
    [subtotalBruto, descontoItensTotal],
  )
  const descontoPedidoAplicado = useMemo(
    () => Number(Math.min(subtotalAposDescontosItens, paraNumeroMonetario(descontoPedidoInput)).toFixed(2)),
    [subtotalAposDescontosItens, descontoPedidoInput],
  )
  const subtotal = useMemo(
    () => Number(Math.max(0, subtotalAposDescontosItens - descontoPedidoAplicado).toFixed(2)),
    [subtotalAposDescontosItens, descontoPedidoAplicado],
  )
  const valorPago = useMemo(
    () => Number(pagamentosParciais.reduce((acc, pagamento) => acc + pagamento.valorTotal, 0).toFixed(2)),
    [pagamentosParciais],
  )
  const saldoAberto = Math.max(0, Number((subtotal - valorPago).toFixed(2)))
  const localParceiroAtual = tipoAtendimento === 'salao' && mesaSelecionada?.tipo === 'local_externo'
  const nomeClienteValido = useMemo(
    () => nomeClientePessoalValido(nomeCliente, { localParceiro: localParceiroAtual }),
    [nomeCliente, localParceiroAtual],
  )
  const destacarNomeCliente = itens.length > 0 && !nomeClienteValido

  const obterQuantidadePaga = useCallback(
    (itemLocalId: string) =>
      pagamentosParciais
        .filter((pagamento) => pagamento.itemLocalId === itemLocalId)
        .reduce((acc, pagamento) => acc + pagamento.quantidade, 0),
    [pagamentosParciais],
  )
  const obterValorPagoItem = useCallback(
    (itemLocalId: string) =>
      Number(pagamentosParciais
        .filter((pagamento) => pagamento.itemLocalId === itemLocalId)
        .reduce((acc, pagamento) => acc + pagamento.valorTotal, 0)
        .toFixed(2)),
    [pagamentosParciais],
  )
  const calcularTotalEfetivoItem = useCallback((item: ItemCarrinho) => {
    const subtotalItem = calcularSubtotalItem(item)
    if (subtotalAposDescontosItens <= 0 || descontoPedidoAplicado <= 0) return subtotalItem
    const descontoProporcional = descontoPedidoAplicado * (subtotalItem / subtotalAposDescontosItens)
    return Number(Math.max(0, subtotalItem - descontoProporcional).toFixed(2))
  }, [calcularSubtotalItem, descontoPedidoAplicado, subtotalAposDescontosItens])
  const calcularValorPagamentoItem = useCallback((item: ItemCarrinho, quantidade: number) => {
    const qtd = Math.min(item.quantidade, Math.max(1, quantidade))
    const qtdPaga = obterQuantidadePaga(item.localId)
    const restante = Math.max(0, item.quantidade - qtdPaga)
    const qtdAplicada = Math.min(restante, qtd)
    if (qtdAplicada <= 0) return 0
    const totalEfetivo = calcularTotalEfetivoItem(item)
    const valorJaPago = obterValorPagoItem(item.localId)
    if (qtdAplicada >= restante) {
      return Number(Math.max(0, totalEfetivo - valorJaPago).toFixed(2))
    }
    return Number(((totalEfetivo / item.quantidade) * qtdAplicada).toFixed(2))
  }, [calcularTotalEfetivoItem, obterQuantidadePaga, obterValorPagoItem])

  const buscarClientes = useCallback(async (valor: string) => {
    const termo = valor.trim()
    const telefone = digitosTelefone(termo)
    if (termo.length < 2 && telefone.length < 3) {
      setClientesEncontrados([])
      return
    }

    setBuscandoClientes(true)
    try {
      const consulta = supabase
        .from('usuarios_cliente')
        .select('id, nome, telefone, endereco, bairro')
        .limit(8)

      const { data, error } = telefone.length >= 3
        ? await consulta.ilike('telefone', `%${telefone}%`).order('updated_at', { ascending: false })
        : await consulta.ilike('nome', `%${termo}%`).order('updated_at', { ascending: false })

      if (error) throw error
      setClientesEncontrados((data || []) as ClientePdv[])
    } catch (erro) {
      console.error('[PDV] Erro ao buscar cliente:', erro)
      setClientesEncontrados([])
    } finally {
      setBuscandoClientes(false)
    }
  }, [])

  const alterarBuscaCliente = (valor: string) => {
    setBuscaCliente(valor)
    if (buscaClienteTimer.current) clearTimeout(buscaClienteTimer.current)
    buscaClienteTimer.current = setTimeout(() => buscarClientes(valor), 260)
  }

  const selecionarCliente = (cliente: ClientePdv) => {
    setClienteSelecionado(cliente)
    setNomeCliente(cliente.nome || '')
    setTelefoneCliente(cliente.telefone || '')
    setBuscaCliente('')
    setClientesEncontrados([])
  }

  const autenticarPerfil = async (senha: string) => {
    if (!usuarioLoginSelecionado) return

    setLoginEmAndamento(true)
    setErroLogin('')
    try {
      const resultado = await loginUsuarioSistema(usuarioLoginSelecionado.nome_usuario, senha)
      if (!resultado.sucesso || !resultado.usuario) {
        setErroLogin(resultado.erro || 'Senha incorreta')
        return
      }
      if (resultado.usuario.papel !== 'admin' && resultado.usuario.papel !== 'garcom') {
        limparSessao()
        setErroLogin('Esse perfil não acessa o PDV.')
        return
      }

      if (resultado.usuario.papel === 'admin') {
        localStorage.setItem('adminToken', `admin-supabase-${Date.now()}`)
      } else {
        localStorage.setItem('garcomToken', resultado.usuario.id)
      }

      salvarSessao(resultado.usuario)
      setUsuarioAutenticado(resultado.usuario)
      setModalSenhaAberto(false)
      setTransicaoLoginAtiva(true)
    } finally {
      setLoginEmAndamento(false)
    }
  }

  const finalizarTransicaoLogin = useCallback(() => {
    if (usuarioAutenticado) {
      setUsuario(usuarioAutenticado)
      setTransicaoLoginAtiva(false)
      setUsuarioAutenticado(null)
    }
  }, [usuarioAutenticado])

  const sair = () => {
    limparSessao()
    localStorage.removeItem('adminToken')
    localStorage.removeItem('garcomToken')
    setUsuario(null)
  }

  const adicionarItem = (produto: ItemCatalogo) => {
    setPedidoFinalizado(null)
    setItens((atuais) => {
      const existente = atuais.find((item) => item.catalogoId === produto.id && item.tipo === produto.tipo && !item.observacoes)
      if (existente) {
        return atuais.map((item) =>
          item.localId === existente.localId
            ? { ...item, quantidade: item.quantidade + 1 }
            : item,
        )
      }
      return [
        ...atuais,
        {
          localId: gerarIdLocal(),
          catalogoId: produto.id,
          tipo: produto.tipo,
          nome: produto.nome,
          preco: produto.preco,
          quantidade: 1,
          observacoes: '',
          descontoManualInput: '',
          criadoEm: new Date().toISOString(),
        },
      ]
    })
  }

  const alterarQuantidade = (localId: string, proximaQuantidade: number) => {
    setItens((atuais) => {
      const item = atuais.find((registro) => registro.localId === localId)
      if (!item) return atuais
      const qtdPaga = obterQuantidadePaga(localId)
      if (qtdPaga > 0 && proximaQuantidade !== item.quantidade) {
        toast.warning('Reverta unidades pagas antes de alterar a quantidade desse item.')
        return atuais
      }
      if (proximaQuantidade <= 0) {
        return atuais.filter((registro) => registro.localId !== localId)
      }
      return atuais.map((registro) =>
        registro.localId === localId
          ? { ...registro, quantidade: Math.min(99, proximaQuantidade) }
          : registro,
      )
    })
  }

  const removerItem = (localId: string) => {
    if (obterQuantidadePaga(localId) > 0) {
      toast.warning('Reverta o pagamento parcial antes de remover o item.')
      return
    }
    if (itemEditorLocalId === localId) setItemEditorLocalId(null)
    setItens((atuais) => atuais.filter((item) => item.localId !== localId))
  }

  const atualizarObservacaoItem = (localId: string, observacoes: string) => {
    setItens((atuais) => atuais.map((item) => item.localId === localId ? { ...item, observacoes } : item))
  }

  const atualizarDescontoItem = (localId: string, descontoManualInput: string) => {
    if (obterQuantidadePaga(localId) > 0) {
      toast.warning('Reverta o pagamento parcial antes de alterar o desconto do item.')
      return
    }
    setItens((atuais) => atuais.map((item) => item.localId === localId ? { ...item, descontoManualInput } : item))
  }

  const pagarUnidades = (item: ItemCarrinho, quantidade: number) => {
    if (formaPagamento === 'crediario') {
      toast.warning('Crediário no PDV é fechamento do pedido inteiro. Para parcial, use dinheiro, PIX ou cartão.')
      return
    }
    const qtdPaga = obterQuantidadePaga(item.localId)
    const restante = Math.max(0, item.quantidade - qtdPaga)
    const qtd = Math.min(restante, Math.max(1, quantidade))
    if (qtd <= 0) {
      toast.info('Esse item já está totalmente pago.')
      return
    }
    const valorTotalPagamento = calcularValorPagamentoItem(item, qtd)
    if (valorTotalPagamento <= 0) {
      toast.warning('Não há valor aberto para esse item.')
      return
    }

    setPagamentosParciais((atuais) => [
      ...atuais,
      {
        id: gerarIdLocal(),
        itemLocalId: item.localId,
        forma: formaPagamento,
        quantidade: qtd,
        valorUnitario: Number((valorTotalPagamento / qtd).toFixed(2)),
        valorTotal: valorTotalPagamento,
        criadoEm: new Date().toISOString(),
      },
    ])
  }

  const reverterUnidades = (item: ItemCarrinho, quantidade: number) => {
    let restanteParaReverter = Math.max(1, quantidade)
    const reversiveis = pagamentosParciais
      .filter((pagamento) => pagamento.itemLocalId === item.localId)
      .reduce((acc, pagamento) => acc + pagamento.quantidade, 0)

    if (reversiveis <= 0) {
      toast.info('Não há pagamento para reverter nesse item.')
      return
    }

    setPagamentosParciais((atuais) => {
      const proximos = [...atuais]
      for (let indice = proximos.length - 1; indice >= 0 && restanteParaReverter > 0; indice -= 1) {
        const pagamento = proximos[indice]
        if (pagamento.itemLocalId !== item.localId) continue
        const removido = Math.min(pagamento.quantidade, restanteParaReverter)
        restanteParaReverter -= removido
        if (removido >= pagamento.quantidade) {
          proximos.splice(indice, 1)
        } else {
          const novaQuantidade = pagamento.quantidade - removido
          proximos[indice] = {
            ...pagamento,
            quantidade: novaQuantidade,
            valorTotal: Number((pagamento.valorUnitario * novaQuantidade).toFixed(2)),
          }
        }
      }
      return proximos
    })
  }

  const selecionarAtendimento = (tipo: TipoAtendimento) => {
    setTipoAtendimento(tipo)
    if (tipo !== 'salao') setMesaSelecionada(null)
    if (tipo === 'salao') setMesaDialogAberto(true)
  }

  const selecionarMesa = (mesa: MesaPdv) => {
    if (mesa.tipo !== 'local_externo' && mesa.status === 'ocupada' && mesa.id !== mesaSelecionada?.id) {
      toast.warning(`${labelPontoSalao(mesa)} está ocupada.`)
      return
    }
    setTipoAtendimento('salao')
    setTipoPontoSalao(mesa.tipo)
    setMesaSelecionada(mesa)
    if (!nomeCliente && mesa.tipo !== 'local_externo' && mesa.nome_cliente) setNomeCliente(mesa.nome_cliente)
  }

  const garantirCliente = async () => {
    const nome = nomeCliente.trim()
    const telefone = digitosTelefone(telefoneCliente)
    const localParceiro = tipoAtendimento === 'salao' && mesaSelecionada?.tipo === 'local_externo'
    const nomeCadastro = nomeClienteParaPontoSalao({
      nomeCliente: nome || clienteSelecionado?.nome || '',
      localParceiro,
    })

    if (clienteSelecionado) {
      const { error } = await supabase
        .from('usuarios_cliente')
        .update({
          nome: nomeCadastro,
          telefone: telefone || clienteSelecionado.telefone,
        })
        .eq('id', clienteSelecionado.id)
      if (error) throw error
      return clienteSelecionado.id
    }

    if (!telefone) return null

    const { data: existente, error: erroBusca } = await supabase
      .from('usuarios_cliente')
      .select('id')
      .eq('telefone', telefone)
      .maybeSingle()
    if (erroBusca) throw erroBusca
    if (existente?.id) return existente.id

    const { data, error } = await supabase
      .from('usuarios_cliente')
      .insert({
        telefone,
        nome: nomeCadastro,
        primeiro_pedido_em: new Date().toISOString(),
        ultimo_pedido_em: new Date().toISOString(),
      })
      .select('id')
      .single()
    if (error) throw error
    return data.id as string
  }

  const montarSnapshotItem = (item: ItemCarrinho, quantidade = item.quantidade): ItemSnapshotImpressao => ({
    nome_item: item.nome,
    quantidade,
    preco_unitario: item.preco,
    subtotal: quantidade === item.quantidade
      ? calcularSubtotalItem(item)
      : Number((item.preco * quantidade).toFixed(2)),
    observacoes: [
      item.observacoes || '',
      calcularDescontoItem(item) > 0 ? `Desconto: ${formatarMoeda(calcularDescontoItem(item))}` : '',
    ].filter(Boolean).join(' · ') || null,
    item_adicionais: [],
  })

  const registrarAtividadeGarcom = async (pedidoId: string, descricao: string, dadosExtra: Record<string, unknown>) => {
    if (usuario?.papel !== 'garcom') return
    const { error } = await supabase.from('atividade_garcom').insert({
      garcom_id: usuario.id,
      tipo_acao: 'pedido_criado',
      pedido_id: pedidoId,
      descricao,
      dados_extra: { ...dadosExtra, origem: 'pdv' },
    })
    if (error) {
      console.error('[PDV] Falha ao registrar atividade do garçom:', error)
    }
  }

  const finalizarPedido = async () => {
    if (itens.length === 0) {
      toast.warning('Adicione pelo menos um item.')
      return
    }
    if (tipoAtendimento === 'salao' && !mesaSelecionada) {
      toast.warning('Escolha uma mesa, comanda ou parceiro.')
      return
    }
    if (formaPagamento === 'crediario' && valorPago > 0) {
      toast.warning('Crediário parcial deve ser feito nos detalhes do pedido. No PDV, use crediário apenas para pedido inteiro.')
      return
    }
    if (formaPagamento !== 'crediario' && saldoAberto > 0 && valorPago > 0) {
      toast.warning('Ainda há saldo aberto. Pague o restante ou reverta os parciais antes de finalizar.')
      return
    }
    const localParceiroPedido = tipoAtendimento === 'salao' && mesaSelecionada?.tipo === 'local_externo'
    if (!nomeClientePessoalValido(nomeCliente, { localParceiro: localParceiroPedido })) {
      toast.warning('Informe o nome real do cliente antes de finalizar.')
      return
    }

    setSalvando(true)
    let pedidoCriadoId: string | null = null
    let pontoOcupadoId: string | null = null
    try {
      const clienteId = await garantirCliente()
      const tipoEntrega = tipoAtendimento === 'retirada' ? 'retirada' : 'local'
      const localParceiro = localParceiroPedido
      const nome = nomeClienteParaPedido({
        nomeCliente,
        tipoEntrega,
        localParceiro,
      })
      const nomeSalao = nomeClienteParaPontoSalao({
        nomeCliente,
        localParceiro,
      })
      const formaPrincipal = valorPago > 0
        ? 'Parcial'
        : obterForma(formaPagamento).label
      const numeroPedido = await buscarProximoNumeroPedidoDiario(supabase)

      const { data: pedido, error: pedidoError } = await supabase
        .from('pedidos')
        .insert({
          numero_pedido: numeroPedido,
          nome_cliente: nome,
          telefone: digitosTelefone(telefoneCliente) || null,
          tipo_entrega: tipoEntrega,
          forma_pagamento: formaPrincipal,
          subtotal_original: subtotalBruto,
          subtotal: subtotalAposDescontosItens,
          desconto_itens_total: descontoItensTotal,
          desconto_manual: descontoPedidoAplicado,
          taxa_entrega: 0,
          taxa_servico: 0,
          total_original: subtotalBruto,
          total: subtotal,
          status: 'preparando',
          troco_para: null,
          observacoes: observacoesPedido.trim() || null,
          origem: 'pdv',
          mesa: tipoAtendimento === 'salao' && mesaSelecionada?.tipo === 'mesa' ? mesaSelecionada.numero : null,
          comanda: tipoAtendimento === 'salao' && mesaSelecionada?.tipo === 'comanda' ? mesaSelecionada.numero : null,
          mesa_id: tipoAtendimento === 'salao' ? mesaSelecionada?.id || null : null,
          cliente_id: clienteId,
          garcom_id: usuario?.id || null,
        })
        .select()
        .single()
      if (pedidoError) throw pedidoError
      pedidoCriadoId = pedido.id

      const numeroSincronizado = await sincronizarNumeroPedidoDiario(supabase, pedido).catch((erro) => {
        console.error('[PDV] Falha ao sincronizar número do pedido:', erro)
        return Number(pedido.numero_pedido || numeroPedido)
      })

      const ehParceiro = mesaSelecionada?.tipo === 'local_externo'
      if (tipoAtendimento === 'salao' && mesaSelecionada && !ehParceiro) {
        const agora = new Date()
        const liberarEm = calcularLiberacaoMesa(agora)
        const { data: pontosAtualizados, error: mesaError } = await supabase
          .from('mesas')
          .update({
            status: 'ocupada',
            nome_cliente: nomeSalao,
            ocupada_em: agora.toISOString(),
            liberar_em: liberarEm.toISOString(),
            tempo_limite_minutos: TEMPO_PADRAO_MESA_MINUTOS,
            pedido_id: pedido.id,
          })
          .eq('id', mesaSelecionada.id)
          .eq('status', 'livre')
          .select('id')

        if (mesaError) throw mesaError

        if (!pontosAtualizados || pontosAtualizados.length === 0) {
          await supabase.from('pedidos').delete().eq('id', pedido.id)
          pedidoCriadoId = null
          throw new Error(`${labelPontoSalao(mesaSelecionada)} acabou de ser ocupada. Atualize e escolha outro ponto.`)
        }

        pontoOcupadoId = String(pontosAtualizados[0].id)
      }

      const itensCriados: ItemFinalizado[] = []
      for (const item of itens) {
        const subtotalBrutoItem = Number((item.preco * item.quantidade).toFixed(2))
        const descontoItem = calcularDescontoItem(item)
        const subtotalItem = calcularSubtotalItem(item)
        const insertItem: Record<string, unknown> = {
          pedido_id: pedido.id,
          nome_item: item.nome,
          nome_produto: item.nome,
          quantidade: item.quantidade,
          preco_unitario: item.preco,
          subtotal_original: subtotalBrutoItem,
          subtotal: subtotalItem,
          preco_total: subtotalItem,
          desconto_manual: descontoItem,
          observacoes: item.observacoes.trim() || null,
          adicionado_por_garcom_id: usuario?.id || null,
        }
        if (item.tipo === 'produto') insertItem.produto_id = item.catalogoId
        if (item.tipo === 'bebida') insertItem.bebida_id = item.catalogoId
        if (item.tipo === 'combo') insertItem.combo_id = item.catalogoId

        const { data: itemCriado, error: itemError } = await supabase
          .from('itens_pedido')
          .insert(insertItem)
          .select('id')
          .single()
        if (itemError) throw itemError
        itensCriados.push({ ...item, itemPedidoId: itemCriado.id })
      }

      const itemDbPorLocalId = new Map(itensCriados.map((item) => [item.localId, item]))
      if (pagamentosParciais.length > 0) {
        const pagamentosParaInserir = pagamentosParciais.map((pagamento) => {
          const item = itemDbPorLocalId.get(pagamento.itemLocalId)
          if (!item) return null
          const subtotalPago = Number((pagamento.valorUnitario * pagamento.quantidade).toFixed(2))
          const valorPagamento = pagamento.valorTotal || subtotalPago
          return {
            pedido_id: pedido.id,
            forma_pagamento: obterForma(pagamento.forma).banco,
            valor: valorPagamento,
            itens_pagos: [{
              id: item.itemPedidoId,
              nome: item.nome,
              quantidade: pagamento.quantidade,
              preco_unitario: Number((valorPagamento / pagamento.quantidade).toFixed(2)),
              subtotal: valorPagamento,
              observacoes: item.observacoes || null,
              created_at: item.criadoEm,
            }],
          }
        }).filter((pagamento): pagamento is NonNullable<typeof pagamento> => pagamento !== null)

        if (pagamentosParaInserir.length > 0) {
          const { error: pagamentosError } = await supabase
            .from('pagamentos_pedido')
            .insert(pagamentosParaInserir)
          if (pagamentosError) throw pagamentosError
        }
      } else {
        const { error: pagamentoError } = await supabase.from('pagamentos_pedido').insert({
          pedido_id: pedido.id,
          forma_pagamento: obterForma(formaPagamento).banco,
          valor: subtotal,
          itens_pagos: [],
        })
        if (pagamentoError) throw pagamentoError
      }

      const { error: statusError } = await supabase
        .from('pedidos')
        .update({ status: 'confirmado' })
        .eq('id', pedido.id)
      if (statusError) throw statusError

      if (imprimirAutomatico) {
        const pedidoSnapshot: PedidoSnapshotImpressao = {
          id: pedido.id,
          numero_pedido: numeroSincronizado,
          nome_cliente: nome,
          tipo_entrega: tipoEntrega,
          telefone: digitosTelefone(telefoneCliente) || null,
          mesa: mesaSelecionada?.tipo === 'mesa' ? mesaSelecionada.numero : null,
          comanda: mesaSelecionada?.tipo === 'comanda' ? mesaSelecionada.numero : null,
          endereco: mesaSelecionada?.tipo === 'local_externo' ? labelPontoSalao(mesaSelecionada) : null,
          subtotal,
          taxa_entrega: 0,
          taxa_servico: 0,
          total: subtotal,
          forma_pagamento: formaPrincipal,
          observacoes: observacoesPedido.trim() || null,
          created_at: pedido.created_at,
        }
        const itensSnapshot = itens.map((item) => montarSnapshotItem(item))
        const hashEvento = gerarHashEventoImpressao(
          pedido.id,
          'cozinha',
          'pedido_completo',
          itensSnapshot,
          'admin_pdv',
        )
        const resultado = await enfileirarImpressao({
          pedidoId: pedido.id,
          tipo: 'cozinha',
          escopo: 'pedido_completo',
          origem: 'admin_pdv',
          itensSnapshot,
          pedidoSnapshot,
          hashEvento,
        })
        if (!resultado.sucesso && !resultado.duplicado) {
          console.error('[PDV] Erro ao enfileirar impressão:', resultado.erro)
        }
      }

      await registrarAtividadeGarcom(pedido.id, 'Pedido criado pelo PDV', {
        total: subtotal,
        itens: itens.map((item) => ({ nome: item.nome, quantidade: item.quantidade })),
      })

      setPedidoFinalizado({
        id: pedido.id,
        numero: Number(numeroSincronizado || pedido.numero_pedido || 0) || null,
        nomeCliente: nome,
        total: subtotal,
        itens: itensCriados,
      })
      setItens([])
      setPagamentosParciais([])
      setObservacoesPedido('')
      setDescontoPedidoInput('')
      setClienteSelecionado(null)
      setNomeCliente('')
      setTelefoneCliente('')
      setMesaSelecionada(null)
      await carregarMesas()
      await carregarPedidosDia()
      toast.success(`Pedido ${numeroSincronizado ? `#${numeroSincronizado}` : ''} criado no PDV.`)
    } catch (erro) {
      console.error('[PDV] Erro ao finalizar pedido:', erro)
      if (pontoOcupadoId && pedidoCriadoId) {
        await supabase
          .from('mesas')
          .update({
            status: 'livre',
            nome_cliente: null,
            ocupada_em: null,
            liberar_em: null,
            pedido_id: null,
          })
          .eq('id', pontoOcupadoId)
          .eq('pedido_id', pedidoCriadoId)
      }
      toast.error(erro instanceof Error ? erro.message : 'Não foi possível finalizar o pedido no PDV.')
    } finally {
      setSalvando(false)
    }
  }

  const imprimirItemFinalizado = async (item: ItemFinalizado) => {
    if (!pedidoFinalizado) return
    const snapshot = [montarSnapshotItem(item)]
    const hashEvento = gerarHashEventoImpressao(
      pedidoFinalizado.id,
      'cozinha',
      'itens_novos',
      snapshot,
      `admin_pdv_item_${item.itemPedidoId}`,
    )
    const resultado = await enfileirarImpressao({
      pedidoId: pedidoFinalizado.id,
      tipo: 'cozinha',
      escopo: 'itens_novos',
      origem: 'admin_pdv_item',
      itensSnapshot: snapshot,
      pedidoSnapshot: {
        id: pedidoFinalizado.id,
        numero_pedido: pedidoFinalizado.numero,
        nome_cliente: pedidoFinalizado.nomeCliente,
        total: pedidoFinalizado.total,
      },
      hashEvento,
      automatico: false,
    })

    if (resultado.sucesso || resultado.duplicado) {
      toast.success('Item enviado para impressão.')
    } else {
      toast.error('Falha ao enviar item para impressão.')
    }
  }

  useEffect(() => {
    if (!usuario) return

    const estaDigitando = () => {
      const ativo = document.activeElement
      return ativo instanceof HTMLInputElement
        || ativo instanceof HTMLTextAreaElement
        || ativo instanceof HTMLSelectElement
        || Boolean(ativo?.getAttribute('contenteditable') === 'true')
    }

    const aoPressionarTecla = (event: KeyboardEvent) => {
      const tecla = event.key.toLowerCase()
      const modificador = event.metaKey || event.ctrlKey

      if (event.key === 'Escape') {
        setCategoriaDialogAberto(false)
        setMesaDialogAberto(false)
        return
      }

      if (modificador && tecla === 'f') {
        event.preventDefault()
        buscaProdutoRef.current?.focus()
        return
      }

      if (modificador && tecla === 'k') {
        event.preventDefault()
        setCategoriaDialogAberto(true)
        return
      }

      if (modificador && tecla === 'm') {
        event.preventDefault()
        setMesaDialogAberto(true)
        return
      }

      if (modificador && tecla === 'p') {
        event.preventDefault()
        const ultimoItem = pedidoFinalizado?.itens[pedidoFinalizado.itens.length - 1]
        if (ultimoItem) void imprimirItemFinalizado(ultimoItem)
        return
      }

      if (event.key === 'Enter' && (modificador || !estaDigitando()) && !categoriaDialogAberto && !mesaDialogAberto) {
        event.preventDefault()
        if (itens.length > 0) void finalizarPedido()
      }
    }

    window.addEventListener('keydown', aoPressionarTecla)
    return () => window.removeEventListener('keydown', aoPressionarTecla)
  }, [categoriaDialogAberto, finalizarPedido, imprimirItemFinalizado, itens.length, mesaDialogAberto, pedidoFinalizado, usuario])

  const executarAcaoPedido = async (
    pedidoId: string,
    acao: 'pagamento' | 'impressao' | 'concluir' | 'excluir',
    callback: () => Promise<void>,
  ) => {
    setAcoesPedido((atual) => ({
      ...atual,
      [pedidoId]: { ...atual[pedidoId], [acao]: true },
    }))
    try {
      await callback()
    } finally {
      setAcoesPedido((atual) => ({
        ...atual,
        [pedidoId]: { ...atual[pedidoId], [acao]: false },
      }))
    }
  }

  const obterPedidoDoPonto = (ponto: { id: string; pedido_id: string | null }) =>
    (ponto.pedido_id ? pedidoDiaPorId.get(ponto.pedido_id) : null) ||
    pedidoDiaPorMesaId.get(ponto.id) ||
    null

  const confirmarPagamentoPedido = async (pedido: PedidoDia) => {
    if (!pedidoTemPagamentoPendente(pedido)) return
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
    toast.success('Pagamento confirmado')
    await carregarPedidosDia()
  }

  const concluirPedidoDia = async (pedido: PedidoDia) => {
    if (pedidoEstaEncerrado(pedido.status)) return
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

    toast.success('Pedido concluído')
    await Promise.all([carregarPedidosDia(), carregarMesas()])
  }

  const liberarPontoSemPedido = async (pontoId: string) => {
    const agoraIso = new Date().toISOString()
    const { error } = await supabase
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
      .eq('id', pontoId)

    if (error) throw error
    toast.success('Ponto liberado')
    await carregarMesas()
  }

  const excluirPedidoDia = async (pedido: PedidoDia) => {
    await executarAcaoPedido(pedido.id, 'excluir', async () => {
      const agoraIso = new Date().toISOString()

      const { error: erroMesaPedido } = await supabase
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
      if (erroMesaPedido) throw erroMesaPedido

      if (pedido.mesa_id) {
        const { error: erroMesaId } = await supabase
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
          .eq('id', pedido.mesa_id)
        if (erroMesaId) throw erroMesaId
      }

      const { error } = await supabase.from('pedidos').delete().eq('id', pedido.id)
      if (error) throw error

      toast.success('Pedido excluído')
      await Promise.all([carregarPedidosDia(), carregarMesas()])
    })
  }

  const confirmarExclusaoPedido = (pedido: PedidoDia) => {
    setConfirmacaoPdv({
      aberto: true,
      titulo: 'Excluir pedido',
      mensagem: `Excluir o pedido de ${pedido.nome_cliente || 'cliente'}? Essa ação não pode ser desfeita e a mesa vinculada será liberada.`,
      textoConfirmar: 'Excluir pedido',
      variante: 'perigo',
      onConfirmar: () => excluirPedidoDia(pedido),
    })
  }

  const confirmarLiberacaoPonto = (ponto: { id: string; pedido_id: string | null; identificador?: string | null; numero: number }) => {
    const pedido = obterPedidoDoPonto(ponto)
    setConfirmacaoPdv({
      aberto: true,
      titulo: pedido ? 'Fechar mesa' : 'Liberar mesa',
      mensagem: pedido
        ? `Marcar o pedido de ${pedido.nome_cliente || 'cliente'} como entregue e liberar este ponto?`
        : `Liberar ${ponto.identificador || `Mesa ${ponto.numero}`} sem pedido vinculado?`,
      textoConfirmar: pedido ? 'Fechar mesa' : 'Liberar mesa',
      variante: 'padrao',
      onConfirmar: () => pedido ? concluirPedidoDia(pedido) : liberarPontoSemPedido(ponto.id),
    })
  }

  const estenderPontoSalao = async (ponto: MesaPdv, minutos: number) => {
    if (ponto.tipo === 'local_externo') return

    setAtualizandoPontoSalao(ponto.id)
    try {
      const liberarEmAtual = ponto.liberar_em ? new Date(ponto.liberar_em) : new Date()
      const novoLiberarEm = new Date(liberarEmAtual.getTime() + minutos * 60 * 1000)

      const { error } = await supabase
        .from('mesas')
        .update({ liberar_em: novoLiberarEm.toISOString() })
        .eq('id', ponto.id)

      if (error) throw error
      toast.success(`Tempo estendido em ${minutos} min`)
      await carregarMesas()
    } catch (erro) {
      console.error('[PDV] Erro ao estender tempo da mesa:', erro)
      toast.error('Não foi possível estender o tempo')
    } finally {
      setAtualizandoPontoSalao(null)
    }
  }

  const imprimirPedidoDia = async (pedido: PedidoDia) => {
    const itensSnapshot: ItemSnapshotImpressao[] = (pedido.itens_pedido || []).map((item) => ({
      nome_item: item.nome_item,
      quantidade: Number(item.quantidade || 1),
      preco_unitario: Number(item.preco_unitario || 0),
      subtotal: Number(item.subtotal || 0),
      observacoes: item.observacoes || null,
      item_adicionais: [],
    }))
    const pedidoSnapshot: PedidoSnapshotImpressao = {
      id: pedido.id,
      numero_pedido: pedido.numero_pedido,
      nome_cliente: pedido.nome_cliente,
      telefone: pedido.telefone || null,
      tipo_entrega: pedido.tipo_entrega || null,
      mesa: pedido.mesa,
      comanda: pedido.comanda,
      subtotal: Number(pedido.subtotal || 0),
      taxa_entrega: Number(pedido.taxa_entrega || 0),
      taxa_servico: Number(pedido.taxa_servico || 0),
      total: Number(pedido.total || 0),
      forma_pagamento: pedido.forma_pagamento || null,
      observacoes: pedido.observacoes || null,
      created_at: pedido.created_at,
    }
    const hashEvento = gerarHashEventoImpressao(
      pedido.id,
      'cozinha',
      'pedido_completo',
      itensSnapshot,
      'admin_pdv_card',
    )
    const resultado = await enfileirarImpressao({
      pedidoId: pedido.id,
      tipo: 'cozinha',
      escopo: 'pedido_completo',
      origem: 'admin_pdv_card',
      itensSnapshot,
      pedidoSnapshot,
      hashEvento,
      automatico: false,
    })

    if (!resultado.sucesso && !resultado.duplicado) {
      throw new Error(resultado.erro || 'Erro ao enviar para impressão')
    }

    toast.success('Pedido enviado para impressão')
  }

  const obterPedidoDiaOuAvisar = (pedidoId: string) => {
    const pedido = pedidoDiaPorId.get(pedidoId)
    if (!pedido) toast.error('Pedido não encontrado na lista atual.')
    return pedido || null
  }

  const confirmarPagamentoCard = async (pedido: Pedido) => {
    const pedidoDia = obterPedidoDiaOuAvisar(pedido.id)
    if (!pedidoDia) return
    await executarAcaoPedido(pedido.id, 'pagamento', () => confirmarPagamentoPedido(pedidoDia))
  }

  const concluirPedidoCard = async (pedido: Pedido) => {
    const pedidoDia = obterPedidoDiaOuAvisar(pedido.id)
    if (!pedidoDia) return
    await executarAcaoPedido(pedido.id, 'concluir', () => concluirPedidoDia(pedidoDia))
  }

  const imprimirPedidoCard = async (pedido: Pedido) => {
    const pedidoDia = obterPedidoDiaOuAvisar(pedido.id)
    if (!pedidoDia) return
    await executarAcaoPedido(pedido.id, 'impressao', () => imprimirPedidoDia(pedidoDia))
  }

  const abrirModalEdicaoPedido = (pedido: Pedido) => {
    setPedidoEdicao(pedido)
    setModalEditarAberto(true)
  }

  const abrirPontoSalao = async (ponto: MesaPdv) => {
    if (ponto.pedido_id) {
      router.push(`/admin/pedidos/${ponto.pedido_id}`)
      return
    }
    selecionarMesa(ponto)
    setAbaAtiva('venda')
  }

  if (autenticando) {
    return (
      <main className={cn(pdvShellClassName, 'grid place-items-center')}>
        <Loader2 className="size-8 animate-spin text-primary" />
      </main>
    )
  }

  if (!usuario) {
    return (
      <main className={pdvShellClassName}>
        <section className="mx-auto flex min-h-screen w-full max-w-4xl flex-col items-center justify-center gap-8 px-4 py-10">
          <div className="text-center">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">PDV</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Selecione um gerente, dono ou garçom e informe a senha cadastrada.
            </p>
          </div>

          <div className="min-h-52 w-full">
            {carregandoUsuariosLogin ? (
              <div className="grid min-h-52 place-items-center">
                <Loader2 className="size-8 animate-spin text-primary" />
              </div>
            ) : usuariosLogin.length > 0 ? (
              <div className="flex flex-wrap justify-center gap-3 sm:gap-5">
                {usuariosLogin.map((perfil, indice) => (
                  <div key={perfil.id} className="relative">
                    <CardPerfilUsuario
                      nome={perfil.nome}
                      papel={perfil.papel}
                      corAvatar={perfil.cor_avatar}
                      avatarUrl={perfil.avatar_url}
                      indice={indice}
                      aoClicar={() => {
                        setUsuarioLoginSelecionado(perfil)
                        setErroLogin('')
                        setModalSenhaAberto(true)
                      }}
                    />
                    <span className="absolute left-1/2 top-3 -translate-x-1/2 rounded-md border border-border/70 bg-card px-2 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">
                      {perfil.papel === 'garcom' ? 'garçom' : 'admin'}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mx-auto grid min-h-52 max-w-sm place-items-center rounded-lg border border-border/70 bg-card p-6 text-center">
                <div>
                  <p className="font-medium">Nenhum usuário disponível</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Cadastre admin ou garçom no painel de usuários.
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>

        {usuarioLoginSelecionado && (
          <ModalSenhaLogin
            usuario={usuarioLoginSelecionado}
            aberto={modalSenhaAberto}
            carregando={loginEmAndamento}
            erro={erroLogin}
            aoFechar={() => {
              setModalSenhaAberto(false)
              setErroLogin('')
            }}
            aoSubmeter={autenticarPerfil}
          />
        )}
        {usuarioAutenticado && (
          <TransicaoLogin
            ativo={transicaoLoginAtiva}
            nome={usuarioAutenticado.nome}
            corAvatar={usuarioAutenticado.cor_avatar}
            avatarUrl={usuarioAutenticado.avatar_url}
            aoFinalizar={finalizarTransicaoLogin}
          />
        )}
      </main>
    )
  }

  return (
    <main className={pdvShellClassName}>
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur">
        <div className="flex min-h-14 flex-col gap-2 px-3 py-2 lg:flex-row lg:items-center lg:justify-between lg:px-4">
          <div className="flex min-w-0 items-center gap-2">
            <Link
              href="/admin/dashboard"
              aria-label="Voltar ao painel"
              className={cn(
                'inline-flex h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium',
                pdvOutlineButtonClassName,
              )}
            >
              <ArrowLeft className="size-4" />
              <span className="hidden sm:inline">Painel</span>
            </Link>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">PDV</h1>
              <p className="hidden text-xs text-muted-foreground sm:block">Venda rápida no balcão</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
            <Button
              onClick={alternarModoPdv}
              className={cn(
                'h-10 rounded-lg px-3 font-medium',
                pdvAtivo
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
              )}
            >
              {pdvAtivo ? <Maximize2 className="mr-2 size-5" /> : <Power className="mr-2 size-5" />}
              {pdvAtivo ? 'PDV ligado' : 'PDV desligado'}
            </Button>
            <Button
              onClick={() => setImprimirAutomatico((atual) => !atual)}
              className={cn(
                'h-10 rounded-lg px-3 font-medium',
                imprimirAutomatico
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : pdvOutlineButtonClassName,
              )}
            >
              <Printer className="mr-2 size-5" />
              Auto
            </Button>
            <Button
              onClick={() => {
                void carregarCatalogo()
                void carregarMesas()
                void carregarPedidosDia()
              }}
              className={cn('h-10 rounded-lg px-3 font-medium', pdvOutlineButtonClassName)}
            >
              <RefreshCw className="mr-2 size-5" />
              Atualizar
            </Button>
            <Button
              onClick={sair}
              className="h-10 rounded-lg bg-destructive px-3 font-medium text-destructive-foreground hover:bg-destructive/90"
            >
              <LogOut className="mr-2 size-5" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      <Tabs value={abaAtiva} onValueChange={setAbaAtiva} className="flex h-[calc(100dvh-57px)] flex-col overflow-hidden">
        <div className="border-b border-border/70 bg-background/80 px-3 py-2 lg:px-4">
          <TabsList className="h-11 rounded-lg bg-muted/60 p-1">
            <TabsTrigger value="venda" className="h-9 rounded-md px-4 text-sm font-medium data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm">
              Venda
            </TabsTrigger>
            <TabsTrigger value="pedidos" className="h-9 rounded-md px-4 text-sm font-medium data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm">
              Pedidos do dia
            </TabsTrigger>
            <TabsTrigger value="mesas" className="h-9 rounded-md px-4 text-sm font-medium data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm">
              Mesas
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="venda" className="m-0 min-h-0 flex-1 overflow-y-auto">
      <section className="grid min-h-full gap-4 p-3 lg:grid-cols-[minmax(0,1fr)_420px] lg:p-4">
        <div className="flex min-h-0 flex-col gap-3">
          <div className="grid gap-3 rounded-lg border border-border/70 bg-card p-3 lg:grid-cols-[1fr_auto] lg:items-end">
            <Field className="gap-1.5">
              <FieldLabel htmlFor="pdv-busca-produto" className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Buscar item
              </FieldLabel>
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="pdv-busca-produto"
                  ref={buscaProdutoRef}
                  value={buscaProduto}
                  onChange={(event) => setBuscaProduto(event.target.value)}
                  placeholder="Produto, bebida ou combo"
                  className="h-12 rounded-lg border-border/70 bg-card pl-12 text-base"
                />
              </div>
            </Field>
            <Button
              onClick={() => setCategoriaDialogAberto(true)}
              variant="outline"
              className={cn('h-12 rounded-lg px-5 text-base font-semibold', pdvOutlineButtonClassName)}
            >
              <Search className="mr-2 size-5" />
              Mais categorias
            </Button>
          </div>

          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            <button
              type="button"
              onClick={() => setCategoriaAtiva('todos')}
              className={cn(
                'h-9 shrink-0 rounded-lg px-3 text-sm font-semibold transition',
                categoriaAtiva === 'todos'
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-border/70 bg-card text-foreground hover:border-primary',
              )}
            >
              Todos
            </button>
            {categorias.slice(0, 8).map((categoria) => (
              <button
                key={categoria.nome}
                type="button"
                onClick={() => setCategoriaAtiva(categoria.nome)}
                className={cn(
                  'h-9 shrink-0 rounded-lg px-3 text-sm font-semibold transition',
                  categoriaAtiva === categoria.nome
                    ? 'bg-primary text-primary-foreground'
                    : 'border border-border/70 bg-card text-foreground hover:border-primary',
                )}
              >
                {categoria.nome}
                <span className="ml-1.5 text-xs opacity-70">{categoria.total}</span>
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 pr-1">
            <div className="grid grid-cols-2 gap-2 pb-6 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {loadingCatalogo ? (
              <div className="col-span-full grid min-h-72 place-items-center rounded-lg border border-border/70 bg-card">
                <Loader2 className="size-8 animate-spin text-primary" />
              </div>
            ) : produtosFiltrados.length === 0 ? (
              <div className="col-span-full grid min-h-72 place-items-center rounded-lg border border-border/70 bg-card text-muted-foreground">
                Nenhum item encontrado.
              </div>
            ) : (
              produtosFiltrados.map((produto) => (
                <button
                  key={`${produto.tipo}-${produto.id}`}
                  type="button"
                  onClick={() => adicionarItem(produto)}
                  className="group flex min-h-[7.25rem] flex-col justify-between rounded-lg border border-border/70 bg-card p-3.5 text-left shadow-none transition hover:border-primary/45 hover:bg-accent/40 active:scale-[0.99]"
                >
                  <div>
                    <Badge variant="outline" className="mb-2 rounded-md border-primary/25 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary shadow-none hover:bg-primary/10">
                      {produto.categoria}
                    </Badge>
                    <h2 className="line-clamp-3 text-sm font-semibold leading-snug tracking-tight text-foreground">{produto.nome}</h2>
                  </div>
                  <div className="mt-3 flex items-end justify-between gap-2">
                    <span className="font-mono text-base font-semibold tabular-nums text-primary">{formatarMoeda(produto.preco)}</span>
                    <span className="grid size-9 place-items-center rounded-md bg-primary text-primary-foreground transition group-hover:bg-primary/90">
                      <Plus className="size-5" />
                    </span>
                  </div>
                </button>
              ))
            )}
            </div>
          </div>
        </div>

        <aside className="space-y-3 pb-6 lg:pb-0">
          <section className="rounded-lg border border-border/70 bg-card p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold tracking-tight">Cliente</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">Nome ou telefone do cliente.</p>
              </div>
              <UserRound className="size-5 text-primary" />
            </div>
            <div className="space-y-3">
              <Field className="relative gap-1.5">
                <FieldLabel htmlFor="pdv-busca-cliente" className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Buscar cliente
                </FieldLabel>
                <Input
                  id="pdv-busca-cliente"
                  value={buscaCliente}
                  onChange={(event) => alterarBuscaCliente(event.target.value)}
                  placeholder="Buscar por nome ou telefone"
                  className="h-11 rounded-lg border-border/70 bg-card"
                />
                {(buscandoClientes || clientesEncontrados.length > 0) && (
                  <div className="absolute left-0 right-0 top-[4.75rem] z-20 rounded-lg border border-border/70 bg-card p-2 shadow-[0_8px_32px_-12px_rgba(15,23,42,0.12)]">
                    {buscandoClientes ? (
                      <div className="flex h-12 items-center justify-center text-sm text-muted-foreground">
                        <Loader2 className="mr-2 size-4 animate-spin text-primary" />
                        Buscando
                      </div>
                    ) : (
                      clientesEncontrados.map((cliente) => (
                        <button
                          key={cliente.id}
                          type="button"
                          onClick={() => selecionarCliente(cliente)}
                          className="flex w-full items-center justify-between rounded-lg px-3 py-3 text-left hover:bg-primary/10"
                        >
                          <span>
                            <strong className="block text-foreground">{cliente.nome || 'Cliente sem nome'}</strong>
                            <span className="text-sm text-muted-foreground">{cliente.telefone}</span>
                          </span>
                          <Check className="size-4 text-primary" />
                        </button>
                      ))
                    )}
                  </div>
                )}
              </Field>
              <div className="grid gap-2 sm:grid-cols-2">
                <Field className="gap-1.5">
                  <FieldLabel htmlFor="pdv-nome-cliente" className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Nome no pedido
                  </FieldLabel>
                  <Input
                    id="pdv-nome-cliente"
                    value={nomeCliente}
                    onChange={(event) => {
                      setNomeCliente(event.target.value)
                      setClienteSelecionado(null)
                    }}
                    placeholder="Ex.: Maria Silva"
                    aria-invalid={destacarNomeCliente}
                    className={cn(
                      'h-11 rounded-lg border-border/70 bg-card',
                      destacarNomeCliente && 'border-destructive bg-destructive/10 text-destructive placeholder:text-destructive/70',
                    )}
                  />
                </Field>
                <Field className="gap-1.5">
                  <FieldLabel htmlFor="pdv-telefone-cliente" className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Telefone
                  </FieldLabel>
                  <Input
                    id="pdv-telefone-cliente"
                    value={telefoneCliente}
                    onChange={(event) => {
                      setTelefoneCliente(event.target.value)
                      setClienteSelecionado(null)
                    }}
                    placeholder="(00) 00000-0000"
                    inputMode="tel"
                    className="h-11 rounded-lg border-border/70 bg-card"
                  />
                </Field>
              </div>
              {clienteSelecionado && (
                <Badge className="rounded-md bg-primary text-primary-foreground hover:bg-primary">
                  Cliente encontrado: {clienteSelecionado.nome || clienteSelecionado.telefone}
                </Badge>
              )}
              {destacarNomeCliente && (
                <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">
                  Informe o nome real do cliente para finalizar.
                </p>
              )}
            </div>
          </section>

          <section className="rounded-lg border border-border/70 bg-card">
            <div className="p-4 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight">Pedido atual</h2>
                  <p className="text-sm font-medium text-muted-foreground">
                    {totalItens} {totalItens === 1 ? 'item' : 'itens'} · {formatarMoeda(subtotal)}
                  </p>
                </div>
                <div className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
                  <ShoppingCart className="size-5" />
                </div>
              </div>
            </div>

            <div className="border-y border-border/70 bg-muted/40 p-3">
              {itens.length === 0 ? (
                <div className="grid min-h-24 place-items-center rounded-lg border border-dashed border-border/70 bg-card text-center text-sm text-muted-foreground">
                  Toque em um produto para começar.
                </div>
              ) : (
                <div className="space-y-2">
                  {itens.map((item, index) => {
                    const qtdPaga = obterQuantidadePaga(item.localId)
                    const descontoItem = calcularDescontoItem(item)
                    const subtotalItem = calcularSubtotalItem(item)
                    return (
                      <div key={item.localId} className="rounded-lg border border-border/70 bg-card p-2.5">
                        <div className="grid grid-cols-[1fr_auto] items-start gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="grid size-6 shrink-0 place-items-center rounded-md bg-primary text-xs font-semibold text-white">
                                {index + 1}
                              </span>
                              <h3 className="line-clamp-2 text-sm font-semibold leading-tight text-foreground">{item.nome}</h3>
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5 pl-8 text-xs text-muted-foreground">
                              <span>{item.quantidade} x {formatarMoeda(item.preco)}</span>
                              {qtdPaga > 0 && (
                                <span className="rounded-md border border-primary/30 bg-primary/10 px-1.5 py-0.5 font-semibold text-primary">
                                  Pago {qtdPaga}/{item.quantidade}
                                </span>
                              )}
                              {descontoItem > 0 && (
                                <span className="rounded-md border border-destructive/30 bg-destructive/10 px-1.5 py-0.5 font-semibold text-destructive">
                                  Desc. {formatarMoeda(descontoItem)}
                                </span>
                              )}
                              {item.observacoes.trim() && <span className="truncate">Obs.</span>}
                            </div>
                          </div>

                          <div className="flex shrink-0 items-center gap-2">
                            <strong className="font-mono text-sm font-semibold tabular-nums text-primary">
                              {formatarMoeda(subtotalItem)}
                            </strong>
                            <Button
                              type="button"
                              aria-label={`Abrir ações de ${item.nome}`}
                              onClick={() => setItemEditorLocalId(item.localId)}
                              className="size-9 rounded-lg border border-border/70 bg-card p-0 text-foreground hover:bg-primary/10"
                            >
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="sticky bottom-0 z-10 space-y-3 border-t border-border/70 bg-card p-3 shadow-[0_-10px_24px_-20px_rgba(15,23,42,0.45)]">
              <div className="grid gap-2">
                <div className="grid grid-cols-3 gap-1.5">
                  {TIPOS_ATENDIMENTO.map((tipo) => {
                    const Icon = tipo.icon
                    const ativo = tipoAtendimento === tipo.id
                    return (
                      <Button
                        key={tipo.id}
                        onClick={() => {
                          selecionarAtendimento(tipo.id)
                          if (tipo.id === 'salao') setMesaDialogAberto(true)
                        }}
                        className={cn(
                          'h-9 rounded-lg text-xs font-semibold',
                          ativo
                            ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                            : 'border border-border/70 bg-card text-foreground hover:bg-primary/10',
                        )}
                      >
                        <Icon className="mr-1.5 size-4" />
                        {tipo.label}
                      </Button>
                    )
                  })}
                </div>
                {tipoAtendimento === 'salao' && (
                  <Button
                    onClick={() => setMesaDialogAberto(true)}
                    variant="outline"
                    className={cn('h-9 w-full rounded-lg text-xs font-semibold', pdvOutlineButtonClassName)}
                  >
                    <UsersRound className="mr-1.5 size-4" />
                    {mesaSelecionada ? labelPontoSalao(mesaSelecionada) : 'Selecionar mesa, comanda ou parceiro'}
                  </Button>
                )}
              </div>

              <Field className="gap-1.5">
                <FieldLabel className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Forma rápida
                </FieldLabel>
                <FieldDescription className="sr-only">
                  Escolha a forma de pagamento usada no fechamento do pedido.
                </FieldDescription>
                <div className="grid grid-cols-2 gap-1.5 min-[420px]:grid-cols-3 xl:grid-cols-5">
                  {FORMAS_PAGAMENTO.map((forma) => {
                    const Icon = forma.icon
                    return (
                      <Button
                        key={forma.id}
                        onClick={() => setFormaPagamento(forma.id)}
                        className={cn(
                          'h-11 rounded-lg px-2 text-xs font-semibold',
                          formaPagamento === forma.id
                            ? forma.classe
                            : 'border border-border/70 bg-card text-foreground hover:bg-primary/10',
                        )}
                      >
                        <Icon className="mr-1 size-3.5" />
                        {forma.label}
                      </Button>
                    )
                  })}
                </div>
              </Field>

              <div className="grid gap-2 sm:grid-cols-[10rem_1fr]">
                <label className="rounded-lg border border-border/70 bg-card px-2 py-1">
                  <span className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Desconto pedido
                  </span>
                  <Input
                    value={descontoPedidoInput}
                    onChange={(event) => {
                      if (valorPago > 0) {
                        toast.warning('Reverta pagamentos parciais antes de alterar o desconto geral.')
                        return
                      }
                      setDescontoPedidoInput(event.target.value)
                    }}
                    placeholder="0,00"
                    inputMode="decimal"
                    className="h-7 border-0 bg-transparent px-0 py-0 text-sm shadow-none focus-visible:ring-0"
                  />
                </label>
                <label className="rounded-lg border border-border/70 bg-card px-2 py-1">
                  <span className="block text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    Observações
                  </span>
                  <Input
                    value={observacoesPedido}
                    onChange={(event) => setObservacoesPedido(event.target.value)}
                    placeholder="Sem observação"
                    className="h-7 border-0 bg-transparent px-0 py-0 text-sm shadow-none focus-visible:ring-0"
                  />
                </label>
              </div>

              <div className="rounded-xl border border-border/70 bg-muted/40 p-2.5">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Bruto</span>
                  <strong className="font-mono text-foreground">{formatarMoeda(subtotalBruto)}</strong>
                </div>
                {(descontoItensTotal > 0 || descontoPedidoAplicado > 0) && (
                  <div className="mt-1 flex items-center justify-between text-xs text-destructive">
                    <span>Descontos</span>
                    <strong className="font-mono">-{formatarMoeda(descontoItensTotal + descontoPedidoAplicado)}</strong>
                  </div>
                )}
                <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Total</span>
                  <strong className="font-mono text-foreground">{formatarMoeda(subtotal)}</strong>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Pago por unidade</span>
                  <strong className="font-mono text-foreground">{formatarMoeda(valorPago)}</strong>
                </div>
                <div className="mt-1 flex items-center justify-between text-base">
                  <span className="font-semibold">Saldo</span>
                  <strong className={cn('font-mono tabular-nums', saldoAberto > 0 ? 'text-primary' : 'text-foreground')}>{formatarMoeda(saldoAberto)}</strong>
                </div>
              </div>

              <Button
                onClick={finalizarPedido}
                disabled={salvando}
                className="h-11 w-full rounded-xl bg-primary text-base font-semibold text-white hover:bg-primary/90"
              >
                {salvando ? <Loader2 className="mr-2 size-5 animate-spin" /> : <ReceiptText className="mr-2 size-5" />}
                Finalizar e imprimir
              </Button>
            </div>
          </section>

          {pedidoFinalizado && (
            <section className="rounded-lg border border-border/70 bg-card p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight">
                    Pedido {pedidoFinalizado.numero ? `#${pedidoFinalizado.numero}` : ''} finalizado
                  </h2>
                </div>
                <Clock3 className="size-5 text-primary" />
              </div>
              <div className="space-y-2">
                {pedidoFinalizado.itens.map((item, index) => (
                  <div key={item.itemPedidoId} className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-muted/40 p-3">
                    <div className="min-w-0">
                      <p className="text-sm text-muted-foreground">{String(index + 1).padStart(2, '0')}</p>
                      <strong className="line-clamp-1 text-foreground">{item.quantidade}x {item.nome}</strong>
                    </div>
                    <Button
                      onClick={() => imprimirItemFinalizado(item)}
                      className="h-10 shrink-0 rounded-lg bg-primary font-semibold text-white hover:bg-primary/90"
                    >
                      <Printer className="mr-2 size-5" />
                      Item
                    </Button>
                  </div>
                ))}
              </div>
            </section>
          )}
        </aside>
      </section>
        </TabsContent>

        <TabsContent value="pedidos" className="m-0 min-h-0 flex-1 overflow-hidden">
          <section className="flex h-full flex-col gap-4 p-3 lg:p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold tracking-tight text-foreground">Pedidos do dia</h2>
              <Button
                onClick={() => carregarPedidosDia()}
                variant="outline"
                className={cn('h-11 rounded-lg font-semibold', pdvOutlineButtonClassName)}
              >
                {loadingPedidosDia ? <Loader2 className="mr-2 size-4 animate-spin" /> : <RefreshCw className="mr-2 size-4" />}
                Atualizar
              </Button>
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.8} />
              <Input
                value={buscaPedidosDia}
                onChange={(event) => setBuscaPedidosDia(event.target.value)}
                placeholder="Buscar pedido, cliente, mesa, garçom ou item"
                className="h-11 rounded-lg border-border/70 bg-card pl-9 pr-10 text-foreground shadow-sm placeholder:text-muted-foreground focus-visible:ring-ring"
                aria-label="Buscar pedidos do dia"
              />
              {buscaPedidosDia && (
                <button
                  type="button"
                  onClick={() => setBuscaPedidosDia('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground"
                  aria-label="Limpar busca"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>

            <ScrollArea className="min-h-0 flex-1">
              {pedidosParaCards.length === 0 || pedidosParaCardsFiltrados.length === 0 ? (
                <div className="grid min-h-80 place-items-center rounded-lg border border-dashed border-border/70 bg-card text-center text-muted-foreground">
                  {buscaPedidosDia ? 'Nenhum pedido encontrado para essa busca.' : 'Nenhum pedido no dia operacional.'}
                </div>
              ) : (
                <div className="grid gap-3 pb-6 sm:grid-cols-2 xl:grid-cols-3">
                  {pedidosParaCardsFiltrados.map((pedido, index) => (
                    <CardPedido
                      key={pedido.id}
                      pedido={pedido}
                      index={index}
                      onVerDetalhes={(pedidoSelecionado) => {
                        setPedidoDetalhesId(pedidoSelecionado.id)
                        setModalDetalhesAberto(true)
                      }}
                      onEditar={abrirModalEdicaoPedido}
                      onConfirmarPagamento={confirmarPagamentoCard}
                      onConcluirPedido={concluirPedidoCard}
                      onImprimirCozinha={imprimirPedidoCard}
                      onExcluir={(pedidoSelecionado) => {
                        const pedidoDia = obterPedidoDiaOuAvisar(pedidoSelecionado.id)
                        if (pedidoDia) confirmarExclusaoPedido(pedidoDia)
                      }}
                      acoesEmAndamento={{
                        pagamento: acoesPedido[pedido.id]?.pagamento,
                        impressao: acoesPedido[pedido.id]?.impressao,
                        concluir: acoesPedido[pedido.id]?.concluir,
                      }}
                      rotuloResponsavel="Iniciado por"
                    />
                  ))}
                </div>
              )}
            </ScrollArea>
          </section>
        </TabsContent>

        <TabsContent value="mesas" className="m-0 min-h-0 flex-1 overflow-hidden">
          <section className="flex h-full flex-col gap-4 p-3 lg:p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold tracking-tight text-foreground">Mesas</h2>
              <Button
                onClick={() => {
                  void carregarMesas()
                  void carregarPedidosDia()
                }}
                variant="outline"
                className={cn('h-11 rounded-lg font-semibold', pdvOutlineButtonClassName)}
              >
                {loadingMesas ? <Loader2 className="mr-2 size-4 animate-spin" /> : <RefreshCw className="mr-2 size-4" />}
                Atualizar
              </Button>
            </div>

            <ScrollArea className="min-h-0 flex-1">
              <div className="space-y-4 pb-6">
                <PainelSalaoAtual
                  mesas={mesas}
                  pedidos={pedidosParaSalao}
                  tipo="mesa"
                  carregando={loadingMesas || loadingPedidosDia}
                  atualizandoPonto={atualizandoPontoSalao}
                  atribuindoPedidoId={null}
                  mostrarAtribuicao={false}
                  onAtualizar={() => {
                    void carregarMesas()
                    void carregarPedidosDia()
                  }}
                  onAbrirPedido={abrirPontoSalao}
                  onLiberarMesa={confirmarLiberacaoPonto}
                  onEstenderMesa={estenderPontoSalao}
                  onImprimirPedido={(pedido) => {
                    const pedidoDia = obterPedidoDiaOuAvisar(pedido.id)
                    if (pedidoDia) void executarAcaoPedido(pedido.id, 'impressao', () => imprimirPedidoDia(pedidoDia))
                  }}
                  onConfirmarPagamento={(pedido) => {
                    const pedidoDia = obterPedidoDiaOuAvisar(pedido.id)
                    if (pedidoDia) void executarAcaoPedido(pedido.id, 'pagamento', () => confirmarPagamentoPedido(pedidoDia))
                  }}
                  onExcluirPedido={(pedido) => {
                    const pedidoDia = obterPedidoDiaOuAvisar(pedido.id)
                    if (pedidoDia) confirmarExclusaoPedido(pedidoDia)
                  }}
                  acoesPedido={acoesPedido}
                  pontosEmFechamento={{}}
                />
                <PainelSalaoAtual
                  mesas={mesas}
                  pedidos={pedidosParaSalao}
                  tipo="local_externo"
                  carregando={loadingMesas || loadingPedidosDia}
                  atualizandoPonto={null}
                  atribuindoPedidoId={null}
                  mostrarAtribuicao={false}
                  onAtualizar={() => {
                    void carregarMesas()
                    void carregarPedidosDia()
                  }}
                  onAbrirPedido={abrirPontoSalao}
                  onLiberarMesa={confirmarLiberacaoPonto}
                  onImprimirPedido={(pedido) => {
                    const pedidoDia = obterPedidoDiaOuAvisar(pedido.id)
                    if (pedidoDia) void executarAcaoPedido(pedido.id, 'impressao', () => imprimirPedidoDia(pedidoDia))
                  }}
                  onConfirmarPagamento={(pedido) => {
                    const pedidoDia = obterPedidoDiaOuAvisar(pedido.id)
                    if (pedidoDia) void executarAcaoPedido(pedido.id, 'pagamento', () => confirmarPagamentoPedido(pedidoDia))
                  }}
                  onExcluirPedido={(pedido) => {
                    const pedidoDia = obterPedidoDiaOuAvisar(pedido.id)
                    if (pedidoDia) confirmarExclusaoPedido(pedidoDia)
                  }}
                  acoesPedido={acoesPedido}
                  pontosEmFechamento={{}}
                />
              </div>
            </ScrollArea>
          </section>
        </TabsContent>
      </Tabs>

      <AlertDialog
        open={Boolean(confirmacaoPdv?.aberto)}
        onOpenChange={(aberto) => {
          if (!aberto) setConfirmacaoPdv(null)
        }}
      >
        <AlertDialogContent className="border-border/70 bg-card text-foreground dark:bg-card dark:text-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmacaoPdv?.titulo || 'Confirmar ação'}</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              {confirmacaoPdv?.mensagem || 'Confirme para continuar.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className={cn('h-11 rounded-lg font-semibold', pdvOutlineButtonClassName)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              className={cn(
                'h-11 rounded-lg font-semibold',
                confirmacaoPdv?.variante === 'perigo'
                  ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90',
              )}
              onClick={(evento) => {
                evento.preventDefault()
                const acao = confirmacaoPdv?.onConfirmar
                setConfirmacaoPdv(null)
                if (acao) void acao()
              }}
            >
              {confirmacaoPdv?.textoConfirmar || 'Confirmar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={categoriaDialogAberto} onOpenChange={setCategoriaDialogAberto}>
        <DialogContent className="max-w-lg border-border/70 bg-card text-foreground dark:bg-card dark:text-foreground">
          <DialogHeader>
            <DialogTitle>Escolher categoria</DialogTitle>
          </DialogHeader>
          <Command className={pdvCommandClassName}>
            <CommandInput placeholder="Buscar categoria" className="dark:bg-card" />
            <CommandList className="bg-card">
              <CommandEmpty className="text-muted-foreground">Nenhuma categoria encontrada.</CommandEmpty>
              <CommandGroup>
                <CommandItem
                  value="todos"
                  onSelect={() => {
                    setCategoriaAtiva('todos')
                    setCategoriaDialogAberto(false)
                  }}
                  className="cursor-pointer"
                >
                  <div className="flex w-full items-center justify-between gap-3">
                    <span className="font-semibold">Todos</span>
                    <Badge className="rounded-md bg-primary/10 text-primary hover:bg-primary/10 dark:bg-primary/10 dark:text-primary">
                      {catalogo.length}
                    </Badge>
                  </div>
                </CommandItem>
                {categorias.map((categoria) => (
                  <CommandItem
                    key={categoria.nome}
                    value={categoria.nome}
                    onSelect={() => {
                      setCategoriaAtiva(categoria.nome)
                      setCategoriaDialogAberto(false)
                    }}
                    className="cursor-pointer"
                  >
                    <div className="flex w-full items-center justify-between gap-3">
                      <span className="font-semibold">{categoria.nome}</span>
                      <Badge className="rounded-md bg-primary/10 text-primary hover:bg-primary/10 dark:bg-primary/10 dark:text-primary">
                        {categoria.total}
                      </Badge>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>

      <ModalDetalhesPedido
        pedidoId={pedidoDetalhesId}
        aberto={modalDetalhesAberto}
        onFechar={() => {
          setModalDetalhesAberto(false)
          setPedidoDetalhesId(null)
          void carregarPedidosDia()
          void carregarMesas()
        }}
        onEditar={(pedido) => {
          setPedidoEdicao({
            ...pedido,
            taxa_servico: pedido.taxa_servico ?? 0,
            mesa_id: pedidoDiaPorId.get(pedido.id)?.mesa_id || null,
            mesa_identificador: pedidoDiaPorId.get(pedido.id)?.mesa_identificador || null,
            mesa_tipo: pedidoDiaPorId.get(pedido.id)?.mesa_tipo || null,
            nome_garcom: pedidoDiaPorId.get(pedido.id)?.nome_garcom || null,
          } as Pedido)
          setModalDetalhesAberto(false)
          setPedidoDetalhesId(null)
          setModalEditarAberto(true)
        }}
      />

      <ModalEditarPedido
        pedido={pedidoEdicao}
        aberto={modalEditarAberto}
        onFechar={() => {
          setModalEditarAberto(false)
          setPedidoEdicao(null)
        }}
        onSucesso={() => {
          void carregarPedidosDia()
          void carregarMesas()
        }}
      />

      <Dialog open={Boolean(itemEditor)} onOpenChange={(aberto) => !aberto && setItemEditorLocalId(null)}>
        <DialogContent className="max-w-lg border-border/70 bg-card text-foreground dark:bg-card dark:text-foreground">
          {itemEditor && (() => {
            const qtdPaga = obterQuantidadePaga(itemEditor.localId)
            const qtdRestante = Math.max(0, itemEditor.quantidade - qtdPaga)
            const descontoItem = calcularDescontoItem(itemEditor)
            const subtotalItem = calcularSubtotalItem(itemEditor)
            const quantidadeTravada = qtdPaga > 0

            return (
              <>
                <DialogHeader>
                  <DialogTitle>Ajustar item</DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                  <div className="rounded-xl border border-border/70 bg-muted/40 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="line-clamp-2 text-base font-semibold leading-tight">{itemEditor.nome}</h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {itemEditor.quantidade} x {formatarMoeda(itemEditor.preco)}
                          {qtdPaga > 0 && ` · pago ${qtdPaga}/${itemEditor.quantidade}`}
                        </p>
                      </div>
                      <strong className="shrink-0 font-mono text-lg font-semibold text-primary">
                        {formatarMoeda(subtotalItem)}
                      </strong>
                    </div>
                    {descontoItem > 0 && (
                      <div className="mt-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-semibold text-destructive">
                        Desconto aplicado: {formatarMoeda(descontoItem)}
                      </div>
                    )}
                  </div>

                  <div className="grid gap-3">
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                        Quantidade
                      </label>
                      <div className="grid grid-cols-[3rem_1fr_3rem] items-center gap-2">
                        <Button
                          type="button"
                          aria-label={`Diminuir ${itemEditor.nome}`}
                          disabled={quantidadeTravada}
                          onClick={() => alterarQuantidade(itemEditor.localId, itemEditor.quantidade - 1)}
                          className="h-11 rounded-lg border border-border/70 bg-card p-0 text-foreground hover:bg-primary/10 disabled:opacity-45"
                        >
                          <Minus className="size-5" />
                        </Button>
                        <div className="grid h-11 place-items-center rounded-lg border border-border/70 bg-card text-lg font-semibold tabular-nums">
                          {itemEditor.quantidade}
                        </div>
                        <Button
                          type="button"
                          aria-label={`Aumentar ${itemEditor.nome}`}
                          disabled={quantidadeTravada}
                          onClick={() => alterarQuantidade(itemEditor.localId, itemEditor.quantidade + 1)}
                          className="h-11 rounded-lg bg-primary p-0 text-white hover:bg-primary/90 disabled:opacity-45"
                        >
                          <Plus className="size-5" />
                        </Button>
                      </div>
                      {quantidadeTravada && (
                        <p className="mt-1.5 text-xs text-muted-foreground">Reverta as unidades pagas para mudar a quantidade.</p>
                      )}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                          Desconto do item
                        </label>
                        <Input
                          value={itemEditor.descontoManualInput}
                          onChange={(event) => atualizarDescontoItem(itemEditor.localId, event.target.value)}
                          placeholder="0,00"
                          inputMode="decimal"
                          className="h-11 rounded-lg border-border/70 bg-card"
                        />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                          Observação
                        </label>
                        <Input
                          value={itemEditor.observacoes}
                          onChange={(event) => atualizarObservacaoItem(itemEditor.localId, event.target.value)}
                          placeholder="Sem cebola, ponto, etc."
                          className="h-11 rounded-lg border-border/70 bg-card"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      disabled={qtdRestante <= 0}
                      onClick={() => pagarUnidades(itemEditor, 1)}
                      className="h-11 rounded-lg bg-primary font-semibold text-white hover:bg-primary/90 disabled:opacity-45"
                    >
                      <Check className="mr-2 size-4" />
                      Pagar 1
                    </Button>
                    <Button
                      type="button"
                      disabled={qtdRestante <= 0}
                      onClick={() => pagarUnidades(itemEditor, qtdRestante)}
                      className="h-11 rounded-lg border border-border/70 bg-card font-semibold text-foreground hover:bg-primary/10 disabled:opacity-45"
                    >
                      <CircleDollarSign className="mr-2 size-4" />
                      Pagar restante
                    </Button>
                    <Button
                      type="button"
                      disabled={qtdPaga <= 0}
                      onClick={() => reverterUnidades(itemEditor, 1)}
                      className="h-11 rounded-lg border border-border/70 bg-card font-semibold text-foreground hover:bg-primary/10 disabled:opacity-45"
                    >
                      <RotateCcw className="mr-2 size-4" />
                      Reverter 1
                    </Button>
                    <Button
                      type="button"
                      onClick={() => removerItem(itemEditor.localId)}
                      className="h-11 rounded-lg bg-destructive font-semibold text-white hover:bg-destructive/90"
                    >
                      <Trash2 className="mr-2 size-4" />
                      Remover
                    </Button>
                  </div>
                </div>
              </>
            )
          })()}
        </DialogContent>
      </Dialog>

      <Dialog open={mesaDialogAberto} onOpenChange={setMesaDialogAberto}>
        <DialogContent className="max-w-4xl border-border/70 bg-card text-foreground dark:bg-card dark:text-foreground">
          <DialogHeader>
            <DialogTitle>Selecionar mesa ou parceiro</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'mesa' as TipoPontoSalao, label: 'Mesas' },
                { id: 'comanda' as TipoPontoSalao, label: 'Comandas' },
                { id: 'local_externo' as TipoPontoSalao, label: 'Parceiros' },
              ].map((tipo) => (
                <Button
                  key={tipo.id}
                  type="button"
                  onClick={() => setTipoPontoSalao(tipo.id)}
                  className={cn(
                    'h-11 rounded-lg font-semibold',
                    tipoPontoSalao === tipo.id
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                      : 'border border-border/70 bg-card text-foreground hover:bg-primary/10',
                  )}
                >
                  {tipo.label}
                </Button>
              ))}
            </div>

            <div className="max-h-[62vh] overflow-y-auto pr-1">
              {pontosSalaoDialog.length === 0 ? (
                <div className="grid min-h-40 place-items-center rounded-lg border border-dashed border-border/70 text-center text-muted-foreground">
                  Nenhum ponto cadastrado.
                </div>
              ) : (
                <div className={cn('grid gap-2', tipoPontoSalao === 'local_externo' ? 'sm:grid-cols-2' : 'grid-cols-2 sm:grid-cols-4 lg:grid-cols-5')}>
                  {pontosSalaoDialog.map((ponto) => {
                    const parceiro = ponto.tipo === 'local_externo'
                    const ocupada = ponto.status === 'ocupada'
                    const selecionada = mesaSelecionada?.id === ponto.id
                    const bloqueada = !parceiro && ocupada && !selecionada

                    return (
                      <button
                        key={ponto.id}
                        type="button"
                        disabled={bloqueada}
                        onClick={() => {
                          selecionarMesa(ponto)
                          if (!bloqueada) setMesaDialogAberto(false)
                        }}
                        className={cn(
                          'min-h-24 rounded-lg border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          selecionada
                            ? 'border-primary bg-primary/10 text-foreground'
                            : parceiro
                              ? 'border-primary/25 bg-card text-foreground hover:border-primary hover:bg-primary/10'
                              : ocupada
                                ? 'border-destructive/30 bg-destructive/10 text-destructive'
                                : 'border-border/70 bg-card text-foreground hover:border-primary hover:bg-primary/10',
                          bloqueada && 'cursor-not-allowed opacity-70',
                        )}
                      >
                        <span className="block truncate text-base font-semibold">{labelPontoSalao(ponto)}</span>
                        <span className="mt-2 block truncate text-sm text-muted-foreground">
                          {parceiro ? 'Parceiro' : ocupada ? ponto.nome_cliente || 'Ocupada' : 'Livre'}
                        </span>
                        {selecionada && (
                          <Badge className="mt-3 rounded-md bg-primary text-primary-foreground hover:bg-primary">Selecionado</Badge>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  )
}
