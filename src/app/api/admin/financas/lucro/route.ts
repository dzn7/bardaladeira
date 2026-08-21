import { NextRequest, NextResponse } from 'next/server'
import { obterSupabaseAdmin } from '@/lib/server/supabase-admin'
import { autorizarAdminLegado } from '@/lib/server/autorizacao-admin-legada'

export const dynamic = 'force-dynamic'

const TAMANHO_PAGINA = 1000

const dataValida = (valor: string | null): valor is string => {
  if (!valor) return false
  return Number.isFinite(new Date(valor).getTime())
}

export async function GET(request: NextRequest) {
  if (!await autorizarAdminLegado(request)) {
    return NextResponse.json({ sucesso: false, erro: 'Não autorizado.' }, { status: 401 })
  }

  const inicio = request.nextUrl.searchParams.get('inicio')
  const fim = request.nextUrl.searchParams.get('fim')
  if (!dataValida(inicio) || !dataValida(fim) || new Date(inicio) > new Date(fim)) {
    return NextResponse.json({ sucesso: false, erro: 'Período inválido.' }, { status: 400 })
  }

  try {
    const supabase = obterSupabaseAdmin({ exigirServiceRole: true })
    const lucroProdutos: unknown[] = []
    let inicioPagina = 0

    while (true) {
      const { data, error } = await supabase
        .rpc('obter_lucro_produtos_admin', { p_inicio: inicio, p_fim: fim })
        .order('mes', { ascending: true })
        .order('produto_id', { ascending: true, nullsFirst: true })
        .order('nome_produto', { ascending: true })
        .range(inicioPagina, inicioPagina + TAMANHO_PAGINA - 1)
      if (error) throw new Error(error.message)

      const pagina = data || []
      lucroProdutos.push(...pagina)
      if (pagina.length < TAMANHO_PAGINA) break
      inicioPagina += TAMANHO_PAGINA
    }

    return NextResponse.json({ sucesso: true, lucroProdutos })
  } catch (erro) {
    return NextResponse.json(
      { sucesso: false, erro: erro instanceof Error ? erro.message : 'Falha ao calcular lucro.' },
      { status: 500 },
    )
  }
}
