export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { limparSessaoEvolution } from '../_lib/evolution-admin'

export async function POST() {
  try {
    await limparSessaoEvolution()
    return NextResponse.json({ sucesso: true, mensagem: 'Sessão limpa. Gere um novo QR Code.' })
  } catch (erro) {
    return NextResponse.json(
      { sucesso: false, erro: erro instanceof Error ? erro.message : 'Não foi possível limpar a sessão.' },
      { status: 503 }
    )
  }
}
