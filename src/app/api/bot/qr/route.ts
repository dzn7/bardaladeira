export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { conectarEvolution, extrairQrCode } from '../_lib/evolution-admin'

export async function GET() {
  try {
    const data = await conectarEvolution()
    const qrCode = extrairQrCode(data)

    return NextResponse.json({
      sucesso: true,
      temQrCode: Boolean(qrCode),
      qrCode,
    })
  } catch (erro) {
    return NextResponse.json({
      sucesso: false,
      temQrCode: false,
      erro: 'Falha ao gerar QR Code',
      detalhes: erro instanceof Error ? erro.message : 'Erro desconhecido',
    }, { status: 503 })
  }
}
