'use client'

import { motion } from 'framer-motion'
import type { TrackedRect } from '../engine/element-tracker'

/**
 * Spotlight do onboarding.
 *
 * Escurece a interface mantendo um recorte no elemento destacado. O overlay
 * inteiro usa pointer-events: none, então o elemento (e o resto da tela)
 * permanece utilizável — cliques, menus e navegação funcionam normalmente.
 *
 * O recorte acompanha o retângulo real medido pelo element-tracker, então se
 * adapta ao formato do componente (botão, linha de tabela, aba).
 */

type SpotlightProps = {
  rect: TrackedRect | null
  padding?: number
  radius?: number
}

export const Spotlight = ({ rect, padding = 6, radius = 8 }: SpotlightProps) => {
  const cutout = rect
    ? {
        x: rect.left - padding,
        y: rect.top - padding,
        width: rect.width + padding * 2,
        height: rect.height + padding * 2,
      }
    : null

  return (
    <motion.div
      className="fixed inset-0 z-[9990] pointer-events-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      aria-hidden
    >
      <svg className="h-full w-full" role="presentation">
        <defs>
          <mask id="onboarding-spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {cutout && (
              <motion.rect
                initial={false}
                animate={{ x: cutout.x, y: cutout.y, width: cutout.width, height: cutout.height }}
                transition={{ type: 'spring', stiffness: 380, damping: 34 }}
                rx={radius}
                fill="black"
              />
            )}
          </mask>
        </defs>

        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(9, 12, 20, 0.62)"
          mask="url(#onboarding-spotlight-mask)"
        />

        {cutout && (
          <motion.rect
            initial={false}
            animate={{
              x: cutout.x,
              y: cutout.y,
              width: cutout.width,
              height: cutout.height,
              opacity: [0.9, 0.45, 0.9],
            }}
            transition={{
              x: { type: 'spring', stiffness: 380, damping: 34 },
              y: { type: 'spring', stiffness: 380, damping: 34 },
              width: { type: 'spring', stiffness: 380, damping: 34 },
              height: { type: 'spring', stiffness: 380, damping: 34 },
              opacity: { duration: 1.8, repeat: Infinity, ease: 'easeInOut' },
            }}
            rx={radius}
            fill="none"
            stroke="#0296F9"
            strokeWidth={2}
          />
        )}
      </svg>
    </motion.div>
  )
}
