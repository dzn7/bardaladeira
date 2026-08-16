'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from './supabase'
import type { Entrega, NovaEntrega, StatusEntrega, EstatisticasEntregas } from './tipos-entregas'
import type { Funcionario } from './tipos-caixa'
import type { FiltrosConsultaEntregas } from '@/features/entregas/types'

type TipoNotificacao = 'sucesso' | 'erro' | 'aviso' | 'info' | 'confirmacao'

const CHAVE_ENTREGADOR_PADRAO = 'entregador_padrao_id'
const TAMANHO_LOTE_ENTREGAS = 500

async function obterEntregadorPadrao(): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('configuracoes_loja')
      .select('valor')
      .eq('chave', CHAVE_ENTREGADOR_PADRAO)
      .maybeSingle()
    if (error) return null
    const valor = data?.valor?.trim()
    return valor && valor.length > 0 ? valor : null
  } catch {
    return null
  }
}

export function useEntregas(filtros: FiltrosConsultaEntregas) {
  const [entregas, setEntregas] = useState<Entrega[]>([])
  const [entregadores, setEntregadores] = useState<Funcionario[]>([])
  const [carregando, setCarregando] = useState(true)
  const [notificacao, setNotificacao] = useState<{
    tipo: TipoNotificacao
    titulo: string
    mensagem: string
    onConfirm?: () => void
  } | null>(null)

  const entregasRef = useRef<Entrega[]>([])

  useEffect(() => {
    entregasRef.current = entregas
  }, [entregas])

  const mostrarNotificacao = useCallback((
    tipo: TipoNotificacao,
    titulo: string,
    mensagem: string,
    onConfirm?: () => void
  ) => {
    setNotificacao({ tipo, titulo, mensagem, onConfirm })
  }, [])

  const fecharNotificacao = useCallback(() => {
    setNotificacao(null)
  }, [])

  // Calcula o início do "dia de trabalho" (10h da manhã)
  // Se for antes das 10h, considera o dia anterior
  const obterInicioDiaTrabalho = useCallback(() => {
    const agora = new Date()
    const inicioDia = new Date(agora)

    // Se for antes das 10h da manhã, o dia de trabalho começou ontem às 10h
    if (agora.getHours() < 10) {
      inicioDia.setDate(inicioDia.getDate() - 1)
    }

    // Define o início do dia de trabalho às 10h da manhã
    inicioDia.setHours(10, 0, 0, 0)

    return inicioDia
  }, [])

  const carregarEntregas = useCallback(async () => {
    try {
      const resultado: Entrega[] = []
      let offset = 0

      while (true) {
        const { data, error } = await supabase
          .from('entregas')
          .select(`
            id,
            pedido_id,
            entregador_id,
            status,
            endereco_entrega,
            bairro,
            taxa_entrega,
            tempo_estimado,
            tempo_real,
            distancia_km,
            observacoes,
            data_saida,
            data_entrega,
            excluida_repasse,
            created_at,
            updated_at,
            entregador:funcionarios(id, nome, cargo, ativo),
            pedido:pedidos(id, nome_cliente, telefone, total, forma_pagamento, status, tipo_entrega, endereco)
          `)
          .or(
            `and(created_at.gte.${filtros.inicioIso},created_at.lt.${filtros.fimExclusivoIso}),and(data_entrega.gte.${filtros.inicioIso},data_entrega.lt.${filtros.fimExclusivoIso})`,
          )
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .range(offset, offset + TAMANHO_LOTE_ENTREGAS - 1)

        if (error) throw error

        const lote = (data || []) as unknown as Entrega[]
        resultado.push(...lote)
        if (lote.length < TAMANHO_LOTE_ENTREGAS) break
        offset += TAMANHO_LOTE_ENTREGAS
      }

      setEntregas(resultado)
    } catch (erro) {
      console.error('Erro ao carregar entregas:', erro)
    }
  }, [filtros.fimExclusivoIso, filtros.inicioIso])

  // Carregar entregadores (funcionários com cargo de entregador)
  const carregarEntregadores = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('funcionarios')
        .select('id, nome, cargo, ativo')
        .eq('ativo', true)
        .or('cargo.ilike.%entregador%,cargo.ilike.%motoboy%,cargo.ilike.%delivery%,tipo.ilike.%entregador%,tipo.ilike.%motoboy%,tipo.ilike.%delivery%')

      if (error) throw error
      setEntregadores(data || [])
    } catch (erro) {
      console.error('Erro ao carregar entregadores:', erro)
    }
  }, [])

  // Sincronizar pedidos de entrega faltantes na tabela entregas
  const sincronizarPedidosFaltantes = useCallback(async () => {
    try {
      const inicioJanela = obterInicioDiaTrabalho()

      // Buscar pedidos de entrega que não têm registro na tabela entregas
      const { data: pedidosFaltantes } = await supabase
        .from('pedidos')
        .select('id, endereco, bairro, taxa_entrega, status, created_at, updated_at')
        .eq('tipo_entrega', 'entrega')
        .gte('created_at', inicioJanela.toISOString())
        .neq('status', 'cancelado')
        .neq('status', 'aguardando_pagamento')

      if (!pedidosFaltantes || pedidosFaltantes.length === 0) return

      const idsPedidos = pedidosFaltantes.map((pedido) => pedido.id)
      const { data: entregasExistentes } = await supabase
        .from('entregas')
        .select('pedido_id')
        .in('pedido_id', idsPedidos)

      const pedidosComEntrega = new Set(entregasExistentes?.map((entrega) => entrega.pedido_id) || [])

      // Inserir entregas faltantes
      const faltantes = pedidosFaltantes.filter(p => !pedidosComEntrega.has(p.id))

      if (faltantes.length > 0) {
        console.log(`[Entregas] Sincronizando ${faltantes.length} pedido(s) faltante(s)`)
        const entregadorPadrao = await obterEntregadorPadrao()

        const registros = faltantes.map((pedido) => ({
            pedido_id: pedido.id,
            entregador_id: entregadorPadrao,
            endereco_entrega: pedido.endereco || null,
            bairro: pedido.bairro || null,
            taxa_entrega: pedido.taxa_entrega || 0,
            status: pedido.status === 'entregue' ? 'entregue' : 'pendente',
            data_entrega: pedido.status === 'entregue' ? pedido.updated_at : null,
          }))

        const { error } = await supabase.from('entregas').upsert(registros, {
            onConflict: 'pedido_id',
            ignoreDuplicates: true,
          })

        if (error && error.code !== '23505') {
          console.error('[Entregas] Erro ao criar entregas:', error)
        }
      }
    } catch (erro) {
      console.error('[Entregas] Erro ao sincronizar pedidos faltantes:', erro)
    }
  }, [obterInicioDiaTrabalho])

  // Carregar dados iniciais
  const carregarDados = useCallback(async () => {
    setCarregando(true)
    await sincronizarPedidosFaltantes()
    await Promise.all([carregarEntregas(), carregarEntregadores()])
    setCarregando(false)
  }, [carregarEntregas, carregarEntregadores, sincronizarPedidosFaltantes])

  // Registrar nova entrega
  const registrarEntrega = useCallback(async (dados: NovaEntrega): Promise<boolean> => {
    try {
      // Verificar se já existe entrega para este pedido
      const { data: existente } = await supabase
        .from('entregas')
        .select('id')
        .eq('pedido_id', dados.pedido_id)
        .single()

      if (existente) {
        mostrarNotificacao('aviso', 'Atenção', 'Já existe uma entrega registrada para este pedido.')
        return false
      }

      const { error } = await supabase.from('entregas').insert({
        pedido_id: dados.pedido_id,
        entregador_id: dados.entregador_id || null,
        endereco_entrega: dados.endereco_entrega || null,
        bairro: dados.bairro || null,
        taxa_entrega: dados.taxa_entrega || 0,
        tempo_estimado: dados.tempo_estimado || null,
        distancia_km: dados.distancia_km || null,
        observacoes: dados.observacoes || null,
        status: 'pendente'
      })

      if (error) throw error

      await carregarEntregas()
      mostrarNotificacao('sucesso', 'Sucesso', 'Entrega registrada com sucesso!')
      return true
    } catch (erro) {
      console.error('Erro ao registrar entrega:', erro)
      mostrarNotificacao('erro', 'Erro', 'Não foi possível registrar a entrega.')
      return false
    }
  }, [carregarEntregas, mostrarNotificacao])

  // Atualizar status da entrega
  const atualizarStatusEntrega = useCallback(async (
    entregaId: string,
    novoStatus: StatusEntrega,
    entregadorId?: string
  ): Promise<boolean> => {
    try {
      const atualizacao: Record<string, unknown> = {
        status: novoStatus,
        updated_at: new Date().toISOString()
      }

      if (entregadorId) {
        atualizacao.entregador_id = entregadorId
      }

      if (novoStatus === 'em_rota') {
        atualizacao.data_saida = new Date().toISOString()
      }

      if (novoStatus === 'entregue') {
        atualizacao.data_entrega = new Date().toISOString()
        
        // Calcular tempo real
        const entrega = entregasRef.current.find(e => e.id === entregaId)
        if (entrega?.data_saida) {
          const saida = new Date(entrega.data_saida)
          const chegada = new Date()
          const tempoMinutos = Math.round((chegada.getTime() - saida.getTime()) / 60000)
          atualizacao.tempo_real = tempoMinutos
        }
      }

      const { error } = await supabase
        .from('entregas')
        .update(atualizacao)
        .eq('id', entregaId)

      if (error) throw error

      await carregarEntregas()
      
      const mensagens: Record<StatusEntrega, string> = {
        'pendente': 'Entrega marcada como pendente',
        'em_rota': 'Entregador saiu para entrega',
        'entregue': 'Entrega concluída com sucesso!',
        'cancelada': 'Entrega cancelada'
      }
      
      mostrarNotificacao('sucesso', 'Atualizado', mensagens[novoStatus])
      return true
    } catch (erro) {
      console.error('Erro ao atualizar entrega:', erro)
      mostrarNotificacao('erro', 'Erro', 'Não foi possível atualizar a entrega.')
      return false
    }
  }, [carregarEntregas, mostrarNotificacao])

  // Atribuir/trocar entregador de uma entrega
  const atribuirEntregador = useCallback(async (
    entregaId: string,
    entregadorId: string | null,
  ): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('entregas')
        .update({ entregador_id: entregadorId, updated_at: new Date().toISOString() })
        .eq('id', entregaId)
      if (error) throw error
      await carregarEntregas()
      mostrarNotificacao(
        'sucesso',
        'Entregador atualizado',
        entregadorId ? 'Entrega vinculada ao entregador.' : 'Entregador removido da entrega.',
      )
      return true
    } catch (erro) {
      console.error('Erro ao atribuir entregador:', erro)
      mostrarNotificacao('erro', 'Erro', 'Não foi possível atualizar o entregador.')
      return false
    }
  }, [carregarEntregas, mostrarNotificacao])

  // Alterna se a entrega entra no repasse ao entregador
  const alternarExclusaoRepasse = useCallback(async (
    entregaId: string,
    excluir: boolean,
  ): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('entregas')
        .update({ excluida_repasse: excluir, updated_at: new Date().toISOString() })
        .eq('id', entregaId)
      if (error) throw error
      await carregarEntregas()
      mostrarNotificacao(
        'sucesso',
        excluir ? 'Excluída do repasse' : 'Incluída no repasse',
        excluir
          ? 'A entrega não soma mais no que você deve ao entregador.'
          : 'A entrega voltou a contar no repasse.',
      )
      return true
    } catch (erro) {
      console.error('Erro ao alternar exclusão do repasse:', erro)
      mostrarNotificacao('erro', 'Erro', 'Não foi possível atualizar a entrega.')
      return false
    }
  }, [carregarEntregas, mostrarNotificacao])

  // Excluir entrega
  const excluirEntrega = useCallback(async (entregaId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('entregas')
        .delete()
        .eq('id', entregaId)

      if (error) throw error

      setEntregas(prev => prev.filter(e => e.id !== entregaId))
      mostrarNotificacao('sucesso', 'Excluído', 'Entrega excluída com sucesso!')
      return true
    } catch (erro) {
      console.error('Erro ao excluir entrega:', erro)
      mostrarNotificacao('erro', 'Erro', 'Não foi possível excluir a entrega.')
      return false
    }
  }, [mostrarNotificacao])

  // Calcular estatísticas
  const estatisticas: EstatisticasEntregas = {
    totalEntregas: entregas.length,
    entregasPendentes: entregas.filter(e => e.status === 'pendente').length,
    entregasEmRota: entregas.filter(e => e.status === 'em_rota').length,
    entregasConcluidas: entregas.filter(e => e.status === 'entregue').length,
    entregasCanceladas: entregas.filter(e => e.status === 'cancelada').length,
    tempoMedioEntrega: (() => {
      const entregues = entregas.filter(e => e.tempo_real)
      if (entregues.length === 0) return 0
      return Math.round(entregues.reduce((acc, e) => acc + (e.tempo_real || 0), 0) / entregues.length)
    })(),
    taxaMediaEntrega: (() => {
      const comTaxa = entregas.filter(e => e.taxa_entrega > 0)
      if (comTaxa.length === 0) return 0
      return comTaxa.reduce((acc, e) => acc + e.taxa_entrega, 0) / comTaxa.length
    })(),
    totalTaxas: entregas.reduce((acc, e) => acc + (e.taxa_entrega || 0), 0)
  }

  // Realtime mantém o intervalo selecionado atualizado sem alterar status automaticamente.
  useEffect(() => {
    carregarDados()

    const channel = supabase
      .channel('entregas-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'entregas' },
        (payload) => {
          console.log('[Entregas] Realtime:', payload.eventType)
          carregarEntregas()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pedidos' },
        async (payload) => {
          console.log('[Entregas] Pedido Realtime:', payload.eventType, payload.new)
          // Quando um pedido for marcado como entrega, criar entrega automaticamente
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const pedido = payload.new as { id: string; tipo_entrega?: string; endereco?: string; taxa_entrega?: number }
            if (pedido.tipo_entrega === 'entrega') {
              // Verificar se já existe entrega
              const { data: existente } = await supabase
                .from('entregas')
                .select('id')
                .eq('pedido_id', pedido.id)
                .single()

              if (!existente) {
                console.log('[Entregas] Criando entrega para pedido:', pedido.id)
                const entregadorPadrao = await obterEntregadorPadrao()
                // Usar upsert para evitar race condition com constraint unique
                const { error } = await supabase.from('entregas').upsert({
                  pedido_id: pedido.id,
                  entregador_id: entregadorPadrao,
                  endereco_entrega: pedido.endereco || null,
                  taxa_entrega: pedido.taxa_entrega || 0,
                  status: 'pendente'
                }, {
                  onConflict: 'pedido_id',
                  ignoreDuplicates: true
                })
                
                // Só recarrega se não houve erro (ou se foi duplicata ignorada)
                if (!error || error.code === '23505') {
                  carregarEntregas()
                }
              }
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('[Entregas] Realtime status:', status)
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [carregarDados, carregarEntregas])

  return {
    entregas,
    entregadores,
    estatisticas,
    carregando,
    notificacao,
    carregarDados,
    registrarEntrega,
    atualizarStatusEntrega,
    excluirEntrega,
    atribuirEntregador,
    alternarExclusaoRepasse,
    mostrarNotificacao,
    fecharNotificacao
  }
}
