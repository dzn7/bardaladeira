import type { NextRequest } from 'next/server'
import { tokenAdminEhValido } from '@/lib/token-admin'

const USUARIOS_LOCAIS = new Map([
  ['admin-authenticated-bar-da-ladeira', 'admin-local:bar-da-ladeira'],
  ['admin-authenticated-dzndev', 'admin-local:dzndev'],
])

const TOKEN_SUPABASE = /^admin-supabase-([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i

export async function autorizarAdminLegado(request: NextRequest): Promise<{ usuarioChave: string } | null> {
  const token = (request.headers.get('x-admin-token') || '').trim()
  if (!tokenAdminEhValido(token)) return null

  const usuarioLocal = USUARIOS_LOCAIS.get(token)
  if (usuarioLocal) return { usuarioChave: usuarioLocal }

  const encontrado = token.match(TOKEN_SUPABASE)
  return { usuarioChave: encontrado ? `usuario:${encontrado[1]}` : 'admin-local:token' }
}
