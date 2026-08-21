import { createClient, SupabaseClient } from '@supabase/supabase-js'

let instanciaSupabaseAdmin: SupabaseClient<any> | null = null
let instanciaSupabaseServiceRole: SupabaseClient<any> | null = null

export function obterSupabaseAdmin(opcoes?: { exigirServiceRole?: boolean }) {
  if (opcoes?.exigirServiceRole && instanciaSupabaseServiceRole) return instanciaSupabaseServiceRole
  if (!opcoes?.exigirServiceRole && instanciaSupabaseAdmin) return instanciaSupabaseAdmin

  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '').trim()
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  const supabaseKey = (
    serviceRoleKey || (opcoes?.exigirServiceRole ? '' : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) || ''
  ).trim()

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      opcoes?.exigirServiceRole
        ? 'SUPABASE_SERVICE_ROLE_KEY não configurada no servidor.'
        : 'Variáveis do Supabase não configuradas no servidor.',
    )
  }

  const cliente = createClient<any>(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  if (opcoes?.exigirServiceRole) instanciaSupabaseServiceRole = cliente
  else instanciaSupabaseAdmin = cliente
  return cliente
}
