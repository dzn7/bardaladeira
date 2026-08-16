'use client'

import { useEffect } from 'react'
import { useOnboarding } from '../context'
import { ativarDiariaDemo, limparDiariaDemo } from './financas-demo-store'

/**
 * Ponte entre o tour de Finanças e a diária de exemplo client-side.
 *
 * Mantém o engine genérico: o contexto não conhece finanças — este componente
 * observa o tour ativo e liga/desliga a diária falsa, que o PainelDiarias
 * mescla no calendário/lista reais. Nada é gravado no banco.
 */
export const FinancasDemoBridge = () => {
  const { activeTour } = useOnboarding()
  const tourId = activeTour?.id ?? null

  useEffect(() => {
    if (tourId === 'financas') {
      ativarDiariaDemo()
      return () => limparDiariaDemo()
    }
    limparDiariaDemo()
    return undefined
  }, [tourId])

  return null
}
