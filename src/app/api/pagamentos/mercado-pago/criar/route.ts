import { NextRequest, NextResponse } from 'next/server'
import { criarPedidoPixOnline, CriarPedidoPixOnlinePayload } from '@/lib/server/pagamento-online'

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as CriarPedidoPixOnlinePayload
    const baseUrl = new URL(request.url).origin

    const resultado = await criarPedidoPixOnline(payload, baseUrl)

    return NextResponse.json({
      sucesso: true,
      pagamento: resultado,
    })
  } catch (erro) {
    console.error('[PagamentoOnline] Erro ao criar pagamento PIX:', erro)
    const mensagem = erro instanceof Error ? erro.message : 'Falha ao criar pagamento PIX online.'

    return NextResponse.json(
      {
        sucesso: false,
        erro: mensagem,
      },
      { status: 400 }
    )
  }
}
