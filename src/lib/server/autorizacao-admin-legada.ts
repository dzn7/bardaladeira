import type { NextRequest } from 'next/server'
import { obterSupabaseAdmin } from './supabase-admin'

const USUARIOS_LOCAIS = new Map([
  ['admin-authenticated-bar-da-ladeira', 'admin-local:bar-da-ladeira'],
  ['admin-authenticated-dzndev', 'admin-local:dzndev'],
])

const TOKEN_SUPABASE = /^admin-supabase-([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i

export async function autorizarAdminLegado(request: NextRequest): Promise<{ usuarioChave: string } | null> {
  const token = (request.headers.get('x-admin-token') || '').trim()
  const usuarioLocal = USUARIOS_LOCAIS.get(token)
  if (usuarioLocal) return { usuarioChave: usuarioLocal }

  const encontrado = token.match(TOKEN_SUPABASE)
  if (!encontrado) return null

  const supabase = obterSupabaseAdmin({ exigirServiceRole: true })
  const { data, error } = await supabase
    .from('usuarios_sistema')
    .select('id')
    .eq('id', encontrado[1])
    .eq('papel', 'admin')
    .eq('ativo', true)
    .maybeSingle()

  if (error || !data?.id) return null
  return { usuarioChave: `usuario:${data.id}` }
}
