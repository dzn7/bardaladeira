import { NextRequest, NextResponse } from 'next/server'
import { sincronizarPagamentoOnline } from '@/lib/server/pagamento-online'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const pagamentoOnlineId = searchParams.get('pagamentoOnlineId') || undefined
    const pedidoId = searchParams.get('pedidoId') || undefined
    const mercadoPagoPaymentId = searchParams.get('mercadoPagoPaymentId') || undefined
    const forcarConsultaGateway = searchParams.get('force') === '1'

    if (!pagamentoOnlineId && !pedidoId && !mercadoPagoPaymentId) {
      return NextResponse.json(
        { sucesso: false, erro: 'Informe pagamentoOnlineId, pedidoId ou mercadoPagoPaymentId.' },
        { status: 400 }
      )
    }

    const resultado = await sincronizarPagamentoOnline({
      pagamentoOnlineId,
      pedidoId,
      mercadoPagoPaymentId,
      forcarConsultaGateway,
    })

    return NextResponse.json({
      sucesso: true,
      pagamento: resultado,
    })
  } catch (erro) {
    console.error('[PagamentoOnline] Erro ao consultar status:', erro)
    const mensagem = erro instanceof Error ? erro.message : 'Falha ao consultar status do pagamento.'
    return NextResponse.json({ sucesso: false, erro: mensagem }, { status: 400 })
  }
}
