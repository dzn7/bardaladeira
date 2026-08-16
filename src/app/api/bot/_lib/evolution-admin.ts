type JsonObject = Record<string, unknown>
type StatusConexao = 'conectado' | 'desconectado' | 'conectando' | 'aguardando_qr'

export type StatusBotAdmin = {
  conectado: boolean
  status: StatusConexao
  numeroConectado: string | null
  nomePerfil: string | null
  conectadoEm: string | null
  qrDisponivel: boolean
  estatisticas: {
    mensagensRecebidas: number
    mensagensEnviadas: number
    pedidosNotificados: number
  }
  automacao: {
    botAtivo: boolean
    iaAtiva: boolean
    iaDisponivel: boolean
    provedores: unknown
  }
  operacao: {
    conversas24h: number
    rascunhosAtivos: number
    humanTakeoverAtivo: number
    outboxPendentes: number
    outboxFalhas: number
    filas: { conversations: number; pending: number; running: number }
    atualizadoEm: string | null
  }
}

const BOT_URL = limparUrl(process.env.BOT_ADMIN_URL || process.env.NEXT_PUBLIC_BOT_URL || 'http://localhost:3014')
const EVOLUTION_URL = limparUrl(process.env.EVOLUTION_ADMIN_URL || process.env.EVOLUTION_API_URL || 'http://localhost:8080')
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || ''
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE || 'edienai'
const WEBHOOK_PUBLIC_URL = process.env.EVOLUTION_WEBHOOK_PUBLIC_URL || `${BOT_URL}/webhooks/evolution`

function limparUrl(url: string) {
  return String(url || '').replace(/\/+$/, '')
}

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function readString(source: unknown, path: string[]): string | null {
  let current: unknown = source
  for (const key of path) {
    if (!isObject(current)) return null
    current = current[key]
  }
  return typeof current === 'string' && current.trim() ? current : null
}

function readNumber(source: unknown, path: string[]): number | null {
  let current: unknown = source
  for (const key of path) {
    if (!isObject(current)) return null
    current = current[key]
  }
  return typeof current === 'number' && Number.isFinite(current) ? current : null
}

function readBoolean(source: unknown, path: string[]): boolean | null {
  let current: unknown = source
  for (const key of path) {
    if (!isObject(current)) return null
    current = current[key]
  }
  return typeof current === 'boolean' ? current : null
}

function normalizarErro(payload: unknown, fallback: string) {
  if (!isObject(payload)) return fallback
  const message = payload.message || payload.error || payload.response
  return typeof message === 'string' && message.trim() ? message : fallback
}

function headersObject(headers?: HeadersInit): Record<string, string> {
  if (!headers) return {}
  if (headers instanceof Headers) return Object.fromEntries(headers.entries())
  if (Array.isArray(headers)) return Object.fromEntries(headers)
  return headers
}

async function parseJson(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    return { raw: text }
  }
}

export async function evolutionRequest(path: string, init: RequestInit = {}, timeoutMs = 12000) {
  if (!EVOLUTION_API_KEY) {
    throw new Error('EVOLUTION_API_KEY não configurada no painel.')
  }

  const response = await fetch(`${EVOLUTION_URL}${path}`, {
    ...init,
    headers: {
      apikey: EVOLUTION_API_KEY,
      'Content-Type': 'application/json',
      ...headersObject(init.headers),
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(timeoutMs),
  })

  const payload = await parseJson(response)
  if (!response.ok) {
    throw new Error(normalizarErro(payload, `Evolution respondeu HTTP ${response.status}`))
  }
  return payload
}

export async function botRequest(path: string, init: RequestInit = {}, timeoutMs = 8000) {
  const response = await fetch(`${BOT_URL}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...headersObject(init.headers),
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(timeoutMs),
  })

  const payload = await parseJson(response)
  if (!response.ok) {
    throw new Error(normalizarErro(payload, `Bot respondeu HTTP ${response.status}`))
  }
  return payload
}

export function extrairEstadoConexao(payload: unknown): StatusConexao {
  const state = (
    readString(payload, ['instance', 'state']) ||
    readString(payload, ['instance', 'status']) ||
    readString(payload, ['connectionStatus']) ||
    readString(payload, ['state']) ||
    readString(payload, ['status']) ||
    ''
  ).toLowerCase()

  if (['open', 'opened', 'connected', 'conectado'].includes(state)) return 'conectado'
  if (['connecting', 'connect', 'pairing', 'aguardando_qr'].includes(state)) return 'conectando'
  return 'desconectado'
}

export function extrairQrCode(payload: unknown): string | null {
  return (
    readString(payload, ['code']) ||
    readString(payload, ['qrcode', 'code']) ||
    readString(payload, ['base64']) ||
    readString(payload, ['qrcode', 'base64']) ||
    null
  )
}

export function extrairCodigoPareamento(payload: unknown): string | null {
  return (
    readString(payload, ['pairingCode']) ||
    readString(payload, ['qrcode', 'pairingCode']) ||
    null
  )
}

export async function buscarEstadoEvolution() {
  return evolutionRequest(`/instance/connectionState/${encodeURIComponent(EVOLUTION_INSTANCE)}`)
}

export async function buscarPerfilEvolution() {
  const payload = await evolutionRequest(`/instance/fetchInstances?instanceName=${encodeURIComponent(EVOLUTION_INSTANCE)}`)
  if (!Array.isArray(payload)) return null
  return payload.find((item) => {
    const nome = readString(item, ['name']) || readString(item, ['instance', 'instanceName'])
    return nome === EVOLUTION_INSTANCE
  }) || payload[0] || null
}

export async function buscarStatusBotNovo() {
  return botRequest('/status').catch((error) => ({ error: error instanceof Error ? error.message : 'Falha ao ler bot' }))
}

export async function configurarWebhookEvolution() {
  return evolutionRequest(`/webhook/set/${encodeURIComponent(EVOLUTION_INSTANCE)}`, {
    method: 'POST',
    body: JSON.stringify({
      webhook: {
        enabled: true,
        url: WEBHOOK_PUBLIC_URL,
        events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE'],
        webhook_by_events: true,
        webhook_base64: false,
      },
    }),
  })
}

async function instanciaExiste() {
  const payload = await evolutionRequest(`/instance/fetchInstances?instanceName=${encodeURIComponent(EVOLUTION_INSTANCE)}`)
  if (!Array.isArray(payload)) return false

  return payload.some((item) => {
    const instanceName =
      readString(item, ['instance', 'instanceName']) ||
      readString(item, ['instanceName']) ||
      readString(item, ['name'])
    return instanceName === EVOLUTION_INSTANCE
  })
}

export async function garantirInstanciaEvolution(qrcode = false) {
  if (await instanciaExiste().catch(() => false)) return { created: false }

  const data = await evolutionRequest('/instance/create', {
    method: 'POST',
    body: JSON.stringify({
      instanceName: EVOLUTION_INSTANCE,
      integration: 'WHATSAPP-BAILEYS',
      qrcode,
      rejectCall: true,
      msgCall: 'No momento nao atendemos ligacoes por aqui. Mande uma mensagem que respondemos.',
      groupsIgnore: true,
      alwaysOnline: false,
      readMessages: false,
      readStatus: false,
      syncFullHistory: false,
      webhook: {
        url: WEBHOOK_PUBLIC_URL,
        byEvents: true,
        base64: false,
        events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE'],
      },
    }),
  })

  return { created: true, data }
}

export async function conectarEvolution(numero?: string) {
  await garantirInstanciaEvolution(true)
  await configurarWebhookEvolution()
  const suffix = numero ? `?number=${encodeURIComponent(numero)}` : ''
  return evolutionRequest(`/instance/connect/${encodeURIComponent(EVOLUTION_INSTANCE)}${suffix}`, { method: 'GET' }, 20000)
}

async function tentarRotas(paths: string[], methods: string[]) {
  let ultimoErro: Error | null = null

  for (const path of paths) {
    for (const method of methods) {
      try {
        return await evolutionRequest(path, { method }, 10000)
      } catch (error) {
        ultimoErro = error instanceof Error ? error : new Error('Falha na Evolution')
      }
    }
  }

  throw ultimoErro || new Error('A Evolution recusou a ação.')
}

export async function desconectarEvolution() {
  const instance = encodeURIComponent(EVOLUTION_INSTANCE)
  return tentarRotas([`/instance/logout/${instance}`], ['DELETE', 'POST', 'GET'])
}

export async function limparSessaoEvolution() {
  await desconectarEvolution().catch(() => null)
  const instance = encodeURIComponent(EVOLUTION_INSTANCE)
  return tentarRotas([`/instance/delete/${instance}`, `/instance/delete/${instance}?force=true`], ['DELETE', 'POST'])
}

export function normalizarStatusAdmin(connection: unknown, botStatus: unknown, perfil: unknown = null): StatusBotAdmin {
  const statusConexao = extrairEstadoConexao(connection)
  const statusPerfil = extrairEstadoConexao(perfil)
  const status = statusConexao === 'conectado' || statusPerfil === 'conectado' ? 'conectado' : statusConexao
  const admin = isObject(botStatus) ? botStatus.admin : null
  const stats = isObject(admin) ? admin.stats : null
  const ai = isObject(admin) ? admin.ai : null
  const queues = isObject(admin) ? admin.queues : null
  const owner =
    readString(perfil, ['ownerJid']) ||
    readString(perfil, ['owner']) ||
    readString(connection, ['instance', 'owner']) ||
    readString(connection, ['owner'])

  return {
    conectado: status === 'conectado',
    status,
    numeroConectado:
      owner?.replace(/@.+$/, '') || null,
    nomePerfil:
      readString(perfil, ['profileName']) ||
      readString(perfil, ['instance', 'profileName']) ||
      readString(connection, ['instance', 'profileName']) ||
      readString(connection, ['profileName']) ||
      null,
    conectadoEm:
      readString(connection, ['instance', 'connectedAt']) ||
      readString(connection, ['connectedAt']) ||
      null,
    qrDisponivel: status !== 'conectado',
    estatisticas: {
      mensagensRecebidas: readNumber(stats, ['mensagens24h', 'recebidas']) ?? 0,
      mensagensEnviadas: readNumber(stats, ['mensagens24h', 'enviadas']) ?? 0,
      pedidosNotificados: readNumber(stats, ['notificacoes7d']) || 0,
    },
    automacao: {
      botAtivo: readBoolean(admin, ['bot_enabled']) ?? true,
      iaAtiva: readBoolean(ai, ['enabled']) ?? true,
      iaDisponivel: readBoolean(ai, ['available']) ?? false,
      provedores: isObject(ai) && isObject(ai.providers) ? ai.providers : {},
    },
    operacao: {
      conversas24h: readNumber(stats, ['conversas24h']) || 0,
      rascunhosAtivos: readNumber(stats, ['rascunhosAtivos']) || 0,
      humanTakeoverAtivo: readNumber(stats, ['humanTakeoverAtivo']) || 0,
      outboxPendentes: readNumber(stats, ['outbox', 'pending']) || 0,
      outboxFalhas: readNumber(stats, ['outbox', 'failed']) || 0,
      filas: {
        conversations: readNumber(queues, ['conversations']) || 0,
        pending: readNumber(queues, ['pending']) || 0,
        running: readNumber(queues, ['running']) || 0,
      },
      atualizadoEm: readString(stats, ['atualizadoEm']),
    },
  }
}

export const botAdminConfig = {
  botUrl: BOT_URL,
  evolutionUrl: EVOLUTION_URL,
  instance: EVOLUTION_INSTANCE,
  webhookPublicUrl: WEBHOOK_PUBLIC_URL,
}
