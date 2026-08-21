import {
  criarPagamentoPixMercadoPago,
  gerarEmailPagador,
  mapearStatusMercadoPago,
  MercadoPagoPaymentResponse,
  obterPagamentoMercadoPago,
  statusFinalPagamentoOnline,
  StatusPagamentoOnline,
} from '@/lib/server/mercado-pago'
import { buscarProximoNumeroPedidoDiario, normalizarNumeroPedido, sincronizarNumeroPedidoDiario } from '@/lib/pedidos/numero-diario'
import { obterSupabaseAdmin } from '@/lib/server/supabase-admin'
import { nomeClienteParaPedido } from '@/lib/nome-cliente-local.mjs'

type TipoEntrega = 'entrega' | 'retirada' | 'local'
type TipoCatalogoItemCheckout = 'produto' | 'bebida' | 'combo'

type AdicionalCheckout = {
  id?: string
  nome: string
  preco: number
}

type ProdutoCheckout = {
  id?: string
  nome: string
  preco: number
}

type ItemCheckout = {
  produto: ProdutoCheckout
  origemItem?: TipoCatalogoItemCheckout
  quantidade: number
  subtotal: number
  observacoes?: string
  adicionais?: AdicionalCheckout[]
}

type CupomCheckout = {
  id: string
  codigo: string
  tipoDesconto: 'percentual' | 'valor_fixo' | 'frete_gratis'
  valorDesconto: number
  valorDescontoFrete: number
  totalComDesconto: number
}

export type CriarPedidoPixOnlinePayload = {
  nomeCliente: string
  telefone?: string
  tipoEntrega: TipoEntrega
  bairro?: string
  pontoReferencia?: string
  mesaSelecionada?: number | null
  pontoLocalId?: string | null
  observacoes?: string
  subtotal: number
  taxaEntrega: number
  taxaPagamento?: number
  totalFinal: number
  formaPagamentoCodigo?: string
  formaPagamentoNome?: string
  itens: ItemCheckout[]
  cupom?: CupomCheckout | null
}

type RegistroPagamentoOnline = {
  id: string
  pedido_id: string
  external_reference: string
  mercado_pago_payment_id: string | null
  status: StatusPagamentoOnline
  status_detalhe: string | null
  qr_code: string | null
  qr_code_base64: string | null
  qr_code_ticket_url: string | null
  aprovado_processado: boolean
  valor: number
  pago_em: string | null
  expira_em: string | null
}

type PedidoOnline = {
  id: string
  numero_pedido: number
  nome_cliente: string
  tipo_entrega: string
  total: number
  taxa_entrega: number
  mesa: number | null
  bairro: string | null
  referencia: string | null
  observacoes: string | null
  telefone: string | null
  status: string
}

export type ResultadoCriacaoPixOnline = {
  pedidoId: string
  numeroPedido: number
  nomeCliente: string
  tipoEntrega: TipoEntrega
  total: number
  mesa?: number | null
  pagamentoOnlineId: string
  mercadoPagoPaymentId: string | null
  status: StatusPagamentoOnline
  qrCode: string | null
  qrCodeBase64: string | null
  qrCodeTicketUrl: string | null
  expiraEm: string | null
}

export type ResultadoStatusPagamentoOnline = ResultadoCriacaoPixOnline & {
  pagamentoAprovadoProcessado: boolean
}

type OpcoesSincronizacao = {
  pagamentoOnlineId?: string
  pedidoId?: string
  mercadoPagoPaymentId?: string
  forcarConsultaGateway?: boolean
}

type OpcoesReconciliacaoPagamentos = {
  limite?: number
}

export type ResultadoReconciliacaoPagamentos = {
  totalSelecionados: number
  totalProcessados: number
  totalPagos: number
  totalErros: number
  erros: Array<{ pagamentoOnlineId: string; erro: string }>
}

const normalizarTelefone = (telefone?: string | null): string | null => {
  if (!telefone) return null
  const digitos = telefone.replace(/\D/g, '')
  return digitos.length > 0 ? digitos : null
}

const numeroSeguro = (valor: unknown, fallback = 0): number => {
  const numero = typeof valor === 'number' ? valor : Number(valor)
  if (!Number.isFinite(numero)) return fallback
  return numero
}

const normalizarOrigemItemCheckout = (origem: unknown): TipoCatalogoItemCheckout | null => {
  if (origem === 'produto' || origem === 'bebida' || origem === 'combo') return origem
  return null
}

const hashEventoImpressaoPagamentoOnline = (pedidoId: string) =>
  `${pedidoId}:cozinha:pedido_completo:pagamento_online_aprovado`

function montarResultadoStatus(
  pedido: PedidoOnline,
  pagamento: RegistroPagamentoOnline
): ResultadoStatusPagamentoOnline {
  return {
    pedidoId: pedido.id,
    numeroPedido: pedido.numero_pedido,
    nomeCliente: pedido.nome_cliente,
    tipoEntrega: (pedido.tipo_entrega || 'retirada') as TipoEntrega,
    total: numeroSeguro(pedido.total),
    mesa: pedido.mesa,
    pagamentoOnlineId: pagamento.id,
    mercadoPagoPaymentId: pagamento.mercado_pago_payment_id,
    status: pagamento.status,
    qrCode: pagamento.qr_code,
    qrCodeBase64: pagamento.qr_code_base64,
    qrCodeTicketUrl: pagamento.qr_code_ticket_url,
    expiraEm: pagamento.expira_em,
    pagamentoAprovadoProcessado: pagamento.aprovado_processado,
  }
}

async function buscarPagamentoOnline(
  opcoes: OpcoesSincronizacao
): Promise<RegistroPagamentoOnline | null> {
  const supabase = obterSupabaseAdmin()

  if (opcoes.pagamentoOnlineId) {
    const { data, error } = await supabase
      .from('pagamentos_online')
      .select('*')
      .eq('id', opcoes.pagamentoOnlineId)
      .maybeSingle()
    if (error) throw error
    return data as RegistroPagamentoOnline | null
  }

  if (opcoes.pedidoId) {
    const { data, error } = await supabase
      .from('pagamentos_online')
      .select('*')
      .eq('pedido_id', opcoes.pedidoId)
      .maybeSingle()
    if (error) throw error
    return data as RegistroPagamentoOnline | null
  }

  if (opcoes.mercadoPagoPaymentId) {
    const { data, error } = await supabase
      .from('pagamentos_online')
      .select('*')
      .eq('mercado_pago_payment_id', opcoes.mercadoPagoPaymentId)
      .maybeSingle()
    if (error) throw error
    return data as RegistroPagamentoOnline | null
  }

  return null
}

async function buscarPedidoOnline(pedidoId: string): Promise<PedidoOnline> {
  const supabase = obterSupabaseAdmin()
  const { data, error } = await supabase
    .from('pedidos')
    .select(
      'id, numero_pedido, nome_cliente, tipo_entrega, total, taxa_entrega, mesa, bairro, referencia, observacoes, telefone, status'
    )
    .eq('id', pedidoId)
    .single()

  if (error) throw error
  return data as PedidoOnline
}

async function registrarPagamentoPedido(pedido: PedidoOnline) {
  const supabase = obterSupabaseAdmin()

  const { data: existente, error: erroBusca } = await supabase
    .from('pagamentos_pedido')
    .select('id')
    .eq('pedido_id', pedido.id)
    .eq('forma_pagamento', 'pix_online')
    .maybeSingle()

  if (erroBusca) throw erroBusca
  if (existente?.id) return

  const { error } = await supabase.from('pagamentos_pedido').insert({
    pedido_id: pedido.id,
    forma_pagamento: 'pix_online',
    valor: pedido.total,
  })

  if (error && error.code !== '23505') throw error
}

async function garantirEntrega(pedido: PedidoOnline) {
  if (pedido.tipo_entrega !== 'entrega') return

  const supabase = obterSupabaseAdmin()
  const { error } = await supabase.from('entregas').upsert(
    {
      pedido_id: pedido.id,
      endereco_entrega: pedido.referencia,
      bairro: pedido.bairro,
      taxa_entrega: numeroSeguro(pedido.taxa_entrega),
      status: 'pendente',
      observacoes: pedido.observacoes,
    },
    {
      onConflict: 'pedido_id',
      ignoreDuplicates: true,
    }
  )

  if (error) throw error
}

async function enfileirarImpressaoPedidoPago(pedidoId: string) {
  const supabase = obterSupabaseAdmin()
  const hashEvento = hashEventoImpressaoPagamentoOnline(pedidoId)

  const { error } = await supabase.from('fila_impressao').insert({
    pedido_id: pedidoId,
    tipo: 'cozinha',
    status: 'pendente',
    escopo: 'pedido_completo',
    origem: 'pagamento_online',
    hash_evento: hashEvento,
  })

  if (error && error.code !== '23505') throw error
}

async function processarPedidoPago(
  pedidoId: string,
  pagamentoOnline: RegistroPagamentoOnline
): Promise<void> {
  const supabase = obterSupabaseAdmin()
  const pedido = await buscarPedidoOnline(pedidoId)

  await registrarPagamentoPedido(pedido)
  await garantirEntrega(pedido)
  await enfileirarImpressaoPedidoPago(pedidoId)

  const agoraIso = new Date().toISOString()

  const { error: erroAtualizarPedido } = await supabase
    .from('pedidos')
    .update({
      status: 'preparando',
      pagamento_online: true,
      pagamento_online_status: 'pago',
      pagamento_online_pago_em: agoraIso,
      pagamento_online_gateway: 'mercado_pago',
      pagamento_online_referencia: pagamentoOnline.mercado_pago_payment_id,
      updated_at: agoraIso,
    })
    .eq('id', pedidoId)

  if (erroAtualizarPedido) throw erroAtualizarPedido

  const { error: erroAtualizarPagamentoOnline } = await supabase
    .from('pagamentos_online')
    .update({
      aprovado_processado: true,
      status: 'pago',
      pago_em: pagamentoOnline.pago_em || agoraIso,
      updated_at: agoraIso,
    })
    .eq('id', pagamentoOnline.id)

  if (erroAtualizarPagamentoOnline) throw erroAtualizarPagamentoOnline
}

function obterDataExpiracaoPix() {
  const data = new Date()
  data.setMinutes(data.getMinutes() + 15)
  return data.toISOString()
}

function pagamentoExpirou(expiraEm?: string | null) {
  if (!expiraEm) return false
  const timestampExpiracao = new Date(expiraEm).getTime()
  if (!Number.isFinite(timestampExpiracao)) return false
  return timestampExpiracao <= Date.now()
}

async function marcarPagamentoComoExpirado(pagamentoOnline: RegistroPagamentoOnline): Promise<RegistroPagamentoOnline> {
  const supabase = obterSupabaseAdmin()
  const agoraIso = new Date().toISOString()

  const { data, error } = await supabase
    .from('pagamentos_online')
    .update({
      status: 'expirado',
      status_detalhe: pagamentoOnline.status_detalhe || 'pagamento_expirado_automaticamente',
      updated_at: agoraIso,
    })
    .eq('id', pagamentoOnline.id)
    .neq('status', 'pago')
    .select('*')
    .maybeSingle()

  if (error) throw error

  // Se não encontrou (status já era 'pago'), retorna o pagamento original
  if (!data) return pagamentoOnline

  const { error: erroAtualizarPedido } = await supabase
    .from('pedidos')
    .update({
      status: 'cancelado',
      pagamento_online_status: 'expirado',
      updated_at: agoraIso,
    })
    .eq('id', pagamentoOnline.pedido_id)
    .in('status', ['pendente', 'confirmado', 'aguardando_pagamento'])

  if (erroAtualizarPedido) throw erroAtualizarPedido

  return data as RegistroPagamentoOnline
}

function obterBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/$/, '')
}

function validarPayloadCriacao(payload: CriarPedidoPixOnlinePayload) {
  if (!payload?.nomeCliente?.trim()) {
    throw new Error('Nome do cliente é obrigatório.')
  }
  if (!payload?.itens || payload.itens.length === 0) {
    throw new Error('Carrinho vazio.')
  }
  if (!payload.tipoEntrega || !['entrega', 'retirada', 'local'].includes(payload.tipoEntrega)) {
    throw new Error('Tipo de entrega inválido.')
  }
  if (payload.tipoEntrega === 'entrega' && !payload.bairro?.trim()) {
    throw new Error('Bairro é obrigatório para entrega.')
  }
  if (payload.tipoEntrega === 'entrega' && !payload.pontoReferencia?.trim()) {
    throw new Error('Endereço ou referência é obrigatório para entrega.')
  }
}

export async function criarPedidoPixOnline(
  payload: CriarPedidoPixOnlinePayload,
  baseUrl: string
): Promise<ResultadoCriacaoPixOnline> {
  validarPayloadCriacao(payload)

  const supabase = obterSupabaseAdmin()
  const subtotal = numeroSeguro(payload.subtotal)
  const taxaEntrega = numeroSeguro(payload.taxaEntrega)
  const taxaPagamento = numeroSeguro(payload.taxaPagamento)
  const totalSemDesconto = subtotal + taxaEntrega
  const totalComDesconto = numeroSeguro(payload.cupom?.totalComDesconto ?? totalSemDesconto)
  const totalFinal = numeroSeguro(payload.totalFinal, totalComDesconto + taxaPagamento)
  const descontoCupom = numeroSeguro(payload.cupom?.valorDesconto)
  const descontoFrete = numeroSeguro(payload.cupom?.valorDescontoFrete)
  const proximoNumeroPedido = await buscarProximoNumeroPedidoDiario(supabase)
  let localParceiro = false

  if (payload.tipoEntrega === 'local' && payload.pontoLocalId) {
    const { data: pontoLocal } = await supabase
      .from('mesas')
      .select('tipo')
      .eq('id', payload.pontoLocalId)
      .maybeSingle()
    localParceiro = pontoLocal?.tipo === 'local_externo'
  }

  const nomeClientePedido = nomeClienteParaPedido({
    nomeCliente: payload.nomeCliente,
    tipoEntrega: payload.tipoEntrega,
    localParceiro,
  })

  let pedidoCriadoId: string | null = null

  try {
    const { data: pedido, error: erroPedido } = await supabase
      .from('pedidos')
      .insert({
        numero_pedido: proximoNumeroPedido,
        nome_cliente: nomeClientePedido,
        telefone: payload.telefone || null,
        endereco: null,
        bairro: payload.tipoEntrega === 'entrega' ? payload.bairro || null : null,
        referencia: payload.tipoEntrega === 'entrega' ? payload.pontoReferencia || null : null,
        tipo_entrega: payload.tipoEntrega,
        forma_pagamento: payload.formaPagamentoNome || 'PIX Online',
        subtotal,
        taxa_entrega: taxaEntrega,
        taxa_pagamento: taxaPagamento,
        total: totalFinal,
        observacoes: payload.observacoes || null,
        status: 'aguardando_pagamento',
        troco_para: null,
        mesa: payload.tipoEntrega === 'local' ? payload.mesaSelecionada || null : null,
        mesa_id: payload.tipoEntrega === 'local' ? payload.pontoLocalId || null : null,
        cupom_id: payload.cupom?.id || null,
        cupom_codigo: payload.cupom?.codigo || null,
        tipo_desconto_cupom: payload.cupom?.tipoDesconto || null,
        desconto_cupom: descontoCupom,
        desconto_frete: descontoFrete,
        pagamento_online: true,
        pagamento_online_status: 'aguardando_pagamento',
        pagamento_online_gateway: 'mercado_pago',
        origem: 'site',
      })
      .select(
        'id, numero_pedido, nome_cliente, tipo_entrega, total, mesa, bairro, referencia, observacoes, telefone, status'
      )
      .single()

    if (erroPedido) throw erroPedido
    pedidoCriadoId = pedido.id
    const numeroPedidoFinal = await sincronizarNumeroPedidoDiario(supabase, pedido).catch((erro) => {
      console.error('[Pagamento Online] Falha ao sincronizar número diário do pedido:', erro)
      return normalizarNumeroPedido(pedido.numero_pedido)
    })
    pedido.numero_pedido = numeroPedidoFinal ?? proximoNumeroPedido

    const idsItens = Array.from(
      new Set(
        payload.itens
          .map((item) => item.produto?.id)
          .filter((id): id is string => typeof id === 'string' && id.length > 0)
      )
    )

    let idsProdutos = new Set<string>()
    let idsBebidas = new Set<string>()
    let idsCombos = new Set<string>()

    if (idsItens.length > 0) {
      const [resProdutos, resBebidas, resCombos] = await Promise.all([
        supabase.from('produtos').select('id').in('id', idsItens),
        supabase.from('bebidas').select('id').in('id', idsItens),
        supabase.from('combos').select('id').in('id', idsItens),
      ])

      if (resProdutos.error) throw resProdutos.error
      if (resBebidas.error) throw resBebidas.error
      if (resCombos.error) throw resCombos.error

      idsProdutos = new Set((resProdutos.data || []).map((registro) => String((registro as { id: string }).id)))
      idsBebidas = new Set((resBebidas.data || []).map((registro) => String((registro as { id: string }).id)))
      idsCombos = new Set((resCombos.data || []).map((registro) => String((registro as { id: string }).id)))
    }

    const itensParaInserir = payload.itens.map((item) => {
      const quantidade = Math.max(1, numeroSeguro(item.quantidade, 1))
      const precoUnitario = numeroSeguro(item.produto?.preco)
      const subtotalItem = numeroSeguro(item.subtotal, precoUnitario * quantidade)
      const idCatalogo = item.produto?.id || null

      const origemInformada = normalizarOrigemItemCheckout(item.origemItem)
      const origemInferida: TipoCatalogoItemCheckout | null =
        origemInformada ||
        (idCatalogo && idsCombos.has(idCatalogo)
          ? 'combo'
          : idCatalogo && idsBebidas.has(idCatalogo) && !idsProdutos.has(idCatalogo)
            ? 'bebida'
            : idCatalogo && idsProdutos.has(idCatalogo)
              ? 'produto'
              : null)

      const origemFinal: TipoCatalogoItemCheckout =
        origemInferida || (idCatalogo && idsBebidas.has(idCatalogo) ? 'bebida' : 'produto')

      return {
        pedido_id: pedido.id,
        produto_id: origemFinal === 'produto' ? idCatalogo : null,
        bebida_id: origemFinal === 'bebida' ? idCatalogo : null,
        combo_id: origemFinal === 'combo' ? idCatalogo : null,
        nome_item: item.produto?.nome || 'Item',
        quantidade,
        preco_unitario: precoUnitario,
        subtotal: subtotalItem,
        observacoes: item.observacoes || null,
      }
    })

    const { data: itensInseridos, error: erroItens } = await supabase
      .from('itens_pedido')
      .insert(itensParaInserir)
      .select('id')

    if (erroItens) throw erroItens

    const adicionaisParaInserir: Array<{
      item_pedido_id: string
      adicional_id: string | null
      nome: string
      preco: number
    }> = []

    payload.itens.forEach((item, indiceItem) => {
      const itemInserido = itensInseridos?.[indiceItem]
      if (!itemInserido?.id) return

      ;(item.adicionais || []).forEach((adicional) => {
        adicionaisParaInserir.push({
          item_pedido_id: itemInserido.id,
          adicional_id: adicional.id || null,
          nome: adicional.nome,
          preco: numeroSeguro(adicional.preco),
        })
      })
    })

    if (adicionaisParaInserir.length > 0) {
      const { error: erroAdicionais } = await supabase.from('item_adicionais').insert(adicionaisParaInserir)
      if (erroAdicionais) throw erroAdicionais
    }

    if (payload.cupom?.id) {
      const { error: erroUsoCupom } = await supabase.from('cupons_usos').insert({
        cupom_id: payload.cupom.id,
        pedido_id: pedido.id,
        telefone_cliente: normalizarTelefone(payload.telefone),
        valor_desconto: descontoCupom,
        valor_frete_descontado: descontoFrete,
      })
      if (erroUsoCupom) throw erroUsoCupom
    }

    const dataExpiracao = obterDataExpiracaoPix()
    const pagamentoGateway = await criarPagamentoPixMercadoPago({
      valor: totalFinal,
      descricao: `Pedido #${pedido.numero_pedido} - Bar da Ladeira`,
      externalReference: pedido.id,
      notificationUrl: `${obterBaseUrl(baseUrl)}/api/pagamentos/mercado-pago/webhook`,
      emailPagador: gerarEmailPagador(payload.telefone),
      nomePagador: payload.nomeCliente,
      dataExpiracaoIso: dataExpiracao,
      metadata: {
        pedido_id: pedido.id,
        origem: 'site',
        forma_pagamento_codigo: payload.formaPagamentoCodigo || 'pix_online',
      },
    })

    const statusInicial = mapearStatusMercadoPago(pagamentoGateway.status)
    const agoraIso = new Date().toISOString()

    const { data: pagamentoOnline, error: erroPagamentoOnline } = await supabase
      .from('pagamentos_online')
      .insert({
        pedido_id: pedido.id,
        external_reference: pedido.id,
        mercado_pago_payment_id: String(pagamentoGateway.id),
        status: statusInicial,
        status_detalhe: pagamentoGateway.status_detail || null,
        valor: totalFinal,
        qr_code: pagamentoGateway.point_of_interaction?.transaction_data?.qr_code || null,
        qr_code_base64: pagamentoGateway.point_of_interaction?.transaction_data?.qr_code_base64 || null,
        qr_code_ticket_url: pagamentoGateway.point_of_interaction?.transaction_data?.ticket_url || null,
        payload_criacao: pagamentoGateway,
        payload_atualizacao: pagamentoGateway,
        ultima_verificacao_em: agoraIso,
        pago_em: statusInicial === 'pago' ? pagamentoGateway.date_approved || agoraIso : null,
        expira_em: pagamentoGateway.date_of_expiration || dataExpiracao,
      })
      .select('*')
      .single()

    if (erroPagamentoOnline) throw erroPagamentoOnline

    const { error: erroAtualizarPedidoOnline } = await supabase
      .from('pedidos')
      .update({
        pagamento_online_referencia: String(pagamentoGateway.id),
        pagamento_online_status: statusInicial,
        pagamento_online_pago_em:
          statusInicial === 'pago' ? pagamentoGateway.date_approved || new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', pedido.id)

    if (erroAtualizarPedidoOnline) throw erroAtualizarPedidoOnline

    if (statusInicial === 'pago') {
      await processarPedidoPago(pedido.id, pagamentoOnline as RegistroPagamentoOnline)
    }

    return {
      pedidoId: pedido.id,
      numeroPedido: pedido.numero_pedido,
      nomeCliente: pedido.nome_cliente,
      tipoEntrega: pedido.tipo_entrega as TipoEntrega,
      total: numeroSeguro(pedido.total),
      mesa: pedido.mesa,
      pagamentoOnlineId: (pagamentoOnline as RegistroPagamentoOnline).id,
      mercadoPagoPaymentId: (pagamentoOnline as RegistroPagamentoOnline).mercado_pago_payment_id,
      status: (pagamentoOnline as RegistroPagamentoOnline).status,
      qrCode: (pagamentoOnline as RegistroPagamentoOnline).qr_code,
      qrCodeBase64: (pagamentoOnline as RegistroPagamentoOnline).qr_code_base64,
      qrCodeTicketUrl: (pagamentoOnline as RegistroPagamentoOnline).qr_code_ticket_url,
      expiraEm: (pagamentoOnline as RegistroPagamentoOnline).expira_em,
    }
  } catch (erro) {
    if (pedidoCriadoId) {
      await supabase.from('cupons_usos').delete().eq('pedido_id', pedidoCriadoId)
      await supabase.from('pedidos').delete().eq('id', pedidoCriadoId)
    }

    throw erro
  }
}

async function atualizarPagamentoPeloGateway(
  pagamentoOnline: RegistroPagamentoOnline,
  dadosGateway: MercadoPagoPaymentResponse
): Promise<RegistroPagamentoOnline> {
  const supabase = obterSupabaseAdmin()
  const statusMapeado = mapearStatusMercadoPago(dadosGateway.status)
  const agoraIso = new Date().toISOString()

  const { data, error } = await supabase
    .from('pagamentos_online')
    .update({
      mercado_pago_payment_id: String(dadosGateway.id),
      status: statusMapeado,
      status_detalhe: dadosGateway.status_detail || null,
      qr_code: dadosGateway.point_of_interaction?.transaction_data?.qr_code || null,
      qr_code_base64: dadosGateway.point_of_interaction?.transaction_data?.qr_code_base64 || null,
      qr_code_ticket_url: dadosGateway.point_of_interaction?.transaction_data?.ticket_url || null,
      payload_atualizacao: dadosGateway,
      ultima_verificacao_em: agoraIso,
      pago_em: statusMapeado === 'pago' ? dadosGateway.date_approved || agoraIso : null,
      expira_em: dadosGateway.date_of_expiration || pagamentoOnline.expira_em,
      updated_at: agoraIso,
    })
    .eq('id', pagamentoOnline.id)
    .select('*')
    .single()

  if (error) throw error

  const statusFalhouGateway = statusMapeado === 'cancelado' || statusMapeado === 'rejeitado' || statusMapeado === 'expirado'

  const atualizacaoPedido: Record<string, unknown> = {
    pagamento_online_status: statusMapeado,
    pagamento_online_referencia: String(dadosGateway.id),
    pagamento_online_pago_em: statusMapeado === 'pago' ? dadosGateway.date_approved || agoraIso : null,
    updated_at: agoraIso,
  }

  if (statusFalhouGateway) {
    atualizacaoPedido.status = 'cancelado'
  }

  let queryPedido = supabase
    .from('pedidos')
    .update(atualizacaoPedido)
    .eq('id', pagamentoOnline.pedido_id)

  if (statusFalhouGateway) {
    queryPedido = queryPedido.in('status', ['pendente', 'confirmado', 'aguardando_pagamento'])
  }

  const { error: erroPedido } = await queryPedido

  if (erroPedido) throw erroPedido

  return data as RegistroPagamentoOnline
}

export async function sincronizarPagamentoOnline(
  opcoes: OpcoesSincronizacao
): Promise<ResultadoStatusPagamentoOnline> {
  let pagamentoOnline = await buscarPagamentoOnline(opcoes)
  if (!pagamentoOnline) {
    throw new Error('Pagamento online não encontrado.')
  }

  // IMPORTANTE: consultar o gateway ANTES de marcar como expirado localmente
  // para não perder pagamentos que foram aprovados mas cujo webhook não chegou
  const statusPendente = ['aguardando_pagamento', 'em_analise'].includes(pagamentoOnline.status)
  const precisaConsultarGateway =
    opcoes.forcarConsultaGateway ||
    !statusFinalPagamentoOnline(pagamentoOnline.status) ||
    (pagamentoOnline.status === 'pago' && !pagamentoOnline.aprovado_processado)

  if (precisaConsultarGateway && pagamentoOnline.mercado_pago_payment_id) {
    const dadosGateway = await obterPagamentoMercadoPago(pagamentoOnline.mercado_pago_payment_id)
    pagamentoOnline = await atualizarPagamentoPeloGateway(pagamentoOnline, dadosGateway)
  }

  // Só marca como expirado DEPOIS de consultar o gateway e confirmar que não foi pago
  if (
    statusPendente &&
    ['aguardando_pagamento', 'em_analise'].includes(pagamentoOnline.status) &&
    pagamentoExpirou(pagamentoOnline.expira_em)
  ) {
    pagamentoOnline = await marcarPagamentoComoExpirado(pagamentoOnline)
  }

  if (pagamentoOnline.status === 'pago' && !pagamentoOnline.aprovado_processado) {
    await processarPedidoPago(pagamentoOnline.pedido_id, pagamentoOnline)
    const pagamentoAtualizado = await buscarPagamentoOnline({ pagamentoOnlineId: pagamentoOnline.id })
    if (pagamentoAtualizado) {
      pagamentoOnline = pagamentoAtualizado
    }
  }

  const pedido = await buscarPedidoOnline(pagamentoOnline.pedido_id)
  return montarResultadoStatus(pedido, pagamentoOnline)
}

export async function sincronizarPagamentoOnlinePorGateway(
  mercadoPagoPaymentId: string
): Promise<ResultadoStatusPagamentoOnline | null> {
  const pagamentoOnline = await buscarPagamentoOnline({ mercadoPagoPaymentId })
  if (!pagamentoOnline) return null

  return sincronizarPagamentoOnline({
    pagamentoOnlineId: pagamentoOnline.id,
    forcarConsultaGateway: true,
  })
}

export async function reconciliarPagamentosPendentes(
  opcoes: OpcoesReconciliacaoPagamentos = {}
): Promise<ResultadoReconciliacaoPagamentos> {
  const limiteNormalizado = Number.isFinite(opcoes.limite) ? Number(opcoes.limite) : 25
  const limite = Math.max(1, Math.min(limiteNormalizado, 100))
  const supabase = obterSupabaseAdmin()

  const { data, error } = await supabase
    .from('pagamentos_online')
    .select('id, status, aprovado_processado')
    .in('status', ['aguardando_pagamento', 'em_analise', 'pago'])
    .order('updated_at', { ascending: true })
    .limit(limite)

  if (error) throw error

  const pagamentosPendentes = (data || []).filter(
    (registro) => registro.status !== 'pago' || !registro.aprovado_processado
  )

  const resultado: ResultadoReconciliacaoPagamentos = {
    totalSelecionados: pagamentosPendentes.length,
    totalProcessados: 0,
    totalPagos: 0,
    totalErros: 0,
    erros: [],
  }

  for (const pagamento of pagamentosPendentes) {
    try {
      const sincronizado = await sincronizarPagamentoOnline({
        pagamentoOnlineId: pagamento.id,
        forcarConsultaGateway: true,
      })
      resultado.totalProcessados += 1
      if (sincronizado.status === 'pago') {
        resultado.totalPagos += 1
      }
    } catch (erro) {
      resultado.totalErros += 1
      resultado.erros.push({
        pagamentoOnlineId: pagamento.id,
        erro: erro instanceof Error ? erro.message : 'Falha ao reconciliar pagamento.',
      })
    }
  }

  return resultado
}
