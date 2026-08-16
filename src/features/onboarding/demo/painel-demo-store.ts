import { useSyncExternalStore } from 'react'

/**
 * Store externa do PEDIDO de exemplo usado pelo tour do Painel (Kanban).
 *
 * Regra do projeto (AGENTS.md §0.2.5 e §0.2.6): o dado de demonstração é
 * SIMULADO no cliente e alimenta o board REAL — nunca grava em `pedidos` nem
 * dispara impressão/status, e nunca cria componente paralelo. É removido ao
 * encerrar o tour.
 */

/** id estável para o alvo do tour e para blindar as ações por id. */
export const PEDIDO_DEMO_ID = 'onboarding-demo-pedido'

export type ItemPedidoDemo = {
  nome: string
  quantidade: number
  precoUnitario: number
}

export type PedidoDemoOnboarding = {
  id: string
  nome_cliente: string
  telefone: string
  bairro: string
  endereco: string
  forma_pagamento: string
  taxa_entrega: number
  itens: ItemPedidoDemo[]
}

const ITENS_DEMO: ItemPedidoDemo[] = [
  { nome: 'X-Burger', quantidade: 2, precoUnitario: 15 },
  { nome: 'Refrigerante lata', quantidade: 1, precoUnitario: 7.5 },
]

const criarPedidoDemo = (): PedidoDemoOnboarding => ({
  id: PEDIDO_DEMO_ID,
  nome_cliente: 'Pedido Demonstração (tutorial)',
  telefone: '(00) 90000-0000',
  bairro: 'Centro',
  endereco: 'Rua do Exemplo, 123',
  forma_pagamento: 'Dinheiro',
  taxa_entrega: 5,
  itens: ITENS_DEMO,
})

export type EstadoDemoPainel = {
  pedido: PedidoDemoOnboarding | null
}

let estado: EstadoDemoPainel = { pedido: null }
const listeners = new Set<() => void>()

const setEstado = (proximo: EstadoDemoPainel) => {
  estado = proximo
  listeners.forEach((listener) => listener())
}

/** Ativa o pedido falso (chamado ao iniciar o tour do painel). */
export const ativarPedidoDemo = () => {
  if (estado.pedido) return
  setEstado({ pedido: criarPedidoDemo() })
}

/** Remove o pedido falso (fim/abandono do tour). */
export const limparPedidoDemo = () => {
  if (!estado.pedido) return
  setEstado({ pedido: null })
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const getSnapshot = () => estado
const getServerSnapshot = () => estado

/** Lê o pedido de exemplo reativamente (usado pelo board do Painel). */
export const useDemoPainel = () => useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
