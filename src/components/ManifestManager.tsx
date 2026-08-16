'use client'

import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

export default function ManifestManager() {
  const pathname = usePathname()
  const isAdmin = pathname?.startsWith('/admin')
  const isGarcom = pathname?.startsWith('/garcom')

  useEffect(() => {
    // Remove manifests antigos
    const existingManifests = document.querySelectorAll('link[rel="manifest"]')
    existingManifests.forEach(link => link.remove())

    // Adiciona manifest correto baseado na rota
    const link = document.createElement('link')
    link.rel = 'manifest'
    
    if (isGarcom) {
      link.href = '/manifest-garcom.json'
    } else if (isAdmin) {
      link.href = '/manifest-admin.json'
    } else {
      link.href = '/manifest.json'
    }
    
    document.head.appendChild(link)

    console.log('[Manifest] Carregado:', link.href)

    return () => {
      link.remove()
    }
  }, [isAdmin, isGarcom])

  return null
}
