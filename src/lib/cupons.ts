import { supabase, ItemCarrinho } from '@/lib/supabase'

export type TipoDescontoCupom = 'percentual' | 'valor_fixo' | 'frete_gratis'
export type TipoAplicacaoCupom = 'pedido' | 'produto' | 'combo'

export type Cupom = {
  id: string
  codigo: string
  nome: string
  descricao: string | null
  ativo: boolean
  tipo_desconto: TipoDescontoCupom
  valor_desconto: number
  pedido_minimo: number
  limite_desconto: number | null
  uso_maximo_total: number | null
  uso_maximo_por_cliente: number | null
  uso_unico: boolean
  total_usos: number
  aplica_em: TipoAplicacaoCupom
  produto_id: string | null
  combo_id: string | null
  validade_inicio: string | null
  validade_fim: string | null
  created_at: string
  updated_at: string
}

export type ContextoValidacaoCupom = {
  codigo: string
  itens: ItemCarrinho[]
  subtotal: number
  taxaEntrega: number
  tipoEntrega: 'entrega' | 'retirada' | 'local'
  telefoneCliente?: string
}

export type ResultadoValidacaoCupom = {
  valido: boolean
  mensagem: string
  cupom: Cupom | null
  valorDesconto: number
  valorDescontoFrete: number
  totalComDesconto: number
  subtotalElegivel: number
}

type RegistroUsoCupom = {
  cupomId: string
  pedidoId: string
  telefoneCliente?: string
  valorDesconto: number
  valorDescontoFrete: number
}

const arredondarMoeda = (valor: number): number => Math.round(valor * 100) / 100

const paraNumero = (valor: number | string | null | undefined): number => {
  if (valor === null || valor === undefined || valor === '') return 0
  const numero = typeof valor === 'number' ? valor : Number(valor)
  return Number.isFinite(numero) ? numero : 0
}

export const normalizarCodigoCupom = (codigo: string): string =>
  codigo.trim().toUpperCase().replace(/\s+/g, '')

const normalizarTelefone = (telefone?: string): string | null => {
  if (!telefone) return null
  const apenasDigitos = telefone.replace(/\D/g, '')
  return apenasDigitos.length > 0 ? apenasDigitos : null
}

const mapearCupom = (registro: any): Cupom => ({
  ...registro,
  valor_desconto: paraNumero(registro.valor_desconto),
  pedido_minimo: paraNumero(registro.pedido_minimo),
  limite_desconto: registro.limite_desconto !== null ? paraNumero(registro.limite_desconto) : null,
  uso_maximo_total: registro.uso_maximo_total !== null ? Number(registro.uso_maximo_total) : null,
  uso_maximo_por_cliente: registro.uso_maximo_por_cliente !== null ? Number(registro.uso_maximo_por_cliente) : null,
  total_usos: Number(registro.total_usos || 0),
})

const calcularSubtotalElegivel = (cupom: Cupom, itens: ItemCarrinho[], subtotal: number): number => {
  if (cupom.aplica_em === 'pedido') return subtotal

  if (cupom.aplica_em === 'produto' && cupom.produto_id) {
    return itens
      .filter((item) => item.produto.id === cupom.produto_id)
      .reduce((acumulado, item) => acumulado + paraNumero(item.subtotal), 0)
  }

  if (cupom.aplica_em === 'combo' && cupom.combo_id) {
    return itens
      .filter((item) => item.produto.id === cupom.combo_id)
      .reduce((acumulado, item) => acumulado + paraNumero(item.subtotal), 0)
  }

  return 0
}

const validarRegrasBasicas = async (
  cupom: Cupom,
  contexto: ContextoValidacaoCupom,
): Promise<{ valido: boolean; mensagem: string }> => {
  if (!cupom.ativo) {
    return { valido: false, mensagem: 'Esse cupom está inativo no momento.' }
  }

  const agora = new Date()
  if (cupom.validade_inicio && new Date(cupom.validade_inicio) > agora) {
    return { valido: false, mensagem: 'Esse cupom ainda não está válido.' }
  }
  if (cupom.validade_fim && new Date(cupom.validade_fim) < agora) {
    return { valido: false, mensagem: 'Esse cupom expirou.' }
  }

  if (cupom.uso_unico && cupom.total_usos >= 1) {
    return { valido: false, mensagem: 'Esse cupom já foi utilizado e era de uso único.' }
  }

  if (cupom.uso_maximo_total !== null && cupom.total_usos >= cupom.uso_maximo_total) {
    return { valido: false, mensagem: 'Esse cupom atingiu o limite total de usos.' }
  }

  const subtotalElegivel = calcularSubtotalElegivel(cupom, contexto.itens, contexto.subtotal)
  if (subtotalElegivel <= 0) {
    if (cupom.aplica_em === 'produto') {
      return { valido: false, mensagem: 'Esse cupom é válido apenas para um produto específico no carrinho.' }
    }
    if (cupom.aplica_em === 'combo') {
      return { valido: false, mensagem: 'Esse cupom é válido apenas para um combo específico no carrinho.' }
    }
  }

  if (subtotalElegivel < cupom.pedido_minimo) {
    return {
      valido: false,
      mensagem: `Pedido mínimo de R$ ${cupom.pedido_minimo.toFixed(2)} para usar este cupom.`,
    }
  }

  if (cupom.tipo_desconto === 'frete_gratis' && contexto.tipoEntrega !== 'entrega') {
    return { valido: false, mensagem: 'Esse cupom é válido apenas para pedidos com entrega.' }
  }

  if (cupom.uso_maximo_por_cliente !== null) {
    const telefoneNormalizado = normalizarTelefone(contexto.telefoneCliente)
    if (!telefoneNormalizado) {
      return { valido: false, mensagem: 'Informe telefone para validar limite de uso por cliente.' }
    }

    const { count, error } = await supabase
      .from('cupons_usos')
      .select('id', { count: 'exact', head: true })
      .eq('cupom_id', cupom.id)
      .eq('telefone_cliente', telefoneNormalizado)

    if (error) {
      console.error('[Cupom] Falha ao validar usos por cliente:', error)
      return { valido: false, mensagem: 'Falha ao validar limite do cupom. Tente novamente.' }
    }

    if ((count || 0) >= cupom.uso_maximo_por_cliente) {
      return { valido: false, mensagem: 'Esse cupom já atingiu o limite de uso para este cliente.' }
    }
  }

  return { valido: true, mensagem: 'Cupom válido.' }
}

const calcularDesconto = (cupom: Cupom, contexto: ContextoValidacaoCupom) => {
  const subtotalElegivel = calcularSubtotalElegivel(cupom, contexto.itens, contexto.subtotal)
  let valorDesconto = 0
  let valorDescontoFrete = 0

  if (cupom.tipo_desconto === 'frete_gratis') {
    valorDescontoFrete = contexto.tipoEntrega === 'entrega' ? contexto.taxaEntrega : 0
  } else if (cupom.tipo_desconto === 'percentual') {
    valorDesconto = (subtotalElegivel * cupom.valor_desconto) / 100
  } else if (cupom.tipo_desconto === 'valor_fixo') {
    valorDesconto = cupom.valor_desconto
  }

  if (cupom.limite_desconto !== null) {
    valorDesconto = Math.min(valorDesconto, cupom.limite_desconto)
  }

  valorDesconto = Math.min(valorDesconto, subtotalElegivel)
  valorDesconto = arredondarMoeda(Math.max(0, valorDesconto))
  valorDescontoFrete = arredondarMoeda(Math.max(0, valorDescontoFrete))

  const totalSemDesconto = contexto.subtotal + contexto.taxaEntrega
  const totalComDesconto = arredondarMoeda(Math.max(0, totalSemDesconto - valorDesconto - valorDescontoFrete))

  return {
    subtotalElegivel,
    valorDesconto,
    valorDescontoFrete,
    totalComDesconto,
  }
}

export async function buscarCupomPorCodigo(codigo: string): Promise<Cupom | null> {
  const codigoNormalizado = normalizarCodigoCupom(codigo)
  if (!codigoNormalizado) return null

  const { data, error } = await supabase
    .from('cupons')
    .select('*')
    .eq('codigo', codigoNormalizado)
    .maybeSingle()

  if (error) {
    console.error('[Cupom] Erro ao buscar cupom:', error)
    return null
  }

  if (!data) return null
  return mapearCupom(data)
}

export async function validarCupomParaCarrinho(
  contexto: ContextoValidacaoCupom,
): Promise<ResultadoValidacaoCupom> {
  const codigoNormalizado = normalizarCodigoCupom(contexto.codigo)
  if (!codigoNormalizado) {
    return {
      valido: false,
      mensagem: 'Informe um código de cupom.',
      cupom: null,
      valorDesconto: 0,
      valorDescontoFrete: 0,
      totalComDesconto: arredondarMoeda(contexto.subtotal + contexto.taxaEntrega),
      subtotalElegivel: 0,
    }
  }

  const cupom = await buscarCupomPorCodigo(codigoNormalizado)
  if (!cupom) {
    return {
      valido: false,
      mensagem: 'Cupom não encontrado.',
      cupom: null,
      valorDesconto: 0,
      valorDescontoFrete: 0,
      totalComDesconto: arredondarMoeda(contexto.subtotal + contexto.taxaEntrega),
      subtotalElegivel: 0,
    }
  }

  const validacao = await validarRegrasBasicas(cupom, contexto)
  if (!validacao.valido) {
    return {
      valido: false,
      mensagem: validacao.mensagem,
      cupom,
      valorDesconto: 0,
      valorDescontoFrete: 0,
      totalComDesconto: arredondarMoeda(contexto.subtotal + contexto.taxaEntrega),
      subtotalElegivel: 0,
    }
  }

  const calculo = calcularDesconto(cupom, contexto)
  if (calculo.valorDesconto <= 0 && calculo.valorDescontoFrete <= 0) {
    return {
      valido: false,
      mensagem: 'Esse cupom não gera desconto para o carrinho atual.',
      cupom,
      valorDesconto: 0,
      valorDescontoFrete: 0,
      totalComDesconto: arredondarMoeda(contexto.subtotal + contexto.taxaEntrega),
      subtotalElegivel: calculo.subtotalElegivel,
    }
  }

  return {
    valido: true,
    mensagem: 'Cupom aplicado com sucesso.',
    cupom,
    valorDesconto: calculo.valorDesconto,
    valorDescontoFrete: calculo.valorDescontoFrete,
    totalComDesconto: calculo.totalComDesconto,
    subtotalElegivel: calculo.subtotalElegivel,
  }
}

export async function registrarUsoCupom({
  cupomId,
  pedidoId,
  telefoneCliente,
  valorDesconto,
  valorDescontoFrete,
}: RegistroUsoCupom): Promise<{ sucesso: boolean; mensagem: string }> {
  const telefoneNormalizado = normalizarTelefone(telefoneCliente)

  const { error } = await supabase
    .from('cupons_usos')
    .insert({
      cupom_id: cupomId,
      pedido_id: pedidoId,
      telefone_cliente: telefoneNormalizado,
      valor_desconto: arredondarMoeda(valorDesconto),
      valor_frete_descontado: arredondarMoeda(valorDescontoFrete),
    })

  if (error) {
    console.error('[Cupom] Falha ao registrar uso do cupom:', error)
    return {
      sucesso: false,
      mensagem: 'Não foi possível confirmar o uso do cupom. Tente novamente.',
    }
  }

  return { sucesso: true, mensagem: 'Uso de cupom registrado com sucesso.' }
}

export async function removerUsoCupomPorPedido(pedidoId: string): Promise<void> {
  if (!pedidoId) return

  const { error } = await supabase
    .from('cupons_usos')
    .delete()
    .eq('pedido_id', pedidoId)

  if (error) {
    console.error('[Cupom] Falha ao remover uso de cupom por pedido:', error)
  }
}
