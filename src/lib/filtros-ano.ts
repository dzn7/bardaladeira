/**
 * Utilitários para filtrar dados por ano
 * Utilizado para separar dados do ano atual dos anos anteriores
 */

// Ano que marca o início do "novo período" - dados a partir desta data são considerados atuais
export const ANO_INICIO_ATUAL = 2026

// Data exata do início do ano atual (1 de janeiro às 00:00:00 no fuso horário de São Paulo)
export const DATA_INICIO_ANO_ATUAL = '2026-01-01T03:00:00.000Z' // UTC-3 = 00:00 em SP

/**
 * Retorna a data de início do ano atual em formato ISO
 * Considera o fuso horário de São Paulo (UTC-3)
 */
export function obterDataInicioAnoAtual(): string {
  return DATA_INICIO_ANO_ATUAL
}

/**
 * Retorna a data de fim do ano anterior (31/12/2025 23:59:59) em formato ISO
 * Considera o fuso horário de São Paulo (UTC-3)
 */
export function obterDataFimAnoAnterior(): string {
  // 31/12/2025 23:59:59.999 em SP = 01/01/2026 02:59:59.999 UTC
  return '2026-01-01T02:59:59.999Z'
}

/**
 * Verifica se uma data pertence ao ano atual (2026+)
 */
export function ehAnoAtual(data: Date | string): boolean {
  const dataObj = typeof data === 'string' ? new Date(data) : data
  const dataInicio = new Date(DATA_INICIO_ANO_ATUAL)
  return dataObj >= dataInicio
}

/**
 * Verifica se uma data pertence aos anos anteriores (antes de 2026)
 */
export function ehAnoAnterior(data: Date | string): boolean {
  return !ehAnoAtual(data)
}

/**
 * Retorna os anos anteriores disponíveis para consulta
 * Por enquanto retorna apenas 2025, mas pode ser expandido
 */
export function obterAnosAnterioresDisponiveis(): number[] {
  return [2025]
}

/**
 * Retorna as datas de início e fim para um ano específico
 * Considera o fuso horário de São Paulo (UTC-3)
 */
export function obterPeriodoAno(ano: number): { inicio: string; fim: string } {
  // Início do ano: 01/01 às 00:00:00 em SP = 03:00:00 UTC
  const inicio = `${ano}-01-01T03:00:00.000Z`
  
  // Fim do ano: 31/12 às 23:59:59.999 em SP = 01/01 do próximo ano às 02:59:59.999 UTC
  const fim = `${ano + 1}-01-01T02:59:59.999Z`
  
  return { inicio, fim }
}

/**
 * Retorna a data de início de um ano específico em formato ISO
 * Considera o fuso horário de São Paulo (UTC-3)
 */
export function obterDataInicioAno(ano: number): string {
  return `${ano}-01-01T03:00:00.000Z`
}

/**
 * Retorna a data de fim de um ano específico em formato ISO
 * Considera o fuso horário de São Paulo (UTC-3)
 */
export function obterDataFimAno(ano: number): string {
  return `${ano + 1}-01-01T02:59:59.999Z`
}

/**
 * Formata uma data para exibição no padrão brasileiro
 */
export function formatarDataBR(data: Date | string): string {
  const dataObj = typeof data === 'string' ? new Date(data) : data
  return dataObj.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo'
  })
}

/**
 * Formata uma data e hora para exibição no padrão brasileiro
 */
export function formatarDataHoraBR(data: Date | string): string {
  const dataObj = typeof data === 'string' ? new Date(data) : data
  return dataObj.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo'
  })
}
