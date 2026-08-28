'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  ShoppingCart,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  Calendar,
  ArrowRight,
} from 'lucide-react'
import Link from 'next/link'
import ProtectedRoute from '@/components/admin/ProtectedRoute'
import AdminLayout from '@/components/admin/AdminLayout'
import { supabase } from '@/lib/supabase'
import { gerarPDFPedido } from '@/lib/pdf-generator'
import { cn } from '@/lib/utils'
import { obterIntervaloDiaOperacionalAtual } from '@/lib/dia-operacional'
import ModalEditarPedido from '@/components/admin/ModalEditarPedido'
import ModalNotificacao from '@/components/ModalNotificacao'
import ModalWhatsApp from '@/components/admin/ModalWhatsApp'
import ModalDetalhesPedido from '@/components/admin/ModalDetalhesPedido'
import GerenciadorImpressao from '@/components/admin/GerenciadorImpressao'
import ControleStatusLoja from '@/components/admin/ControleStatusLoja'
import CardPedido, { type Pedido } from '@/components/admin/CardPedido'
import { ListaVazia, TabelaSkeleton } from '@/components/admin/filtros/ListaEstado'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  carregarCrediarioPorPedido,
  carregarGarconsPorIds,
  carregarItensPorPedido,
} from '@/lib/pedidos-utils'
import { carregarPagamentosParciaisPorPedido } from '@/lib/pagamentoParcial'

// Retorna início e fim de um mês no timezone de São Paulo (UTC-3)
function obterPeriodoMes(ano: number, mes: number): { inicio: string; fim: string } {
  // Início: dia 1 às 00:00:00 em SP = 03:00:00 UTC
  const inicio = `${ano}-${String(mes).padStart(2, '0')}-01T03:00:00.000Z`
  // Fim: último dia do mês às 23:59:59.999 em SP
  const ultimoDia = new Date(ano, mes, 0).getDate()
  const fimLocal = new Date(ano, mes - 1, ultimoDia, 23, 59, 59, 999)
  // Converter pra UTC adicionando 3h
  const fimUTC = new Date(fimLocal.getTime() + 3 * 60 * 60 * 1000)
  const fim = fimUTC.toISOString()
  return { inicio, fim }
}

// Retorna o mês e ano atuais no timezone de São Paulo
function obterMesAtualSP(): { mes: number; ano: number } {
  const agora = new Date()
  const spDate = new Date(agora.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
  return { mes: spDate.getMonth() + 1, ano: spDate.getFullYear() }
}

const NOMES_MESES = [
  '', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]

const COLUNAS_PEDIDO_DASHBOARD =
  'id, nome_cliente, telefone, endereco, bairro, tipo_entrega, status, subtotal, taxa_entrega, taxa_servico, total, created_at, mesa, comanda, forma_pagamento, pagamento_online, pagamento_online_status, garcom_id'

type Estatisticas = {
  totalPedidos: number
  pedidosHoje: number
  receitaTotal: number
  receitaHoje: number
}

// Formata valor monetário no padrão brasileiro (R$ 1.234,56)
const formatarMoeda = (valor: number): string => {
  return valor.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

export default function Dashboard() {
  const mesAtualSP = obterMesAtualSP()
  const [mesSelecionado, setMesSelecionado] = useState(mesAtualSP.mes)
  const [anoSelecionado, setAnoSelecionado] = useState(mesAtualSP.ano)
  const [estatisticas, setEstatisticas] = useState<Estatisticas>({
    totalPedidos: 0,
    pedidosHoje: 0,
    receitaTotal: 0,
    receitaHoje: 0,
  })
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [loading, setLoading] = useState(true)
  const [valoresOcultos, setValoresOcultos] = useState(false)
  const [pedidoSelecionado, setPedidoSelecionado] = useState<Pedido | null>(null)
  const [modalEditarAberto, setModalEditarAberto] = useState(false)
  const [modalWhatsAppAberto, setModalWhatsAppAberto] = useState(false)
  const [pedidoWhatsApp, setPedidoWhatsApp] = useState<Pedido | null>(null)
  const [modalDetalhesAberto, setModalDetalhesAberto] = useState(false)
  const [pedidoDetalhesId, setPedidoDetalhesId] = useState<string | null>(null)
  const [novosPedidosIds, setNovosPedidosIds] = useState<Set<string>>(new Set())
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
    onConfirmar: () => {}
  })

  const ehMesAtual = mesSelecionado === mesAtualSP.mes && anoSelecionado === mesAtualSP.ano

  useEffect(() => {
    try {
      const salvo = window.localStorage.getItem('dashboard:valoresOcultos')
      if (salvo === '1') setValoresOcultos(true)
    } catch {}
  }, [])

  const alternarValores = () => {
    setValoresOcultos((prev) => {
      const novo = !prev
      try {
        window.localStorage.setItem('dashboard:valoresOcultos', novo ? '1' : '0')
      } catch {}
      return novo
    })
  }

  const formatarValor = (valor: string) => (valoresOcultos ? '••••••' : valor)

  const navegarMes = (direcao: -1 | 1) => {
    let novoMes = mesSelecionado + direcao
    let novoAno = anoSelecionado
    if (novoMes < 1) { novoMes = 12; novoAno-- }
    if (novoMes > 12) { novoMes = 1; novoAno++ }
    // Não permitir navegar para o futuro
    const atual = obterMesAtualSP()
    if (novoAno > atual.ano || (novoAno === atual.ano && novoMes > atual.mes)) return
    setMesSelecionado(novoMes)
    setAnoSelecionado(novoAno)
  }

  const enriquecerPedidos = useCallback(async (lista: Array<Record<string, unknown>>): Promise<Pedido[]> => {
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
      console.error('[Dashboard] Erro ao carregar pagamentos parciais:', erro)
      return new Map<string, import("@/lib/pagamentoParcial").PagamentoParcialAgregado>()
    })

    return lista.map((pedido) => {
      const id = String(pedido.id)
      const crediario = crediarioPorPedido.get(id)
      const pagamentoParcial = pagamentoParcialPorPedido.get(id)
      const garcomId = pedido.garcom_id ? String(pedido.garcom_id) : null
      return {
        ...(pedido as unknown as Pedido),
        itens: itensPorPedido.get(id) || [],
        nome_garcom: garcomId ? garconsPorId.get(garcomId) || null : null,
        crediario_status: crediario?.status ?? null,
        crediario_saldo: crediario?.saldo_atual ?? null,
        valor_pago_parcial: pagamentoParcial?.valor_pago_parcial ?? 0,
        valor_em_crediario: pagamentoParcial?.valor_em_crediario ?? 0,
        itens_pagos_count: pagamentoParcial ? Object.keys(pagamentoParcial.quantidade_paga_por_item).length : 0,
      }
    })
  }, [])

  const carregarEstatisticas = useCallback(async (mes: number, ano: number) => {
    const { inicio: inicioMes, fim: fimMes } = obterPeriodoMes(ano, mes)
    const agora = new Date()
    const { inicio: inicioPeriodoHoje } = obterIntervaloDiaOperacionalAtual(agora)

    const [{ data: statsMes, error: erroMes }, { data: statsHoje, error: erroHoje }] = await Promise.all([
      supabase.rpc('estatisticas_pedidos_periodo', {
        p_inicio: inicioMes,
        p_fim: fimMes,
      }),
      supabase.rpc('estatisticas_pedidos_periodo', {
        p_inicio: inicioPeriodoHoje.toISOString(),
        p_fim: agora.toISOString(),
      }),
    ])

    if (erroMes) throw erroMes
    if (erroHoje) throw erroHoje

    const linhaMes = Array.isArray(statsMes) ? statsMes[0] : statsMes
    const linhaHoje = Array.isArray(statsHoje) ? statsHoje[0] : statsHoje

    setEstatisticas({
      totalPedidos: Number(linhaMes?.total_pedidos || 0),
      pedidosHoje: Number(linhaHoje?.total_pedidos || 0),
      receitaTotal: Number(linhaMes?.receita || 0),
      receitaHoje: Number(linhaHoje?.receita || 0),
    })
  }, [])

  const carregarListaRecente = useCallback(async () => {
    const { inicio, fim } = obterIntervaloDiaOperacionalAtual()
    const { data: pedidosRecentes, error } = await supabase
      .from('pedidos')
      .select(COLUNAS_PEDIDO_DASHBOARD)
      .gte('created_at', inicio.toISOString())
      .lt('created_at', fim.toISOString())
      .neq('status', 'cancelado')
      .neq('status', 'aguardando_pagamento')
      .order('created_at', { ascending: false })
      .limit(12)

    if (error) throw error
    const pedidosComItens = await enriquecerPedidos((pedidosRecentes || []) as Array<Record<string, unknown>>)
    setPedidos(pedidosComItens)
  }, [enriquecerPedidos])

  const carregarDados = useCallback(async (mes: number, ano: number) => {
    try {
      await Promise.all([
        carregarEstatisticas(mes, ano),
        carregarListaRecente(),
      ])
    } catch (error) {
      console.error('Erro ao carregar dados:', error)
    } finally {
      setLoading(false)
    }
  }, [carregarEstatisticas, carregarListaRecente])

  useEffect(() => {
    let isMounted = true

    setLoading(true)
    if (isMounted) {
      carregarDados(mesSelecionado, anoSelecionado)
    }

    const pollingInterval = ehMesAtual ? setInterval(() => {
      if (isMounted) {
        void carregarEstatisticas(mesSelecionado, anoSelecionado)
      }
    }, 120000) : null

    let debounceLista: ReturnType<typeof setTimeout> | null = null
    let debounceStats: ReturnType<typeof setTimeout> | null = null

    const agendarRecargaLista = () => {
      if (debounceLista) clearTimeout(debounceLista)
      debounceLista = setTimeout(() => {
        debounceLista = null
        void carregarListaRecente()
      }, 800)
    }

    const agendarRecargaStats = () => {
      if (debounceStats) clearTimeout(debounceStats)
      debounceStats = setTimeout(() => {
        debounceStats = null
        void carregarEstatisticas(mesSelecionado, anoSelecionado)
      }, 1500)
    }

    const channel = ehMesAtual ? supabase
      .channel(`dashboard-pedidos-${Date.now()}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'pedidos' },
        async (payload) => {
          const novoPedido = payload.new as any

          const [itensPorId, crediarioPorId, garconsPorId] = await Promise.all([
            carregarItensPorPedido([novoPedido.id]),
            carregarCrediarioPorPedido([novoPedido.id]),
            novoPedido.garcom_id
              ? carregarGarconsPorIds([novoPedido.garcom_id])
              : Promise.resolve(new Map<string, string>()),
          ])
          const crediario = crediarioPorId.get(String(novoPedido.id))
          const enriquecido: Pedido = {
            ...novoPedido,
            itens: itensPorId.get(String(novoPedido.id)) || [],
            nome_garcom: novoPedido.garcom_id ? garconsPorId.get(novoPedido.garcom_id) || null : null,
            crediario_status: crediario?.status ?? null,
            crediario_saldo: crediario?.saldo_atual ?? null,
          }

          setPedidos(prev => {
            if (prev.some(p => p.id === enriquecido.id)) return prev
            return [enriquecido, ...prev.slice(0, 11)]
          })

          setNovosPedidosIds(prev => new Set(prev).add(novoPedido.id))
          setTimeout(() => {
            setNovosPedidosIds(prev => {
              const newSet = new Set(prev)
              newSet.delete(novoPedido.id)
              return newSet
            })
          }, 5000)

          setEstatisticas(prev => ({
            ...prev,
            totalPedidos: prev.totalPedidos + 1,
            pedidosHoje: prev.pedidosHoje + 1,
            receitaTotal: prev.receitaTotal + Number(novoPedido.total || 0),
            receitaHoje: prev.receitaHoje + Number(novoPedido.total || 0),
          }))
        }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'pedidos' },
        async (payload) => {
          const novo = payload.new as any
          const crediarioPorId = await carregarCrediarioPorPedido([novo.id])
          const crediario = crediarioPorId.get(String(novo.id))
          setPedidos(prev => prev.map(p =>
            p.id === novo.id
              ? {
                  ...p,
                  ...novo,
                  crediario_status: crediario?.status ?? p.crediario_status ?? null,
                  crediario_saldo: crediario?.saldo_atual ?? p.crediario_saldo ?? null,
                }
              : p,
          ))
          agendarRecargaStats()
        }
      )
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'pedidos' },
        (payload) => {
          setPedidos(prev => prev.filter(p => p.id !== payload.old.id))
          agendarRecargaStats()
        }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'pagamentos_pedido' },
        () => agendarRecargaLista()
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'crediario_movimentos' },
        () => agendarRecargaLista()
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'itens_pedido' },
        () => agendarRecargaLista()
      )
      .subscribe() : null

    return () => {
      isMounted = false
      if (debounceLista) clearTimeout(debounceLista)
      if (debounceStats) clearTimeout(debounceStats)
      if (pollingInterval) clearInterval(pollingInterval)
      if (channel) supabase.removeChannel(channel)
    }
  }, [mesSelecionado, anoSelecionado, ehMesAtual, carregarDados, carregarEstatisticas, carregarListaRecente])

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

      const pedidoCompleto = {
        ...pedido,
        itens: itens.map((item) => ({
          nome_item: item.nome_item || 'Produto',
          quantidade: item.quantidade,
          preco_unitario: item.preco_unitario,
          subtotal: item.subtotal,
          adicionais: item.adicionais,
          observacoes: item.observacoes,
        })),
      }

      gerarPDFPedido(pedidoCompleto)
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
          // Liberar mesa associada ao pedido (se houver)
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

          // O trigger do banco remove automaticamente:
          // - Movimentações do caixa
          // - Entregas
          // - Pagamentos
          // - Itens do pedido
          // - Adicionais dos itens
          // - Fila de impressão
          const { error } = await supabase
            .from('pedidos')
            .delete()
            .eq('id', pedidoId)

          if (error) throw error

          carregarDados(mesSelecionado, anoSelecionado)
          setModalNotificacao({
            aberto: true,
            tipo: 'sucesso',
            titulo: 'Pedido Excluído',
            mensagem: 'O pedido foi excluído com sucesso.',
            onConfirmar: () => {}
          })
        } catch (error) {
          console.error('Erro ao excluir pedido:', error)
          setModalNotificacao({
            aberto: true,
            tipo: 'erro',
            titulo: 'Erro ao Excluir',
            mensagem: 'Não foi possível excluir o pedido. Tente novamente.',
            onConfirmar: () => {}
          })
        }
      }
    })
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <AdminLayout>
          <div className="space-y-5">
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
            <TabelaSkeleton linhas={5} />
          </div>
        </AdminLayout>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="space-y-5">
          <div className="flex w-full min-w-0 flex-col gap-4 overflow-hidden rounded-xl border border-border/70 bg-card p-4 shadow-sm md:flex-row md:items-end md:justify-between md:p-5">
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight text-foreground md:text-2xl">
                Dashboard
              </h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Operação do dia e resumo do mês
              </p>
              <div className="mt-4 flex flex-wrap items-end gap-4 md:gap-6">
                <div className="min-w-[72px]">
                  <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                    Pedidos hoje
                  </p>
                  <p className="mt-0.5 text-xl font-semibold tabular-nums text-foreground">
                    {estatisticas.pedidosHoje}
                  </p>
                </div>
                <div className="min-w-[100px]">
                  <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                    Receita hoje
                  </p>
                  <p className="mt-0.5 text-xl font-semibold tabular-nums text-foreground">
                    {formatarValor(`R$ ${formatarMoeda(estatisticas.receitaHoje)}`)}
                  </p>
                </div>
                <div className="min-w-[72px]">
                  <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                    Pedidos mês
                  </p>
                  <p className="mt-0.5 text-xl font-semibold tabular-nums text-foreground">
                    {estatisticas.totalPedidos}
                  </p>
                </div>
                <div className="min-w-[100px]">
                  <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                    Receita mês
                  </p>
                  <p className="mt-0.5 text-xl font-semibold tabular-nums text-foreground">
                    {formatarValor(`R$ ${formatarMoeda(estatisticas.receitaTotal)}`)}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-11 shadow-none sm:size-9"
                onClick={alternarValores}
                aria-label={valoresOcultos ? 'Mostrar valores' : 'Ocultar valores'}
                aria-pressed={valoresOcultos}
              >
                {valoresOcultos ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </Button>

              <div className="inline-flex h-11 items-stretch overflow-hidden rounded-md border border-border/70 bg-background sm:h-9">
                <button
                  type="button"
                  onClick={() => navegarMes(-1)}
                  className="inline-flex items-center justify-center px-2.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Mês anterior"
                >
                  <ChevronLeft className="size-4" strokeWidth={1.8} />
                </button>
                <div className="flex min-w-[140px] items-center justify-center gap-2 border-x border-border/70 px-3">
                  <Calendar className="size-3.5 text-muted-foreground" strokeWidth={1.6} />
                  <span className="text-sm font-medium text-foreground">
                    {NOMES_MESES[mesSelecionado]} {anoSelecionado}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => navegarMes(1)}
                  disabled={ehMesAtual}
                  className={cn(
                    'inline-flex items-center justify-center px-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    ehMesAtual
                      ? 'cursor-not-allowed text-muted-foreground opacity-30'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                  )}
                  aria-label="Próximo mês"
                >
                  <ChevronRight className="size-4" strokeWidth={1.8} />
                </button>
              </div>

              {!ehMesAtual && (
                <Button
                  type="button"
                  size="sm"
                  className="h-11 sm:h-9"
                  onClick={() => {
                    setMesSelecionado(mesAtualSP.mes)
                    setAnoSelecionado(mesAtualSP.ano)
                  }}
                >
                  Mês atual
                </Button>
              )}
            </div>
          </div>

          <ControleStatusLoja />

          <GerenciadorImpressao />

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold tracking-tight text-foreground">
                  Pedidos do dia
                </h2>
                <p className="text-sm text-muted-foreground">
                  Acompanhe status, pagamento e ações rápidas
                </p>
              </div>
              <Link
                href="/admin/pedidos"
                className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Ver todos
                <ArrowRight className="size-3.5" />
              </Link>
            </div>

            {pedidos.length === 0 ? (
              <ListaVazia
                icone={<ShoppingCart className="size-5" strokeWidth={1.5} />}
                titulo="Nenhum pedido encontrado"
                descricao="Quando houver pedidos no período, eles aparecem aqui."
              />
            ) : (
              <div className="grid items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {pedidos.map((pedido, index) => (
                  <CardPedido
                    key={pedido.id}
                    pedido={pedido}
                    index={index}
                    isNovo={novosPedidosIds.has(pedido.id)}
                    valoresOcultos={valoresOcultos}
                    onVerDetalhes={(p) => {
                      setPedidoDetalhesId(p.id)
                      setModalDetalhesAberto(true)
                    }}
                    onEditar={(p) => {
                      setPedidoSelecionado(p)
                      setModalEditarAberto(true)
                    }}
                    onWhatsApp={(p) => {
                      setPedidoWhatsApp(p)
                      setModalWhatsAppAberto(true)
                    }}
                    onGerarPDF={(p) => void handleGerarPDF(p.id)}
                    onExcluir={(p) => handleExcluirPedido(p.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <ModalEditarPedido
          pedido={pedidoSelecionado}
          aberto={modalEditarAberto}
          onFechar={() => {
            setModalEditarAberto(false)
            setPedidoSelecionado(null)
          }}
          onSucesso={() => {
            carregarDados(mesSelecionado, anoSelecionado)
          }}
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
          onGerarPDF={(pedido) => {
            void handleGerarPDF(pedido.id)
          }}
        />

        <ModalWhatsApp
          pedido={pedidoWhatsApp}
          aberto={modalWhatsAppAberto}
          onFechar={() => {
            setModalWhatsAppAberto(false)
            setPedidoWhatsApp(null)
          }}
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
