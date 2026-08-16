import type { CategoriaCaixa, Funcionario, MovimentacaoCaixa } from '@/lib/tipos-caixa'

export type TipoPeriodo = 'hoje' | 'semana' | 'mes' | 'ano' | 'personalizado'
export type TipoMovimentacao = 'entrada' | 'saida'

export interface FiltroFinancas {
  tipo: TipoPeriodo
  inicio: string
  fim: string
}

export interface PedidoFinanceiro {
  id: string
  numero_pedido: number
  nome_cliente: string
  total: number
  taxa_entrega: number | null
  taxa_servico: number | null
  taxa_pagamento: number | null
  status: string
  pagamento_online: boolean | null
  pagamento_online_status: string | null
  forma_pagamento: string | null
  created_at: string
}

export interface ContaCrediarioResumo {
  id: string
  cliente_nome: string
  telefone: string | null
  saldo_atual: number
  status: 'aberto' | 'quitado'
  atualizado_em: string
}

export interface ResumoPeriodo {
  receitaPedidos: number
  receitaExtra: number
  receitaTotal: number
  despesas: number
  lucroLiquido: number
  pedidosCount: number
  ticketMedio: number
  pedidosNaoPagosTotal: number
  pedidosNaoPagosCount: number
  crediarioAberto: number
  crediarioCount: number
  aReceberTotal: number
}

export interface PontoFluxoCaixa {
  data: string
  rotulo: string
  receita: number
  despesa: number
  lucro: number
}

export interface ResumoMensal {
  chave: string
  rotulo: string
  receita: number
  despesa: number
  lucro: number
  pedidos: number
}

export interface ComposicaoReceita {
  nome: string
  valor: number
  cor: string
}

export interface PagamentoPedido {
  id: string
  pedido_id: string
  forma_pagamento: string
  valor: number
  bandeira: string | null
  created_at: string
}

export interface FinancasDiaria {
  id: string
  data_referencia: string
  nome_pessoa: string
  funcionario_id: string | null
  valor: number
  forma_pagamento: string | null
  observacoes: string | null
  movimentacao_id: string
  created_at: string
  updated_at: string
}

export type EntradaDiaria = {
  data_referencia: string
  nome_pessoa: string
  valor: number
  forma_pagamento?: string | null
  funcionario_id?: string | null
  observacoes?: string | null
}

export type { CategoriaCaixa, Funcionario, MovimentacaoCaixa }
