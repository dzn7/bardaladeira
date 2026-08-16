export function nomeClientePessoalValido(
  valor: string | null | undefined,
  opcoes?: { localParceiro?: boolean }
): boolean

export function nomeClienteParaPedido(opcoes?: {
  nomeCliente?: string | null
  tipoEntrega?: string | null
  localParceiro?: boolean
}): string

export function nomeClienteParaPontoSalao(opcoes?: {
  nomeCliente?: string | null
  localParceiro?: boolean
}): string | null
