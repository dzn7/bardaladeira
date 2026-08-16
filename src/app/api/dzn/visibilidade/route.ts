import { NextRequest, NextResponse } from 'next/server'
import { obterSupabaseAdmin } from '@/lib/server/supabase-admin'
import {
  normalizarConfigVisibilidade,
  type ConfigVisibilidadeTela,
} from '@/lib/visibilidade-telas'

export const dynamic = 'force-dynamic'

type CredenciaisDzn = {
  nomeUsuario?: unknown
  senha?: unknown
}

type RegistroDzn = {
  id: string
  nome_usuario: string
  papel: string
}

const validarCredenciais = async (credenciais: CredenciaisDzn) => {
  const nomeUsuario =
    typeof credenciais.nomeUsuario === 'string'
      ? credenciais.nomeUsuario.trim().toLowerCase()
      : ''
  const senha = typeof credenciais.senha === 'string' ? credenciais.senha : ''

  if (nomeUsuario !== 'dzn' || senha.length < 4 || senha.length > 120) return null

  const supabase = obterSupabaseAdmin()
  const { data, error } = await supabase.rpc('verificar_senha_usuario', {
    p_nome_usuario: nomeUsuario,
    p_senha: senha,
  })

  if (error || !Array.isArray(data) || data.length === 0) return null
  const registro = data[0] as RegistroDzn
  if (registro.nome_usuario !== 'dzn' || registro.papel !== 'admin') return null
  return registro
}

const carregarConfig = async (usuarioId: string) => {
  const supabase = obterSupabaseAdmin()
  const { data, error } = await supabase
    .from('admin_sidebar_config')
    .select('config')
    .eq('usuario_sistema_id', usuarioId)
    .maybeSingle()

  if (error) throw error
  return normalizarConfigVisibilidade(data?.config) ?? []
}

const localizarDzn = async () => {
  const supabase = obterSupabaseAdmin()
  const { data, error } = await supabase
    .from('usuarios_sistema')
    .select('id')
    .eq('nome_usuario', 'dzn')
    .eq('papel', 'admin')
    .eq('ativo', true)
    .maybeSingle()

  if (error) throw error
  return data?.id as string | undefined
}

export async function GET() {
  try {
    const usuarioId = await localizarDzn()
    const config = usuarioId ? await carregarConfig(usuarioId) : []
    return NextResponse.json({ sucesso: true, config })
  } catch {
    return NextResponse.json(
      { sucesso: false, erro: 'Falha ao carregar visibilidade.' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CredenciaisDzn
    const usuario = await validarCredenciais(body)
    if (!usuario) {
      return NextResponse.json(
        { sucesso: false, erro: 'Usuário ou senha incorretos.' },
        { status: 401 },
      )
    }

    const config = await carregarConfig(usuario.id)
    return NextResponse.json({ sucesso: true, config })
  } catch {
    return NextResponse.json(
      { sucesso: false, erro: 'Falha ao autenticar.' },
      { status: 500 },
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = (await request.json()) as CredenciaisDzn & { config?: unknown }
    const usuario = await validarCredenciais(body)
    const config = normalizarConfigVisibilidade(body.config)

    if (!usuario) {
      return NextResponse.json(
        { sucesso: false, erro: 'Acesso negado.' },
        { status: 401 },
      )
    }
    if (!config) {
      return NextResponse.json(
        { sucesso: false, erro: 'Configuração inválida.' },
        { status: 400 },
      )
    }

    const supabase = obterSupabaseAdmin()
    const payload: {
      usuario_sistema_id: string
      config: ConfigVisibilidadeTela[]
      updated_at: string
    } = {
      usuario_sistema_id: usuario.id,
      config,
      updated_at: new Date().toISOString(),
    }
    const { error } = await supabase
      .from('admin_sidebar_config')
      .upsert(payload, { onConflict: 'usuario_sistema_id' })

    if (error) throw error
    return NextResponse.json({ sucesso: true, config })
  } catch {
    return NextResponse.json(
      { sucesso: false, erro: 'Falha ao salvar visibilidade.' },
      { status: 500 },
    )
  }
}
