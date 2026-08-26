import { supabase } from '@/lib/supabase'
import {
  formatarErroEstoque,
  obterSituacaoEstoque,
} from '@/lib/estoque-produto.mjs'

export const COLUNAS_ESTOQUE_ADMIN =
  'id, nome, categoria, preco, custo_unitario, estoque_quantidade, estoque_minimo, bloquear_venda_sem_estoque, disponivel, imagem_url'

export const COLUNAS_ESTOQUE_PUBLICO =
  'id, nome, descricao, preco, preco_original, desconto, categoria, imagem_url, disponivel, ordem, destaque, created_at, updated_at, estoque_quantidade, bloquear_venda_sem_estoque'

export const COLUNAS_ESTOQUE_BEBIDAS_PUBLICO =
  'id, nome, descricao, preco, preco_original, desconto, categoria, imagem_url, disponivel, ordem, created_at, updated_at, tamanho, estoque_quantidade, bloquear_venda_sem_estoque'

export type SituacaoEstoque = 'em_estoque' | 'baixo' | 'esgotado'

export type ProdutoComEstoque = {
  id: string
  nome: string
  categoria: string
  preco: number
  custo_unitario: number | null
  estoque_quantidade: number
  estoque_minimo: number
  bloquear_venda_sem_estoque: boolean
  disponivel?: boolean
  imagem_url?: string | null
  tabela: 'produtos' | 'bebidas'
}

export const rotuloSituacaoEstoque = (situacao: SituacaoEstoque) => {
  if (situacao === 'esgotado') return 'Esgotado'
  if (situacao === 'baixo') return 'Estoque baixo'
  return 'Em estoque'
}

export const situacaoDeProduto = (produto: Pick<ProdutoComEstoque, 'estoque_quantidade' | 'estoque_minimo'>): SituacaoEstoque =>
  obterSituacaoEstoque({
    quantidade: produto.estoque_quantidade,
    minimo: produto.estoque_minimo,
  }) as SituacaoEstoque

const inteiroOuPadrao = (valor: unknown, padrao: number) => {
  const numero = Number(valor)
  return Number.isInteger(numero) && numero >= 0 ? numero : padrao
}

export const mapearLinhaEstoque = (
  linha: Record<string, unknown>,
  tabela: ProdutoComEstoque['tabela'] = 'produtos',
): ProdutoComEstoque => ({
  id: String(linha.id || ''),
  nome: String(linha.nome || ''),
  categoria: String(linha.categoria || ''),
  preco: Number(linha.preco) || 0,
  custo_unitario:
    linha.custo_unitario === null || linha.custo_unitario === undefined || linha.custo_unitario === ''
      ? null
      : Number(linha.custo_unitario),
  estoque_quantidade: inteiroOuPadrao(linha.estoque_quantidade, 0),
  estoque_minimo: inteiroOuPadrao(linha.estoque_minimo, 5),
  bloquear_venda_sem_estoque: linha.bloquear_venda_sem_estoque === true,
  disponivel: linha.disponivel !== false,
  imagem_url: typeof linha.imagem_url === 'string' ? linha.imagem_url : null,
  tabela,
})

export const formatarMoedaEstoque = (valor: number | null | undefined) => {
  if (valor === null || valor === undefined || Number.isNaN(Number(valor))) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(valor))
}

export type AjusteEstoqueProduto =
  | { produtoId: string; tabela?: 'produtos' | 'bebidas'; delta: number; quantidade?: never }
  | { produtoId: string; tabela?: 'produtos' | 'bebidas'; quantidade: number; delta?: never }

export class ErroEstoque extends Error {
  readonly causa: unknown

  constructor(causa: unknown) {
    super(formatarErroEstoque(causa))
    this.name = 'ErroEstoque'
    this.causa = causa
  }
}

export async function ajustarEstoqueProduto(ajuste: AjusteEstoqueProduto): Promise<number> {
  const usaDelta = ajuste.delta !== undefined
  const valor = usaDelta ? ajuste.delta : ajuste.quantidade
  if (typeof valor !== 'number' || !Number.isInteger(valor) || (!usaDelta && valor < 0)) {
    throw new ErroEstoque(new Error('O ajuste de estoque deve usar um número inteiro válido'))
  }

  const bebida = ajuste.tabela === 'bebidas'
  const nomeRpc = bebida
    ? (usaDelta ? 'ajustar_estoque_bebida' : 'definir_estoque_bebida')
    : (usaDelta ? 'ajustar_estoque_produto' : 'definir_estoque_produto')
  const parametros = bebida
    ? (usaDelta
        ? { p_bebida_id: ajuste.produtoId, p_delta: valor }
        : { p_bebida_id: ajuste.produtoId, p_quantidade: valor })
    : (usaDelta
        ? { p_produto_id: ajuste.produtoId, p_delta: valor }
        : { p_produto_id: ajuste.produtoId, p_quantidade: valor })
  const { data, error } = await supabase.rpc(nomeRpc, parametros)

  if (error) throw new ErroEstoque(error)
  const quantidadeConfirmada = Number(data)
  if (!Number.isInteger(quantidadeConfirmada) || quantidadeConfirmada < 0) {
    throw new ErroEstoque(new Error('O banco retornou uma quantidade de estoque inválida'))
  }
  return quantidadeConfirmada
}
