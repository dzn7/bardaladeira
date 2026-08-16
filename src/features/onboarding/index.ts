/**
 * API pública do módulo de onboarding.
 *
 * O admin monta <OnboardingProvider> e <OnboardingRoot>. A conta de exemplo do
 * crediário é consumida pelo PainelCrediario, que a injeta na própria lista e
 * a exibe no MODAL REAL da tela (nunca um modal paralelo — ver AGENTS §5).
 */
export { OnboardingProvider, useOnboarding } from './context'
export { OnboardingRoot } from './components/onboarding-root'
export {
  useDemoCrediario,
  quitarContaDemoCrediario,
  CONTA_DEMO_ID,
  type ContaDemoCrediario,
  type ItemConsumoDemo,
} from './demo/crediario-demo-store'
export {
  useDemoFinancas,
  DIARIA_DEMO_ID,
  type DiariaDemoOnboarding,
} from './demo/financas-demo-store'
export {
  useDemoPainel,
  PEDIDO_DEMO_ID,
  type PedidoDemoOnboarding,
} from './demo/painel-demo-store'
