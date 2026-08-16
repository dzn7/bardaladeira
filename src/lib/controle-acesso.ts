import type { PapelUsuario } from '@/lib/autenticacao'

export const PERFIS_CONTROLADOS = ['garcom', 'entregador'] as const

export type PerfilControlado = (typeof PERFIS_CONTROLADOS)[number]
export type AcaoPermissao = 'ver' | 'criar' | 'editar' | 'excluir'

export const MODULOS_CONTROLE_ACESSO = [
  {
    id: 'garcom.pedidos',
    perfil: 'garcom',
    nome: 'Pedidos do garçom',
    descricao: 'Lista, criação e alteração de pedidos.',
    acoes: ['ver', 'criar', 'editar', 'excluir'],
  },
  {
    id: 'garcom.mesas',
    perfil: 'garcom',
    nome: 'Mesas do garçom',
    descricao: 'Visualização e operação das mesas.',
    acoes: ['ver', 'criar', 'editar'],
  },
  {
    id: 'entregador.entregas',
    perfil: 'entregador',
    nome: 'Entregas',
    descricao: 'Lista e atualização das entregas.',
    acoes: ['ver', 'editar'],
  },
] as const satisfies ReadonlyArray<{
  id: string
  perfil: PerfilControlado
  nome: string
  descricao: string
  acoes: readonly AcaoPermissao[]
}>

export type ModuloControleAcesso = (typeof MODULOS_CONTROLE_ACESSO)[number]['id']
export type ChavePermissao = `${ModuloControleAcesso}.${AcaoPermissao}`
export type ConfigPermissoes = Partial<Record<ChavePermissao, boolean>>
export type ConfigManutencao = Partial<Record<ModuloControleAcesso, boolean>>

export const ROTULOS_ACAO: Record<AcaoPermissao, string> = {
  ver: 'Ver',
  criar: 'Criar',
  editar: 'Editar',
  excluir: 'Excluir',
}

const CHAVES_PERMITIDAS = new Set<ChavePermissao>(
  MODULOS_CONTROLE_ACESSO.flatMap((modulo) =>
    modulo.acoes.map((acao) => `${modulo.id}.${acao}` as ChavePermissao),
  ),
)

const MODULOS_PERMITIDOS = new Set<ModuloControleAcesso>(
  MODULOS_CONTROLE_ACESSO.map((modulo) => modulo.id),
)

export const ehPerfilControlado = (papel: PapelUsuario | string): papel is PerfilControlado =>
  PERFIS_CONTROLADOS.includes(papel as PerfilControlado)

export const chavePermissao = (
  modulo: ModuloControleAcesso,
  acao: AcaoPermissao,
): ChavePermissao => `${modulo}.${acao}`

export const permissoesPadrao = (perfil?: PerfilControlado): ConfigPermissoes => {
  const config: ConfigPermissoes = {}

  for (const modulo of MODULOS_CONTROLE_ACESSO) {
    if (perfil && modulo.perfil !== perfil) continue
    for (const acao of modulo.acoes) {
      config[chavePermissao(modulo.id, acao)] = true
    }
  }

  return config
}

export const normalizarPermissoes = (
  valor: unknown,
  perfil?: PerfilControlado,
): ConfigPermissoes | null => {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return null

  const permitidoNoPerfil = new Set(
    MODULOS_CONTROLE_ACESSO
      .filter((modulo) => !perfil || modulo.perfil === perfil)
      .flatMap((modulo) =>
        modulo.acoes.map((acao) => chavePermissao(modulo.id, acao)),
      ),
  )
  const resultado: ConfigPermissoes = {}

  for (const [chave, valorPermissao] of Object.entries(valor)) {
    if (!CHAVES_PERMITIDAS.has(chave as ChavePermissao)) continue
    if (!permitidoNoPerfil.has(chave as ChavePermissao)) continue
    if (typeof valorPermissao !== 'boolean') continue
    resultado[chave as ChavePermissao] = valorPermissao
  }

  return resultado
}

export const normalizarManutencao = (valor: unknown): ConfigManutencao | null => {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return null

  const resultado: ConfigManutencao = {}
  for (const [modulo, ativo] of Object.entries(valor)) {
    if (!MODULOS_PERMITIDOS.has(modulo as ModuloControleAcesso)) continue
    if (typeof ativo !== 'boolean') continue
    resultado[modulo as ModuloControleAcesso] = ativo
  }

  return resultado
}

export const resolverPermissoes = (
  perfil: PerfilControlado,
  permissoesPapel?: ConfigPermissoes | null,
  permissoesUsuario?: ConfigPermissoes | null,
): ConfigPermissoes => ({
  ...permissoesPadrao(perfil),
  ...(normalizarPermissoes(permissoesPapel ?? {}, perfil) ?? {}),
  ...(normalizarPermissoes(permissoesUsuario ?? {}, perfil) ?? {}),
})

export const obterRegraRota = (
  pathname: string | null,
): { modulo: ModuloControleAcesso; acao: AcaoPermissao } | null => {
  if (!pathname) return null
  if (pathname === '/garcom/novo') return { modulo: 'garcom.pedidos', acao: 'criar' }
  if (pathname.startsWith('/garcom/editar/')) return { modulo: 'garcom.pedidos', acao: 'editar' }
  if (pathname === '/garcom/mesas') return { modulo: 'garcom.mesas', acao: 'ver' }
  if (pathname === '/garcom') return { modulo: 'garcom.pedidos', acao: 'ver' }
  if (pathname === '/entregador') return { modulo: 'entregador.entregas', acao: 'ver' }
  return null
}
