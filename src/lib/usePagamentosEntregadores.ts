'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import type {
  Entrega,
  PagamentoEntregador,
  ResumoEntregadorDia,
  StatusPagamentoEntregador,
} from './tipos-entregas'
import type { Funcionario } from './tipos-caixa'
import type { IntervaloEntregas } from '@/features/entregas/types'

const TAMANHO_LOTE_REPASSES = 500

const formatarData = (data: Date | string) => {
  const d = typeof data === 'string' ? new Date(data) : data
  const ano = d.getFullYear()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

const obterDataReferenciaEntrega = (entrega: Entrega): string => {
  const referencia = entrega.data_entrega || entrega.created_at
  return formatarData(referencia)
}

type AgregadoEntregador = {
  entregador_id: string
  entregador_nome: string
  data_referencia: string
  total_entregas: number
  total_devido: number
}

const agregarEntregas = (
  entregas: Entrega[],
  entregadores: Funcionario[],
  intervalo: IntervaloEntregas,
): AgregadoEntregador[] => {
  const mapaEntregadores = new Map(entregadores.map(e => [e.id, e]))
  const agrupado = new Map<string, AgregadoEntregador>()

  for (const entrega of entregas) {
    if (!entrega.entregador_id) continue
    if (entrega.excluida_repasse) continue
    if (entrega.status !== 'entregue') continue

    const entregador = mapaEntregadores.get(entrega.entregador_id)
    if (!entregador) continue

    const dataRef = obterDataReferenciaEntrega(entrega)
    if (dataRef < intervalo.dataInicio || dataRef > intervalo.dataFim) continue
    const chave = `${entrega.entregador_id}::${dataRef}`
    const atual = agrupado.get(chave)

    if (atual) {
      atual.total_entregas += 1
      atual.total_devido += Number(entrega.taxa_entrega || 0)
    } else {
      agrupado.set(chave, {
        entregador_id: entrega.entregador_id,
        entregador_nome: entregador.nome,
        data_referencia: dataRef,
        total_entregas: 1,
        total_devido: Number(entrega.taxa_entrega || 0),
      })
    }
  }

  return Array.from(agrupado.values()).map(item => ({
    ...item,
    total_devido: Number(item.total_devido.toFixed(2)),
  }))
}

export function usePagamentosEntregadores(
  entregas: Entrega[],
  entregadores: Funcionario[],
  intervalo: IntervaloEntregas,
) {
  const [registros, setRegistros] = useState<PagamentoEntregador[]>([])
  const [carregando, setCarregando] = useState(false)
  const [salvando, setSalvando] = useState<string | null>(null)

  const carregarRegistros = useCallback(async () => {
    try {
      setCarregando(true)
      const resultado: PagamentoEntregador[] = []
      let offset = 0

      while (true) {
        const { data, error } = await supabase
          .from('pagamentos_entregadores')
          .select('*')
          .gte('data_referencia', intervalo.dataInicio)
          .lte('data_referencia', intervalo.dataFim)
          .order('data_referencia', { ascending: false })
          .order('id', { ascending: false })
          .range(offset, offset + TAMANHO_LOTE_REPASSES - 1)

        if (error) throw error
        const lote = (data || []) as PagamentoEntregador[]
        resultado.push(...lote)
        if (lote.length < TAMANHO_LOTE_REPASSES) break
        offset += TAMANHO_LOTE_REPASSES
      }

      setRegistros(resultado)
    } catch (erro) {
      console.error('[Pagamentos Entregadores] Erro ao carregar registros:', erro)
    } finally {
      setCarregando(false)
    }
  }, [intervalo.dataFim, intervalo.dataInicio])

  useEffect(() => {
    carregarRegistros()

    const canal = supabase
      .channel(`pagamentos-entregadores-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pagamentos_entregadores' },
        () => carregarRegistros()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(canal)
    }
  }, [carregarRegistros])

  const sincronizarDevidos = useCallback(async () => {
    if (entregas.length === 0 || entregadores.length === 0) return

    const agregados = agregarEntregas(entregas, entregadores, intervalo)
    if (agregados.length === 0) return

    const mapaRegistros = new Map(
      registros.map(r => [`${r.entregador_id}::${r.data_referencia}`, r])
    )

    const paraInserir: Array<Partial<PagamentoEntregador>> = []
    const paraAtualizar: Array<{ id: string; total_devido: number; total_entregas: number }> = []

    for (const ag of agregados) {
      const chave = `${ag.entregador_id}::${ag.data_referencia}`
      const registroExistente = mapaRegistros.get(chave)

      if (!registroExistente) {
        paraInserir.push({
          entregador_id: ag.entregador_id,
          data_referencia: ag.data_referencia,
          total_devido: ag.total_devido,
          total_entregas: ag.total_entregas,
          status: 'pendente',
        })
      } else if (
        registroExistente.status !== 'pago' &&
        (Number(registroExistente.total_devido) !== ag.total_devido ||
          registroExistente.total_entregas !== ag.total_entregas)
      ) {
        paraAtualizar.push({
          id: registroExistente.id,
          total_devido: ag.total_devido,
          total_entregas: ag.total_entregas,
        })
      }
    }

    try {
      if (paraInserir.length > 0) {
        const { error } = await supabase
          .from('pagamentos_entregadores')
          .upsert(paraInserir, { onConflict: 'entregador_id,data_referencia' })
        if (error) throw error
      }

      for (const upd of paraAtualizar) {
        const { error } = await supabase
          .from('pagamentos_entregadores')
          .update({
            total_devido: upd.total_devido,
            total_entregas: upd.total_entregas,
            updated_at: new Date().toISOString(),
          })
          .eq('id', upd.id)
        if (error) throw error
      }

      if (paraInserir.length > 0 || paraAtualizar.length > 0) {
        await carregarRegistros()
      }
    } catch (erro) {
      console.error('[Pagamentos Entregadores] Erro ao sincronizar devidos:', erro)
    }
  }, [carregarRegistros, entregadores, entregas, intervalo, registros])

  useEffect(() => {
    sincronizarDevidos()
  }, [sincronizarDevidos])

  const acumular = useCallback(
    async (registroId: string): Promise<boolean> => {
      try {
        setSalvando(registroId)
        const { error } = await supabase
          .from('pagamentos_entregadores')
          .update({
            status: 'acumulado',
            updated_at: new Date().toISOString(),
          })
          .eq('id', registroId)

        if (error) throw error
        await carregarRegistros()
        return true
      } catch (erro) {
        console.error('[Pagamentos Entregadores] Erro ao acumular:', erro)
        return false
      } finally {
        setSalvando(null)
      }
    },
    [carregarRegistros]
  )

  const reabrir = useCallback(
    async (registroId: string): Promise<boolean> => {
      try {
        setSalvando(registroId)
        const { error } = await supabase
          .from('pagamentos_entregadores')
          .update({
            status: 'pendente',
            updated_at: new Date().toISOString(),
          })
          .eq('id', registroId)

        if (error) throw error
        await carregarRegistros()
        return true
      } catch (erro) {
        console.error('[Pagamentos Entregadores] Erro ao reabrir:', erro)
        return false
      } finally {
        setSalvando(null)
      }
    },
    [carregarRegistros]
  )

  const pagar = useCallback(
    async (params: {
      registroId: string
      valor: number
      acumularRestante: boolean
      metodoPagamento: string
      observacoes?: string
    }): Promise<boolean> => {
      try {
        setSalvando(params.registroId)
        const registro = registros.find(r => r.id === params.registroId)
        if (!registro) throw new Error('Registro não encontrado')

        const valorDevido = Number(registro.total_devido)
        const valorJaPago = Number(registro.valor_pago)
        const saldoPendente = valorDevido - valorJaPago
        const valorPagamento = Math.max(0, Math.min(saldoPendente, params.valor))
        const novoValorPago = Number((valorJaPago + valorPagamento).toFixed(2))

        const novoSaldo = Number((valorDevido - novoValorPago).toFixed(2))
        let novoStatus: StatusPagamentoEntregador
        if (novoSaldo <= 0.001) {
          novoStatus = 'pago'
        } else if (params.acumularRestante) {
          novoStatus = 'acumulado'
        } else {
          novoStatus = 'parcial'
        }

        const { error } = await supabase
          .from('pagamentos_entregadores')
          .update({
            valor_pago: novoValorPago,
            status: novoStatus,
            metodo_pagamento: params.metodoPagamento || null,
            observacoes: params.observacoes?.trim() || null,
            data_pagamento: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', params.registroId)

        if (error) throw error
        await carregarRegistros()
        return true
      } catch (erro) {
        console.error('[Pagamentos Entregadores] Erro ao pagar:', erro)
        return false
      } finally {
        setSalvando(null)
      }
    },
    [registros, carregarRegistros]
  )

  const resumoPorDia = useMemo<ResumoEntregadorDia[]>(() => {
    const agregados = agregarEntregas(entregas, entregadores, intervalo)
    const mapaEntregadores = new Map(entregadores.map(e => [e.id, e]))
    const mapaAgregados = new Map(
      agregados.map(a => [`${a.entregador_id}::${a.data_referencia}`, a])
    )
    const mapaRegistros = new Map(
      registros.map(r => [`${r.entregador_id}::${r.data_referencia}`, r])
    )

    const chavesArray: string[] = []
    mapaAgregados.forEach((_, k) => chavesArray.push(k))
    mapaRegistros.forEach((_, k) => {
      if (!chavesArray.includes(k)) chavesArray.push(k)
    })
    const linhas: ResumoEntregadorDia[] = []

    for (const chave of chavesArray) {
      const ag = mapaAgregados.get(chave)
      const reg = mapaRegistros.get(chave)
      const [entregadorId, dataRef] = chave.split('::')
      const entregador = mapaEntregadores.get(entregadorId)
      if (!entregador) continue

      const totalDevido = ag ? ag.total_devido : Number(reg?.total_devido || 0)
      const totalEntregas = ag ? ag.total_entregas : reg?.total_entregas || 0
      const valorPago = Number(reg?.valor_pago || 0)
      const saldo = Number((totalDevido - valorPago).toFixed(2))

      linhas.push({
        entregador_id: entregadorId,
        entregador_nome: entregador.nome,
        data_referencia: dataRef,
        total_entregas: totalEntregas,
        total_devido: Number(totalDevido.toFixed(2)),
        valor_pago: valorPago,
        saldo,
        status: (reg?.status || 'pendente') as StatusPagamentoEntregador,
        registro_id: reg?.id || null,
        metodo_pagamento: reg?.metodo_pagamento || null,
        data_pagamento: reg?.data_pagamento || null,
        observacoes: reg?.observacoes || null,
      })
    }

    return linhas.sort((a, b) => {
      if (a.data_referencia !== b.data_referencia) {
        return b.data_referencia.localeCompare(a.data_referencia)
      }
      return a.entregador_nome.localeCompare(b.entregador_nome, 'pt-BR')
    })
  }, [entregadores, entregas, intervalo, registros])

  const totaisGerais = useMemo(() => {
    let totalDevido = 0
    let totalAcumulado = 0
    let totalPendente = 0
    let totalPagoPeriodo = 0

    for (const linha of resumoPorDia) {
      const saldo = Math.max(0, linha.saldo)
      if (linha.status !== 'pago') {
        totalDevido += saldo
        if (linha.status === 'acumulado') totalAcumulado += saldo
        if (linha.status === 'pendente' || linha.status === 'parcial') totalPendente += saldo
      }
      totalPagoPeriodo += Math.max(0, linha.valor_pago)
    }

    return {
      totalDevido: Number(totalDevido.toFixed(2)),
      totalAcumulado: Number(totalAcumulado.toFixed(2)),
      totalPendente: Number(totalPendente.toFixed(2)),
      totalPagoPeriodo: Number(totalPagoPeriodo.toFixed(2)),
    }
  }, [resumoPorDia])

  return {
    resumoPorDia,
    totaisGerais,
    carregando,
    salvando,
    pagar,
    acumular,
    reabrir,
    recarregar: carregarRegistros,
  }
}
