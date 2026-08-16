/**
 * Utilitários DOM do engine de onboarding.
 *
 * waitForElement usa MutationObserver (sem polling contínuo) para detectar
 * quando o alvo de uma etapa aparece — essencial para continuidade entre
 * telas, modais e mudanças de estado.
 */

export const isElementVisible = (element: Element) => {
  const rect = element.getBoundingClientRect()
  if (rect.width === 0 && rect.height === 0) return false

  const style = window.getComputedStyle(element)
  return style.display !== 'none' && style.visibility !== 'hidden'
}

export const queryVisible = (selector: string): HTMLElement | null => {
  try {
    const candidates = Array.from(document.querySelectorAll<HTMLElement>(selector))
    return candidates.find(isElementVisible) ?? candidates[0] ?? null
  } catch {
    return null
  }
}

export const waitForElement = (selector: string, timeoutMs = 5000): Promise<HTMLElement | null> =>
  new Promise((resolve) => {
    const existing = queryVisible(selector)
    if (existing) {
      resolve(existing)
      return
    }

    let settled = false

    const finish = (element: HTMLElement | null) => {
      if (settled) return
      settled = true
      observer.disconnect()
      clearTimeout(timer)
      resolve(element)
    }

    const observer = new MutationObserver(() => {
      const found = queryVisible(selector)
      if (found) finish(found)
    })

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class', 'hidden'],
    })

    const timer = setTimeout(() => finish(null), timeoutMs)
  })
