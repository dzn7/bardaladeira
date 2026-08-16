'use client'

import { useEffect } from 'react'
import PWAManagerEntregador from '@/components/entregador/PWAManagerEntregador'
import { ControleAcessoProvider } from '@/contexts/ControleAcessoContext'

export default function EntregadorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  useEffect(() => {
    const linkManifest = document.querySelector('link[rel="manifest"]')
    if (linkManifest) {
      linkManifest.setAttribute('href', '/manifest-entregador.json')
    }

    const metaTheme = document.querySelector('meta[name="theme-color"]')
    if (metaTheme) {
      metaTheme.setAttribute('content', '#22c55e')
    }
  }, [])

  return (
    <ControleAcessoProvider>
      <PWAManagerEntregador />
      {children}
    </ControleAcessoProvider>
  )
}
