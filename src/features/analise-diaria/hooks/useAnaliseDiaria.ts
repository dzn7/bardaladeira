'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { isSameDay, subDays } from 'date-fns'
import { supabase } from '@/lib/supabase'
import { calcularPeriodoDiaTrabalho, obterDiaTrabalhoReferencia } from '@/lib/utils'
import { carregarGarconsPorIds } from '@/lib/pedidos-utils'
import type { DadosDiarios, PedidoAnalise, PeriodoComparativo } from '../types'
import { calcularVariacaoPercentual, normalizarFormaPagamento } from '../lib/formatadores'
import {
  processarCancelamentos,
  processarEntregasPorBairro,
  processarEquipe,
  processarHorariosPico,
  processarPedidosPorTipo,
  processarProdutosMaisVendidos,
  processarTaxasEntrega,
} from '../lib/processadores'

const resumoPeriodo = (pedidos: Array<{ total: number | null }>): PeriodoComparativo => {
  const faturamento = pedidos.reduce((s, p) => s + Number(p.total || 0), 0)
  const qtd = pedidos.length
  return {
    faturamento,
    pedidos: qtd,
    ticketMedio: qtd > 0 ? faturamento / qtd : 0,
  }
}

const carregarResumoPeriodo = async (dataRef: Date): Promise<PeriodoComparativo> => {
  const { inicio, fim } = calcularPeriodoDiaTrabalho(dataRef)
  const { data } = await supabase
    .from('pedidos')
    .select('total')
    .gte('created_at', inicio.toISOString())
    .lte('created_at', fim.toISOString())
    .neq('status', 'cancelado')
    .neq('status', 'aguardando_pagamento')
  return resumoPeriodo(data || [])
}

const processarFaturamentoPorPagamento = async (pedidoIds: string[]) => {
  const agrupado: Record<string, { total: number; quantidade: number }> = {}
  if (pedidoIds.length === 0) return []

  const { data: pagamentos } = await supabase
    .from('pagamentos_pedido')
    .select('forma_pagamento, valor, pedido_id')
    .in('pedido_id', pedidoIds)

  const pedidosComPagamentoDividido = new Set<string>()
  if (pagamentos && pagamentos.length > 0) {
    for (const pag of pagamentos) {
      if (!pag.pedido_id || !pag.valor) continue
      pedidosComPagamentoDividido.add(pag.pedido_id)
      const forma = normalizarFormaPagamento(pag.forma_pagamento)
      if (!agrupado[forma]) agrupado[forma] = { total: 0, quantidade: 0 }
      agrupado[forma].total += Number(pag.valor) || 0
      agrupado[forma].quantidade += 1
    }
  }

  const { data: pedidos } = await supabase
    .from('pedidos')
    .select('id, forma_pagamento, total')
    .in('id', pedidoIds)

  if (pedidos) {
    for (const pedido of pedidos) {
      if (!pedido.id || pedidosComPagamentoDividido.has(pedido.id)) continue
      if (pedido.forma_pagamento === 'Dividido') continue
      const forma = normalizarFormaPagamento(pedido.forma_pagamento)
      if (!agrupado[forma]) agrupado[forma] = { total: 0, quantidade: 0 }
      agrupado[forma].total += Number(pedido.total) || 0
      agrupado[forma].quantidade += 1
    }
  }

  return Object.entries(agrupado)
    .map(([forma, d]) => ({ forma, ...d }))
    .filter((i) => i.total > 0)
    .sort((a, b) => b.total - a.total)
}

export const useAnaliseDiaria = () => {
  const diaTrabalhoAtual = useMemo(() => obterDiaTrabalhoReferencia(new Date()), [])
  const [dataSelecionada, setDataSelecionada] = useState(() => diaTrabalhoAtual)
  const [dados, setDados] = useState<DadosDiarios | null>(null)
  const [carregando, setCarregando] = useState(true)

  const ehHoje = useMemo(
    () => isSameDay(dataSelecionada, diaTrabalhoAtual),
    [dataSelecionada, diaTrabalhoAtual],
  )

  const carregarDadosDia = useCallback(
    async (opcoes?: { silencioso?: boolean }) => {
      const silencioso = Boolean(opcoes?.silencioso)
      if (!silencioso) setCarregando(true)
      try {
        const { inicio: inicioPeriodo, fim: fimPeriodoMax } = calcularPeriodoDiaTrabalho(dataSelecionada)
        const agora = new Date()
        const fimPeriodo = ehHoje && agora < fimPeriodoMax ? agora : fimPeriodoMax
        const inicioStr = inicioPeriodo.toISOString()
        const fimStr = fimPeriodo.toISOString()

        const { data: pedidos, error } = await supabase
          .from('pedidos')
          .select(
            'id, created_at, total, tipo_entrega, bairro, status, taxa_entrega, forma_pagamento, garcom_id',
          )
          .gte('created_at', inicioStr)
          .lte('created_at', fimStr)
          .neq('status', 'cancelado')
          .neq('status', 'aguardando_pagamento')
          .order('created_at', { ascending: true })

        if (error) throw error

        const pedidosValidos = ((pedidos || []) as PedidoAnalise[]).filter(
          (p) => p && p.id && p.total !== null,
        )
        const pedidoIds = pedidosValidos.map((p) => p.id)

        const [{ data: todosItens }, { data: cancelados }, resumoOntem, resumoSemana, { data: movimentosFiado }] =
          await Promise.all([
            pedidoIds.length > 0
              ? supabase
                  .from('itens_pedido')
                  .select('pedido_id, nome_item, quantidade, subtotal')
                  .in('pedido_id', pedidoIds)
              : Promise.resolve({ data: [] as Array<{ pedido_id: string; nome_item: string; quantidade: number; subtotal: number }> }),
            supabase
              .from('pedidos')
              .select('total')
              .gte('created_at', inicioStr)
              .lte('created_at', fimStr)
              .eq('status', 'cancelado'),
            carregarResumoPeriodo(subDays(dataSelecionada, 1)),
            carregarResumoPeriodo(subDays(dataSelecionada, 7)),
            pedidoIds.length > 0
              ? supabase
                  .from('crediario_movimentos')
                  .select('valor, pedido_id')
                  .eq('tipo', 'consumo')
                  .eq('status', 'ativo')
                  .eq('origem', 'pedido')
                  .in('pedido_id', pedidoIds)
              : Promise.resolve({ data: [] as Array<{ valor: number; pedido_id: string }> }),
          ])

        const itensPorPedido = new Map<string, NonNullable<PedidoAnalise['itens_pedido']>>()
        for (const item of todosItens || []) {
          if (!item.pedido_id) continue
          if (!itensPorPedido.has(item.pedido_id)) itensPorPedido.set(item.pedido_id, [])
          itensPorPedido.get(item.pedido_id)!.push(item)
        }

        const pedidosComItens = pedidosValidos.map((p) => ({
          ...p,
          itens_pedido: itensPorPedido.get(p.id) || [],
        }))

        const faturamentoTotal = pedidosComItens.reduce((s, p) => s + Number(p.total), 0)
        const totalPedidos = pedidosComItens.length
        const ticketMedio = totalPedidos > 0 ? faturamentoTotal / totalPedidos : 0

        const garcomIds = Array.from(
          new Set(pedidosComItens.map((p) => p.garcom_id).filter((id): id is string => Boolean(id))),
        )
        const nomesGarcons = await carregarGarconsPorIds(garcomIds)

        const atual: PeriodoComparativo = {
          faturamento: faturamentoTotal,
          pedidos: totalPedidos,
          ticketMedio,
        }

        const fiadoPedidos = new Set((movimentosFiado || []).map((m) => m.pedido_id).filter(Boolean))
        const valorFiado = (movimentosFiado || []).reduce((s, m) => s + Number(m.valor || 0), 0)

        setDados({
          data: dataSelecionada,
          faturamentoTotal,
          totalPedidos,
          ticketMedio,
          pedidosPorTipo: processarPedidosPorTipo(pedidosComItens),
          faturamentoPorPagamento: await processarFaturamentoPorPagamento(pedidoIds),
          horariosPico: processarHorariosPico(pedidosComItens),
          produtosMaisVendidos: processarProdutosMaisVendidos(pedidosComItens),
          entregasPorBairro: processarEntregasPorBairro(pedidosComItens),
          cancelamentos: processarCancelamentos(cancelados || [], faturamentoTotal),
          comparativo: {
            ontem: resumoOntem,
            semanaPassada: resumoSemana,
            variacaoOntem: {
              faturamento: calcularVariacaoPercentual(atual.faturamento, resumoOntem.faturamento),
              pedidos: calcularVariacaoPercentual(atual.pedidos, resumoOntem.pedidos),
              ticketMedio: calcularVariacaoPercentual(atual.ticketMedio, resumoOntem.ticketMedio),
            },
            variacaoSemana: {
              faturamento: calcularVariacaoPercentual(atual.faturamento, resumoSemana.faturamento),
              pedidos: calcularVariacaoPercentual(atual.pedidos, resumoSemana.pedidos),
              ticketMedio: calcularVariacaoPercentual(atual.ticketMedio, resumoSemana.ticketMedio),
            },
          },
          taxasEntrega: processarTaxasEntrega(pedidosComItens),
          equipe: processarEquipe(pedidosComItens, nomesGarcons),
          fiado: {
            valor: valorFiado,
            quantidadePedidos: fiadoPedidos.size,
          },
        })
      } catch (erro) {
        console.error('[Análise Diária] Erro ao carregar dados:', erro)
      } finally {
        if (!silencioso) setCarregando(false)
      }
    },
    [dataSelecionada, ehHoje],
  )

  useEffect(() => {
    void carregarDadosDia()
    const channel = supabase
      .channel('analise-diaria-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos' }, () => {
        if (ehHoje) void carregarDadosDia({ silencioso: true })
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [carregarDadosDia, ehHoje])

  const selecionarData = useCallback(
    (data: Date) => {
      const referencia = new Date(data)
      referencia.setHours(12, 0, 0, 0)
      if (referencia > diaTrabalhoAtual) return
      setDataSelecionada(referencia)
    },
    [diaTrabalhoAtual],
  )

  return {
    dataSelecionada,
    selecionarData,
    diaTrabalhoAtual,
    ehHoje,
    dados,
    carregando,
    recarregar: carregarDadosDia,
  }
}
