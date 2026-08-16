'use client'

import { usePathname } from 'next/navigation'
import { HelpCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useOnboarding } from '../context'

/**
 * Botão flutuante "Ajuda" — canto inferior direito de todas as telas do admin.
 * Abre o painel de treinamentos. Some enquanto um tour está ativo (o próprio
 * tour já é a ajuda naquele momento).
 */

export const HelpButton = () => {
  const pathname = usePathname() ?? ''
  const { activeTour, openHelpPanel, overallProgress } = useOnboarding()

  // Só no admin (fora da tela de login), e nunca sobre um tour em andamento.
  if (!pathname.startsWith('/admin') || pathname.startsWith('/admin/login') || activeTour) {
    return null
  }

  return (
    <div className="fixed bottom-5 right-4 z-40">
      <Button
        variant="outline"
        size="sm"
        className="gap-2 rounded-full bg-background/95 shadow-sm backdrop-blur"
        onClick={openHelpPanel}
        aria-label="Abrir ajuda e treinamentos"
      >
        <HelpCircle className="h-4 w-4 text-primary" />
        Ajuda
        {overallProgress.percent > 0 && (
          <span className="text-xs text-muted-foreground">{overallProgress.percent}%</span>
        )}
      </Button>
    </div>
  )
}
