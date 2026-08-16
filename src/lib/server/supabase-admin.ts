import { createClient, SupabaseClient } from '@supabase/supabase-js'

let instanciaSupabaseAdmin: SupabaseClient<any> | null = null

export function obterSupabaseAdmin() {
  if (instanciaSupabaseAdmin) return instanciaSupabaseAdmin

  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '').trim()
  const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim()

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Variáveis do Supabase não configuradas no servidor.')
  }

  instanciaSupabaseAdmin = createClient<any>(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  return instanciaSupabaseAdmin
}
