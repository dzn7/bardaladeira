'use client'

import { Info, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ChipFiltroAtivo = {
  key: string
  label: string
  value: string
}

type FiltrosAtivosChipsProps = {
  chips: ChipFiltroAtivo[]
  onLimpar: () => void
  className?: string
}

export const FiltrosAtivosChips = ({ chips, onLimpar, className }: FiltrosAtivosChipsProps) => {
  if (chips.length === 0) return null

  return (
    <div
      className={cn('flex w-full flex-wrap items-center gap-1.5', className)}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Info className="h-3.5 w-3.5 opacity-80" strokeWidth={1.6} aria-hidden />
        <p className="text-[13px]">Filtros ativos:</p>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {chips.map((chip) => (
          <span
            key={chip.key}
            className="inline-flex items-center gap-1 rounded-full bg-[#0399F9]/10 px-2 py-0.5 text-xs text-[#0369A1] dark:text-[#7DD3FC]"
          >
            <span className="font-medium">{chip.label}:</span>
            <span className="opacity-90">{chip.value}</span>
          </span>
        ))}
      </div>

      <button
        type="button"
        onClick={onLimpar}
        className="inline-flex h-7 items-center gap-1 rounded-full border border-border/70 bg-card px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label="Limpar todos os filtros"
      >
        <X className="h-3 w-3" strokeWidth={1.6} aria-hidden />
        Limpar tudo
      </button>
    </div>
  )
}
