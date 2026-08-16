import { NextRequest, NextResponse } from 'next/server'
import {
  carregarConfig,
  carregarGarcons,
  carregarSerie,
  ErroPeriodoProdutividade,
  validarPeriodo,
} from '@/lib/server/produtividade'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const parametros = request.nextUrl.searchParams
    const periodo = validarPeriodo(parametros.get('inicio'), parametros.get('fim'))

    const [garcons, serie, config] = await Promise.all([
      carregarGarcons(periodo),
      carregarSerie(periodo),
      carregarConfig(),
    ])

    return NextResponse.json({ sucesso: true, garcons, serie, config, periodo })
  } catch (erro) {
    if (erro instanceof ErroPeriodoProdutividade) {
      return NextResponse.json({ sucesso: false, erro: erro.message }, { status: 400 })
    }
    const mensagem = erro instanceof Error ? erro.message : 'Falha ao carregar produtividade.'
    return NextResponse.json({ sucesso: false, erro: mensagem }, { status: 500 })
  }
}
