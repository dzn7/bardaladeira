'use client'

import { useEffect } from 'react'
import { useOnboarding } from '../context'
import {
  abrirModalDemoCrediario,
  ativarContaDemoCrediario,
  fecharModalDemoCrediario,
  limparContaDemoCrediario,
  quitarContaDemoCrediario,
} from './crediario-demo-store'

/**
 * Ponte entre o tour de Crediário e a conta de demonstração client-side.
 *
 * Mantém o engine genérico: em vez de o contexto conhecer o crediário, este
 * componente observa o tour ativo e dirige a conta falsa.
 * - tour 'crediario' ativo  → cria a conta falsa (alvo da div interativa);
 * - etapas do modal          → abre o modal de exemplo;
 * - etapa de quitação        → marca a conta como quitada;
 * - tour encerrado/trocado   → remove a conta falsa (nada persiste no banco).
 */

// Etapas em que o modal de detalhes de exemplo deve estar aberto.
const ETAPAS_MODAL = new Set(['modal-visao', 'modal-pagamento', 'modal-quitar', 'modal-pdf'])
const ETAPA_QUITACAO = 'modal-quitar'

export const CrediarioDemoBridge = () => {
  const { activeTour, currentStep } = useOnboarding()
  const tourId = activeTour?.id ?? null
  const stepId = currentStep?.id ?? null

  useEffect(() => {
    if (tourId === 'crediario') {
      ativarContaDemoCrediario()
      return () => limparContaDemoCrediario()
    }
    limparContaDemoCrediario()
    return undefined
  }, [tourId])

  useEffect(() => {
    if (tourId !== 'crediario') return

    if (stepId && ETAPAS_MODAL.has(stepId)) {
      abrirModalDemoCrediario()
    } else {
      fecharModalDemoCrediario()
    }

    if (stepId === ETAPA_QUITACAO) {
      quitarContaDemoCrediario()
    }
  }, [tourId, stepId])

  return null
}
