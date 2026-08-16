import { useSyncExternalStore } from 'react'

/**
 * Store externa da conta de crediário FALSA usada como alvo da div interativa.
 *
 * Regra do projeto (AGENTS.md §0.2.5): dados de demonstração do onboarding são
 * SIMULADOS no cliente — nunca gravados no Supabase. O tour injeta uma conta
 * fictícia (com consumos), abre um modal de exemplo e ensina a quitar / gerar
 * comprovante. Ao encerrar o tour, tudo é limpo. Nada persiste no banco.
 */

export type ItemConsumoDemo = {
  nome: string
  quantidade: number
  precoUnitario: number
}

export type ContaDemoCrediario = {
  id: string
  cliente_nome: string
  telefone: string | null
  saldo_atual: number
  status: 'aberto' | 'quitado'
  criado_em: string
  consumos: ItemConsumoDemo[]
}

export type EstadoDemoCrediario = {
  conta: ContaDemoCrediario | null
  modalAberto: boolean
}

/** id estável para o alvo do spotlight ancorar sempre na mesma linha. */
export const CONTA_DEMO_ID = 'onboarding-demo-crediario'

const CONSUMOS_DEMO: ItemConsumoDemo[] = [
  { nome: 'X-Burger', quantidade: 2, precoUnitario: 15 },
  { nome: 'Refrigerante lata', quantidade: 1, precoUnitario: 7.5 },
  { nome: 'Porção de batata', quantidade: 1, precoUnitario: 10 },
]

const totalConsumos = () =>
  CONSUMOS_DEMO.reduce((total, item) => total + item.quantidade * item.precoUnitario, 0)

const criarContaDemo = (): ContaDemoCrediario => ({
  id: CONTA_DEMO_ID,
  cliente_nome: 'Cliente Demonstração (tutorial)',
  telefone: '(00) 90000-0000',
  saldo_atual: totalConsumos(),
  status: 'aberto',
  criado_em: new Date().toISOString(),
  consumos: CONSUMOS_DEMO,
})

let estado: EstadoDemoCrediario = { conta: null, modalAberto: false }
const listeners = new Set<() => void>()

const setEstado = (proximo: EstadoDemoCrediario) => {
  estado = proximo
  listeners.forEach((listener) => listener())
}

/** Ativa a conta falsa (chamado ao iniciar o tour de crediário). */
export const ativarContaDemoCrediario = () => {
  if (estado.conta) return
  setEstado({ conta: criarContaDemo(), modalAberto: false })
}

/** Marca a conta falsa como quitada (etapa de "quitar dívida"). */
export const quitarContaDemoCrediario = () => {
  if (!estado.conta || estado.conta.status === 'quitado') return
  setEstado({ ...estado, conta: { ...estado.conta, status: 'quitado', saldo_atual: 0 } })
}

/** Abre / fecha o modal de detalhes de exemplo. */
export const abrirModalDemoCrediario = () => {
  if (!estado.conta || estado.modalAberto) return
  setEstado({ ...estado, modalAberto: true })
}

export const fecharModalDemoCrediario = () => {
  if (!estado.modalAberto) return
  setEstado({ ...estado, modalAberto: false })
}

/** Remove a conta falsa e fecha o modal (fim/abandono do tour). */
export const limparContaDemoCrediario = () => {
  if (!estado.conta && !estado.modalAberto) return
  setEstado({ conta: null, modalAberto: false })
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

const getSnapshot = () => estado
const getServerSnapshot = () => estado

/** Lê o estado da demo reativamente (conta + modal). */
export const useDemoCrediario = () =>
  useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
