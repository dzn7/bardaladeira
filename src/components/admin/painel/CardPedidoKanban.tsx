'use client'

import { memo, useCallback, useMemo } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  ArrowRight,
  BadgeCheck,
  Clock,
  Edit2,
  GripVertical,
  Loader2,
  Printer,
  Store,
  Trash2,
  Truck,
  UtensilsCrossed,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { obterNumeroPedidoExibicao } from '@/lib/pedidos/numero-diario'
import { pedidoEstaEmCrediarioAberto, pedidoTemPagamentoPendente } from '@/lib/pedidos-utils'
import { cn } from '@/lib/utils'
import { MenuAcoes, type MenuAcaoItem } from '@/components/ui/menu-acoes'
import { PEDIDO_DEMO_ID } from '@/features/onboarding'
import { BarraPagamentoParcial } from '@/components/admin/BarraPagamentoParcial'

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
  valor_em_crediario?: number
  itens_pagos_count?: number
}

type StatusPedido =
  | 'pendente'
  | 'confirmado'
  | 'preparando'
  | 'pronto'
  | 'saiu_para_entrega'
  | 'entregue'
  | 'cancelado'

type ChaveColuna = 'novos' | 'emPreparo' | 'prontos'

type MetaDestino = {
  badge: string
  titulo: string
  contexto: string
  icone: LucideIcon
  borda: string
}

interface CardPedidoKanbanProps {
  pedido: Pedido
  chaveColuna: ChaveColuna
  onAbrirDetalhes: (pedido: Pedido) => void
  onAvancarStatus: (pedido: Pedido) => void
  onMoverParaColuna?: (pedido: Pedido, destino: ChaveColuna) => void
  onEditar?: (pedido: Pedido) => void
  onApagar?: (pedido: Pedido) => void
  onImprimirCozinha?: (pedido: Pedido) => void
  onConfirmarPagamento?: (pedido: Pedido) => void
  isDragging?: boolean
  onDragStart?: (pedidoId: string) => void
  onTouchStart?: (e: React.TouchEvent, pedidoId: string) => void
  acoesEmAndamento?: Partial<Record<'pagamento' | 'impressao' | 'status', boolean>>
}

const formatarMoeda = (valor: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)

const formatarTempoRelativo = (data: string) => {
  try {
    return formatDistanceToNow(new Date(data), { addSuffix: true, locale: ptBR })
  } catch {
    return ''
  }
}

const obterIdentificadorPedido = (id: string) => {
  if (!id) return '--'
  return id.slice(0, 8).toUpperCase()
}

const obterMetaDestino = (pedido: Pedido): MetaDestino => {
  const tipoEntrega = (pedido.tipo_entrega || '').toLowerCase()
  const endereco = pedido.referencia?.trim() || pedido.endereco?.trim() || pedido.bairro?.trim()
  const mesa = pedido.mesa
  const comanda = pedido.comanda

  if (tipoEntrega.includes('entrega') || tipoEntrega === 'delivery') {
    return {
      badge: 'Entrega',
      titulo: 'Entrega',
      contexto: endereco || 'Sem endereço',
      icone: Truck,
      borda: 'border-l-sky-500',
    }
  }

  if (tipoEntrega.includes('mesa') || tipoEntrega.includes('local') || mesa || comanda) {
    const ehParceiro = pedido.mesa_tipo === 'local_externo'
    const rotuloLocal = ehParceiro
      ? pedido.mesa_identificador || (mesa ? `Local ${mesa}` : 'Parceiro')
      : null
    const titulo = comanda
      ? `Comanda ${comanda}`
      : rotuloLocal
        ? rotuloLocal
        : mesa
          ? `Mesa ${mesa}`
          : 'Salão'
    return {
      badge: ehParceiro ? 'Parceiro' : 'Local',
      titulo,
      contexto: titulo,
      icone: UtensilsCrossed,
      borda: 'border-l-amber-500',
    }
  }

  return {
    badge: 'Retirada',
    titulo: 'Retirada',
    contexto: 'Balcão',
    icone: Store,
    borda: 'border-l-violet-500',
  }
}

const normalizar = (valor?: string | null) => String(valor || '').trim().toLowerCase()

const COLUNAS_DESTINO: { chave: ChaveColuna; label: string }[] = [
  { chave: 'novos', label: 'Em análise' },
  { chave: 'emPreparo', label: 'Em produção' },
  { chave: 'prontos', label: 'Prontos' },
]

function CardPedidoKanbanComponent({
  pedido,
  chaveColuna,
  onAbrirDetalhes,
  onAvancarStatus,
  onMoverParaColuna,
  onEditar,
  onApagar,
  onImprimirCozinha,
  onConfirmarPagamento,
  isDragging,
  onDragStart,
  onTouchStart,
  acoesEmAndamento,
}: CardPedidoKanbanProps) {
  const nomeCliente = pedido.nome_cliente || 'Cliente'
  const itens = pedido.itens || []
  const total = pedido.total || 0
  const tipoEntrega = pedido.tipo_entrega || 'retirada'
  const numeroPedido = obterNumeroPedidoExibicao(pedido)
  const metaDestino = obterMetaDestino(pedido)
  const IconeDestino = metaDestino.icone

  const ehDelivery = normalizar(tipoEntrega).includes('entrega') || normalizar(tipoEntrega) === 'delivery'
  const pagamentoOnlinePendente = pedidoTemPagamentoPendente(pedido)
  const pagamentoOnlinePago = Boolean(pedido.pagamento_online) && !pagamentoOnlinePendente
  const confirmandoPagamento = Boolean(acoesEmAndamento?.pagamento)
  const imprimindoPedido = Boolean(acoesEmAndamento?.impressao)
  const atualizandoStatus = Boolean(acoesEmAndamento?.status)
  const emCrediario = pedidoEstaEmCrediarioAberto(pedido)

  const obterProximoStatus = (): StatusPedido | null => {
    switch (pedido.status) {
      case 'pendente':
      case 'confirmado':
        return 'preparando'
      case 'preparando':
        return ehDelivery ? 'saiu_para_entrega' : 'pronto'
      case 'pronto':
      case 'saiu_para_entrega':
        return 'entregue'
      default:
        return null
    }
  }

  const obterTextoAcao = () => {
    switch (pedido.status) {
      case 'pendente':
      case 'confirmado':
        return 'Iniciar preparo'
      case 'preparando':
        return ehDelivery ? 'Saiu p/ entrega' : 'Marcar pronto'
      case 'pronto':
        return 'Concluir'
      case 'saiu_para_entrega':
        return 'Confirmar entrega'
      default:
        return null
    }
  }

  const proximoStatus = obterProximoStatus()
  const textoAcao = obterTextoAcao()
  const formaPagamentoLabel = emCrediario
    ? 'Crediário'
    : normalizar(pedido.forma_pagamento).includes('credi')
      ? 'Concluído'
      : pedido.forma_pagamento || 'Sem pag.'

  const resumoItens =
    itens.length > 0
      ? itens.map((i) => `${i.quantidade}x ${i.nome_item}`).join(', ')
      : null

  const handleNativeDragStart = useCallback(
    (e: React.DragEvent) => {
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', pedido.id)
      onDragStart?.(pedido.id)
    },
    [pedido.id, onDragStart],
  )

  const handleTouchStartLocal = useCallback(
    (e: React.TouchEvent) => {
      onTouchStart?.(e, pedido.id)
    },
    [pedido.id, onTouchStart],
  )

  const itensMenu = useMemo(() => {
    const itensAcao: MenuAcaoItem[] = []

    if (onConfirmarPagamento && pagamentoOnlinePendente) {
      itensAcao.push({
        key: 'pagamento',
        label: confirmandoPagamento ? 'Confirmando…' : 'Confirmar pagamento',
        icon: <BadgeCheck className="size-4" strokeWidth={1.6} />,
        onSelect: () => onConfirmarPagamento(pedido),
        disabled: confirmandoPagamento,
        variant: 'success',
      })
    }

    if (onImprimirCozinha) {
      itensAcao.push({
        key: 'imprimir',
        label: imprimindoPedido ? 'Imprimindo…' : 'Imprimir',
        icon: imprimindoPedido ? (
          <Loader2 className="size-4 animate-spin" strokeWidth={1.6} />
        ) : (
          <Printer className="size-4" strokeWidth={1.6} />
        ),
        onSelect: () => onImprimirCozinha(pedido),
        disabled: imprimindoPedido,
      })
    }

    if (onEditar) {
      itensAcao.push({
        key: 'editar',
        label: 'Editar',
        icon: <Edit2 className="size-4" strokeWidth={1.6} />,
        onSelect: () => onEditar(pedido),
      })
    }

    if (onMoverParaColuna) {
      COLUNAS_DESTINO.filter((c) => c.chave !== chaveColuna).forEach((coluna, index) => {
        itensAcao.push({
          key: `mover-${coluna.chave}`,
          label: `Mover → ${coluna.label}`,
          onSelect: () => onMoverParaColuna(pedido, coluna.chave),
          separatorBefore: index === 0,
        })
      })
    }

    if (onApagar) {
      itensAcao.push({
        key: 'apagar',
        label: 'Excluir',
        icon: <Trash2 className="size-4" strokeWidth={1.6} />,
        onSelect: () => onApagar(pedido),
        variant: 'destructive',
        separatorBefore: true,
      })
    }

    return itensAcao
  }, [
    chaveColuna,
    confirmandoPagamento,
    imprimindoPedido,
    onApagar,
    onConfirmarPagamento,
    onEditar,
    onImprimirCozinha,
    onMoverParaColuna,
    pagamentoOnlinePendente,
    pedido,
  ])

  const ehPedidoDemo = pedido.id === PEDIDO_DEMO_ID

  return (
    <div
      role="button"
      tabIndex={0}
      data-onboarding={ehPedidoDemo ? 'painel-card' : undefined}
      onClick={() => onAbrirDetalhes(pedido)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onAbrirDetalhes(pedido)
        }
      }}
      className={cn(
        'group relative flex flex-col gap-2 rounded-lg border border-border/70 border-l-[3px] bg-card p-2.5 text-left shadow-sm transition-shadow dark:bg-[#161717] md:gap-2.5 md:p-3',
        metaDestino.borda,
        isDragging
          ? 'opacity-60 shadow-md'
          : 'cursor-pointer hover:border-foreground/20 hover:shadow-md',
      )}
      aria-label={`Pedido ${numeroPedido ?? obterIdentificadorPedido(pedido.id)} de ${nomeCliente}`}
    >
      <div className="flex items-start gap-1.5">
        <button
          type="button"
          draggable
          data-onboarding={ehPedidoDemo ? 'painel-arrastar' : undefined}
          onClick={(event) => event.stopPropagation()}
          onDragStart={handleNativeDragStart}
          onTouchStart={handleTouchStartLocal}
          className="mt-0.5 flex size-7 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-foreground/45 transition-colors hover:bg-accent hover:text-foreground active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 md:opacity-0 md:group-hover:opacity-100"
          aria-label="Arrastar pedido"
        >
          <GripVertical strokeWidth={1.6} className="size-3.5" />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-sm font-semibold tabular-nums tracking-tight text-foreground md:text-[15px]">
              #{numeroPedido ?? obterIdentificadorPedido(pedido.id)}
            </span>
            {emCrediario && (
              <span className="rounded bg-red-600 px-1.5 py-px text-[10px] font-semibold text-white">
                Fiado
              </span>
            )}
            {pagamentoOnlinePendente && (
              <span className="rounded bg-amber-500/15 px-1.5 py-px text-[10px] font-semibold text-amber-800 dark:text-amber-200">
                PIX
              </span>
            )}
            {pagamentoOnlinePago && (
              <span className="rounded bg-emerald-500/15 px-1.5 py-px text-[10px] font-semibold text-emerald-800 dark:text-emerald-200">
                Pago
              </span>
            )}
          </div>
          <h4 className="mt-0.5 truncate text-[13px] font-medium leading-snug text-foreground md:text-sm">
            {nomeCliente}
          </h4>
        </div>

        <div onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
          <span data-onboarding={ehPedidoDemo ? 'painel-menu' : undefined}>
            <MenuAcoes items={itensMenu} ariaLabel="Ações do pedido" triggerClassName="h-7 w-7" />
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 pl-0.5 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1 rounded-md bg-muted/80 px-1.5 py-0.5 font-medium text-foreground/80">
          <IconeDestino strokeWidth={1.6} className="size-3" />
          <span className="max-w-[140px] truncate">{metaDestino.titulo}</span>
        </span>
        <span className="inline-flex items-center gap-1">
          <Clock strokeWidth={1.6} className="size-3" />
          {formatarTempoRelativo(pedido.created_at)}
        </span>
      </div>

      {metaDestino.contexto !== metaDestino.titulo && (
        <p className="line-clamp-1 pl-0.5 text-[11px] leading-snug text-muted-foreground">
          {metaDestino.contexto}
        </p>
      )}

      {pedido.observacoes && (
        <p className="line-clamp-2 rounded-md bg-muted/50 px-2 py-1 text-[11px] italic leading-snug text-muted-foreground">
          {pedido.observacoes}
        </p>
      )}

      {resumoItens && (
        <p className="line-clamp-2 pl-0.5 text-[11px] leading-relaxed text-muted-foreground">{resumoItens}</p>
      )}

      <BarraPagamentoParcial
        total={total}
        valorPago={pedido.valor_pago_parcial ?? 0}
        valorEmCrediario={pedido.valor_em_crediario ?? 0}
      />

      <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-2">
        <span className="truncate rounded-md bg-muted/70 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          {formaPagamentoLabel}
        </span>
        <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-foreground">
          {formatarMoeda(total)}
        </span>
      </div>

      {textoAcao && proximoStatus && (
        <button
          type="button"
          disabled={atualizandoStatus}
          data-onboarding={ehPedidoDemo ? 'painel-avancar' : undefined}
          className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md border border-border/70 bg-muted/60 text-xs font-semibold text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:pointer-events-none disabled:opacity-70 md:h-10 md:text-[13px]"
          onClick={(event) => {
            event.stopPropagation()
            onAvancarStatus(pedido)
          }}
          aria-label={textoAcao}
        >
          {atualizandoStatus ? (
            <Loader2 strokeWidth={1.8} className="size-3.5 animate-spin" />
          ) : null}
          {atualizandoStatus ? 'Atualizando…' : textoAcao}
          {!atualizandoStatus && <ArrowRight strokeWidth={1.6} className="size-3.5" />}
        </button>
      )}
    </div>
  )
}

export const CardPedidoKanban = memo(CardPedidoKanbanComponent)
