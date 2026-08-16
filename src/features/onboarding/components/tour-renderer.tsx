'use client'

import { useEffect } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useOnboarding } from '../context'
import { useTrackedRect } from '../engine/element-tracker'
import { useForeignDialog } from '../engine/use-foreign-dialog'
import { Spotlight } from './spotlight'
import { TourMobileSheet } from './tour-mobile-sheet'
import { TourPopover } from './tour-popover'

/**
 * Orquestra a renderização do tour ativo: spotlight + popover (desktop) ou
 * slider inferior (mobile). Só monta DOM quando existe tour em andamento —
 * custo zero para o resto do admin.
 */

export const TourRenderer = () => {
  const { activeTour, currentStep, targetElement, targetStatus, isWaitingRoute } = useOnboarding()
  const isMobile = useIsMobile()

  const rect = useTrackedRect(targetElement)
  const foreignDialogOpen = useForeignDialog(Boolean(activeTour))

  // Garante que o elemento destacado esteja visível ao trocar de etapa.
  useEffect(() => {
    if (!targetElement) return

    const box = targetElement.getBoundingClientRect()
    const fullyVisible =
      box.top >= 0 &&
      box.bottom <= window.innerHeight &&
      box.left >= 0 &&
      box.right <= window.innerWidth

    if (!fullyVisible) {
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [targetElement])

  if (!activeTour || !currentStep) return null

  const waitingRouteLabel = isWaitingRoute
    ? 'Esta etapa acontece em outra tela. Navegue até ela pelo menu — o treinamento continua automaticamente de onde parou.'
    : targetStatus === 'searching'
      ? 'Procurando o elemento nesta tela…'
      : null

  // O escurecimento só existe quando há um recorte (alvo encontrado) ou a
  // etapa é intencionalmente centralizada. Com um modal aberto, some de cena.
  const showSpotlight =
    !isWaitingRoute && !foreignDialogOpen && (targetStatus === 'none' || Boolean(rect))

  const popoverRect = foreignDialogOpen ? null : rect

  return (
    <div data-onboarding-ui>
      <AnimatePresence>
        {showSpotlight && (
          <Spotlight
            key="onboarding-spotlight"
            rect={rect}
            padding={currentStep.spotlightPadding}
            radius={currentStep.spotlightRadius}
          />
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {isMobile ? (
          <TourMobileSheet
            key={currentStep.id}
            step={currentStep}
            waitingRouteLabel={waitingRouteLabel}
          />
        ) : (
          <TourPopover
            key={currentStep.id}
            step={currentStep}
            targetRect={popoverRect}
            forceCorner={foreignDialogOpen}
            waitingRouteLabel={waitingRouteLabel}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
