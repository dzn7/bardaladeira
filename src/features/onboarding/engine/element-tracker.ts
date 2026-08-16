import { useEffect, useState } from 'react'

/**
 * Rastreia o retângulo de um elemento sem processamento contínuo:
 * ResizeObserver no elemento + listeners passivos de scroll/resize,
 * atualizações coalescidas via requestAnimationFrame.
 *
 * O spotlight nunca fica desalinhado em scroll, resize ou mudança de layout.
 */

export type TrackedRect = {
  top: number
  left: number
  width: number
  height: number
}

const rectsEqual = (a: TrackedRect | null, b: TrackedRect | null) => {
  if (!a || !b) return a === b
  return (
    Math.abs(a.top - b.top) < 0.5 &&
    Math.abs(a.left - b.left) < 0.5 &&
    Math.abs(a.width - b.width) < 0.5 &&
    Math.abs(a.height - b.height) < 0.5
  )
}

const readRect = (element: HTMLElement): TrackedRect => {
  const rect = element.getBoundingClientRect()
  return { top: rect.top, left: rect.left, width: rect.width, height: rect.height }
}

export const useTrackedRect = (element: HTMLElement | null) => {
  const [rect, setRect] = useState<TrackedRect | null>(element ? readRect(element) : null)

  useEffect(() => {
    if (!element) {
      setRect(null)
      return
    }

    let frame = 0
    let disposed = false

    const update = () => {
      frame = 0
      if (disposed || !element.isConnected) return
      const next = readRect(element)
      setRect((prev) => (rectsEqual(prev, next) ? prev : next))
    }

    const schedule = () => {
      if (frame) return
      frame = window.requestAnimationFrame(update)
    }

    schedule()

    const resizeObserver = new ResizeObserver(schedule)
    resizeObserver.observe(element)
    if (element.parentElement) resizeObserver.observe(element.parentElement)

    // Mudanças de layout que não redimensionam o alvo (ex.: sidebar
    // expandindo) movem o elemento — MutationObserver leve no body cobre isso.
    const mutationObserver = new MutationObserver(schedule)
    mutationObserver.observe(document.body, {
      attributes: true,
      subtree: true,
      attributeFilter: ['style', 'class'],
    })

    window.addEventListener('scroll', schedule, { passive: true, capture: true })
    window.addEventListener('resize', schedule, { passive: true })

    return () => {
      disposed = true
      if (frame) window.cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      mutationObserver.disconnect()
      window.removeEventListener('scroll', schedule, true)
      window.removeEventListener('resize', schedule)
    }
  }, [element])

  return rect
}
