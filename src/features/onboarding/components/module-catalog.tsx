'use client'

import { CheckCircle2, PlayCircle, Trophy } from 'lucide-react'
import { GRUPOS_MENU_ADMIN } from '@/lib/admin-sidebar-routes'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { useOnboarding } from '../context'
import { getTourByRoute } from '../registry'

/**
 * Catálogo de treinamentos (gamificação).
 *
 * Reaproveita os grupos da sidebar (GRUPOS_MENU_ADMIN) como índice de módulos.
 * Cada item mostra o status do seu tour (Concluído / Continuar / Iniciar) ou
 * "Em breve" quando ainda não há treinamento registrado para a tela.
 */

const rotuloAcao = (status: string, percent: number) => {
  if (status === 'completed') return 'Rever'
  if (status === 'in-progress') return `Continuar (${percent}%)`
  return 'Iniciar'
}

export const ModuleCatalog = () => {
  const { overallProgress, getTourProgressPercent, getTourStatus, startTour } = useOnboarding()

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-border/70 bg-card p-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm font-medium">
            <Trophy className="h-4 w-4 text-primary" />
            Progresso do painel
          </span>
          <span className="text-sm font-semibold text-primary">{overallProgress.percent}%</span>
        </div>
        <Progress value={overallProgress.percent} className="h-2" />
        <p className="mt-2 text-xs text-muted-foreground">
          {overallProgress.completed} de {overallProgress.total} treinamentos concluídos
          {overallProgress.total > 0 &&
            overallProgress.percent === 100 &&
            ' — você dominou 100% do painel! 🏆'}
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {GRUPOS_MENU_ADMIN.map((grupo) => (
          <div key={grupo.titulo} className="flex flex-col gap-1">
            <span className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {grupo.titulo}
            </span>

            {grupo.itens.map((item) => {
              const tour = getTourByRoute(item.path)
              const Icone = item.icone

              if (!tour) {
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 opacity-60"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <Icone className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="truncate text-sm">{item.texto}</span>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">Em breve</span>
                  </div>
                )
              }

              const status = getTourStatus(tour.id)
              const percent = getTourProgressPercent(tour.id)
              const concluido = status === 'completed'

              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-muted/60"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    {concluido ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
                    ) : (
                      <PlayCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-sm">{item.texto}</span>
                      <span
                        className={cn(
                          'text-[11px]',
                          concluido ? 'text-green-500' : 'text-muted-foreground',
                        )}
                      >
                        {concluido
                          ? 'Concluído'
                          : status === 'in-progress'
                            ? 'Em andamento'
                            : 'Não iniciado'}
                      </span>
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 shrink-0 text-xs text-primary"
                    onClick={() => startTour(tour.id)}
                  >
                    {rotuloAcao(status, percent)}
                  </Button>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
