export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { buscarEstadoEvolution, buscarPerfilEvolution, buscarStatusBotNovo, normalizarStatusAdmin } from '../_lib/evolution-admin'

export async function GET() {
  try {
    const [connection, perfil, botStatus] = await Promise.all([
      buscarEstadoEvolution().catch((error) => ({ error: error instanceof Error ? error.message : 'Erro na Evolution' })),
      buscarPerfilEvolution().catch((error) => ({ error: error instanceof Error ? error.message : 'Erro ao ler perfil' })),
      buscarStatusBotNovo(),
    ])

    return NextResponse.json({
      sucesso: true,
      dados: normalizarStatusAdmin(connection, botStatus, perfil),
    })
  } catch (erro) {
    return NextResponse.json({
      sucesso: false,
      erro: 'Não foi possível conectar ao bot',
      detalhes: erro instanceof Error ? erro.message : 'Erro desconhecido',
    }, { status: 503 })
  }
}
