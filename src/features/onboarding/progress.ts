import { getAllTours, getTour } from './registry'
import type { OnboardingPersistedState, OverallProgress } from './types'

/**
 * Cálculo de progresso (gamificação): por tour, por módulo e total.
 * Derivado do estado persistido — nenhum cálculo contínuo.
 */

/** Percentual de conclusão de um tour (0–100). */
export const getTourPercent = (
  state: OnboardingPersistedState,
  tourId: string,
  totalSteps: number,
): number => {
  if (totalSteps === 0) return 0
  const progress = state.tours[tourId]
  if (!progress) return 0
  if (progress.status === 'completed') return 100
  const seen = Math.min(progress.seenSteps, totalSteps)
  return Math.round((seen / totalSteps) * 100)
}

export const getOverallProgress = (state: OnboardingPersistedState): OverallProgress => {
  const tours = getAllTours()
  const total = tours.length

  let completed = 0
  const moduleMap = new Map<string, { completed: number; total: number }>()

  for (const tour of tours) {
    const status = state.tours[tour.id]?.status
    const isDone = status === 'completed'
    if (isDone) completed += 1

    const bucket = moduleMap.get(tour.module) ?? { completed: 0, total: 0 }
    bucket.total += 1
    if (isDone) bucket.completed += 1
    moduleMap.set(tour.module, bucket)
  }

  const byModule = Array.from(moduleMap.entries()).map(([module, value]) => ({
    module,
    completed: value.completed,
    total: value.total,
    percent: value.total === 0 ? 0 : Math.round((value.completed / value.total) * 100),
  }))

  return {
    completed,
    total,
    percent: total === 0 ? 0 : Math.round((completed / total) * 100),
    byModule,
  }
}

/** Total de etapas de um tour (para % por tela). */
export const getTourTotalSteps = (tourId: string) => getTour(tourId)?.steps.length ?? 0
