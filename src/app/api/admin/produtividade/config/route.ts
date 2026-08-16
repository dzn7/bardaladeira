import { NextRequest, NextResponse } from 'next/server'
import {
  carregarConfig,
  normalizarConfigRecebida,
  salvarConfig,
} from '@/lib/server/produtividade'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const config = await carregarConfig()
    return NextResponse.json({ sucesso: true, config })
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : 'Falha ao carregar configuração.'
    return NextResponse.json({ sucesso: false, erro: mensagem }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as { config?: unknown } | null
    const config = normalizarConfigRecebida(body?.config)

    if (!config) {
      return NextResponse.json(
        { sucesso: false, erro: 'Configuração inválida.' },
        { status: 400 },
      )
    }

    const atualizada = await salvarConfig(config)
    return NextResponse.json({ sucesso: true, config: atualizada })
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : 'Falha ao salvar configuração.'
    return NextResponse.json({ sucesso: false, erro: mensagem }, { status: 500 })
  }
}
