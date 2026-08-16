export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { conectarEvolution } from '../_lib/evolution-admin'

export async function POST() {
  try {
    await conectarEvolution()
    return NextResponse.json({ sucesso: true, mensagem: 'Sessão preparada para conexão.' })
  } catch (erro) {
    return NextResponse.json(
      { sucesso: false, erro: erro instanceof Error ? erro.message : 'Não foi possível reconectar.' },
      { status: 503 }
    )
  }
}
