'use client'

import { CrediarioDemoBridge } from '../demo/CrediarioDemoBridge'
import { FinancasDemoBridge } from '../demo/FinancasDemoBridge'
import { PainelDemoBridge } from '../demo/PainelDemoBridge'
import { HelpButton } from './help-button'
import { HelpPanel } from './help-panel'
import { TourRenderer } from './tour-renderer'

// Registro config-driven de todos os tours (efeito colateral do import).
import '../config'

/**
 * Ponto único de montagem do onboarding no admin.
 *
 * Renderizado uma vez no layout do admin (client-side). Cada parte se
 * auto-regula: o botão de ajuda só aparece fora de um tour, o tour só monta
 * DOM quando ativo, e o painel só quando aberto.
 */
export const OnboardingRoot = () => (
  <>
    <TourRenderer />
    <HelpButton />
    <HelpPanel />
    <CrediarioDemoBridge />
    <FinancasDemoBridge />
    <PainelDemoBridge />
  </>
)

export default OnboardingRoot
