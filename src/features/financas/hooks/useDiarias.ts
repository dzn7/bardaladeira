'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import type { EntradaDiaria, FinancasDiaria } from '../types'

const COLUNAS_DIARIA =
  'id, data_referencia, nome_pessoa, funcionario_id, valor, forma_pagamento, observacoes, movimentacao_id, created_at, updated_at'

type UseDiariasArgs = {
  inicio: string
  fim: string
}

const dataIsoMeioDia = (yyyyMmDd: string) => {
  const [ano, mes, dia] = yyyyMmDd.split('-').map(Number)
  if (!ano || !mes || !dia) return new Date().toISOString()
  return new Date(ano, mes - 1, dia, 12, 0, 0, 0).toISOString()
}

const normalizarDataReferencia = (valor: string) => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) return valor
  const d = new Date(valor)
  if (Number.isNaN(d.getTime())) return valor.slice(0, 10)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function useDiarias({ inicio, fim }: UseDiariasArgs) {
  const [diarias, setDiarias] = useState<FinancasDiaria[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const inicioDia = useMemo(() => normalizarDataReferencia(inicio), [inicio])
  const fimDia = useMemo(() => normalizarDataReferencia(fim), [fim])

  const carregar = useCallback(async () => {
    setCarregando(true)
    setErro(null)
    try {
      const { data, error } = await supabase
        .from('financas_diarias')
        .select(COLUNAS_DIARIA)
        .gte('data_referencia', inicioDia)
        .lte('data_referencia', fimDia)
        .order('data_referencia', { ascending: false })
        .order('created_at', { ascending: false })

      if (error) throw error
      setDiarias(
        (data ?? []).map((row) => ({
          ...row,
          valor: Number(row.valor ?? 0),
          data_referencia: normalizarDataReferencia(String(row.data_referencia)),
        })),
      )
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Falha ao carregar diárias'
      setErro(message)
      setDiarias([])
    } finally {
      setCarregando(false)
    }
  }, [inicioDia, fimDia])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const totalPeriodo = useMemo(
    () => diarias.reduce((acc, d) => acc + Number(d.valor ?? 0), 0),
    [diarias],
  )

  const criarDiaria = useCallback(
    async (entrada: EntradaDiaria) => {
      const nome = entrada.nome_pessoa.trim()
      if (!nome) throw new Error('Informe o nome da pessoa.')
      if (!Number.isFinite(entrada.valor) || entrada.valor <= 0) {
        throw new Error('Informe um valor válido maior que zero.')
      }

      const dataRef = normalizarDataReferencia(entrada.data_referencia)

      const { data: categoria } = await supabase
        .from('categorias_caixa')
        .select('id')
        .eq('tipo', 'saida')
        .ilike('nome', 'diária')
        .eq('ativo', true)
        .maybeSingle()

      const { data: caixaAberto } = await supabase
        .from('caixas')
        .select('id')
        .eq('status', 'aberto')
        .order('data_abertura', { ascending: false })
        .limit(1)
        .maybeSingle()

      const descricaoBase = `Diária – ${nome}`
      const obs = entrada.observacoes?.trim()
      const descricao = obs ? `${descricaoBase} (${obs})` : descricaoBase

      const { data: movimentacao, error: erroMov } = await supabase
        .from('movimentacoes_caixa')
        .insert({
          tipo: 'saida',
          valor: entrada.valor,
          descricao,
          categoria_id: categoria?.id ?? null,
          funcionario_id: entrada.funcionario_id || null,
          forma_pagamento: entrada.forma_pagamento ?? null,
          caixa_id: caixaAberto?.id ?? null,
          created_at: dataIsoMeioDia(dataRef),
        })
        .select('id')
        .single()

      if (erroMov || !movimentacao?.id) {
        const msg = erroMov?.message || 'Não foi possível lançar a despesa da diária.'
        toast.error(msg)
        throw new Error(msg)
      }

      const { data: diaria, error: erroDiaria } = await supabase
        .from('financas_diarias')
        .insert({
          data_referencia: dataRef,
          nome_pessoa: nome,
          funcionario_id: entrada.funcionario_id || null,
          valor: entrada.valor,
          forma_pagamento: entrada.forma_pagamento ?? null,
          observacoes: obs || null,
          movimentacao_id: movimentacao.id,
        })
        .select(COLUNAS_DIARIA)
        .single()

      if (erroDiaria || !diaria) {
        await supabase.from('movimentacoes_caixa').delete().eq('id', movimentacao.id)
        const msg = erroDiaria?.message || 'Não foi possível salvar a diária.'
        toast.error(msg)
        throw new Error(msg)
      }

      toast.success('Diária lançada como despesa')
      await carregar()
      return {
        ...diaria,
        valor: Number(diaria.valor ?? 0),
        data_referencia: normalizarDataReferencia(String(diaria.data_referencia)),
      } as FinancasDiaria
    },
    [carregar],
  )

  const removerDiaria = useCallback(
    async (diaria: FinancasDiaria) => {
      const { error } = await supabase
        .from('movimentacoes_caixa')
        .delete()
        .eq('id', diaria.movimentacao_id)

      if (error) {
        toast.error('Não foi possível excluir a diária. ' + error.message)
        throw error
      }

      toast.success('Diária e despesa removidas')
      await carregar()
    },
    [carregar],
  )

  return {
    diarias,
    carregando,
    erro,
    totalPeriodo,
    refetch: carregar,
    criarDiaria,
    removerDiaria,
  }
}
