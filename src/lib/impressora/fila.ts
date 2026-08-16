import { supabase } from '@/lib/supabase'
import { DadosPedidoImpressao, EscopoImpressao, TipoTicket } from './types'

type TipoFilaImpressao = 'cozinha' | 'cliente'

type AdicionalFila = {
  nome?: string | null
  preco?: number | null
  quantidade?: number | null
}

type ItemFila = {
  nome_item?: string | null
  nome_produto?: string | null
  quantidade?: number | null
  preco_unitario?: number | null
  subtotal?: number | null
  observacoes?: string | null
  item_adicionais?: AdicionalFila[] | null
}

type PagamentoFila = {
  forma_pagamento?: string | null
  valor?: number | null
}

type PedidoFila = {
  id?: string | null
  numero_pedido?: number | string | null
  numero_pedido_diario?: number | null
  nome_cliente?: string | null
  telefone?: string | null
  tipo_entrega?: string | null
  mesa?: number | null
  mesa_numero?: number | null
  comanda?: number | null
  endereco?: string | null
  bairro?: string | null
  observacoes?: string | null
  created_at?: string | null
  subtotal?: number | null
  taxa_entrega?: number | null
  taxa_servico?: number | null
  total?: number | null
  forma_pagamento?: string | null
  pagamentos_pedido?: PagamentoFila[] | null
  pagamentos_divididos?: PagamentoFila[] | null
  troco_para?: number | null
  valor_troco?: number | null
  origem_conferencia?: boolean | null
  modo_taxa_conferencia?: 'com_taxa' | 'sem_taxa' | null
  itens_pedido?: ItemFila[] | null
}

type RegistroFilaBruto = {
  id: string
  pedido_id: string
  tipo: TipoFilaImpressao
  status: 'pendente' | 'processando' | 'impresso' | 'erro'
  escopo?: EscopoImpressao | null
  itens_snapshot?: ItemFila[] | null
  pedido_snapshot?: Partial<PedidoFila> | null
  tentativas?: number | null
  erro_mensagem?: string | null
  erro?: string | null
  origem?: string | null
  criado_em?: string | null
  created_at?: string | null
  pedidos?: PedidoFila | null
}

export type RegistroFilaImpressao = {
  id: string
  pedidoId: string
  tipo: TipoFilaImpressao
  escopo: EscopoImpressao
  origem: string | null
  tentativas: number
  bruto: RegistroFilaBruto
}

export type TrabalhoImpressaoFila = {
  registro: RegistroFilaImpressao
  tipoTicket: Exclude<TipoTicket, 'completo'>
  dados: DadosPedidoImpressao
}

const TIMEOUT_PROCESSAMENTO_MINUTOS = 5

// PostgREST é sensível à formatação do select; manter em linha única evita parser
// inconsistente em relações aninhadas no cliente.
const SELECAO_PENDENCIAS_IMPRESSAO =
  'id,pedido_id,tipo,status,escopo,itens_snapshot,pedido_snapshot,tentativas,erro_mensagem,erro,origem,criado_em,created_at,' +
  'pedidos:pedidos!fila_impressao_pedido_id_fkey(' +
    'id,numero_pedido,nome_cliente,telefone,tipo_entrega,mesa,comanda,endereco,bairro,observacoes,created_at,subtotal,taxa_entrega,taxa_servico,total,forma_pagamento,troco_para,' +
    'itens_pedido(id,nome_item,nome_produto,quantidade,preco_unitario,subtotal,observacoes,item_adicionais(id,nome,preco,quantidade)),' +
    'pagamentos_pedido(forma_pagamento,valor)' +
  ')'

const SELECAO_PENDENCIAS_IMPRESSAO_FALLBACK =
  'id,pedido_id,tipo,status,escopo,itens_snapshot,pedido_snapshot,tentativas,erro_mensagem,erro,origem,criado_em,created_at'

const numeroSeguro = (valor: unknown, fallback = 0) => {
  const numero = Number(valor)
  return Number.isFinite(numero) ? numero : fallback
}

const numeroInteiroOpcional = (valor: unknown) => {
  const numero = Number(valor)
  if (!Number.isFinite(numero)) return null
  return Math.trunc(numero)
}

const textoOpcional = (valor: unknown) => {
  if (valor === null || valor === undefined) return null
  const texto = String(valor).trim()
  return texto || null
}

const mapearPagamentos = (valor: unknown) => {
  if (!Array.isArray(valor)) return []

  return valor
    .map((pagamento) => ({
      forma: textoOpcional((pagamento as PagamentoFila)?.forma_pagamento),
      valor: numeroSeguro((pagamento as PagamentoFila)?.valor),
    }))
    .filter((pagamento) => pagamento.forma && pagamento.valor > 0) as Array<{
      forma: string
      valor: number
    }>
}

const mapearItens = (valor: unknown) => {
  if (!Array.isArray(valor)) return []

  return valor.map((item) => {
    const itemFila = (item || {}) as ItemFila
    const quantidade = Math.max(1, numeroSeguro(itemFila.quantidade, 1))
    const precoTotal = Number(numeroSeguro(itemFila.subtotal).toFixed(2))

    return {
      nome: textoOpcional(itemFila.nome_item) || textoOpcional(itemFila.nome_produto) || 'Item',
      quantidade,
      precoUnitario: Number((numeroSeguro(itemFila.preco_unitario, precoTotal / quantidade)).toFixed(2)),
      precoTotal,
      observacoes: textoOpcional(itemFila.observacoes) || undefined,
      adicionais: Array.isArray(itemFila.item_adicionais)
        ? itemFila.item_adicionais
            .map((adicional) => ({
              nome: textoOpcional(adicional?.nome) || 'Adicional',
              preco: Number(numeroSeguro(adicional?.preco).toFixed(2)),
              quantidade: Math.max(1, numeroSeguro(adicional?.quantidade, 1)),
            }))
            .filter((adicional) => adicional.nome)
        : [],
    }
  })
}

const normalizarTipoEntrega = (valor: unknown): DadosPedidoImpressao['tipoEntrega'] => {
  const tipo = String(valor || '').trim().toLowerCase()
  if (tipo.includes('entrega')) return 'entrega'
  if (tipo.includes('retirada') || tipo.includes('balcao')) return 'retirada'
  return 'local'
}

const construirDadosPedido = (registroBruto: RegistroFilaBruto): DadosPedidoImpressao | null => {
  const pedidoBanco = registroBruto.pedidos || {}
  const pedidoSnapshot = registroBruto.pedido_snapshot || {}
  const origemConferencia =
    Boolean(pedidoSnapshot.origem_conferencia) ||
    String(registroBruto.origem || '').startsWith('admin_conferencia_')

  const escolherTexto = (valorBanco: unknown, valorSnapshot: unknown, fallback?: string | null) => {
    const prioritario = origemConferencia ? valorSnapshot : valorBanco
    const secundario = origemConferencia ? valorBanco : valorSnapshot
    return textoOpcional(prioritario) || textoOpcional(secundario) || fallback || null
  }

  const escolherNumero = (valorBanco: unknown, valorSnapshot: unknown, fallback = 0) => {
    const prioritario = origemConferencia ? valorSnapshot : valorBanco
    const secundario = origemConferencia ? valorBanco : valorSnapshot
    const numeroPrioritario = numeroSeguro(prioritario, Number.NaN)
    if (Number.isFinite(numeroPrioritario)) return numeroPrioritario
    const numeroSecundario = numeroSeguro(secundario, Number.NaN)
    if (Number.isFinite(numeroSecundario)) return numeroSecundario
    return fallback
  }

  const escolherInteiroOpcional = (valorBanco: unknown, valorSnapshot: unknown) => {
    const prioritario = origemConferencia ? valorSnapshot : valorBanco
    const secundario = origemConferencia ? valorBanco : valorSnapshot
    return numeroInteiroOpcional(prioritario) ?? numeroInteiroOpcional(secundario)
  }

  const pagamentosBanco = mapearPagamentos((pedidoBanco as PedidoFila).pagamentos_pedido || (pedidoBanco as PedidoFila).pagamentos_divididos)
  const pagamentosSnapshot = mapearPagamentos((pedidoSnapshot as PedidoFila).pagamentos_divididos)
  const pagamentosDivididos = origemConferencia
    ? (pagamentosSnapshot.length > 0 ? pagamentosSnapshot : pagamentosBanco)
    : (pagamentosBanco.length > 0 ? pagamentosBanco : pagamentosSnapshot)

  const itensBanco = mapearItens((pedidoBanco as PedidoFila).itens_pedido)
  const itensSnapshot = mapearItens(registroBruto.itens_snapshot)
  const itens = registroBruto.escopo === 'itens_novos' && itensSnapshot.length > 0
    ? itensSnapshot
    : origemConferencia
      ? (itensSnapshot.length > 0 ? itensSnapshot : itensBanco)
      : (itensBanco.length > 0 ? itensBanco : itensSnapshot)

  const idPedido = escolherTexto((pedidoBanco as PedidoFila).id, pedidoSnapshot.id, registroBruto.pedido_id)

  if (!idPedido) {
    return null
  }

  const subtotalItens = Number(itens.reduce((acumulador, item) => acumulador + numeroSeguro(item.precoTotal), 0).toFixed(2))
  const subtotal = registroBruto.escopo === 'itens_novos'
    ? subtotalItens
    : Number(escolherNumero((pedidoBanco as PedidoFila).subtotal, pedidoSnapshot.subtotal, subtotalItens).toFixed(2))
  const taxaEntrega = registroBruto.escopo === 'itens_novos'
    ? 0
    : Number(escolherNumero((pedidoBanco as PedidoFila).taxa_entrega, pedidoSnapshot.taxa_entrega, 0).toFixed(2))
  const taxaServico = registroBruto.escopo === 'itens_novos'
    ? 0
    : Number(escolherNumero((pedidoBanco as PedidoFila).taxa_servico, pedidoSnapshot.taxa_servico, 0).toFixed(2))
  const total = registroBruto.escopo === 'itens_novos'
    ? subtotalItens
    : Number(escolherNumero((pedidoBanco as PedidoFila).total, pedidoSnapshot.total, subtotal + taxaEntrega + taxaServico).toFixed(2))
  const trocoPara = escolherNumero((pedidoBanco as PedidoFila).troco_para, pedidoSnapshot.troco_para, Number.NaN)
  const valorTroco = Number.isFinite(numeroSeguro((pedidoSnapshot as PedidoFila).valor_troco, Number.NaN))
    ? Number(numeroSeguro((pedidoSnapshot as PedidoFila).valor_troco).toFixed(2))
    : Number.isFinite(trocoPara) && trocoPara > total
      ? Number((trocoPara - total).toFixed(2))
      : undefined

  const numeroPedidoSnapshot = numeroInteiroOpcional(pedidoSnapshot.numero_pedido) ?? numeroInteiroOpcional(pedidoSnapshot.numero_pedido_diario)
  const numeroPedidoBanco = numeroInteiroOpcional((pedidoBanco as PedidoFila).numero_pedido) ?? numeroInteiroOpcional((pedidoBanco as PedidoFila).numero_pedido_diario)

  return {
    idPedido: idPedido,
    numeroPedido: String(
      numeroPedidoSnapshot ||
      numeroPedidoBanco ||
      idPedido.slice(0, 8).toUpperCase()
    ),
    dataHora: new Date(
      escolherTexto((pedidoBanco as PedidoFila).created_at, pedidoSnapshot.created_at, new Date().toISOString()) ||
      new Date().toISOString()
    ),
    tipoEntrega: normalizarTipoEntrega(escolherTexto((pedidoBanco as PedidoFila).tipo_entrega, pedidoSnapshot.tipo_entrega)),
    nomeCliente: escolherTexto((pedidoBanco as PedidoFila).nome_cliente, pedidoSnapshot.nome_cliente, 'Cliente') || 'Cliente',
    telefone: escolherTexto((pedidoBanco as PedidoFila).telefone, pedidoSnapshot.telefone) || undefined,
    endereco: escolherTexto((pedidoBanco as PedidoFila).endereco, pedidoSnapshot.endereco) || undefined,
    bairro: escolherTexto((pedidoBanco as PedidoFila).bairro, pedidoSnapshot.bairro) || undefined,
    mesa: escolherInteiroOpcional((pedidoBanco as PedidoFila).mesa ?? (pedidoBanco as PedidoFila).mesa_numero, pedidoSnapshot.mesa ?? pedidoSnapshot.mesa_numero) || undefined,
    comanda: escolherInteiroOpcional((pedidoBanco as PedidoFila).comanda, pedidoSnapshot.comanda) || undefined,
    itens,
    subtotal,
    taxaEntrega,
    taxaServico,
    total,
    formaPagamento: escolherTexto((pedidoBanco as PedidoFila).forma_pagamento, pedidoSnapshot.forma_pagamento, 'Nao informado') || 'Nao informado',
    pagamentosDivididos: pagamentosDivididos.length > 0 ? pagamentosDivididos : undefined,
    observacoes: escolherTexto((pedidoBanco as PedidoFila).observacoes, pedidoSnapshot.observacoes) || undefined,
    trocoPara: Number.isFinite(trocoPara) ? Number(trocoPara.toFixed(2)) : undefined,
    valorTroco,
    escopo: registroBruto.escopo || 'pedido_completo',
    impressoEm: new Date(),
  }
}

export async function buscarPendenciasImpressao(limit = 20): Promise<RegistroFilaImpressao[]> {
  const consultarPendencias = async (selecao: string) => supabase
    .from('fila_impressao')
    .select(selecao)
    .eq('status', 'pendente')
    .order('criado_em', { ascending: true })
    .limit(limit)

  const respostaPrimaria = await consultarPendencias(SELECAO_PENDENCIAS_IMPRESSAO)

  if (respostaPrimaria.error) {
    const respostaFallback = await consultarPendencias(SELECAO_PENDENCIAS_IMPRESSAO_FALLBACK)

    if (respostaFallback.error) {
      throw respostaPrimaria.error
    }

    console.warn(
      '[Impressora] Consulta completa da fila falhou; usando snapshots da fila como fallback.',
      respostaPrimaria.error
    )

    return (respostaFallback.data || []).map((registro: unknown) => {
      const bruto = registro as RegistroFilaBruto
      return {
        id: bruto.id,
        pedidoId: bruto.pedido_id,
        tipo: bruto.tipo,
        escopo: bruto.escopo || 'pedido_completo',
        origem: bruto.origem || null,
        tentativas: Math.max(0, numeroSeguro(bruto.tentativas)),
        bruto,
      }
    })
  }

  return (respostaPrimaria.data || []).map((registro: unknown) => {
    const bruto = registro as RegistroFilaBruto
    return {
      id: bruto.id,
      pedidoId: bruto.pedido_id,
      tipo: bruto.tipo,
      escopo: bruto.escopo || 'pedido_completo',
      origem: bruto.origem || null,
      tentativas: Math.max(0, numeroSeguro(bruto.tentativas)),
      bruto,
    }
  })
}

export async function liberarFilaTravada(
  minutos = TIMEOUT_PROCESSAMENTO_MINUTOS
): Promise<number> {
  const limiteIso = new Date(Date.now() - minutos * 60_000).toISOString()

  const { data, error } = await supabase
    .from('fila_impressao')
    .update({
      status: 'pendente',
      processado_em: null,
      erro_mensagem: null,
      erro: null,
    })
    .eq('status', 'processando')
    .is('impresso_em', null)
    .lt('processado_em', limiteIso)
    .select('id')

  if (error) {
    throw error
  }

  return data?.length || 0
}

export async function reivindicarFilaImpressao(id: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('fila_impressao')
    .update({
      status: 'processando',
      processado_em: new Date().toISOString(),
      erro_mensagem: null,
      erro: null,
    })
    .eq('id', id)
    .eq('status', 'pendente')
    .select('id')

  if (error) {
    throw error
  }

  return Boolean(data && data.length > 0)
}

export async function marcarFilaComoImpressa(id: string) {
  const { error } = await supabase
    .from('fila_impressao')
    .update({
      status: 'impresso',
      impresso_em: new Date().toISOString(),
      erro_mensagem: null,
      erro: null,
    })
    .eq('id', id)
    .eq('status', 'processando')

  if (error) {
    throw error
  }
}

export async function marcarFilaComoErro(id: string, tentativasAtuais: number, mensagem: string) {
  const { error } = await supabase
    .from('fila_impressao')
    .update({
      status: 'erro',
      tentativas: tentativasAtuais + 1,
      erro_mensagem: mensagem,
      erro: mensagem,
    })
    .eq('id', id)
    .eq('status', 'processando')

  if (error) {
    throw error
  }
}

export function montarTrabalhoImpressaoFila(registro: RegistroFilaImpressao): TrabalhoImpressaoFila | null {
  const dados = construirDadosPedido(registro.bruto)

  if (!dados) {
    return null
  }

  return {
    registro,
    tipoTicket: registro.tipo === 'cliente' ? 'cliente' : 'cozinha',
    dados,
  }
}
