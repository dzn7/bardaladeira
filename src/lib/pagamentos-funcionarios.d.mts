export type EstadoPagamentoFuncionario = 'agendado' | 'proximo' | 'vence_hoje' | 'atrasado' | 'pago'
export type SituacaoPagamentoFuncionario = { estado: EstadoPagamentoFuncionario; vencimento: string; dias: number }
export function obterVencimentoMensal(competencia: string, diaVencimento: number): string | null
export function situacaoPagamentoFuncionario(entrada: {
  competencia: string; diaVencimento: number; antecedenciaDias: number; hoje: string; pagoEm?: string | null
}): SituacaoPagamentoFuncionario | null
export function validarConfiguracaoPagamento(entrada: {
  diaVencimento: number; antecedenciaDias: number; valorPrevisto?: number | string | null
}): { valida: boolean; diaVencimento: number; antecedenciaDias: number; valorPrevisto: number | null }
export function competenciaAtual(agora?: Date): string
export function formatarCompetencia(competencia: string): string
export function hojeIso(agora?: Date): string
