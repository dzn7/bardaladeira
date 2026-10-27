'use client'

import type { ReactNode } from 'react'
import { CaretDown as ChevronDown } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

type SecaoRelatorioProps = {
  id: string
  titulo: string
  descricao?: string
  aberto: boolean
  onToggle: (id: string) => void
  children: ReactNode
  className?: string
}

export const SecaoRelatorio = ({
  id,
  titulo,
  descricao,
  aberto,
  onToggle,
  children,
  className,
}: SecaoRelatorioProps) => {
  const handleToggle = () => onToggle(id)

  return (
    <section className={cn('overflow-hidden rounded-xl border border-border/70 bg-card', className)}>
      <button
        type="button"
        onClick={handleToggle}
        className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring md:px-5"
        aria-expanded={aberto}
        aria-controls={`painel-${id}`}
      >
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">{titulo}</h2>
          {descricao ? <p className="mt-0.5 text-[13px] leading-5 text-muted-foreground">{descricao}</p> : null}
        </div>
        <ChevronDown
          className={cn(
            'size-4 shrink-0 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none',
            aberto && 'rotate-180',
          )}
          aria-hidden
        />
      </button>
      {aberto ? (
        <div id={`painel-${id}`} className="border-t border-border/70 px-4 pb-4 pt-3 md:px-5 md:pb-5">
          {children}
        </div>
      ) : null}
    </section>
  )
}
