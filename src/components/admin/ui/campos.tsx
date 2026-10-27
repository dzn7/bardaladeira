'use client'

import * as React from 'react'
import { CaretDown, Minus, Plus } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

// text-base no mobile evita o zoom automático do iOS ao focar o campo.
const classeCampoBase =
  'w-full rounded-lg border border-input bg-card px-3 text-base text-foreground shadow-input transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm'

type CampoProps = {
  rotulo: string
  htmlFor?: string
  ajuda?: React.ReactNode
  erro?: string | null
  opcional?: boolean
  className?: string
  children: React.ReactNode
}

/** Rótulo + controle + texto de ajuda/erro. */
export function Campo({ rotulo, htmlFor, ajuda, erro, opcional, className, children }: CampoProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={htmlFor} className="flex items-baseline gap-1.5 text-sm font-medium text-foreground">
        {rotulo}
        {opcional && <span className="text-xs font-normal text-muted-foreground">(opcional)</span>}
      </label>
      {children}
      {erro ? (
        <p className="text-[13px] text-destructive" role="alert">{erro}</p>
      ) : ajuda ? (
        <p className="text-[13px] leading-5 text-muted-foreground">{ajuda}</p>
      ) : null}
    </div>
  )
}

export const Entrada = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(classeCampoBase, 'h-11 md:h-10', className)} {...props} />
  )
)
Entrada.displayName = 'Entrada'

export const AreaTexto = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, rows = 3, ...props }, ref) => (
    <textarea ref={ref} rows={rows} className={cn(classeCampoBase, 'resize-none py-2.5', className)} {...props} />
  )
)
AreaTexto.displayName = 'AreaTexto'

export const Selecao = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <div className="relative">
      <select ref={ref} className={cn(classeCampoBase, 'h-11 appearance-none pr-9 md:h-10', className)} {...props}>
        {children}
      </select>
      <CaretDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  )
)
Selecao.displayName = 'Selecao'

/** Converte texto digitado ("12,50", "12.5") em número; null se inválido. */
export function lerPreco(valor: string): number | null {
  const normalizado = valor.replace(/\s/g, '').replace(',', '.')
  if (normalizado === '') return null
  const numero = Number(normalizado)
  return Number.isFinite(numero) && numero >= 0 ? numero : null
}

export const formatarPreco = (valor: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor || 0)

type EntradaPrecoProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  valor: string
  aoMudar: (valor: string) => void
}

/** Campo de preço com "R$" fixo e teclado decimal; aceita vírgula. */
export function EntradaPreco({ valor, aoMudar, className, ...props }: EntradaPrecoProps) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
      <Entrada
        inputMode="decimal"
        placeholder="0,00"
        value={valor}
        onChange={(evento) => aoMudar(evento.target.value.replace(/[^\d.,]/g, ''))}
        className={cn('pl-10 font-mono tabular-nums', className)}
        {...props}
      />
    </div>
  )
}

type ContadorProps = {
  valor: number
  aoMudar: (valor: number) => void
  minimo?: number
  maximo?: number
  rotuloAcessivel: string
}

/** Stepper numérico com alvos de toque de 44px. */
export function Contador({ valor, aoMudar, minimo = 0, maximo = 99, rotuloAcessivel }: ContadorProps) {
  const limitar = (numero: number) => Math.min(maximo, Math.max(minimo, numero))
  return (
    <div className="inline-flex items-center rounded-lg border border-border/70 bg-card shadow-input">
      <button
        type="button"
        onClick={() => aoMudar(limitar(valor - 1))}
        disabled={valor <= minimo}
        className="flex size-11 items-center justify-center rounded-l-lg text-foreground transition-colors hover:bg-accent disabled:opacity-40"
        aria-label={`Diminuir ${rotuloAcessivel}`}
      >
        <Minus className="size-4" />
      </button>
      <input
        inputMode="numeric"
        pattern="[0-9]*"
        value={valor}
        onChange={(evento) => {
          const numero = parseInt(evento.target.value.replace(/\D/g, ''), 10)
          if (Number.isFinite(numero)) aoMudar(limitar(numero))
        }}
        onFocus={(evento) => evento.target.select()}
        className="h-11 w-14 border-x border-border/70 bg-transparent text-center font-mono text-base tabular-nums text-foreground focus-visible:outline-none"
        aria-label={rotuloAcessivel}
      />
      <button
        type="button"
        onClick={() => aoMudar(limitar(valor + 1))}
        disabled={valor >= maximo}
        className="flex size-11 items-center justify-center rounded-r-lg text-foreground transition-colors hover:bg-accent disabled:opacity-40"
        aria-label={`Aumentar ${rotuloAcessivel}`}
      >
        <Plus className="size-4" />
      </button>
    </div>
  )
}

type InterruptorProps = {
  marcado: boolean
  aoMudar: (marcado: boolean) => void
  rotuloAcessivel?: string
  desabilitado?: boolean
  id?: string
}

export function Interruptor({ marcado, aoMudar, rotuloAcessivel, desabilitado, id }: InterruptorProps) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={marcado}
      aria-label={rotuloAcessivel}
      disabled={desabilitado}
      onClick={(evento) => {
        evento.stopPropagation()
        aoMudar(!marcado)
      }}
      className={cn(
        'relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors before:absolute before:-inset-2.5 before:content-[""] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-40',
        marcado ? 'bg-primary' : 'bg-muted-foreground/25'
      )}
    >
      <span
        className={cn(
          'inline-block size-5 rounded-full bg-white shadow-sm transition-transform motion-reduce:transition-none',
          marcado ? 'translate-x-[18px]' : 'translate-x-0.5'
        )}
      />
    </button>
  )
}

type LinhaInterruptorProps = InterruptorProps & {
  titulo: string
  descricao?: string
}

/** Linha clicável inteira: título, descrição e interruptor à direita. */
export function LinhaInterruptor({ titulo, descricao, ...interruptor }: LinhaInterruptorProps) {
  return (
    <div
      className="flex cursor-pointer items-center gap-3 rounded-xl border border-border/70 bg-card px-4 py-3"
      onClick={() => !interruptor.desabilitado && interruptor.aoMudar(!interruptor.marcado)}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{titulo}</p>
        {descricao && <p className="mt-0.5 text-[13px] leading-5 text-muted-foreground">{descricao}</p>}
      </div>
      <Interruptor {...interruptor} rotuloAcessivel={interruptor.rotuloAcessivel || titulo} />
    </div>
  )
}

type OpcaoSegmento<T extends string> = { valor: T; rotulo: string }

/** Grupo de chips de escolha única (substitui select curto). */
export function Segmentos<T extends string>({
  opcoes,
  valor,
  aoMudar,
  rotuloAcessivel,
}: {
  opcoes: OpcaoSegmento<T>[]
  valor: T
  aoMudar: (valor: T) => void
  rotuloAcessivel: string
}) {
  return (
    <div role="radiogroup" aria-label={rotuloAcessivel} className="flex flex-wrap gap-2">
      {opcoes.map((opcao) => {
        const ativo = opcao.valor === valor
        return (
          <button
            key={opcao.valor}
            type="button"
            role="radio"
            aria-checked={ativo}
            onClick={() => aoMudar(opcao.valor)}
            className={cn(
              'inline-flex h-10 items-center rounded-full border px-4 text-sm font-medium transition-colors',
              ativo
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border/70 bg-card text-muted-foreground hover:bg-accent hover:text-foreground'
            )}
          >
            {opcao.rotulo}
          </button>
        )
      })}
    </div>
  )
}
