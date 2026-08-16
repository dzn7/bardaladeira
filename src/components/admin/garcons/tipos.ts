export type GarcomComMetricas = {
  id: string
  nome: string
  nomeUsuario: string
  avatarUrl: string | null
  corAvatar: string
  ativo: boolean
  ultimoAcesso: string | null
  criadoEm: string
  pedidosCriadosTotal: number
  pedidosModificadosTotal: number
  pedidosCriadosHoje: number
  pedidosModificadosHoje: number
  itensAdicionadosHoje: number
  vendasHoje: number
  ticketMedioHoje: number
}
