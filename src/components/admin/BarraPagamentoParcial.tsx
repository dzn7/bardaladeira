'use client'

import { cn } from '@/lib/utils'

type Props = {
  total: number
  /** Valor pago de fato (PIX/Dinheiro/Cartão) — verde, abate o saldo. */
  valorPago: number
  /** Valor que está em crediário (fiado) — vermelho, NÃO abate o saldo. */
  valorEmCrediario?: number
  className?: string
  /**
   * 'compact' — usado em cards estreitos (kanban/lista). Mostra label + valor + barra.
   * 'inline' — usado dentro de modais ou expansão; apenas linha de texto + barra.
   */
  variant?: 'compact' | 'inline'
}

const formatarMoeda = (valor: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0)

export function BarraPagamentoParcial({
  total,
  valorPago,
  valorEmCrediario = 0,
  className,
  variant = 'compact',
}: Props) {
  const temPagamento = valorPago > 0
  const temCrediario = valorEmCrediario > 0
  if (!total || (!temPagamento && !temCrediario)) return null

  const pagoEfetivo = Math.min(valorPago, total)
  const crediarioEfetivo = Math.min(valorEmCrediario, Math.max(0, total - pagoEfetivo))
  const saldoDevedor = Math.max(0, total - pagoEfetivo)
  const quitado = saldoDevedor < 0.01

  const percentualPago = total > 0 ? (pagoEfetivo / total) * 100 : 0
  const percentualCrediario = total > 0 ? (crediarioEfetivo / total) * 100 : 0

  // Define cor predominante do card (verde se há pagamento; vermelho se só fiado)
  const apenasCrediario = !temPagamento && temCrediario
  const corPrincipal = apenasCrediario
    ? {
        borda: 'border-red-200/70 dark:border-red-400/45',
        fundo: 'bg-red-50/60 dark:bg-red-500/10',
        texto: 'text-red-700 dark:text-red-200',
        textoSecundario: 'text-red-700/80 dark:text-red-200/75',
        rail: 'bg-red-200/60 dark:bg-red-950/80',
      }
    : {
        borda: 'border-emerald-200/70 dark:border-emerald-400/45',
        fundo: 'bg-emerald-50/60 dark:bg-emerald-500/10',
        texto: 'text-emerald-700 dark:text-emerald-200',
        textoSecundario: 'text-emerald-700/80 dark:text-emerald-200/75',
        rail: 'bg-emerald-200/60 dark:bg-emerald-950/80',
      }

  const titulo = quitado
    ? 'Quitado'
    : apenasCrediario
      ? 'Em crediário'
      : temCrediario
        ? 'Pago + fiado'
        : 'Pago parcial'

  return (
    <div
      className={cn(
        'space-y-1.5 rounded-lg border px-2.5 py-2 shadow-sm',
        corPrincipal.borda,
        corPrincipal.fundo,
        variant === 'inline' && 'border-0 bg-transparent px-0 py-0',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={cn('inline-flex items-center gap-1 text-[11px] font-semibold', corPrincipal.texto)}>
          {titulo}
        </span>
        <span className={cn('font-mono text-[11px] tabular-nums', corPrincipal.texto)}>
          {temPagamento && temCrediario
            ? `${formatarMoeda(pagoEfetivo)} pago · ${formatarMoeda(crediarioEfetivo)} fiado`
            : `${formatarMoeda(temPagamento ? pagoEfetivo : crediarioEfetivo)} / ${formatarMoeda(total)}`}
        </span>
      </div>
      <div className={cn('flex h-1 w-full overflow-hidden rounded-full', corPrincipal.rail)}>
        {percentualPago > 0 && (
          <div
            className="h-full bg-emerald-500 transition-all dark:bg-emerald-300"
            style={{ width: `${percentualPago}%` }}
          />
        )}
        {percentualCrediario > 0 && (
          <div
            className="h-full bg-red-500 transition-all dark:bg-red-300"
            style={{ width: `${percentualCrediario}%` }}
          />
        )}
      </div>
      {!quitado && (
        <p className={cn('text-[10px] font-medium uppercase tracking-wide', corPrincipal.textoSecundario)}>
          Saldo devedor · {formatarMoeda(saldoDevedor)}
          {temCrediario && ` · ${formatarMoeda(crediarioEfetivo)} em fiado`}
        </p>
      )}
    </div>
  )
}
