'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { obterPeriodoAno } from '@/lib/filtros-ano'
import type {
  EstatisticasAnuais,
  PedidoHistorico,
  ItemPedidoHistorico,
  EntregaHistorico,
  RelatorioVendasPorDia,
  RelatorioProdutosMaisVendidos,
  RelatorioVendasPorCategoria,
  RelatorioHorariosPico,
  RelatorioFaturamentoPagamento,
  RelatorioEntregasPorBairro
} from '@/lib/tipos-anos-anteriores'

type DadosAnoAnterior = {
  estatisticas: EstatisticasAnuais
  pedidos: PedidoHistorico[]
  entregas: EntregaHistorico[]
  vendasPorDia: RelatorioVendasPorDia[]
  produtosMaisVendidos: RelatorioProdutosMaisVendidos[]
  vendasPorCategoria: RelatorioVendasPorCategoria[]
  horariosPico: RelatorioHorariosPico[]
  faturamentoPorPagamento: RelatorioFaturamentoPagamento[]
  entregasPorBairro: RelatorioEntregasPorBairro[]
}

const dadosVazios: DadosAnoAnterior = {
  estatisticas: {
    totalPedidos: 0,
    receitaTotal: 0,
    ticketMedio: 0,
    pedidosEntrega: 0,
    pedidosRetirada: 0,
    pedidosLocal: 0,
    receitaEntrega: 0,
    receitaRetirada: 0,
    receitaLocal: 0,
    totalEntregas: 0,
    totalTaxasEntrega: 0
  },
  pedidos: [],
  entregas: [],
  vendasPorDia: [],
  produtosMaisVendidos: [],
  vendasPorCategoria: [],
  horariosPico: [],
  faturamentoPorPagamento: [],
  entregasPorBairro: []
}

export function useAnosAnteriores(ano: number) {
  const [dados, setDados] = useState<DadosAnoAnterior>(dadosVazios)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const carregarDados = useCallback(async () => {
    setCarregando(true)
    setErro(null)

    try {
      const { inicio, fim } = obterPeriodoAno(ano)
      
      // Buscar pedidos do ano com paginação
      let todosPedidos: any[] = []
      let offset = 0
      const limite = 1000
      let temMais = true

      while (temMais) {
        const { data: lote, error } = await supabase
          .from('pedidos')
          .select('*')
          .gte('created_at', inicio)
          .lt('created_at', fim)
          .neq('status', 'cancelado')
          .order('created_at', { ascending: false })
          .range(offset, offset + limite - 1)

        if (error) throw error

        if (lote && lote.length > 0) {
          todosPedidos = [...todosPedidos, ...lote]
          offset += limite
          temMais = lote.length === limite
        } else {
          temMais = false
        }
      }

      // Buscar itens dos pedidos (limitado aos primeiros 500 para performance)
      const pedidosParaItens = todosPedidos.slice(0, 500)
      const pedidosComItens: PedidoHistorico[] = await Promise.all(
        pedidosParaItens.map(async (pedido) => {
          const { data: itens } = await supabase
            .from('itens_pedido')
            .select('*')
            .eq('pedido_id', pedido.id)

          return {
            ...pedido,
            itens: itens?.map((item: any) => ({
              id: item.id,
              nome_item: item.nome_item || 'Produto',
              quantidade: item.quantidade,
              preco_unitario: item.preco_unitario,
              subtotal: item.subtotal,
              observacoes: item.observacoes
            })) || []
          }
        })
      )

      // Adicionar pedidos sem itens carregados
      const pedidosRestantes = todosPedidos.slice(500).map(p => ({ ...p, itens: [] }))
      const pedidosCompletos = [...pedidosComItens, ...pedidosRestantes]

      // Buscar entregas do ano
      const { data: entregas } = await supabase
        .from('entregas')
        .select('*')
        .gte('created_at', inicio)
        .lt('created_at', fim)
        .order('created_at', { ascending: false })

      // Calcular estatísticas
      const estatisticas = calcularEstatisticas(todosPedidos)

      // Processar relatórios
      const vendasPorDia = processarVendasPorDia(todosPedidos)
      const produtosMaisVendidos = await processarProdutosMaisVendidos(pedidosComItens)
      const vendasPorCategoria = await processarVendasPorCategoria(pedidosComItens)
      const horariosPico = processarHorariosPico(todosPedidos)
      const faturamentoPorPagamento = processarFaturamentoPorPagamento(todosPedidos)
      const entregasPorBairro = processarEntregasPorBairro(todosPedidos)

      setDados({
        estatisticas,
        pedidos: pedidosCompletos,
        entregas: entregas || [],
        vendasPorDia,
        produtosMaisVendidos,
        vendasPorCategoria,
        horariosPico,
        faturamentoPorPagamento,
        entregasPorBairro
      })
    } catch (error) {
      console.error('[Anos Anteriores] Erro ao carregar dados:', error)
      setErro('Erro ao carregar dados do ano. Tente novamente.')
    } finally {
      setCarregando(false)
    }
  }, [ano])

  useEffect(() => {
    carregarDados()
  }, [carregarDados])

  return { dados, carregando, erro, recarregar: carregarDados }
}

function calcularEstatisticas(pedidos: any[]): EstatisticasAnuais {
  let totalPedidos = pedidos.length
  let receitaTotal = 0
  let pedidosEntrega = 0
  let pedidosRetirada = 0
  let pedidosLocal = 0
  let receitaEntrega = 0
  let receitaRetirada = 0
  let receitaLocal = 0
  let totalTaxasEntrega = 0

  pedidos.forEach(pedido => {
    const total = Number(pedido.total) || 0
    receitaTotal += total

    const tipo = pedido.tipo_entrega?.toLowerCase() || 'local'
    if (tipo === 'entrega') {
      pedidosEntrega++
      receitaEntrega += total
      totalTaxasEntrega += Number(pedido.taxa_entrega) || 0
    } else if (tipo === 'retirada') {
      pedidosRetirada++
      receitaRetirada += total
    } else {
      pedidosLocal++
      receitaLocal += total
    }
  })

  // Contar entregas realizadas (status 'entregue')
  const totalEntregas = pedidos.filter(
    p => p.tipo_entrega === 'entrega' && p.status === 'entregue'
  ).length

  return {
    totalPedidos,
    receitaTotal,
    ticketMedio: totalPedidos > 0 ? receitaTotal / totalPedidos : 0,
    pedidosEntrega,
    pedidosRetirada,
    pedidosLocal,
    receitaEntrega,
    receitaRetirada,
    receitaLocal,
    totalEntregas,
    totalTaxasEntrega
  }
}

function processarVendasPorDia(pedidos: any[]): RelatorioVendasPorDia[] {
  const vendas: Record<string, { total: number; quantidade: number }> = {}

  pedidos.forEach(pedido => {
    const data = new Date(pedido.created_at).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      timeZone: 'America/Sao_Paulo'
    })
    
    if (!vendas[data]) {
      vendas[data] = { total: 0, quantidade: 0 }
    }
    vendas[data].total += Number(pedido.total) || 0
    vendas[data].quantidade += 1
  })

  return Object.entries(vendas)
    .map(([data, valores]) => ({ data, ...valores }))
    .sort((a, b) => {
      const [diaA, mesA] = a.data.split('/')
      const [diaB, mesB] = b.data.split('/')
      const dateA = new Date(2025, parseInt(mesA) - 1, parseInt(diaA))
      const dateB = new Date(2025, parseInt(mesB) - 1, parseInt(diaB))
      return dateA.getTime() - dateB.getTime()
    })
}

async function processarProdutosMaisVendidos(pedidos: PedidoHistorico[]): Promise<RelatorioProdutosMaisVendidos[]> {
  const produtos: Record<string, { quantidade: number; receita: number }> = {}

  pedidos.forEach(pedido => {
    pedido.itens?.forEach(item => {
      const nome = item.nome_item || 'Produto'
      if (!produtos[nome]) {
        produtos[nome] = { quantidade: 0, receita: 0 }
      }
      produtos[nome].quantidade += item.quantidade
      produtos[nome].receita += item.subtotal
    })
  })

  return Object.entries(produtos)
    .map(([nome, valores]) => ({ nome, ...valores }))
    .sort((a, b) => b.quantidade - a.quantidade)
    .slice(0, 10)
}

async function processarVendasPorCategoria(pedidos: PedidoHistorico[]): Promise<RelatorioVendasPorCategoria[]> {
  // Buscar produtos para mapear categorias
  const { data: produtos } = await supabase.from('produtos').select('nome, categoria')

  const mapaCategorias: Record<string, string> = {}
  produtos?.forEach(p => {
    mapaCategorias[p.nome] = p.categoria
  })

  const categorias: Record<string, { quantidade: number; receita: number }> = {}

  pedidos.forEach(pedido => {
    pedido.itens?.forEach(item => {
      const nome = item.nome_item || 'Produto'
      const categoria = mapaCategorias[nome] || 'Outros'

      if (!categorias[categoria]) {
        categorias[categoria] = { quantidade: 0, receita: 0 }
      }
      categorias[categoria].quantidade += item.quantidade
      categorias[categoria].receita += item.subtotal
    })
  })

  return Object.entries(categorias)
    .map(([categoria, valores]) => ({ categoria, ...valores }))
    .sort((a, b) => b.receita - a.receita)
}

function processarHorariosPico(pedidos: any[]): RelatorioHorariosPico[] {
  const horarios: Record<number, number> = {}

  pedidos.forEach(pedido => {
    const data = new Date(pedido.created_at)
    // Ajustar para timezone de SP
    const hora = new Date(data.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' })).getHours()
    horarios[hora] = (horarios[hora] || 0) + 1
  })

  return Object.entries(horarios)
    .map(([hora, quantidade]) => ({ hora: Number(hora), quantidade }))
    .sort((a, b) => a.hora - b.hora)
}

function processarFaturamentoPorPagamento(pedidos: any[]): RelatorioFaturamentoPagamento[] {
  const agrupado: Record<string, { total: number; quantidade: number }> = {}

  const normalizarForma = (forma: string): string => {
    const f = forma?.toLowerCase() || 'outros'
    if (f.includes('crédito') || f.includes('credito') || f === 'cartão') return 'Crédito'
    if (f.includes('débito') || f.includes('debito')) return 'Débito'
    if (f.includes('vale') || f.includes('refeição') || f.includes('refeicao')) return 'Vale Refeição'
    if (f === 'pix') return 'PIX'
    if (f === 'dinheiro') return 'Dinheiro'
    return forma || 'Outros'
  }

  pedidos.forEach(pedido => {
    if (pedido.forma_pagamento === 'Dividido') return
    
    const forma = normalizarForma(pedido.forma_pagamento)
    if (!agrupado[forma]) {
      agrupado[forma] = { total: 0, quantidade: 0 }
    }
    agrupado[forma].total += Number(pedido.total) || 0
    agrupado[forma].quantidade += 1
  })

  return Object.entries(agrupado)
    .map(([forma, dados]) => ({ forma, ...dados }))
    .sort((a, b) => b.total - a.total)
}

function processarEntregasPorBairro(pedidos: any[]): RelatorioEntregasPorBairro[] {
  const bairros: Record<string, { quantidade: number; taxaTotal: number }> = {}

  pedidos.forEach(pedido => {
    if (pedido.tipo_entrega === 'entrega' && pedido.bairro && pedido.status === 'entregue') {
      const bairro = pedido.bairro
      if (!bairros[bairro]) {
        bairros[bairro] = { quantidade: 0, taxaTotal: 0 }
      }
      bairros[bairro].quantidade += 1
      bairros[bairro].taxaTotal += Number(pedido.taxa_entrega) || 0
    }
  })

  return Object.entries(bairros)
    .map(([bairro, valores]) => ({ bairro, ...valores }))
    .sort((a, b) => b.quantidade - a.quantidade)
}
