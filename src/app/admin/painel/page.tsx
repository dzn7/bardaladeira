'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { RefreshCw, Search, X } from 'lucide-react'
import { toast } from 'sonner'
import ProtectedRoute from '@/components/admin/ProtectedRoute'
import AdminLayout from '@/components/admin/AdminLayout'
import ModalDetalhesPedido from '@/components/admin/ModalDetalhesPedido'
import ModalEditarPedido from '@/components/admin/ModalEditarPedido'
import { ColunaKanban } from '@/components/admin/painel/ColunaKanban'
import { PEDIDO_DEMO_ID, useDemoPainel } from '@/features/onboarding'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import {
  carregarCoresColunas,
  CORES_PADRAO_COLUNAS,
  hexParaRgba,
  salvarCoresColunas,
  type CoresColunasPainel,
} from '@/lib/cores-painel'
import {
  enfileirarImpressao,
  gerarHashEventoImpressao,
} from '@/lib/filaImpressao'
import { atribuirNumeroPedidoDiario, normalizarNumeroPedido, obterNumeroPedidoExibicao } from '@/lib/pedidos/numero-diario'
import type { ItemSnapshotImpressao, PedidoSnapshotImpressao } from '@/lib/filaImpressao'
import { carregarPagamentosParciaisPorPedido } from '@/lib/pagamentoParcial'

type ItemPedido = {
  id: string
  nome_item?: string
  quantidade: number
  preco_unitario: number
  subtotal: number
  created_at?: string
  observacoes?: string
}

type Pedido = {
  id: string
  numero_pedido?: number | null
  numero_pedido_diario?: number | null
  nome_cliente: string
  telefone?: string
  endereco?: string
  bairro?: string
  referencia?: string
  tipo_entrega: string
  status: string
  subtotal: number
  taxa_entrega: number
  taxa_servico?: number
  total: number
  created_at: string
  forma_pagamento?: string
  pagamento_online?: boolean
  pagamento_online_status?: string
  crediario_status?: string | null
  crediario_saldo?: number | null
  troco_para?: number | null
  observacoes?: string
  mesa?: number | null
  mesa_id?: string | null
  mesa_identificador?: string | null
  mesa_tipo?: string | null
  comanda?: number | null
  itens?: ItemPedido[]
  valor_pago_parcial?: number
  itens_pagos_count?: number
}

type StatusPedido = 'pendente' | 'confirmado' | 'preparando' | 'pronto' | 'saiu_para_entrega' | 'entregue' | 'cancelado'

type ChaveColuna = 'novos' | 'emPreparo' | 'prontos'
type AcaoKanban = 'pagamento' | 'impressao' | 'status'
type AcoesPedidoKanban = Partial<Record<AcaoKanban, boolean>>

const COLUNAS_KANBAN = {
  novos: {
    titulo: 'Em análise',
    tituloCurto: 'Análise',
    status: ['pendente'],
    statusDestino: 'pendente' as StatusPedido,
    marcador: 'bg-yellow-500/80 dark:bg-yellow-300/85',
    corBadge: 'bg-yellow-500/15 text-yellow-800 dark:bg-yellow-400/20 dark:text-yellow-100',
    mensagemVazia: 'Nenhum pedido em análise',
    descricaoVazia: 'Novos pedidos aparecem aqui para triagem.',
  },
  emPreparo: {
    titulo: 'Em produção',
    tituloCurto: 'Produção',
    status: ['confirmado', 'preparando'],
    statusDestino: 'preparando' as StatusPedido,
    marcador: 'bg-sky-600/80 dark:bg-sky-300/85',
    corBadge: 'bg-sky-500/15 text-sky-800 dark:bg-sky-400/20 dark:text-sky-100',
    mensagemVazia: 'Sem pedidos em produção',
    descricaoVazia: 'Pedidos em preparo se concentram nesta etapa.',
  },
  prontos: {
    titulo: 'Prontos para entrega',
    tituloCurto: 'Prontos',
    status: ['pronto', 'saiu_para_entrega'],
    statusDestino: 'pronto' as StatusPedido,
    marcador: 'bg-emerald-600/85 dark:bg-emerald-300/85',
    corBadge: 'bg-emerald-500/15 text-emerald-800 dark:bg-emerald-400/20 dark:text-emerald-100',
    mensagemVazia: 'Sem pedidos prontos',
    descricaoVazia: 'Pedidos finalizados ficam listados aqui.',
  },
}

const CHAVES_COLUNA: ChaveColuna[] = ['novos', 'emPreparo', 'prontos']

function PainelKanbanPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [carregando, setCarregando] = useState(true)
  const [termoBusca, setTermoBusca] = useState('')
  const [pedidoSelecionadoId, setPedidoSelecionadoId] = useState<string | null>(null)
  const [modalAberto, setModalAberto] = useState(false)
  const [pedidoParaEditar, setPedidoParaEditar] = useState<Pedido | null>(null)
  const [modalEditarAberto, setModalEditarAberto] = useState(false)
  const [pedidoParaApagar, setPedidoParaApagar] = useState<Pedido | null>(null)
  const [acoesPedido, setAcoesPedido] = useState<Record<string, AcoesPedidoKanban>>({})
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const pedidosRef = useRef<Pedido[]>([])
  const ultimaCargaRef = useRef(0)
  const debounceRecargaRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Drag & drop
  const [pedidoArrastando, setPedidoArrastando] = useState<string | null>(null)
  const [colunaHover, setColunaHover] = useState<ChaveColuna | null>(null)
  const [colunaAtivaMobile, setColunaAtivaMobile] = useState<ChaveColuna>('novos')
  const [coresColunas, setCoresColunas] = useState<CoresColunasPainel>(CORES_PADRAO_COLUNAS)
  const boardScrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    pedidosRef.current = pedidos
  }, [pedidos])

  const carregarPedidos = useCallback(async (options?: { silencioso?: boolean; incluirNumeracao?: boolean }) => {
    const silencioso = options?.silencioso ?? false
    const incluirNumeracao = options?.incluirNumeracao ?? !silencioso

    try {
      if (!silencioso) {
        setCarregando(true)
      }

      const ontem = new Date()
      ontem.setHours(ontem.getHours() - 24)
      const inicioNumeracao = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()

      const consultaPedidos = supabase
        .from('pedidos')
        .select(
          `
            id,
            numero_pedido,
            nome_cliente,
            telefone,
            endereco,
            bairro,
            referencia,
            tipo_entrega,
            status,
            subtotal,
            taxa_entrega,
            taxa_servico,
            total,
            created_at,
            forma_pagamento,
            pagamento_online,
            pagamento_online_status,
            troco_para,
            observacoes,
            mesa,
            comanda,
            mesa_id,
            mesa_dados:mesas!pedidos_mesa_id_fkey(identificador, tipo)
          `
        )
        .gte('created_at', ontem.toISOString())
        .neq('status', 'cancelado')
        .neq('status', 'entregue')
        .neq('status', 'aguardando_pagamento')
        .order('created_at', { ascending: false })

      const [{ data, error }, resultadoNumeracao] = await Promise.all([
        consultaPedidos,
        incluirNumeracao
          ? supabase
              .from('pedidos')
              .select('id, created_at, numero_pedido')
              .gte('created_at', inicioNumeracao)
              .order('created_at', { ascending: true })
              .order('id', { ascending: true })
          : Promise.resolve({ data: null, error: null }),
      ])

      if (error) throw error
      if (resultadoNumeracao.error) throw resultadoNumeracao.error

      const numerosAnteriores = new Map(
        pedidosRef.current.map((pedido) => [pedido.id, pedido.numero_pedido_diario ?? null]),
      )

      const mapaNumeroDiario = incluirNumeracao
        ? new Map(
            atribuirNumeroPedidoDiario(
              ((resultadoNumeracao.data || []) as Array<Pick<Pedido, 'id' | 'created_at' | 'numero_pedido'>>).map(
                (pedido) => ({
                  ...pedido,
                  numero_pedido: normalizarNumeroPedido(pedido.numero_pedido),
                }),
              ),
            ).map((pedido) => [pedido.id, pedido.numero_pedido_diario ?? null]),
          )
        : numerosAnteriores

      const registrosPedidos = data || []
      const idsPedidos = registrosPedidos.map((pedido) => String(pedido.id))
      const itensPorPedido = new Map<string, ItemPedido[]>()
      const crediarioPorPedido = new Map<string, { status: string | null; saldo_atual: number | null }>()

      if (idsPedidos.length > 0) {
        const [
          { data: itensPedidos, error: erroItens },
          { data: movimentosCrediario, error: erroCrediario },
        ] = await Promise.all([
          supabase
            .from('itens_pedido')
            .select('id, pedido_id, nome_item, quantidade, preco_unitario, subtotal, created_at, observacoes')
            .in('pedido_id', idsPedidos)
            .order('created_at'),
          supabase
            .from('crediario_movimentos')
            .select('pedido_id, conta_id, itens')
            .in('pedido_id', idsPedidos)
            .eq('origem', 'pedido')
            .eq('tipo', 'consumo')
            .eq('status', 'ativo'),
        ])

        if (erroItens) {
          console.error('[PainelKanban] Erro ao carregar itens dos pedidos:', erroItens)
        } else {
          ;(itensPedidos || []).forEach((item) => {
            const pedidoId = String(item.pedido_id || '')
            if (!pedidoId) return

            const itensAtuais = itensPorPedido.get(pedidoId) || []
            itensAtuais.push({
              id: String(item.id),
              nome_item: item.nome_item || undefined,
              quantidade: Number(item.quantidade || 0),
              preco_unitario: Number(item.preco_unitario || 0),
              subtotal: Number(item.subtotal || 0),
              created_at: item.created_at || undefined,
              observacoes: item.observacoes || undefined,
            })
            itensPorPedido.set(pedidoId, itensAtuais)
          })
        }

        if (erroCrediario) {
          console.error('[PainelKanban] Erro ao carregar crediario dos pedidos:', erroCrediario)
        } else {
          const contaIds = Array.from(
            new Set((movimentosCrediario || []).map((movimento) => String(movimento.conta_id || '')).filter(Boolean)),
          )

          if (contaIds.length > 0) {
            const { data: contasCrediario, error: erroContasCrediario } = await supabase
              .from('crediario_contas')
              .select('id, status, saldo_atual')
              .in('id', contaIds)

            if (erroContasCrediario) {
              console.error('[PainelKanban] Erro ao carregar contas do crediario:', erroContasCrediario)
            } else {
              const contasPorId = new Map(
                (contasCrediario || []).map((conta) => [
                  String(conta.id),
                  {
                    status: conta.status ? String(conta.status) : null,
                    saldo_atual: conta.saldo_atual === null || conta.saldo_atual === undefined ? null : Number(conta.saldo_atual),
                  },
                ]),
              )

              ;(movimentosCrediario || []).forEach((movimento) => {
                const pedidoId = String(movimento.pedido_id || '')
                const contaId = String(movimento.conta_id || '')
                const conta = contasPorId.get(contaId)
                if (pedidoId && conta) {
                  crediarioPorPedido.set(pedidoId, conta)
                }
              })
            }
          }
        }

      }

      const pagamentoParcialPorPedido = await carregarPagamentosParciaisPorPedido(
        idsPedidos,
        itensPorPedido,
      ).catch((erro) => {
        console.error('[PainelKanban] Erro ao carregar pagamentos parciais:', erro)
        return new Map<string, import("@/lib/pagamentoParcial").PagamentoParcialAgregado>()
      })

      const pedidosComItens = registrosPedidos.map((pedido) => {
        const pedidoId = String(pedido.id)
        const crediario = crediarioPorPedido.get(pedidoId)
        const mesaDados = (pedido as { mesa_dados?: { identificador?: string | null; tipo?: string | null } | null }).mesa_dados
        const pagamentoParcial = pagamentoParcialPorPedido.get(pedidoId)

        return {
          ...pedido,
          numero_pedido: normalizarNumeroPedido(pedido.numero_pedido),
          numero_pedido_diario: mapaNumeroDiario.get(pedido.id) ?? null,
          mesa_identificador: mesaDados?.identificador ?? null,
          mesa_tipo: mesaDados?.tipo ?? null,
          crediario_status: crediario?.status ?? null,
          crediario_saldo: crediario?.saldo_atual ?? null,
          itens: itensPorPedido.get(pedidoId) || [],
          valor_pago_parcial: pagamentoParcial?.valor_pago_parcial ?? 0,
          valor_em_crediario: pagamentoParcial?.valor_em_crediario ?? 0,
          itens_pagos_count: pagamentoParcial ? Object.keys(pagamentoParcial.quantidade_paga_por_item).length : 0,
        }
      })

      setPedidos(pedidosComItens)
      ultimaCargaRef.current = Date.now()
    } catch (erro) {
      console.error('[PainelKanban] Erro ao carregar pedidos:', erro)
      toast.error('Erro ao carregar pedidos')
    } finally {
      if (!silencioso) {
        setCarregando(false)
      }
    }
  }, [])

  const agendarRecargaPainel = useCallback((options?: { incluirNumeracao?: boolean }) => {
    if (debounceRecargaRef.current) clearTimeout(debounceRecargaRef.current)
    debounceRecargaRef.current = setTimeout(() => {
      debounceRecargaRef.current = null
      void carregarPedidos({
        silencioso: true,
        incluirNumeracao: options?.incluirNumeracao ?? false,
      })
    }, 800)
  }, [carregarPedidos])

  const atualizarStatus = useCallback(async (pedidoId: string, novoStatus: StatusPedido) => {
    setAcoesPedido((atual) => ({
      ...atual,
      [pedidoId]: { ...atual[pedidoId], status: true },
    }))

    try {
      const { error } = await supabase
        .from('pedidos')
        .update({
          status: novoStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', pedidoId)

      if (error) throw error

      setPedidos((prev) => prev.map((p) => (p.id === pedidoId ? { ...p, status: novoStatus } : p)))

      toast.success('Status atualizado com sucesso')
    } catch (erro) {
      console.error('[PainelKanban] Erro ao atualizar status:', erro)
      toast.error('Erro ao atualizar status')
    } finally {
      setAcoesPedido((atual) => ({
        ...atual,
        [pedidoId]: { ...atual[pedidoId], status: false },
      }))
    }
  }, [])

  const avancarStatus = useCallback(
    (pedido: Pedido) => {
      const tipoEntrega = pedido.tipo_entrega || ''
      const ehDelivery = tipoEntrega.toLowerCase().includes('entrega') || tipoEntrega.toLowerCase() === 'delivery'

      let proximoStatus: StatusPedido | null = null

      switch (pedido.status) {
        case 'pendente':
        case 'confirmado':
          proximoStatus = 'preparando'
          break
        case 'preparando':
          proximoStatus = ehDelivery ? 'saiu_para_entrega' : 'pronto'
          break
        case 'pronto':
        case 'saiu_para_entrega':
          proximoStatus = 'entregue'
          break
      }

      if (proximoStatus) {
        atualizarStatus(pedido.id, proximoStatus)
      }
    },
    [atualizarStatus]
  )

  // Drag & Drop handlers
  const handleDragStart = useCallback((pedidoId: string) => {
    setPedidoArrastando(pedidoId)
  }, [])

  const handleDragEnd = useCallback(() => {
    if (pedidoArrastando && colunaHover) {
      const pedido = pedidos.find(p => p.id === pedidoArrastando)
      const configColuna = COLUNAS_KANBAN[colunaHover]

      if (pedido && !configColuna.status.includes(pedido.status)) {
        atualizarStatus(pedido.id, configColuna.statusDestino)
      }
    }
    setPedidoArrastando(null)
    setColunaHover(null)
  }, [pedidoArrastando, colunaHover, pedidos, atualizarStatus])

  const handleDragOverColuna = useCallback((chaveColuna: ChaveColuna) => {
    setColunaHover(chaveColuna)
  }, [])

  const handleDragLeaveColuna = useCallback(() => {
    setColunaHover(null)
  }, [])

  const moverParaColuna = useCallback(
    (pedido: Pedido, destino: ChaveColuna) => {
      const configColuna = COLUNAS_KANBAN[destino]
      if (configColuna.status.includes(pedido.status)) return
      void atualizarStatus(pedido.id, configColuna.statusDestino)
    },
    [atualizarStatus],
  )

  const irParaColuna = useCallback((chave: ChaveColuna) => {
    setColunaAtivaMobile(chave)
    const el = document.getElementById(`coluna-kanban-${chave}`)
    el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [])

  useEffect(() => {
    let ativo = true
    void carregarCoresColunas().then((cores) => {
      if (ativo) setCoresColunas(cores)
    })
    return () => {
      ativo = false
    }
  }, [])

  /** Aplica na hora e persiste; se o banco recusar, desfaz e avisa. */
  const trocarCorColuna = useCallback(
    (chave: ChaveColuna, cor: string) => {
      setCoresColunas((anterior) => {
        if (anterior[chave] === cor) return anterior
        const proximas = { ...anterior, [chave]: cor }
        void salvarCoresColunas(proximas).then((resultado) => {
          if (!resultado.sucesso) {
            setCoresColunas(anterior)
            toast.error(resultado.erro || 'Não foi possível salvar a cor')
          }
        })
        return proximas
      })
    },
    [],
  )

  useEffect(() => {
    const board = boardScrollRef.current
    if (!board) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visivel = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        const chave = visivel?.target.getAttribute('data-coluna-kanban') as ChaveColuna | null
        if (chave) setColunaAtivaMobile(chave)
      },
      { root: board, threshold: [0.45, 0.65, 0.85] },
    )

    CHAVES_COLUNA.forEach((chave) => {
      const el = document.getElementById(`coluna-kanban-${chave}`)
      if (el) observer.observe(el)
    })

    return () => observer.disconnect()
  }, [carregando, pedidos.length])

  useEffect(() => {
    void carregarPedidos()

    channelRef.current = supabase
      .channel(`painel-kanban-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const novoPedido = payload.new as Pedido
          if (
            novoPedido.status !== 'cancelado' &&
            novoPedido.status !== 'entregue' &&
            novoPedido.status !== 'aguardando_pagamento'
          ) {
            toast.success(`Novo pedido de ${novoPedido.nome_cliente}`)
            agendarRecargaPainel({ incluirNumeracao: true })
          }
          return
        }

        if (payload.eventType === 'UPDATE' || payload.eventType === 'DELETE') {
          agendarRecargaPainel()
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crediario_movimentos' }, () => {
        agendarRecargaPainel()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'crediario_contas' }, () => {
        agendarRecargaPainel()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pagamentos_pedido' }, () => {
        agendarRecargaPainel()
      })
      .subscribe()

    const aoGanharFoco = () => {
      if (Date.now() - ultimaCargaRef.current < 30000) return
      void carregarPedidos({ silencioso: true })
    }

    window.addEventListener('focus', aoGanharFoco)

    return () => {
      window.removeEventListener('focus', aoGanharFoco)
      if (debounceRecargaRef.current) clearTimeout(debounceRecargaRef.current)
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }
    }
  }, [agendarRecargaPainel, carregarPedidos])

  const ehPagamentoPendenteConfirmado = useCallback((pedido: Pedido) => {
    return (
      pedido.status === 'pendente' &&
      pedido.pagamento_online === true &&
      pedido.pagamento_online_status === 'pago'
    )
  }, [])

  // Auto-correção: pedidos com pagamento confirmado mas status ainda 'pendente'
  useEffect(() => {
    const pedidosDesatualizados = pedidos.filter(ehPagamentoPendenteConfirmado)
    if (pedidosDesatualizados.length === 0) return

    pedidosDesatualizados.forEach(async (pedido) => {
      try {
        const { error } = await supabase
          .from('pedidos')
          .update({
            status: 'preparando',
            updated_at: new Date().toISOString(),
          })
          .eq('id', pedido.id)
          .eq('status', 'pendente')

        if (!error) {
          setPedidos((prev) =>
            prev.map((p) => (p.id === pedido.id ? { ...p, status: 'preparando' } : p))
          )
        }
      } catch (erro) {
        console.error('[PainelKanban] Erro ao corrigir status de pedido pago:', erro)
      }
    })
  }, [pedidos, ehPagamentoPendenteConfirmado])

  const pedidosFiltrados = useMemo(() => {
    if (!termoBusca.trim()) return pedidos

    const termo = termoBusca.toLowerCase()
    return pedidos.filter((p) => {
      const nome = (p.nome_cliente || '').toLowerCase()
      const telefone = (p.telefone || '').toLowerCase()
      const id = p.id.toLowerCase()
      const numeroPedido = String(obterNumeroPedidoExibicao(p) ?? '')
      return nome.includes(termo) || telefone.includes(termo) || id.includes(termo) || numeroPedido.includes(termo)
    })
  }, [pedidos, termoBusca])

  // Pedido de exemplo do onboarding (client-side): entra na coluna "Em análise"
  // do board REAL para o tour ter o que destacar. Nunca é gravado no banco e
  // todas as ações sobre ele são simuladas (ver `ehPedidoDemo`).
  const { pedido: pedidoDemo } = useDemoPainel()

  const pedidosNovos = useMemo(() => {
    const reais = pedidosFiltrados.filter((p) =>
      COLUNAS_KANBAN.novos.status.includes(p.status) && !ehPagamentoPendenteConfirmado(p)
    )
    if (!pedidoDemo) return reais

    const subtotalDemo = pedidoDemo.itens.reduce(
      (soma, item) => soma + item.quantidade * item.precoUnitario,
      0,
    )
    const exemplo = {
      id: pedidoDemo.id,
      numero_pedido_diario: 0,
      nome_cliente: pedidoDemo.nome_cliente,
      telefone: pedidoDemo.telefone,
      endereco: pedidoDemo.endereco,
      bairro: pedidoDemo.bairro,
      tipo_entrega: 'entrega',
      status: 'pendente',
      subtotal: subtotalDemo,
      taxa_entrega: pedidoDemo.taxa_entrega,
      total: subtotalDemo + pedidoDemo.taxa_entrega,
      created_at: new Date().toISOString(),
      forma_pagamento: pedidoDemo.forma_pagamento,
      itens: pedidoDemo.itens.map((item, indice) => ({
        id: `${pedidoDemo.id}-item-${indice}`,
        nome_item: item.nome,
        quantidade: item.quantidade,
        preco_unitario: item.precoUnitario,
        subtotal: item.quantidade * item.precoUnitario,
      })),
    } as Pedido

    return [exemplo, ...reais]
  }, [pedidosFiltrados, ehPagamentoPendenteConfirmado, pedidoDemo])

  const pedidosEmPreparo = useMemo(
    () => pedidosFiltrados.filter((p) =>
      COLUNAS_KANBAN.emPreparo.status.includes(p.status) || ehPagamentoPendenteConfirmado(p)
    ),
    [pedidosFiltrados, ehPagamentoPendenteConfirmado]
  )

  const pedidosProntos = useMemo(() => pedidosFiltrados.filter((p) => COLUNAS_KANBAN.prontos.status.includes(p.status)), [pedidosFiltrados])

  const totalAtivos = pedidosNovos.length + pedidosEmPreparo.length + pedidosProntos.length

  const abrirDetalhes = (pedido: Pedido) => {
    setPedidoSelecionadoId(pedido.id)
    setModalAberto(true)
  }

  /** Pedido de exemplo do tutorial: nenhuma ação pode chegar ao banco. */
  const ehPedidoDemo = (pedido: Pedido) => pedido.id === PEDIDO_DEMO_ID

  const comGuardaDemo = <Args extends unknown[]>(
    acao: (pedido: Pedido, ...args: Args) => void,
    mensagem: string,
  ) => (pedido: Pedido, ...args: Args) => {
    if (ehPedidoDemo(pedido)) {
      toast.info(mensagem)
      return
    }
    acao(pedido, ...args)
  }

  const fecharModal = () => {
    setModalAberto(false)
    setPedidoSelecionadoId(null)
  }

  const editarPedido = useCallback((pedido: Pedido) => {
    setPedidoParaEditar(pedido)
    setModalEditarAberto(true)
  }, [])

  const fecharModalEditar = useCallback(() => {
    setModalEditarAberto(false)
    setPedidoParaEditar(null)
  }, [])

  const confirmarPagamento = useCallback(async (pedido: Pedido) => {
    setAcoesPedido((atual) => ({
      ...atual,
      [pedido.id]: { ...atual[pedido.id], pagamento: true },
    }))

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
        prev.map((p) =>
          p.id === pedido.id ? { ...p, pagamento_online_status: 'pago' } : p,
        ),
      )

      toast.success('Pagamento confirmado')
    } catch (erro) {
      console.error('[PainelKanban] Erro ao confirmar pagamento:', erro)
      toast.error('Erro ao confirmar pagamento')
    } finally {
      setAcoesPedido((atual) => ({
        ...atual,
        [pedido.id]: { ...atual[pedido.id], pagamento: false },
      }))
    }
  }, [])

  const apagarPedido = useCallback(async (pedido: Pedido) => {
    try {
      // Libera mesa vinculada ao pedido (FK mesas.pedido_id → pedidos.id)
      await supabase
        .from('mesas')
        .update({ status: 'livre', pedido_id: null, nome_cliente: null, ocupada_em: null, liberar_em: null })
        .eq('pedido_id', pedido.id)

      // Apaga itens primeiro (FK)
      await supabase.from('itens_pedido').delete().eq('pedido_id', pedido.id)
      const { error } = await supabase.from('pedidos').delete().eq('id', pedido.id)

      if (error) throw error

      setPedidos((prev) => prev.filter((p) => p.id !== pedido.id))
      toast.success('Pedido apagado com sucesso')
    } catch (erro) {
      console.error('[PainelKanban] Erro ao apagar pedido:', erro)
      toast.error('Erro ao apagar pedido')
    }
  }, [])

  const imprimirCozinha = useCallback(async (pedido: Pedido) => {
    setAcoesPedido((atual) => ({
      ...atual,
      [pedido.id]: { ...atual[pedido.id], impressao: true },
    }))

    try {
      // Busca itens com adicionais para o snapshot
      const { data: itensCompletos } = await supabase
        .from('itens_pedido')
        .select(`
          id, nome_item, quantidade, preco_unitario, subtotal, observacoes,
          item_adicionais (nome, preco, quantidade)
        `)
        .eq('pedido_id', pedido.id)
        .order('created_at')

      const itensSnapshot: ItemSnapshotImpressao[] = (itensCompletos || []).map((item) => ({
        nome_item: item.nome_item || 'Produto',
        quantidade: item.quantidade,
        preco_unitario: item.preco_unitario,
        subtotal: item.subtotal,
        observacoes: item.observacoes,
        item_adicionais: (item.item_adicionais || []).map((a: { nome: string; preco: number; quantidade: number }) => ({
          nome: a.nome,
          preco: a.preco,
          quantidade: a.quantidade,
        })),
      }))

      const pedidoSnapshot: PedidoSnapshotImpressao = {
        id: pedido.id,
        numero_pedido: obterNumeroPedidoExibicao(pedido) ?? pedido.id.slice(0, 8).toUpperCase(),
        nome_cliente: pedido.nome_cliente,
        tipo_entrega: pedido.tipo_entrega,
        telefone: pedido.telefone,
        mesa: pedido.mesa,
        comanda: pedido.comanda,
        endereco: pedido.referencia || pedido.endereco,
        bairro: pedido.bairro,
        observacoes: pedido.observacoes,
        subtotal: pedido.subtotal,
        taxa_entrega: pedido.taxa_entrega,
        taxa_servico: pedido.taxa_servico,
        total: pedido.total,
        forma_pagamento: pedido.forma_pagamento,
        troco_para: pedido.troco_para,
        created_at: pedido.created_at,
      }

      const hashEvento = gerarHashEventoImpressao(
        pedido.id,
        'cozinha',
        'pedido_completo',
        itensSnapshot,
        'painel_kanban'
      )

      const resultado = await enfileirarImpressao({
        pedidoId: pedido.id,
        tipo: 'cozinha',
        escopo: 'pedido_completo',
        itensSnapshot,
        pedidoSnapshot,
        origem: 'painel_kanban',
        hashEvento,
        automatico: false,
      })

      if (resultado.sucesso) {
        toast.success('Enviado para impressora da cozinha')
      } else if (resultado.duplicado) {
        toast.info('Pedido já foi enviado para impressão')
      } else {
        toast.error(resultado.erro || 'Erro ao enviar para impressão')
      }
    } catch (erro) {
      console.error('[PainelKanban] Erro ao enviar para impressão:', erro)
      toast.error('Erro ao enviar para impressão')
    } finally {
      setAcoesPedido((atual) => ({
        ...atual,
        [pedido.id]: { ...atual[pedido.id], impressao: false },
      }))
    }
  }, [])

  const onSucessoEditar = useCallback(() => {
    fecharModalEditar()
    carregarPedidos()
    toast.success('Pedido atualizado com sucesso')
  }, [fecharModalEditar, carregarPedidos])

  // Handlers do board com a guarda do pedido de exemplo aplicada uma única vez.
  const acoesBoard = {
    onAbrirDetalhes: comGuardaDemo(abrirDetalhes, 'Exemplo do tutorial: aqui abririam os detalhes do pedido.'),
    onAvancarStatus: comGuardaDemo(avancarStatus, 'Exemplo do tutorial: o pedido avançaria para a próxima coluna.'),
    onMoverParaColuna: comGuardaDemo(moverParaColuna, 'Exemplo do tutorial: o pedido mudaria de coluna.'),
    onEditar: comGuardaDemo(editarPedido, 'Exemplo do tutorial: aqui você editaria o pedido.'),
    onApagar: comGuardaDemo(setPedidoParaApagar, 'Exemplo do tutorial: aqui você excluiria o pedido.'),
    onImprimirCozinha: comGuardaDemo(imprimirCozinha, 'Exemplo do tutorial: a via da cozinha seria impressa.'),
    onConfirmarPagamento: comGuardaDemo(confirmarPagamento, 'Exemplo do tutorial: o pagamento seria confirmado.'),
  }

  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="flex h-[calc(100dvh-5.5rem)] min-h-0 flex-col md:h-[calc(100dvh-6.5rem)]">
          {/* Header */}
          <section className="mb-4 flex shrink-0 flex-col items-start justify-between gap-3 border-b border-border/70 pb-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3" data-onboarding="painel-resumo">
              <h1 className="text-lg font-semibold tracking-tight text-foreground">Painel</h1>
              <div className="flex items-center gap-1.5">
                {[
                  { cor: coresColunas.novos, count: pedidosNovos.length },
                  { cor: coresColunas.emPreparo, count: pedidosEmPreparo.length },
                  { cor: coresColunas.prontos, count: pedidosProntos.length },
                ].map((c, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                    style={{ backgroundColor: hexParaRgba(c.cor, 0.12) }}
                  >
                    <span
                      className="size-1.5 rounded-full"
                      style={{ backgroundColor: c.cor }}
                    />
                    {c.count}
                  </span>
                ))}
                <span className="ml-1 text-xs text-muted-foreground">
                  {totalAtivos} ativo{totalAtivos !== 1 ? 's' : ''}
                </span>
              </div>
            </div>

            <div className="flex w-full items-center gap-2 sm:w-auto">
              <div className="relative w-full sm:w-56" data-onboarding="painel-busca">
                <Search
                  strokeWidth={1.6}
                  className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  placeholder="Buscar por nome, telefone ou número"
                  value={termoBusca}
                  onChange={(e) => setTermoBusca(e.target.value)}
                  className="h-9 pl-8 pr-8 text-sm"
                />
                {termoBusca && (
                  <button
                    onClick={() => setTermoBusca('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X strokeWidth={1.6} className="size-4" />
                  </button>
                )}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => carregarPedidos()}
                disabled={carregando}
                className="size-9 p-0"
                aria-label="Atualizar"
              >
                <RefreshCw strokeWidth={1.6} className={cn('size-4', carregando && 'animate-spin')} />
              </Button>
            </div>
          </section>

          {/* Navegação mobile entre colunas (estilo Juridiq: board horizontal) */}
          <div
            className="mb-2 flex shrink-0 gap-1.5 overflow-x-auto pb-1 md:hidden"
            data-onboarding="painel-pills"
          >
            {CHAVES_COLUNA.map((chave) => {
              const config = COLUNAS_KANBAN[chave]
              const count =
                chave === 'novos'
                  ? pedidosNovos.length
                  : chave === 'emPreparo'
                    ? pedidosEmPreparo.length
                    : pedidosProntos.length
              const ativo = colunaAtivaMobile === chave
              const cor = coresColunas[chave]
              return (
                <button
                  key={chave}
                  type="button"
                  onClick={() => irParaColuna(chave)}
                  className={cn(
                    'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors',
                    !ativo && 'border-border/70 bg-card text-muted-foreground hover:bg-muted',
                  )}
                  style={{
                    backgroundColor: ativo ? hexParaRgba(cor, 0.16) : undefined,
                    borderColor: ativo ? hexParaRgba(cor, 0.5) : undefined,
                    color: ativo ? cor : undefined,
                  }}
                  aria-label={`Ir para coluna ${config.titulo}`}
                  aria-pressed={ativo}
                >
                  <span className="size-1.5 rounded-full" style={{ backgroundColor: cor }} />
                  {config.tituloCurto}
                  <span className="tabular-nums text-[11px] opacity-80">{count}</span>
                </button>
              )
            })}
          </div>

          {/* Kanban board — scroll horizontal + snap (Juridiq) */}
          {carregando && pedidos.length === 0 ? (
            <div className="flex flex-1 items-center justify-center">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <RefreshCw strokeWidth={1.6} className="size-4 animate-spin" />
                <span>Carregando pedidos</span>
              </div>
            </div>
          ) : (
            <div
              ref={boardScrollRef}
              data-onboarding="painel-board"
              className="flex min-h-0 w-full flex-1 snap-x snap-mandatory gap-3 overflow-x-auto overflow-y-hidden scroll-smooth pb-1 [scrollbar-width:thin] md:gap-4 md:overflow-x-hidden md:snap-none"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              <ColunaKanban
                chave="novos"
                config={COLUNAS_KANBAN.novos}
                cor={coresColunas.novos}
                onTrocarCor={trocarCorColuna}
                pedidos={pedidosNovos}
                onAbrirDetalhes={acoesBoard.onAbrirDetalhes}
                onAvancarStatus={acoesBoard.onAvancarStatus}
                onMoverParaColuna={acoesBoard.onMoverParaColuna}
                onEditar={acoesBoard.onEditar}
                onApagar={acoesBoard.onApagar}
                onImprimirCozinha={acoesBoard.onImprimirCozinha}
                onConfirmarPagamento={acoesBoard.onConfirmarPagamento}
                acoesPedido={acoesPedido}
                pedidoArrastando={pedidoArrastando}
                colunaHover={colunaHover}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragOverColuna={handleDragOverColuna}
                onDragLeaveColuna={handleDragLeaveColuna}
              />
              <ColunaKanban
                chave="emPreparo"
                config={COLUNAS_KANBAN.emPreparo}
                cor={coresColunas.emPreparo}
                onTrocarCor={trocarCorColuna}
                pedidos={pedidosEmPreparo}
                onAbrirDetalhes={acoesBoard.onAbrirDetalhes}
                onAvancarStatus={acoesBoard.onAvancarStatus}
                onMoverParaColuna={acoesBoard.onMoverParaColuna}
                onEditar={acoesBoard.onEditar}
                onApagar={acoesBoard.onApagar}
                onImprimirCozinha={acoesBoard.onImprimirCozinha}
                onConfirmarPagamento={acoesBoard.onConfirmarPagamento}
                acoesPedido={acoesPedido}
                pedidoArrastando={pedidoArrastando}
                colunaHover={colunaHover}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragOverColuna={handleDragOverColuna}
                onDragLeaveColuna={handleDragLeaveColuna}
              />
              <ColunaKanban
                chave="prontos"
                config={COLUNAS_KANBAN.prontos}
                cor={coresColunas.prontos}
                onTrocarCor={trocarCorColuna}
                pedidos={pedidosProntos}
                onAbrirDetalhes={acoesBoard.onAbrirDetalhes}
                onAvancarStatus={acoesBoard.onAvancarStatus}
                onMoverParaColuna={acoesBoard.onMoverParaColuna}
                onEditar={acoesBoard.onEditar}
                onApagar={acoesBoard.onApagar}
                onImprimirCozinha={acoesBoard.onImprimirCozinha}
                onConfirmarPagamento={acoesBoard.onConfirmarPagamento}
                acoesPedido={acoesPedido}
                pedidoArrastando={pedidoArrastando}
                colunaHover={colunaHover}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragOverColuna={handleDragOverColuna}
                onDragLeaveColuna={handleDragLeaveColuna}
              />
            </div>
          )}

          <ModalDetalhesPedido
            pedidoId={pedidoSelecionadoId}
            aberto={modalAberto}
            onFechar={fecharModal}
            onEditar={(pedido) => {
              fecharModal()
              editarPedido(pedido)
            }}
          />

          <ModalEditarPedido
            pedido={pedidoParaEditar}
            aberto={modalEditarAberto}
            onFechar={fecharModalEditar}
            onSucesso={onSucessoEditar}
          />

          <Dialog open={!!pedidoParaApagar} onOpenChange={(open) => !open && setPedidoParaApagar(null)}>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>Apagar pedido</DialogTitle>
                <DialogDescription>
                  Tem certeza que deseja apagar o pedido de <span className="font-semibold">{pedidoParaApagar?.nome_cliente}</span>? Esta ação não pode ser desfeita.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2 sm:gap-2">
                <button
                  onClick={() => setPedidoParaApagar(null)}
                  className="inline-flex h-9 items-center px-4 rounded-md border border-border/70 bg-card text-sm font-medium text-foreground hover:bg-muted transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => { if (pedidoParaApagar) { apagarPedido(pedidoParaApagar); setPedidoParaApagar(null) } }}
                  className="inline-flex h-9 items-center px-4 rounded-md bg-destructive text-sm font-medium text-white hover:bg-destructive/90 transition-colors"
                >
                  Apagar
                </button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </AdminLayout>
    </ProtectedRoute>
  )
}

export default PainelKanbanPage
