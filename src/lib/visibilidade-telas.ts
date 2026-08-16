export type ConfigVisibilidadeTela = {
  id: string
  visible: boolean
}

export type TelaGarcom = {
  id: string
  texto: string
}

export const TELAS_GARCOM: TelaGarcom[] = [
  { id: '/garcom/mesas', texto: 'Mesas' },
  { id: '/garcom', texto: 'Pedidos' },
  { id: '/garcom/novo', texto: 'Novo pedido' },
]

const ROTA_PERMITIDA = /^\/(admin|garcom)(\/[a-z0-9-]+)*$/

export const normalizarConfigVisibilidade = (
  valor: unknown,
): ConfigVisibilidadeTela[] | null => {
  if (!Array.isArray(valor) || valor.length > 100) return null

  const porId = new Map<string, ConfigVisibilidadeTela>()
  for (const entrada of valor) {
    if (!entrada || typeof entrada !== 'object') continue
    const item = entrada as Record<string, unknown>
    if (typeof item.id !== 'string') continue

    const id = item.id.trim().toLowerCase()
    if (!ROTA_PERMITIDA.test(id)) continue
    porId.set(id, { id, visible: item.visible !== false })
  }

  return Array.from(porId.values())
}

export const telaEstaVisivel = (
  config: ConfigVisibilidadeTela[] | null | undefined,
  id: string,
) => config?.find((item) => item.id === id)?.visible !== false

