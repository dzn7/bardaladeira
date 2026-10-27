'use client'

import { Money as Banknote, CheckCircle as CheckCircle2, CircleNotch, Eye } from '@phosphor-icons/react'
import IconeWhatsApp from '@/components/icons/IconeWhatsApp'
import { Botao, Selo } from '@/components/admin/ui'
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
  /** Conta de exemplo do onboarding: recebe os alvos `demo-card` e `demo-dropdown`. */
  demo?: boolean
  onDetalhes: () => void
  onPagar: () => void
  onQuitar: () => void
  onCobrar: () => void
}

/** Linha da lista de contas do crediário (toque abre os detalhes). */
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
  demo = false,
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
        'flex min-h-16 cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
        selecionada && 'bg-accent/40',
      )}
      onClick={onDetalhes}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onDetalhes()
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`Abrir crediário de ${conta.cliente_nome}`}
      data-onboarding={demo ? 'demo-card' : undefined}
    >
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate font-medium text-foreground">{conta.cliente_nome}</p>
          {legado ? <Selo className="shrink-0">Sistema antigo</Selo> : null}
        </div>
        <p className="mt-0.5 truncate text-sm text-muted-foreground">
          <span className="tabular-nums">{telefoneFormatado}</span>
          <span className="hidden sm:inline"> · {dataFormatada}</span>
          <span className="hidden md:inline">
            {' '}· {progresso.totalConsumos} pedido{progresso.totalConsumos === 1 ? '' : 's'} no fiado ·{' '}
            {progresso.totalPagamentos} pagamento{progresso.totalPagamentos === 1 ? '' : 's'}
          </span>
        </p>
        {responsavel ? (
          <p className="mt-0.5 truncate text-[13px] text-muted-foreground">Aberto por {responsavel}</p>
        ) : null}
        {progresso.temPagamentoParcial ? (
          <div className="mt-2 flex max-w-[240px] items-center gap-2">
            <Progress value={progresso.percentual} className="h-1.5 bg-muted" aria-label="Quanto já pagou" />
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {Math.round(progresso.percentual)}% pago
            </span>
          </div>
        ) : null}
      </div>

      <div className="shrink-0 text-right">
        <p
          className={cn(
            'font-semibold tabular-nums',
            aberto ? 'text-amber-700 dark:text-amber-300' : 'text-muted-foreground',
          )}
        >
          {saldoFormatado}
        </p>
        <Selo tom={aberto ? 'alerta' : 'sucesso'} className="mt-1">
          {statusRotulo}
        </Selo>
      </div>

      <div
        className="-mr-2 flex shrink-0 items-center"
        data-onboarding={demo ? 'demo-dropdown' : undefined}
      >
        <Botao
          variante="fantasma"
          tamanho="icone"
          className="size-11 text-emerald-600 hover:text-emerald-700 md:size-9 dark:text-emerald-400"
          aria-label={`Cobrar ${conta.cliente_nome} pelo WhatsApp`}
          title={cobrancaDisponivel ? 'Enviar cobrança pelo WhatsApp' : 'Sem saldo em aberto para cobrar'}
          disabled={!cobrancaDisponivel || cobrancaEmEnvio}
          onClick={(event) => {
            event.stopPropagation()
            onCobrar()
          }}
        >
          {cobrancaEmEnvio ? <CircleNotch className="animate-spin" /> : <IconeWhatsApp className="h-4 w-4" />}
        </Botao>
        <MenuAcoes
          ariaLabel={`Ações da conta de ${conta.cliente_nome}`}
          disabled={processando}
          triggerClassName="h-11 w-11 md:h-9 md:w-9"
          items={[
            {
              key: 'detalhes',
              label: 'Ver detalhes',
              icon: <Eye className="h-3.5 w-3.5" />,
              onSelect: onDetalhes,
            },
            {
              key: 'pagar',
              label: 'Receber pagamento',
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
  )
}
