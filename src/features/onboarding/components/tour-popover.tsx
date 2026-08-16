'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import type { TrackedRect } from '../engine/element-tracker'
import { computePopoverPosition } from '../engine/positioning'
import type { TourStep } from '../types'
import { StepContent } from './step-content'

/**
 * Popover do tour (desktop).
 *
 * Mede o próprio tamanho e se reposiciona: nunca sai da tela, nunca cobre o
 * elemento destacado; em overflow, fixa no canto superior direito.
 */

type TourPopoverProps = {
  step: TourStep
  targetRect: TrackedRect | null
  waitingRouteLabel?: string | null
  /** Fixa o pop-up no canto superior direito (ex.: modal da aplicação aberto). */
  forceCorner?: boolean
}

const CORNER_PADDING = 32

export const TourPopover = ({ step, targetRect, waitingRouteLabel, forceCorner }: TourPopoverProps) => {
  const cardRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ top: -9999, left: -9999 })

  useLayoutEffect(() => {
    const card = cardRef.current
    if (!card) return

    const reposition = () => {
      const { width, height } = card.getBoundingClientRect()

      if (forceCorner) {
        // Canto INFERIOR ESQUERDO: com um modal da aplicação aberto, as ações
        // que o tour ensina (Receber/Quitar/PDF) ficam no topo-direito do
        // header — fixar ali cobriria justamente o que estamos ensinando.
        setPosition({
          top: window.innerHeight - height - CORNER_PADDING,
          left: CORNER_PADDING,
        })
        return
      }

      const next = computePopoverPosition(targetRect, width, height, step.placement ?? 'auto')
      setPosition({ top: next.top, left: next.left })
    }

    reposition()

    const observer = new ResizeObserver(reposition)
    observer.observe(card)
    return () => observer.disconnect()
  }, [targetRect, step, forceCorner])

  return (
    <motion.div
      ref={cardRef}
      key={step.id}
      // pointer-events-auto é OBRIGATÓRIO: Radix Dialog/vaul são "modal" e
      // aplicam pointer-events:none no body enquanto abertos — sem isto o
      // popover fica visível porém sem receber cliques (o tour não avança).
      className="pointer-events-auto fixed z-[9995] w-[380px] max-w-[calc(100vw-32px)] rounded-xl border border-border/70 bg-popover p-4 text-popover-foreground shadow-xl"
      style={{ top: position.top, left: position.left }}
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 4, scale: 0.98 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      role="dialog"
      aria-label={step.title}
    >
      <StepContent step={step} waitingRouteLabel={waitingRouteLabel} />
    </motion.div>
  )
}
