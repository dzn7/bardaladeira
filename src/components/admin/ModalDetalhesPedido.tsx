'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { X, FileText, PencilSimple as Edit2, Package, User, MapPin, CreditCard, Money as Banknote, QrCode, Truck, Storefront as Store, ForkKnife as UtensilsCrossed, Clock, Plus, Minus, ArrowsSplit as Split, Printer, SealPercent as BadgePercent, Wallet, Check, ListChecks, CircleNotch as Loader2, CurrencyCircleDollar as CircleDollarSign, ArrowCounterClockwise as RotateCcw } from '@phosphor-icons/react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { gerarTicketPDF } from '@/lib/pdf-generator'
import { cn } from '@/lib/utils'
import { Botao, Campo, Contador, Gaveta, ListaCarregando, ListaVazia, Segmentos } from '@/components/admin/ui'
import { ModalFormaPagamentoItens } from '@/components/admin/pagamento/ModalFormaPagamentoItens'
import {
  type ItemPagoSnapshot,
  type ItemPagamento,
} from '@/components/admin/pagamento/pagamentoItens'
import {
  enfileirarImpressao,
  gerarHashEventoImpressao,
  type ItemSnapshotImpressao,
  type PedidoSnapshotImpressao,
} from '@/lib/filaImpressao'

type AdicionalItem = {
  id: string
  nome: string
  preco: number
  quantidade?: number
}

type ItemPedido = {
  id: string
  nome_item?: string
  quantidade: number
  preco_unitario: number
  subtotal: number
  created_at?: string
  adicionais?: string
  observacoes?: string
  adicionais_lista?: AdicionalItem[]
  adicionado_por_garcom_id?: string | null
  nome_garcom?: string | null
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
  taxa_pagamento?: number
  taxa_servico?: number
  total: number
  created_at: string
  forma_pagamento?: string
  pagamento_online?: boolean
  pagamento_online_status?: string
  pagamento_online_pago_em?: string | null
  troco_para?: number | null
  observacoes?: string
  mesa?: number | null
  comanda?: number | null
  itens?: ItemPedido[]
  garcom_id?: string | null
}

type ModalDetalhesPedidoProps = {
  pedidoId: string | null
  aberto: boolean
  onFechar: () => void
  onEditar?: (pedido: Pedido) => void
  onGerarPDF?: (pedido: Pedido) => void
  onGerarTicket?: (pedido: Pedido) => void
}

const pedidosCache = new Map<string, { pedido: Pedido; itens: ItemPedido[]; timestamp: number }>()
const CACHE_DURATION = 10000

export default function ModalDetalhesPedido({
  pedidoId,
  aberto,
  onFechar,
  onEditar,
  onGerarPDF,
  onGerarTicket,
}: ModalDetalhesPedidoProps) {
  type PagamentoPedido = {
    id?: string
    forma_pagamento: string
    valor: number
    itens_pagos?: ItemPagoSnapshot[] | null
  }

  type FormaPagamentoOpcao = 'pix' | 'dinheiro' | 'cartao' | 'crediario'

  const [pedido, setPedido] = useState<Pedido | null>(null)
  const [itens, setItens] = useState<ItemPedido[]>([])
  const [pagamentos, setPagamentos] = useState<PagamentoPedido[]>([])
  const [loading, setLoading] = useState(false)
  const [nomeGarcomPedido, setNomeGarcomPedido] = useState<string | null>(null)

  type MovimentoCrediario = { id: string; valor: number; itens: unknown }
  const [movimentoCrediario, setMovimentoCrediario] = useState<MovimentoCrediario | null>(null)
  const [enviandoItemId, setEnviandoItemId] = useState<string | null>(null)

  const [modoSelecaoTimeline, setModoSelecaoTimeline] = useState(false)
  const [itensSelecionadosTimeline, setItensSelecionadosTimeline] = useState<Set<string>>(new Set())
  const [imprimindoItemId, setImprimindoItemId] = useState<string | null>(null)
  const [imprimindoSelecionados, setImprimindoSelecionados] = useState(false)

  // pagamento parcial por itens
  const [pagandoItemId, setPagandoItemId] = useState<string | null>(null)
  const [pagandoSelecionados, setPagandoSelecionados] = useState(false)
  const [revertendoItemId, setRevertendoItemId] = useState<string | null>(null)
  const [modalFormaAberto, setModalFormaAberto] = useState<{
    itens: ItemPedido[]
    origem: 'item_unico' | 'selecao'
    /** itemId -> quantidade de unidades a cobrar neste lançamento. */
    quantidadesPorItem: Record<string, number>
  } | null>(null)
  const [modalReversaoAberto, setModalReversaoAberto] = useState<{
    item: ItemPedido
    origem: 'pagamento' | 'crediario'
    quantidade: number
    maxPagamento: number
    maxCrediario: number
  } | null>(null)

  const carregarPedido = useCallback(async () => {
    if (!pedidoId) return

    const cached = pedidosCache.get(pedidoId)
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      setPedido(cached.pedido)
      setItens(cached.itens)
      return
    }

    setLoading(true)
    try {
      const [pedidoResult, itensResult] = await Promise.all([
        supabase.from('pedidos').select('*').eq('id', pedidoId).single(),
        supabase.from('itens_pedido').select('*').eq('pedido_id', pedidoId).order('created_at'),
      ])

      if (pedidoResult.error) throw pedidoResult.error

      const pedidoData = pedidoResult.data
      let itensData = (itensResult.data || []) as ItemPedido[]

      if (itensData.length > 0) {
        const itensIds = itensData.map((item) => item.id)
        const { data: adicionaisData } = await supabase
          .from('item_adicionais')
          .select('*')
          .in('item_pedido_id', itensIds)

        if (adicionaisData && adicionaisData.length > 0) {
          const adicionaisPorItem = new Map<string, AdicionalItem[]>()
          adicionaisData.forEach(
            (adicional: {
              item_pedido_id: string
              id: string
              nome: string
              preco: number
              quantidade?: number
            }) => {
              const lista = adicionaisPorItem.get(adicional.item_pedido_id) || []
              lista.push({
                id: adicional.id,
                nome: adicional.nome,
                preco: adicional.preco,
                quantidade: adicional.quantidade || 1,
              })
              adicionaisPorItem.set(adicional.item_pedido_id, lista)
            },
          )
          itensData = itensData.map((item) => ({
            ...item,
            adicionais_lista: adicionaisPorItem.get(item.id) || [],
          }))
        }
      }

      pedidosCache.set(pedidoId, { pedido: pedidoData, itens: itensData, timestamp: Date.now() })

      const idsGarcons = new Set<string>()
      if (pedidoData.garcom_id) idsGarcons.add(pedidoData.garcom_id)
      itensData.forEach((item) => {
        if (item.adicionado_por_garcom_id) idsGarcons.add(item.adicionado_por_garcom_id)
      })

      let mapaGarcons = new Map<string, string>()
      if (idsGarcons.size > 0) {
        const { data: garconsData } = await supabase
          .from('usuarios_sistema')
          .select('id, nome')
          .in('id', Array.from(idsGarcons))
        if (garconsData) {
          garconsData.forEach((g) => mapaGarcons.set(g.id, g.nome))
        }
      }

      if (pedidoData.garcom_id && mapaGarcons.has(pedidoData.garcom_id)) {
        setNomeGarcomPedido(mapaGarcons.get(pedidoData.garcom_id) || null)
      } else {
        setNomeGarcomPedido(null)
      }

      itensData = itensData.map((item) => ({
        ...item,
        nome_garcom: item.adicionado_por_garcom_id
          ? mapaGarcons.get(item.adicionado_por_garcom_id) || null
          : null,
      }))

      setPedido(pedidoData)
      setItens(itensData)

      const { data: pagamentosData } = await supabase
        .from('pagamentos_pedido')
        .select('id, forma_pagamento, valor, itens_pagos')
        .eq('pedido_id', pedidoId)
        .order('created_at', { ascending: true })
      setPagamentos((pagamentosData as PagamentoPedido[] | null) || [])
    } catch (error) {
      console.error('Erro ao carregar pedido:', error)
    } finally {
      setLoading(false)
    }
  }, [pedidoId])

  useEffect(() => {
    if (aberto && pedidoId) {
      pedidosCache.delete(pedidoId)
      void carregarPedido()
      void carregarMovimentoCrediario(pedidoId)
    }
  }, [aberto, pedidoId, carregarPedido])

  // Realtime: quando o modal estiver aberto, recarrega ao detectar mudança no pedido
  // (itens, pagamentos, crediário). Garante consistência com outras janelas/abas.
  useEffect(() => {
    if (!aberto || !pedidoId) return

    let debounceTimer: ReturnType<typeof setTimeout> | null = null
    const agendarRecarga = () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        debounceTimer = null
        pedidosCache.delete(pedidoId)
        void carregarPedido()
        void carregarMovimentoCrediario(pedidoId)
      }, 250)
    }

    const channel = supabase
      .channel(`modal-detalhes-pedido-${pedidoId}-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pagamentos_pedido', filter: `pedido_id=eq.${pedidoId}` },
        () => agendarRecarga(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'crediario_movimentos', filter: `pedido_id=eq.${pedidoId}` },
        () => agendarRecarga(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'itens_pedido', filter: `pedido_id=eq.${pedidoId}` },
        () => agendarRecarga(),
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'pedidos', filter: `id=eq.${pedidoId}` },
        () => agendarRecarga(),
      )
      .subscribe()

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      supabase.removeChannel(channel)
    }
  }, [aberto, pedidoId, carregarPedido])

  const carregarMovimentoCrediario = async (id: string) => {
    try {
      const { data } = await supabase
        .from('crediario_movimentos')
        .select('id, valor, itens')
        .eq('pedido_id', id)
        .eq('origem', 'pedido')
        .eq('tipo', 'consumo')
        .eq('status', 'ativo')
        .maybeSingle()
      if (data) {
        setMovimentoCrediario({
          id: String(data.id),
          valor: Number(data.valor || 0),
          itens: data.itens,
        })
      } else {
        setMovimentoCrediario(null)
      }
    } catch (e) {
      console.error('Erro ao carregar movimento crediário:', e)
      setMovimentoCrediario(null)
    }
  }

  const idsNoCrediario = useMemo(() => {
    const set = new Set<string>()
    if (Array.isArray(movimentoCrediario?.itens)) {
      ;(movimentoCrediario!.itens as Array<Record<string, unknown>>).forEach((registro) => {
        if (registro?.id) set.add(String(registro.id))
      })
    }
    return set
  }, [movimentoCrediario])

  const ehItemForaCrediario = (item: ItemPedido) => {
    if (!movimentoCrediario) return false
    if (!String(pedido?.forma_pagamento || '').toLowerCase().includes('credi')) return false
    return !idsNoCrediario.has(String(item.id))
  }

  const enviarItemAoCrediario = async (item: ItemPedido) => {
    if (!movimentoCrediario || !pedido) return
    setEnviandoItemId(item.id)
    try {
      const itensAtuais = Array.isArray(movimentoCrediario.itens)
        ? (movimentoCrediario.itens as Array<Record<string, unknown>>)
        : []
      const novoRegistro = {
        id: item.id,
        nome: item.nome_item || 'Item',
        quantidade: Number(item.quantidade || 1),
        preco_unitario: Number(item.preco_unitario || 0),
        subtotal: Number(item.subtotal || 0),
        observacoes: item.observacoes ?? null,
        created_at: item.created_at || new Date().toISOString(),
      }
      const novosItens = [...itensAtuais, novoRegistro]
      const novoValor = Number(movimentoCrediario.valor || 0) + Number(item.subtotal || 0)

      const { error } = await supabase
        .from('crediario_movimentos')
        .update({ valor: novoValor, itens: novosItens })
        .eq('id', movimentoCrediario.id)

      if (error) throw error

      setMovimentoCrediario({
        id: movimentoCrediario.id,
        valor: novoValor,
        itens: novosItens,
      })
      toast.success('Item enviado ao crediário aberto')
    } catch (e) {
      console.error('Erro ao enviar item ao crediário:', e)
      toast.error('Não foi possível enviar este item ao crediário')
    } finally {
      setEnviandoItemId(null)
    }
  }

  const ehFormaCrediario = (forma: string | null | undefined) => {
    const normalizada = String(forma || '').toLowerCase()
    return ['credi', 'fiado', 'conta'].some((token) => normalizada.includes(token))
  }

  const pagamentoTemItens = (pagamento: PagamentoPedido) =>
    Array.isArray(pagamento.itens_pagos) && pagamento.itens_pagos.length > 0

  const ehPagamentoGlobal = (pagamento: PagamentoPedido) =>
    !ehFormaCrediario(pagamento.forma_pagamento) && !pagamentoTemItens(pagamento)

  const normalizarQuantidadeUnidades = (
    valor: unknown,
    maximo: number,
    fallback = 1,
  ) => {
    const limite = Math.max(0, Math.floor(Number(maximo || 0)))
    if (limite <= 0) return 0
    const numerico = Math.floor(Number(valor))
    const base = Number.isFinite(numerico) && numerico > 0 ? numerico : fallback
    return Math.min(Math.max(1, base), limite)
  }

  const valorUnitarioItem = (item: ItemPedido) => {
    const quantidade = Number(item.quantidade || 1)
    const subtotal = Number(item.subtotal || 0)
    return quantidade > 0 ? subtotal / quantidade : Number(item.preco_unitario || 0)
  }

  const somarSnapshots = (lista: Array<{ subtotal?: unknown }>) =>
    Number(lista.reduce((sum, registro) => sum + Number(registro?.subtotal || 0), 0).toFixed(2))

  const ajustarQuantidadeSnapshot = (
    registro: ItemPagoSnapshot,
    novaQuantidade: number,
  ): ItemPagoSnapshot => {
    const quantidadeOriginal = normalizarQuantidadeUnidades(registro.quantidade, Number.MAX_SAFE_INTEGER)
    const precoUnitario =
      Number(registro.preco_unitario || 0) ||
      (quantidadeOriginal > 0 ? Number(registro.subtotal || 0) / quantidadeOriginal : 0)

    return {
      ...registro,
      quantidade: novaQuantidade,
      preco_unitario: Number(precoUnitario.toFixed(2)),
      subtotal: Number((precoUnitario * novaQuantidade).toFixed(2)),
    }
  }

  const removerQuantidadeDeSnapshots = <T extends ItemPagoSnapshot>(
    lista: T[],
    itemId: string,
    quantidadeRemover: number,
  ) => {
    let restanteParaRemover = Math.max(0, Math.floor(quantidadeRemover))
    let removida = 0
    const restantes: T[] = []

    lista.forEach((registro) => {
      if (String(registro.id) !== itemId || restanteParaRemover <= 0) {
        restantes.push(registro)
        return
      }

      const quantidadeOriginal = normalizarQuantidadeUnidades(
        registro.quantidade,
        Number.MAX_SAFE_INTEGER,
      )
      const removerAgora = Math.min(quantidadeOriginal, restanteParaRemover)
      const novaQuantidade = quantidadeOriginal - removerAgora

      removida += removerAgora
      restanteParaRemover -= removerAgora

      if (novaQuantidade > 0) {
        restantes.push(ajustarQuantidadeSnapshot(registro, novaQuantidade) as T)
      }
    })

    return { restantes, removida }
  }

  /**
   * Mapas itemId → quantidade já paga (forma real) e quantidade já em crediário.
   * Crediário é fiado: NÃO entra no "pago". Aparece em vermelho separadamente.
   */
  const quantidadesPorItem = useMemo(() => {
    const pagas = new Map<string, number>()
    const crediario = new Map<string, number>()
    const formaPorItem = new Map<string, string>()

    pagamentos.forEach((pagamento) => {
      const lista = Array.isArray(pagamento.itens_pagos) ? pagamento.itens_pagos : []
      const formaCrediario = ehFormaCrediario(pagamento.forma_pagamento)
      lista.forEach((registro) => {
        if (!registro?.id) return
        const id = String(registro.id)
        const qtd = Number(registro.quantidade)
        const incremento = Number.isFinite(qtd) && qtd > 0 ? qtd : 1
        if (formaCrediario) {
          crediario.set(id, (crediario.get(id) || 0) + incremento)
        } else {
          pagas.set(id, (pagas.get(id) || 0) + incremento)
          if (!formaPorItem.has(id)) formaPorItem.set(id, pagamento.forma_pagamento || 'pago')
        }
      })
    })

    if (Array.isArray(movimentoCrediario?.itens)) {
      ;(movimentoCrediario!.itens as Array<Record<string, unknown>>).forEach((registro) => {
        if (!registro?.id) return
        const id = String(registro.id)
        const qtd = Number(registro.quantidade)
        const incremento = Number.isFinite(qtd) && qtd > 0 ? qtd : 1
        crediario.set(id, (crediario.get(id) || 0) + incremento)
      })
    }

    return { pagas, crediario, formaPorItem }
  }, [pagamentos, movimentoCrediario])

  const obterStatusItem = useCallback(
    (item: ItemPedido) => {
      const total = Number(item.quantidade || 1)
      const qtdPaga = Math.min(quantidadesPorItem.pagas.get(item.id) || 0, total)
      const qtdCrediario = Math.min(
        quantidadesPorItem.crediario.get(item.id) || 0,
        total - qtdPaga,
      )
      const qtdRestante = Math.max(0, total - qtdPaga - qtdCrediario)
      return {
        total,
        qtdPaga,
        qtdCrediario,
        qtdRestante,
        totalmentePago: qtdPaga >= total,
        totalmenteCrediario: qtdCrediario > 0 && qtdRestante === 0,
        parcial: qtdPaga > 0 || qtdCrediario > 0,
        forma: quantidadesPorItem.formaPorItem.get(item.id) || null,
      }
    },
    [quantidadesPorItem],
  )

  const valorPagoTotal = useMemo(() => {
    let total = 0
    itens.forEach((item) => {
      const { qtdPaga, total: qtdTotal } = obterStatusItem(item)
      if (qtdPaga > 0) {
        const subtotal = Number(item.subtotal || 0)
        const precoUnit = qtdTotal > 0 ? subtotal / qtdTotal : Number(item.preco_unitario || 0)
        total += qtdPaga * precoUnit
      }
    })
    return Number(total.toFixed(2))
  }, [itens, obterStatusItem])

  const valorEmCrediario = useMemo(() => {
    let total = 0
    itens.forEach((item) => {
      const { qtdCrediario, total: qtdTotal } = obterStatusItem(item)
      if (qtdCrediario > 0) {
        const subtotal = Number(item.subtotal || 0)
        const precoUnit = qtdTotal > 0 ? subtotal / qtdTotal : Number(item.preco_unitario || 0)
        total += qtdCrediario * precoUnit
      }
    })
    return Number(total.toFixed(2))
  }, [itens, obterStatusItem])

  const FORMA_PAGAMENTO_LABEL: Record<FormaPagamentoOpcao, string> = {
    pix: 'PIX',
    dinheiro: 'Dinheiro',
    cartao: 'Cartão',
    crediario: 'Crediário',
  }

  const FORMA_PAGAMENTO_BANCO: Record<FormaPagamentoOpcao, string> = {
    pix: 'pix',
    dinheiro: 'dinheiro',
    cartao: 'cartao',
    crediario: 'crediario',
  }

  const abrirModalForma = useCallback(
    (alvoItens: ItemPedido[], origem: 'item_unico' | 'selecao') => {
      if (alvoItens.length === 0) return
      const itensComRestante = alvoItens.filter((item) => obterStatusItem(item).qtdRestante > 0)
      if (itensComRestante.length === 0) {
        toast.info('Item já está totalmente pago')
        return
      }

      const quantidadesPorItem = itensComRestante.reduce<Record<string, number>>((acc, item) => {
        const status = obterStatusItem(item)
        acc[item.id] = normalizarQuantidadeUnidades(
          origem === 'item_unico' ? 1 : status.qtdRestante,
          status.qtdRestante,
        )
        return acc
      }, {})

      setModalFormaAberto({ itens: itensComRestante, origem, quantidadesPorItem })
    },
    [obterStatusItem],
  )

  const fecharModalForma = useCallback(() => {
    setModalFormaAberto(null)
  }, [])

  const ajustarQuantidadePagamento = useCallback(
    (itemId: string, maxQuantidade: number, quantidade: number) => {
      setModalFormaAberto((atual) => {
        if (!atual) return atual
        const proximaQuantidade = normalizarQuantidadeUnidades(quantidade, maxQuantidade)
        return {
          ...atual,
          quantidadesPorItem: {
            ...atual.quantidadesPorItem,
            [itemId]: proximaQuantidade,
          },
        }
      })
    },
    [],
  )

  const registrarPagamentoParcial = useCallback(
    async (
      alvoItens: ItemPedido[],
      forma: FormaPagamentoOpcao,
      origem: 'item_unico' | 'selecao',
      snapshotItens: ItemPagoSnapshot[],
    ) => {
      if (!pedido || alvoItens.length === 0) return
      const idsAlvo = new Set(alvoItens.map((item) => item.id))
      if (snapshotItens.length === 0) {
        toast.info('Nada a pagar', {
          description: 'Os itens selecionados já estão totalmente pagos.',
        })
        fecharModalForma()
        return
      }

      if (origem === 'item_unico') {
        setPagandoItemId(alvoItens[0].id)
      } else {
        setPagandoSelecionados(true)
      }

      try {
        const valorTotal = Number(
          snapshotItens.reduce((sum, item) => sum + item.subtotal, 0).toFixed(2),
        )

        if (forma === 'crediario') {
          // Crediário usa o fluxo existente (crediario_movimentos.itens)
          if (movimentoCrediario) {
            const itensAtuais = Array.isArray(movimentoCrediario.itens)
              ? (movimentoCrediario.itens as Array<Record<string, unknown>>)
              : []
            const novosItens = [...itensAtuais, ...snapshotItens]
            const novoValor = Number(movimentoCrediario.valor || 0) + valorTotal
            const { error } = await supabase
              .from('crediario_movimentos')
              .update({ valor: novoValor, itens: novosItens })
              .eq('id', movimentoCrediario.id)
            if (error) throw error
            setMovimentoCrediario({
              id: movimentoCrediario.id,
              valor: novoValor,
              itens: novosItens,
            })
          } else {
            toast.error('Crediário ainda não está aberto para este pedido', {
              description: 'Abra o pedido no crediário antes de enviar itens separados para fiado.',
            })
            return
          }
        } else {
          const pagamentosGlobais = pagamentos.filter(ehPagamentoGlobal)
          const { data, error } = await supabase
            .from('pagamentos_pedido')
            .insert({
              pedido_id: pedido.id,
              forma_pagamento: FORMA_PAGAMENTO_BANCO[forma],
              valor: valorTotal,
              itens_pagos: snapshotItens,
            })
            .select('id, forma_pagamento, valor, itens_pagos')
            .single()
          if (error) throw error

          if (pagamentosGlobais.length > 0) {
            const { error: erroLimpezaGlobal } = await supabase
              .from('pagamentos_pedido')
              .delete()
              .eq('pedido_id', pedido.id)
              .or('itens_pagos.is.null,itens_pagos.eq.[]')
            if (erroLimpezaGlobal) {
              if (data?.id) {
                await supabase.from('pagamentos_pedido').delete().eq('id', data.id)
              }
              throw erroLimpezaGlobal
            }
          }

          if (data) {
            setPagamentos((atual) => [
              ...atual.filter((pagamento) => !ehPagamentoGlobal(pagamento)),
              data as PagamentoPedido,
            ])
          }
        }

        const totalUnidades = snapshotItens.reduce((acc, item) => acc + item.quantidade, 0)
        const labelAcao = forma === 'crediario' ? 'Enviado ao crediário' : 'Pagamento registrado'
        toast.success(labelAcao, {
          description: `${totalUnidades} ${
            totalUnidades === 1 ? 'unidade' : 'unidades'
          } · ${FORMA_PAGAMENTO_LABEL[forma]} · R$ ${valorTotal.toFixed(2)}`,
        })

        if (origem === 'selecao') {
          setItensSelecionadosTimeline((atual) => {
            const proximo = new Set(atual)
            idsAlvo.forEach((id) => proximo.delete(id))
            return proximo
          })
          setModoSelecaoTimeline(false)
        }
        fecharModalForma()
      } catch (e) {
        console.error('Erro ao registrar pagamento parcial:', e)
        toast.error('Falha ao registrar pagamento', {
          description: e instanceof Error ? e.message : 'Tente novamente.',
        })
      } finally {
        setPagandoItemId(null)
        setPagandoSelecionados(false)
      }
    },
    [
      pedido,
      movimentoCrediario,
      fecharModalForma,
      FORMA_PAGAMENTO_LABEL,
      FORMA_PAGAMENTO_BANCO,
      pagamentos,
    ],
  )

  const abrirModalReversao = useCallback(
    (item: ItemPedido) => {
      const status = obterStatusItem(item)
      const maxPagamento = Math.floor(status.qtdPaga)
      const maxCrediario = Math.floor(status.qtdCrediario)
      if (maxPagamento <= 0 && maxCrediario <= 0) {
        toast.info('Não há cobrança parcial para reverter')
        return
      }

      const origem = maxPagamento > 0 ? 'pagamento' : 'crediario'
      const maxOrigem = origem === 'pagamento' ? maxPagamento : maxCrediario
      setModalReversaoAberto({
        item,
        origem,
        quantidade: normalizarQuantidadeUnidades(1, maxOrigem),
        maxPagamento,
        maxCrediario,
      })
    },
    [obterStatusItem],
  )

  const fecharModalReversao = useCallback(() => {
    setModalReversaoAberto(null)
  }, [])

  /**
   * Reverte uma quantidade específica da cobrança de um item.
   * Pagamento efetivo e crediário são tratados separadamente para não remover
   * uma dívida quando o operador queria desfazer apenas o recebimento.
   */
  const reverterCobrancaItem = useCallback(
    async (item: ItemPedido, origem: 'pagamento' | 'crediario', quantidade: number) => {
      if (!pedido || revertendoItemId) return
      const itemId = item.id
      const quantidadeParaReverter = normalizarQuantidadeUnidades(
        quantidade,
        origem === 'pagamento'
          ? obterStatusItem(item).qtdPaga
          : obterStatusItem(item).qtdCrediario,
      )
      if (quantidadeParaReverter <= 0) return

      setRevertendoItemId(itemId)
      try {
        let quantidadeRemovida = 0
        let removeuPagamento = false
        let removeuCrediario = false

        let novosPagamentosLocais = [...pagamentos]

        if (origem === 'pagamento') {
          let restanteParaRemover = quantidadeParaReverter
          const pagamentosAfetados = pagamentos.filter(
            (pagamento) =>
              !ehFormaCrediario(pagamento.forma_pagamento) &&
              (pagamento.itens_pagos || []).some((registro) => String(registro.id) === itemId),
          )

          for (const pagamento of pagamentosAfetados) {
            if (!pagamento.id || restanteParaRemover <= 0) continue
            const listaOriginal = pagamento.itens_pagos || []
            const { restantes, removida } = removerQuantidadeDeSnapshots(
              listaOriginal,
              itemId,
              restanteParaRemover,
            )

            if (removida <= 0) continue
            restanteParaRemover -= removida
            quantidadeRemovida += removida
            removeuPagamento = true

            if (restantes.length === 0) {
              const { error } = await supabase
                .from('pagamentos_pedido')
                .delete()
                .eq('id', pagamento.id)
              if (error) throw error
              novosPagamentosLocais = novosPagamentosLocais.filter((p) => p.id !== pagamento.id)
            } else {
              const novoValor = somarSnapshots(restantes)
              const { error } = await supabase
                .from('pagamentos_pedido')
                .update({ itens_pagos: restantes, valor: novoValor })
                .eq('id', pagamento.id)
              if (error) throw error
              novosPagamentosLocais = novosPagamentosLocais.map((p) =>
                p.id === pagamento.id ? { ...p, itens_pagos: restantes, valor: novoValor } : p,
              )
            }
          }
        }

        let movimentoCrediarioLocal = movimentoCrediario

        if (
          origem === 'crediario' &&
          movimentoCrediario &&
          Array.isArray(movimentoCrediario.itens)
        ) {
          const itensCrediario = movimentoCrediario.itens as ItemPagoSnapshot[]
          const { restantes, removida } = removerQuantidadeDeSnapshots(
            itensCrediario,
            itemId,
            quantidadeParaReverter,
          )

          if (removida > 0) {
            quantidadeRemovida += removida
            removeuCrediario = true
            const novoValor = somarSnapshots(restantes)
            const { error } = await supabase
              .from('crediario_movimentos')
              .update({ itens: restantes, valor: novoValor })
              .eq('id', movimentoCrediario.id)
            if (error) throw error
            movimentoCrediarioLocal = { id: movimentoCrediario.id, valor: novoValor, itens: restantes }
          }
        }

        if (quantidadeRemovida <= 0) {
          toast.info('Nenhuma unidade foi revertida')
          return
        }

        setPagamentos(novosPagamentosLocais)
        setMovimentoCrediario(movimentoCrediarioLocal)
        fecharModalReversao()

        toast.success('Cobrança revertida', {
          description: `${quantidadeRemovida} ${
            quantidadeRemovida === 1 ? 'unidade' : 'unidades'
          } de ${nomeProduto(item)} · ${
            removeuPagamento && removeuCrediario
              ? 'pagamento e crediário'
              : removeuPagamento
                ? 'pagamento'
                : 'crediário'
          }`,
        })
      } catch (e) {
        console.error('Erro ao reverter cobrança:', e)
        toast.error('Falha ao reverter cobrança', {
          description: e instanceof Error ? e.message : 'Tente novamente.',
        })
      } finally {
        setRevertendoItemId(null)
      }
    },
    [
      pedido,
      pagamentos,
      movimentoCrediario,
      revertendoItemId,
      obterStatusItem,
      fecharModalReversao,
    ],
  )

  const trocoCalculado = useMemo(() => {
    if (pedido?.troco_para && pedido.troco_para > 0) {
      return pedido.troco_para - pedido.total
    }
    return null
  }, [pedido])

  const resumoFinanceiro = useMemo(() => {
    if (!pedido) {
      return { subtotal: 0, taxaEntrega: 0, taxaPagamento: 0, taxaServico: 0, total: 0, meioPagamento: '' }
    }
    return {
      subtotal: Number(pedido.subtotal || 0),
      taxaEntrega: Number(pedido.taxa_entrega || 0),
      taxaPagamento: Number(pedido.taxa_pagamento || 0),
      taxaServico: Number(pedido.taxa_servico || 0),
      total: Number(pedido.total || 0),
      meioPagamento: pedido.forma_pagamento || 'meio não informado',
    }
  }, [pedido])

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pendente':
        return 'bg-muted text-muted-foreground'
      case 'em preparo':
      case 'preparando':
        return 'bg-foreground/10 text-foreground'
      case 'pronto':
        return 'bg-foreground text-background'
      case 'entregue':
        return 'bg-muted text-muted-foreground line-through'
      case 'cancelado':
        return 'bg-destructive/10 text-destructive'
      default:
        return 'bg-muted text-muted-foreground'
    }
  }

  const nomeProduto = (item: ItemPedido) => item.nome_item || 'Produto'

  const itensTimeline = useMemo(() => {
    return [...itens].sort((a, b) => {
      const dataA = new Date(a.created_at || pedido?.created_at || 0).getTime()
      const dataB = new Date(b.created_at || pedido?.created_at || 0).getTime()
      return dataA - dataB
    })
  }, [itens, pedido?.created_at])

  const formatarHorarioItem = (data?: string | null) => {
    if (!data) return '--:--'
    const dataItem = new Date(data)
    if (Number.isNaN(dataItem.getTime())) return '--:--'
    return format(dataItem, 'HH:mm', { locale: ptBR })
  }

  const formatarDataHoraItem = (data?: string | null) => {
    if (!data) return ''
    const dataItem = new Date(data)
    if (Number.isNaN(dataItem.getTime())) return ''
    return format(dataItem, "dd/MM 'às' HH:mm", { locale: ptBR })
  }

  const construirSnapshotPedidoParaImpressao = useCallback(
    (pedidoBase: Pedido): PedidoSnapshotImpressao => ({
      id: pedidoBase.id,
      numero_pedido: null,
      nome_cliente: pedidoBase.nome_cliente || 'Cliente',
      telefone: pedidoBase.telefone || null,
      tipo_entrega: pedidoBase.tipo_entrega || 'retirada',
      mesa: pedidoBase.mesa ?? null,
      comanda: pedidoBase.comanda ?? null,
      endereco: pedidoBase.endereco || null,
      bairro: pedidoBase.bairro || null,
      observacoes: pedidoBase.observacoes || null,
      subtotal: 0,
      taxa_entrega: 0,
      taxa_servico: 0,
      total: 0,
      forma_pagamento: pedidoBase.forma_pagamento || null,
      troco_para: pedidoBase.troco_para ?? null,
      created_at: pedidoBase.created_at,
    }),
    [],
  )

  const construirSnapshotItens = useCallback(
    (lista: ItemPedido[]): ItemSnapshotImpressao[] =>
      lista.map((item) => ({
        nome_item: item.nome_item || 'Produto',
        quantidade: Number(item.quantidade || 1),
        preco_unitario: Number(item.preco_unitario || 0),
        subtotal: Number(item.subtotal || 0),
        observacoes: item.observacoes || null,
        item_adicionais: (item.adicionais_lista || []).map((adicional) => ({
          nome: adicional.nome,
          preco: Number(adicional.preco || 0),
          quantidade: Number(adicional.quantidade || 1),
        })),
      })),
    [],
  )

  const enfileirarImpressaoTimeline = useCallback(
    async (itensParaImprimir: ItemPedido[], origemSufixo: string) => {
      if (!pedido || itensParaImprimir.length === 0) {
        return { sucesso: false, duplicado: false, ignorado: false, erro: undefined }
      }

      const itensSnapshot = construirSnapshotItens(itensParaImprimir)
      const pedidoSnapshot = construirSnapshotPedidoParaImpressao(pedido)
      const semente = `${origemSufixo}:${Date.now()}`

      return enfileirarImpressao({
        pedidoId: pedido.id,
        tipo: 'cozinha',
        escopo: 'itens_novos',
        itensSnapshot,
        pedidoSnapshot,
        origem: `admin_timeline_${origemSufixo}`,
        automatico: false,
        hashEvento: gerarHashEventoImpressao(
          pedido.id,
          'cozinha',
          'itens_novos',
          itensSnapshot,
          semente,
        ),
      })
    },
    [pedido, construirSnapshotItens, construirSnapshotPedidoParaImpressao],
  )

  const imprimirItemUnico = useCallback(
    async (item: ItemPedido) => {
      if (imprimindoItemId) return
      setImprimindoItemId(item.id)
      try {
        const resultado = await enfileirarImpressaoTimeline([item], 'item_unico')
        if (resultado.sucesso) {
          toast.success('Enviado para impressão', {
            description: `${item.quantidade}x ${nomeProduto(item)} · cozinha`,
          })
        } else if (resultado.duplicado) {
          toast.info('Já está na fila', {
            description: 'Este item já foi enviado para a impressora.',
          })
        } else {
          toast.error('Falha ao enviar para impressão', {
            description: resultado.erro || 'Verifique a conexão da impressora.',
          })
        }
      } finally {
        setImprimindoItemId(null)
      }
    },
    [imprimindoItemId, enfileirarImpressaoTimeline],
  )

  const alternarSelecaoItem = useCallback((itemId: string) => {
    setItensSelecionadosTimeline((atual) => {
      const proximo = new Set(atual)
      if (proximo.has(itemId)) {
        proximo.delete(itemId)
      } else {
        proximo.add(itemId)
      }
      return proximo
    })
  }, [])

  const ativarModoSelecao = useCallback(() => {
    setModoSelecaoTimeline(true)
    setItensSelecionadosTimeline(new Set())
  }, [])

  const cancelarModoSelecao = useCallback(() => {
    setModoSelecaoTimeline(false)
    setItensSelecionadosTimeline(new Set())
  }, [])

  const imprimirItensSelecionados = useCallback(async () => {
    if (imprimindoSelecionados || itensSelecionadosTimeline.size === 0) return
    const selecionados = itensTimeline.filter((item) => itensSelecionadosTimeline.has(item.id))
    if (selecionados.length === 0) return

    setImprimindoSelecionados(true)
    try {
      const resultado = await enfileirarImpressaoTimeline(selecionados, 'selecao')
      if (resultado.sucesso) {
        toast.success('Enviado para impressão', {
          description: `${selecionados.length} ${
            selecionados.length === 1 ? 'item' : 'itens'
          } · cozinha`,
        })
        cancelarModoSelecao()
      } else if (resultado.duplicado) {
        toast.info('Já está na fila', {
          description: 'Esta seleção já foi enviada para a impressora.',
        })
      } else {
        toast.error('Falha ao enviar para impressão', {
          description: resultado.erro || 'Verifique a conexão da impressora.',
        })
      }
    } finally {
      setImprimindoSelecionados(false)
    }
  }, [
    imprimindoSelecionados,
    itensSelecionadosTimeline,
    itensTimeline,
    enfileirarImpressaoTimeline,
    cancelarModoSelecao,
  ])

  useEffect(() => {
    if (!aberto) {
      setModoSelecaoTimeline(false)
      setItensSelecionadosTimeline(new Set())
    }
  }, [aberto])

  const reversao = modalReversaoAberto
    ? (() => {
        const { item, origem, quantidade, maxPagamento, maxCrediario } = modalReversaoAberto
        const maxOrigem = origem === 'pagamento' ? maxPagamento : maxCrediario
        return {
          item,
          origem,
          quantidade,
          maxPagamento,
          maxCrediario,
          maxOrigem,
          valorRevertido: Number((valorUnitarioItem(item) * quantidade).toFixed(2)),
          ocupado: revertendoItemId === item.id,
        }
      })()
    : null

  const selecionarOrigemReversao = (proximaOrigem: 'pagamento' | 'crediario') => {
    setModalReversaoAberto((atual) => {
      if (!atual) return atual
      const proximoMax = proximaOrigem === 'pagamento' ? atual.maxPagamento : atual.maxCrediario
      if (proximoMax <= 0) return atual
      return {
        ...atual,
        origem: proximaOrigem,
        quantidade: normalizarQuantidadeUnidades(atual.quantidade, proximoMax),
      }
    })
  }

  const ajustarQuantidadeReversao = (proximaQuantidade: number) => {
    setModalReversaoAberto((atual) => {
      if (!atual) return atual
      const maxOrigem = atual.origem === 'pagamento' ? atual.maxPagamento : atual.maxCrediario
      return { ...atual, quantidade: normalizarQuantidadeUnidades(proximaQuantidade, maxOrigem) }
    })
  }

  const selecao = (() => {
    if (!pedido || !modoSelecaoTimeline) return null
    const itensSelecionadosLista = itensTimeline.filter((item) => itensSelecionadosTimeline.has(item.id))
    const itensNaoPagosSelecionados = itensSelecionadosLista.filter(
      (item) => obterStatusItem(item).qtdRestante > 0,
    )
    const valorSelecionado = Number(
      itensNaoPagosSelecionados
        .reduce((sum, item) => {
          const status = obterStatusItem(item)
          const total = Number(item.quantidade || 1)
          const subtotal = Number(item.subtotal || 0)
          const precoUnit = total > 0 ? subtotal / total : Number(item.preco_unitario || 0)
          return sum + status.qtdRestante * precoUnit
        }, 0)
        .toFixed(2),
    )
    return { itensNaoPagosSelecionados, valorSelecionado }
  })()

  const rodapeDetalhes = !pedido ? undefined : selecao ? (
    <>
      <Botao variante="contorno" onClick={cancelarModoSelecao}>
        Cancelar
      </Botao>
      <Botao
        variante="contorno"
        onClick={() => void imprimirItensSelecionados()}
        carregando={imprimindoSelecionados}
        disabled={itensSelecionadosTimeline.size === 0}
      >
        {!imprimindoSelecionados && <Printer className="size-4" />}
        Imprimir{itensSelecionadosTimeline.size > 0 ? ` ${itensSelecionadosTimeline.size}` : ''}
      </Botao>
      <Botao
        onClick={() => abrirModalForma(selecao.itensNaoPagosSelecionados, 'selecao')}
        carregando={pagandoSelecionados}
        disabled={selecao.itensNaoPagosSelecionados.length === 0}
      >
        {!pagandoSelecionados && <CircleDollarSign className="size-4" />}
        Pagar{selecao.itensNaoPagosSelecionados.length > 0 ? ` ${selecao.itensNaoPagosSelecionados.length}` : ''}
      </Botao>
    </>
  ) : (
    <>
      {onEditar && (
        <Botao
          variante="contorno"
          className="md:mr-auto"
          onClick={() => {
            onEditar(pedido)
            onFechar()
          }}
        >
          <Edit2 className="size-4" />
          Editar
        </Botao>
      )}
      {onGerarPDF && (
        <Botao
          variante="contorno"
          onClick={() => {
            const pedidoComPagamentos = {
              ...pedido,
              pagamentos: pagamentos.length > 0 ? pagamentos : undefined,
            }
            onGerarPDF(pedidoComPagamentos as any)
            onFechar()
          }}
        >
          <FileText className="size-4" />
          PDF
        </Botao>
      )}
      <Botao
        onClick={() => {
          const pedidoComDados = {
            ...pedido,
            itens: itens.map((item) => ({
              nome_item: item.nome_item || 'Produto',
              quantidade: item.quantidade,
              preco_unitario: item.preco_unitario,
              subtotal: item.subtotal,
              adicionais:
                item.adicionais_lista && item.adicionais_lista.length > 0
                  ? item.adicionais_lista
                      .map((a) => `${a.quantidade && a.quantidade > 1 ? a.quantidade + 'x ' : ''}${a.nome}`)
                      .join(', ')
                  : item.adicionais,
              observacoes: item.observacoes,
            })),
            pagamentos: pagamentos.length > 0 ? pagamentos : undefined,
          }
          gerarTicketPDF(pedidoComDados as any)
          onFechar()
        }}
      >
        <Printer className="size-4" />
        Ticket
      </Botao>
    </>
  )

  return (
    <>
      <Gaveta
        aberto={aberto}
        aoFechar={onFechar}
        largura="xl"
        titulo={<span className="font-mono tabular-nums">Pedido #{pedidoId?.slice(0, 8).toUpperCase()}</span>}
        descricao={
          pedido
            ? format(new Date(pedido.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
            : 'Carregando pedido'
        }
        cabecalho={
          selecao ? (
            <p className="text-sm text-muted-foreground">
              {itensSelecionadosTimeline.size === 0
                ? 'Toque nos itens da linha do tempo para selecionar.'
                : `${itensSelecionadosTimeline.size} ${
                    itensSelecionadosTimeline.size === 1 ? 'selecionado' : 'selecionados'
                  }${selecao.valorSelecionado > 0 ? ` · R$ ${selecao.valorSelecionado.toFixed(2)}` : ''}`}
            </p>
          ) : undefined
        }
        rodape={rodapeDetalhes}
      >
              <div>
                {loading ? (
                  <ListaCarregando linhas={4} />
                ) : pedido ? (
                  <div className="space-y-4">
                    {/* Grid info principal */}
                    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                      {/* Cliente */}
                      <div className="rounded-lg border border-border/70 bg-muted/30 p-3">
                        <div className="mb-1.5 flex items-center gap-1.5">
                          <User strokeWidth={1.6} className="size-3.5 text-muted-foreground" />
                          <p className="text-[11px] text-muted-foreground">Cliente</p>
                        </div>
                        <p className="truncate text-sm font-medium text-foreground">{pedido.nome_cliente}</p>
                      </div>

                      {/* Status */}
                      <div className="rounded-lg border border-border/70 bg-muted/30 p-3">
                        <p className="mb-1.5 text-[11px] text-muted-foreground">Status</p>
                        <span
                          className={cn(
                            'inline-block rounded-md px-2 py-0.5 text-xs font-medium capitalize',
                            getStatusBadge(pedido.status),
                          )}
                        >
                          {pedido.status}
                        </span>
                      </div>

                      {/* Tipo */}
                      <div className="rounded-lg border border-border/70 bg-muted/30 p-3">
                        <div className="mb-1.5 flex items-center gap-1.5">
                          {pedido.tipo_entrega === 'entrega' && (
                            <Truck strokeWidth={1.6} className="size-3.5 text-muted-foreground" />
                          )}
                          {pedido.tipo_entrega === 'retirada' && (
                            <Store strokeWidth={1.6} className="size-3.5 text-muted-foreground" />
                          )}
                          {pedido.tipo_entrega === 'local' && (
                            <UtensilsCrossed strokeWidth={1.6} className="size-3.5 text-muted-foreground" />
                          )}
                          <p className="text-[11px] text-muted-foreground">Tipo</p>
                        </div>
                        <span className="inline-block rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                          {pedido.tipo_entrega === 'entrega'
                            ? 'Entrega'
                            : pedido.tipo_entrega === 'retirada'
                              ? 'Retirada'
                              : 'No Local'}
                        </span>
                        {pedido.comanda && (
                          <p className="mt-1 text-[11px] text-muted-foreground">Comanda {pedido.comanda}</p>
                        )}
                        {pedido.mesa && (
                          <p className="mt-1 text-[11px] text-muted-foreground">Mesa {pedido.mesa}</p>
                        )}
                      </div>

                      {/* Pagamento */}
                      <div className="rounded-lg border border-border/70 bg-muted/30 p-3">
                        <div className="mb-1.5 flex items-center gap-1.5">
                          {pedido.forma_pagamento === 'PIX' && (
                            <QrCode strokeWidth={1.6} className="size-3.5 text-muted-foreground" />
                          )}
                          {pedido.forma_pagamento === 'Dinheiro' && (
                            <Banknote strokeWidth={1.6} className="size-3.5 text-muted-foreground" />
                          )}
                          {pedido.forma_pagamento === 'Dividido' && (
                            <Split strokeWidth={1.6} className="size-3.5 text-muted-foreground" />
                          )}
                          {(pedido.forma_pagamento === 'Cartão' ||
                            pedido.forma_pagamento?.includes('Cartão')) && (
                            <CreditCard strokeWidth={1.6} className="size-3.5 text-muted-foreground" />
                          )}
                          {!pedido.forma_pagamento && (
                            <CreditCard strokeWidth={1.6} className="size-3.5 text-muted-foreground" />
                          )}
                          <p className="text-[11px] text-muted-foreground">Pagamento</p>
                        </div>
                        <p className="text-sm font-medium text-foreground">
                          {pedido.forma_pagamento || 'Não informado'}
                        </p>
                        {resumoFinanceiro.taxaPagamento > 0 && (
                          <div className="mt-1.5 inline-flex items-center gap-1 rounded-md border border-border/70 bg-muted/30 px-2 py-0.5 text-[11px] text-muted-foreground">
                            <BadgePercent strokeWidth={1.6} className="size-3" />
                            Taxa: R$ {resumoFinanceiro.taxaPagamento.toFixed(2)}
                          </div>
                        )}
                        {resumoFinanceiro.taxaServico > 0 && (
                          <div className="mt-1 inline-flex items-center gap-1 rounded-md border border-border/70 bg-muted/30 px-2 py-0.5 text-[11px] text-muted-foreground">
                            <BadgePercent strokeWidth={1.6} className="size-3" />
                            Serviço: R$ {resumoFinanceiro.taxaServico.toFixed(2)}
                          </div>
                        )}
                        {pedido.pagamento_online && (
                          <span
                            className={cn(
                              'mt-1.5 inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium',
                              pedido.pagamento_online_status === 'pago'
                                ? 'bg-foreground/10 text-foreground'
                                : 'bg-muted text-muted-foreground',
                            )}
                          >
                            {pedido.pagamento_online_status === 'pago'
                              ? 'Pagamento concluído'
                              : 'Pgto. online pendente'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Pagamento dividido */}
                    {pedido.forma_pagamento === 'Dividido' && pagamentos.length > 0 && (
                      <div className="rounded-lg border border-border/70 bg-muted/30 p-4">
                        <div className="mb-3 flex items-center gap-2">
                          <Split strokeWidth={1.6} className="size-4 text-muted-foreground" />
                          <p className="text-sm font-medium text-foreground">Pagamento dividido</p>
                        </div>
                        <div className="space-y-1.5">
                          {pagamentos.map((p, idx) => {
                            const formaLabel =
                              {
                                pix: 'PIX',
                                dinheiro: 'Dinheiro',
                                credito: 'Cartão de Crédito',
                                debito: 'Cartão de Débito',
                                vale_refeicao: 'Vale Refeição',
                              }[p.forma_pagamento] || p.forma_pagamento

                            return (
                              <div
                                key={idx}
                                className="flex items-center justify-between rounded-md border border-border/70 bg-card px-3 py-2"
                              >
                                <span className="text-sm text-foreground">{formaLabel}</span>
                                <span className="font-mono text-sm font-medium tabular-nums text-foreground">
                                  R$ {Number(p.valor).toFixed(2)}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Endereço */}
                    {pedido.tipo_entrega === 'entrega' && pedido.endereco && (
                      <div className="rounded-lg border border-border/70 bg-muted/30 p-4">
                        <div className="flex items-start gap-3">
                          <MapPin strokeWidth={1.6} className="mt-0.5 size-4 text-muted-foreground" />
                          <div className="flex-1">
                            <p className="mb-1 text-[11px] font-medium text-muted-foreground">
                              Endereço de entrega
                            </p>
                            <p className="text-sm font-medium text-foreground">{pedido.endereco}</p>
                            {pedido.bairro && (
                              <div className="mt-1.5 flex items-center gap-2">
                                <span className="rounded-md border border-border/70 bg-card px-2 py-0.5 text-xs font-medium text-foreground">
                                  {pedido.bairro}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  Taxa: R$ {resumoFinanceiro.taxaEntrega.toFixed(2)}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Troco */}
                    {pedido.troco_para && pedido.troco_para > 0 && (
                      <div className="rounded-lg border border-border/70 bg-muted/30 p-4">
                        <div className="mb-3 flex items-center gap-2">
                          <Banknote strokeWidth={1.6} className="size-4 text-muted-foreground" />
                          <p className="text-sm font-medium text-foreground">Troco</p>
                        </div>
                        <div className="grid grid-cols-3 gap-3 text-center">
                          <div>
                            <p className="mb-1 text-[11px] text-muted-foreground">Total</p>
                            <p className="font-mono text-sm font-semibold tabular-nums text-foreground">
                              R$ {resumoFinanceiro.total.toFixed(2)}
                            </p>
                          </div>
                          <div>
                            <p className="mb-1 text-[11px] text-muted-foreground">Cliente paga</p>
                            <p className="font-mono text-sm font-semibold tabular-nums text-foreground">
                              R$ {pedido.troco_para.toFixed(2)}
                            </p>
                          </div>
                          <div className="rounded-md border border-border/70 bg-card p-2">
                            <p className="mb-1 text-[11px] text-muted-foreground">Troco</p>
                            <p className="font-mono text-base font-semibold tabular-nums text-foreground">
                              R$ {trocoCalculado?.toFixed(2) || '0.00'}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Observações */}
                    {pedido.observacoes && (
                      <div className="rounded-lg border border-border/70 bg-muted/30 p-3">
                        <p className="mb-1 text-[11px] font-medium text-muted-foreground">Observações</p>
                        <p className="text-sm text-foreground">{pedido.observacoes}</p>
                      </div>
                    )}

                    {/* Data + Garçom */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Clock strokeWidth={1.6} className="size-3.5" />
                        Pedido realizado em{' '}
                        {format(new Date(pedido.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </span>
                      {nomeGarcomPedido && (
                        <span className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-muted/30 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                          <UtensilsCrossed strokeWidth={1.6} className="size-3" />
                          Criado por {nomeGarcomPedido}
                        </span>
                      )}
                    </div>

                    {/* Itens do Pedido */}
                    <div className="rounded-xl border border-border/70 bg-muted/30 p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <Package strokeWidth={1.6} className="size-4 text-muted-foreground" />
                        <h4 className="text-sm font-medium text-foreground">
                          Itens ({itens.length})
                        </h4>
                      </div>
                      <div className="space-y-2">
                        {itens.map((item, index) => (
                          <div
                            key={item.id || index}
                            className="rounded-lg border border-border/70 bg-card p-3"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <p className="text-sm font-medium text-foreground">
                                  {item.quantidade}x {nomeProduto(item)}
                                </p>

                                {item.adicionais_lista && item.adicionais_lista.length > 0 && (
                                  <div className="mt-1.5 space-y-1">
                                    {item.adicionais_lista.map((adicional, idx) => (
                                      <div
                                        key={adicional.id || idx}
                                        className="flex items-center justify-between rounded-md bg-muted/40 px-2 py-1 text-xs"
                                      >
                                        <span className="flex items-center gap-1 text-muted-foreground">
                                          <Plus strokeWidth={1.6} className="size-3" />
                                          {adicional.quantidade && adicional.quantidade > 1
                                            ? `${adicional.quantidade}x `
                                            : ''}
                                          {adicional.nome}
                                        </span>
                                        <span className="font-mono tabular-nums text-muted-foreground">
                                          +R$ {(adicional.preco * (adicional.quantidade || 1)).toFixed(2)}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {item.adicionais && !item.adicionais_lista?.length && (
                                  <p className="mt-1 text-xs text-muted-foreground">+ {item.adicionais}</p>
                                )}

                                {item.nome_garcom && (
                                  <p className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
                                    <UtensilsCrossed strokeWidth={1.6} className="size-3" />
                                    Adicionado por: {item.nome_garcom}
                                  </p>
                                )}

                                {item.observacoes && (
                                  <p className="mt-1.5 rounded-md bg-muted/40 px-2 py-1 text-xs italic text-muted-foreground">
                                    Obs: {item.observacoes}
                                  </p>
                                )}
                              </div>
                              <div className="flex-shrink-0 text-right">
                                <p className="font-mono text-sm font-semibold tabular-nums text-foreground">
                                  R$ {item.subtotal.toFixed(2)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  R$ {item.preco_unitario.toFixed(2)} un.
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Timeline */}
                    {itensTimeline.length > 0 && (
                      <div className="overflow-hidden rounded-xl border border-border/70 bg-card p-3 sm:p-4">
                        <div className="mb-3 flex items-center justify-between gap-2 sm:mb-4">
                          <div className="flex min-w-0 items-center gap-2">
                            <Clock strokeWidth={1.6} className="size-4 shrink-0 text-muted-foreground" />
                            <h4 className="truncate text-sm font-medium text-foreground">Linha do tempo</h4>
                          </div>
                          {modoSelecaoTimeline ? (
                            <Botao variante="fantasma" tamanho="sm" className="h-11 sm:h-9" onClick={cancelarModoSelecao}>
                              Cancelar
                            </Botao>
                          ) : (
                            <Botao
                              variante="contorno"
                              tamanho="sm"
                              className="h-11 sm:h-9"
                              onClick={ativarModoSelecao}
                              title="Selecionar itens para imprimir ou cobrar"
                            >
                              <ListChecks className="size-4" />
                              Selecionar
                            </Botao>
                          )}
                        </div>
                        <div className="space-y-0">
                          {itensTimeline.map((item, index) => {
                            const horario = formatarHorarioItem(item.created_at || pedido.created_at)
                            const dataCompleta = formatarDataHoraItem(item.created_at || pedido.created_at)
                            const ultimo = index === itensTimeline.length - 1
                            const selecionado = itensSelecionadosTimeline.has(item.id)
                            const imprimindoEste = imprimindoItemId === item.id
                            const pagandoEste = pagandoItemId === item.id
                            const statusItem = obterStatusItem(item)
                            const itemTotalmentePago = statusItem.totalmentePago
                            const itemTotalmenteCrediario = statusItem.totalmenteCrediario
                            const itemBloqueado = statusItem.qtdRestante === 0
                            const formaItemPago = statusItem.forma

                            return (
                              <div
                                key={`timeline-${item.id || index}`}
                                className="grid grid-cols-[40px_12px_minmax(0,1fr)] items-start gap-2 sm:grid-cols-[56px_14px_minmax(0,1fr)] sm:gap-3"
                              >
                                <div className="pt-1.5 text-right">
                                  <span className="font-mono text-[11px] font-semibold tabular-nums text-foreground sm:text-xs">
                                    {horario}
                                  </span>
                                </div>
                                <div className={cn('relative', ultimo ? 'pb-0' : 'pb-3 sm:pb-4')}>
                                  <span className="block size-3 rounded-full border-2 border-card bg-foreground/20 shadow-sm sm:size-3.5" />
                                  {!ultimo && (
                                    <span className="absolute left-1/2 top-3 h-[calc(100%-12px)] w-px -translate-x-1/2 bg-border/70 sm:top-3.5" />
                                  )}
                                </div>
                                <div className={cn('min-w-0', ultimo ? 'pb-0' : 'pb-3 sm:pb-4')}>
                                  <div
                                    role={modoSelecaoTimeline ? 'button' : undefined}
                                    tabIndex={modoSelecaoTimeline ? 0 : undefined}
                                    aria-pressed={modoSelecaoTimeline ? selecionado : undefined}
                                    onClick={
                                      modoSelecaoTimeline
                                        ? () => alternarSelecaoItem(item.id)
                                        : undefined
                                    }
                                    onKeyDown={
                                      modoSelecaoTimeline
                                        ? (event) => {
                                            if (event.key !== 'Enter' && event.key !== ' ') return
                                            event.preventDefault()
                                            alternarSelecaoItem(item.id)
                                          }
                                        : undefined
                                    }
                                    className={cn(
                                      'block w-full rounded-lg border bg-muted/30 px-3 py-2 text-left transition-colors',
                                      modoSelecaoTimeline
                                        ? selecionado
                                          ? 'cursor-pointer border-foreground/40 bg-foreground/5 hover:bg-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60'
                                          : 'cursor-pointer border-border/70 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60'
                                        : 'border-border/70',
                                      itemBloqueado && 'opacity-70',
                                    )}
                                  >
                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                                      {modoSelecaoTimeline && (
                                        <span
                                          aria-hidden
                                          className={cn(
                                            'flex size-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors',
                                            selecionado
                                              ? 'border-foreground bg-foreground text-background'
                                              : 'border-border bg-card',
                                          )}
                                        >
                                          {selecionado && <Check strokeWidth={3} className="size-3" />}
                                        </span>
                                      )}
                                      <div className="min-w-0 flex-1">
                                        <p
                                          className={cn(
                                            'truncate text-sm font-medium',
                                            itemTotalmentePago && 'text-muted-foreground line-through decoration-emerald-500/70 decoration-[1.5px]',
                                            itemTotalmenteCrediario && 'text-muted-foreground line-through decoration-red-500/70 decoration-[1.5px]',
                                            !itemBloqueado && 'text-foreground',
                                          )}
                                        >
                                          {item.quantidade}x {nomeProduto(item)}
                                        </p>
                                        <div className="flex flex-wrap items-center gap-1.5">
                                          <p className="truncate text-xs leading-snug text-muted-foreground">
                                            {dataCompleta}
                                            {item.nome_garcom ? ` · ${item.nome_garcom}` : ''}
                                          </p>
                                          {statusItem.qtdPaga > 0 && (
                                            <span className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
                                              <Check strokeWidth={2.4} className="size-2.5" />
                                              Pago {statusItem.qtdPaga}/{statusItem.total}{formaItemPago ? ` · ${FORMA_PAGAMENTO_LABEL[formaItemPago as FormaPagamentoOpcao] || formaItemPago}` : ''}
                                            </span>
                                          )}
                                          {statusItem.qtdCrediario > 0 && (
                                            <span className="inline-flex items-center gap-1 rounded-md border border-red-300 bg-red-50 px-1.5 py-0.5 text-[11px] font-medium text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
                                              <Wallet strokeWidth={2.4} className="size-2.5" />
                                              Fiado {statusItem.qtdCrediario}/{statusItem.total}
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                      <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:shrink-0 sm:justify-end sm:gap-1.5">
                                        <span className="whitespace-nowrap font-mono text-sm font-semibold tabular-nums text-foreground">
                                          R$ {item.subtotal.toFixed(2)}
                                        </span>
                                        {!modoSelecaoTimeline && (
                                          <>
                                            {!itemBloqueado && (
                                              <button
                                                type="button"
                                                aria-label="Cobrar este item (pagamento ou crediário)"
                                                disabled={pagandoEste}
                                                onClick={(event) => {
                                                  event.stopPropagation()
                                                  if (pagandoEste) return
                                                  abrirModalForma([item], 'item_unico')
                                                }}
                                                title={
                                                  statusItem.parcial
                                                    ? `Cobrar ${statusItem.qtdRestante} de ${statusItem.total} restantes`
                                                    : 'Cobrar este item'
                                                }
                                                className={cn(
                                                  'inline-flex size-11 shrink-0 items-center justify-center rounded-md border border-border/70 bg-card text-muted-foreground transition-colors hover:border-emerald-400/70 hover:bg-emerald-50 hover:text-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:cursor-wait disabled:opacity-60 dark:hover:bg-emerald-950/30 dark:hover:text-emerald-300 sm:size-8',
                                                )}
                                              >
                                                {pagandoEste ? (
                                                  <Loader2 strokeWidth={1.6} className="size-4 animate-spin" />
                                                ) : (
                                                  <CircleDollarSign strokeWidth={1.6} className="size-4" />
                                                )}
                                              </button>
                                            )}
                                            {statusItem.parcial && (
                                              <button
                                                type="button"
                                                aria-label="Reverter cobrança deste item"
                                                disabled={revertendoItemId === item.id}
                                                onClick={(event) => {
                                                  event.stopPropagation()
                                                  if (revertendoItemId) return
                                                  abrirModalReversao(item)
                                                }}
                                                title={`Reverter cobrança (${
                                                  statusItem.qtdPaga > 0 ? `${statusItem.qtdPaga} pago(s)` : ''
                                                }${
                                                  statusItem.qtdPaga > 0 && statusItem.qtdCrediario > 0 ? ' + ' : ''
                                                }${
                                                  statusItem.qtdCrediario > 0 ? `${statusItem.qtdCrediario} fiado` : ''
                                                })`}
                                                className={cn(
                                                  'inline-flex size-11 shrink-0 items-center justify-center rounded-md border border-border/70 bg-card text-muted-foreground transition-colors hover:border-amber-400/70 hover:bg-amber-50 hover:text-amber-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:cursor-wait disabled:opacity-60 dark:hover:bg-amber-950/30 dark:hover:text-amber-300 sm:size-8',
                                                )}
                                              >
                                                {revertendoItemId === item.id ? (
                                                  <Loader2 strokeWidth={1.6} className="size-4 animate-spin" />
                                                ) : (
                                                  <RotateCcw strokeWidth={1.6} className="size-4" />
                                                )}
                                              </button>
                                            )}
                                            {!itemBloqueado && (
                                              <button
                                                type="button"
                                                aria-label="Imprimir somente este item na cozinha"
                                                disabled={imprimindoEste}
                                                onClick={(event) => {
                                                  event.stopPropagation()
                                                  if (imprimindoEste) return
                                                  void imprimirItemUnico(item)
                                                }}
                                                title="Imprimir só este item"
                                                className={cn(
                                                  'inline-flex size-11 shrink-0 items-center justify-center rounded-md border border-border/70 bg-card text-muted-foreground transition-colors hover:border-foreground/30 hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:cursor-wait disabled:opacity-60 sm:size-8',
                                                )}
                                              >
                                                {imprimindoEste ? (
                                                  <Loader2 strokeWidth={1.6} className="size-4 animate-spin" />
                                                ) : (
                                                  <Printer strokeWidth={1.6} className="size-4" />
                                                )}
                                              </button>
                                            )}
                                          </>
                                        )}
                                      </div>
                                    </div>
                                    {(ehItemForaCrediario(item) ||
                                      (item.adicionais_lista && item.adicionais_lista.length > 0) ||
                                      item.observacoes) && (
                                      <div className="mt-1.5 space-y-1">
                                        {ehItemForaCrediario(item) && (
                                          <div className="flex flex-wrap items-center gap-1.5">
                                            <span className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                                              <Wallet className="size-3" />
                                              Fora do crediário
                                            </span>
                                            {!modoSelecaoTimeline && (
                                              <button
                                                type="button"
                                                aria-label="Enviar este item ao crediário aberto"
                                                disabled={enviandoItemId === item.id}
                                                onClick={(event) => {
                                                  event.stopPropagation()
                                                  if (enviandoItemId === item.id) return
                                                  void enviarItemAoCrediario(item)
                                                }}
                                                title="Enviar este item ao crediário aberto"
                                                className={cn(
                                                  'inline-flex min-h-[32px] items-center gap-1 rounded-md border border-border/70 bg-card px-2 text-[10px] font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:cursor-wait disabled:opacity-50',
                                                )}
                                              >
                                                <Wallet className="size-3" />
                                                {enviandoItemId === item.id ? 'Enviando...' : 'Crediário'}
                                              </button>
                                            )}
                                          </div>
                                        )}
                                        {item.adicionais_lista && item.adicionais_lista.length > 0 && (
                                          <p className="text-xs leading-snug text-muted-foreground">
                                            +{' '}
                                            {item.adicionais_lista
                                              .map(
                                                (a) =>
                                                  `${a.quantidade && a.quantidade > 1 ? `${a.quantidade}x ` : ''}${a.nome}`,
                                              )
                                              .join(', ')}
                                          </p>
                                        )}
                                        {item.observacoes && (
                                          <p className="text-xs italic leading-snug text-muted-foreground">
                                            Obs: {item.observacoes}
                                          </p>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Resumo */}
                    <div className="rounded-xl border border-border/70 bg-muted/30 p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <Banknote strokeWidth={1.6} className="size-4 text-muted-foreground" />
                        <h4 className="text-sm font-medium text-foreground">Resumo</h4>
                      </div>
                      <div className="space-y-1.5 text-sm">
                        <div className="flex items-center justify-between rounded-md bg-card px-3 py-2">
                          <span className="text-muted-foreground">Subtotal</span>
                          <span className="font-mono font-medium tabular-nums text-foreground">
                            R$ {resumoFinanceiro.subtotal.toFixed(2)}
                          </span>
                        </div>
                        {resumoFinanceiro.taxaEntrega > 0 && (
                          <div className="flex items-center justify-between rounded-md bg-card px-3 py-2">
                            <span className="text-muted-foreground">Taxa de entrega</span>
                            <span className="font-mono font-medium tabular-nums text-foreground">
                              R$ {resumoFinanceiro.taxaEntrega.toFixed(2)}
                            </span>
                          </div>
                        )}
                        {resumoFinanceiro.taxaPagamento > 0 && (
                          <div className="flex items-center justify-between rounded-md bg-card px-3 py-2">
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <BadgePercent strokeWidth={1.6} className="size-3.5" />
                              <span>Taxa do meio de pagamento</span>
                            </div>
                            <span className="font-mono font-medium tabular-nums text-foreground">
                              + R$ {resumoFinanceiro.taxaPagamento.toFixed(2)}
                            </span>
                          </div>
                        )}
                        {resumoFinanceiro.taxaServico > 0 && (
                          <div className="flex items-center justify-between rounded-md bg-card px-3 py-2">
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <BadgePercent strokeWidth={1.6} className="size-3.5" />
                              <span>Taxa de serviço</span>
                            </div>
                            <span className="font-mono font-medium tabular-nums text-foreground">
                              + R$ {resumoFinanceiro.taxaServico.toFixed(2)}
                            </span>
                          </div>
                        )}
                        {(resumoFinanceiro.taxaPagamento > 0 || resumoFinanceiro.taxaServico > 0) && (
                          <p className="rounded-md border border-border/70 bg-card px-3 py-2 text-xs text-muted-foreground">
                            Meio:{' '}
                            <span className="font-medium text-foreground">
                              {resumoFinanceiro.meioPagamento}
                            </span>
                          </p>
                        )}
                        <div className="flex items-center justify-between rounded-lg border border-border/70 bg-card px-4 py-3">
                          <span className="text-sm font-medium text-foreground">Total final</span>
                          <span className="font-mono text-xl font-semibold tabular-nums text-foreground">
                            R$ {resumoFinanceiro.total.toFixed(2)}
                          </span>
                        </div>
                        {valorPagoTotal > 0 && (
                          <div className="flex items-center justify-between rounded-md bg-emerald-50 px-3 py-2 dark:bg-emerald-950/30">
                            <span className="flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-300">
                              <Check strokeWidth={2} className="size-3.5" />
                              Pago
                            </span>
                            <span className="font-mono font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
                              − R$ {valorPagoTotal.toFixed(2)}
                            </span>
                          </div>
                        )}
                        {valorEmCrediario > 0 && (
                          <div className="flex items-center justify-between rounded-md bg-red-50 px-3 py-2 dark:bg-red-950/30">
                            <span className="flex items-center gap-1.5 text-sm font-medium text-red-700 dark:text-red-300">
                              <Wallet strokeWidth={2} className="size-3.5" />
                              Em crediário (fiado)
                            </span>
                            <span className="font-mono font-semibold tabular-nums text-red-700 dark:text-red-300">
                              R$ {valorEmCrediario.toFixed(2)}
                            </span>
                          </div>
                        )}
                        {(valorPagoTotal > 0 || valorEmCrediario > 0) && (
                          <div className="flex items-center justify-between rounded-md border border-border/70 bg-card px-3 py-2">
                            <span className="text-sm font-medium text-foreground">Saldo devedor</span>
                            <span className="font-mono font-semibold tabular-nums text-foreground">
                              R$ {Math.max(0, resumoFinanceiro.total - valorPagoTotal).toFixed(2)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <ListaVazia
                    icone={<Package />}
                    titulo="Pedido não encontrado"
                    descricao="Ele pode ter sido apagado. Feche e atualize a lista."
                  />
                )}
              </div>
      </Gaveta>

          <ModalFormaPagamentoItens
            aberto={Boolean(modalFormaAberto)}
            itens={(modalFormaAberto?.itens || []).map((item): ItemPagamento => ({
              id: item.id,
              nome: item.nome_item || 'Item',
              quantidade: item.quantidade,
              precoUnitario: item.preco_unitario,
              subtotal: item.subtotal,
              observacoes: item.observacoes || null,
              criadoEm: item.created_at || null,
            }))}
            quantidadesPorItem={modalFormaAberto?.quantidadesPorItem || {}}
            quantidadesDisponiveis={(modalFormaAberto?.itens || []).reduce<Record<string, number>>((acc, item) => {
              acc[item.id] = obterStatusItem(item).qtdRestante
              return acc
            }, {})}
            processando={pagandoItemId !== null || pagandoSelecionados}
            onFechar={fecharModalForma}
            onQuantidadeChange={(itemId, quantidade) => {
              const maxQuantidade = obterStatusItem(
                modalFormaAberto?.itens.find((item) => item.id === itemId) || modalFormaAberto!.itens[0],
              ).qtdRestante
              ajustarQuantidadePagamento(itemId, maxQuantidade, quantidade)
            }}
            onSelecionarForma={(forma, itensPagos) => {
              if (!modalFormaAberto) return
              void registrarPagamentoParcial(modalFormaAberto.itens, forma, modalFormaAberto.origem, itensPagos)
            }}
          />

          <Gaveta
            aberto={Boolean(modalReversaoAberto)}
            aoFechar={fecharModalReversao}
            bloqueada={Boolean(reversao?.ocupado)}
            titulo="Reverter cobrança"
            descricao={
              reversao
                ? `${nomeProduto(reversao.item)} · ${reversao.quantidade}/${reversao.maxOrigem} ${
                    reversao.quantidade === 1 ? 'unidade' : 'unidades'
                  } · R$ ${reversao.valorRevertido.toFixed(2)}`
                : undefined
            }
            rodape={
              reversao ? (
                <>
                  <Botao variante="contorno" onClick={fecharModalReversao} disabled={reversao.ocupado}>
                    Cancelar
                  </Botao>
                  <Botao
                    carregando={reversao.ocupado}
                    disabled={reversao.quantidade <= 0 || reversao.maxOrigem <= 0}
                    onClick={() => void reverterCobrancaItem(reversao.item, reversao.origem, reversao.quantidade)}
                  >
                    {!reversao.ocupado && <RotateCcw className="size-4" />}
                    Reverter
                  </Botao>
                </>
              ) : undefined
            }
          >
            {reversao && (
              <div className="space-y-4">
                {reversao.maxPagamento > 0 && reversao.maxCrediario > 0 && (
                  <Campo rotulo="O que reverter">
                    <Segmentos
                      rotuloAcessivel="Origem da cobrança"
                      valor={reversao.origem}
                      aoMudar={selecionarOrigemReversao}
                      opcoes={[
                        { valor: 'pagamento', rotulo: `Pago · ${reversao.maxPagamento}` },
                        { valor: 'crediario', rotulo: `Crediário · ${reversao.maxCrediario}` },
                      ]}
                    />
                  </Campo>
                )}
                <Campo
                  rotulo="Quantidade a reverter"
                  ajuda={`${reversao.origem === 'pagamento' ? 'Pagamento recebido' : 'Crediário aberto'} · máximo ${reversao.maxOrigem}`}
                >
                  <div>
                    <Contador
                      valor={reversao.quantidade}
                      aoMudar={ajustarQuantidadeReversao}
                      minimo={1}
                      maximo={Math.max(1, reversao.maxOrigem)}
                      rotuloAcessivel="quantidade a reverter"
                    />
                  </div>
                </Campo>
              </div>
            )}
          </Gaveta>
    </>
  )
}
