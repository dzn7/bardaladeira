'use client'

import { CalendarDays, Clock, Info, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { formatarPercentual, formatarPontos } from '../lib/periodo'
import type { ConfigProdutividade } from '../types'
import type { ResumoMetas } from '../hooks/useProdutividade'

type Props = {
  metas: ResumoMetas
  config: ConfigProdutividade
  carregando?: boolean
  onAjustarMetas: () => void
}

type Cartao = {
  titulo: string
  icone: typeof Clock
  valor: number
  meta: number
  destaque: string
}

export function CardMetasProdutividade({ metas, config, carregando, onAjustarMetas }: Props) {
  const cartoes: Cartao[] = [
    {
      titulo: 'Hoje',
      icone: Clock,
      valor: metas.pontosDia,
      meta: config.meta_pontos_dia,
      destaque: 'text-primary',
    },
    {
      titulo: 'Esta semana',
      icone: CalendarDays,
      valor: metas.pontosSemana,
      meta: config.meta_pontos_semana,
      destaque: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      titulo: 'Este mês',
      icone: Target,
      valor: metas.pontosMes,
      meta: config.meta_pontos_mes,
      destaque: 'text-amber-600 dark:text-amber-400',
    },
  ]

  return (
    <section className="rounded-xl border border-border/70 bg-card p-4 shadow-sm md:p-5">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-sm font-medium text-foreground">Metas da equipe</h2>
          <p className="mt-1 flex items-start gap-1.5 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>
              Janelas fixas (hoje, semana, mês corrente). Não seguem o filtro de período acima.
            </span>
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 shrink-0 shadow-none"
          onClick={onAjustarMetas}
        >
          Ajustar pontuação
        </Button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {cartoes.map((cartao) => {
          const progresso = cartao.meta > 0 ? (cartao.valor / cartao.meta) * 100 : 0
          const atingiu = progresso >= 100

          return (
            <div
              key={cartao.titulo}
              className="rounded-lg border border-border/60 bg-background p-3.5"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <cartao.icone
                    className={cn('h-4 w-4 shrink-0', cartao.destaque)}
                    strokeWidth={1.8}
                    aria-hidden="true"
                  />
                  <span className="truncate text-sm font-medium text-foreground">
                    {cartao.titulo}
                  </span>
                </div>
                {carregando ? (
                  <Skeleton className="h-6 w-12" />
                ) : (
                  <span className={cn('text-xl font-semibold tabular-nums', cartao.destaque)}>
                    {formatarPontos(cartao.valor)}
                  </span>
                )}
              </div>

              <div className="mt-3">
                <div className="flex justify-between text-[11px] text-muted-foreground">
                  <span>Meta: {formatarPontos(cartao.meta)} pts</span>
                  <span className={cn(atingiu && 'font-medium text-emerald-600 dark:text-emerald-400')}>
                    {atingiu ? 'Meta batida' : formatarPercentual(progresso)}
                  </span>
                </div>
                <div
                  className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.min(Math.round(progresso), 100)}
                  aria-label={`Progresso da meta de ${cartao.titulo.toLowerCase()}`}
                >
                  <div
                    className={cn(
                      'h-full rounded-full transition-[width] duration-500',
                      atingiu ? 'bg-emerald-500' : 'bg-primary',
                    )}
                    style={{ width: `${Math.min(Math.max(progresso, 0), 100)}%` }}
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
