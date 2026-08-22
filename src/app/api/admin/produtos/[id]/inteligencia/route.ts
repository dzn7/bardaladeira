import { NextRequest, NextResponse } from 'next/server'
import { autorizarAdminLegado } from '@/lib/server/autorizacao-admin-legada'
import { obterSupabaseAdmin } from '@/lib/server/supabase-admin'

export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const LIMITE_PERIODO_EM_DIAS = 366

const dataValida = (valor: string | null) => {
  if (!valor || Number.isNaN(Date.parse(valor))) return null
  return new Date(valor)
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const autorizacao = await autorizarAdminLegado(request)
  if (!autorizacao) {
    return NextResponse.json({ sucesso: false, erro: 'Não autorizado.' }, { status: 401 })
  }

  const { id: produtoId } = await params
  if (!UUID.test(produtoId)) {
    return NextResponse.json({ sucesso: false, erro: 'Produto inválido.' }, { status: 400 })
  }

  const fim = dataValida(request.nextUrl.searchParams.get('fim')) || new Date()
  const inicioPadrao = new Date(fim)
  inicioPadrao.setUTCDate(inicioPadrao.getUTCDate() - 30)
  const inicio = dataValida(request.nextUrl.searchParams.get('inicio')) || inicioPadrao
  const intervaloEmMs = fim.getTime() - inicio.getTime()

  if (intervaloEmMs < 0 || intervaloEmMs > LIMITE_PERIODO_EM_DIAS * 24 * 60 * 60 * 1000) {
    return NextResponse.json({ sucesso: false, erro: 'Período inválido.' }, { status: 400 })
  }

  try {
    const supabase = obterSupabaseAdmin({ exigirServiceRole: true })
    const { data, error } = await supabase.rpc('obter_inteligencia_produto', {
      p_produto_id: produtoId,
      p_inicio: inicio.toISOString(),
      p_fim: fim.toISOString(),
    })
    if (error) throw new Error(error.message)

    return NextResponse.json({ sucesso: true, inteligencia: data || {} })
  } catch {
    return NextResponse.json(
      { sucesso: false, erro: 'Não foi possível carregar a inteligência do produto.' },
      { status: 500 },
    )
  }
}
