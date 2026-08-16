import { NextRequest, NextResponse } from 'next/server'
import {
  carregarOcorrencias,
  ErroPeriodoProdutividade,
  validarGarcomId,
  validarPeriodo,
} from '@/lib/server/produtividade'

export const dynamic = 'force-dynamic'

const LIMITE_PADRAO = 15
const LIMITE_MAXIMO = 100

const inteiroEntre = (valor: string | null, padrao: number, minimo: number, maximo: number) => {
  const convertido = Number(valor)
  if (!Number.isFinite(convertido)) return padrao
  return Math.min(Math.max(Math.trunc(convertido), minimo), maximo)
}

export async function GET(request: NextRequest) {
  try {
    const parametros = request.nextUrl.searchParams
    const periodo = validarPeriodo(parametros.get('inicio'), parametros.get('fim'))
    const limite = inteiroEntre(parametros.get('limite'), LIMITE_PADRAO, 1, LIMITE_MAXIMO)
    const offset = inteiroEntre(parametros.get('offset'), 0, 0, 100000)

    const { ocorrencias, total } = await carregarOcorrencias(periodo, {
      garcomId: validarGarcomId(parametros.get('garcomId')),
      limite,
      offset,
    })

    return NextResponse.json({ sucesso: true, ocorrencias, total })
  } catch (erro) {
    if (erro instanceof ErroPeriodoProdutividade) {
      return NextResponse.json({ sucesso: false, erro: erro.message }, { status: 400 })
    }
    const mensagem = erro instanceof Error ? erro.message : 'Falha ao carregar ocorrências.'
    return NextResponse.json({ sucesso: false, erro: mensagem }, { status: 500 })
  }
}
