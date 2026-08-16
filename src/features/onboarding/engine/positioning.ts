import type { StepPlacement } from '../types'
import type { TrackedRect } from './element-tracker'

/**
 * Posicionamento do popover do tour.
 *
 * Regras: nunca sair da tela nem cobrir o elemento destacado; inverter o
 * lado quando faltar espaço; em overflow, fixar no topo direito com padding.
 */

const GAP = 14
const MARGIN = 16
const FALLBACK_PADDING = 32

export type PopoverPosition = {
  top: number
  left: number
  placement: StepPlacement | 'fallback'
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

const fits = (
  top: number,
  left: number,
  width: number,
  height: number,
  viewportWidth: number,
  viewportHeight: number,
) =>
  top >= MARGIN &&
  left >= MARGIN &&
  top + height <= viewportHeight - MARGIN &&
  left + width <= viewportWidth - MARGIN

const positionFor = (
  placement: StepPlacement,
  target: TrackedRect,
  width: number,
  height: number,
): { top: number; left: number } => {
  switch (placement) {
    case 'top':
      return { top: target.top - height - GAP, left: target.left + target.width / 2 - width / 2 }
    case 'bottom':
      return { top: target.top + target.height + GAP, left: target.left + target.width / 2 - width / 2 }
    case 'left':
      return { top: target.top + target.height / 2 - height / 2, left: target.left - width - GAP }
    case 'right':
    default:
      return { top: target.top + target.height / 2 - height / 2, left: target.left + target.width + GAP }
  }
}

export const computePopoverPosition = (
  target: TrackedRect | null,
  popoverWidth: number,
  popoverHeight: number,
  preferred: StepPlacement = 'auto',
): PopoverPosition => {
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight

  if (!target || preferred === 'center') {
    return {
      top: viewportHeight / 2 - popoverHeight / 2,
      left: viewportWidth / 2 - popoverWidth / 2,
      placement: 'center',
    }
  }

  const order: StepPlacement[] =
    preferred === 'auto'
      ? ['bottom', 'top', 'right', 'left']
      : [
          preferred,
          preferred === 'top'
            ? 'bottom'
            : preferred === 'bottom'
              ? 'top'
              : preferred === 'left'
                ? 'right'
                : 'left',
          'bottom',
          'top',
          'right',
          'left',
        ]

  for (const placement of order) {
    const { top, left } = positionFor(placement, target, popoverWidth, popoverHeight)

    const adjustedLeft =
      placement === 'top' || placement === 'bottom'
        ? clamp(left, MARGIN, viewportWidth - popoverWidth - MARGIN)
        : left
    const adjustedTop =
      placement === 'left' || placement === 'right'
        ? clamp(top, MARGIN, viewportHeight - popoverHeight - MARGIN)
        : top

    if (fits(adjustedTop, adjustedLeft, popoverWidth, popoverHeight, viewportWidth, viewportHeight)) {
      return { top: adjustedTop, left: adjustedLeft, placement }
    }
  }

  // Overflow: caixa de ajuda sempre visível no topo superior direito.
  return {
    top: FALLBACK_PADDING,
    left: viewportWidth - popoverWidth - FALLBACK_PADDING,
    placement: 'fallback',
  }
}
