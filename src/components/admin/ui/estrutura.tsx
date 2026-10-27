import * as React from 'react'
import { cn } from '@/lib/utils'

type CabecalhoPaginaProps = {
  titulo: string
  descricao?: React.ReactNode
  acoes?: React.ReactNode
}

/** Topo de cada tela do admin: título, resumo curto e ações principais. */
export function CabecalhoPagina({ titulo, descricao, acoes }: CabecalhoPaginaProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-foreground md:text-2xl">{titulo}</h1>
        {descricao && <p className="mt-1 text-sm text-muted-foreground">{descricao}</p>}
      </div>
      {acoes && <div className="flex shrink-0 flex-wrap gap-2 [&>*]:flex-1 sm:[&>*]:flex-none">{acoes}</div>}
    </div>
  )
}

export function Pagina({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('mx-auto w-full max-w-5xl space-y-5 pb-10', className)} {...props} />
}

export function Cartao({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-xl border border-border/70 bg-card', className)} {...props} />
}

type SecaoProps = {
  titulo: React.ReactNode
  descricao?: React.ReactNode
  acao?: React.ReactNode
  className?: string
  children: React.ReactNode
}

/** Bloco com título fora do cartão (padrão de listas agrupadas). */
export function Secao({ titulo, descricao, acao, className, children }: SecaoProps) {
  return (
    <section className={cn('space-y-2', className)}>
      <div className="flex items-end justify-between gap-3 px-1">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">{titulo}</h2>
          {descricao && <p className="text-[13px] leading-5 text-muted-foreground">{descricao}</p>}
        </div>
        {acao}
      </div>
      {children}
    </section>
  )
}

/** Lista em cartão com divisórias. */
export function Lista({ className, ...props }: React.HTMLAttributes<HTMLUListElement>) {
  return (
    <ul
      className={cn('divide-y divide-border/70 overflow-hidden rounded-xl border border-border/70 bg-card', className)}
      {...props}
    />
  )
}

type ListaVaziaProps = {
  icone?: React.ReactNode
  titulo: string
  descricao?: React.ReactNode
  acao?: React.ReactNode
}

export function ListaVazia({ icone, titulo, descricao, acao }: ListaVaziaProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border/70 bg-card px-6 py-10 text-center">
      {icone && (
        <span className="flex size-10 items-center justify-center rounded-lg bg-muted text-foreground [&_svg]:size-5">
          {icone}
        </span>
      )}
      <div className="max-w-sm space-y-1">
        <p className="text-base font-medium text-foreground">{titulo}</p>
        {descricao && <p className="text-sm text-muted-foreground">{descricao}</p>}
      </div>
      {acao}
    </div>
  )
}

export function Esqueleto({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} />
}

export function ListaCarregando({ linhas = 4 }: { linhas?: number }) {
  return (
    <div className="space-y-2" aria-busy="true" aria-label="Carregando">
      {Array.from({ length: linhas }).map((_, indice) => (
        <div key={indice} className="flex items-center gap-3 rounded-xl border border-border/70 bg-card p-3">
          <Esqueleto className="size-12 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Esqueleto className="h-4 w-1/2" />
            <Esqueleto className="h-3 w-1/4" />
          </div>
        </div>
      ))}
    </div>
  )
}

type SeloProps = React.HTMLAttributes<HTMLSpanElement> & {
  tom?: 'neutro' | 'primario' | 'sucesso' | 'alerta' | 'perigo'
}

const tons = {
  neutro: 'bg-muted text-muted-foreground',
  primario: 'bg-primary/10 text-primary',
  sucesso: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  alerta: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  perigo: 'bg-red-500/10 text-red-700 dark:text-red-300',
}

export function Selo({ tom = 'neutro', className, ...props }: SeloProps) {
  return (
    <span
      className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium', tons[tom], className)}
      {...props}
    />
  )
}

type ChipProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { ativo?: boolean }

/** Chip de filtro/seleção (aria-pressed). */
export function Chip({ ativo = false, className, ...props }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      className={cn(
        'inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
        ativo
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-border/70 bg-card text-muted-foreground hover:bg-accent hover:text-foreground',
        className
      )}
      {...props}
    />
  )
}
