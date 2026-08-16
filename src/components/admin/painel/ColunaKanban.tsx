'use client'

import { memo, useRef, useCallback, useEffect } from 'react'
import { Check, Inbox, Palette } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import {
  estilosDaColuna,
  hexParaRgba,
  PALETA_CORES_PAINEL,
  type ChaveColunaPainel,
} from '@/lib/cores-painel'
import { CardPedidoKanban } from './CardPedidoKanban'

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

type ChaveColuna = ChaveColunaPainel
type AcaoKanban = 'pagamento' | 'impressao' | 'status'
type AcoesPedidoKanban = Partial<Record<AcaoKanban, boolean>>

interface ConfiguracaoColuna {
  titulo: string
  status: string[]
  marcador: string
  mensagemVazia: string
  descricaoVazia: string
  corBadge?: string
}

interface ColunaKanbanProps {
  chave: ChaveColuna
  config: ConfiguracaoColuna
  /** Cor da coluna em hex; tinge fundo, faixa do topo e cabeçalho. */
  cor: string
  onTrocarCor?: (chave: ChaveColuna, cor: string) => void
  pedidos: Pedido[]
  onAbrirDetalhes: (pedido: Pedido) => void
  onAvancarStatus: (pedido: Pedido) => void
  onMoverParaColuna?: (pedido: Pedido, destino: ChaveColuna) => void
  onEditar?: (pedido: Pedido) => void
  onApagar?: (pedido: Pedido) => void
  onImprimirCozinha?: (pedido: Pedido) => void
  onConfirmarPagamento?: (pedido: Pedido) => void
  acoesPedido?: Record<string, AcoesPedidoKanban>
  pedidoArrastando: string | null
  colunaHover: ChaveColuna | null
  onDragStart: (pedidoId: string) => void
  onDragEnd: () => void
  onDragOverColuna: (chave: ChaveColuna) => void
  onDragLeaveColuna: () => void
}

function ColunaKanbanComponent({
  chave,
  config,
  cor,
  onTrocarCor,
  pedidos,
  onAbrirDetalhes,
  onAvancarStatus,
  onMoverParaColuna,
  onEditar,
  onApagar,
  onImprimirCozinha,
  onConfirmarPagamento,
  acoesPedido,
  pedidoArrastando,
  colunaHover,
  onDragStart,
  onDragEnd,
  onDragOverColuna,
  onDragLeaveColuna,
}: ColunaKanbanProps) {
  const colunaRef = useRef<HTMLDivElement>(null)
  const estilos = estilosDaColuna(cor)
  const ehAlvoDrop = colunaHover === chave && pedidoArrastando !== null
  const pedidoEstaNaColuna = pedidoArrastando ? pedidos.some((p) => p.id === pedidoArrastando) : false

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      if (!pedidoEstaNaColuna) {
        onDragOverColuna(chave)
      }
    },
    [chave, onDragOverColuna, pedidoEstaNaColuna],
  )

  const handleDragLeave = useCallback(
    (e: React.DragEvent) => {
      const rect = colunaRef.current?.getBoundingClientRect()
      if (rect) {
        const { clientX, clientY } = e
        if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
          onDragLeaveColuna()
        }
      }
    },
    [onDragLeaveColuna],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      onDragEnd()
    },
    [onDragEnd],
  )

  const touchInfoRef = useRef<{
    pedidoId: string
    startX: number
    startY: number
    ghostEl: HTMLDivElement | null
    ativo: boolean
  } | null>(null)

  const finalizarTouchDrag = useCallback(
    (encerrarArraste: boolean) => {
      const info = touchInfoRef.current
      if (!info) return

      const estavaAtivo = info.ativo
      if (info.ghostEl) {
        info.ghostEl.remove()
      }

      touchInfoRef.current = null

      if (encerrarArraste && estavaAtivo) {
        onDragEnd()
      }
    },
    [onDragEnd],
  )

  const handleTouchStart = useCallback(
    (e: React.TouchEvent, pedidoId: string) => {
      finalizarTouchDrag(false)
      const touch = e.touches[0]
      touchInfoRef.current = {
        pedidoId,
        startX: touch.clientX,
        startY: touch.clientY,
        ghostEl: null,
        ativo: false,
      }
    },
    [finalizarTouchDrag],
  )

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!touchInfoRef.current) return
      const touch = e.touches[0]
      const info = touchInfoRef.current
      const dx = Math.abs(touch.clientX - info.startX)
      const dy = Math.abs(touch.clientY - info.startY)

      if (!info.ativo && (dx > 15 || dy > 15)) {
        info.ativo = true
        onDragStart(info.pedidoId)

        const ghost = document.createElement('div')
        ghost.className =
          'fixed pointer-events-none z-[9999] rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-md'
        ghost.textContent = 'Movendo pedido'
        ghost.style.transform = 'translate(-50%, -50%)'
        document.body.appendChild(ghost)
        info.ghostEl = ghost
      }

      if (info.ativo) {
        e.preventDefault()

        if (info.ghostEl) {
          info.ghostEl.style.left = `${touch.clientX}px`
          info.ghostEl.style.top = `${touch.clientY}px`
        }

        const colunas = document.querySelectorAll('[data-coluna-kanban]')
        let sobreColuna: ChaveColuna | null = null
        colunas.forEach((col) => {
          const rect = col.getBoundingClientRect()
          if (
            touch.clientX >= rect.left &&
            touch.clientX <= rect.right &&
            touch.clientY >= rect.top &&
            touch.clientY <= rect.bottom
          ) {
            sobreColuna = col.getAttribute('data-coluna-kanban') as ChaveColuna
          }
        })

        if (sobreColuna) {
          onDragOverColuna(sobreColuna)
        } else {
          onDragLeaveColuna()
        }
      }
    },
    [onDragStart, onDragOverColuna, onDragLeaveColuna],
  )

  const handleTouchEnd = useCallback(() => {
    finalizarTouchDrag(true)
  }, [finalizarTouchDrag])

  useEffect(() => {
    const handleTouchGlobalEnd = () => {
      finalizarTouchDrag(true)
    }

    window.addEventListener('touchend', handleTouchGlobalEnd)
    window.addEventListener('touchcancel', handleTouchGlobalEnd)

    return () => {
      window.removeEventListener('touchend', handleTouchGlobalEnd)
      window.removeEventListener('touchcancel', handleTouchGlobalEnd)
      finalizarTouchDrag(false)
    }
  }, [finalizarTouchDrag])

  return (
    <div
      ref={colunaRef}
      id={`coluna-kanban-${chave}`}
      data-coluna-kanban={chave}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn(
        'group/coluna flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-border/70 shadow-sm transition-colors duration-200',
        'w-[min(88vw,320px)] shrink-0 snap-center',
        'md:w-auto md:min-w-0 md:flex-1 md:snap-none',
        ehAlvoDrop && !pedidoEstaNaColuna && 'border-primary/40',
      )}
      style={{
        backgroundColor: ehAlvoDrop && !pedidoEstaNaColuna
          ? hexParaRgba(cor, 0.16)
          : estilos.fundoColuna,
        borderTop: `3px solid ${estilos.bordaTopo}`,
      }}
    >
      <div className="flex shrink-0 items-center justify-between gap-2 px-3 py-2.5 md:px-4 md:py-3">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="inline-flex max-w-full items-center truncate rounded-md px-2 py-1 text-[11px] font-semibold uppercase tracking-wide md:text-xs"
            style={{ backgroundColor: estilos.fundoTitulo, color: estilos.textoTitulo }}
          >
            {config.titulo}
          </span>
          <span
            className="inline-flex h-6 min-w-6 items-center justify-center rounded-full border px-1.5 text-[11px] font-semibold tabular-nums text-foreground"
            style={{
              backgroundColor: estilos.fundoContador,
              borderColor: estilos.bordaContador,
            }}
          >
            {pedidos.length}
          </span>
        </div>

        {onTrocarCor ? (
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label={`Trocar a cor da coluna ${config.titulo}`}
                className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-opacity hover:bg-black/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 dark:hover:bg-white/10 md:opacity-0 md:group-hover/coluna:opacity-100 md:focus-visible:opacity-100"
              >
                <Palette className="size-4" strokeWidth={1.8} />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-auto p-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Cor da coluna</p>
              <div className="grid grid-cols-5 gap-2">
                {PALETA_CORES_PAINEL.map((opcao) => {
                  const selecionada = opcao.toUpperCase() === cor.toUpperCase()
                  return (
                    <button
                      key={opcao}
                      type="button"
                      onClick={() => onTrocarCor(chave, opcao)}
                      className={cn(
                        'flex size-7 items-center justify-center rounded-md transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
                        selecionada && 'ring-2 ring-foreground/40 ring-offset-2 ring-offset-popover',
                      )}
                      style={{ backgroundColor: opcao }}
                      aria-label={`Usar a cor ${opcao}`}
                      aria-pressed={selecionada}
                    >
                      {selecionada ? <Check className="size-3.5 text-white" strokeWidth={3} /> : null}
                    </button>
                  )
                })}
              </div>
            </PopoverContent>
          </Popover>
        ) : (
          <span className={cn('size-2 shrink-0 rounded-full', config.marcador)} aria-hidden />
        )}
      </div>

      <div
        className="min-h-0 flex-1 space-y-2.5 overflow-y-auto overflow-x-hidden px-2.5 pb-3 pt-0.5 [scrollbar-width:thin] md:space-y-3 md:px-3"
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      >
        {pedidos.length === 0 ? (
          <div
            className={cn(
              'flex h-full min-h-[160px] flex-col items-center justify-center rounded-lg border border-dashed p-5 text-center transition-colors',
              ehAlvoDrop && !pedidoEstaNaColuna
                ? 'border-primary/40 bg-primary/5'
                : 'border-border/60',
            )}
          >
            <div className="mb-2.5 flex size-9 items-center justify-center rounded-lg border border-border/70 bg-card">
              <Inbox strokeWidth={1.6} className="size-4 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">{config.mensagemVazia}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{config.descricaoVazia}</p>
          </div>
        ) : (
          pedidos.map((pedido) => (
            <CardPedidoKanban
              key={pedido.id}
              pedido={pedido}
              chaveColuna={chave}
              onAbrirDetalhes={onAbrirDetalhes}
              onAvancarStatus={onAvancarStatus}
              onMoverParaColuna={onMoverParaColuna}
              onEditar={onEditar}
              onApagar={onApagar}
              onImprimirCozinha={onImprimirCozinha}
              onConfirmarPagamento={onConfirmarPagamento}
              acoesEmAndamento={acoesPedido?.[pedido.id]}
              isDragging={pedidoArrastando === pedido.id}
              onDragStart={onDragStart}
              onTouchStart={handleTouchStart}
            />
          ))
        )}
      </div>
    </div>
  )
}

export const ColunaKanban = memo(ColunaKanbanComponent)
