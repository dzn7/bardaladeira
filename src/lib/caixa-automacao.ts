export type CaixaAutomacaoConfig = {
  id: string
  ativo: boolean
  timezone: string
  horario_abertura: string
  horario_fechamento: string
  dias_ativos: number[]
  responsavel_padrao: string | null
  valor_abertura_padrao: number
  auto_sincronizar_pedidos: boolean
  fechar_com_saldo_esperado: boolean
  ultimo_dia_abertura: string | null
  ultimo_dia_fechamento: string | null
}

export const DEFAULT_CAIXA_AUTOMACAO: Omit<CaixaAutomacaoConfig, 'id'> = {
  ativo: false,
  timezone: 'America/Sao_Paulo',
  horario_abertura: '10:00',
  horario_fechamento: '23:00',
  dias_ativos: [0, 1, 2, 3, 4, 5, 6],
  responsavel_padrao: 'Sistema Automatico',
  valor_abertura_padrao: 0,
  auto_sincronizar_pedidos: true,
  fechar_com_saldo_esperado: true,
  ultimo_dia_abertura: null,
  ultimo_dia_fechamento: null,
}

type ZonedParts = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

const zonedFormatterCache = new Map<string, Intl.DateTimeFormat>()

function getFormatter(timezone: string) {
  if (!zonedFormatterCache.has(timezone)) {
    zonedFormatterCache.set(
      timezone,
      new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      })
    )
  }

  return zonedFormatterCache.get(timezone)!
}

export function parseHorario(horario: string | null | undefined): number {
  if (!horario) return 0
  const [horaStr = '0', minutoStr = '0'] = horario.split(':')
  const hora = Number(horaStr)
  const minuto = Number(minutoStr)
  if (Number.isNaN(hora) || Number.isNaN(minuto)) return 0
  return Math.max(0, Math.min(23, hora)) * 60 + Math.max(0, Math.min(59, minuto))
}

export function formatHorarioMinutos(minutosTotais: number): string {
  const safe = Math.max(0, Math.min(23 * 60 + 59, Math.round(minutosTotais)))
  const hora = Math.floor(safe / 60)
  const minuto = safe % 60
  return `${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}`
}

export function getZonedParts(date: Date, timezone: string): ZonedParts {
  const formatter = getFormatter(timezone)
  const parts = formatter.formatToParts(date)
  const map: Record<string, string> = {}
  for (const part of parts) {
    map[part.type] = part.value
  }

  return {
    year: Number(map.year || '0'),
    month: Number(map.month || '1'),
    day: Number(map.day || '1'),
    hour: Number(map.hour || '0'),
    minute: Number(map.minute || '0'),
    second: Number(map.second || '0'),
  }
}

export function getZonedDateKey(date: Date, timezone: string): string {
  const p = getZonedParts(date, timezone)
  return `${String(p.year).padStart(4, '0')}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}

export function getZonedWeekday(date: Date, timezone: string): number {
  const p = getZonedParts(date, timezone)
  const utcDate = new Date(Date.UTC(p.year, p.month - 1, p.day, 12, 0, 0))
  return utcDate.getUTCDay()
}

export function getZonedMinutes(date: Date, timezone: string): number {
  const p = getZonedParts(date, timezone)
  return p.hour * 60 + p.minute
}

export function isDayActive(config: Pick<CaixaAutomacaoConfig, 'dias_ativos'>, weekday: number): boolean {
  return Array.isArray(config.dias_ativos) && config.dias_ativos.includes(weekday)
}

export function isWithinOpenWindow(
  nowMinutes: number,
  openMinutes: number,
  closeMinutes: number
): boolean {
  if (openMinutes === closeMinutes) return true

  if (openMinutes < closeMinutes) {
    return nowMinutes >= openMinutes && nowMinutes < closeMinutes
  }

  // Janela que cruza meia-noite, ex: 22:00 -> 06:00
  return nowMinutes >= openMinutes || nowMinutes < closeMinutes
}

export function normalizeAutomacaoConfig(raw: Partial<CaixaAutomacaoConfig> | null | undefined): Omit<CaixaAutomacaoConfig, 'id'> {
  if (!raw) return { ...DEFAULT_CAIXA_AUTOMACAO }

  return {
    ativo: Boolean(raw.ativo),
    timezone: raw.timezone || DEFAULT_CAIXA_AUTOMACAO.timezone,
    horario_abertura: (raw.horario_abertura || DEFAULT_CAIXA_AUTOMACAO.horario_abertura).slice(0, 5),
    horario_fechamento: (raw.horario_fechamento || DEFAULT_CAIXA_AUTOMACAO.horario_fechamento).slice(0, 5),
    dias_ativos:
      Array.isArray(raw.dias_ativos) && raw.dias_ativos.length > 0
        ? raw.dias_ativos.map((d) => Number(d)).filter((d) => !Number.isNaN(d) && d >= 0 && d <= 6)
        : [...DEFAULT_CAIXA_AUTOMACAO.dias_ativos],
    responsavel_padrao:
      typeof raw.responsavel_padrao === 'string' && raw.responsavel_padrao.trim()
        ? raw.responsavel_padrao.trim()
        : DEFAULT_CAIXA_AUTOMACAO.responsavel_padrao,
    valor_abertura_padrao: Number(raw.valor_abertura_padrao || 0),
    auto_sincronizar_pedidos:
      typeof raw.auto_sincronizar_pedidos === 'boolean'
        ? raw.auto_sincronizar_pedidos
        : DEFAULT_CAIXA_AUTOMACAO.auto_sincronizar_pedidos,
    fechar_com_saldo_esperado:
      typeof raw.fechar_com_saldo_esperado === 'boolean'
        ? raw.fechar_com_saldo_esperado
        : DEFAULT_CAIXA_AUTOMACAO.fechar_com_saldo_esperado,
    ultimo_dia_abertura: raw.ultimo_dia_abertura || null,
    ultimo_dia_fechamento: raw.ultimo_dia_fechamento || null,
  }
}

export function formatWeekdayLabel(dia: number): string {
  const map: Record<number, string> = {
    0: 'Dom',
    1: 'Seg',
    2: 'Ter',
    3: 'Qua',
    4: 'Qui',
    5: 'Sex',
    6: 'Sab',
  }
  return map[dia] || '?'
}
