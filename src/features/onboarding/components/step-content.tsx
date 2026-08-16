'use client'

import {
  ArrowLeft,
  ArrowRight,
  EyeOff,
  FastForward,
  Loader2,
  MoreHorizontal,
  Pause,
  Play,
  RotateCcw,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Progress } from '@/components/ui/progress'
import { useOnboarding } from '../context'
import type { StepKind, TourStep } from '../types'

/**
 * Conteúdo de uma etapa do tour — compartilhado entre o popover (desktop) e o
 * slider inferior (mobile). Usa apenas primitivos do design system.
 */

const KIND_LABELS: Record<StepKind, string> = {
  problema: 'O problema',
  beneficio: 'Benefício',
  'caso-real': 'Caso real',
  demonstracao: 'Demonstração',
  pratica: 'Prática guiada',
  'proximo-passo': 'Próximo passo',
}

type StepContentProps = {
  step: TourStep
  waitingRouteLabel?: string | null
}

export const StepContent = ({ step, waitingRouteLabel }: StepContentProps) => {
  const {
    activeTour,
    stepIndex,
    isWaitingRoute,
    isDemoRunning,
    nextStep,
    prevStep,
    restartTour,
    pauseTour,
    skipTour,
    setDontShowAgain,
    runStepDemo,
    skipRouteBlock,
  } = useOnboarding()

  if (!activeTour) return null

  const total = activeTour.steps.length
  const isLast = stepIndex === total - 1
  const percent = Math.round(((stepIndex + 1) / total) * 100)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="font-normal">
            Etapa {stepIndex + 1} de {total}
          </Badge>
          {step.kind && (
            <Badge variant="outline" className="border-primary/40 font-normal text-primary">
              {KIND_LABELS[step.kind]}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground"
                aria-label="Mais opções do treinamento"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="z-[9999]">
              <DropdownMenuItem onClick={restartTour}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Reiniciar tour
              </DropdownMenuItem>
              <DropdownMenuItem onClick={pauseTour}>
                <Pause className="mr-2 h-4 w-4" />
                Pausar e continuar depois
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setDontShowAgain(activeTour.id)
                  skipTour()
                }}
              >
                <EyeOff className="mr-2 h-4 w-4" />
                Não mostrar novamente
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground"
            onClick={skipTour}
            aria-label="Encerrar treinamento"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Progress value={percent} className="h-1.5" />

      <div className="flex flex-col gap-1.5">
        <h3 className="text-base font-semibold leading-snug text-foreground">{step.title}</h3>
        <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
          {step.body}
        </p>
      </div>

      {waitingRouteLabel && (
        <div className="flex flex-col gap-2">
          <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
            {waitingRouteLabel}
          </p>
          {isWaitingRoute && (
            <Button
              variant="ghost"
              size="sm"
              className="justify-start gap-2 text-muted-foreground"
              onClick={skipRouteBlock}
            >
              <FastForward className="h-4 w-4" />
              Pular as etapas dessa tela
            </Button>
          )}
        </div>
      )}

      {step.demo && !isWaitingRoute && (
        <Button
          size="sm"
          className="justify-center gap-2"
          onClick={runStepDemo}
          disabled={isDemoRunning}
        >
          {isDemoRunning ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Demonstrando…
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              {step.demo.label ?? 'Ver na prática'}
            </>
          )}
        </Button>
      )}

      <div className="flex items-center justify-between pt-1">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1 text-muted-foreground"
          onClick={prevStep}
          disabled={stepIndex === 0 || isDemoRunning}
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>

        <Button size="sm" className="gap-1" onClick={nextStep} disabled={isDemoRunning}>
          {isLast ? 'Concluir' : 'Avançar'}
          {!isLast && <ArrowRight className="h-4 w-4" />}
        </Button>
      </div>

      <button
        type="button"
        onClick={skipTour}
        disabled={isDemoRunning}
        className="mx-auto -mt-1 text-xs font-normal text-muted-foreground/60 transition-colors hover:text-muted-foreground disabled:opacity-50"
      >
        Fechar onboarding
      </button>
    </div>
  )
}
