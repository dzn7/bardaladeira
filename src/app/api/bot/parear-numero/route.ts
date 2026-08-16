export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { conectarEvolution, extrairCodigoPareamento } from '../_lib/evolution-admin'

export async function POST(requisicao: NextRequest) {
  try {
    const corpo = await requisicao.json() as { numero?: unknown }
    const numero = typeof corpo.numero === 'string' ? corpo.numero.replace(/\D/g, '') : ''

    if (numero.length < 10) {
      return NextResponse.json({ sucesso: false, erro: 'Informe um WhatsApp com DDD.' }, { status: 400 })
    }

    const data = await conectarEvolution(numero)
    const codigo = extrairCodigoPareamento(data)

    return NextResponse.json({
      sucesso: Boolean(codigo),
      codigo,
      erro: codigo ? undefined : 'A Evolution não retornou código de pareamento agora.',
    })
  } catch (erro) {
    return NextResponse.json(
      { sucesso: false, erro: erro instanceof Error ? erro.message : 'Não foi possível parear o número.' },
      { status: 503 }
    )
  }
}
