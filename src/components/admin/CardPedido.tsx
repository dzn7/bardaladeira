'use client'

import { motion } from 'framer-motion'
import {
  BadgeCheck,
  CheckCircle2,
  CheckSquare,
  Edit2,
  Eye,
  FileText,
  Armchair,
  Loader2,
  MessageCircle,
  Package,
  Printer,
  Square,
  Trash2,
  Truck,
  Wallet,
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import {
  pedidoEstaEmCrediarioAberto,
  pedidoEstaEncerrado,
  pedidoTemPagamentoPendente,
} from '@/lib/pedidos-utils'
import { BarraPagamentoParcial } from '@/components/admin/BarraPagamentoParcial'

const acaoClass =
  'flex min-h-10 min-w-10 items-center justify-center gap-1.5 rounded-md border border-border/80 bg-secondary px-2.5 py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:pointer-events-none disabled:opacity-60 dark:bg-secondary/90 dark:hover:bg-accent'

const acaoPrimariaClass =
  'flex min-h-12 items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-semibold shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:pointer-events-none disabled:opacity-70'

const acaoPagamentoClass =
  'border-emerald-700 bg-emerald-600 text-white ring-1 ring-emerald-700/20 hover:bg-emerald-700 focus-visible:ring-emerald-500/60 dark:border-emerald-300 dark:bg-emerald-400 dark:text-emerald-950 dark:hover:bg-emerald-300 dark:focus-visible:ring-emerald-300/70'

const acaoImpressaoClass =
  'border-primary bg-primary text-primary-foreground ring-1 ring-primary/20 hover:bg-primary/90 focus-visible:ring-ring/60 dark:border-amber-300 dark:bg-amber-300 dark:text-zinc-950 dark:hover:bg-amber-200'

export type AdicionalItem = {
  id: string
  nome: string
  preco: number
  quantidade?: number
}

export type ItemPedido = {
  id: string
  nome_item?: string
  quantidade: number
  preco_unitario: number
  subtotal: number
  created_at?: string
  observacoes?: string
  item_adicionais?: AdicionalItem[]
}

export type Pedido = {
  id: string
  numero_pedido?: number | string | null
  numero_pedido_diario?: number | null
  nome_cliente: string
  telefone?: string
  endereco?: string
  bairro?: string
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
  troco_para?: number | null
  observacoes?: string
  mesa?: number | null
  mesa_id?: string | null
  mesa_identificador?: string | null
  mesa_tipo?: string | null
  mesa_status?: string | null
  mesa_pedido_id?: string | null
  mesa_liberar_em?: string | null
  mesa_tempo_limite_minutos?: number | null
  comanda?: number | null
  itens?: ItemPedido[]
  garcom_id?: string | null
  nome_garcom?: string | null
  crediario_status?: string | null
  crediario_saldo?: number | null
  valor_pago_parcial?: number
  valor_em_crediario?: number
  itens_pagos_count?: number
}

type CardPedidoProps = {
  pedido: Pedido
  modoSelecao?: boolean
  estaSelecionado?: boolean
  isNovo?: boolean
  valoresOcultos?: boolean
  index?: number
  onToggleSelecao?: (id: string) => void
  onVerDetalhes?: (pedido: Pedido) => void
  onEditar?: (pedido: Pedido) => void
  onConfirmarPagamento?: (pedido: Pedido) => void
  onConcluirPedido?: (pedido: Pedido) => void
  onWhatsApp?: (pedido: Pedido) => void
  onImprimirCozinha?: (pedido: Pedido) => void
  onGerarPDF?: (pedido: Pedido) => void
  onExcluir?: (pedido: Pedido) => void
  onEnviarCrediario?: (pedido: Pedido) => void
  onRestaurarMesa?: (pedido: Pedido) => void
  rotuloResponsavel?: string
  acoesEmAndamento?: Partial<Record<'pagamento' | 'impressao' | 'concluir' | 'restaurarMesa', boolean>>
}

const normalizar = (v?: string | null) => (v || '').toLowerCase().trim()

export function obterBadgeStatus(pedido: Pedido): { label: string; className: string } {
  if (pedidoEstaEmCrediarioAberto(pedido)) {
    return {
      label: 'Crediário',
      className: 'border-destructive/40 bg-destructive text-destructive-foreground',
    }
  }
  switch (normalizar(pedido.status)) {
    case 'pendente':
    case 'aguardando_pagamento':
      return {
        label: normalizar(pedido.status) === 'aguardando_pagamento' ? 'Aguardando' : 'Pendente',
        className:
          'border-amber-500/35 bg-amber-500/10 text-amber-800 dark:text-amber-300',
      }
    case 'confirmado':
      return {
        label: 'Confirmado',
        className: 'border-emerald-500/35 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300',
      }
    case 'em preparo':
    case 'preparando':
      return {
        label: 'Preparando',
        className: 'border-primary/35 bg-primary/10 text-primary',
      }
    case 'pronto':
      return {
        label: 'Pronto',
        className: 'border-border bg-muted text-foreground',
      }
    case 'saiu_para_entrega':
      return {
        label: 'Em entrega',
        className: 'border-violet-500/35 bg-violet-500/10 text-violet-800 dark:text-violet-300',
      }
    case 'entregue':
      return {
        label: 'Entregue',
        className: 'border-border/70 bg-muted/60 text-muted-foreground',
      }
    case 'cancelado':
      return {
        label: 'Cancelado',
        className: 'border-destructive/35 bg-destructive/10 text-destructive',
      }
    default:
      return {
        label: pedido.status || 'Sem status',
        className: 'border-border/70 bg-muted text-muted-foreground',
      }
  }
}

const obterCanal = (pedido: Pedido) => {
  if (pedido.tipo_entrega === 'entrega') {
    return {
      label: pedido.bairro ? `Entrega · ${pedido.bairro}` : 'Entrega',
      Icone: Truck,
    }
  }
  if (pedido.tipo_entrega === 'local') {
    if (pedido.comanda) {
      return { label: `Comanda ${pedido.comanda}`, Icone: Armchair }
    }
    if (pedido.mesa_tipo === 'local_externo') {
      return {
        label: pedido.mesa_identificador || `Local ${pedido.mesa ?? ''}`.trim() || 'Local',
        Icone: Armchair,
      }
    }
    return {
      label: pedido.mesa ? `Mesa ${pedido.mesa}` : 'Salão',
      Icone: Armchair,
    }
  }
  return { label: 'Retirada', Icone: Package }
}

const bordaTipo = (tipo: string) => {
  if (tipo === 'entrega') return 'border-l-primary'
  if (tipo === 'local') return 'border-l-emerald-500'
  return 'border-l-muted-foreground/50'
}

export default function CardPedido({
  pedido,
  modoSelecao = false,
  estaSelecionado = false,
  isNovo = false,
  valoresOcultos = false,
  index = 0,
  onToggleSelecao,
  onVerDetalhes,
  onEditar,
  onConfirmarPagamento,
  onConcluirPedido,
  onWhatsApp,
  onImprimirCozinha,
  onGerarPDF,
  onExcluir,
  onEnviarCrediario,
  onRestaurarMesa,
  rotuloResponsavel,
  acoesEmAndamento,
}: CardPedidoProps) {
  const badge = obterBadgeStatus(pedido)
  const canal = obterCanal(pedido)
  const IconeCanal = canal.Icone
  const formatarValor = (v: string) => (valoresOcultos ? '••••••' : v)
  const ehCrediario = String(pedido.forma_pagamento || '').toLowerCase().includes('credi')
  const crediarioEmAberto = pedidoEstaEmCrediarioAberto(pedido)
  const valorEmCrediarioExibido = crediarioEmAberto ? (pedido.valor_em_crediario ?? 0) : 0
  const podeEnviarCrediario = !ehCrediario && Boolean(onEnviarCrediario)
  const pagamentoPendente = pedidoTemPagamentoPendente(pedido)
  const pagamentoConcluido = Boolean(pedido.pagamento_online) && !pagamentoPendente
  const podeConcluirPedido = !pedidoEstaEncerrado(pedido.status)
  const confirmandoPagamento = Boolean(acoesEmAndamento?.pagamento)
  const imprimindoPedido = Boolean(acoesEmAndamento?.impressao)
  const concluindoPedido = Boolean(acoesEmAndamento?.concluir)
  const restaurandoMesa = Boolean(acoesEmAndamento?.restaurarMesa)
  const pedidoLocalDeMesa =
    pedido.tipo_entrega === 'local' &&
    Boolean(pedido.mesa_id) &&
    pedido.mesa_tipo !== 'local_externo' &&
    !pedido.comanda
  const mesaEstaForaDoSalao =
    pedidoLocalDeMesa &&
    !pedidoEstaEncerrado(pedido.status) &&
    (String(pedido.mesa_status || '').toLowerCase() !== 'ocupada' ||
      pedido.mesa_pedido_id !== pedido.id)
  const podeRestaurarMesa = Boolean(onRestaurarMesa) && mesaEstaForaDoSalao

  const itensVisiveis = pedido.itens?.slice(0, 4) ?? []
  const itensRestantes = Math.max(0, (pedido.itens?.length ?? 0) - itensVisiveis.length)

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15, delay: Math.min(index, 8) * 0.03 }}
      className={cn(
        'relative flex h-full flex-col overflow-hidden rounded-xl border border-l-[3px] bg-card shadow-sm transition-shadow',
        bordaTipo(pedido.tipo_entrega),
        estaSelecionado
          ? 'border-primary/50 ring-2 ring-primary/15 shadow-md'
          : isNovo
            ? 'border-primary/40 ring-1 ring-primary/10'
            : 'border-border/70 hover:shadow-md',
      )}
    >
      {modoSelecao && onToggleSelecao && (
        <button
          type="button"
          onClick={() => onToggleSelecao(pedido.id)}
          className="absolute left-3 top-3 z-10 rounded-md p-1.5 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={estaSelecionado ? 'Desmarcar pedido' : 'Selecionar pedido'}
        >
          {estaSelecionado ? (
            <CheckSquare strokeWidth={1.6} className="size-5 text-primary" />
          ) : (
            <Square strokeWidth={1.6} className="size-5 text-muted-foreground" />
          )}
        </button>
      )}

      <div className={cn('flex min-h-0 flex-1 flex-col', modoSelecao && 'pl-8')}>
        <div className="flex items-start justify-between gap-3 border-b border-border/60 px-4 py-3.5">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="truncate text-[15px] font-semibold tracking-tight text-foreground">
                {pedido.nome_cliente}
              </h4>
              {isNovo && (
                <Badge className="h-5 rounded-md bg-foreground px-1.5 text-[10px] font-semibold text-background shadow-none hover:bg-foreground">
                  Novo
                </Badge>
              )}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span className="font-mono tabular-nums">
                #{pedido.id.slice(0, 8).toUpperCase()}
              </span>
              <span className="text-border">·</span>
              <span>
                {format(new Date(pedido.created_at), 'dd/MM HH:mm', { locale: ptBR })}
              </span>
              {pedido.nome_garcom && (
                <>
                  <span className="text-border">·</span>
                  <span className="truncate">
                    {rotuloResponsavel
                      ? `${rotuloResponsavel}: ${pedido.nome_garcom}`
                      : pedido.nome_garcom}
                  </span>
                </>
              )}
            </div>
          </div>
          <Badge
            variant="outline"
            className={cn(
              'h-6 shrink-0 rounded-md px-2 text-[11px] font-semibold shadow-none',
              badge.className,
            )}
          >
            {badge.label}
          </Badge>
        </div>

        <div className="flex flex-1 flex-col gap-3 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-md border border-border/70 bg-muted/40 px-2 py-1 text-[11px] font-medium text-foreground">
              <IconeCanal className="size-3.5 text-muted-foreground" strokeWidth={1.6} />
              {canal.label}
            </span>
            {pedido.pagamento_online && (
              <span
                className={cn(
                  'inline-flex rounded-md border px-2 py-1 text-[11px] font-medium',
                  pagamentoConcluido
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                    : 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300',
                )}
              >
                {pagamentoConcluido ? 'PIX pago' : 'PIX pendente'}
              </span>
            )}
          </div>

          {(pedido.telefone || pedido.endereco) && (
            <div className="space-y-1 text-xs text-muted-foreground">
              {pedido.telefone && (
                <p className="truncate">
                  <span className="text-foreground/70">Tel.</span> {pedido.telefone}
                </p>
              )}
              {pedido.endereco && (
                <p className="line-clamp-2">
                  <span className="text-foreground/70">End.</span> {pedido.endereco}
                </p>
              )}
            </div>
          )}

          {itensVisiveis.length > 0 && (
            <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5">
              <ul className="space-y-1.5">
                {itensVisiveis.map((item, idx) => (
                  <li key={item.id || idx} className="text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <span className="min-w-0 flex-1 text-foreground">
                        <span className="font-semibold tabular-nums text-muted-foreground">
                          {item.quantidade}×
                        </span>{' '}
                        <span className="break-words">{item.nome_item || 'Produto'}</span>
                      </span>
                      <span className="shrink-0 font-mono tabular-nums text-muted-foreground">
                        {formatarValor(
                          `R$ ${Number(item.subtotal || 0).toFixed(2).replace('.', ',')}`,
                        )}
                      </span>
                    </div>
                    {item.item_adicionais && item.item_adicionais.length > 0 && (
                      <p className="mt-0.5 pl-4 text-[11px] text-muted-foreground">
                        {item.item_adicionais
                          .map(
                            (ad) =>
                              `${ad.quantidade && ad.quantidade > 1 ? `${ad.quantidade}× ` : ''}${ad.nome}`,
                          )
                          .join(' · ')}
                      </p>
                    )}
                    {item.observacoes && (
                      <p className="mt-0.5 pl-4 text-[11px] italic text-muted-foreground">
                        {item.observacoes}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
              {itensRestantes > 0 && (
                <p className="mt-2 text-[11px] font-medium text-muted-foreground">
                  +{itensRestantes} {itensRestantes === 1 ? 'item' : 'itens'}
                </p>
              )}
            </div>
          )}

          {((pedido.valor_pago_parcial ?? 0) > 0 || valorEmCrediarioExibido > 0) && (
            <BarraPagamentoParcial
              total={pedido.total}
              valorPago={pedido.valor_pago_parcial ?? 0}
              valorEmCrediario={valorEmCrediarioExibido}
            />
          )}
        </div>

        <div className="mt-auto border-t border-border/60 bg-muted/10 px-4 py-3">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
                Total
              </p>
              <p className="font-mono text-lg font-semibold tabular-nums tracking-tight text-foreground">
                {formatarValor(
                  `R$ ${Number(pedido.total || 0).toFixed(2).replace('.', ',')}`,
                )}
              </p>
            </div>
          </div>

          {!modoSelecao && (
            <TooltipProvider delayDuration={400}>
              {(podeRestaurarMesa ||
                pagamentoPendente ||
                onImprimirCozinha ||
                onConcluirPedido) && (
                <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {podeRestaurarMesa && (
                    <button
                      type="button"
                      onClick={() => onRestaurarMesa?.(pedido)}
                      disabled={restaurandoMesa}
                      className={cn(
                        acaoPrimariaClass,
                        'border-destructive/35 bg-destructive/10 text-destructive hover:border-destructive/55 hover:bg-destructive/15 sm:col-span-2',
                      )}
                      aria-label="Voltar pedido para o salão"
                    >
                      {restaurandoMesa ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Armchair className="h-4 w-4" />
                      )}
                      {restaurandoMesa ? 'Voltando...' : 'Voltar ao salão'}
                    </button>
                  )}

                  {onConfirmarPagamento && pagamentoPendente && (
                    <button
                      type="button"
                      onClick={() => onConfirmarPagamento(pedido)}
                      disabled={confirmandoPagamento}
                      className={cn(
                        acaoPrimariaClass,
                        acaoPagamentoClass,
                        'sm:col-span-2',
                      )}
                      aria-label="Confirmar pagamento"
                    >
                      {confirmandoPagamento ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <BadgeCheck className="h-4 w-4" />
                      )}
                      {confirmandoPagamento ? 'Confirmando...' : 'Confirmar pagamento'}
                    </button>
                  )}

                  {onImprimirCozinha && (
                    <button
                      type="button"
                      onClick={() => onImprimirCozinha(pedido)}
                      disabled={imprimindoPedido}
                      className={cn(
                        acaoPrimariaClass,
                        acaoImpressaoClass,
                        onConcluirPedido && podeConcluirPedido
                          ? 'sm:col-span-1'
                          : 'sm:col-span-2',
                      )}
                      aria-label="Imprimir na cozinha"
                    >
                      {imprimindoPedido ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Printer className="h-4 w-4" />
                      )}
                      {imprimindoPedido ? 'Imprimindo...' : 'Imprimir pedido'}
                    </button>
                  )}

                  {onConcluirPedido && podeConcluirPedido && (
                    <button
                      type="button"
                      onClick={() => onConcluirPedido(pedido)}
                      disabled={concluindoPedido}
                      className={cn(
                        acaoPrimariaClass,
                        'border-border/80 bg-secondary text-foreground hover:border-primary/35 hover:bg-accent dark:bg-secondary/90',
                        onImprimirCozinha ? 'sm:col-span-1' : 'sm:col-span-2',
                      )}
                      aria-label={crediarioEmAberto ? 'Concluir pedido e quitar crediário' : 'Concluir pedido'}
                    >
                      {concluindoPedido ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      {concluindoPedido
                        ? 'Concluindo...'
                        : crediarioEmAberto
                          ? 'Concluir e quitar'
                          : 'Concluir pedido'}
                    </button>
                  )}
                </div>
              )}

              <div className="grid grid-cols-[repeat(auto-fit,minmax(2.75rem,1fr))] gap-1.5">
                {onVerDetalhes && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => onVerDetalhes(pedido)}
                        className={acaoClass}
                        aria-label="Ver detalhes"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>Ver detalhes</TooltipContent>
                  </Tooltip>
                )}

                {onEditar && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => onEditar(pedido)}
                        className={acaoClass}
                        aria-label="Editar pedido"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>Editar pedido</TooltipContent>
                  </Tooltip>
                )}

                {onWhatsApp && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => onWhatsApp(pedido)}
                        className={acaoClass}
                        aria-label="Enviar WhatsApp"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>Enviar WhatsApp</TooltipContent>
                  </Tooltip>
                )}

                {onGerarPDF && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => onGerarPDF(pedido)}
                        className={acaoClass}
                        aria-label="Gerar PDF"
                      >
                        <FileText className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>Gerar PDF</TooltipContent>
                  </Tooltip>
                )}

                {podeEnviarCrediario && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => onEnviarCrediario?.(pedido)}
                        className={acaoClass}
                        aria-label="Enviar ao crediário"
                      >
                        <Wallet className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>Enviar ao crediário</TooltipContent>
                  </Tooltip>
                )}

                {onExcluir && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => onExcluir(pedido)}
                        className={cn(acaoClass, 'hover:text-destructive')}
                        aria-label="Excluir pedido"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>Excluir pedido</TooltipContent>
                  </Tooltip>
                )}
              </div>
            </TooltipProvider>
          )}
        </div>
      </div>
    </motion.div>
  )
}
