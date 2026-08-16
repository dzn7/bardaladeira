export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { botRequest } from '../_lib/evolution-admin'

export async function POST() {
  try {
    await botRequest('/config/refresh', { method: 'POST' })
    return NextResponse.json({
      sucesso: true,
      mensagem: 'Configurações atualizadas no bot.',
    })
  } catch (erro) {
    return NextResponse.json({
      sucesso: false,
      erro: erro instanceof Error ? erro.message : 'Não foi possível atualizar o cache do bot.',
    }, { status: 503 })
  }
}
