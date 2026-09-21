/**
 * Politica de consumo da `fila_impressao`.
 *
 * Decisoes puras, sem Supabase e sem Electron, para que as invariantes de
 * impressao (I1-I9 da SPEC) sejam provaveis por `node --test`.
 *
 * A regra que este modulo existe para sustentar: **descobrir trabalho** e
 * **atualizar a lista da tela** sao operacoes diferentes e nao podem
 * compartilhar cadencia. Ver specs/egress-supabase-fila-impressao.md.
 */

/** Unico status que representa trabalho a fazer. */
export const STATUS_ELEGIVEIS_IMPRESSAO = Object.freeze(['pendente'])

/**
 * Teto da descoberta de trabalho. O dono exige ticket na mesa em ate 2 s
 * (2026-08-22), entao o poll de descoberta e a GARANTIA e nao pode ser
 * espacado por "o Realtime parece saudavel": websocket meio-aberto continua
 * reportando SUBSCRIBED enquanto deixa de entregar, e foi assim que pedido
 * ficou parado na fila.
 */
export const INTERVALO_DESCOBERTA_MAXIMO_SEGUNDOS = 2

/** Piso absoluto do poll, para nunca virar laco apertado. */
export const INTERVALO_POLLING_MINIMO_SEGUNDOS = 1

/**
 * Projetos Supabase que o app ja usou e que nao recebem mais pedido.
 * Config persistida apontando para um deles e migrada na inicializacao —
 * trocar so o padrao do main.ts nao conserta maquina ja instalada, porque
 * o valor do electron-store vence o padrao.
 */
export const URLS_SUPABASE_APOSENTADAS = Object.freeze([
  'https://bawysvqqeqwxasmggfcn.supabase.co'
])

/** Quanto tempo um UPDATE escrito pelo proprio processo conta como eco. */
export const JANELA_ECO_PROPRIO_MS = 15_000

export const ehStatusElegivel = (status) =>
  STATUS_ELEGIVEIS_IMPRESSAO.includes(String(status ?? ''))

/**
 * Realtime e o caminho rapido (sub-segundo); este poll e a rede que garante o
 * teto de 2 s quando o Realtime silencia. Por isso `realtimeSaudavel` nao
 * espaca mais nada — o parametro segue no contrato apenas porque a chamada e o
 * teste existentes o passam, e removê-lo seria quebra de assinatura (§6.3).
 */
export const calcularIntervaloPollingMs = ({
  intervaloConfiguradoSegundos,
  realtimeSaudavel
}) => {
  void realtimeSaudavel

  const bruto = Number(intervaloConfiguradoSegundos)
  const configurado = Number.isFinite(bruto) && bruto > 0
    ? bruto
    : INTERVALO_DESCOBERTA_MAXIMO_SEGUNDOS

  const efetivo = Math.min(
    INTERVALO_DESCOBERTA_MAXIMO_SEGUNDOS,
    Math.max(INTERVALO_POLLING_MINIMO_SEGUNDOS, configurado)
  )

  return efetivo * 1000
}

const normalizarUrlProjeto = (valor) =>
  String(valor ?? '').trim().toLowerCase().replace(/\/+$/, '')

/**
 * Decide com qual projeto Supabase o app fala.
 *
 * Regra: o operador continua dono da configuracao dele — url customizada e
 * preservada. O que e sobrescrito e so o que comprovadamente nao recebe mais
 * pedido (lista `URLS_SUPABASE_APOSENTADAS`) e o vazio.
 */
export const decidirCredenciaisSupabase = ({
  urlPersistida,
  chavePersistida,
  urlPadrao,
  chavePadrao,
  urlsAposentadas = URLS_SUPABASE_APOSENTADAS
}) => {
  const url = normalizarUrlProjeto(urlPersistida)
  const aposentadas = (urlsAposentadas || []).map(normalizarUrlProjeto)
  const aposentada = url !== '' && aposentadas.includes(url)

  if (url === '' || aposentada) {
    return { url: urlPadrao, anonKey: chavePadrao, migrada: true }
  }

  const chave = String(chavePersistida ?? '').trim()

  if (chave === '' && url === normalizarUrlProjeto(urlPadrao)) {
    return { url: urlPersistida, anonKey: chavePadrao, migrada: false }
  }

  return { url: urlPersistida, anonKey: chavePersistida, migrada: false }
}

export const decidirRecargaAposCiclo = ({ processados }) => Number(processados) > 0

export const dadosFalhaPendenciaNoInicio = (agora = new Date().toISOString()) => ({
  status: 'erro',
  processado_em: agora,
  erro_mensagem: 'Nao impresso: fila encontrada ao iniciar o aplicativo.',
  erro: 'Nao impresso: fila encontrada ao iniciar o aplicativo.'
})

export const marcarEscritaPropria = (mapa, id, agoraMs) => {
  const destino = mapa instanceof Map ? mapa : new Map()
  if (!id) return destino

  for (const [chave, quando] of destino) {
    if (agoraMs - quando > JANELA_ECO_PROPRIO_MS) destino.delete(chave)
  }

  destino.set(String(id), agoraMs)
  return destino
}

export const ehEcoProprio = (mapa, id, agoraMs, janelaMs = JANELA_ECO_PROPRIO_MS) => {
  if (!(mapa instanceof Map) || !id) return false
  const quando = mapa.get(String(id))
  if (quando === undefined) return false
  return agoraMs - quando <= janelaMs
}

/**
 * O que fazer com um evento de `postgres_changes` da fila.
 *
 * `consultar` e sempre `false` de proposito: o payload do Realtime ja traz a
 * linha inteira, entao atualizar a lista nunca justifica uma nova requisicao.
 */
export const decidirReacaoEvento = ({ eventType, registro, escritasProprias, agoraMs }) => {
  const id = registro?.id ? String(registro.id) : ''
  const status = registro?.status
  const eco = ehEcoProprio(escritasProprias, id, agoraMs)

  const remover = eventType === 'DELETE'
  const processar =
    !eco &&
    !remover &&
    (eventType === 'INSERT' || (eventType === 'UPDATE' && ehStatusElegivel(status)))

  return {
    processar,
    atualizarLista: Boolean(id),
    remover,
    consultar: false,
    eco
  }
}

const compararFila = (a, b) => {
  const dataA = a?.criado_em || a?.created_at || ''
  const dataB = b?.criado_em || b?.created_at || ''

  if (dataA > dataB) return -1
  if (dataA < dataB) return 1
  return String(a?.id || '').localeCompare(String(b?.id || ''))
}

/** Aplica o payload do Realtime no cache em memoria. Zero bytes de rede. */
export const aplicarEventoNaLista = ({ lista, eventType, registro, limite }) => {
  const atual = Array.isArray(lista) ? lista : []
  const id = registro?.id ? String(registro.id) : ''
  if (!id) return atual

  const semRegistro = atual.filter((item) => String(item?.id || '') !== id)

  if (eventType === 'DELETE') return semRegistro

  return [...semRegistro, registro]
    .sort(compararFila)
    .slice(0, Math.max(1, Number(limite) || 1))
}

/**
 * Posicao do pedido dentro do dia operacional, a partir de quantos pedidos o
 * antecedem. Substitui baixar o dia inteiro so para achar um indice.
 */
export const calcularOrdinalDiario = ({ anteriores }) => {
  if (anteriores === null || anteriores === undefined || anteriores === '') return null
  const numero = Number(anteriores)
  if (!Number.isFinite(numero) || numero < 0) return null
  return Math.trunc(numero) + 1
}
