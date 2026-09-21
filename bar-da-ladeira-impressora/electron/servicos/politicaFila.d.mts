export type EventoFilaRealtime = 'INSERT' | 'UPDATE' | 'DELETE'

export type RegistroEventoFila = {
  id?: unknown
  status?: unknown
  criado_em?: unknown
  created_at?: unknown
  [chave: string]: unknown
}

export type ReacaoEventoFila = {
  /** Deve disparar a descoberta/processamento de pendencias. */
  processar: boolean
  /** Deve refletir o registro no cache da lista da tela. */
  atualizarLista: boolean
  /** O evento remove a linha da lista. */
  remover: boolean
  /** Sempre `false`: o payload do Realtime dispensa nova consulta. */
  consultar: boolean
  /** O evento e eco de uma escrita feita por este proprio processo. */
  eco: boolean
}

export const STATUS_ELEGIVEIS_IMPRESSAO: readonly string[]
export const INTERVALO_DESCOBERTA_MAXIMO_SEGUNDOS: number
export const INTERVALO_POLLING_MINIMO_SEGUNDOS: number
export const URLS_SUPABASE_APOSENTADAS: readonly string[]
export const JANELA_ECO_PROPRIO_MS: number

export function ehStatusElegivel(status: unknown): boolean

export function calcularIntervaloPollingMs(entrada: {
  intervaloConfiguradoSegundos: unknown
  realtimeSaudavel: boolean
}): number

export function decidirRecargaAposCiclo(entrada: { processados: unknown }): boolean

export function dadosFalhaPendenciaNoInicio(agora?: string): {
  status: 'erro'
  processado_em: string
  erro_mensagem: string
  erro: string
}

/** Credenciais efetivas do Supabase depois da migracao de projeto aposentado. */
export type CredenciaisSupabase = {
  url: string
  anonKey: string
  /** `true` quando o valor persistido foi substituido pelo padrao atual. */
  migrada: boolean
}

export function decidirCredenciaisSupabase(entrada: {
  urlPersistida: unknown
  chavePersistida: unknown
  urlPadrao: string
  chavePadrao: string
  urlsAposentadas?: readonly string[]
}): CredenciaisSupabase

export function marcarEscritaPropria(
  mapa: Map<string, number>,
  id: unknown,
  agoraMs: number
): Map<string, number>

export function ehEcoProprio(
  mapa: Map<string, number>,
  id: unknown,
  agoraMs: number,
  janelaMs?: number
): boolean

export function decidirReacaoEvento(entrada: {
  eventType: EventoFilaRealtime
  registro: RegistroEventoFila | null | undefined
  escritasProprias: Map<string, number>
  agoraMs: number
}): ReacaoEventoFila

export function aplicarEventoNaLista<T extends RegistroEventoFila>(entrada: {
  lista: T[]
  eventType: EventoFilaRealtime
  registro: T
  limite: number
}): T[]

export function calcularOrdinalDiario(entrada: { anteriores: unknown }): number | null
