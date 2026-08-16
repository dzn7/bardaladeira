export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { desconectarEvolution } from '../_lib/evolution-admin'

export async function POST() {
  try {
    await desconectarEvolution()
    return NextResponse.json({ sucesso: true, mensagem: 'WhatsApp desconectado.' })
  } catch (erro) {
    return NextResponse.json(
      { sucesso: false, erro: erro instanceof Error ? erro.message : 'Não foi possível desconectar.' },
      { status: 503 }
    )
  }
}
