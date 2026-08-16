'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useAdminAuth } from '@/contexts/AdminAuthContext'
import { runDemo } from './engine/demo-runner'
import { waitForElement } from './engine/dom'
import { routeMatches, routeMatchesPrefix } from './engine/route-match'
import { getOverallProgress, getTourPercent, getTourTotalSteps } from './progress'
import { getAllTours, getTour, getTourByRoute } from './registry'
import { defaultState, loadState, saveState } from './storage'
import type {
  OnboardingPersistedState,
  OverallProgress,
  TourConfig,
  TourStep,
} from './types'

/**
 * Estado global do onboarding.
 *
 * Provider montado uma vez no admin; todo o resto (spotlight, popover, painel
 * de ajuda) consome este contexto. Nenhuma tela do admin conhece o onboarding.
 */

type TargetStatus = 'none' | 'searching' | 'found' | 'not-found'

type OnboardingContextValue = {
  activeTour: TourConfig | null
  stepIndex: number
  currentStep: TourStep | null
  targetElement: HTMLElement | null
  targetStatus: TargetStatus
  isWaitingRoute: boolean
  isDemoRunning: boolean
  isHelpPanelOpen: boolean
  trainingMode: boolean
  overallProgress: OverallProgress
  getTourProgressPercent: (tourId: string) => number
  getTourStatus: (tourId: string) => string
  startTour: (tourId: string, atStep?: number) => void
  startTourForCurrentRoute: () => void
  nextStep: () => void
  prevStep: () => void
  goToStep: (index: number) => void
  restartTour: () => void
  pauseTour: () => void
  skipTour: () => void
  completeTour: () => void
  setTrainingMode: (enabled: boolean) => void
  setDontShowAgain: (tourId: string) => void
  openHelpPanel: () => void
  closeHelpPanel: () => void
  runStepDemo: () => void
  skipRouteBlock: () => void
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null)

const SKIP_MESSAGE =
  'Sempre que precisar, clique no botão de ajuda desta tela para rever o tutorial ou acompanhar seu progresso.'

export const OnboardingProvider = ({ children }: { children: ReactNode }) => {
  const router = useRouter()
  const pathname = usePathname() ?? ''
  const { usuarioAtual } = useAdminAuth()
  const userId = usuarioAtual?.id ?? 'default'

  const [persisted, setPersisted] = useState<OnboardingPersistedState>(defaultState)
  const [activeTourId, setActiveTourId] = useState<string | null>(null)
  const [stepIndex, setStepIndex] = useState(0)
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null)
  const [targetStatus, setTargetStatus] = useState<TargetStatus>('none')
  const [isWaitingRoute, setIsWaitingRoute] = useState(false)
  const [isDemoRunning, setIsDemoRunning] = useState(false)
  const [isHelpPanelOpen, setIsHelpPanelOpen] = useState(false)
  const [isHydrated, setIsHydrated] = useState(false)

  const demoRunningRef = useRef(false)
  const stepIndexRef = useRef(stepIndex)

  useEffect(() => {
    stepIndexRef.current = stepIndex
  }, [stepIndex])

  const isOnStepRoute = useCallback(
    (stepRoute: string) => routeMatches(stepRoute, pathname),
    [pathname],
  )

  // Carrega o progresso salvo assim que o usuário é conhecido.
  useEffect(() => {
    setPersisted(loadState(userId))
    setIsHydrated(true)
  }, [userId])

  const persist = useCallback(
    (updater: (state: OnboardingPersistedState) => OnboardingPersistedState) => {
      setPersisted((prev) => {
        const next = updater(prev)
        saveState(userId, next)
        return next
      })
    },
    [userId],
  )

  const activeTour = useMemo(
    () => (activeTourId ? getTour(activeTourId) ?? null : null),
    [activeTourId],
  )

  const currentStep = activeTour?.steps[stepIndex] ?? null

  const updateTourProgress = useCallback(
    (tourId: string, status: 'in-progress' | 'completed' | 'skipped', index: number) => {
      persist((state) => {
        const prev = state.tours[tourId]
        const total = getTourTotalSteps(tourId)
        const seen =
          status === 'completed' ? total : Math.max(prev?.seenSteps ?? 0, index + 1)

        return {
          ...state,
          tours: {
            ...state.tours,
            [tourId]: {
              status,
              stepIndex: index,
              seenSteps: seen,
              updatedAt: new Date().toISOString(),
            },
          },
        }
      })
    },
    [persist],
  )

  const startTour = useCallback(
    (tourId: string, atStep?: number) => {
      const tour = getTour(tourId)
      if (!tour || tour.steps.length === 0) return

      const saved = persisted.tours[tourId]
      const resumeAt =
        atStep ??
        (saved?.status === 'in-progress'
          ? Math.min(saved.stepIndex, tour.steps.length - 1)
          : 0)

      setIsHelpPanelOpen(false)
      setActiveTourId(tourId)
      setStepIndex(resumeAt)
      updateTourProgress(tourId, 'in-progress', resumeAt)

      // A primeira etapa pode morar em outra rota — leva o usuário até lá.
      const stepRoute = tour.steps[resumeAt]?.route ?? tour.routes[0]
      if (
        !tour.virtualRoute &&
        stepRoute &&
        !routeMatchesPrefix(stepRoute, pathname)
      ) {
        router.push(stepRoute)
      }
    },
    [persisted.tours, pathname, router, updateTourProgress],
  )

  const startTourForCurrentRoute = useCallback(() => {
    const tour = getTourByRoute(pathname)
    if (tour) startTour(tour.id)
  }, [pathname, startTour])

  const stopTour = useCallback(() => {
    setActiveTourId(null)
    setStepIndex(0)
    setTargetElement(null)
    setIsWaitingRoute(false)
  }, [])

  const completeTour = useCallback(() => {
    if (!activeTourId) return
    updateTourProgress(activeTourId, 'completed', stepIndex)
    stopTour()
    toast.success('Treinamento concluído! Progresso salvo. 🎉')
  }, [activeTourId, stepIndex, stopTour, updateTourProgress])

  const goToStep = useCallback(
    (index: number) => {
      if (!activeTour || !activeTourId) return

      if (index >= activeTour.steps.length) {
        completeTour()
        return
      }

      const bounded = Math.max(0, index)
      setStepIndex(bounded)
      updateTourProgress(activeTourId, 'in-progress', bounded)
    },
    [activeTour, activeTourId, completeTour, updateTourProgress],
  )

  /**
   * Avança até a próxima etapa compatível com a rota atual — usado para pular
   * blocos inteiros (ex.: etapas que dependem de registros inexistentes).
   */
  const skipToCompatibleStep = useCallback(
    (fromIndex: number) => {
      if (!activeTour) return

      for (let i = fromIndex; i < activeTour.steps.length; i += 1) {
        const step = activeTour.steps[i]
        if (!step.route || isOnStepRoute(step.route)) {
          goToStep(i)
          return
        }
      }

      completeTour()
    },
    [activeTour, completeTour, goToStep, isOnStepRoute],
  )

  const nextStep = useCallback(() => goToStep(stepIndex + 1), [goToStep, stepIndex])
  const prevStep = useCallback(() => goToStep(stepIndex - 1), [goToStep, stepIndex])
  const restartTour = useCallback(() => goToStep(0), [goToStep])

  const pauseTour = useCallback(() => {
    if (activeTourId) updateTourProgress(activeTourId, 'in-progress', stepIndex)
    stopTour()
    toast.info('Treinamento pausado. Retome pelo botão de ajuda quando quiser.')
  }, [activeTourId, stepIndex, stopTour, updateTourProgress])

  const skipTour = useCallback(() => {
    if (activeTourId) updateTourProgress(activeTourId, 'skipped', stepIndex)
    // Fechar o onboarding desliga o início automático em TODAS as telas.
    persist((state) => ({
      ...state,
      preferences: {
        ...state.preferences,
        autoStart: false,
        updatedAt: new Date().toISOString(),
      },
    }))
    stopTour()
    toast.info(SKIP_MESSAGE, { duration: 7000 })
  }, [activeTourId, persist, stepIndex, stopTour, updateTourProgress])

  const setDontShowAgain = useCallback(
    (tourId: string) => {
      persist((state) => ({
        ...state,
        preferences: {
          ...state.preferences,
          dontShowAgain: Array.from(new Set([...state.preferences.dontShowAgain, tourId])),
          updatedAt: new Date().toISOString(),
        },
      }))
    },
    [persist],
  )

  const setTrainingMode = useCallback(
    (enabled: boolean) => {
      persist((state) => ({
        ...state,
        preferences: {
          ...state.preferences,
          trainingMode: enabled,
          autoStart: enabled ? true : state.preferences.autoStart,
          updatedAt: new Date().toISOString(),
        },
      }))
    },
    [persist],
  )

  // ── Demonstração ao vivo (cursor simulado executa os cliques) ───────────
  const runStepDemo = useCallback(async () => {
    const demo = currentStep?.demo
    if (!demo || demoRunningRef.current) return

    demoRunningRef.current = true
    setIsDemoRunning(true)

    const startIndex = stepIndex

    try {
      const completed = await runDemo(demo.actions)

      if (completed) {
        if (stepIndexRef.current === startIndex) {
          goToStep(startIndex + 1)
        }
      } else {
        toast.info('Não consegui demonstrar agora — você pode fazer manualmente ou avançar.')
      }
    } finally {
      demoRunningRef.current = false
      setIsDemoRunning(false)
    }
  }, [currentStep, goToStep, stepIndex])

  const skipRouteBlock = useCallback(
    () => skipToCompatibleStep(stepIndex + 1),
    [skipToCompatibleStep, stepIndex],
  )

  // ── Resolução do alvo da etapa atual ────────────────────────────────────
  useEffect(() => {
    if (!currentStep) {
      setTargetElement(null)
      setTargetStatus('none')
      setIsWaitingRoute(false)
      return
    }

    if (currentStep.route && !isOnStepRoute(currentStep.route)) {
      setIsWaitingRoute(true)
      setTargetElement(null)
      setTargetStatus('none')
      return
    }

    setIsWaitingRoute(false)

    let cancelled = false

    const resolveHighlight = () => {
      if (!currentStep.target) {
        setTargetElement(null)
        setTargetStatus('none')
        return
      }

      setTargetStatus('searching')
      waitForElement(currentStep.target, 4000).then((element) => {
        if (cancelled) return

        if (!element && currentStep.skipIfMissing && !currentStep.conditionTarget) {
          skipToCompatibleStep(stepIndex + 1)
          return
        }

        setTargetElement(element)
        setTargetStatus(element ? 'found' : 'not-found')
      })
    }

    const conditionSelector = currentStep.conditionTarget ?? currentStep.target

    if (currentStep.skipIfPresent && conditionSelector) {
      setTargetElement(null)
      setTargetStatus('none')
      waitForElement(conditionSelector, 1000).then((element) => {
        if (cancelled) return
        if (element) {
          skipToCompatibleStep(stepIndex + 1)
          return
        }
        resolveHighlight()
      })
      return () => {
        cancelled = true
      }
    }

    if (currentStep.skipIfMissing && currentStep.conditionTarget) {
      setTargetElement(null)
      setTargetStatus('searching')
      waitForElement(currentStep.conditionTarget, 4000).then((element) => {
        if (cancelled) return
        if (!element) {
          skipToCompatibleStep(stepIndex + 1)
          return
        }
        resolveHighlight()
      })
      return () => {
        cancelled = true
      }
    }

    resolveHighlight()

    return () => {
      cancelled = true
    }
  }, [currentStep, pathname, isOnStepRoute, skipToCompatibleStep, stepIndex])

  // ── Fluxo adaptativo: avança quando o usuário faz a ação esperada ───────
  useEffect(() => {
    const advance = currentStep?.advanceOn
    if (!advance || !activeTourId) return

    if (advance.type === 'click') {
      const selector = advance.selector ?? currentStep?.target
      if (!selector) return

      const onClick = (event: MouseEvent) => {
        if (demoRunningRef.current) return
        const target = event.target as Element | null
        if (target?.closest(selector)) {
          setTimeout(() => goToStep(stepIndex + 1), 350)
        }
      }

      document.addEventListener('click', onClick, true)
      return () => document.removeEventListener('click', onClick, true)
    }

    if (advance.type === 'element-visible') {
      let cancelled = false
      waitForElement(advance.selector, 60000).then((element) => {
        if (!cancelled && element) goToStep(stepIndex + 1)
      })
      return () => {
        cancelled = true
      }
    }

    return undefined
  }, [activeTourId, currentStep, goToStep, stepIndex])

  const maybeAutoStart = useCallback(
    (path: string) => {
      const tour = getTourByRoute(path)
      if (!tour) return
      if (!routeMatches(tour.routes[0], path)) return
      if (!persisted.preferences.autoStart) return
      if (persisted.preferences.dontShowAgain.includes(tour.id)) return
      if (tour.autoStart === false) return

      const progress = persisted.tours[tour.id]
      const shouldStart =
        !progress ||
        (progress.status === 'in-progress' && persisted.preferences.trainingMode)

      if (shouldStart) startTour(tour.id)
    },
    [persisted, startTour],
  )

  // ── Continuidade entre rotas + auto-start (efeito por pathname) ──────────
  useEffect(() => {
    if (!isHydrated) return

    const tour = getTour(activeTourId ?? '')
    const step = tour?.steps[stepIndex]

    // 1. Tour ativo aguardando navegação: já está na rota certa — segue.
    if (activeTourId && step?.route && routeMatches(step.route, pathname)) {
      return
    }

    // 2. Avanço por rota (advanceOn: route).
    if (
      activeTourId &&
      step?.advanceOn?.type === 'route' &&
      routeMatchesPrefix(step.advanceOn.route, pathname)
    ) {
      goToStep(stepIndex + 1)
      return
    }

    // 3. Usuário saiu das rotas do tour ativo: pausa/conclui.
    if (activeTourId && tour) {
      const tourRoutes = [
        ...tour.routes,
        ...tour.steps.map((s) => s.route).filter(Boolean),
      ] as string[]
      const stillInside = tour.virtualRoute
        ? true
        : tourRoutes.some((route) => routeMatchesPrefix(route, pathname))

      if (!stillInside) {
        const isLastStep = stepIndex === tour.steps.length - 1
        updateTourProgress(activeTourId, isLastStep ? 'completed' : 'in-progress', stepIndex)
        stopTour()
        if (isLastStep) toast.success('Treinamento concluído! Progresso salvo. 🎉')
        maybeAutoStart(pathname)
      }
      return
    }

    // 4. Sem tour ativo: auto-start na primeira visita à tela.
    maybeAutoStart(pathname)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, isHydrated])

  const overallProgress = useMemo(() => getOverallProgress(persisted), [persisted])

  const getTourProgressPercent = useCallback(
    (tourId: string) => getTourPercent(persisted, tourId, getTourTotalSteps(tourId)),
    [persisted],
  )

  const getTourStatus = useCallback(
    (tourId: string) => persisted.tours[tourId]?.status ?? 'not-started',
    [persisted],
  )

  const value = useMemo<OnboardingContextValue>(
    () => ({
      activeTour,
      stepIndex,
      currentStep,
      targetElement,
      targetStatus,
      isWaitingRoute,
      isDemoRunning,
      isHelpPanelOpen,
      trainingMode: persisted.preferences.trainingMode,
      overallProgress,
      getTourProgressPercent,
      getTourStatus,
      startTour,
      startTourForCurrentRoute,
      nextStep,
      prevStep,
      goToStep,
      restartTour,
      pauseTour,
      skipTour,
      completeTour,
      setTrainingMode,
      setDontShowAgain,
      openHelpPanel: () => setIsHelpPanelOpen(true),
      closeHelpPanel: () => setIsHelpPanelOpen(false),
      runStepDemo,
      skipRouteBlock,
    }),
    [
      activeTour,
      stepIndex,
      currentStep,
      targetElement,
      targetStatus,
      isWaitingRoute,
      isDemoRunning,
      isHelpPanelOpen,
      persisted.preferences.trainingMode,
      overallProgress,
      getTourProgressPercent,
      getTourStatus,
      startTour,
      startTourForCurrentRoute,
      nextStep,
      prevStep,
      goToStep,
      restartTour,
      pauseTour,
      skipTour,
      completeTour,
      setTrainingMode,
      setDontShowAgain,
      runStepDemo,
      skipRouteBlock,
    ],
  )

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>
}

export const useOnboarding = () => {
  const context = useContext(OnboardingContext)
  if (!context) {
    throw new Error('useOnboarding deve ser usado dentro de OnboardingProvider')
  }
  return context
}

export { getAllTours }
