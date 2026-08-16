import { NextRequest, NextResponse } from 'next/server'
import { reconciliarPagamentosPendentes } from '@/lib/server/pagamento-online'

function requisicaoAutorizada(request: NextRequest) {
  const segredo = process.env.CRON_SECRET || process.env.PAGAMENTOS_CRON_SECRET
  if (!segredo) return true

  const cabecalhoAutorizacao = request.headers.get('authorization')
  return cabecalhoAutorizacao === `Bearer ${segredo}`
}

export async function GET(request: NextRequest) {
  if (!requisicaoAutorizada(request)) {
    return NextResponse.json({ sucesso: false, erro: 'Não autorizado.' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const limiteParam = Number(searchParams.get('limite'))
    const limite = Number.isFinite(limiteParam) ? limiteParam : 25

    const resultado = await reconciliarPagamentosPendentes({ limite })

    return NextResponse.json({
      sucesso: true,
      ...resultado,
    })
  } catch (erro) {
    console.error('[PagamentoOnline] Erro na reconciliação automática:', erro)
    const mensagem = erro instanceof Error ? erro.message : 'Falha na reconciliação de pagamentos.'
    return NextResponse.json({ sucesso: false, erro: mensagem }, { status: 500 })
  }
}

