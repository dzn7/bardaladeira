import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { sincronizarPagamentoOnlinePorGateway } from '@/lib/server/pagamento-online'

type WebhookPayload = {
  type?: string
  topic?: string
  action?: string
  data?: {
    id?: string | number
  }
  id?: string | number
}

type ResultadoValidacaoAssinatura =
  | { valido: true }
  | { valido: false; motivo: 'segredo_ausente' | 'cabecalho_invalido' | 'dados_insuficientes' | 'assinatura_invalida' }

type AssinaturaCabecalho = {
  ts: string
  v1: string
}

function extrairAssinaturaCabecalho(cabecalho: string | null): AssinaturaCabecalho | null {
  if (!cabecalho) return null

  const partes = cabecalho.split(',').map((parte) => parte.trim())
  let ts = ''
  let v1 = ''

  for (const parte of partes) {
    const [chave, ...restante] = parte.split('=')
    if (!chave || restante.length === 0) continue

    const valor = restante.join('=').trim()
    if (chave.trim() === 'ts') ts = valor
    if (chave.trim() === 'v1') v1 = valor
  }

  if (!ts || !v1) return null
  return { ts, v1 }
}

function normalizarDataIdParaAssinatura(dataId: string): string {
  const valor = dataId.trim()
  return /[a-z]/i.test(valor) ? valor.toLowerCase() : valor
}

function montarManifestoAssinatura(dataId: string, requestId: string, ts: string) {
  return `id:${normalizarDataIdParaAssinatura(dataId)};request-id:${requestId};ts:${ts};`
}

function compararAssinaturasSeguras(esperada: string, recebida: string) {
  const esperado = Buffer.from(esperada.toLowerCase())
  const recebido = Buffer.from(recebida.toLowerCase())
  if (esperado.length !== recebido.length) return false
  return crypto.timingSafeEqual(esperado, recebido)
}

function extrairPaymentId(payload: WebhookPayload, request: NextRequest): string | null {
  const { searchParams } = new URL(request.url)

  const bodyId = payload?.data?.id || payload?.id
  const queryId = searchParams.get('data.id') || searchParams.get('id')

  const id = bodyId || queryId
  if (!id) return null

  return String(id)
}

function ehEventoPagamento(payload: WebhookPayload, request: NextRequest): boolean {
  const { searchParams } = new URL(request.url)
  const tipo = (payload.type || payload.topic || searchParams.get('type') || searchParams.get('topic') || '').toLowerCase()
  const acao = (payload.action || '').toLowerCase()

  if (!tipo && !acao) return true
  return tipo.includes('payment') || acao.includes('payment')
}

function validarAssinaturaMercadoPago(payload: WebhookPayload, request: NextRequest): ResultadoValidacaoAssinatura {
  const segredoWebhook = process.env.MERCADO_PAGO_WEBHOOK_SECRET
  if (!segredoWebhook) {
    return { valido: false, motivo: 'segredo_ausente' }
  }

  const assinatura = extrairAssinaturaCabecalho(request.headers.get('x-signature'))
  if (!assinatura) {
    return { valido: false, motivo: 'cabecalho_invalido' }
  }

  const dataId = extrairPaymentId(payload, request)
  const requestId = request.headers.get('x-request-id')
  if (!dataId || !requestId) {
    return { valido: false, motivo: 'dados_insuficientes' }
  }

  const manifesto = montarManifestoAssinatura(dataId, requestId, assinatura.ts)
  const assinaturaEsperada = crypto.createHmac('sha256', segredoWebhook).update(manifesto).digest('hex')
  const assinaturaValida = compararAssinaturasSeguras(assinaturaEsperada, assinatura.v1)

  if (!assinaturaValida) {
    return { valido: false, motivo: 'assinatura_invalida' }
  }

  return { valido: true }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const mercadoPagoPaymentId = searchParams.get('id') || searchParams.get('data.id')

  if (!mercadoPagoPaymentId) {
    return NextResponse.json({ ok: true, recebido: true })
  }

  const validacao = validarAssinaturaMercadoPago({}, request)
  if (!validacao.valido) {
    if (validacao.motivo === 'segredo_ausente') {
      console.warn('[PagamentoOnline] MERCADO_PAGO_WEBHOOK_SECRET não configurado. Processando webhook sem validação de assinatura.')
    } else {
      return NextResponse.json({ ok: false, erro: 'Assinatura inválida.' }, { status: 401 })
    }
  }

  try {
    await sincronizarPagamentoOnlinePorGateway(String(mercadoPagoPaymentId))
  } catch (erro) {
    console.error('[PagamentoOnline] Webhook GET falhou ao sincronizar:', erro)
  }

  return NextResponse.json({ ok: true, recebido: true })
}

export async function POST(request: NextRequest) {
  let payload: WebhookPayload = {}

  try {
    const texto = await request.text()
    payload = texto ? (JSON.parse(texto) as WebhookPayload) : {}
  } catch {
    payload = {}
  }

  const paymentId = extrairPaymentId(payload, request)
  const eventoPagamento = ehEventoPagamento(payload, request)
  const validacao = validarAssinaturaMercadoPago(payload, request)

  if (!validacao.valido) {
    if (validacao.motivo === 'segredo_ausente') {
      console.warn('[PagamentoOnline] MERCADO_PAGO_WEBHOOK_SECRET não configurado. Processando webhook sem validação de assinatura.')
    } else {
      return NextResponse.json({ ok: false, erro: 'Assinatura inválida.' }, { status: 401 })
    }
  }

  if (paymentId && eventoPagamento) {
    try {
      await sincronizarPagamentoOnlinePorGateway(paymentId)
    } catch (erro) {
      console.error('[PagamentoOnline] Webhook POST falhou ao sincronizar:', erro)
    }
  }

  return NextResponse.json({ ok: true, recebido: true })
}
