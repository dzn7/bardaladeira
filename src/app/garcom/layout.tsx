'use client'

import { useEffect } from 'react'
import PWAManagerGarcom from '@/components/garcom/PWAManagerGarcom'
import { ControleAcessoProvider } from '@/contexts/ControleAcessoContext'

export default function GarcomRootLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Configura o manifest do PWA
    const linkManifest = document.querySelector('link[rel="manifest"]')
    if (linkManifest) {
      linkManifest.setAttribute('href', '/manifest-garcom.json')
    }

    // Configura a cor do tema
    const metaTheme = document.querySelector('meta[name="theme-color"]')
    if (metaTheme) {
      metaTheme.setAttribute('content', '#16a34a')
    }
  }, [])

  return (
    <ControleAcessoProvider>
      <PWAManagerGarcom />
      {children}
    </ControleAcessoProvider>
  )
}
