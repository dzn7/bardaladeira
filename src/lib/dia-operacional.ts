const TIMEZONE_BRASILIA = 'America/Sao_Paulo'
export const HORA_INICIO_DIA_OPERACIONAL = 3

const formatarDiaBrasilia = (data: Date) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE_BRASILIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(data)

const obterHoraBrasilia = (data: Date) => {
  const hora = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE_BRASILIA,
    hour: 'numeric',
    hour12: false,
  }).format(data)
  return Number(hora)
}

export const obterIntervaloDiaOperacionalAtual = (agora = new Date()) => {
  let diaRef = formatarDiaBrasilia(agora)
  if (obterHoraBrasilia(agora) < HORA_INICIO_DIA_OPERACIONAL) {
    const anterior = new Date(`${diaRef}T12:00:00.000-03:00`)
    anterior.setTime(anterior.getTime() - 24 * 60 * 60 * 1000)
    diaRef = formatarDiaBrasilia(anterior)
  }

  const inicio = new Date(
    `${diaRef}T${String(HORA_INICIO_DIA_OPERACIONAL).padStart(2, '0')}:00:00.000-03:00`,
  )
  const fim = new Date(inicio.getTime() + 24 * 60 * 60 * 1000)
  return { inicio, fim }
}

export const estaNoDiaOperacionalAtual = (valor: string | Date | null | undefined, agora = new Date()) => {
  if (!valor) return false

  const data = valor instanceof Date ? valor : new Date(valor)
  if (Number.isNaN(data.getTime())) return false

  const { inicio, fim } = obterIntervaloDiaOperacionalAtual(agora)
  return data >= inicio && data < fim
}
