'use client'

import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
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
    <div className={cn('overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm', className)}>
      <button
        type="button"
        onClick={handleToggle}
        className="flex w-full items-start justify-between gap-3 px-4 py-4 text-left transition-colors hover:bg-muted/30 md:px-5"
        aria-expanded={aberto}
        aria-controls={`painel-${id}`}
      >
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">{titulo}</h2>
          {descricao ? <p className="mt-0.5 text-xs text-muted-foreground">{descricao}</p> : null}
        </div>
        <ChevronDown
          className={cn(
            'mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
            aberto && 'rotate-180',
          )}
          strokeWidth={1.6}
        />
      </button>
      {aberto ? (
        <div id={`painel-${id}`} className="border-t border-border/60 px-4 pb-4 pt-3 md:px-5 md:pb-5">
          {children}
        </div>
      ) : null}
    </div>
  )
}
