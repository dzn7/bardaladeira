'use client'

import { useEffect, useState } from 'react'

/** Abaixo disso a diferença é barra do browser/arredondamento, não teclado. */
const ALTURA_MINIMA_TECLADO = 60

export type AjusteTecladoVirtual = {
  /** Altura da área realmente visível enquanto o teclado está aberto. */
  altura: number
  /** Quanto o teclado cobre a partir da base do viewport de layout. */
  base: number
}

/**
 * Mede o teclado virtual pelo `visualViewport` e devolve a geometria da área
 * visível, para que um painel `fixed bottom-0` (Drawer do Vaul) possa se
 * encaixar nela em vez de ficar atrás do teclado.
 *
 * Devolve `null` — deixando o CSS padrão valer — quando o teclado está fechado,
 * quando há pinch-zoom ou quando o browser não expõe `visualViewport`. O valor é
 * sempre derivado da medida atual, nunca de um estado acumulado: o Vaul erra aqui
 * justamente porque alterna um booleano a cada `resize`, e Safari/Chromium emitem
 * vários eventos durante a animação do teclado.
 */
export function useAjusteTecladoVirtual(ativo: boolean): AjusteTecladoVirtual | null {
  const [ajuste, setAjuste] = useState<AjusteTecladoVirtual | null>(null)

  useEffect(() => {
    if (!ativo || typeof window === 'undefined') return

    const viewport = window.visualViewport
    if (!viewport) return

    let frame = 0

    const atualizar = () => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => {
        const coberto = window.innerHeight - viewport.height - viewport.offsetTop

        if (viewport.scale > 1 || coberto < ALTURA_MINIMA_TECLADO) {
          setAjuste((anterior) => (anterior === null ? anterior : null))
          return
        }

        const altura = Math.round(viewport.height)
        const base = Math.round(coberto)
        setAjuste((anterior) =>
          anterior && anterior.altura === altura && anterior.base === base
            ? anterior
            : { altura, base },
        )
      })
    }

    atualizar()
    viewport.addEventListener('resize', atualizar)
    viewport.addEventListener('scroll', atualizar)

    return () => {
      window.cancelAnimationFrame(frame)
      viewport.removeEventListener('resize', atualizar)
      viewport.removeEventListener('scroll', atualizar)
      setAjuste(null)
    }
  }, [ativo])

  return ajuste
}
