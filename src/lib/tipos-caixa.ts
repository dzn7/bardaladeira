// Tipos do sistema de gestão de caixa

import type { FechamentoFormasSnapshot } from '@/lib/caixa-gaveta'

export type Funcionario = {
  id: string
  nome: string
  cargo: string
  ativo: boolean
}

export type CategoriaCaixa = {
  id: string
  nome: string
  tipo: 'entrada' | 'saida'
  cor: string
  icone: string
  ativo: boolean
  ordem: number
}

export type Caixa = {
  id: string
  data_abertura: string
  data_fechamento: string | null
  valor_abertura: number
  valor_fechamento: number | null
  total_entradas: number
  total_saidas: number
  saldo_esperado: number
  diferenca: number | null
  responsavel_abertura: string | null
  responsavel_fechamento: string | null
  observacoes: string | null
  status: 'aberto' | 'fechado'
  fechamento_formas?: FechamentoFormasSnapshot | null
}

export type MovimentacaoCaixa = {
  id: string
  caixa_id: string
  categoria_id: string | null
  funcionario_id: string | null
  tipo: 'entrada' | 'saida'
  valor: number
  descricao: string | null
  forma_pagamento: string | null
  pedido_id: string | null
  created_at: string
  categoria?: CategoriaCaixa
  funcionario?: Funcionario
}

export type EstatisticasCaixa = {
  saldoAtual: number
  totalEntradas: number
  totalSaidas: number
  quantidadeMovimentacoes: number
  saldoGaveta: number
  esperadoDinheiro: number
}

export type EstatisticasPedidosDia = {
  entregas: { quantidade: number; total: number }
  retiradas: { quantidade: number; total: number }
  local: { quantidade: number; total: number }
  totalPedidos: number
  totalFaturamento: number
}

export type NotificacaoCaixa = {
  aberto: boolean
  tipo: 'sucesso' | 'erro' | 'aviso' | 'info' | 'confirmacao'
  titulo: string
  mensagem: string
  onConfirmar?: () => void
}

export type { FechamentoFormasSnapshot, ResumoFormasCaixa } from '@/lib/caixa-gaveta'
