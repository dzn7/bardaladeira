const TOKENS_LEGADOS = new Set([
  'admin-authenticated-bar-da-ladeira',
  'admin-authenticated-dzndev',
])

const TOKEN_SUPABASE = /^admin-supabase-([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i

export function tokenAdminEhValido(valor: string | null | undefined): boolean {
  const token = (valor || '').trim()
  if (!token) return false
  return TOKENS_LEGADOS.has(token) || TOKEN_SUPABASE.test(token)
}

export function lerTokenAdmin(): string {
  if (typeof window === 'undefined') return ''
  return (localStorage.getItem('adminToken') || '').trim()
}
