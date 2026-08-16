import {
  HORA_INICIO_DIA_OPERACIONAL,
  obterIntervaloDiaOperacionalAtual,
} from '@/lib/dia-operacional'
import type { PeriodoProdutividade } from '../types'

const TIMEZONE_BRASILIA = 'America/Sao_Paulo'

const formatadorDia = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIMEZONE_BRASILIA,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** Dia civil em Brasília no formato yyyy-mm-dd. */
export const diaBrasilia = (data: Date) => formatadorDia.format(data)

/** Instante em que o dia operacional do dia informado começa (03:00 em Brasília). */
export const inicioDiaOperacional = (diaIso: string) =>
  new Date(`${diaIso}T${String(HORA_INICIO_DIA_OPERACIONAL).padStart(2, '0')}:00:00.000-03:00`)

const somarDias = (diaIso: string, dias: number) => {
  const base = new Date(`${diaIso}T12:00:00.000-03:00`)
  base.setTime(base.getTime() + dias * 24 * 60 * 60 * 1000)
  return diaBrasilia(base)
}

export type IntervaloProdutividade = {
  inicio: Date
  fim: Date
}

export type PeriodoPersonalizado = {
  de: string
  ate: string
}

/**
 * Todos os períodos seguem o dia operacional da casa: começam às 03:00 e terminam
 * às 03:00 do dia seguinte (o mesmo corte usado por Garçons, Salão e Dashboard).
 */
export function calcularIntervalo(
  periodo: PeriodoProdutividade,
  personalizado?: PeriodoPersonalizado,
  agora = new Date(),
): IntervaloProdutividade {
  const diaAtual = obterIntervaloDiaOperacionalAtual(agora)

  if (periodo === 'dia') return diaAtual

  if (periodo === 'semana') {
    const diaRefIso = diaBrasilia(diaAtual.inicio)
    // getUTCDay sobre meio-dia UTC: independe do fuso da máquina de quem abre a tela.
    const diaSemana = new Date(`${diaRefIso}T12:00:00.000Z`).getUTCDay()
    const diasDesdeSegunda = (diaSemana + 6) % 7
    return {
      inicio: inicioDiaOperacional(somarDias(diaRefIso, -diasDesdeSegunda)),
      fim: diaAtual.fim,
    }
  }

  if (periodo === 'mes') {
    const [ano, mes] = diaBrasilia(diaAtual.inicio).split('-')
    return {
      inicio: inicioDiaOperacional(`${ano}-${mes}-01`),
      fim: diaAtual.fim,
    }
  }

  const de = personalizado?.de
  const ate = personalizado?.ate
  if (!de || !ate) return diaAtual

  const inicio = inicioDiaOperacional(de)
  const fim = inicioDiaOperacional(somarDias(ate, 1))
  if (fim.getTime() <= inicio.getTime()) return diaAtual

  return { inicio, fim }
}

/** Intervalo do mês operacional corrente — base fixa dos cartões de meta. */
export function intervaloMesCorrente(agora = new Date()): IntervaloProdutividade {
  return calcularIntervalo('mes', undefined, agora)
}

const formatadorDataCurta = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
})

export function rotularIntervalo(intervalo: IntervaloProdutividade): string {
  const inicio = formatadorDataCurta.format(intervalo.inicio)
  // O fim é exclusivo (03:00 do dia seguinte): exibimos o último dia realmente coberto.
  const ultimoDia = new Date(intervalo.fim.getTime() - 1000)
  const fim = formatadorDataCurta.format(ultimoDia)
  return inicio === fim ? inicio : `${inicio} — ${fim}`
}

/** Dia operacional a que um instante pertence, para casar com a série do banco. */
export function diaOperacionalDe(data: Date): string {
  const deslocado = new Date(data.getTime() - HORA_INICIO_DIA_OPERACIONAL * 60 * 60 * 1000)
  return diaBrasilia(deslocado)
}

const formatadorMoeda = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

export const formatarMoeda = (valor: number) =>
  formatadorMoeda.format(Number.isFinite(valor) ? valor : 0)

export const formatarPontos = (valor: number) => {
  const seguro = Number.isFinite(valor) ? valor : 0
  return Number.isInteger(seguro) ? String(seguro) : seguro.toFixed(1)
}

export const formatarPercentual = (valor: number) => {
  if (!Number.isFinite(valor)) return '0%'
  return `${Math.round(valor)}%`
}

const formatadorDataHora = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

export const formatarDataHora = (iso: string) => {
  const data = new Date(iso)
  if (Number.isNaN(data.getTime())) return '—'
  return formatadorDataHora.format(data)
}

/** Rótulo curto de um dia operacional (yyyy-mm-dd) para eixos de gráfico. */
export const rotularDia = (dia: string) => {
  const data = new Date(`${dia}T12:00:00.000-03:00`)
  if (Number.isNaN(data.getTime())) return dia
  return formatadorDataCurta.format(data)
}
