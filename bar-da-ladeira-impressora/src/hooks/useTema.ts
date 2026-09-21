import { useEffect } from 'react'
import type { ConfiguracaoAplicacao } from '../../electron/servicos/tipos'

type Tema = ConfiguracaoAplicacao['tema']

/**
 * Aplica o tema no <html>. No modo "sistema" acompanha a preferência do SO em
 * tempo real — a versão anterior lia matchMedia uma única vez e ficava presa no
 * tema errado até o app reiniciar.
 */
export const useTema = (tema: Tema) => {
  useEffect(() => {
    const elementoHtml = document.documentElement

    const aplicar = (escuro: boolean) => {
      elementoHtml.classList.toggle('dark', escuro)
      elementoHtml.style.colorScheme = escuro ? 'dark' : 'light'
    }

    if (tema === 'escuro' || tema === 'claro') {
      aplicar(tema === 'escuro')
      return
    }

    const consulta = window.matchMedia('(prefers-color-scheme: dark)')
    aplicar(consulta.matches)

    const aoMudar = (evento: MediaQueryListEvent) => aplicar(evento.matches)
    consulta.addEventListener('change', aoMudar)

    return () => consulta.removeEventListener('change', aoMudar)
  }, [tema])
}
