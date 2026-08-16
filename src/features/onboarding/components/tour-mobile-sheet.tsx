'use client'

import { motion } from 'framer-motion'
import type { TourStep } from '../types'
import { StepContent } from './step-content'

/**
 * Slider inferior do tour no mobile — fixo no rodapé, com as mesmas
 * informações e navegação do popover desktop (enxuto, com handle de arraste).
 */

type TourMobileSheetProps = {
  step: TourStep
  waitingRouteLabel?: string | null
}

export const TourMobileSheet = ({ step, waitingRouteLabel }: TourMobileSheetProps) => (
  <motion.div
    key={step.id}
    // pointer-events-auto é OBRIGATÓRIO: Radix Dialog/vaul são "modal" e
    // aplicam pointer-events:none no body enquanto abertos — sem isto o slider
    // fica visível porém sem receber toques (o tour não avança).
    // max-h + scroll interno: no mobile o modal real é um Drawer alto; o slider
    // nunca pode ocupar meia tela nem empurrar as ações para fora.
    className="pointer-events-auto fixed inset-x-0 bottom-0 z-[9995] flex max-h-[52dvh] flex-col rounded-t-xl border-t border-border/70 bg-popover p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-popover-foreground shadow-2xl"
    initial={{ y: '100%' }}
    animate={{ y: 0 }}
    exit={{ y: '100%' }}
    transition={{ type: 'spring', stiffness: 320, damping: 32 }}
    role="dialog"
    aria-label={step.title}
  >
    <div className="mx-auto mb-3 h-1.5 w-[80px] shrink-0 rounded-full bg-muted" />
    <div className="min-h-0 flex-1 overflow-y-auto">
      <StepContent step={step} waitingRouteLabel={waitingRouteLabel} />
    </div>
  </motion.div>
)
