import {
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
  subDays,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { IntervaloEntregas, PeriodoEntrega } from '../types'

const criarDataLocal = (valor: string) => {
  const [ano, mes, dia] = valor.split('-').map(Number)
  return new Date(ano, mes - 1, dia, 0, 0, 0, 0)
}

export const formatarDataInput = (data: Date) => format(data, 'yyyy-MM-dd')

export const criarIntervaloEntregas = (
  dataInicio: string,
  dataFim: string,
): IntervaloEntregas => {
  const inicio = criarDataLocal(dataInicio)
  const fim = criarDataLocal(dataFim)
  const inicioNormalizado = inicio <= fim ? inicio : fim
  const fimNormalizado = inicio <= fim ? fim : inicio
  const fimExclusivo = new Date(fimNormalizado)
  fimExclusivo.setDate(fimExclusivo.getDate() + 1)

  return {
    dataInicio: formatarDataInput(inicioNormalizado),
    dataFim: formatarDataInput(fimNormalizado),
    inicioIso: inicioNormalizado.toISOString(),
    fimExclusivoIso: fimExclusivo.toISOString(),
  }
}

export const obterDatasPeriodoEntrega = (
  periodo: Exclude<PeriodoEntrega, 'personalizado'>,
  referencia = new Date(),
) => {
  const hoje = new Date(
    referencia.getFullYear(),
    referencia.getMonth(),
    referencia.getDate(),
  )
  let inicio = hoje
  let fim = hoje

  if (periodo === 'todos' || periodo === 'hoje') {
    return {
      dataInicio: formatarDataInput(hoje),
      dataFim: formatarDataInput(hoje),
    }
  }
  if (periodo === '7dias') inicio = subDays(hoje, 6)
  if (periodo === '30dias') inicio = subDays(hoje, 29)
  if (periodo === 'semana') {
    inicio = startOfWeek(hoje, { locale: ptBR })
    fim = endOfWeek(hoje, { locale: ptBR })
  }
  if (periodo === 'mes') {
    inicio = startOfMonth(hoje)
    fim = endOfMonth(hoje)
  }

  return {
    dataInicio: formatarDataInput(inicio),
    dataFim: formatarDataInput(fim),
  }
}
