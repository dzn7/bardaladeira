import { useSyncExternalStore } from 'react'

/**
 * Store externa da DIÁRIA de exemplo usada pelo tour de Finanças.
 *
 * Regra do projeto (AGENTS.md §0.2.5 e §0.2.6): o dado de demonstração é
 * SIMULADO no cliente e alimenta a UI REAL (o calendário/lista de diárias do
 * PainelDiarias) — nunca grava em `financas_diarias`/`movimentacoes_caixa` e
 * nunca cria componente paralelo. É removido ao encerrar o tour.
 */

/** id estável para o alvo do tour e para blindar as ações por id. */
export const DIARIA_DEMO_ID = 'onboarding-demo-diaria'

export type DiariaDemoOnboarding = {
  id: string
  nome_pessoa: string
  valor: number
  forma_pagamento: string
  observacoes: string
}

export type EstadoDemoFinancas = {
  diaria: DiariaDemoOnboarding | null
}

const criarDiariaDemo = (): DiariaDemoOnboarding => ({
  id: DIARIA_DEMO_ID,
  nome_pessoa: 'Diarista Demonstração (tutorial)',
  valor: 80,
  forma_pagamento: 'Dinheiro',
  observacoes: 'Exemplo criado pelo tutorial — some ao encerrar.',
})

let estado: EstadoDemoFinancas = { diaria: null }
const listeners = new Set<() => void>()

const setEstado = (proximo: EstadoDemoFinancas) => {
  estado = proximo
  listeners.forEach((listener) => listener())
}

/** Ativa a diária falsa (chamado ao iniciar o tour de finanças). */
export const ativarDiariaDemo = () => {
  if (estado.diaria) return
  setEstado({ diaria: criarDiariaDemo() })
}

/** Remove a diária falsa (fim/abandono do tour). */
export const limparDiariaDemo = () => {
  if (!estado.diaria) return
  setEstado({ diaria: null })
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const getSnapshot = () => estado
const getServerSnapshot = () => estado

/** Lê a diária de exemplo reativamente (usado pelo PainelDiarias). */
export const useDemoFinancas = () =>
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
