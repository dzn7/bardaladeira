'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  CONFIG_PRODUTIVIDADE_PADRAO,
  type ConfigProdutividade,
  type GarcomProdutividade,
  type OcorrenciaProdutividade,
  type PontoSerieProdutividade,
} from '../types'
import {
  calcularIntervalo,
  diaOperacionalDe,
  intervaloMesCorrente,
  type IntervaloProdutividade,
} from '../lib/periodo'

type EstadoProdutividade = {
  garcons: GarcomProdutividade[]
  serie: PontoSerieProdutividade[]
  /** Série do mês corrente: alimenta as metas e serve de contexto ao gráfico de evolução. */
  serieMes: PontoSerieProdutividade[]
  config: ConfigProdutividade
}

const ESTADO_INICIAL: EstadoProdutividade = {
  garcons: [],
  serie: [],
  serieMes: [],
  config: CONFIG_PRODUTIVIDADE_PADRAO,
}

const paramsPeriodo = (intervalo: IntervaloProdutividade) =>
  new URLSearchParams({
    inicio: intervalo.inicio.toISOString(),
    fim: intervalo.fim.toISOString(),
  })

export type ResumoMetas = {
  pontosDia: number
  pontosSemana: number
  pontosMes: number
}

const RESUMO_METAS_ZERADO: ResumoMetas = { pontosDia: 0, pontosSemana: 0, pontosMes: 0 }

export function useProdutividade(intervalo: IntervaloProdutividade) {
  const [dados, setDados] = useState<EstadoProdutividade>(ESTADO_INICIAL)
  const [metas, setMetas] = useState<ResumoMetas>(RESUMO_METAS_ZERADO)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  // Só a resposta mais recente pode escrever no estado (o usuário troca de período rápido).
  const requisicaoAtual = useRef(0)

  const inicioIso = intervalo.inicio.toISOString()
  const fimIso = intervalo.fim.toISOString()

  const carregar = useCallback(
    async (opcoes?: { silencioso?: boolean }) => {
      const id = ++requisicaoAtual.current
      if (!opcoes?.silencioso) setCarregando(true)

      try {
        const mes = intervaloMesCorrente()
        const [respostaPeriodo, respostaMes] = await Promise.all([
          fetch(`/api/admin/produtividade?${paramsPeriodo({ inicio: new Date(inicioIso), fim: new Date(fimIso) })}`),
          fetch(`/api/admin/produtividade?${paramsPeriodo(mes)}`),
        ])

        const corpoPeriodo = (await respostaPeriodo.json()) as {
          sucesso?: boolean
          erro?: string
          garcons?: GarcomProdutividade[]
          serie?: PontoSerieProdutividade[]
          config?: ConfigProdutividade
        }

        if (!respostaPeriodo.ok || !corpoPeriodo.sucesso) {
          throw new Error(corpoPeriodo.erro || 'Falha ao carregar produtividade.')
        }

        const corpoMes = (await respostaMes.json()) as {
          sucesso?: boolean
          serie?: PontoSerieProdutividade[]
        }

        if (id !== requisicaoAtual.current) return

        const serieMes = corpoMes.sucesso ? corpoMes.serie ?? [] : []

        setDados({
          garcons: corpoPeriodo.garcons ?? [],
          serie: corpoPeriodo.serie ?? [],
          serieMes,
          config: corpoPeriodo.config ?? CONFIG_PRODUTIVIDADE_PADRAO,
        })
        setMetas(resumirMetas(serieMes))
        setErro(null)
      } catch (falha) {
        if (id !== requisicaoAtual.current) return
        const mensagem = falha instanceof Error ? falha.message : 'Falha ao carregar produtividade.'
        console.error('[Produtividade] Erro ao carregar:', falha)
        setErro(mensagem)
        if (!opcoes?.silencioso) toast.error(mensagem)
      } finally {
        // Sempre desliga: uma recarga silenciosa disparada durante uma carga normal
        // invalida o id da normal, e sem isto o spinner ficaria preso.
        if (id === requisicaoAtual.current) setCarregando(false)
      }
    },
    [inicioIso, fimIso],
  )

  useEffect(() => {
    void carregar()
  }, [carregar])

  const atualizarConfig = useCallback((config: ConfigProdutividade) => {
    setDados((atual) => ({ ...atual, config }))
  }, [])

  return {
    ...dados,
    metas,
    carregando,
    erro,
    recarregar: carregar,
    atualizarConfig,
  }
}

/** Soma a série do mês corrente nas três janelas fixas dos cartões de meta. */
function resumirMetas(serie: PontoSerieProdutividade[]): ResumoMetas {
  const agora = new Date()
  const hoje = diaOperacionalDe(agora)
  const inicioSemana = diaOperacionalDe(calcularIntervalo('semana', undefined, agora).inicio)

  return serie.reduce<ResumoMetas>((acumulado, ponto) => {
    acumulado.pontosMes += ponto.pontos
    if (ponto.dia >= inicioSemana) acumulado.pontosSemana += ponto.pontos
    if (ponto.dia === hoje) acumulado.pontosDia += ponto.pontos
    return acumulado
  }, { ...RESUMO_METAS_ZERADO })
}

export function useOcorrencias(
  intervalo: IntervaloProdutividade,
  filtros: { garcomId: string | null; pagina: number; itensPorPagina: number },
) {
  const [ocorrencias, setOcorrencias] = useState<OcorrenciaProdutividade[]>([])
  const [total, setTotal] = useState(0)
  const [carregando, setCarregando] = useState(true)
  const requisicaoAtual = useRef(0)

  const inicioIso = intervalo.inicio.toISOString()
  const fimIso = intervalo.fim.toISOString()
  const { garcomId, pagina, itensPorPagina } = filtros

  const carregar = useCallback(async () => {
    const id = ++requisicaoAtual.current
    setCarregando(true)

    try {
      const params = new URLSearchParams({
        inicio: inicioIso,
        fim: fimIso,
        limite: String(itensPorPagina),
        offset: String((pagina - 1) * itensPorPagina),
      })
      if (garcomId) params.set('garcomId', garcomId)

      const resposta = await fetch(`/api/admin/produtividade/ocorrencias?${params}`)
      const corpo = (await resposta.json()) as {
        sucesso?: boolean
        erro?: string
        ocorrencias?: OcorrenciaProdutividade[]
        total?: number
      }

      if (!resposta.ok || !corpo.sucesso) {
        throw new Error(corpo.erro || 'Falha ao carregar ocorrências.')
      }
      if (id !== requisicaoAtual.current) return

      setOcorrencias(corpo.ocorrencias ?? [])
      setTotal(corpo.total ?? 0)
    } catch (falha) {
      if (id !== requisicaoAtual.current) return
      console.error('[Produtividade] Erro ao carregar ocorrências:', falha)
      setOcorrencias([])
      setTotal(0)
    } finally {
      if (id === requisicaoAtual.current) setCarregando(false)
    }
  }, [inicioIso, fimIso, garcomId, pagina, itensPorPagina])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const totalPaginas = useMemo(
    () => Math.max(Math.ceil(total / itensPorPagina), 1),
    [total, itensPorPagina],
  )

  return { ocorrencias, total, totalPaginas, carregando, recarregar: carregar }
}
