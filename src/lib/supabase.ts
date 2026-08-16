import { createClient } from '@supabase/supabase-js'

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim()
const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim()

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Variáveis de ambiente do Supabase não configuradas')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Produto = {
  id: string
  nome: string
  descricao: string
  preco: number
  preco_original?: number
  desconto?: number
  categoria: string
  imagem_url: string
  disponivel: boolean
  ordem: number
  destaque: boolean
  created_at: string
  updated_at: string
}

export type Adicional = {
  id: string
  nome: string
  preco: number
  imagem_url?: string | null
  disponivel: boolean
  categoria?: string | null
  created_at: string
  updated_at: string
}

export type Bebida = {
  id: string
  nome: string
  descricao: string | null
  preco: number
  preco_original?: number
  desconto?: number
  categoria: string | null
  imagem_url?: string
  disponivel: boolean
  ordem: number
  created_at: string
  updated_at: string
}

export type ItemCarrinho = {
  id: string
  produto: Produto
  quantidade: number
  adicionais: Adicional[]
  observacoes?: string
  subtotal: number
}

export type Pedido = {
  id: string
  nome_cliente: string
  telefone?: string
  endereco?: string
  tipo_entrega: 'entrega' | 'retirada' | 'local'
  forma_pagamento: string
  cupom_id?: string | null
  cupom_codigo?: string | null
  tipo_desconto_cupom?: 'percentual' | 'valor_fixo' | 'frete_gratis' | null
  desconto_cupom?: number
  desconto_frete?: number
  subtotal: number
  taxa_entrega: number
  total: number
  observacoes?: string
  status: 'pendente' | 'confirmado' | 'preparando' | 'pronto' | 'entregue' | 'cancelado'
  created_at: string
  updated_at: string
}

export type Combo = {
  id: string
  nome: string
  descricao: string | null
  preco: number
  preco_original: number | null
  desconto_percentual: number | null
  imagem_url: string | null
  disponivel: boolean
  ordem: number
  destaque: boolean
  created_at: string
  updated_at: string
}

export type ComboItem = {
  id: string
  combo_id: string
  produto_id: string | null
  bebida_id: string | null
  quantidade: number
  created_at: string
  // Campos populados via join
  produto?: Produto
  bebida?: Bebida
}

export type ComboComItens = Combo & {
  itens: ComboItem[]
}

export type TipoCategoriaCardapio = 'produto' | 'bebida' | 'combo'

export type CategoriaCardapio = {
  id: string
  nome: string
  tipo: TipoCategoriaCardapio
  ativo: boolean
  ordem: number
  created_at: string
  updated_at: string
}
