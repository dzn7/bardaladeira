import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Calcula o período de um "dia de trabalho" para o estabelecimento.
 * Um dia de trabalho vai das 10:00 do dia até 09:59:59 do dia seguinte.
 * Isso permite que pedidos feitos após a meia-noite ainda sejam contados
 * como parte do dia anterior (ex: pedido às 03:30 do dia 30 conta como dia 29).
 * 
 * Exemplo para dia 29/11:
 * - Início: 29/11 às 10:00
 * - Fim: 30/11 às 09:59:59
 * 
 * @param data - Data de referência para calcular o período
 * @returns Objeto com início e fim do período de trabalho
 */
export function calcularPeriodoDiaTrabalho(data: Date): { inicio: Date; fim: Date } {
  // Início do dia de trabalho: 10:00 do dia selecionado
  const inicio = new Date(data)
  inicio.setHours(10, 0, 0, 0)
  
  // Fim do dia de trabalho: 09:59:59 do dia seguinte
  const fim = new Date(inicio)
  fim.setDate(fim.getDate() + 1)
  fim.setHours(9, 59, 59, 999)
  
  return { inicio, fim }
}

/**
 * Verifica se uma data/hora pertence ao "dia de trabalho" de uma data de referência.
 * Considera que o dia de trabalho vai das 10:00 até 09:59:59 do dia seguinte.
 * 
 * @param dataHora - Data/hora a verificar
 * @param dataReferencia - Data de referência do dia de trabalho
 * @returns true se a data/hora pertence ao dia de trabalho
 */
export function pertenceAoDiaTrabalho(dataHora: Date, dataReferencia: Date): boolean {
  const { inicio, fim } = calcularPeriodoDiaTrabalho(dataReferencia)
  return dataHora >= inicio && dataHora <= fim
}

/**
 * Obtém a data de referência do "dia de trabalho" para uma data/hora específica.
 * Se a hora for entre 00:00 e 09:59, considera como parte do dia anterior.
 * 
 * Exemplos:
 * - 30/11 às 09:29 → dia de trabalho é 29/11
 * - 30/11 às 10:00 → dia de trabalho é 30/11
 * - 30/11 às 18:00 → dia de trabalho é 30/11
 * 
 * @param dataHora - Data/hora para determinar o dia de trabalho
 * @returns Data de referência do dia de trabalho (sempre às 12:00 para evitar problemas de timezone)
 */
export function obterDiaTrabalhoReferencia(dataHora: Date): Date {
  const hora = dataHora.getHours()
  const referencia = new Date(dataHora)
  
  // Se for entre 00:00 e 09:59, considera como dia anterior
  if (hora < 10) {
    referencia.setDate(referencia.getDate() - 1)
  }
  
  // Usar meio-dia para evitar problemas de timezone
  referencia.setHours(12, 0, 0, 0)
  return referencia
}

/**
 * Verifica se estamos no período da madrugada (00:00 às 10:00).
 * Nesse período, os pedidos ainda pertencem ao dia anterior.
 */
export function estaNaMadrugada(dataHora: Date = new Date()): boolean {
  return dataHora.getHours() < 10
}

