import test from 'node:test'
import assert from 'node:assert/strict'

import {
  STATUS_ELEGIVEIS_IMPRESSAO,
  ehStatusElegivel,
  calcularIntervaloPollingMs,
  decidirCredenciaisSupabase,
  INTERVALO_DESCOBERTA_MAXIMO_SEGUNDOS,
  decidirRecargaAposCiclo,
  marcarEscritaPropria,
  ehEcoProprio,
  decidirReacaoEvento,
  aplicarEventoNaLista,
  calcularOrdinalDiario
  ,dadosFalhaPendenciaNoInicio
} from '../electron/servicos/politicaFila.mjs'

// ---------------------------------------------------------------- CA6
test('CA6: somente `pendente` entra na descoberta de trabalho', () => {
  assert.deepEqual([...STATUS_ELEGIVEIS_IMPRESSAO], ['pendente'])
  assert.equal(ehStatusElegivel('pendente'), true)
  for (const status of ['processando', 'impresso', 'erro', 'cancelado', '', null, undefined]) {
    assert.equal(ehStatusElegivel(status), false, `status ${String(status)} nao pode ser elegivel`)
  }
})

// ---------------------------------------------------------------- CA2
// Contrato NOVO (pedido do dono em 2026-08-22): o ticket tem de sair em no
// maximo 2 s. Realtime continua sendo o caminho rapido (sub-segundo), mas a
// descoberta por poll passa a ser a GARANTIA, entao ela nao pode ser espacada
// por "Realtime parece saudavel" - esse e exatamente o estado em que um
// websocket meio-aberto mente e o pedido fica parado.
test('CA2: descoberta nunca espera mais de 2s, com Realtime saudavel ou nao', () => {
  assert.equal(
    calcularIntervaloPollingMs({ intervaloConfiguradoSegundos: 5, realtimeSaudavel: true }),
    2000
  )
  assert.equal(
    calcularIntervaloPollingMs({ intervaloConfiguradoSegundos: 5, realtimeSaudavel: false }),
    2000
  )
})

test('CA2: poll configurado mais lento que 2s e teto, nao promessa', () => {
  assert.equal(
    calcularIntervaloPollingMs({ intervaloConfiguradoSegundos: 120, realtimeSaudavel: true }),
    INTERVALO_DESCOBERTA_MAXIMO_SEGUNDOS * 1000
  )
})

test('CA2: intervalo invalido cai em 2s, nunca em 0', () => {
  assert.equal(
    calcularIntervaloPollingMs({ intervaloConfiguradoSegundos: 0, realtimeSaudavel: false }),
    2000
  )
  assert.equal(
    calcularIntervaloPollingMs({ intervaloConfiguradoSegundos: Number.NaN, realtimeSaudavel: false }),
    2000
  )
})

test('CA2: operador pode pedir MAIS rapido que 2s, mas nunca laco apertado', () => {
  assert.equal(
    calcularIntervaloPollingMs({ intervaloConfiguradoSegundos: 1, realtimeSaudavel: true }),
    1000
  )
  assert.equal(
    calcularIntervaloPollingMs({ intervaloConfiguradoSegundos: 0.1, realtimeSaudavel: false }),
    1000
  )
})

// ---------------------------------------------------------------- CA10
// A causa raiz do "nao esta imprimindo" de 2026-08-22: a config persistida no
// electron-store apontava para o projeto Supabase aposentado. Trocar so o
// padrao do main.ts nao conserta maquina instalada - o persistido vence.
const PADRAO = {
  urlPadrao: 'https://novo.supabase.co',
  chavePadrao: 'chave-nova'
}

test('CA10: url persistida aposentada e migrada para o projeto atual', () => {
  const r = decidirCredenciaisSupabase({
    urlPersistida: 'https://antigo.supabase.co',
    chavePersistida: 'chave-antiga',
    urlsAposentadas: ['https://antigo.supabase.co'],
    ...PADRAO
  })
  assert.equal(r.url, 'https://novo.supabase.co')
  assert.equal(r.anonKey, 'chave-nova')
  assert.equal(r.migrada, true)
})

test('CA10: a comparacao ignora barra final, espaco e caixa', () => {
  const r = decidirCredenciaisSupabase({
    urlPersistida: '  HTTPS://Antigo.Supabase.CO/  ',
    chavePersistida: 'chave-antiga',
    urlsAposentadas: ['https://antigo.supabase.co'],
    ...PADRAO
  })
  assert.equal(r.migrada, true)
  assert.equal(r.url, 'https://novo.supabase.co')
})

test('CA10: url vazia usa o padrao', () => {
  const r = decidirCredenciaisSupabase({
    urlPersistida: '',
    chavePersistida: '',
    urlsAposentadas: ['https://antigo.supabase.co'],
    ...PADRAO
  })
  assert.equal(r.url, 'https://novo.supabase.co')
  assert.equal(r.anonKey, 'chave-nova')
  assert.equal(r.migrada, true)
})

test('CA10: projeto proprio do operador NAO e sobrescrito', () => {
  const r = decidirCredenciaisSupabase({
    urlPersistida: 'https://outro-restaurante.supabase.co',
    chavePersistida: 'chave-do-operador',
    urlsAposentadas: ['https://antigo.supabase.co'],
    ...PADRAO
  })
  assert.equal(r.url, 'https://outro-restaurante.supabase.co')
  assert.equal(r.anonKey, 'chave-do-operador')
  assert.equal(r.migrada, false)
})

test('CA10: url igual ao padrao sem chave persistida recupera a chave padrao', () => {
  const r = decidirCredenciaisSupabase({
    urlPersistida: 'https://novo.supabase.co',
    chavePersistida: '',
    urlsAposentadas: ['https://antigo.supabase.co'],
    ...PADRAO
  })
  assert.equal(r.anonKey, 'chave-nova')
})

// ---------------------------------------------------------------- CA1
test('CA1: ciclo sem trabalho nao recarrega a lista integral', () => {
  assert.equal(decidirRecargaAposCiclo({ processados: 0 }), false)
})

test('CA1: ciclo que processou trabalho recarrega a lista uma vez', () => {
  assert.equal(decidirRecargaAposCiclo({ processados: 1 }), true)
  assert.equal(decidirRecargaAposCiclo({ processados: 7 }), true)
})

test('bootstrap: pendência anterior fica em erro e nunca retorna para pendente', () => {
  assert.deepEqual(dadosFalhaPendenciaNoInicio('2026-09-20T12:00:00.000Z'), {
    status: 'erro',
    processado_em: '2026-09-20T12:00:00.000Z',
    erro_mensagem: 'Nao impresso: fila encontrada ao iniciar o aplicativo.',
    erro: 'Nao impresso: fila encontrada ao iniciar o aplicativo.'
  })
})

// ---------------------------------------------------------------- CA4
test('CA4: UPDATE originado do proprio Electron e reconhecido como eco', () => {
  const agora = 1_000_000
  let mapa = new Map()
  mapa = marcarEscritaPropria(mapa, 'job-1', agora)

  assert.equal(ehEcoProprio(mapa, 'job-1', agora + 500), true)
  assert.equal(ehEcoProprio(mapa, 'job-2', agora + 500), false)
})

test('CA4: eco expira e deixa de mascarar evento legitimo posterior', () => {
  const agora = 1_000_000
  const mapa = marcarEscritaPropria(new Map(), 'job-1', agora)
  assert.equal(ehEcoProprio(mapa, 'job-1', agora + 60_000), false)
})

test('CA4: eco proprio nao dispara reprocessamento nem consulta', () => {
  const mapa = marcarEscritaPropria(new Map(), 'job-1', 1_000)
  const reacao = decidirReacaoEvento({
    eventType: 'UPDATE',
    registro: { id: 'job-1', status: 'processando' },
    escritasProprias: mapa,
    agoraMs: 1_500
  })

  assert.equal(reacao.processar, false)
  assert.equal(reacao.consultar, false)
})

// ---------------------------------------------------------------- CA5
test('CA5: INSERT dispara processamento', () => {
  const reacao = decidirReacaoEvento({
    eventType: 'INSERT',
    registro: { id: 'job-9', status: 'pendente' },
    escritasProprias: new Map(),
    agoraMs: 1_000
  })

  assert.equal(reacao.processar, true)
  assert.equal(reacao.atualizarLista, true)
})

test('CA5: UPDATE que devolve o job para pendente dispara processamento', () => {
  const reacao = decidirReacaoEvento({
    eventType: 'UPDATE',
    registro: { id: 'job-9', status: 'pendente' },
    escritasProprias: new Map(),
    agoraMs: 1_000
  })

  assert.equal(reacao.processar, true)
})

test('CA5: UPDATE de terceiro para impresso atualiza a lista mas nao imprime', () => {
  const reacao = decidirReacaoEvento({
    eventType: 'UPDATE',
    registro: { id: 'job-9', status: 'impresso' },
    escritasProprias: new Map(),
    agoraMs: 1_000
  })

  assert.equal(reacao.processar, false)
  assert.equal(reacao.atualizarLista, true)
})

test('CA5: DELETE remove da lista e nao imprime', () => {
  const reacao = decidirReacaoEvento({
    eventType: 'DELETE',
    registro: { id: 'job-9' },
    escritasProprias: new Map(),
    agoraMs: 1_000
  })

  assert.equal(reacao.processar, false)
  assert.equal(reacao.atualizarLista, true)
  assert.equal(reacao.remover, true)
})

// ---------------------------------------------------------------- CA3
test('CA3: evento Realtime atualiza a lista sem exigir nova consulta', () => {
  const reacao = decidirReacaoEvento({
    eventType: 'UPDATE',
    registro: { id: 'job-9', status: 'impresso' },
    escritasProprias: new Map(),
    agoraMs: 1_000
  })

  assert.equal(reacao.consultar, false, 'nenhum evento de fila pode exigir releitura integral')
})

test('CA3: INSERT entra no topo da lista pelo payload recebido', () => {
  const lista = [{ id: 'a', criado_em: '2026-08-21T10:00:00Z', status: 'impresso' }]
  const nova = aplicarEventoNaLista({
    lista,
    eventType: 'INSERT',
    registro: { id: 'b', criado_em: '2026-08-21T11:00:00Z', status: 'pendente' },
    limite: 40
  })

  assert.deepEqual(nova.map((i) => i.id), ['b', 'a'])
})

test('CA3: UPDATE substitui a linha existente sem duplicar', () => {
  const lista = [
    { id: 'b', criado_em: '2026-08-21T11:00:00Z', status: 'pendente' },
    { id: 'a', criado_em: '2026-08-21T10:00:00Z', status: 'impresso' }
  ]
  const nova = aplicarEventoNaLista({
    lista,
    eventType: 'UPDATE',
    registro: { id: 'b', criado_em: '2026-08-21T11:00:00Z', status: 'impresso' },
    limite: 40
  })

  assert.equal(nova.length, 2)
  assert.equal(nova.find((i) => i.id === 'b').status, 'impresso')
})

test('CA3: DELETE remove a linha da lista', () => {
  const lista = [
    { id: 'b', criado_em: '2026-08-21T11:00:00Z', status: 'pendente' },
    { id: 'a', criado_em: '2026-08-21T10:00:00Z', status: 'impresso' }
  ]
  const nova = aplicarEventoNaLista({
    lista,
    eventType: 'DELETE',
    registro: { id: 'b' },
    limite: 40
  })

  assert.deepEqual(nova.map((i) => i.id), ['a'])
})

test('CA3: a lista respeita o limite e descarta o mais antigo', () => {
  const lista = [
    { id: 'b', criado_em: '2026-08-21T11:00:00Z', status: 'pendente' },
    { id: 'a', criado_em: '2026-08-21T10:00:00Z', status: 'impresso' }
  ]
  const nova = aplicarEventoNaLista({
    lista,
    eventType: 'INSERT',
    registro: { id: 'c', criado_em: '2026-08-21T12:00:00Z', status: 'pendente' },
    limite: 2
  })

  assert.deepEqual(nova.map((i) => i.id), ['c', 'b'])
})

// ---------------------------------------------------------------- CA7
test('CA7: ordinal do dia e a contagem de anteriores + 1', () => {
  assert.equal(calcularOrdinalDiario({ anteriores: 0 }), 1)
  assert.equal(calcularOrdinalDiario({ anteriores: 34 }), 35)
})

test('CA7: contagem ausente nao inventa numero', () => {
  assert.equal(calcularOrdinalDiario({ anteriores: null }), null)
  assert.equal(calcularOrdinalDiario({ anteriores: -1 }), null)
  assert.equal(calcularOrdinalDiario({ anteriores: Number.NaN }), null)
})
