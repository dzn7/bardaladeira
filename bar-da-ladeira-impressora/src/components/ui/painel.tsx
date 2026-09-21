import * as React from 'react'
import { cn } from '@/lib/utils'

export const Painel = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <section className={cn('rounded-xl border border-border/70 bg-card', className)} {...props} />
)

type PainelCabecalhoProps = React.HTMLAttributes<HTMLDivElement> & {
  titulo: React.ReactNode
  descricao?: React.ReactNode
  icone?: React.ReactNode
  acoes?: React.ReactNode
}

export const PainelCabecalho = ({
  titulo,
  descricao,
  icone,
  acoes,
  className,
  ...props
}: PainelCabecalhoProps) => (
  <div
    className={cn('flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3', className)}
    {...props}
  >
    <div className="flex min-w-0 items-center gap-2.5">
      {icone ? <span className="shrink-0 text-primary">{icone}</span> : null}
      <div className="min-w-0">
        <h2 className="truncate text-sm font-medium text-foreground">{titulo}</h2>
        {descricao ? <p className="truncate text-xs text-muted-foreground">{descricao}</p> : null}
      </div>
    </div>
    {acoes ? <div className="flex shrink-0 items-center gap-2">{acoes}</div> : null}
  </div>
)

export const PainelCorpo = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('p-4', className)} {...props} />
)

type ListaVaziaProps = {
  icone?: React.ReactNode
  titulo: string
  descricao?: string
  className?: string
}

export const ListaVazia = ({ icone, titulo, descricao, className }: ListaVaziaProps) => (
  <div className={cn('flex flex-col items-center justify-center gap-1.5 px-4 py-10 text-center', className)}>
    {icone ? <span className="text-muted-foreground/60">{icone}</span> : null}
    <p className="text-sm font-medium text-foreground">{titulo}</p>
    {descricao ? <p className="max-w-sm text-xs text-muted-foreground">{descricao}</p> : null}
  </div>
)
