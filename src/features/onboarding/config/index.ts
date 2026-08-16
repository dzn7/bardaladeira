import { registerTour } from '../registry'
import { crediarioTour } from './crediario'
import { financasTour } from './financas'
import { painelTour } from './painel'

/**
 * Registro config-driven dos tours (efeito colateral do import em
 * onboarding-root.tsx). Novos módulos: crie o config e registre aqui.
 */
registerTour(painelTour)
registerTour(crediarioTour)
registerTour(financasTour)
