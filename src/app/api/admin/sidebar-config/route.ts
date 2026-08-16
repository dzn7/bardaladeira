import { NextRequest, NextResponse } from 'next/server'
import { obterSupabaseAdmin } from '@/lib/server/supabase-admin'
import type { SidebarConfigItem } from '@/lib/admin-sidebar-routes'

export const dynamic = 'force-dynamic'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const validarUsuarioId = (valor: string | null | undefined) => {
  if (!valor || !UUID_RE.test(valor)) return null
  return valor
}

const normalizarConfig = (valor: unknown): SidebarConfigItem[] | null => {
  if (!Array.isArray(valor)) return null
  const itens: SidebarConfigItem[] = []
  for (const entry of valor) {
    if (!entry || typeof entry !== 'object') continue
    const raw = entry as Record<string, unknown>
    if (typeof raw.id !== 'string' || !raw.id.trim()) continue
    itens.push({
      id: raw.id.trim(),
      visible: raw.visible !== false,
      category: typeof raw.category === 'string' ? raw.category : undefined,
    })
  }
  return itens
}

export async function GET(request: NextRequest) {
  try {
    const usuarioId = validarUsuarioId(request.nextUrl.searchParams.get('usuarioId'))
    if (!usuarioId) {
      return NextResponse.json(
        { sucesso: false, erro: 'usuarioId inválido.' },
        { status: 400 },
      )
    }

    const supabase = obterSupabaseAdmin()
    const { data, error } = await supabase
      .from('admin_sidebar_config')
      .select('config, updated_at')
      .eq('usuario_sistema_id', usuarioId)
      .maybeSingle()

    if (error) {
      return NextResponse.json(
        { sucesso: false, erro: error.message },
        { status: 500 },
      )
    }

    return NextResponse.json({
      sucesso: true,
      config: normalizarConfig(data?.config) ?? [],
      updatedAt: data?.updated_at ?? null,
    })
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : 'Falha ao carregar config.'
    return NextResponse.json({ sucesso: false, erro: mensagem }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      usuarioId?: string
      config?: unknown
    }
    const usuarioId = validarUsuarioId(body.usuarioId)
    const config = normalizarConfig(body.config)

    if (!usuarioId) {
      return NextResponse.json(
        { sucesso: false, erro: 'usuarioId inválido.' },
        { status: 400 },
      )
    }
    if (!config) {
      return NextResponse.json(
        { sucesso: false, erro: 'config inválida.' },
        { status: 400 },
      )
    }

    const supabase = obterSupabaseAdmin()
    const { data, error } = await supabase
      .from('admin_sidebar_config')
      .upsert(
        {
          usuario_sistema_id: usuarioId,
          config,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'usuario_sistema_id' },
      )
      .select('config, updated_at')
      .single()

    if (error) {
      return NextResponse.json(
        { sucesso: false, erro: error.message },
        { status: 500 },
      )
    }

    return NextResponse.json({
      sucesso: true,
      config: normalizarConfig(data?.config) ?? config,
      updatedAt: data?.updated_at ?? null,
    })
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : 'Falha ao salvar config.'
    return NextResponse.json({ sucesso: false, erro: mensagem }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const usuarioId = validarUsuarioId(
      request.nextUrl.searchParams.get('usuarioId') ||
        ((await request.json().catch(() => null)) as { usuarioId?: string } | null)?.usuarioId,
    )

    if (!usuarioId) {
      return NextResponse.json(
        { sucesso: false, erro: 'usuarioId inválido.' },
        { status: 400 },
      )
    }

    const supabase = obterSupabaseAdmin()
    const { error } = await supabase
      .from('admin_sidebar_config')
      .delete()
      .eq('usuario_sistema_id', usuarioId)

    if (error) {
      return NextResponse.json(
        { sucesso: false, erro: error.message },
        { status: 500 },
      )
    }

    return NextResponse.json({ sucesso: true, config: [] })
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : 'Falha ao restaurar config.'
    return NextResponse.json({ sucesso: false, erro: mensagem }, { status: 500 })
  }
}
