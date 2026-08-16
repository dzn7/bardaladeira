'use client'

import {
  BadgeCheck,
  CheckCircle2,
  Clock,
  Edit3,
  Eye,
  Loader2,
  Printer,
  Store,
  Timer,
  Trash2,
  UserCheck,
  UserPlus,
  UserRound,
  Wallet,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MenuAcoes, type MenuAcaoItem } from '@/components/ui/menu-acoes'
import { Progress } from '@/components/ui/progress'
import IconeMesa from '@/components/icons/IconeMesa'
import { cn } from '@/lib/utils'

export type EventoTimelineCard = {
  id: string
  data: string
  titulo: string
  detalhe: string
  garcom: string | null
}

type CardMesaSalaoProps = {
  titulo: string
  cliente: string
  garcom: string
  horaAbertura: string
  tempoTexto: string
  tempoUrgente: boolean
  totalFormatado: string
  ehParceiro: boolean
  atribuida: boolean
  pagamentoPendente: boolean
  atualizando: boolean
  atribuindo: boolean
  confirmandoPagamento: boolean
  imprimindoPedido: boolean
  excluindoPedido: boolean
  fechandoPonto: boolean
  eventos: EventoTimelineCard[]
  formatarHora: (valor: string | null | undefined) => string
  nomeTipo: string
  mostrarAtribuicao: boolean
  temPedido: boolean
  podeEstender: boolean
  podeCrediario: boolean
  podeExcluir: boolean
  podeImprimir: boolean
  podeLiberar: boolean
  onAbrir: () => void
  onEditar?: () => void
  onAtribuirGarcom?: () => void
  onVerTimeline: () => void
  onConfirmarPagamento?: () => void
  onImprimir?: () => void
  onLiberar?: () => void
  onEstender?: (minutos: number) => void
  onCrediario?: () => void
  onExcluir?: () => void
}

export const CardMesaSalao = ({
  titulo,
  cliente,
  garcom,
  horaAbertura,
  tempoTexto,
  tempoUrgente,
  totalFormatado,
  ehParceiro,
  atribuida,
  pagamentoPendente,
  atualizando,
  atribuindo,
  confirmandoPagamento,
  imprimindoPedido,
  excluindoPedido,
  fechandoPonto,
  eventos,
  formatarHora,
  nomeTipo,
  mostrarAtribuicao,
  temPedido,
  podeEstender,
  podeCrediario,
  podeExcluir,
  podeImprimir,
  podeLiberar,
  onAbrir,
  onEditar,
  onAtribuirGarcom,
  onVerTimeline,
  onConfirmarPagamento,
  onImprimir,
  onLiberar,
  onEstender,
  onCrediario,
  onExcluir,
}: CardMesaSalaoProps) => {
  const itensMenu: MenuAcaoItem[] = [
    {
      key: 'abrir',
      label: temPedido ? 'Ver pedido' : 'Abrir ponto',
      icon: <Eye className="h-3.5 w-3.5" />,
      onSelect: onAbrir,
    },
  ]

  if (onEditar) {
    itensMenu.push({
      key: 'editar',
      label: temPedido ? 'Editar pedido' : 'Novo pedido',
      icon: <Edit3 className="h-3.5 w-3.5" />,
      onSelect: onEditar,
    })
  }

  if (mostrarAtribuicao && onAtribuirGarcom && temPedido) {
    itensMenu.push({
      key: 'garcom',
      label: atribuida ? 'Trocar garçom' : 'Atribuir garçom',
      icon: atribuida ? <UserCheck className="h-3.5 w-3.5" /> : <UserPlus className="h-3.5 w-3.5" />,
      onSelect: onAtribuirGarcom,
      disabled: atribuindo,
    })
  }

  if (podeEstender && onEstender) {
    ;[15, 30, 60].forEach((minutos) => {
      itensMenu.push({
        key: `tempo-${minutos}`,
        label: `+${minutos} min de tempo`,
        icon: <Clock className="h-3.5 w-3.5" />,
        onSelect: () => onEstender(minutos),
        disabled: atualizando,
        separatorBefore: minutos === 15,
      })
    })
  }

  if (podeCrediario && onCrediario) {
    itensMenu.push({
      key: 'crediario',
      label: 'Enviar ao crediário',
      icon: <Wallet className="h-3.5 w-3.5" />,
      onSelect: onCrediario,
      disabled: atualizando,
      separatorBefore: true,
    })
  }

  if (podeExcluir && onExcluir) {
    itensMenu.push({
      key: 'excluir',
      label: 'Excluir pedido',
      icon: <Trash2 className="h-3.5 w-3.5" />,
      onSelect: onExcluir,
      disabled: atualizando || excluindoPedido,
      variant: 'destructive',
      separatorBefore: true,
    })
  }

  return (
    <article
      className={cn(
        'flex flex-col overflow-hidden rounded-xl border bg-card transition-colors',
        'border-border/70 hover:border-foreground/20',
        atribuida && 'border-emerald-300/70 dark:border-emerald-800/60',
        !ehParceiro && tempoUrgente && 'border-red-300 bg-red-50/40 dark:border-red-900/50 dark:bg-red-950/20',
      )}
    >
      <div className="flex items-start justify-between gap-3 border-b border-border/60 p-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
              {ehParceiro ? <Store className="h-4 w-4" strokeWidth={1.6} /> : <IconeMesa className="h-4 w-4" />}
            </span>
            <div className="min-w-0">
              <h3 className="truncate text-base font-semibold text-foreground">{titulo}</h3>
              <p className="text-xs text-muted-foreground">
                {ehParceiro ? 'Aberto' : 'Ocupada'} às {horaAbertura}
              </p>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Badge
            className={cn(
              'rounded-full px-2.5 py-0.5 text-xs font-medium shadow-none',
              tempoUrgente
                ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100'
                : atribuida
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100'
                  : 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100',
            )}
          >
            {tempoUrgente ? 'Tempo crítico' : atribuida ? 'Com garçom' : ehParceiro ? 'Aberto' : 'Ocupada'}
          </Badge>
          <MenuAcoes ariaLabel={`Ações de ${titulo}`} items={itensMenu} disabled={atualizando} />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Cliente</p>
            <p className="mt-0.5 truncate text-sm font-semibold text-foreground">{cliente}</p>
            <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
              <UserRound className="h-3.5 w-3.5 shrink-0" />
              {garcom}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Total</p>
            <p className="mt-0.5 text-xl font-semibold tabular-nums text-foreground">{totalFormatado}</p>
          </div>
        </div>

        <div
          className={cn(
            'flex items-center gap-2 rounded-lg px-3 py-2 text-xs',
            tempoUrgente
              ? 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-200'
              : 'bg-muted/50 text-muted-foreground',
          )}
        >
          <Timer className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate font-medium">{tempoTexto}</span>
        </div>

        {tempoUrgente ? <Progress value={100} className="h-1.5 bg-red-100 dark:bg-red-950/40 [&>div]:bg-red-500" /> : null}

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-muted-foreground">Últimos movimentos</p>
            {eventos.length > 3 ? (
              <button
                type="button"
                onClick={onVerTimeline}
                className="text-xs font-medium text-primary hover:underline"
              >
                Ver tudo
              </button>
            ) : null}
          </div>
          {eventos.length > 0 ? (
            <div className="space-y-1.5">
              {eventos.slice(0, 3).map((evento) => (
                <div key={evento.id} className="grid grid-cols-[40px_minmax(0,1fr)] gap-2">
                  <span className="font-mono text-[11px] font-semibold tabular-nums text-muted-foreground">
                    {formatarHora(evento.data)}
                  </span>
                  <div className="min-w-0 border-l border-border/70 pl-2.5">
                    <p className="truncate text-sm font-medium text-foreground">{evento.titulo}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {evento.garcom ? `${evento.garcom} · ` : ''}
                      {evento.detalhe}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-border/70 px-3 py-2.5 text-xs text-muted-foreground">
              Sem movimentos ainda.
            </p>
          )}
        </div>

        <div className="mt-auto flex flex-col gap-2 pt-1">
          {pagamentoPendente && onConfirmarPagamento ? (
            <Button
              type="button"
              size="sm"
              onClick={onConfirmarPagamento}
              disabled={atualizando || confirmandoPagamento}
              className="h-10 gap-2 border border-emerald-700 bg-emerald-600 font-semibold text-white hover:bg-emerald-700"
            >
              {confirmandoPagamento ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />}
              {confirmandoPagamento ? 'Confirmando...' : 'Confirmar pagamento'}
            </Button>
          ) : null}

          <div className="grid grid-cols-2 gap-2">
            {podeImprimir && onImprimir ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={onImprimir}
                disabled={atualizando || imprimindoPedido}
                className="h-10 gap-2 shadow-none"
              >
                {imprimindoPedido ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                {imprimindoPedido ? 'Enviando...' : 'Imprimir'}
              </Button>
            ) : (
              <Button type="button" size="sm" variant="outline" onClick={onAbrir} className="h-10 gap-2 shadow-none">
                <Eye className="h-4 w-4" />
                Abrir
              </Button>
            )}
            {podeLiberar && onLiberar ? (
              <Button
                type="button"
                size="sm"
                onClick={onLiberar}
                disabled={atualizando || fechandoPonto}
                className="h-10 gap-2 shadow-none"
              >
                {fechandoPonto ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {fechandoPonto ? 'Fechando...' : ehParceiro ? 'Fechar' : `Fechar ${nomeTipo}`}
              </Button>
            ) : onEditar ? (
              <Button type="button" size="sm" onClick={onEditar} className="h-10 gap-2 shadow-none">
                <Edit3 className="h-4 w-4" />
                Editar
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  )
}
