'use client'

import { type Icon } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

type CartaoEstatisticaProps = {
  titulo: string
  valor: string | number
  subtitulo?: string
  icone: Icon
  /** Mantido por compatibilidade; o visual agora usa só tokens. */
  corGradiente?: string
  delay?: number
  className?: string
}

/** Célula de número (KPI). Use dentro de uma grade com divisórias. */
export default function CartaoEstatistica({
  titulo,
  valor,
  subtitulo,
  icone: Icone,
  className,
}: CartaoEstatisticaProps) {
  return (
    <div className={cn('min-w-0 px-4 py-3.5 md:px-5 md:py-4', className)}>
      <p className="flex items-center gap-1.5 truncate text-[13px] text-muted-foreground">
        <Icone className="size-4 shrink-0" aria-hidden />
        {titulo}
      </p>
      <p className="mt-1 truncate text-lg font-semibold tabular-nums tracking-tight text-foreground md:text-xl">
        {valor}
      </p>
      {subtitulo && <p className="mt-0.5 truncate text-[13px] text-muted-foreground">{subtitulo}</p>}
    </div>
  )
}
