const MERCADO_PAGO_API_BASE = process.env.MERCADO_PAGO_API_BASE || 'https://api.mercadopago.com'

export type StatusPagamentoOnline =
  | 'nao_aplicavel'
  | 'aguardando_pagamento'
  | 'pago'
  | 'rejeitado'
  | 'cancelado'
  | 'expirado'
  | 'em_analise'

export type MercadoPagoPaymentResponse = {
  id: number | string
  status?: string | null
  status_detail?: string | null
  date_approved?: string | null
  date_of_expiration?: string | null
  external_reference?: string | null
  point_of_interaction?: {
    transaction_data?: {
      qr_code?: string | null
      qr_code_base64?: string | null
      ticket_url?: string | null
    } | null
  } | null
  [key: string]: unknown
}

type CriarPagamentoPixParams = {
  valor: number
  descricao: string
  externalReference: string
  notificationUrl: string
  emailPagador: string
  nomePagador?: string | null
  dataExpiracaoIso?: string | null
  metadata?: Record<string, unknown>
}

function obterTokenMercadoPago() {
  const token = process.env.MERCADO_PAGO_ACCESS_TOKEN
  if (!token) {
    throw new Error('MERCADO_PAGO_ACCESS_TOKEN não configurado.')
  }
  return token
}

async function requisitarMercadoPago<T>(
  caminho: string,
  init: RequestInit & { idempotencyKey?: string } = {}
): Promise<T> {
  const token = obterTokenMercadoPago()
  const headers = new Headers(init.headers || {})
  headers.set('Authorization', `Bearer ${token}`)
  headers.set('Content-Type', 'application/json')

  if (init.idempotencyKey) {
    headers.set('X-Idempotency-Key', init.idempotencyKey)
  }

  const resposta = await fetch(`${MERCADO_PAGO_API_BASE}${caminho}`, {
    ...init,
    headers,
  })

  const texto = await resposta.text()
  const json = texto ? JSON.parse(texto) : null

  if (!resposta.ok) {
    const mensagemErro =
      (json && typeof json.message === 'string' && json.message) ||
      (json && typeof json.error === 'string' && json.error) ||
      `Erro Mercado Pago (${resposta.status})`
    throw new Error(mensagemErro)
  }

  return json as T
}

export async function criarPagamentoPixMercadoPago(
  params: CriarPagamentoPixParams
): Promise<MercadoPagoPaymentResponse> {
  const body = {
    transaction_amount: Number(params.valor.toFixed(2)),
    description: params.descricao,
    payment_method_id: 'pix',
    external_reference: params.externalReference,
    notification_url: params.notificationUrl,
    payer: {
      email: params.emailPagador,
      first_name: params.nomePagador || undefined,
    },
    date_of_expiration: params.dataExpiracaoIso || undefined,
    metadata: params.metadata || undefined,
  }

  return requisitarMercadoPago<MercadoPagoPaymentResponse>('/v1/payments', {
    method: 'POST',
    idempotencyKey: crypto.randomUUID(),
    body: JSON.stringify(body),
  })
}

export async function obterPagamentoMercadoPago(
  paymentId: string | number
): Promise<MercadoPagoPaymentResponse> {
  return requisitarMercadoPago<MercadoPagoPaymentResponse>(`/v1/payments/${paymentId}`, {
    method: 'GET',
  })
}

export function mapearStatusMercadoPago(status?: string | null): StatusPagamentoOnline {
  switch ((status || '').toLowerCase()) {
    case 'approved':
      return 'pago'
    case 'pending':
      return 'aguardando_pagamento'
    case 'in_process':
      return 'em_analise'
    case 'rejected':
      return 'rejeitado'
    case 'cancelled':
      return 'cancelado'
    case 'refunded':
    case 'charged_back':
      return 'cancelado'
    case 'expired':
      return 'expirado'
    default:
      return 'aguardando_pagamento'
  }
}

export function statusFinalPagamentoOnline(status: StatusPagamentoOnline): boolean {
  return status === 'pago' || status === 'rejeitado' || status === 'cancelado' || status === 'expirado'
}

export function gerarEmailPagador(telefone?: string | null) {
  const digitos = (telefone || '').replace(/\D/g, '')
  const sufixo = digitos || Date.now().toString()
  return `cliente-${sufixo}@bar-da-ladeira.app`
}
