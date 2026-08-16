import type { DemoAction } from '../types'
import { isElementVisible, waitForElement } from './dom'

/**
 * Executor de demonstrações — simula um humano usando o sistema.
 *
 * Um cursor animado se move até o elemento, faz um "clique" visual e dispara
 * os eventos reais de pointer/mouse, de modo que menus (Radix), abas e
 * navegações reajam como reagiriam a um clique do usuário.
 *
 * O cursor é imperativo (fora do React): existe só durante a demonstração e
 * é removido ao final — custo zero fora dela.
 */

const CURSOR_ID = 'onboarding-demo-cursor'
const MOVE_MS = 650

const ensureCursor = (): HTMLDivElement => {
  const existing = document.getElementById(CURSOR_ID)
  if (existing) return existing as HTMLDivElement

  const cursor = document.createElement('div')
  cursor.id = CURSOR_ID
  cursor.setAttribute('aria-hidden', 'true')

  const cursorStyles: Partial<CSSStyleDeclaration> = {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '22px',
    height: '22px',
    borderRadius: '9999px',
    background: 'rgba(2, 150, 249, 0.9)',
    border: '2.5px solid #fff',
    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.35)',
    zIndex: '10001',
    pointerEvents: 'none',
    opacity: '0',
    transform: 'translate(-50%, -50%)',
    transition: `left ${MOVE_MS}ms cubic-bezier(0.22, 1, 0.36, 1), top ${MOVE_MS}ms cubic-bezier(0.22, 1, 0.36, 1), opacity 200ms ease, scale 150ms ease`,
  }
  Object.assign(cursor.style, cursorStyles)

  cursor.style.left = `${window.innerWidth / 2}px`
  cursor.style.top = `${window.innerHeight / 2}px`

  document.body.appendChild(cursor)
  return cursor
}

const removeCursor = () => {
  document.getElementById(CURSOR_ID)?.remove()
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const moveCursorTo = async (cursor: HTMLDivElement, x: number, y: number) => {
  cursor.style.opacity = '1'
  // Força um frame com a posição atual antes de animar até o destino.
  cursor.getBoundingClientRect()
  cursor.style.left = `${x}px`
  cursor.style.top = `${y}px`
  await sleep(MOVE_MS + 60)
}

const pulseCursor = async (cursor: HTMLDivElement) => {
  cursor.style.scale = '0.72'
  await sleep(140)
  cursor.style.scale = '1'
  await sleep(140)
}

/**
 * Dispara a sequência real de eventos de um clique humano.
 *
 * Radix abre menus no `pointerdown` (pointerType 'mouse'), então emitimos a
 * sequência de pointer + mouse. Ao final, `element.click()` garante o onClick
 * do React uma única vez.
 */
const dispatchClick = (element: HTMLElement, x: number, y: number, double = false) => {
  const base = { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, button: 0 }
  const pointer = { ...base, pointerId: 1, isPrimary: true, pointerType: 'mouse' }

  element.dispatchEvent(new PointerEvent('pointerover', pointer))
  element.dispatchEvent(new PointerEvent('pointerenter', pointer))
  element.dispatchEvent(new PointerEvent('pointerdown', pointer))
  element.dispatchEvent(new MouseEvent('mousedown', base))
  element.focus?.()
  element.dispatchEvent(new PointerEvent('pointerup', pointer))
  element.dispatchEvent(new MouseEvent('mouseup', base))

  if (double) {
    element.dispatchEvent(new MouseEvent('dblclick', base))
  } else {
    element.click()
  }
}

/** Localiza o alvo do clique, com filtro opcional por texto visível. */
const findClickTarget = async (
  selector: string,
  text?: string,
  timeoutMs = 6000,
): Promise<HTMLElement | null> => {
  if (!text) return waitForElement(selector, timeoutMs)

  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    const candidates = Array.from(document.querySelectorAll<HTMLElement>(selector)).filter(
      (element) =>
        isElementVisible(element) &&
        (element.textContent ?? '').toLowerCase().includes(text.toLowerCase()),
    )

    if (candidates.length > 0) return candidates[0]
    await sleep(150)
  }

  return null
}

/**
 * Executa a sequência de ações da demonstração.
 * Resolve com true se tudo foi executado; false se algum alvo não existir
 * (a etapa segue disponível para o usuário fazer manualmente).
 */
export const runDemo = async (actions: DemoAction[]): Promise<boolean> => {
  const cursor = ensureCursor()

  try {
    for (const action of actions) {
      if ('wait' in action) {
        await sleep(action.wait)
        continue
      }

      const selector = 'doubleClick' in action ? action.doubleClick : action.click
      const target = await findClickTarget(selector, action.text, action.timeoutMs)
      if (!target) return false

      target.scrollIntoView({ behavior: 'smooth', block: 'center' })
      await sleep(350)

      const rect = target.getBoundingClientRect()
      const x = rect.left + rect.width / 2
      const y = rect.top + rect.height / 2

      await moveCursorTo(cursor, x, y)
      await pulseCursor(cursor)
      dispatchClick(target, x, y, 'doubleClick' in action)
      await sleep(250)

      if (action.waitFor) {
        const appeared = await waitForElement(action.waitFor, 6000)
        if (!appeared) return false
      }
    }

    return true
  } finally {
    cursor.style.opacity = '0'
    setTimeout(removeCursor, 400)
  }
}
