'use client'

import { useEffect } from 'react'
import { useOnboarding } from '../context'
import { ativarPedidoDemo, limparPedidoDemo } from './painel-demo-store'

/**
 * Ponte entre o tour do Painel e o pedido de exemplo client-side.
 *
 * Mantém o engine genérico: o contexto não conhece o painel — este componente
 * observa o tour ativo e liga/desliga o pedido falso, que o board mescla na
 * coluna "Em análise". Nada é gravado no banco.
 */
export const PainelDemoBridge = () => {
  const { activeTour } = useOnboarding()
  const tourId = activeTour?.id ?? null

  useEffect(() => {
    if (tourId === 'painel') {
      ativarPedidoDemo()
      return () => limparPedidoDemo()
    }
    limparPedidoDemo()
    return undefined
  }, [tourId])

  return null
}
