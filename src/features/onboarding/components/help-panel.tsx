'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { BookOpen, ChevronDown, Compass, PlayCircle } from 'lucide-react'
import { ITENS_MENU_ADMIN, isRotaAtivaSidebar } from '@/lib/admin-sidebar-routes'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useIsMobile } from '@/hooks/useIsMobile'
import { cn } from '@/lib/utils'
import { useOnboarding } from '../context'
import { getTourByRoute } from '../registry'
import { ModuleCatalog } from './module-catalog'

/**
 * Painel "Ajuda" — launcher do tour da tela atual + catálogo de todos os
 * treinamentos + progresso. Sheet lateral no desktop e inferior no mobile.
 */

export const HelpPanel = () => {
  const pathname = usePathname() ?? ''
  const isMobile = useIsMobile()
  const { isHelpPanelOpen, closeHelpPanel, startTour } = useOnboarding()
  const [catalogoAberto, setCatalogoAberto] = useState(false)

  const tour = getTourByRoute(pathname)
  const itemAtual = ITENS_MENU_ADMIN.find((item) => isRotaAtivaSidebar(item.path, pathname))
  const nomeTela = tour?.name ?? itemAtual?.texto ?? 'painel'

  return (
    <Sheet open={isHelpPanelOpen} onOpenChange={(open) => !open && closeHelpPanel()}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={cn(
          'z-[9998] flex flex-col gap-0 border-0 p-0 shadow-2xl',
          isMobile ? 'h-[85vh] rounded-t-xl' : 'w-full sm:max-w-md',
        )}
      >
        <SheetHeader className="border-b border-border/70 p-4 text-left">
          <SheetTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            Ajuda · {nomeTela}
          </SheetTitle>
          <SheetDescription className="text-sm leading-relaxed">
            Tutorial guiado desta aba ou de todo o painel.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="flex flex-col gap-4 p-4">
            <p className="text-sm text-muted-foreground">
              Como você quer aprender <span className="font-semibold text-foreground">{nomeTela}</span>?
            </p>

            {tour && (
              <Button
                className="w-full justify-center gap-2"
                onClick={() => {
                  closeHelpPanel()
                  startTour(tour.id)
                }}
              >
                <BookOpen className="h-4 w-4" />
                Ver tutorial desta tela
              </Button>
            )}

            <Button
              variant="outline"
              className="w-full justify-between gap-2"
              onClick={() => setCatalogoAberto((aberto) => !aberto)}
              aria-expanded={catalogoAberto}
            >
              <span className="flex items-center gap-2">
                <Compass className="h-4 w-4" />
                {catalogoAberto ? 'Ocultar todos os treinamentos' : 'Ver todos os treinamentos'}
              </span>
              <ChevronDown
                className={cn('h-4 w-4 transition-transform', catalogoAberto && 'rotate-180')}
              />
            </Button>

            {catalogoAberto ? (
              <ModuleCatalog />
            ) : (
              <>
                <div className="rounded-lg border border-border/70 bg-card p-4">
                  <ProgressResumo />
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  O tutorial destaca os pontos importantes desta aba. Em &ldquo;Ver todos&rdquo; você
                  revisa qualquer módulo quando quiser.
                </p>
              </>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}

const ProgressResumo = () => {
  const { overallProgress } = useOnboarding()

  return (
    <>
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-medium">
          <PlayCircle className="h-4 w-4 text-primary" />
          Progresso do painel
        </span>
        <span className="text-sm font-semibold text-primary">{overallProgress.percent}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-primary/20">
        <div className="h-full bg-primary transition-all" style={{ width: `${overallProgress.percent}%` }} />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {overallProgress.completed} de {overallProgress.total} treinamentos concluídos
      </p>
    </>
  )
}
