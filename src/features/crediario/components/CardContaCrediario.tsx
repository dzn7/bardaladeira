'use client'

import { Banknote, Calendar, CheckCircle2, Eye } from 'lucide-react'
import IconeWhatsApp from '@/components/icons/IconeWhatsApp'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MenuAcoes } from '@/components/ui/menu-acoes'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

export type ContaCrediarioCard = {
  id: string
  cliente_nome: string
  telefone: string | null
  status: string
  saldo_atual: number
  origem: string
  atualizado_em: string
  ultimo_movimento_em: string | null
}

type ProgressoCard = {
  percentual: number
  totalPago: number
  saldo: number
  temPagamentoParcial: boolean
  totalConsumos: number
  totalPagamentos: number
}

type CardContaCrediarioProps = {
  conta: ContaCrediarioCard
  statusRotulo: string
  telefoneFormatado: string
  dataFormatada: string
  saldoFormatado: string
  progresso: ProgressoCard
  responsavel?: string
  selecionada?: boolean
  processando?: boolean
  cobrancaDisponivel?: boolean
  cobrancaEmEnvio?: boolean
  onDetalhes: () => void
  onPagar: () => void
  onQuitar: () => void
  onCobrar: () => void
}

export const CardContaCrediario = ({
  conta,
  statusRotulo,
  telefoneFormatado,
  dataFormatada,
  saldoFormatado,
  progresso,
  responsavel,
  selecionada = false,
  processando = false,
  cobrancaDisponivel = false,
  cobrancaEmEnvio = false,
  onDetalhes,
  onPagar,
  onQuitar,
  onCobrar,
}: CardContaCrediarioProps) => {
  const legado = conta.origem === 'migracao_edienai_antigo'
  const aberto = conta.status === 'aberto'

  return (
    <div
      className={cn(
        'cursor-pointer rounded-xl border p-4 transition-colors',
        'border-border/70 bg-card hover:border-foreground/20',
        selecionada && 'border-primary/40 bg-accent/30',
      )}
      onClick={onDetalhes}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onDetalhes()
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`Abrir crediário de ${conta.cliente_nome}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-foreground">{conta.cliente_nome}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{telefoneFormatado}</p>
          {responsavel ? (
            <p className="mt-1 truncate text-xs text-muted-foreground">Aberto por {responsavel}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-md text-[#25D366] hover:bg-[#25D366]/10 hover:text-[#1da851]"
            aria-label={`Cobrar ${conta.cliente_nome} pelo WhatsApp`}
            title={cobrancaDisponivel ? 'Enviar cobrança pelo WhatsApp' : 'WhatsApp indisponível para esta conta'}
            disabled={!cobrancaDisponivel || cobrancaEmEnvio}
            onClick={(event) => {
              event.stopPropagation()
              onCobrar()
            }}
          >
            <IconeWhatsApp className="h-4 w-4" />
          </Button>
          <MenuAcoes
            ariaLabel="Ações da conta"
            disabled={processando}
            items={[
              {
                key: 'detalhes',
                label: 'Ver detalhes',
                icon: <Eye className="h-3.5 w-3.5" />,
                onSelect: onDetalhes,
              },
              {
                key: 'pagar',
                label: 'Registrar pagamento',
                icon: <Banknote className="h-3.5 w-3.5" />,
                onSelect: onPagar,
                disabled: processando,
              },
              {
                key: 'quitar',
                label: 'Quitar tudo',
                icon: <CheckCircle2 className="h-3.5 w-3.5" />,
                onSelect: onQuitar,
                disabled: processando || conta.saldo_atual <= 0,
                variant: 'success',
                separatorBefore: true,
              },
            ]}
          />
        </div>
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            Ainda deve
          </p>
          <p
            className={cn(
              'mt-0.5 text-2xl font-semibold tabular-nums',
              aberto ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-600 dark:text-emerald-400',
            )}
          >
            {saldoFormatado}
          </p>
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-md bg-muted/70 px-2 py-1 text-xs text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" strokeWidth={1.6} aria-hidden />
          <span className="tabular-nums">{dataFormatada}</span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Badge
          className={cn(
            'rounded-full px-2.5 py-0.5 text-xs font-medium shadow-none',
            aberto
              ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100'
              : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100',
          )}
        >
          {statusRotulo}
        </Badge>
        <Badge variant="outline" className="rounded-full border-border/70 bg-background/50 font-medium">
          {legado ? 'Sistema antigo' : 'Novo'}
        </Badge>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        {progresso.totalConsumos} pedido{progresso.totalConsumos === 1 ? '' : 's'} fiado ·{' '}
        {progresso.totalPagamentos} pagamento{progresso.totalPagamentos === 1 ? '' : 's'}
      </p>

      {progresso.temPagamentoParcial ? (
        <div className="mt-3 space-y-1.5">
          <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
            <span>Já pagou parte</span>
            <span className="font-semibold tabular-nums text-foreground">{Math.round(progresso.percentual)}%</span>
          </div>
          <Progress value={progresso.percentual} className="h-1.5 bg-muted" />
        </div>
      ) : null}
    </div>
  )
}
