import { NextRequest, NextResponse } from 'next/server'
import { obterSupabaseAdmin } from '@/lib/server/supabase-admin'
import {
  ehPerfilControlado,
  normalizarManutencao,
  normalizarPermissoes,
  resolverPermissoes,
  type ConfigManutencao,
  type ConfigPermissoes,
  type PerfilControlado,
} from '@/lib/controle-acesso'

export const dynamic = 'force-dynamic'

const UUID_VALIDO = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type CredenciaisAdmin = {
  nomeUsuario?: unknown
  senha?: unknown
}

type UsuarioSeguro = {
  id: string
  nome: string
  nome_usuario: string
  papel: PerfilControlado
  ativo: boolean
}

type PainelRpc = {
  usuarios?: unknown
  papeis?: unknown
  usuariosConfig?: unknown
  manutencao?: unknown
}

const respostaErro = (erro: string, status: number) =>
  NextResponse.json({ sucesso: false, erro }, { status })

const origemValida = (request: NextRequest) => {
  const origem = request.headers.get('origin')
  return !origem || origem === new URL(request.url).origin
}

const normalizarCredenciais = (valor: CredenciaisAdmin | undefined) => {
  const nomeUsuario = typeof valor?.nomeUsuario === 'string'
    ? valor.nomeUsuario.trim().toLowerCase()
    : ''
  const senha = typeof valor?.senha === 'string' ? valor.senha : ''
  if (!nomeUsuario || nomeUsuario.length > 80 || senha.length < 4 || senha.length > 120) {
    return null
  }
  return { nomeUsuario, senha }
}

const normalizarPainel = (valor: unknown) => {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return null
  const painel = valor as PainelRpc

  const usuarios = Array.isArray(painel.usuarios)
    ? painel.usuarios.flatMap((item): UsuarioSeguro[] => {
        if (!item || typeof item !== 'object') return []
        const usuario = item as Record<string, unknown>
        if (
          typeof usuario.id !== 'string' ||
          typeof usuario.nome !== 'string' ||
          typeof usuario.nome_usuario !== 'string' ||
          typeof usuario.ativo !== 'boolean' ||
          typeof usuario.papel !== 'string' ||
          !ehPerfilControlado(usuario.papel)
        ) return []

        return [{
          id: usuario.id,
          nome: usuario.nome,
          nome_usuario: usuario.nome_usuario,
          papel: usuario.papel,
          ativo: usuario.ativo,
        }]
      })
    : []

  const papeisBrutos = painel.papeis && typeof painel.papeis === 'object' && !Array.isArray(painel.papeis)
    ? painel.papeis as Record<string, unknown>
    : {}
  const papeis: Record<PerfilControlado, ConfigPermissoes> = {
    garcom: normalizarPermissoes(papeisBrutos.garcom ?? {}, 'garcom') ?? {},
    entregador: normalizarPermissoes(papeisBrutos.entregador ?? {}, 'entregador') ?? {},
  }

  const usuariosBrutos = painel.usuariosConfig && typeof painel.usuariosConfig === 'object' && !Array.isArray(painel.usuariosConfig)
    ? painel.usuariosConfig as Record<string, unknown>
    : {}
  const papelPorUsuario = new Map(usuarios.map((usuario) => [usuario.id, usuario.papel]))
  const usuariosConfig: Record<string, ConfigPermissoes> = {}

  for (const [usuarioId, config] of Object.entries(usuariosBrutos)) {
    const papel = papelPorUsuario.get(usuarioId)
    if (!papel) continue
    usuariosConfig[usuarioId] = normalizarPermissoes(config, papel) ?? {}
  }

  return {
    usuarios,
    papeis,
    usuariosConfig,
    manutencao: normalizarManutencao(painel.manutencao ?? {}) ?? {},
  }
}

export async function GET(request: NextRequest) {
  try {
    const usuarioId = request.nextUrl.searchParams.get('usuarioId') ?? ''
    if (!UUID_VALIDO.test(usuarioId)) return respostaErro('Usuário inválido.', 400)

    const supabase = obterSupabaseAdmin()
    const { data, error } = await supabase.rpc('obter_controle_acesso', {
      p_usuario_id: usuarioId,
    })

    if (error) throw error
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return respostaErro('Usuário indisponível.', 404)
    }

    const registro = data as {
      papel?: unknown
      permissoesPapel?: unknown
      permissoesUsuario?: unknown
      manutencao?: unknown
    }
    if (typeof registro.papel !== 'string' || !ehPerfilControlado(registro.papel)) {
      return respostaErro('Usuário indisponível.', 404)
    }

    const permissoesPapel = normalizarPermissoes(registro.permissoesPapel ?? {}, registro.papel)
    const permissoesUsuario = normalizarPermissoes(registro.permissoesUsuario ?? {}, registro.papel)
    const permissoes = resolverPermissoes(registro.papel, permissoesPapel, permissoesUsuario)
    const manutencao: ConfigManutencao = normalizarManutencao(registro.manutencao ?? {}) ?? {}

    return NextResponse.json({ sucesso: true, permissoes, manutencao })
  } catch {
    return respostaErro('Falha ao carregar permissões.', 500)
  }
}

export async function POST(request: NextRequest) {
  if (!origemValida(request)) return respostaErro('Origem inválida.', 403)

  try {
    const body = (await request.json()) as { ator?: CredenciaisAdmin }
    const credenciais = normalizarCredenciais(body.ator)
    if (!credenciais) return respostaErro('Credenciais inválidas.', 400)

    const supabase = obterSupabaseAdmin()
    const { data, error } = await supabase.rpc('carregar_painel_controle_acesso', {
      p_nome_usuario: credenciais.nomeUsuario,
      p_senha: credenciais.senha,
    })

    if (error) throw error
    const painel = normalizarPainel(data)
    if (!painel) return respostaErro('Acesso negado.', 401)
    return NextResponse.json({ sucesso: true, ...painel })
  } catch {
    return respostaErro('Falha ao carregar o controle.', 500)
  }
}

export async function PUT(request: NextRequest) {
  if (!origemValida(request)) return respostaErro('Origem inválida.', 403)

  try {
    const body = (await request.json()) as {
      ator?: CredenciaisAdmin
      tipo?: unknown
      papel?: unknown
      usuarioId?: unknown
      moduloId?: unknown
      permissoes?: unknown
      ativo?: unknown
    }
    const credenciais = normalizarCredenciais(body.ator)
    if (!credenciais) return respostaErro('Credenciais inválidas.', 400)

    let papel: PerfilControlado | null = null
    let usuarioId: string | null = null
    let moduloId: string | null = null
    let permissoes: ConfigPermissoes | null = null
    let ativo: boolean | null = null

    if (body.tipo === 'papel' && typeof body.papel === 'string' && ehPerfilControlado(body.papel)) {
      papel = body.papel
      permissoes = normalizarPermissoes(body.permissoes, papel)
    } else if (body.tipo === 'usuario' && typeof body.usuarioId === 'string' && UUID_VALIDO.test(body.usuarioId)) {
      usuarioId = body.usuarioId
      permissoes = normalizarPermissoes(body.permissoes)
    } else if (body.tipo === 'manutencao' && typeof body.moduloId === 'string' && typeof body.ativo === 'boolean') {
      moduloId = body.moduloId
      ativo = body.ativo
    } else {
      return respostaErro('Operação inválida.', 400)
    }

    if ((body.tipo === 'papel' || body.tipo === 'usuario') && !permissoes) {
      return respostaErro('Permissões inválidas.', 400)
    }

    const supabase = obterSupabaseAdmin()
    const { data, error } = await supabase.rpc('salvar_controle_acesso', {
      p_nome_usuario: credenciais.nomeUsuario,
      p_senha: credenciais.senha,
      p_tipo: body.tipo,
      p_papel: papel,
      p_usuario_id: usuarioId,
      p_modulo_id: moduloId,
      p_permissoes: permissoes,
      p_ativo: ativo,
    })

    if (error) throw error
    if (data !== true) return respostaErro('Acesso negado.', 401)
    return NextResponse.json({ sucesso: true })
  } catch {
    return respostaErro('Falha ao salvar o controle.', 500)
  }
}
