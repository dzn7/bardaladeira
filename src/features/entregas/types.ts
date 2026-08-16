export type PeriodoEntrega = 'todos' | 'hoje' | '7dias' | '30dias' | 'semana' | 'mes' | 'personalizado'

export type IntervaloEntregas = {
  dataInicio: string
  dataFim: string
  inicioIso: string
  fimExclusivoIso: string
}

export type FiltrosConsultaEntregas = Pick<IntervaloEntregas, 'inicioIso' | 'fimExclusivoIso'>
