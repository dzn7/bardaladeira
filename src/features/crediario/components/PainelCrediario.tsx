'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Money as Banknote, CalendarCheck as CalendarClock, CheckCircle as CheckCircle2, CreditCard, ArrowSquareOut as ExternalLink, FileText, ClockCounterClockwise as History, CircleNotch as Loader2, ArrowsClockwise as RefreshCw, MagnifyingGlass as Search, Trash as Trash2, Wallet, X } from '@phosphor-icons/react'
import { toast } from 'sonner'
import IconeWhatsApp from '@/components/icons/IconeWhatsApp'
import {
  Botao,
  CabecalhoPagina,
  Campo,
  Cartao,
  Chip,
  Entrada,
  EntradaPreco,
  Gaveta,
  Lista,
  ListaCarregando,
  ListaVazia,
  Pagina,
  Secao,
  Selecao,
  Selo,
  useConfirmar,
} from '@/components/admin/ui'
import { MenuAcoes } from '@/components/ui/menu-acoes'
import { Progress } from '@/components/ui/progress'
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

const InlineFactCrediario = ({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: string
}) => (
  <div className="min-w-0 px-3 py-2.5">
    <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
      <span className="[&_svg]:size-3.5" aria-hidden>
        {icon}
      </span>
      <span className="truncate">{label}</span>
    </p>
    <p className="mt-0.5 truncate text-base font-semibold tabular-nums text-foreground">{value}</p>
  </div>
)

const DetailRowCrediario = ({ label, value }: { label: string; value: string | null | undefined }) => {
  const filled = Boolean(value && value !== '--' && value !== '—')
  return (
    <div className="flex items-baseline justify-between gap-3 px-4 py-2.5">
      <dt className="shrink-0 text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate text-right text-sm text-foreground">{filled ? value : '—'}</dd>
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
  const confirmar = useConfirmar()
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
  const [processando, setProcessando] = useState(false)
  const [contaCobrancaId, setContaCobrancaId] = useState<string | null>(null)
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

  const temFiltroAtivo = filtroStatus !== 'aberto' || filtroOrigem !== 'novo' || Boolean(busca.trim())

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
    setTelefoneCobranca('')
    if (temWhatsAppValido(conta.telefone)) {
      void confirmarEnvioCobranca(conta)
      return
    }
    setContaCobrancaId(conta.id)
  }

  const confirmarTelefoneCobranca = () => {
    if (!temWhatsAppValido(telefoneCobranca)) {
      toast.error('Digite um WhatsApp válido com DDD.')
      return
    }
    const conta = contaCobranca
    setContaCobrancaId(null)
    if (conta) void confirmarEnvioCobranca(conta, telefoneCobranca)
  }

  /** `telefone` só vem quando a conta não tem WhatsApp válido salvo. */
  const confirmarEnvioCobranca = async (conta: ContaCrediario, telefone?: string) => {
    const ok = await confirmar({
      titulo: 'Enviar lembrete pelo WhatsApp?',
      descricao: `${conta.cliente_nome} receberá o resumo das compras e o saldo atual de ${moeda.format(conta.saldo_atual)}. Confira o telefone: ${formatarTelefone(telefone ?? conta.telefone)}.`,
      confirmar: 'Enviar cobrança',
    })
    if (ok) await enviarCobranca(conta, telefone)
    else setTelefoneCobranca('')
  }

  const enviarCobranca = async (conta: ContaCrediario, telefone?: string) => {
    if (cobrancaEmEnvioId) return

    try {
      setCobrancaEmEnvioId(conta.id)
      const response = await fetch('/api/crediario/cobranca', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contaId: conta.id,
          telefone: temWhatsAppValido(conta.telefone) ? undefined : telefone,
        }),
      })
      const data = (await response.json().catch(() => null)) as { sucesso?: boolean; mensagem?: string; erro?: string; telefone?: string } | null
      if (!response.ok || !data?.sucesso) {
        throw new Error(data?.erro || 'Não foi possível enviar a cobrança.')
      }

      toast.success('Cobrança enviada pelo WhatsApp', {
        description: `Mensagem enviada para ${conta.cliente_nome}.`,
      })
      if (data.telefone) {
        setContas((atuais) => atuais.map((item) => (
          item.id === conta.id ? { ...item, telefone: data.telefone || item.telefone } : item
        )))
      }
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
      await carregarContas({ silencioso: true })
      await carregarMovimentos(contaSelecionada.id)
    } catch (error) {
      console.error('[Crediario] Erro ao reverter crediario:', error)
      toast.error(obterMensagemErro(error) || 'Nao foi possivel reverter o crediario')
    } finally {
      setProcessando(false)
    }
  }

  const pedirRemoverMovimento = async (movimento: MovimentoCrediario) => {
    const ok = await confirmar({
      titulo: 'Remover este registro?',
      descricao: 'Este registro será cancelado e o valor devido do cliente será recalculado.',
      confirmar: 'Apagar',
      perigo: true,
    })
    if (ok) await cancelarMovimento(movimento)
  }

  const pedirRemoverItem = async (movimento: MovimentoCrediario, itemIndice: number, itemNome: string) => {
    const ok = await confirmar({
      titulo: 'Remover este item do fiado?',
      descricao: `O item "${itemNome}" sai do fiado e o valor devido é recalculado.`,
      confirmar: 'Apagar',
      perigo: true,
    })
    if (ok) await apagarItemMovimento(movimento, itemIndice)
  }

  const pedirReverterCiclo = async (ciclo: CicloCrediario) => {
    const ok = await confirmar({
      titulo: 'Desfazer a quitação?',
      descricao: 'Os pagamentos deste ciclo voltam a ficar em aberto. Use só se a quitação foi um engano.',
      confirmar: 'Reverter',
      perigo: true,
    })
    if (ok) await reverterCicloCrediario(ciclo)
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

  const ehDemoSelecionada = contaSelecionada?.id === CONTA_DEMO_ID
  const classeAcaoLinha = 'h-11 md:h-8 md:px-2.5 md:text-xs'

  return (
    <Pagina>
      <CabecalhoPagina
        titulo="Crediário"
        descricao={`${resumo.abertas} ${resumo.abertas === 1 ? 'conta aberta' : 'contas abertas'} · ${moeda.format(resumo.saldoAberto)} a receber · ${resumo.quitadas} ${resumo.quitadas === 1 ? 'quitada' : 'quitadas'}`}
        acoes={
          <Botao variante="contorno" onClick={() => void carregarContas()} disabled={carregandoContas}>
            <RefreshCw className={cn(carregandoContas && 'animate-spin')} />
            Atualizar
          </Botao>
        }
      />

      <div className="space-y-3">
        <div className="relative" data-onboarding="crediario-busca">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Entrada
            type="search"
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            placeholder="Buscar cliente, telefone ou ID antigo"
            aria-label="Buscar contas do crediário"
            className="pl-9 pr-11"
          />
          {busca ? (
            <button
              type="button"
              onClick={() => setBusca('')}
              className="absolute right-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="Limpar busca"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div
            className="flex gap-2 overflow-x-auto pb-1 md:pb-0"
            role="group"
            aria-label="Filtro de status do crediário"
            data-onboarding="crediario-filtro-status"
          >
            <Chip ativo={filtroStatus === 'aberto'} onClick={() => setFiltroStatus('aberto')} className="h-11 md:h-9">
              <Wallet className="size-4" />
              Abertas
            </Chip>
            <Chip ativo={filtroStatus === 'quitado'} onClick={() => setFiltroStatus('quitado')} className="h-11 md:h-9">
              <CheckCircle2 className="size-4" />
              Quitadas
            </Chip>
            <Chip ativo={filtroStatus === 'todos'} onClick={() => setFiltroStatus('todos')} className="h-11 md:h-9">
              <History className="size-4" />
              Todas
            </Chip>
          </div>
          <div className="grid grid-cols-2 gap-2 md:flex">
            <Selecao
              value={filtroOrigem}
              onChange={(event) => setFiltroOrigem(event.target.value as FiltroOrigem)}
              aria-label="Origem das contas"
              className="md:w-44"
            >
              <option value="novo">Contas novas</option>
              <option value="legado">Sistema antigo</option>
              <option value="todos">Todas as origens</option>
            </Selecao>
            <Selecao
              value={ordenacao}
              onChange={(event) => setOrdenacao(event.target.value as OrdenacaoContas)}
              aria-label="Ordenar contas"
              className="md:w-44"
            >
              <option value="recentes">Mais recentes</option>
              <option value="antigas">Mais antigas</option>
              <option value="maior_saldo">Maior saldo</option>
              <option value="menor_saldo">Menor saldo</option>
            </Selecao>
          </div>
        </div>
      </div>

      <div className="flex min-h-9 items-center justify-between gap-3 px-1">
        <p className="text-sm text-muted-foreground">
          {contasFiltradas.length} {contasFiltradas.length === 1 ? 'conta' : 'contas'} · {origemAtualLabel}
        </p>
        {temFiltroAtivo ? (
          <Botao variante="fantasma" tamanho="sm" onClick={handleLimparFiltros}>
            Limpar filtros
          </Botao>
        ) : null}
      </div>

      {carregandoContas ? (
        <ListaCarregando linhas={6} />
      ) : contasFiltradas.length === 0 ? (
        <ListaVazia
          icone={<Wallet />}
          titulo="Nenhuma conta encontrada"
          descricao="O fiado aparece aqui quando um pedido é fechado com a forma de pagamento Fiado. Ajuste os filtros para ver outras contas."
          acao={
            temFiltroAtivo ? (
              <Botao variante="contorno" onClick={handleLimparFiltros}>
                Limpar filtros
              </Botao>
            ) : undefined
          }
        />
      ) : (
        <>
          <Lista>
            {contasPagina.map((conta) => (
              <li key={conta.id}>
                <CardContaCrediario
                  conta={conta}
                  statusRotulo={statusLabel[conta.status] || conta.status}
                  telefoneFormatado={formatarTelefone(conta.telefone)}
                  dataFormatada={formatarData(conta.ultimo_movimento_em || conta.atualizado_em)}
                  saldoFormatado={moeda.format(conta.saldo_atual)}
                  progresso={calcularProgressoPagamento(conta, movimentosResumoPorConta.get(conta.id))}
                  responsavel={responsaveisResumoPorConta.get(conta.id)}
                  selecionada={contaSelecionadaId === conta.id}
                  processando={processando}
                  cobrancaDisponivel={conta.id !== CONTA_DEMO_ID && conta.status === 'aberto' && conta.saldo_atual > 0}
                  cobrancaEmEnvio={cobrancaEmEnvioId === conta.id}
                  demo={conta.id === CONTA_DEMO_ID}
                  onDetalhes={() => abrirDetalhes(conta)}
                  onPagar={() => abrirPagamento(conta)}
                  onQuitar={() => void quitarConta(conta)}
                  onCobrar={() => abrirCobranca(conta)}
                />
              </li>
            ))}
          </Lista>

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

      {/*
        Detalhes da conta. Durante o tutorial a gaveta fica travada (bloqueada):
        só o tour abre/fecha, e tocar no popover do onboarding não a fecha.
      */}
      <Gaveta
        aberto={dialogDetalhesAberto}
        aoFechar={() => {
          setDialogDetalhesAberto(false)
          setContaSelecionadaId(null)
          setMovimentos([])
          setMostrarMovimentacoesAntigas(false)
        }}
        bloqueada={ehDemoSelecionada}
        largura="lg"
        titulo={contaSelecionada ? contaSelecionada.cliente_nome : 'Detalhes do fiado'}
        descricao={
          contaSelecionada ? (
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <Selo tom={contaSelecionada.status === 'aberto' ? 'alerta' : 'sucesso'}>
                {contaSelecionada.status === 'aberto'
                  ? 'Em aberto'
                  : statusLabel[contaSelecionada.status] || contaSelecionada.status}
              </Selo>
              <span className="tabular-nums">{formatarTelefone(contaSelecionada.telefone)}</span>
              <span aria-hidden>·</span>
              <span>{contaSelecionada.origem === 'migracao_edienai_antigo' ? 'Conta antiga' : 'Conta nova'}</span>
            </span>
          ) : undefined
        }
        rodape={
          contaSelecionada ? (
            <>
              <Botao
                variante="fantasma"
                className="md:mr-auto"
                onClick={gerarPdfDetalhado}
                aria-label="Baixar PDF"
                data-onboarding={ehDemoSelecionada ? 'demo-pdf' : undefined}
              >
                <FileText />
                PDF
              </Botao>
              <Botao
                variante="contorno"
                onClick={() => void quitarConta(contaSelecionada)}
                disabled={processando || contaSelecionada.saldo_atual <= 0}
                carregando={processando}
                aria-label="Quitar tudo agora"
                data-onboarding={ehDemoSelecionada ? 'demo-quitar' : undefined}
              >
                {!processando && <CheckCircle2 />}
                Quitar
              </Botao>
              <Botao
                onClick={() => abrirPagamento(contaSelecionada)}
                disabled={processando || contaSelecionada.saldo_atual <= 0}
                aria-label="Receber pagamento"
                data-onboarding={ehDemoSelecionada ? 'demo-pagamento' : undefined}
              >
                <Banknote />
                Receber
              </Botao>
            </>
          ) : undefined
        }
      >
        {!contaSelecionada ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Selecione uma conta</p>
        ) : (
          <div className="space-y-6">
            <div className="space-y-3">
              <Cartao
                className="grid grid-cols-3 divide-x divide-border/70"
                data-onboarding={ehDemoSelecionada ? 'demo-modal-visao' : undefined}
              >
                <InlineFactCrediario
                  icon={<Banknote />}
                  label="Deve"
                  value={moeda.format(contaSelecionada.saldo_atual)}
                />
                <InlineFactCrediario
                  icon={<Wallet />}
                  label="Pedidos"
                  value={String(progressoContaSelecionada?.totalConsumos ?? contaSelecionada.total_consumos)}
                />
                <InlineFactCrediario
                  icon={<CalendarClock />}
                  label="Pagamentos"
                  value={String(progressoContaSelecionada?.totalPagamentos ?? contaSelecionada.total_pagamentos)}
                />
              </Cartao>

              {progressoContaSelecionada && progressoContaSelecionada.temPagamentoParcial ? (
                <div className="space-y-2 px-1">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-muted-foreground">
                      Já pagou {moeda.format(progressoContaSelecionada.totalPago)} de{' '}
                      {moeda.format(progressoContaSelecionada.totalConsumido)}
                    </span>
                    <span className="font-semibold tabular-nums">
                      {Math.round(progressoContaSelecionada.percentual)}%
                    </span>
                  </div>
                  <Progress value={progressoContaSelecionada.percentual} className="h-2 bg-muted" />
                </div>
              ) : (
                <p className="px-1 text-sm text-muted-foreground">
                  {contaSelecionada.saldo_atual > 0
                    ? `Ainda deve ${moeda.format(contaSelecionada.saldo_atual)} neste ciclo.`
                    : 'Conta quitada. Não há valor em aberto.'}
                </p>
              )}
            </div>

            <Secao
              titulo="Histórico"
              descricao={`Pedidos no fiado e pagamentos${movimentosAtuais.length > 0 ? ` · ${movimentosAtuais.length} registro${movimentosAtuais.length === 1 ? '' : 's'}` : ''}`}
              acao={
                <div className="flex shrink-0 items-center gap-2">
                  {carregandoMovimentos && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
                  {ciclosQuitados.length > 0 && (
                    <Botao
                      variante="fantasma"
                      tamanho="sm"
                      onClick={() => setMostrarMovimentacoesAntigas((atual) => !atual)}
                    >
                      <History />
                      {mostrarMovimentacoesAntigas ? 'Ocultar pagos' : 'Ver pagos'}
                    </Botao>
                  )}
                </div>
              }
            >
              {movimentosAtuais.length === 0 && !carregandoMovimentos ? (
                <div className="rounded-xl border border-dashed border-border/70 p-6 text-center text-sm text-muted-foreground">
                  Ainda não há pedidos ou pagamentos neste ciclo.
                </div>
              ) : (
                <Lista>
                  {movimentosAtuais.map((movimento) => {
                    const itens = extrairItensMovimento(movimento.itens)
                    const podeAbrirPedido = movimento.tipo === 'consumo' && Boolean(movimento.pedido_id)
                    return (
                      <li key={movimento.id} className="px-4 py-3">
                        <div className="flex items-start gap-3">
                          <span
                            className={cn(
                              'mt-2 size-2 shrink-0 rounded-full',
                              movimento.tipo === 'pagamento' ? 'bg-emerald-500' : 'bg-amber-500',
                            )}
                            aria-hidden
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground">
                              {movimento.tipo === 'pagamento'
                                ? 'Pagamento recebido'
                                : movimento.tipo === 'consumo'
                                  ? 'Pedido no fiado'
                                  : movimento.tipo === 'estorno'
                                    ? 'Estorno'
                                    : 'Ajuste'}
                            </p>
                            <p className="mt-0.5 line-clamp-2 text-[13px] text-muted-foreground">
                              {movimento.descricao || 'Sem descrição'}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {formatarData(movimento.realizado_em)}
                              {movimento.tipo === 'consumo' && movimento.nome_responsavel_pedido
                                ? ` · Iniciado por ${movimento.nome_responsavel_pedido}`
                                : ''}
                            </p>
                          </div>
                          <p
                            className={cn(
                              'shrink-0 pt-0.5 text-sm font-semibold tabular-nums',
                              movimento.tipo === 'pagamento' ? 'text-emerald-700 dark:text-emerald-300' : 'text-foreground',
                            )}
                          >
                            {movimento.tipo === 'pagamento' ? '-' : '+'}
                            {moeda.format(movimento.valor)}
                          </p>
                          <MenuAcoes
                            ariaLabel="Ações do registro"
                            triggerClassName="-mr-2 -mt-1.5 h-11 w-11 md:h-9 md:w-9"
                            items={[
                              ...(movimento.tipo === 'consumo'
                                ? [
                                    {
                                      key: 'pedido',
                                      label: podeAbrirPedido ? 'Abrir pedido' : 'Pedido antigo sem vínculo',
                                      icon: <ExternalLink className="h-3.5 w-3.5" />,
                                      onSelect: () => abrirPedidoDoCrediario(movimento),
                                      disabled: !podeAbrirPedido,
                                    },
                                  ]
                                : []),
                              {
                                key: 'pdf',
                                label: 'Baixar PDF',
                                icon: <FileText className="h-3.5 w-3.5" />,
                                onSelect: () => gerarPdfMovimentacao(movimento),
                              },
                              {
                                key: 'apagar',
                                label: 'Apagar registro',
                                icon: <Trash2 className="h-3.5 w-3.5" />,
                                onSelect: () => void pedirRemoverMovimento(movimento),
                                disabled: processando,
                                variant: 'destructive',
                                separatorBefore: true,
                              },
                            ]}
                          />
                        </div>

                        {itens.length > 0 && (
                          <ul className="mt-3 space-y-2 pl-5">
                            {itens.map((item, indice) => (
                              <li
                                key={`${item.id || movimento.id}-${indice}`}
                                className="rounded-lg bg-muted/40 px-3 py-2"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="break-words text-sm text-foreground">
                                      {item.quantidade}x {item.nome}
                                    </p>
                                    <p className="mt-0.5 text-xs text-muted-foreground">
                                      {item.precoUnitario > 0 ? `${moeda.format(item.precoUnitario)} un.` : 'Item do histórico'}
                                      {item.criadoEm ? ` · ${formatarData(item.criadoEm)}` : ''}
                                    </p>
                                    {item.observacoes && (
                                      <p className="break-words text-xs text-muted-foreground">{item.observacoes}</p>
                                    )}
                                  </div>
                                  <span className="shrink-0 text-sm font-medium tabular-nums">{moeda.format(item.subtotal)}</span>
                                </div>
                                {movimento.tipo === 'consumo' && (
                                  <div className="mt-2 flex gap-2">
                                    {contaSelecionada.saldo_atual > 0 && item.subtotal > 0 && (
                                      <Botao
                                        variante="contorno"
                                        tamanho="sm"
                                        className={cn('flex-1 md:flex-none', classeAcaoLinha)}
                                        onClick={() => abrirPagamentoItem(movimento, item)}
                                      >
                                        <CreditCard />
                                        Pagar item
                                      </Botao>
                                    )}
                                    <Botao
                                      variante="perigoSuave"
                                      tamanho="sm"
                                      className={cn('flex-1 md:flex-none', classeAcaoLinha)}
                                      disabled={processando}
                                      onClick={() => void pedirRemoverItem(movimento, indice, item.nome)}
                                    >
                                      <Trash2 />
                                      Apagar
                                    </Botao>
                                  </div>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    )
                  })}
                </Lista>
              )}
            </Secao>

            {mostrarMovimentacoesAntigas && ciclosQuitados.length > 0 && (
              <Secao
                titulo="Crediários pagos"
                descricao={`${ciclosQuitados.length} ciclo${ciclosQuitados.length === 1 ? '' : 's'} fechado${ciclosQuitados.length === 1 ? '' : 's'}`}
              >
                <Lista>
                  {ciclosQuitados.map((ciclo) => {
                    const itens = ciclo.consumos.flatMap((movimento) => extrairItensMovimento(movimento.itens))
                    const descricao = ciclo.consumos.map((movimento) => movimento.descricao || 'Consumo').join(' / ') || 'Consumo'

                    return (
                      <li key={`ciclo-${ciclo.id}`} className="px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-foreground">Crediário pago</p>
                              <Selo tom="sucesso">Pago</Selo>
                            </div>
                            <p className="mt-0.5 line-clamp-2 text-[13px] text-muted-foreground">{descricao}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {formatarData(ciclo.inicioEm)} até {formatarData(ciclo.fimEm)}
                            </p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-sm font-semibold tabular-nums">{moeda.format(ciclo.totalConsumido)}</p>
                            <p className="text-xs text-emerald-700 dark:text-emerald-300">
                              Pago {moeda.format(ciclo.totalPago)}
                            </p>
                          </div>
                        </div>

                        {itens.length > 0 ? (
                          <ul className="mt-2 space-y-1">
                            {itens.map((item, indice) => (
                              <li
                                key={`ciclo-${ciclo.id}-${item.id || indice}`}
                                className="flex items-baseline justify-between gap-3 text-[13px] text-muted-foreground"
                              >
                                <span className="min-w-0 break-words">
                                  {item.quantidade}x {item.nome}
                                </span>
                                <span className="shrink-0 tabular-nums">{moeda.format(item.subtotal)}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-2 text-[13px] text-muted-foreground">Sem itens detalhados salvos neste consumo.</p>
                        )}

                        <div className="mt-3 flex gap-2">
                          <Botao
                            variante="contorno"
                            tamanho="sm"
                            className={cn('flex-1 md:flex-none', classeAcaoLinha)}
                            onClick={() => gerarPdfCicloCrediario(ciclo)}
                          >
                            <FileText />
                            PDF
                          </Botao>
                          <Botao
                            variante="contorno"
                            tamanho="sm"
                            className={cn('flex-1 md:flex-none', classeAcaoLinha)}
                            disabled={processando || ciclo.pagamentos.length === 0}
                            onClick={() => void pedirReverterCiclo(ciclo)}
                          >
                            <History />
                            Desfazer quitação
                          </Botao>
                        </div>
                      </li>
                    )
                  })}
                </Lista>
              </Secao>
            )}

            <Secao titulo="Dados da conta">
              <Cartao>
                <dl className="divide-y divide-border/70">
                  <DetailRowCrediario label="Telefone" value={formatarTelefone(contaSelecionada.telefone)} />
                  <DetailRowCrediario
                    label="Limite"
                    value={
                      contaSelecionada.limite_credito != null ? moeda.format(contaSelecionada.limite_credito) : null
                    }
                  />
                  <DetailRowCrediario label="Observações" value={contaSelecionada.observacoes} />
                  <DetailRowCrediario
                    label="Último movimento"
                    value={formatarData(contaSelecionada.ultimo_movimento_em || contaSelecionada.atualizado_em)}
                  />
                  <DetailRowCrediario label="Criada em" value={formatarData(contaSelecionada.criado_em)} />
                  <DetailRowCrediario label="Atualizada em" value={formatarData(contaSelecionada.atualizado_em)} />
                  <DetailRowCrediario label="Quitada em" value={formatarData(contaSelecionada.quitado_em)} />
                </dl>
              </Cartao>
            </Secao>
          </div>
        )}
      </Gaveta>

      <Gaveta
        aberto={Boolean(contaCobranca)}
        aoFechar={() => {
          setContaCobrancaId(null)
          setTelefoneCobranca('')
        }}
        titulo="WhatsApp do cliente"
        descricao="Esta conta ainda não tem um número válido. Ele será salvo no crediário antes do envio."
        rodape={
          <>
            <Botao
              variante="contorno"
              onClick={() => {
                setContaCobrancaId(null)
                setTelefoneCobranca('')
              }}
            >
              Cancelar
            </Botao>
            <Botao onClick={confirmarTelefoneCobranca}>
              <IconeWhatsApp className="size-4" />
              Continuar
            </Botao>
          </>
        }
      >
        <form
          onSubmit={(event) => {
            event.preventDefault()
            confirmarTelefoneCobranca()
          }}
        >
          <Campo rotulo="WhatsApp com DDD" htmlFor="telefone-cobranca">
            <Entrada
              id="telefone-cobranca"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="(86) 99999-9999"
              value={telefoneCobranca}
              onChange={(event) => setTelefoneCobranca(event.target.value)}
            />
          </Campo>
          <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
        </form>
      </Gaveta>

      <Gaveta
        aberto={dialogPagamentoAberto}
        aoFechar={() => {
          setDialogPagamentoAberto(false)
          setContaPagamentoId(null)
        }}
        bloqueada={processando}
        titulo="Receber pagamento"
        descricao={
          contaPagamento
            ? `${contaPagamento.cliente_nome} ainda deve ${moeda.format(contaPagamento.saldo_atual)}. Digite quanto está pagando agora.`
            : 'Informe o valor recebido do cliente.'
        }
        rodape={
          <>
            <Botao
              variante="contorno"
              onClick={() => {
                setDialogPagamentoAberto(false)
                setContaPagamentoId(null)
              }}
              disabled={processando}
            >
              Cancelar
            </Botao>
            <Botao carregando={processando} onClick={() => void registrarPagamento()}>
              Confirmar recebimento
            </Botao>
          </>
        }
      >
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault()
            void registrarPagamento()
          }}
        >
          {contaPagamento ? (
            <div className="flex items-baseline justify-between gap-3 rounded-xl bg-muted/50 px-4 py-3">
              <span className="text-sm text-muted-foreground">Valor em aberto</span>
              <span className="text-lg font-semibold tabular-nums">{moeda.format(contaPagamento.saldo_atual)}</span>
            </div>
          ) : null}
          <Campo rotulo="Valor recebido agora" htmlFor="valor-pagamento">
            <EntradaPreco id="valor-pagamento" valor={valorPagamento} aoMudar={setValorPagamento} />
          </Campo>
          <Campo rotulo="Descrição" htmlFor="descricao-pagamento" opcional>
            <Entrada
              id="descricao-pagamento"
              value={descricaoPagamento}
              onChange={(event) => setDescricaoPagamento(event.target.value)}
              placeholder="Pagamento recebido"
            />
          </Campo>
          <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
        </form>
      </Gaveta>

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
    </Pagina>
  )
}
