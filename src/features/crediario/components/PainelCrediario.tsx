'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import {
  Banknote,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  Eye,
  FileText,
  History,
  Loader2,
  Phone,
  RefreshCw,
  Search,
  Trash2,
  Wallet,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { CHIP_FILTRO_DEFAULT } from '@/components/admin/filtros/chip-classes'
import { FiltrosAtivosChips, type ChipFiltroAtivo } from '@/components/admin/filtros/FiltrosAtivosChips'
import { ListaVazia, TabelaSkeleton } from '@/components/admin/filtros/ListaEstado'
import IconeWhatsApp from '@/components/icons/IconeWhatsApp'
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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MenuAcoes } from '@/components/ui/menu-acoes'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { PaginacaoFinancas } from '@/features/financas/components/PaginacaoFinancas'
import { carregarGarconsPorIds } from '@/lib/pedidos-utils'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { CONTA_DEMO_ID, quitarContaDemoCrediario, useDemoCrediario } from '@/features/onboarding'
import { CardContaCrediario } from './CardContaCrediario'
import { ModalFormaPagamentoItens } from '@/components/admin/pagamento/ModalFormaPagamentoItens'
import {
  normalizarQuantidadeUnidades,
  type ItemPagamento,
  type ItemPagoSnapshot,
} from '@/components/admin/pagamento/pagamentoItens'

const LIMITE_PADRAO = 15

type StatusConta = 'aberto' | 'quitado' | 'bloqueado' | 'arquivado'
type FiltroStatus = 'aberto' | 'quitado' | 'todos'
type FiltroOrigem = 'todos' | 'novo' | 'legado'
type OrdenacaoContas = 'recentes' | 'antigas' | 'maior_saldo' | 'menor_saldo'

type ContaCrediario = {
  id: string
  cliente_id: string | null
  cliente_nome: string
  telefone: string | null
  status: StatusConta
  saldo_atual: number
  limite_credito: number | null
  observacoes: string | null
  origem: string
  legado_id: string | null
  criado_em: string
  atualizado_em: string
  quitado_em: string | null
  total_movimentos: number
  total_consumos: number
  total_pagamentos: number
  total_consumos_valor: number
  total_pagamentos_valor: number
  ultimo_movimento_em: string | null
}

type MovimentoCrediario = {
  id: string
  conta_id: string
  pedido_id: string | null
  tipo: 'consumo' | 'pagamento' | 'ajuste' | 'estorno'
  status: 'ativo' | 'cancelado'
  valor: number
  descricao: string | null
  itens: unknown
  origem: string
  realizado_em: string
  criado_em: string
  nome_responsavel_pedido?: string | null
}

type MovimentoProgressoCrediario = Pick<
  MovimentoCrediario,
  'conta_id' | 'tipo' | 'status' | 'valor' | 'realizado_em' | 'criado_em'
>

type ItemMovimentoCrediario = {
  id?: string
  nome: string
  quantidade: number
  precoUnitario: number
  subtotal: number
  observacoes?: string | null
  criadoEm?: string | null
}

type CicloCrediario = {
  id: string
  movimentos: MovimentoCrediario[]
  consumos: MovimentoCrediario[]
  pagamentos: MovimentoCrediario[]
  totalConsumido: number
  totalPago: number
  saldo: number
  pago: boolean
  inicioEm: string | null
  fimEm: string | null
}

type ConfirmacaoCrediario =
  | { tipo: 'movimento'; movimento: MovimentoCrediario }
  | { tipo: 'item'; movimento: MovimentoCrediario; itemIndice: number; itemNome: string }
  | { tipo: 'reverter-ciclo'; ciclo: CicloCrediario }
  | null

type JsPdfComAutoTable = jsPDF & {
  lastAutoTable?: {
    finalY: number
  }
}

const moeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const paraNumero = (valor: unknown) => {
  const numero = Number(valor)
  return Number.isFinite(numero) ? numero : 0
}

const obterMensagemErro = (error: unknown) => {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) return String((error as { message?: unknown }).message || '')
  return ''
}

const formatarData = (valor?: string | null) => {
  if (!valor) return '--'
  return format(new Date(valor), "dd/MM/yyyy 'as' HH:mm", { locale: ptBR })
}

const formatarTelefone = (telefone?: string | null) => {
  const digitos = String(telefone || '').replace(/\D/g, '')
  if (digitos.length === 11) return digitos.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
  if (digitos.length === 10) return digitos.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
  return telefone || '--'
}

const temWhatsAppValido = (telefone?: string | null) => {
  const digitos = String(telefone || '').replace(/\D/g, '')
  if (digitos.startsWith('55')) return digitos.length === 12 || digitos.length === 13
  return digitos.length === 10 || digitos.length === 11
}

const carregarNomesResponsaveisPorPedidoIds = async (pedidoIds: string[]) => {
  const resultado = new Map<string, string>()
  const idsUnicos = Array.from(new Set(pedidoIds.filter(Boolean)))
  if (idsUnicos.length === 0) return resultado

  const { data, error } = await supabase
    .from('pedidos')
    .select('id, garcom_id')
    .in('id', idsUnicos)

  if (error) {
    console.error('[Crediario] Erro ao carregar responsaveis dos pedidos:', error)
    return resultado
  }

  const pedidos = (data || []) as Array<{ id: string; garcom_id: string | null }>
  const garconIds = Array.from(new Set(pedidos.map((pedido) => pedido.garcom_id).filter(Boolean))) as string[]
  const nomesPorGarcom = await carregarGarconsPorIds(garconIds)

  pedidos.forEach((pedido) => {
    if (!pedido.garcom_id) return
    const nome = nomesPorGarcom.get(pedido.garcom_id)
    if (nome) resultado.set(pedido.id, nome)
  })

  return resultado
}

const normalizarTexto = (valor: string) => {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

const statusLabel: Record<StatusConta, string> = {
  aberto: 'Aberto',
  quitado: 'Quitado',
  bloqueado: 'Bloqueado',
  arquivado: 'Arquivado',
}

const FieldGroupCrediario = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="border-t border-border/70 pt-5 first:border-t-0 first:pt-0">
    <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {title}
    </h3>
    {children}
  </section>
)

const InlineFactCrediario = ({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: string
}) => (
  <div className="flex min-w-[8rem] items-start gap-2">
    <span className="mt-0.5 text-muted-foreground [&_svg]:size-3.5" aria-hidden>
      {icon}
    </span>
    <p className="grid gap-0.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="text-sm text-foreground">{value}</span>
    </p>
  </div>
)

const DetailRowCrediario = ({
  icon,
  label,
  value,
}: {
  icon?: ReactNode
  label: string
  value: string | null | undefined
}) => {
  const filled = Boolean(value && value !== '--' && value !== '—')
  return (
    <div className="grid min-w-0 grid-cols-[1.25rem_minmax(0,1fr)] gap-x-2 border-b border-border/60 py-2.5 last:border-b-0">
      <span
        className="mt-0.5 flex size-5 items-center justify-center text-muted-foreground [&_svg]:size-3.5"
        aria-hidden
      >
        {icon ?? <span className="size-1.5 rounded-full bg-muted-foreground/50" />}
      </span>
      <dt className="min-w-0 text-xs text-muted-foreground">{label}</dt>
      <dd className="col-start-2 min-w-0 truncate text-sm text-foreground">
        {filled ? value : '—'}
      </dd>
    </div>
  )
}

const extrairItensMovimento = (itens: unknown): ItemMovimentoCrediario[] => {
  if (!Array.isArray(itens)) return []

  return itens.map((item) => {
    const registro = item as Record<string, unknown>
    const quantidade = paraNumero(registro.quantidade ?? registro.quantity ?? 1) || 1
    const precoUnitario = paraNumero(
      registro.preco_unitario
      ?? registro.unitPriceWithComplements
      ?? registro.unit_price_with_complements
      ?? registro.preco
      ?? registro.basePrice
      ?? registro.base_price
      ?? 0,
    )
    const subtotal = paraNumero(
      registro.subtotal
      ?? registro.total_item_price
      ?? registro.totalItemPrice
      ?? registro.totalPrice
      ?? registro.preco_total
      ?? 0,
    ) || precoUnitario * quantidade

    return {
      id: registro.id ? String(registro.id) : undefined,
      nome: String(registro.nome || registro.name || 'Item'),
      quantidade,
      precoUnitario,
      subtotal,
      observacoes: registro.observacoes || registro.observacao || registro.notes || registro.comment
        ? String(registro.observacoes || registro.observacao || registro.notes || registro.comment)
        : null,
      criadoEm: registro.created_at || registro.adicionado_em ? String(registro.created_at || registro.adicionado_em) : null,
    }
  })
}

const ordenarMovimentosProgresso = <T extends MovimentoProgressoCrediario>(movimentos: T[]) => {
  return [...movimentos].sort((a, b) => {
    const dataA = new Date(a.realizado_em || a.criado_em).getTime()
    const dataB = new Date(b.realizado_em || b.criado_em).getTime()
    return dataA - dataB
  })
}

const sinalMovimentoCrediario = (movimento: MovimentoProgressoCrediario) => {
  const valor = Math.max(0, paraNumero(movimento.valor))
  if (movimento.tipo === 'consumo' || movimento.tipo === 'ajuste') return valor
  if (movimento.tipo === 'pagamento' || movimento.tipo === 'estorno') return -valor
  return 0
}

const ehConsumoCrediario = (movimento: MovimentoProgressoCrediario) => {
  return movimento.tipo === 'consumo' || movimento.tipo === 'ajuste'
}

const ehPagamentoCrediario = (movimento: MovimentoProgressoCrediario) => {
  return movimento.tipo === 'pagamento' || movimento.tipo === 'estorno'
}

const montarCicloCrediario = (movimentos: MovimentoCrediario[], indice: number, pago: boolean): CicloCrediario => {
  const consumos = movimentos.filter(ehConsumoCrediario)
  const pagamentos = movimentos.filter(ehPagamentoCrediario)
  const totalConsumido = consumos.reduce((total, movimento) => total + Math.max(0, paraNumero(movimento.valor)), 0)
  const totalPago = pagamentos.reduce((total, movimento) => total + Math.max(0, paraNumero(movimento.valor)), 0)
  const primeiroMovimento = movimentos[0]
  const ultimoMovimento = movimentos[movimentos.length - 1]

  return {
    id: `${primeiroMovimento?.id || 'ciclo'}-${indice}`,
    movimentos,
    consumos,
    pagamentos,
    totalConsumido,
    totalPago,
    saldo: Math.max(0, totalConsumido - totalPago),
    pago,
    inicioEm: primeiroMovimento?.realizado_em || primeiroMovimento?.criado_em || null,
    fimEm: ultimoMovimento?.realizado_em || ultimoMovimento?.criado_em || null,
  }
}

const montarCiclosCrediario = (movimentos: MovimentoCrediario[]) => {
  const ativos = ordenarMovimentosProgresso(movimentos).filter((movimento) => movimento.status === 'ativo')
  const ciclos: CicloCrediario[] = []
  let grupoAtual: MovimentoCrediario[] = []
  let saldoGrupo = 0
  let temConsumo = false

  ativos.forEach((movimento) => {
    grupoAtual.push(movimento)
    saldoGrupo += sinalMovimentoCrediario(movimento)
    if (ehConsumoCrediario(movimento)) temConsumo = true

    if (temConsumo && saldoGrupo <= 0.009) {
      ciclos.push(montarCicloCrediario(grupoAtual, ciclos.length, true))
      grupoAtual = []
      saldoGrupo = 0
      temConsumo = false
    }
  })

  if (grupoAtual.length > 0) {
    ciclos.push(montarCicloCrediario(grupoAtual, ciclos.length, false))
  }

  return ciclos
}

const separarMovimentosPorCicloAtual = <T extends MovimentoProgressoCrediario>(movimentos: T[], saldoAtual?: number) => {
  const ativos = ordenarMovimentosProgresso(movimentos).filter((movimento) => movimento.status === 'ativo')
  const saldoEsperado = paraNumero(saldoAtual)

  if (saldoEsperado > 0 && ativos.length > 0) {
    let saldoSufixo = 0
    let temConsumoNoSufixo = false

    for (let indice = ativos.length - 1; indice >= 0; indice -= 1) {
      const movimento = ativos[indice]
      saldoSufixo += sinalMovimentoCrediario(movimento)
      if (movimento.tipo === 'consumo' || movimento.tipo === 'ajuste') temConsumoNoSufixo = true

      if (temConsumoNoSufixo && Math.abs(saldoSufixo - saldoEsperado) <= 0.009) {
        const movimentosQuitados = ativos.slice(0, indice)
        const movimentosAtuais = ativos.slice(indice)

        return {
          atuais: [...movimentosAtuais].reverse(),
          quitados: [...movimentosQuitados].reverse(),
        }
      }
    }
  }

  let saldoCorrente = 0
  let ultimoIndiceQuitado = -1

  ativos.forEach((movimento, indice) => {
    saldoCorrente += sinalMovimentoCrediario(movimento)
    if (saldoCorrente <= 0.009) ultimoIndiceQuitado = indice
  })

  const movimentosQuitados = ativos.slice(0, ultimoIndiceQuitado + 1)
  const movimentosAtuais = ativos.slice(ultimoIndiceQuitado + 1)

  return {
    atuais: [...movimentosAtuais].reverse(),
    quitados: [...movimentosQuitados].reverse(),
  }
}

const calcularProgressoPagamento = (
  conta: Pick<ContaCrediario, 'saldo_atual' | 'status' | 'total_consumos_valor' | 'total_pagamentos_valor' | 'total_consumos' | 'total_pagamentos'>,
  movimentos?: MovimentoProgressoCrediario[],
) => {
  if (movimentos && movimentos.length > 0) {
    const cicloAtual = conta.status === 'quitado'
      ? ordenarMovimentosProgresso(movimentos).filter((movimento) => movimento.status === 'ativo')
      : separarMovimentosPorCicloAtual(movimentos, conta.saldo_atual).atuais
    const consumos = cicloAtual.filter((movimento) => movimento.tipo === 'consumo' || movimento.tipo === 'ajuste')
    const pagamentos = cicloAtual.filter((movimento) => movimento.tipo === 'pagamento' || movimento.tipo === 'estorno')
    const totalConsumido = consumos.reduce((total, movimento) => total + Math.max(0, paraNumero(movimento.valor)), 0)
    const totalPago = pagamentos.reduce((total, movimento) => total + Math.max(0, paraNumero(movimento.valor)), 0)
    const saldo = Math.max(0, totalConsumido - totalPago)
    const percentual = totalConsumido > 0 ? Math.min(100, Math.max(0, (totalPago / totalConsumido) * 100)) : conta.status === 'quitado' ? 100 : 0

    return {
      totalConsumido,
      totalPago,
      saldo,
      percentual,
      temPagamentoParcial: totalPago > 0 && saldo > 0,
      totalConsumos: consumos.length,
      totalPagamentos: pagamentos.length,
    }
  }

  const saldo = Math.max(0, paraNumero(conta.saldo_atual))
  const totalPago = conta.status === 'quitado' ? Math.max(0, paraNumero(conta.total_pagamentos_valor)) : 0
  const base = conta.status === 'quitado'
    ? Math.max(0, paraNumero(conta.total_consumos_valor))
    : saldo
  const percentual = conta.status === 'quitado' && base > 0
    ? Math.min(100, Math.max(0, (totalPago / base) * 100))
    : conta.status === 'quitado'
      ? 100
      : 0

  return {
    totalConsumido: base,
    totalPago,
    saldo,
    percentual,
    temPagamentoParcial: false,
    totalConsumos: conta.status === 'quitado' ? conta.total_consumos : saldo > 0 ? 1 : 0,
    totalPagamentos: conta.status === 'quitado' ? conta.total_pagamentos : 0,
  }
}

export default function PainelCrediario() {
  const router = useRouter()
  const [contas, setContas] = useState<ContaCrediario[]>([])
  const [movimentos, setMovimentos] = useState<MovimentoCrediario[]>([])
  const [movimentosResumoPorConta, setMovimentosResumoPorConta] = useState<Map<string, MovimentoProgressoCrediario[]>>(new Map())
  const [responsaveisResumoPorConta, setResponsaveisResumoPorConta] = useState<Map<string, string>>(new Map())
  const [contaSelecionadaId, setContaSelecionadaId] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('aberto')
  const [filtroOrigem, setFiltroOrigem] = useState<FiltroOrigem>('novo')
  const [ordenacao, setOrdenacao] = useState<OrdenacaoContas>('recentes')
  const [pagina, setPagina] = useState(1)
  const [limite, setLimite] = useState(LIMITE_PADRAO)
  const [carregandoContas, setCarregandoContas] = useState(true)
  const [carregandoMovimentos, setCarregandoMovimentos] = useState(false)
  const [dialogDetalhesAberto, setDialogDetalhesAberto] = useState(false)
  const [dialogPagamentoAberto, setDialogPagamentoAberto] = useState(false)
  const [pagamentoItemAberto, setPagamentoItemAberto] = useState<{
    movimento: MovimentoCrediario
    item: ItemMovimentoCrediario
    quantidadesPorItem: Record<string, number>
  } | null>(null)
  const [contaPagamentoId, setContaPagamentoId] = useState<string | null>(null)
  const [valorPagamento, setValorPagamento] = useState('')
  const [descricaoPagamento, setDescricaoPagamento] = useState('')
  const [metadataPagamento, setMetadataPagamento] = useState<Record<string, unknown>>({})
  const [confirmacao, setConfirmacao] = useState<ConfirmacaoCrediario>(null)
  const [processando, setProcessando] = useState(false)
  const [contaCobrancaId, setContaCobrancaId] = useState<string | null>(null)
  const [solicitarTelefoneCobranca, setSolicitarTelefoneCobranca] = useState(false)
  const [telefoneCobranca, setTelefoneCobranca] = useState('')
  const [cobrancaEmEnvioId, setCobrancaEmEnvioId] = useState<string | null>(null)
  const [mostrarMovimentacoesAntigas, setMostrarMovimentacoesAntigas] = useState(false)
  const contaSelecionadaIdRef = useRef<string | null>(null)

  useEffect(() => {
    contaSelecionadaIdRef.current = contaSelecionadaId
  }, [contaSelecionadaId])

  const abrirPedidoDoCrediario = (movimento: MovimentoCrediario) => {
    if (movimento.tipo !== 'consumo') return
    if (!movimento.pedido_id) {
      toast.error('Pedido legado sem vínculo', {
        description: 'Este consumo não está ligado a um pedido no sistema atual.',
      })
      return
    }
    setDialogDetalhesAberto(false)
    router.push(`/admin/pedidos?pedido=${movimento.pedido_id}`)
  }
  const carregarContas = useCallback(async (opcoes?: { silencioso?: boolean }) => {
    const silencioso = Boolean(opcoes?.silencioso)
    try {
      if (!silencioso) setCarregandoContas(true)
      const { data, error } = await supabase
        .from('vw_crediario_contas_resumo')
        .select('*')
        .order('saldo_atual', { ascending: false })
        .order('atualizado_em', { ascending: false })

      if (error) throw error

      const contasFormatadas = ((data || []) as Array<Record<string, unknown>>).map((conta) => ({
        id: String(conta.id),
        cliente_id: conta.cliente_id ? String(conta.cliente_id) : null,
        cliente_nome: String(conta.cliente_nome || 'Cliente'),
        telefone: conta.telefone ? String(conta.telefone) : null,
        status: String(conta.status || 'aberto') as StatusConta,
        saldo_atual: paraNumero(conta.saldo_atual),
        limite_credito: conta.limite_credito === null ? null : paraNumero(conta.limite_credito),
        observacoes: conta.observacoes ? String(conta.observacoes) : null,
        origem: String(conta.origem || 'manual'),
        legado_id: conta.legado_id ? String(conta.legado_id) : null,
        criado_em: String(conta.criado_em),
        atualizado_em: String(conta.atualizado_em),
        quitado_em: conta.quitado_em ? String(conta.quitado_em) : null,
        total_movimentos: paraNumero(conta.total_movimentos),
        total_consumos: paraNumero(conta.total_consumos),
        total_pagamentos: paraNumero(conta.total_pagamentos),
        total_consumos_valor: paraNumero(conta.total_consumos_valor),
        total_pagamentos_valor: paraNumero(conta.total_pagamentos_valor),
        ultimo_movimento_em: conta.ultimo_movimento_em ? String(conta.ultimo_movimento_em) : null,
      }))

      const resumoMovimentos = new Map<string, MovimentoProgressoCrediario[]>()
      const pedidoMaisRecentePorConta = new Map<string, string>()
      const idsContas = contasFormatadas.map((conta) => conta.id)

      if (idsContas.length > 0) {
        const { data: movimentosResumo, error: erroMovimentosResumo } = await supabase
          .from('crediario_movimentos')
          .select('conta_id, pedido_id, tipo, status, valor, realizado_em, criado_em')
          .in('conta_id', idsContas)
          .order('realizado_em', { ascending: true })

        if (erroMovimentosResumo) {
          console.error('[Crediario] Erro ao carregar resumo de movimentos:', erroMovimentosResumo)
        } else {
          ;((movimentosResumo || []) as Array<Record<string, unknown>>).forEach((movimento) => {
            const contaId = String(movimento.conta_id || '')
            if (!contaId) return

            const tipo = String(movimento.tipo || 'consumo') as MovimentoCrediario['tipo']
            const status = String(movimento.status || 'ativo') as MovimentoCrediario['status']
            const listaAtual = resumoMovimentos.get(contaId) || []
            listaAtual.push({
              conta_id: contaId,
              tipo,
              status,
              valor: paraNumero(movimento.valor),
              realizado_em: String(movimento.realizado_em || ''),
              criado_em: String(movimento.criado_em || ''),
            })
            resumoMovimentos.set(contaId, listaAtual)

            if (tipo === 'consumo' && status === 'ativo' && movimento.pedido_id) {
              pedidoMaisRecentePorConta.set(contaId, String(movimento.pedido_id))
            }
          })
        }
      }

      const nomesPorPedido = await carregarNomesResponsaveisPorPedidoIds(Array.from(pedidoMaisRecentePorConta.values()))
      const responsaveisResumo = new Map<string, string>()
      pedidoMaisRecentePorConta.forEach((pedidoId, contaId) => {
        const nome = nomesPorPedido.get(pedidoId)
        if (nome) responsaveisResumo.set(contaId, nome)
      })

      setMovimentosResumoPorConta(resumoMovimentos)
      setResponsaveisResumoPorConta(responsaveisResumo)
      setContas(contasFormatadas)
      setContaSelecionadaId((atual) => {
        if (atual && contasFormatadas.some((conta) => conta.id === atual)) return atual
        return null
      })
    } catch (error) {
      console.error('[Crediario] Erro ao carregar contas:', error)
      toast.error('Nao foi possivel carregar o crediario')
    } finally {
      if (!silencioso) setCarregandoContas(false)
    }
  }, [])

  const carregarMovimentos = useCallback(async (contaId: string) => {
    try {
      setCarregandoMovimentos(true)
      const { data, error } = await supabase
        .from('crediario_movimentos')
        .select('id, conta_id, pedido_id, tipo, status, valor, descricao, itens, origem, realizado_em, criado_em')
        .eq('conta_id', contaId)
        .order('realizado_em', { ascending: false })

      if (error) throw error

      const registros = (data || []) as Array<Record<string, unknown>>
      const nomesPorPedido = await carregarNomesResponsaveisPorPedidoIds(
        registros.map((movimento) => movimento.pedido_id ? String(movimento.pedido_id) : ''),
      )

      setMovimentos(registros.map((movimento) => ({
        id: String(movimento.id),
        conta_id: String(movimento.conta_id),
        pedido_id: movimento.pedido_id ? String(movimento.pedido_id) : null,
        tipo: String(movimento.tipo || 'consumo') as MovimentoCrediario['tipo'],
        status: String(movimento.status || 'ativo') as MovimentoCrediario['status'],
        valor: paraNumero(movimento.valor),
        descricao: movimento.descricao ? String(movimento.descricao) : null,
        itens: movimento.itens,
        origem: String(movimento.origem || 'manual'),
        realizado_em: String(movimento.realizado_em),
        criado_em: String(movimento.criado_em),
        nome_responsavel_pedido: movimento.pedido_id ? nomesPorPedido.get(String(movimento.pedido_id)) || null : null,
      })))
    } catch (error) {
      console.error('[Crediario] Erro ao carregar movimentos:', error)
      toast.error('Nao foi possivel carregar o historico')
    } finally {
      setCarregandoMovimentos(false)
    }
  }, [])

  // Conta de exemplo do onboarding (client-side): mapeada para o mesmo shape
  // das contas reais para fluir pela lista e abrir o MODAL REAL da tela. Nunca
  // grava no Supabase (ver AGENTS §0.2.5 e §5 — reusar, não criar modal novo).
  const demoCrediario = useDemoCrediario()

  const demoConta = useMemo<ContaCrediario | null>(() => {
    const c = demoCrediario.conta
    if (!c) return null
    const totalConsumos = c.consumos.reduce((s, i) => s + i.quantidade * i.precoUnitario, 0)
    return {
      id: c.id,
      cliente_id: null,
      cliente_nome: c.cliente_nome,
      telefone: c.telefone,
      status: c.status,
      saldo_atual: c.saldo_atual,
      limite_credito: null,
      observacoes: null,
      origem: 'tutorial',
      legado_id: null,
      criado_em: c.criado_em,
      atualizado_em: c.criado_em,
      quitado_em: c.status === 'quitado' ? new Date().toISOString() : null,
      total_movimentos: c.consumos.length,
      total_consumos: c.consumos.length,
      total_pagamentos: 0,
      total_consumos_valor: totalConsumos,
      total_pagamentos_valor: 0,
      ultimo_movimento_em: c.criado_em,
    }
  }, [demoCrediario.conta])

  const demoMovimentos = useMemo<MovimentoCrediario[]>(() => {
    const c = demoCrediario.conta
    if (!c) return []
    return c.consumos.map((item, indice) => ({
      id: `${CONTA_DEMO_ID}-mov-${indice}`,
      conta_id: c.id,
      pedido_id: null,
      tipo: 'consumo',
      status: 'ativo',
      valor: item.quantidade * item.precoUnitario,
      descricao: `${item.quantidade}x ${item.nome}`,
      itens: [
        {
          nome: item.nome,
          quantidade: item.quantidade,
          preco_unitario: item.precoUnitario,
          subtotal: item.quantidade * item.precoUnitario,
        },
      ],
      origem: 'tutorial',
      realizado_em: c.criado_em,
      criado_em: c.criado_em,
      nome_responsavel_pedido: null,
    }))
  }, [demoCrediario.conta])

  useEffect(() => {
    void carregarContas()

    const canal = supabase
      .channel('admin-crediario')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crediario_contas' }, () => {
        void carregarContas({ silencioso: true })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crediario_movimentos' }, () => {
        void carregarContas({ silencioso: true })
        const idSelecionado = contaSelecionadaIdRef.current
        if (idSelecionado) void carregarMovimentos(idSelecionado)
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(canal)
    }
  }, [carregarContas, carregarMovimentos])

  useEffect(() => {
    if (!contaSelecionadaId) {
      setMovimentos([])
      setCarregandoMovimentos(false)
      return
    }
    // Conta de exemplo do tutorial: usa os movimentos simulados, sem tocar o banco.
    if (contaSelecionadaId === CONTA_DEMO_ID) {
      setMovimentos(demoMovimentos)
      setCarregandoMovimentos(false)
      return
    }
    void carregarMovimentos(contaSelecionadaId)
  }, [carregarMovimentos, contaSelecionadaId, demoMovimentos])

  // Abre/fecha o MODAL REAL quando o tour pede (etapas modal-*). Só abre; o
  // fechamento acontece quando o tour sai das etapas de modal ou termina.
  useEffect(() => {
    if (!demoConta) return
    if (demoCrediario.modalAberto) {
      setContaSelecionadaId(CONTA_DEMO_ID)
      setDialogDetalhesAberto(true)
    } else if (contaSelecionadaIdRef.current === CONTA_DEMO_ID) {
      setDialogDetalhesAberto(false)
      setContaSelecionadaId(null)
      setMovimentos([])
    }
  }, [demoCrediario.modalAberto, demoConta])

  // Ao encerrar o tour (conta de exemplo removida), fecha o modal se estava nela.
  useEffect(() => {
    if (!demoConta && contaSelecionadaIdRef.current === CONTA_DEMO_ID) {
      setDialogDetalhesAberto(false)
      setContaSelecionadaId(null)
      setMovimentos([])
    }
  }, [demoConta])

  const contasFiltradas = useMemo(() => {
    const termo = normalizarTexto(busca.trim())
    const filtradas = contas.filter((conta) => {
      const statusOk = filtroStatus === 'todos' || conta.status === filtroStatus
      if (!statusOk) return false
      const legado = conta.origem === 'migracao_edienai_antigo'
      if (filtroOrigem === 'novo' && legado) return false
      if (filtroOrigem === 'legado' && !legado) return false
      if (!termo) return true

      const alvo = normalizarTexto(`${conta.cliente_nome} ${conta.telefone || ''} ${conta.legado_id || ''}`)
      return alvo.includes(termo)
    })
    const ordenadas = [...filtradas].sort((primeira, segunda) => {
      if (ordenacao === 'maior_saldo') return segunda.saldo_atual - primeira.saldo_atual
      if (ordenacao === 'menor_saldo') return primeira.saldo_atual - segunda.saldo_atual
      const diferencaData = new Date(segunda.atualizado_em).getTime() - new Date(primeira.atualizado_em).getTime()
      return ordenacao === 'recentes' ? diferencaData : -diferencaData
    })
    // A conta de exemplo fica sempre no topo enquanto o tour estiver ativo,
    // independentemente dos filtros (senão sumiria ao ser quitada).
    return demoConta ? [demoConta, ...ordenadas] : ordenadas
  }, [busca, contas, demoConta, filtroOrigem, filtroStatus, ordenacao])

  useEffect(() => {
    setPagina(1)
  }, [busca, filtroOrigem, filtroStatus, ordenacao, contas])

  const totalPaginas = Math.max(1, Math.ceil(contasFiltradas.length / limite))

  useEffect(() => {
    if (pagina > totalPaginas) setPagina(totalPaginas)
  }, [pagina, totalPaginas])

  const contasPagina = useMemo(() => {
    const inicio = (pagina - 1) * limite
    return contasFiltradas.slice(inicio, inicio + limite)
  }, [contasFiltradas, pagina, limite])

  const chipsFiltroAtivo = useMemo(() => {
    const chips: ChipFiltroAtivo[] = []
    if (filtroStatus !== 'aberto') {
      chips.push({
        key: 'status',
        label: 'Status',
        value: filtroStatus === 'quitado' ? 'Quitadas' : 'Todas',
      })
    }
    if (filtroOrigem !== 'novo') {
      chips.push({
        key: 'origem',
        label: 'Origem',
        value: filtroOrigem === 'legado' ? 'Sistema antigo' : 'Tudo',
      })
    }
    if (busca.trim()) {
      chips.push({ key: 'busca', label: 'Busca', value: busca.trim() })
    }
    return chips
  }, [busca, filtroOrigem, filtroStatus])

  const handleLimparFiltros = () => {
    setFiltroStatus('aberto')
    setFiltroOrigem('novo')
    setBusca('')
  }

  const contaSelecionada = useMemo(() => {
    if (demoConta && contaSelecionadaId === demoConta.id) return demoConta
    return contas.find((conta) => conta.id === contaSelecionadaId) || null
  }, [contaSelecionadaId, contas, demoConta])

  const progressoContaSelecionada = useMemo(() => {
    return contaSelecionada ? calcularProgressoPagamento(contaSelecionada, movimentos) : null
  }, [contaSelecionada, movimentos])

  const movimentosPorCiclo = useMemo(() => {
    return separarMovimentosPorCicloAtual(movimentos, contaSelecionada?.saldo_atual)
  }, [contaSelecionada?.saldo_atual, movimentos])

  const ciclosCrediario = useMemo(() => {
    return montarCiclosCrediario(movimentos)
  }, [movimentos])

  const ciclosQuitados = useMemo(() => {
    return ciclosCrediario.filter((ciclo) => ciclo.pago).reverse()
  }, [ciclosCrediario])

  const cicloAtual = useMemo(() => {
    if (contaSelecionada?.status === 'quitado') return null
    return [...ciclosCrediario].reverse().find((ciclo) => !ciclo.pago) || null
  }, [ciclosCrediario, contaSelecionada?.status])

  const movimentosAtuais = cicloAtual
    ? [...cicloAtual.movimentos].reverse()
    : movimentosPorCiclo.atuais

  const contaPagamento = useMemo(() => {
    if (demoConta && contaPagamentoId === demoConta.id) return demoConta
    return contas.find((conta) => conta.id === contaPagamentoId) || contaSelecionada
  }, [contaPagamentoId, contaSelecionada, contas, demoConta])

  const contaCobranca = useMemo(() => {
    if (demoConta && contaCobrancaId === demoConta.id) return demoConta
    return contas.find((conta) => conta.id === contaCobrancaId) || null
  }, [contaCobrancaId, contas, demoConta])

  useEffect(() => {
    setContaSelecionadaId((atual) => {
      if (atual && contasFiltradas.some((conta) => conta.id === atual)) return atual
      setDialogDetalhesAberto(false)
      setMovimentos([])
      return null
    })
  }, [contasFiltradas])

  const resumo = useMemo(() => {
    const abertas = contasFiltradas.filter((conta) => conta.status === 'aberto' && conta.saldo_atual > 0)
    const quitadas = contasFiltradas.filter((conta) => conta.status === 'quitado')
    return {
      abertas: abertas.length,
      saldoAberto: abertas.reduce((total, conta) => total + conta.saldo_atual, 0),
      quitadas: quitadas.length,
      movimentos: contasFiltradas.reduce((total, conta) => total + conta.total_movimentos, 0),
    }
  }, [contasFiltradas])

  const origemAtualLabel = filtroOrigem === 'novo' ? 'Novos' : filtroOrigem === 'legado' ? 'Sistema antigo' : 'Tudo'

  const abrirDetalhes = (conta: ContaCrediario) => {
    if (contaSelecionadaId !== conta.id) {
      setMovimentos([])
    }
    setMostrarMovimentacoesAntigas(conta.status === 'quitado')
    setContaSelecionadaId(conta.id)
    setDialogDetalhesAberto(true)
  }

  const abrirCobranca = (conta: ContaCrediario) => {
    if (conta.id === CONTA_DEMO_ID) {
      toast.info('A conta de exemplo não envia mensagem real.')
      return
    }
    if (conta.status !== 'aberto' || conta.saldo_atual <= 0) {
      toast.info('Esta conta não possui saldo em aberto.')
      return
    }
    setContaCobrancaId(conta.id)
    setTelefoneCobranca('')
    setSolicitarTelefoneCobranca(!temWhatsAppValido(conta.telefone))
  }

  const confirmarTelefoneCobranca = () => {
    if (!temWhatsAppValido(telefoneCobranca)) {
      toast.error('Digite um WhatsApp válido com DDD.')
      return
    }
    setSolicitarTelefoneCobranca(false)
  }

  const enviarCobranca = async () => {
    if (!contaCobranca || cobrancaEmEnvioId) return

    try {
      setCobrancaEmEnvioId(contaCobranca.id)
      const response = await fetch('/api/crediario/cobranca', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contaId: contaCobranca.id,
          telefone: temWhatsAppValido(contaCobranca.telefone) ? undefined : telefoneCobranca,
        }),
      })
      const data = (await response.json().catch(() => null)) as { sucesso?: boolean; mensagem?: string; erro?: string; telefone?: string } | null
      if (!response.ok || !data?.sucesso) {
        throw new Error(data?.erro || 'Não foi possível enviar a cobrança.')
      }

      toast.success('Cobrança enviada pelo WhatsApp', {
        description: `Mensagem enviada para ${contaCobranca.cliente_nome}.`,
      })
      if (data.telefone) {
        setContas((atuais) => atuais.map((conta) => (
          conta.id === contaCobranca.id ? { ...conta, telefone: data.telefone || conta.telefone } : conta
        )))
      }
      setContaCobrancaId(null)
      setTelefoneCobranca('')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível enviar a cobrança.')
    } finally {
      setCobrancaEmEnvioId(null)
    }
  }

  const registrarPagamento = async () => {
    if (!contaPagamento) return

    const valor = Number(valorPagamento.replace(',', '.'))
    if (!Number.isFinite(valor) || valor <= 0) {
      toast.error('Informe um valor valido')
      return
    }

    // Conta de exemplo do tutorial: pagamento simulado, sem tocar o banco.
    if (contaPagamento.id === CONTA_DEMO_ID) {
      toast.info('Exemplo: em uma conta real, o pagamento seria registrado aqui.')
      setValorPagamento('')
      setDescricaoPagamento('')
      setMetadataPagamento({})
      setDialogPagamentoAberto(false)
      return
    }

    try {
      setProcessando(true)
      const { error } = await supabase.rpc('registrar_pagamento_crediario', {
        p_conta_id: contaPagamento.id,
        p_valor: valor,
        p_descricao: descricaoPagamento.trim() || null,
        p_metadata: metadataPagamento,
      })

      if (error) throw error

      toast.success('Pagamento registrado')
      setValorPagamento('')
      setDescricaoPagamento('')
      setMetadataPagamento({})
      setDialogPagamentoAberto(false)
      await carregarContas({ silencioso: true })
      await carregarMovimentos(contaPagamento.id)
    } catch (error) {
      console.error('[Crediario] Erro ao registrar pagamento:', error)
      toast.error('Nao foi possivel registrar o pagamento')
    } finally {
      setProcessando(false)
    }
  }

  const abrirPagamento = (conta?: ContaCrediario, valor?: number, descricao?: string, metadata?: Record<string, unknown>) => {
    const contaAlvo = conta || contaSelecionada
    if (!contaAlvo) return
    setContaSelecionadaId(contaAlvo.id)
    setContaPagamentoId(contaAlvo.id)
    setValorPagamento(valor && valor > 0 ? String(valor.toFixed(2)).replace('.', ',') : '')
    setDescricaoPagamento(descricao || '')
    setMetadataPagamento(metadata || {})
    setDialogPagamentoAberto(true)
  }

  const abrirPagamentoItem = (movimento: MovimentoCrediario, item: ItemMovimentoCrediario) => {
    if (!movimento.pedido_id || !item.id) {
      toast.error('Este item não está vinculado a um pedido atual')
      return
    }
    const quantidade = normalizarQuantidadeUnidades(item.quantidade, item.quantidade)
    setPagamentoItemAberto({ movimento, item, quantidadesPorItem: { [item.id]: quantidade } })
  }

  const registrarPagamentoItem = async (itensPagos: ItemPagoSnapshot[], forma: 'pix' | 'dinheiro' | 'cartao') => {
    if (!pagamentoItemAberto || itensPagos.length === 0) return
    if (pagamentoItemAberto.movimento.conta_id === CONTA_DEMO_ID) {
      toast.info('Exemplo: em uma conta real, o pagamento seria registrado aqui.')
      setPagamentoItemAberto(null)
      return
    }
    try {
      setProcessando(true)
      const { error } = await supabase.rpc('registrar_pagamento_item_crediario', {
        p_movimento_id: pagamentoItemAberto.movimento.id,
        p_itens_pagos: itensPagos,
        p_forma_pagamento: forma,
      })
      if (error) throw error
      toast.success('Pagamento registrado')
      setPagamentoItemAberto(null)
      await carregarContas({ silencioso: true })
      await carregarMovimentos(pagamentoItemAberto.movimento.conta_id)
    } catch (error) {
      console.error('[Crediario] Erro ao registrar pagamento de item:', error)
      toast.error(obterMensagemErro(error) || 'Não foi possível registrar o pagamento do item')
    } finally {
      setProcessando(false)
    }
  }

  const quitarConta = async (conta?: ContaCrediario) => {
    const contaAlvo = conta || contaSelecionada
    if (!contaAlvo) return

    // Conta de exemplo do tutorial: quita na store client-side, sem tocar o banco.
    if (contaAlvo.id === CONTA_DEMO_ID) {
      quitarContaDemoCrediario()
      toast.success('Conta de exemplo quitada!')
      return
    }

    try {
      setProcessando(true)
      setContaSelecionadaId(contaAlvo.id)
      const { error } = await supabase.rpc('quitar_crediario', {
        p_conta_id: contaAlvo.id,
        p_descricao: 'Concluido pelo painel',
      })

      if (error) throw error

      toast.success('Crediario concluido')
      setMostrarMovimentacoesAntigas(true)
      await carregarContas({ silencioso: true })
      await carregarMovimentos(contaAlvo.id)
    } catch (error) {
      console.error('[Crediario] Erro ao quitar conta:', error)
      toast.error(obterMensagemErro(error) || 'Nao foi possivel concluir o crediario')
    } finally {
      setProcessando(false)
    }
  }

  const cancelarMovimento = async (movimento: MovimentoCrediario) => {
    if (!contaSelecionada) return

    if (contaSelecionada.id === CONTA_DEMO_ID) {
      toast.info('Exemplo: em uma conta real, este movimento seria removido.')
      setConfirmacao(null)
      return
    }

    try {
      setProcessando(true)
      const { error } = await supabase.rpc('cancelar_movimento_crediario', {
        p_movimento_id: movimento.id,
        p_motivo: 'Removido pelo painel',
      })

      if (error) throw error

      toast.success('Movimento removido')
      setConfirmacao(null)
      await carregarContas({ silencioso: true })
      await carregarMovimentos(contaSelecionada.id)
    } catch (error) {
      console.error('[Crediario] Erro ao remover movimento:', error)
      toast.error(obterMensagemErro(error) || 'Nao foi possivel remover o movimento')
    } finally {
      setProcessando(false)
    }
  }

  const apagarItemMovimento = async (movimento: MovimentoCrediario, itemIndice: number) => {
    if (!contaSelecionada) return

    if (contaSelecionada.id === CONTA_DEMO_ID) {
      toast.info('Exemplo: em uma conta real, este item seria removido.')
      setConfirmacao(null)
      return
    }

    try {
      setProcessando(true)
      const { error } = await supabase.rpc('apagar_item_movimento_crediario', {
        p_movimento_id: movimento.id,
        p_item_indice: itemIndice,
        p_motivo: 'Item removido pelo painel',
      })

      if (error) throw error

      toast.success('Item removido')
      setConfirmacao(null)
      await carregarContas({ silencioso: true })
      await carregarMovimentos(contaSelecionada.id)
    } catch (error) {
      console.error('[Crediario] Erro ao remover item:', error)
      toast.error(obterMensagemErro(error) || 'Nao foi possivel remover o item')
    } finally {
      setProcessando(false)
    }
  }

  const reverterCicloCrediario = async (ciclo: CicloCrediario) => {
    if (!contaSelecionada) return
    if (ciclo.pagamentos.length === 0) {
      toast.error('Nao ha pagamento para reverter neste ciclo')
      return
    }

    try {
      setProcessando(true)

      for (const pagamento of ciclo.pagamentos) {
        const { error } = await supabase.rpc('cancelar_movimento_crediario', {
          p_movimento_id: pagamento.id,
          p_motivo: 'Reversao do crediario pelo painel',
        })

        if (error) throw error
      }

      toast.success('Crediario revertido')
      setConfirmacao(null)
      await carregarContas({ silencioso: true })
      await carregarMovimentos(contaSelecionada.id)
    } catch (error) {
      console.error('[Crediario] Erro ao reverter crediario:', error)
      toast.error(obterMensagemErro(error) || 'Nao foi possivel reverter o crediario')
    } finally {
      setProcessando(false)
    }
  }

  const executarConfirmacao = async () => {
    if (!confirmacao) return

    if (confirmacao.tipo === 'movimento') {
      await cancelarMovimento(confirmacao.movimento)
      return
    }

    if (confirmacao.tipo === 'reverter-ciclo') {
      await reverterCicloCrediario(confirmacao.ciclo)
      return
    }

    await apagarItemMovimento(confirmacao.movimento, confirmacao.itemIndice)
  }

  const gerarPdfDetalhado = () => {
    if (!contaSelecionada) return

    // Conta de exemplo do tutorial: não gera arquivo — apenas demonstra a ação.
    if (contaSelecionada.id === CONTA_DEMO_ID) {
      toast.info('Exemplo: o comprovante em PDF seria gerado aqui.')
      return
    }

    const doc = new jsPDF()
    const larguraPagina = doc.internal.pageSize.getWidth()
    const margem = 14
    const larguraConteudo = larguraPagina - margem * 2
    const corTexto = [24, 24, 27] as [number, number, number]
    const corSuave = [82, 82, 91] as [number, number, number]
    const corBorda = [212, 212, 216] as [number, number, number]
    const corHeader = [24, 24, 27] as [number, number, number]
    const corLinha = [248, 250, 252] as [number, number, number]
    const progresso = progressoContaSelecionada
    const formatarValorPdf = (valor: number) => `R$ ${paraNumero(valor).toFixed(2).replace('.', ',')}`
    const obterFinalTabela = () => (doc as JsPdfComAutoTable).lastAutoTable?.finalY || 0
    const tipoMovimento = (movimento: MovimentoCrediario) => {
      if (movimento.tipo === 'pagamento') return 'Pagamento'
      if (movimento.tipo === 'estorno') return 'Estorno'
      if (movimento.tipo === 'ajuste') return 'Ajuste'
      return 'Consumo'
    }
    const valorMovimento = (movimento: MovimentoCrediario) => {
      const sinal = movimento.tipo === 'pagamento' || movimento.tipo === 'estorno' ? '-' : '+'
      return `${sinal}${formatarValorPdf(movimento.valor)}`
    }
    const itensMovimento = (movimento: MovimentoCrediario) => {
      const itens = extrairItensMovimento(movimento.itens)
      if (itens.length === 0) return '-'

      return itens
        .map((item) => `${item.quantidade}x ${item.nome} - ${formatarValorPdf(item.subtotal)}`)
        .join('\n')
    }
    const linhasMovimentos = (lista: MovimentoCrediario[]) => lista.map((movimento) => [
      formatarData(movimento.realizado_em),
      tipoMovimento(movimento),
      movimento.descricao || '-',
      valorMovimento(movimento),
      itensMovimento(movimento),
    ])

    doc.setFillColor(...corHeader)
    doc.rect(0, 0, larguraPagina, 34, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    doc.text('Bar da Ladeira', margem, 14)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text('Relatorio detalhado de crediario', margem, 22)
    doc.text(`Gerado em ${formatarData(new Date().toISOString())}`, margem, 28)

    let y = 44
    doc.setTextColor(...corTexto)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.text(contaSelecionada.cliente_nome, margem, y)
    y += 6

    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...corSuave)
    doc.setFontSize(9)
    doc.text(`Telefone: ${formatarTelefone(contaSelecionada.telefone)}`, margem, y)
    doc.text(`Status: ${statusLabel[contaSelecionada.status] || contaSelecionada.status}`, larguraPagina - margem, y, { align: 'right' })
    y += 8

    autoTable(doc, {
      startY: y,
      body: [
        ['Saldo aberto atual', formatarValorPdf(contaSelecionada.saldo_atual)],
        ['Consumos atuais', String(progresso?.totalConsumos ?? movimentosAtuais.length)],
        ['Pagamentos atuais', String(progresso?.totalPagamentos ?? 0)],
        ['Total pago no ciclo atual', formatarValorPdf(progresso?.totalPago ?? 0)],
        ['Origem', contaSelecionada.origem === 'migracao_edienai_antigo' ? 'Sistema antigo' : 'Novo crediario'],
        ['Crediarios pagos separados', String(ciclosQuitados.length)],
      ],
      theme: 'grid',
      styles: {
        fontSize: 9,
        cellPadding: 2.4,
        textColor: corTexto,
        lineColor: corBorda,
        lineWidth: 0.1,
      },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 62 },
        1: { cellWidth: larguraConteudo - 62 },
      },
    })

    y = obterFinalTabela() + 10
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...corTexto)
    doc.setFontSize(12)
    doc.text('Movimentos atuais', margem, y)

    autoTable(doc, {
      startY: y + 4,
      head: [['Data', 'Tipo', 'Descricao', 'Valor', 'Itens']],
      body: linhasMovimentos(movimentosAtuais),
      theme: 'grid',
      styles: {
        fontSize: 8,
        cellPadding: 2.2,
        overflow: 'linebreak',
        textColor: corTexto,
        lineColor: corBorda,
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: corHeader,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      alternateRowStyles: { fillColor: corLinha },
      columnStyles: {
        0: { cellWidth: 28 },
        1: { cellWidth: 24 },
        2: { cellWidth: 38 },
        3: { cellWidth: 24, halign: 'right' },
        4: { cellWidth: larguraConteudo - 114 },
      },
    })

    if (ciclosQuitados.length > 0) {
      y = obterFinalTabela() + 10
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...corTexto)
      doc.setFontSize(12)
      doc.text('Crediarios pagos', margem, y)

      autoTable(doc, {
        startY: y + 4,
        head: [['Periodo', 'Descricao', 'Consumido', 'Pago', 'Status']],
        body: ciclosQuitados.map((ciclo) => [
          `${formatarData(ciclo.inicioEm)}\n${formatarData(ciclo.fimEm)}`,
          ciclo.consumos.map((movimento) => movimento.descricao || 'Consumo').join('\n') || 'Consumo',
          formatarValorPdf(ciclo.totalConsumido),
          formatarValorPdf(ciclo.totalPago),
          ciclo.pago ? 'Pago' : 'Em aberto',
        ]),
        theme: 'grid',
        styles: {
          fontSize: 8,
          cellPadding: 2.2,
          overflow: 'linebreak',
          textColor: corTexto,
          lineColor: corBorda,
          lineWidth: 0.1,
        },
        headStyles: {
          fillColor: [63, 63, 70],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
        },
        alternateRowStyles: { fillColor: corLinha },
        columnStyles: {
          0: { cellWidth: 38 },
          1: { cellWidth: larguraConteudo - 112 },
          2: { cellWidth: 24, halign: 'right' },
          3: { cellWidth: 24, halign: 'right' },
          4: { cellWidth: 26 },
        },
      })
    }

    const nomeArquivo = `crediario_${normalizarTexto(contaSelecionada.cliente_nome).replace(/[^a-z0-9]+/g, '_')}_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.pdf`
    doc.save(nomeArquivo)
  }

  const gerarPdfMovimentacao = (movimento: MovimentoCrediario) => {
    if (!contaSelecionada) return

    const doc = new jsPDF()
    const larguraPagina = doc.internal.pageSize.getWidth()
    const margem = 14
    const larguraConteudo = larguraPagina - margem * 2
    const corTexto = [24, 24, 27] as [number, number, number]
    const corSuave = [82, 82, 91] as [number, number, number]
    const corBorda = [212, 212, 216] as [number, number, number]
    const corHeader = [24, 24, 27] as [number, number, number]
    const corLinha = [248, 250, 252] as [number, number, number]
    const itens = extrairItensMovimento(movimento.itens)
    const tipo = movimento.tipo === 'pagamento'
      ? 'Pagamento'
      : movimento.tipo === 'estorno'
        ? 'Estorno'
        : movimento.tipo === 'ajuste'
          ? 'Ajuste'
          : 'Consumo'
    const sinal = movimento.tipo === 'pagamento' || movimento.tipo === 'estorno' ? '-' : '+'
    const formatarValorPdf = (valor: number) => `R$ ${paraNumero(valor).toFixed(2).replace('.', ',')}`

    doc.setFillColor(...corHeader)
    doc.rect(0, 0, larguraPagina, 34, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    doc.text('Bar da Ladeira', margem, 14)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text('Movimentacao de crediario', margem, 22)
    doc.text(`Gerado em ${formatarData(new Date().toISOString())}`, margem, 28)

    let y = 44
    doc.setTextColor(...corTexto)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.text(contaSelecionada.cliente_nome, margem, y)
    y += 6

    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...corSuave)
    doc.setFontSize(9)
    doc.text(`Telefone: ${formatarTelefone(contaSelecionada.telefone)}`, margem, y)
    doc.text(`Conta: ${statusLabel[contaSelecionada.status] || contaSelecionada.status}`, larguraPagina - margem, y, { align: 'right' })
    y += 8

    autoTable(doc, {
      startY: y,
      body: [
        ['Tipo', tipo],
        ['Valor', `${sinal}${formatarValorPdf(movimento.valor)}`],
        ['Data', formatarData(movimento.realizado_em)],
        ['Descricao', movimento.descricao || '-'],
        ['Pedido', movimento.pedido_id ? `#${movimento.pedido_id.slice(0, 8)}` : '-'],
        ['Origem', movimento.origem],
      ],
      theme: 'grid',
      styles: {
        fontSize: 9,
        cellPadding: 2.5,
        textColor: corTexto,
        lineColor: corBorda,
        lineWidth: 0.1,
      },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 42 },
        1: { cellWidth: larguraConteudo - 42 },
      },
    })

    y = ((doc as JsPdfComAutoTable).lastAutoTable?.finalY || y) + 10
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...corTexto)
    doc.setFontSize(12)
    doc.text('Itens da movimentacao', margem, y)

    autoTable(doc, {
      startY: y + 4,
      head: [['Item', 'Qtd', 'Valor un.', 'Subtotal', 'Observacao']],
      body: itens.length > 0
        ? itens.map((item) => [
            item.nome,
            String(item.quantidade),
            formatarValorPdf(item.precoUnitario),
            formatarValorPdf(item.subtotal),
            item.observacoes || '-',
          ])
        : [['Sem itens detalhados', '-', '-', '-', '-']],
      theme: 'grid',
      styles: {
        fontSize: 8,
        cellPadding: 2.2,
        overflow: 'linebreak',
        textColor: corTexto,
        lineColor: corBorda,
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: corHeader,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      alternateRowStyles: { fillColor: corLinha },
      columnStyles: {
        0: { cellWidth: larguraConteudo - 100 },
        1: { cellWidth: 16, halign: 'center' },
        2: { cellWidth: 24, halign: 'right' },
        3: { cellWidth: 24, halign: 'right' },
        4: { cellWidth: 36 },
      },
    })

    const nomeArquivo = `crediario_movimentacao_${movimento.id.slice(0, 8)}_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.pdf`
    doc.save(nomeArquivo)
  }

  const gerarPdfCicloCrediario = (ciclo: CicloCrediario) => {
    if (!contaSelecionada) return

    const doc = new jsPDF()
    const larguraPagina = doc.internal.pageSize.getWidth()
    const margem = 14
    const larguraConteudo = larguraPagina - margem * 2
    const corTexto = [24, 24, 27] as [number, number, number]
    const corSuave = [82, 82, 91] as [number, number, number]
    const corBorda = [212, 212, 216] as [number, number, number]
    const corHeader = [24, 24, 27] as [number, number, number]
    const corLinha = [248, 250, 252] as [number, number, number]
    const formatarValorPdf = (valor: number) => `R$ ${paraNumero(valor).toFixed(2).replace('.', ',')}`
    const descricaoConsumos = ciclo.consumos.map((movimento) => movimento.descricao || 'Consumo').join(' / ') || 'Consumo'
    const itens = ciclo.consumos.flatMap((movimento) => extrairItensMovimento(movimento.itens))

    doc.setFillColor(...corHeader)
    doc.rect(0, 0, larguraPagina, 34, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(18)
    doc.text('Bar da Ladeira', margem, 14)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text('Crediario pago', margem, 22)
    doc.text(`Gerado em ${formatarData(new Date().toISOString())}`, margem, 28)

    let y = 44
    doc.setTextColor(...corTexto)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(14)
    doc.text(contaSelecionada.cliente_nome, margem, y)
    y += 6

    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...corSuave)
    doc.setFontSize(9)
    doc.text(`Telefone: ${formatarTelefone(contaSelecionada.telefone)}`, margem, y)
    doc.text(ciclo.pago ? 'Status: Pago' : 'Status: Em aberto', larguraPagina - margem, y, { align: 'right' })
    y += 8

    autoTable(doc, {
      startY: y,
      body: [
        ['Descricao', descricaoConsumos],
        ['Periodo', `${formatarData(ciclo.inicioEm)} ate ${formatarData(ciclo.fimEm)}`],
        ['Total consumido', formatarValorPdf(ciclo.totalConsumido)],
        ['Total pago', formatarValorPdf(ciclo.totalPago)],
        ['Saldo do ciclo', formatarValorPdf(ciclo.saldo)],
        ['Status', ciclo.pago ? 'Pago' : 'Em aberto'],
      ],
      theme: 'grid',
      styles: {
        fontSize: 9,
        cellPadding: 2.5,
        textColor: corTexto,
        lineColor: corBorda,
        lineWidth: 0.1,
      },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 42 },
        1: { cellWidth: larguraConteudo - 42 },
      },
    })

    y = ((doc as JsPdfComAutoTable).lastAutoTable?.finalY || y) + 10
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...corTexto)
    doc.setFontSize(12)
    doc.text('Itens consumidos', margem, y)

    autoTable(doc, {
      startY: y + 4,
      head: [['Item', 'Qtd', 'Valor un.', 'Subtotal', 'Observacao']],
      body: itens.length > 0
        ? itens.map((item) => [
            item.nome,
            String(item.quantidade),
            formatarValorPdf(item.precoUnitario),
            formatarValorPdf(item.subtotal),
            item.observacoes || '-',
          ])
        : [['Sem itens detalhados', '-', '-', '-', '-']],
      theme: 'grid',
      styles: {
        fontSize: 8,
        cellPadding: 2.2,
        overflow: 'linebreak',
        textColor: corTexto,
        lineColor: corBorda,
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: corHeader,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      alternateRowStyles: { fillColor: corLinha },
      columnStyles: {
        0: { cellWidth: larguraConteudo - 100 },
        1: { cellWidth: 16, halign: 'center' },
        2: { cellWidth: 24, halign: 'right' },
        3: { cellWidth: 24, halign: 'right' },
        4: { cellWidth: 36 },
      },
    })

    const nomeArquivo = `crediario_pago_${ciclo.id.slice(0, 8)}_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.pdf`
    doc.save(nomeArquivo)
  }

  return (
    <div className="space-y-4">
      <div className="flex w-full min-w-0 flex-col gap-3 overflow-hidden rounded-xl border border-border/70 bg-card p-4 shadow-sm md:flex-row md:items-center md:justify-between md:p-5">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight text-foreground">Crediário</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {origemAtualLabel} · {resumo.abertas} abertas · {moeda.format(resumo.saldoAberto)} em aberto
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-4 md:gap-6">
          <div className="min-w-[120px]">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Saldo aberto</p>
            <p className="mt-0.5 text-xl font-semibold tabular-nums text-foreground">{moeda.format(resumo.saldoAberto)}</p>
          </div>
          <div className="min-w-[80px]">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Abertas</p>
            <p className="mt-0.5 text-xl font-semibold tabular-nums text-foreground">{resumo.abertas}</p>
          </div>
          <div className="min-w-[80px]">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Quitadas</p>
            <p className="mt-0.5 text-xl font-semibold tabular-nums text-muted-foreground">{resumo.quitadas}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 shadow-none"
            onClick={() => void carregarContas()}
            disabled={carregandoContas}
          >
            <RefreshCw className={cn('mr-2 h-4 w-4', carregandoContas && 'animate-spin')} />
            Atualizar
          </Button>
        </div>
      </div>

      <div className="w-full overflow-hidden rounded-xl border border-border/70 bg-card p-3.5 shadow-sm md:p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-base font-medium text-foreground/90">Contas</span>
            <span className="inline-flex items-center rounded-full border border-border/70 bg-muted/40 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              {contasFiltradas.length} {contasFiltradas.length === 1 ? 'conta' : 'contas'}
            </span>
          </div>
        </div>

        <div className="mb-3 w-full overflow-x-auto" data-onboarding="crediario-filtro-status">
          <ToggleGroup
            type="single"
            value={filtroStatus}
            onValueChange={(v) => {
              if (v) setFiltroStatus(v as FiltroStatus)
            }}
            aria-label="Filtro de status do crediário"
            className="flex w-max items-center justify-start gap-2"
          >
            <ToggleGroupItem value="aberto" aria-label="Contas abertas" className={CHIP_FILTRO_DEFAULT}>
              <Wallet className="h-3.5 w-3.5" />
              <span>Abertas</span>
            </ToggleGroupItem>
            <ToggleGroupItem value="quitado" aria-label="Contas quitadas" className={CHIP_FILTRO_DEFAULT}>
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Quitadas</span>
            </ToggleGroupItem>
            <ToggleGroupItem value="todos" aria-label="Todas as contas" className={CHIP_FILTRO_DEFAULT}>
              <History className="h-3.5 w-3.5" />
              <span>Todas</span>
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div className="mb-3 w-full overflow-x-auto">
          <ToggleGroup
            type="single"
            value={filtroOrigem}
            onValueChange={(v) => {
              if (v) setFiltroOrigem(v as FiltroOrigem)
            }}
            aria-label="Filtro de origem do crediário"
            className="flex w-max items-center justify-start gap-2"
          >
            <ToggleGroupItem value="novo" aria-label="Contas novas" className={CHIP_FILTRO_DEFAULT}>
              <span>Novos</span>
            </ToggleGroupItem>
            <ToggleGroupItem value="legado" aria-label="Sistema antigo" className={CHIP_FILTRO_DEFAULT}>
              <span>Sistema antigo</span>
            </ToggleGroupItem>
            <ToggleGroupItem value="todos" aria-label="Todas as origens" className={CHIP_FILTRO_DEFAULT}>
              <span>Tudo</span>
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div className="mb-3 w-full overflow-x-auto">
          <ToggleGroup
            type="single"
            value={ordenacao}
            onValueChange={(v) => {
              if (v) setOrdenacao(v as OrdenacaoContas)
            }}
            aria-label="Ordenação das contas do crediário"
            className="flex w-max items-center justify-start gap-2"
          >
            <ToggleGroupItem value="recentes" className={CHIP_FILTRO_DEFAULT}>Mais recentes</ToggleGroupItem>
            <ToggleGroupItem value="antigas" className={CHIP_FILTRO_DEFAULT}>Mais antigas</ToggleGroupItem>
            <ToggleGroupItem value="maior_saldo" className={CHIP_FILTRO_DEFAULT}>Maior saldo</ToggleGroupItem>
            <ToggleGroupItem value="menor_saldo" className={CHIP_FILTRO_DEFAULT}>Menor saldo</ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1" data-onboarding="crediario-busca">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
              placeholder="Buscar cliente, telefone ou ID legado"
              aria-label="Buscar contas do crediário"
              className="h-9 rounded-lg border-border/70 bg-background pl-9 pr-9 shadow-none"
            />
            {busca ? (
              <button
                type="button"
                onClick={() => setBusca('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Limpar busca"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>

        <FiltrosAtivosChips chips={chipsFiltroAtivo} onLimpar={handleLimparFiltros} className="mb-4" />

        {carregandoContas ? (
          <TabelaSkeleton linhas={6} />
        ) : contasFiltradas.length === 0 ? (
          <ListaVazia
            className="border-0 bg-transparent py-10"
            icone={<Wallet className="h-6 w-6" strokeWidth={1.6} />}
            titulo="Nenhuma conta encontrada"
            descricao="Ajuste os filtros ou a busca para ver outras contas do crediário."
          />
        ) : (
          <>
            <div className="flex flex-col gap-3 md:hidden">
              {contasPagina.map((conta) => {
                const progresso = calcularProgressoPagamento(conta, movimentosResumoPorConta.get(conta.id))
                const ehDemo = conta.id === CONTA_DEMO_ID
                const card = (
                  <CardContaCrediario
                    conta={conta}
                    statusRotulo={statusLabel[conta.status] || conta.status}
                    telefoneFormatado={formatarTelefone(conta.telefone)}
                    dataFormatada={formatarData(conta.ultimo_movimento_em || conta.atualizado_em)}
                    saldoFormatado={moeda.format(conta.saldo_atual)}
                    progresso={progresso}
                    responsavel={responsaveisResumoPorConta.get(conta.id)}
                    selecionada={contaSelecionadaId === conta.id}
                    processando={processando}
                    cobrancaDisponivel={conta.id !== CONTA_DEMO_ID && conta.status === 'aberto' && conta.saldo_atual > 0}
                    cobrancaEmEnvio={cobrancaEmEnvioId === conta.id}
                    onDetalhes={() => abrirDetalhes(conta)}
                    onPagar={() => abrirPagamento(conta)}
                    onQuitar={() => void quitarConta(conta)}
                    onCobrar={() => abrirCobranca(conta)}
                  />
                )
                return ehDemo ? (
                  <div key={conta.id} data-onboarding="demo-card">
                    {card}
                  </div>
                ) : (
                  <div key={conta.id}>{card}</div>
                )
              })}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <Table>
                <TableHeader>
                  <TableRow className="border-border/60 hover:bg-transparent">
                    <TableHead className="w-10 text-xs font-medium text-muted-foreground" aria-label="Status" />
                    <TableHead className="text-xs font-medium text-muted-foreground">Cliente</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">
                      <div className="flex w-full justify-center">Status</div>
                    </TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">Origem</TableHead>
                    <TableHead className="text-xs font-medium text-muted-foreground">Atualizado</TableHead>
                    <TableHead className="text-right text-xs font-medium text-muted-foreground">Saldo</TableHead>
                    <TableHead className="w-12" aria-label="Ações" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contasPagina.map((conta) => {
                    const aberto = conta.status === 'aberto'
                    const legado = conta.origem === 'migracao_edienai_antigo'
                    const progresso = calcularProgressoPagamento(conta, movimentosResumoPorConta.get(conta.id))
                    const nomeResponsavel = responsaveisResumoPorConta.get(conta.id)
                    return (
                      <TableRow
                        key={conta.id}
                        className="cursor-pointer border-border/60"
                        onClick={() => abrirDetalhes(conta)}
                        data-onboarding={conta.id === CONTA_DEMO_ID ? 'demo-card' : undefined}
                      >
                        <TableCell className="py-3 pl-3">
                          <div
                            className={cn(
                              'flex h-12 items-center border-l-4',
                              aberto ? 'border-amber-500' : 'border-emerald-500',
                            )}
                          >
                            <span className="pl-3">
                              {aberto ? (
                                <Wallet className="h-4 w-4 text-amber-600" aria-hidden />
                              ) : (
                                <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden />
                              )}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[260px] py-3">
                          <span className="block truncate text-sm font-medium text-foreground">{conta.cliente_nome}</span>
                          <span className="text-[11px] text-muted-foreground">{formatarTelefone(conta.telefone)}</span>
                          {nomeResponsavel ? (
                            <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                              Iniciado por: {nomeResponsavel}
                            </span>
                          ) : null}
                          {progresso.temPagamentoParcial ? (
                            <div className="mt-2 max-w-[200px]">
                              <Progress value={progresso.percentual} className="h-1.5 bg-muted" />
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell className="py-3">
                          <div className="flex w-full justify-center">
                            <Badge
                              className={cn(
                                'rounded-full px-2 py-0.5 text-xs font-medium shadow-none',
                                aberto
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100'
                                  : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100',
                              )}
                            >
                              {statusLabel[conta.status] || conta.status}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="py-3">
                          <Badge variant="outline" className="rounded-full border-border/70 bg-background/50 font-medium">
                            {legado ? 'Antigo' : 'Novo'}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap py-3 text-xs tabular-nums text-muted-foreground">
                          {formatarData(conta.ultimo_movimento_em || conta.atualizado_em)}
                        </TableCell>
                        <TableCell
                          className={cn(
                            'py-3 text-right text-sm font-semibold tabular-nums',
                            aberto ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-600 dark:text-emerald-400',
                          )}
                        >
                          {moeda.format(conta.saldo_atual)}
                        </TableCell>
                        <TableCell
                          className="py-3 text-right"
                          data-onboarding={conta.id === CONTA_DEMO_ID ? 'demo-dropdown' : undefined}
                        >
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-md text-[#25D366] hover:bg-[#25D366]/10 hover:text-[#1da851]"
                              aria-label={`Cobrar ${conta.cliente_nome} pelo WhatsApp`}
                              title={temWhatsAppValido(conta.telefone) ? 'Enviar cobrança pelo WhatsApp' : 'Cadastrar WhatsApp e enviar cobrança'}
                              disabled={
                                conta.id === CONTA_DEMO_ID
                                || conta.status !== 'aberto'
                                || conta.saldo_atual <= 0
                                || cobrancaEmEnvioId === conta.id
                              }
                              onClick={(event) => {
                                event.stopPropagation()
                                abrirCobranca(conta)
                              }}
                            >
                              {cobrancaEmEnvioId === conta.id
                                ? <Loader2 className="h-4 w-4 animate-spin" />
                                : <IconeWhatsApp className="h-4 w-4" />}
                            </Button>
                            <MenuAcoes
                              ariaLabel="Ações da conta"
                              disabled={processando}
                              items={[
                                {
                                  key: 'detalhes',
                                  label: 'Ver detalhes',
                                  icon: <Eye className="h-3.5 w-3.5" />,
                                  onSelect: () => abrirDetalhes(conta),
                                },
                                {
                                  key: 'pagar',
                                  label: 'Registrar pagamento',
                                  icon: <Banknote className="h-3.5 w-3.5" />,
                                  onSelect: () => abrirPagamento(conta),
                                  disabled: processando,
                                },
                                {
                                  key: 'quitar',
                                  label: 'Quitar tudo',
                                  icon: <CheckCircle2 className="h-3.5 w-3.5" />,
                                  onSelect: () => void quitarConta(conta),
                                  disabled: processando || conta.saldo_atual <= 0,
                                  variant: 'success',
                                  separatorBefore: true,
                                },
                              ]}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            <PaginacaoFinancas
              paginaAtual={pagina}
              totalPaginas={totalPaginas}
              totalItens={contasFiltradas.length}
              itensPorPagina={limite}
              onPaginaChange={setPagina}
              onItensPorPaginaChange={(qtd) => {
                setLimite(qtd)
                setPagina(1)
              }}
              carregando={carregandoContas}
            />
          </>
        )}
      </div>

      <Dialog
        open={dialogDetalhesAberto}
        // Durante o tutorial o modal precisa CONVIVER com o popover do tour.
        // `modal` (padrão) faz o Radix/vaul aplicarem pointer-events:none no
        // body, prender o foco e marcar o resto como aria-hidden — o tour fica
        // visível mas sem receber cliques ("não avança"). Fora do tutorial,
        // nada muda.
        modal={contaSelecionada?.id === CONTA_DEMO_ID ? false : undefined}
        dismissible={contaSelecionada?.id === CONTA_DEMO_ID ? false : undefined}
        onOpenChange={(aberto) => {
          setDialogDetalhesAberto(aberto)
          if (!aberto) {
            setContaSelecionadaId(null)
            setMovimentos([])
            setMostrarMovimentacoesAntigas(false)
          }
        }}
      >
        <DialogContent
          showCloseButton={false}
          // Durante o tutorial, o modal só é controlado pelo tour: interagir com
          // o popover do onboarding (clique/ESC "fora") não pode fechá-lo.
          onInteractOutside={
            contaSelecionada?.id === CONTA_DEMO_ID ? (event) => event.preventDefault() : undefined
          }
          onEscapeKeyDown={
            contaSelecionada?.id === CONTA_DEMO_ID ? (event) => event.preventDefault() : undefined
          }
          className="flex h-[92dvh] w-[calc(100vw-0.75rem)] max-w-none flex-col gap-0 overflow-hidden rounded-xl border-border/70 p-0 shadow-[0_8px_32px_-12px_rgba(15,23,42,0.12)] sm:h-[96dvh] sm:w-[min(1680px,98.5vw)] sm:max-w-none"
        >
          <header className="flex min-w-0 shrink-0 items-center gap-2 border-b border-border/70 bg-background px-5 py-3 sm:px-6">
            <DialogTitle className="sr-only">
              {contaSelecionada ? `Fiado de ${contaSelecionada.cliente_nome}` : 'Detalhes do fiado'}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {contaSelecionada
                ? contaSelecionada.saldo_atual > 0
                  ? `Este cliente ainda deve ${moeda.format(contaSelecionada.saldo_atual)}.`
                  : 'Esta conta está quitada. Não há valor em aberto.'
                : 'Abra uma conta na lista para ver o histórico.'}
            </DialogDescription>
            {contaSelecionada ? (
              <Badge
                variant="outline"
                className={cn(
                  'shrink-0 rounded-lg border-0 px-2.5 py-1 text-xs font-medium',
                  contaSelecionada.status === 'aberto'
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100'
                    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100',
                )}
              >
                <span
                  className={cn(
                    'size-1.5 rounded-full',
                    contaSelecionada.status === 'aberto' ? 'bg-amber-500' : 'bg-emerald-500',
                  )}
                  aria-hidden
                />
                {contaSelecionada.status === 'aberto'
                  ? 'Em aberto'
                  : statusLabel[contaSelecionada.status] || contaSelecionada.status}
              </Badge>
            ) : null}
            <div className="ml-auto flex shrink-0 items-center gap-0.5">
              {contaSelecionada ? (
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1.5 px-2 text-muted-foreground"
                    onClick={() => abrirPagamento(contaSelecionada)}
                    disabled={processando || contaSelecionada.saldo_atual <= 0}
                    aria-label="Receber pagamento"
                    data-onboarding={contaSelecionada.id === CONTA_DEMO_ID ? 'demo-pagamento' : undefined}
                  >
                    <Banknote className="size-3.5" />
                    <span className="hidden sm:inline">Receber</span>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1.5 px-2 text-muted-foreground"
                    onClick={() => void quitarConta(contaSelecionada)}
                    disabled={processando || contaSelecionada.saldo_atual <= 0}
                    aria-label="Quitar tudo agora"
                    data-onboarding={contaSelecionada.id === CONTA_DEMO_ID ? 'demo-quitar' : undefined}
                  >
                    {processando ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="size-3.5" />
                    )}
                    <span className="hidden sm:inline">Quitar</span>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1.5 px-2 text-muted-foreground"
                    onClick={gerarPdfDetalhado}
                    aria-label="Baixar PDF"
                    data-onboarding={contaSelecionada.id === CONTA_DEMO_ID ? 'demo-pdf' : undefined}
                  >
                    <FileText className="size-3.5" />
                    <span className="hidden sm:inline">PDF</span>
                  </Button>
                </>
              ) : null}
              <span className="mx-1 h-4 w-px bg-border" aria-hidden />
              {contaSelecionada?.id === CONTA_DEMO_ID ? null : (
                <DialogClose asChild>
                  <Button type="button" variant="ghost" size="icon" className="size-8" aria-label="Fechar">
                    <X className="size-4" />
                  </Button>
                </DialogClose>
              )}
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto bg-background">
            {!contaSelecionada ? (
              <div className="p-8 text-center text-sm text-muted-foreground">Selecione uma conta</div>
            ) : (
              <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_1px_26rem]">
                <main className="min-w-0">
                  <div className="mb-7 grid gap-2">
                    <h2 className="min-w-0 truncate text-2xl font-semibold leading-tight tracking-tight">
                      {contaSelecionada.cliente_nome}
                    </h2>
                    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex min-w-0 items-center gap-1.5 font-mono tabular-nums">
                        <Phone className="size-3.5 shrink-0" aria-hidden />
                        <span className="truncate">{formatarTelefone(contaSelecionada.telefone)}</span>
                      </span>
                      <span className="inline-flex min-w-0 items-center gap-1.5">
                        <span className="size-1.5 rounded-full bg-muted-foreground/60" aria-hidden />
                        <span className="truncate">
                          {contaSelecionada.origem === 'migracao_edienai_antigo'
                            ? 'Conta antiga'
                            : 'Conta nova'}
                        </span>
                      </span>
                    </div>
                  </div>

                  <div
                    className="mb-5 flex flex-wrap items-center gap-x-5 gap-y-3"
                    data-onboarding={contaSelecionada.id === CONTA_DEMO_ID ? 'demo-modal-visao' : undefined}
                  >
                    <InlineFactCrediario
                      icon={<Banknote />}
                      label="Saldo em aberto"
                      value={moeda.format(contaSelecionada.saldo_atual)}
                    />
                    <InlineFactCrediario
                      icon={<Wallet />}
                      label="Pedidos no fiado"
                      value={String(
                        progressoContaSelecionada?.totalConsumos ?? contaSelecionada.total_consumos,
                      )}
                    />
                    <InlineFactCrediario
                      icon={<CalendarClock />}
                      label="Pagamentos"
                      value={String(
                        progressoContaSelecionada?.totalPagamentos ??
                          contaSelecionada.total_pagamentos,
                      )}
                    />
                  </div>

                  <FieldGroupCrediario title="Financeiro">
                    {progressoContaSelecionada && progressoContaSelecionada.temPagamentoParcial ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium text-foreground">Já pagou uma parte</p>
                            <p className="text-xs text-muted-foreground">
                              {moeda.format(progressoContaSelecionada.totalPago)} de{' '}
                              {moeda.format(progressoContaSelecionada.totalConsumido)}
                            </p>
                          </div>
                          <span className="text-sm font-semibold tabular-nums">
                            {Math.round(progressoContaSelecionada.percentual)}%
                          </span>
                        </div>
                        <Progress value={progressoContaSelecionada.percentual} className="h-2 bg-muted" />
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {contaSelecionada.saldo_atual > 0
                          ? `Ainda deve ${moeda.format(contaSelecionada.saldo_atual)} neste ciclo.`
                          : 'Conta quitada. Não há valor em aberto.'}
                      </p>
                    )}
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        className="h-10 shadow-none"
                        onClick={() => abrirPagamento(contaSelecionada)}
                        disabled={processando || contaSelecionada.saldo_atual <= 0}
                      >
                        <Banknote className="mr-1.5 size-4" />
                        Receber pagamento
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10 shadow-none"
                        onClick={() => void quitarConta(contaSelecionada)}
                        disabled={processando || contaSelecionada.saldo_atual <= 0}
                      >
                        {processando ? (
                          <Loader2 className="mr-1.5 size-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="mr-1.5 size-4" />
                        )}
                        Quitar tudo agora
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="h-10 shadow-none"
                        onClick={gerarPdfDetalhado}
                      >
                        <FileText className="mr-1.5 size-4" />
                        Baixar PDF
                      </Button>
                    </div>
                  </FieldGroupCrediario>

                  <FieldGroupCrediario title="Histórico">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-xs text-muted-foreground">
                      Pedidos no fiado e pagamentos já feitos
                      {movimentosAtuais.length > 0
                        ? ` · ${movimentosAtuais.length} registro${movimentosAtuais.length === 1 ? '' : 's'}`
                        : ''}
                    </p>
                    <div className="flex shrink-0 items-center gap-2">
                      {ciclosQuitados.length > 0 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 px-2 text-xs"
                          onClick={() => setMostrarMovimentacoesAntigas((atual) => !atual)}
                        >
                          <History className="mr-1 size-3.5" />
                          {mostrarMovimentacoesAntigas ? 'Ocultar antigas' : 'Ver antigas'}
                        </Button>
                      )}
                      {carregandoMovimentos && (
                        <Loader2 className="size-4 animate-spin text-muted-foreground" />
                      )}
                    </div>
                  </div>

                    <div className="space-y-2">
                      {movimentosAtuais.length === 0 && !carregandoMovimentos ? (
                        <div className="rounded-xl border border-dashed border-border/70 p-6 text-center text-sm text-muted-foreground">
                          Ainda não há pedidos ou pagamentos neste ciclo.
                        </div>
                      ) : (
                        movimentosAtuais.map((movimento) => {
                          const itens = extrairItensMovimento(movimento.itens)
                          const podeAbrirPedido = movimento.tipo === 'consumo' && Boolean(movimento.pedido_id)
                          return (
                            <div key={movimento.id} className="rounded-xl border border-border/70 p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span
                                      className={cn(
                                        'size-2 rounded-full',
                                        movimento.tipo === 'pagamento' ? 'bg-emerald-500' : 'bg-amber-500',
                                      )}
                                    />
                                    <p className="text-sm font-medium">
                                      {movimento.tipo === 'pagamento' ? 'Pagamento recebido' : movimento.tipo === 'consumo' ? 'Pedido no fiado' : movimento.tipo === 'estorno' ? 'Estorno' : 'Ajuste'}
                                    </p>
                                    {movimento.tipo === 'consumo' && (
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-7 px-2 text-[11px]"
                                        disabled={!podeAbrirPedido}
                                        onClick={() => abrirPedidoDoCrediario(movimento)}
                                        aria-label={
                                          podeAbrirPedido
                                            ? 'Abrir pedido em Pedidos'
                                            : 'Pedido legado sem vínculo'
                                        }
                                        title={
                                          podeAbrirPedido
                                            ? 'Abrir pedido em Pedidos'
                                            : 'Pedido legado sem vínculo'
                                        }
                                      >
                                        <ExternalLink className="mr-1 size-3" />
                                        Abrir pedido
                                      </Button>
                                    )}
                                  </div>
                                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                                    {movimento.descricao || 'Sem descricao'}
                                  </p>
                                  <p className="mt-2 text-[11px] text-muted-foreground">{formatarData(movimento.realizado_em)}</p>
                                  {movimento.tipo === 'consumo' && movimento.nome_responsavel_pedido && (
                                    <p className="mt-1 text-[11px] font-medium text-muted-foreground">
                                      Iniciado por: {movimento.nome_responsavel_pedido}
                                    </p>
                                  )}
                                </div>
                                <div className="flex shrink-0 items-start gap-2">
                                  <p
                                    className={cn(
                                      'font-mono text-sm font-semibold tabular-nums',
                                      movimento.tipo === 'pagamento' ? 'text-emerald-700 dark:text-emerald-300' : 'text-foreground',
                                    )}
                                  >
                                    {movimento.tipo === 'pagamento' ? '-' : '+'}
                                    {moeda.format(movimento.valor)}
                                  </p>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-7 px-2 text-[11px]"
                                    onClick={() => gerarPdfMovimentacao(movimento)}
                                    title="PDF da movimentacao"
                                  >
                                    <FileText className="mr-1 size-3" />
                                    PDF
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 px-0 text-muted-foreground hover:text-destructive"
                                    disabled={processando}
                                    onClick={() => setConfirmacao({ tipo: 'movimento', movimento })}
                                    title="Apagar movimento"
                                  >
                                    <Trash2 className="size-3.5" />
                                  </Button>
                                </div>
                              </div>

                              {itens.length > 0 && (
                                <div className="mt-3 space-y-1.5 border-t border-border/70 pt-3">
                                  {itens.map((item, indice) => (
                                    <div
                                      key={`${item.id || movimento.id}-${indice}`}
                                      className="flex flex-col gap-2 rounded-lg bg-muted/35 px-2.5 py-2 sm:flex-row sm:items-center sm:justify-between"
                                    >
                                      <div className="min-w-0">
                                        <p className="break-words text-xs font-medium leading-5">
                                          {item.quantidade}x {item.nome}
                                        </p>
                                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                                          {item.precoUnitario > 0 ? `${moeda.format(item.precoUnitario)} un.` : 'Item do historico'}
                                          {item.criadoEm ? ` · ${formatarData(item.criadoEm)}` : ''}
                                        </p>
                                        {item.observacoes && (
                                          <p className="break-words text-[11px] text-muted-foreground">{item.observacoes}</p>
                                        )}
                                      </div>
                                      <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                                        <span className="font-mono text-xs font-semibold tabular-nums">{moeda.format(item.subtotal)}</span>
                                        {movimento.tipo === 'consumo' && contaSelecionada.saldo_atual > 0 && item.subtotal > 0 && (
                                          <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="h-7 px-2 text-[11px]"
                                            onClick={() => abrirPagamentoItem(movimento, item)}
                                          >
                                            <CreditCard className="mr-1 size-3" />
                                            Pagar
                                          </Button>
                                        )}
                                        {movimento.tipo === 'consumo' && (
                                          <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="h-7 px-2 text-[11px] text-muted-foreground hover:text-destructive"
                                            disabled={processando}
                                            onClick={() => setConfirmacao({ tipo: 'item', movimento, itemIndice: indice, itemNome: item.nome })}
                                          >
                                            <Trash2 className="mr-1 size-3" />
                                            Apagar
                                          </Button>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )
                        })
                      )}
                    </div>

                    {mostrarMovimentacoesAntigas && ciclosQuitados.length > 0 && (
                      <div className="mt-4 rounded-xl border border-border/70 bg-muted/20 p-3">
                        <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm font-semibold">Crediarios pagos</p>
                            <p className="text-xs text-muted-foreground">
                              {ciclosQuitados.length} ciclo{ciclosQuitados.length === 1 ? '' : 's'} fechado
                              {ciclosQuitados.length === 1 ? '' : 's'}
                            </p>
                          </div>
                        </div>

                        <ScrollArea
                          className="rounded-lg pr-3"
                          style={{ height: 'min(18rem, 45vh)' }}
                        >
                          <div className="space-y-2 pr-2">
                            {ciclosQuitados.map((ciclo) => {
                              const itens = ciclo.consumos.flatMap((movimento) => extrairItensMovimento(movimento.itens))
                              const descricao = ciclo.consumos.map((movimento) => movimento.descricao || 'Consumo').join(' / ') || 'Consumo'

                              return (
                                <div key={`ciclo-${ciclo.id}`} className="rounded-lg border border-border/70 bg-card p-3">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="size-2 rounded-full bg-emerald-500" />
                                        <p className="text-sm font-medium">Crediario pago</p>
                                        <Badge variant="outline" className="h-6 rounded-md border-emerald-200 bg-emerald-50 px-2 text-[11px] text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
                                          Pago
                                        </Badge>
                                      </div>
                                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                                        {descricao}
                                      </p>
                                      <p className="mt-2 text-[11px] text-muted-foreground">
                                        {formatarData(ciclo.inicioEm)} - {formatarData(ciclo.fimEm)}
                                      </p>
                                    </div>
                                    <div className="flex shrink-0 flex-col items-end gap-2">
                                      <p className="font-mono text-sm font-semibold tabular-nums">{moeda.format(ciclo.totalConsumido)}</p>
                                      <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                                        Pago {moeda.format(ciclo.totalPago)}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border/70 pt-3 sm:flex sm:justify-end">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="h-8 px-2 text-xs"
                                      onClick={() => gerarPdfCicloCrediario(ciclo)}
                                      title="PDF do crediario pago"
                                    >
                                      <FileText className="mr-1 size-3.5" />
                                      PDF
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground"
                                      disabled={processando || ciclo.pagamentos.length === 0}
                                      onClick={() => setConfirmacao({ tipo: 'reverter-ciclo', ciclo })}
                                      title="Reverter crediario"
                                    >
                                      <History className="mr-1 size-3.5" />
                                      Reverter
                                    </Button>
                                  </div>

                                  {itens.length > 0 && (
                                    <div className="mt-3 space-y-1.5 border-t border-border/70 pt-3">
                                      {itens.map((item, indice) => (
                                        <div
                                          key={`ciclo-${ciclo.id}-${item.id || indice}`}
                                          className="flex flex-col gap-1 rounded-lg bg-muted/35 px-2.5 py-2 sm:flex-row sm:items-center sm:justify-between"
                                        >
                                          <div className="min-w-0">
                                            <p className="break-words text-xs font-medium leading-5">
                                              {item.quantidade}x {item.nome}
                                            </p>
                                            <p className="mt-0.5 text-[11px] text-muted-foreground">
                                              {item.precoUnitario > 0 ? `${moeda.format(item.precoUnitario)} un.` : 'Item do historico'}
                                              {item.criadoEm ? ` · ${formatarData(item.criadoEm)}` : ''}
                                            </p>
                                          </div>
                                          <span className="shrink-0 font-mono text-xs font-semibold tabular-nums">
                                            {moeda.format(item.subtotal)}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {itens.length === 0 && (
                                    <div className="mt-3 rounded-lg border border-dashed border-border/70 p-3 text-xs text-muted-foreground">
                                      Sem itens detalhados salvos neste consumo.
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </ScrollArea>
                      </div>
                    )}
                  </FieldGroupCrediario>
                </main>

                <div className="hidden bg-border/70 lg:block" aria-hidden />

                <aside className="grid min-w-0 content-start gap-5">
                  <FieldGroupCrediario title="Contato">
                    <dl className="grid gap-1">
                      <DetailRowCrediario
                        icon={<Phone />}
                        label="Telefone"
                        value={formatarTelefone(contaSelecionada.telefone)}
                      />
                      <DetailRowCrediario
                        icon={<Wallet />}
                        label="Cliente"
                        value={contaSelecionada.cliente_nome}
                      />
                    </dl>
                  </FieldGroupCrediario>

                  <FieldGroupCrediario title="Conta">
                    <dl className="grid gap-1">
                      <DetailRowCrediario
                        label="Status"
                        value={
                          contaSelecionada.status === 'aberto'
                            ? 'Em aberto'
                            : statusLabel[contaSelecionada.status] || contaSelecionada.status
                        }
                      />
                      <DetailRowCrediario
                        label="Origem"
                        value={
                          contaSelecionada.origem === 'migracao_edienai_antigo'
                            ? 'Conta antiga'
                            : 'Conta nova'
                        }
                      />
                      <DetailRowCrediario
                        label="Limite"
                        value={
                          contaSelecionada.limite_credito != null
                            ? moeda.format(contaSelecionada.limite_credito)
                            : null
                        }
                      />
                      <DetailRowCrediario
                        label="Observações"
                        value={contaSelecionada.observacoes}
                      />
                    </dl>
                  </FieldGroupCrediario>

                  <FieldGroupCrediario title="Datas">
                    <dl className="grid gap-1">
                      <DetailRowCrediario
                        label="Último movimento"
                        value={formatarData(
                          contaSelecionada.ultimo_movimento_em || contaSelecionada.atualizado_em,
                        )}
                      />
                      <DetailRowCrediario
                        label="Criada em"
                        value={formatarData(contaSelecionada.criado_em)}
                      />
                      <DetailRowCrediario
                        label="Atualizada em"
                        value={formatarData(contaSelecionada.atualizado_em)}
                      />
                      <DetailRowCrediario
                        label="Quitada em"
                        value={formatarData(contaSelecionada.quitado_em)}
                      />
                    </dl>
                  </FieldGroupCrediario>
                </aside>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(contaCobranca) && solicitarTelefoneCobranca}
        onOpenChange={(aberto) => {
          if (!aberto) {
            setContaCobrancaId(null)
            setSolicitarTelefoneCobranca(false)
            setTelefoneCobranca('')
          }
        }}
      >
        <DialogContent className="rounded-xl border-border/70 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar WhatsApp do cliente</DialogTitle>
            <DialogDescription>
              Esta conta ainda não tem um número válido. Ele será salvo no crediário antes do envio.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="telefone-cobranca">WhatsApp com DDD</Label>
            <Input
              id="telefone-cobranca"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="(86) 99999-9999"
              value={telefoneCobranca}
              onChange={(event) => setTelefoneCobranca(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  confirmarTelefoneCobranca()
                }
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">Cancelar</Button>
            </DialogClose>
            <Button
              type="button"
              className="bg-[#25D366] text-white hover:bg-[#1da851]"
              onClick={confirmarTelefoneCobranca}
            >
              <IconeWhatsApp className="mr-2 size-4" />
              Continuar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(contaCobranca) && !solicitarTelefoneCobranca}
        onOpenChange={(aberto) => {
          if (!aberto && !cobrancaEmEnvioId) {
            setContaCobrancaId(null)
            setTelefoneCobranca('')
          }
        }}
      >
        <AlertDialogContent className="rounded-xl border-border/70 shadow-[0_8px_32px_-12px_rgba(15,23,42,0.12)]">
          <AlertDialogHeader>
            <AlertDialogTitle>Enviar lembrete pelo WhatsApp?</AlertDialogTitle>
            <AlertDialogDescription>
              {contaCobranca
                ? `${contaCobranca.cliente_nome} receberá o resumo das compras e o saldo atual de ${moeda.format(contaCobranca.saldo_atual)}. Confira o telefone: ${formatarTelefone(temWhatsAppValido(contaCobranca.telefone) ? contaCobranca.telefone : telefoneCobranca)}.`
                : 'A mensagem será montada com os dados atuais do crediário.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(cobrancaEmEnvioId)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={Boolean(cobrancaEmEnvioId)}
              className="bg-[#25D366] text-white hover:bg-[#1da851]"
              onClick={(event) => {
                event.preventDefault()
                void enviarCobranca()
              }}
            >
              {cobrancaEmEnvioId
                ? <Loader2 className="mr-2 size-4 animate-spin" />
                : <IconeWhatsApp className="mr-2 size-4" />}
              Enviar cobrança
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(confirmacao)} onOpenChange={(aberto) => !aberto && setConfirmacao(null)}>
        <AlertDialogContent className="rounded-xl border-border/70 shadow-[0_8px_32px_-12px_rgba(15,23,42,0.12)]">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmacao?.tipo === 'item'
                ? 'Remover este item do fiado?'
                : confirmacao?.tipo === 'reverter-ciclo'
                  ? 'Desfazer a quitação?'
                  : 'Remover este registro?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmacao?.tipo === 'item'
                ? `O item "${confirmacao.itemNome}" sai do fiado e o valor devido é recalculado.`
                : confirmacao?.tipo === 'reverter-ciclo'
                  ? 'Os pagamentos deste ciclo voltam a ficar em aberto. Use só se a quitação foi um engano.'
                  : 'Este registro será cancelado e o valor devido do cliente será recalculado.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={processando}
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={(event) => {
                event.preventDefault()
                void executarConfirmacao()
              }}
            >
              {processando && <Loader2 className="mr-2 size-4 animate-spin" />}
              {confirmacao?.tipo === 'reverter-ciclo' ? 'Reverter' : 'Apagar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={dialogPagamentoAberto}
        onOpenChange={(aberto) => {
          setDialogPagamentoAberto(aberto)
          if (!aberto) setContaPagamentoId(null)
        }}
      >
        <DialogContent className="rounded-xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Receber pagamento do fiado</DialogTitle>
            <DialogDescription>
              {contaPagamento
                ? `${contaPagamento.cliente_nome} ainda deve ${moeda.format(contaPagamento.saldo_atual)}. Digite quanto está pagando agora.`
                : 'Informe o valor recebido do cliente.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {contaPagamento ? (
              <div className="rounded-lg border border-border/70 bg-muted/30 px-3 py-2.5 text-sm">
                <p className="text-muted-foreground">Valor em aberto</p>
                <p className="mt-0.5 text-lg font-semibold tabular-nums">{moeda.format(contaPagamento.saldo_atual)}</p>
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="valor-pagamento">Valor recebido agora</Label>
              <Input
                id="valor-pagamento"
                value={valorPagamento}
                onChange={(event) => setValorPagamento(event.target.value)}
                inputMode="decimal"
                placeholder="0,00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="descricao-pagamento">Descricao</Label>
              <Input
                id="descricao-pagamento"
                value={descricaoPagamento}
                onChange={(event) => setDescricaoPagamento(event.target.value)}
                placeholder="Pagamento recebido"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setDialogPagamentoAberto(false)} disabled={processando}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void registrarPagamento()} disabled={processando}>
              {processando && <Loader2 className="mr-2 size-4 animate-spin" />}
              Confirmar recebimento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ModalFormaPagamentoItens
        aberto={Boolean(pagamentoItemAberto)}
        itens={pagamentoItemAberto ? [{
          id: pagamentoItemAberto.item.id || '',
          nome: pagamentoItemAberto.item.nome,
          quantidade: pagamentoItemAberto.item.quantidade,
          precoUnitario: pagamentoItemAberto.item.precoUnitario,
          subtotal: pagamentoItemAberto.item.subtotal,
          observacoes: pagamentoItemAberto.item.observacoes || null,
          criadoEm: pagamentoItemAberto.item.criadoEm || null,
        } satisfies ItemPagamento] : []}
        quantidadesPorItem={pagamentoItemAberto?.quantidadesPorItem || {}}
        quantidadesDisponiveis={pagamentoItemAberto && pagamentoItemAberto.item.id
          ? { [pagamentoItemAberto.item.id]: pagamentoItemAberto.item.quantidade }
          : {}}
        formasDisponiveis={['pix', 'dinheiro', 'cartao']}
        processando={processando}
        onFechar={() => setPagamentoItemAberto(null)}
        onQuantidadeChange={(itemId, quantidade) => {
          setPagamentoItemAberto((atual) => atual ? {
            ...atual,
            quantidadesPorItem: {
              ...atual.quantidadesPorItem,
              [itemId]: normalizarQuantidadeUnidades(quantidade, atual.item.quantidade),
            },
          } : null)
        }}
        onSelecionarForma={(forma, itensPagos) => {
          if (forma === 'crediario') return
          void registrarPagamentoItem(itensPagos, forma)
        }}
      />
    </div>
  )
}
