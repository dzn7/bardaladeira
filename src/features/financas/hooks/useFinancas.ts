'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { obterDiaTrabalhoReferencia } from '@/lib/utils'
import { calcularResumoFinanceiro, somarDinheiro } from '@/lib/financeiro.mjs'
import type { CategoriaCaixa, Funcionario, MovimentacaoCaixa } from '@/lib/tipos-caixa'
import type {
  ComposicaoReceita,
  ContaCrediarioResumo,
  FiltroFinancas,
  LucroProduto,
  PagamentoPedido,
  PedidoFinanceiro,
  PontoFluxoCaixa,
  ResumoMensal,
  ResumoPeriodo,
  ResumoLucroProdutos,
  TipoMovimentacao,
} from '../types'
import { CORES_GRAFICOS, rotularFormaPagamento } from '../lib/formatadores'

const STATUS_PEDIDO_NAO_PAGO = ['aguardando_pagamento', 'pendente']

const COLUNAS_CATEGORIA = 'id, nome, tipo, cor, icone, ativo, ordem'
const COLUNAS_FUNCIONARIO = 'id, nome, cargo, ativo, tipo'
const COLUNAS_MOVIMENTACAO =
  'id, caixa_id, categoria_id, funcionario_id, pedido_id, tipo, valor, descricao, forma_pagamento, created_at, categoria:categorias_caixa(id, nome, tipo, cor, icone, ativo, ordem), funcionario:funcionarios(id, nome, cargo, ativo)'

interface DadosFinancas {
  movimentacoes: MovimentacaoCaixa[]
  pedidos: PedidoFinanceiro[]
  pedidosNaoPagos: PedidoFinanceiro[]
  crediarios: ContaCrediarioResumo[]
  resumoMensal: ResumoMensal[]
  pagamentos: PagamentoPedido[]
  lucroProdutos: LucroProduto[]
}

type RespostaLucroApi = {
  sucesso?: boolean
  erro?: string
  lucroProdutos?: Array<Record<string, unknown>>
}

const DADOS_VAZIO: DadosFinancas = {
  movimentacoes: [],
  pedidos: [],
  pedidosNaoPagos: [],
  crediarios: [],
  resumoMensal: [],
  pagamentos: [],
  lucroProdutos: [],
}

const ehEntradaManual = (m: Pick<MovimentacaoCaixa, 'tipo' | 'pedido_id'>) =>
  m.tipo === 'entrada' && !m.pedido_id

const ehSaida = (m: Pick<MovimentacaoCaixa, 'tipo'>) => m.tipo === 'saida'

const chaveDiaTrabalho = (isoOuDate: string | Date) => {
  const d = typeof isoOuDate === 'string' ? new Date(isoOuDate) : isoOuDate
  const ref = obterDiaTrabalhoReferencia(d)
  return `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, '0')}-${String(ref.getDate()).padStart(2, '0')}`
}

export function useFinancas(filtro: FiltroFinancas) {
  const [dados, setDados] = useState<DadosFinancas>(DADOS_VAZIO)
  const [categorias, setCategorias] = useState<CategoriaCaixa[]>([])
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [erroLucro, setErroLucro] = useState<string | null>(null)

  const fetchIdRef = useRef(0)

  const carregarCategoriasFuncionarios = useCallback(async () => {
    const [{ data: cats }, { data: funcs }] = await Promise.all([
      supabase.from('categorias_caixa').select(COLUNAS_CATEGORIA).eq('ativo', true).order('nome'),
      supabase.from('funcionarios').select(COLUNAS_FUNCIONARIO).eq('ativo', true).order('nome'),
    ])
    setCategorias((cats as CategoriaCaixa[]) ?? [])
    setFuncionarios((funcs as Funcionario[]) ?? [])
  }, [])

  const carregarDados = useCallback(async (alvo: FiltroFinancas) => {
    const id = ++fetchIdRef.current
    setCarregando(true)
    setErro(null)
    setErroLucro(null)

    try {
      const fimFiltro = new Date(alvo.fim)
      const inicioJanela = new Date(fimFiltro.getFullYear(), fimFiltro.getMonth() - 11, 1, 0, 0, 0, 0)

      const [resPedidosPagos, resPedidosNaoPagos, resMovs, resCrediario, resJanela, resMovsJanela, resPagamentos, resLucro] =
        await Promise.all([
          supabase
            .from('pedidos')
            .select(
              'id, numero_pedido, nome_cliente, total, taxa_entrega, taxa_servico, taxa_pagamento, status, pagamento_online, pagamento_online_status, forma_pagamento, created_at',
            )
            .gte('created_at', alvo.inicio)
            .lte('created_at', alvo.fim)
            .neq('status', 'cancelado')
            .neq('status', 'aguardando_pagamento')
            .neq('status', 'pendente')
            .neq('pagamento_online_status', 'aguardando_pagamento')
            .order('created_at', { ascending: false })
            .limit(2000),

          supabase
            .from('pedidos')
            .select(
              'id, numero_pedido, nome_cliente, total, taxa_entrega, taxa_servico, taxa_pagamento, status, pagamento_online, pagamento_online_status, forma_pagamento, created_at',
            )
            .gte('created_at', alvo.inicio)
            .lte('created_at', alvo.fim)
            .or(
              `status.in.(${STATUS_PEDIDO_NAO_PAGO.join(',')}),pagamento_online_status.eq.aguardando_pagamento`,
            )
            .order('created_at', { ascending: false })
            .limit(500),

          supabase
            .from('movimentacoes_caixa')
            .select(COLUNAS_MOVIMENTACAO)
            .gte('created_at', alvo.inicio)
            .lte('created_at', alvo.fim)
            .order('created_at', { ascending: false })
            .limit(1000),

          supabase
            .from('crediario_contas')
            .select('id, cliente_nome, telefone, saldo_atual, status, atualizado_em')
            .eq('status', 'aberto')
            .gt('saldo_atual', 0)
            .order('saldo_atual', { ascending: false })
            .limit(300),

          supabase
            .from('pedidos')
            .select('total, created_at')
            .gte('created_at', inicioJanela.toISOString())
            .lte('created_at', alvo.fim)
            .neq('status', 'cancelado')
            .neq('status', 'aguardando_pagamento')
            .neq('status', 'pendente')
            .neq('pagamento_online_status', 'aguardando_pagamento')
            .limit(20000),

          supabase
            .from('movimentacoes_caixa')
            .select('tipo, valor, created_at, pedido_id')
            .gte('created_at', inicioJanela.toISOString())
            .lte('created_at', alvo.fim)
            .limit(20000),

          supabase
            .from('pagamentos_pedido')
            .select('id, pedido_id, forma_pagamento, valor, bandeira, created_at')
            .gte('created_at', alvo.inicio)
            .lte('created_at', alvo.fim)
            .order('created_at', { ascending: false })
            .limit(5000),

          fetch(
            `/api/admin/financas/lucro?inicio=${encodeURIComponent(alvo.inicio)}&fim=${encodeURIComponent(alvo.fim)}`,
            { headers: { 'x-admin-token': window.localStorage.getItem('adminToken') || '' } },
          ).then(async (resposta): Promise<{ ok: boolean; json: RespostaLucroApi }> => ({
            ok: resposta.ok,
            json: (await resposta.json()) as RespostaLucroApi,
          })).catch((falha: unknown): { ok: boolean; json: RespostaLucroApi } => ({
            ok: false,
            json: {
              sucesso: false,
              erro: falha instanceof Error ? falha.message : 'Lucro bruto indisponível.',
            },
          })),
        ])

      if (id !== fetchIdRef.current) return

      const erros = [
        resPedidosPagos.error,
        resPedidosNaoPagos.error,
        resMovs.error,
        resCrediario.error,
        resJanela.error,
        resMovsJanela.error,
        resPagamentos.error,
      ].filter(Boolean)

      if (erros.length) {
        throw new Error(erros.map((e) => e?.message).join(' | '))
      }

      const lucroProdutos = resLucro.ok && resLucro.json.sucesso
        ? (resLucro.json.lucroProdutos || []).map((linha): LucroProduto => ({
            mes: String(linha.mes || ''),
            produto_id: linha.produto_id ? String(linha.produto_id) : null,
            nome_produto: String(linha.nome_produto || 'Item'),
            quantidade: Number(linha.quantidade || 0),
            receita_com_custo: Number(linha.receita_com_custo || 0),
            custo_mercadorias: Number(linha.custo_mercadorias || 0),
            lucro_bruto: Number(linha.lucro_bruto || 0),
            margem_bruta: Number(linha.margem_bruta || 0),
            receita_sem_custo: Number(linha.receita_sem_custo || 0),
            itens_sem_custo: Number(linha.itens_sem_custo || 0),
          }))
        : []
      if (!resLucro.ok || !resLucro.json.sucesso) {
        setErroLucro(resLucro.json.erro || 'Lucro bruto indisponível.')
      }

      const resumoMensal = construirResumoMensal(
        (resJanela.data as { total: number; created_at: string }[]) ?? [],
        (resMovsJanela.data as { tipo: TipoMovimentacao; valor: number; created_at: string; pedido_id: string | null }[]) ?? [],
        fimFiltro,
      )

      setDados({
        pedidos: (resPedidosPagos.data as PedidoFinanceiro[]) ?? [],
        pedidosNaoPagos: (resPedidosNaoPagos.data as PedidoFinanceiro[]) ?? [],
        movimentacoes: (resMovs.data as unknown as MovimentacaoCaixa[]) ?? [],
        crediarios: (resCrediario.data as ContaCrediarioResumo[]) ?? [],
        resumoMensal,
        pagamentos: (resPagamentos.data as PagamentoPedido[]) ?? [],
        lucroProdutos,
      })
    } catch (err) {
      if (id !== fetchIdRef.current) return
      const msg = err instanceof Error ? err.message : 'Falha ao carregar dados financeiros'
      console.error('[useFinancas]', err)
      setErro(msg)
      setDados(DADOS_VAZIO)
    } finally {
      if (id === fetchIdRef.current) setCarregando(false)
    }
  }, [])

  useEffect(() => {
    carregarCategoriasFuncionarios()
  }, [carregarCategoriasFuncionarios])

  useEffect(() => {
    carregarDados(filtro)
  }, [filtro.inicio, filtro.fim, carregarDados, filtro])

  const resumo = useMemo<ResumoPeriodo>(() => {
    return calcularResumoFinanceiro({
      pedidos: dados.pedidos,
      movimentacoes: dados.movimentacoes,
      pedidosNaoPagos: dados.pedidosNaoPagos,
      crediarios: dados.crediarios,
    })
  }, [dados])

  const resumoLucro = useMemo<ResumoLucroProdutos>(() => {
    const receitaComCusto = somarDinheiro(dados.lucroProdutos.map((item) => item.receita_com_custo))
    const custoConhecido = somarDinheiro(dados.lucroProdutos.map((item) => item.custo_mercadorias))
    const lucroBrutoConhecido = somarDinheiro(dados.lucroProdutos.map((item) => item.lucro_bruto))
    return {
      receitaComCusto,
      custoConhecido,
      lucroBrutoConhecido,
      margemBrutaConhecida: receitaComCusto > 0
        ? Number(((lucroBrutoConhecido / receitaComCusto) * 100).toFixed(2))
        : 0,
      receitaSemCusto: somarDinheiro(dados.lucroProdutos.map((item) => item.receita_sem_custo)),
      unidadesSemCusto: dados.lucroProdutos.reduce((total, item) => total + item.itens_sem_custo, 0),
    }
  }, [dados.lucroProdutos])

  const fluxoCaixa = useMemo<PontoFluxoCaixa[]>(
    () => construirFluxoCaixa(filtro, dados.pedidos, dados.movimentacoes),
    [filtro.inicio, filtro.fim, filtro.tipo, dados.pedidos, dados.movimentacoes],
  )

  const composicaoReceita = useMemo<ComposicaoReceita[]>(() => {
    const paidIds = new Set(dados.pedidos.map((p) => p.id))
    const porForma = new Map<string, number>()

    const somar = (formaBruta: string, valor: number) => {
      const rotulo = rotularFormaPagamento(formaBruta)
      porForma.set(rotulo, (porForma.get(rotulo) ?? 0) + valor)
    }

    for (const pg of dados.pagamentos) {
      if (!paidIds.has(pg.pedido_id)) continue
      somar(pg.forma_pagamento ?? 'outros', Number(pg.valor ?? 0))
    }

    const pedidosComPagamento = new Set(dados.pagamentos.map((pg) => pg.pedido_id))
    for (const p of dados.pedidos) {
      if (pedidosComPagamento.has(p.id)) continue
      somar(
        (p.forma_pagamento ?? (p.pagamento_online ? 'online' : 'outros')).toString(),
        Number(p.total ?? 0),
      )
    }

    for (const m of dados.movimentacoes) {
      if (!ehEntradaManual(m)) continue
      somar(m.forma_pagamento ?? 'outros', Number(m.valor ?? 0))
    }

    return Array.from(porForma.entries())
      .sort(([, a], [, b]) => b - a)
      .map(([nome, valor], i) => ({
        nome,
        valor,
        cor: CORES_GRAFICOS.paleta[i % CORES_GRAFICOS.paleta.length],
      }))
  }, [dados.pedidos, dados.pagamentos, dados.movimentacoes])

  const refetch = useCallback(() => carregarDados(filtro), [carregarDados, filtro])

  const adicionarMovimentacao = useCallback(
    async (entrada: {
      tipo: TipoMovimentacao
      valor: number
      descricao?: string | null
      categoria_id?: string | null
      funcionario_id?: string | null
      forma_pagamento?: string | null
      data?: string
    }) => {
      const { data: caixaAberto } = await supabase
        .from('caixas')
        .select('id')
        .eq('status', 'aberto')
        .order('data_abertura', { ascending: false })
        .limit(1)
        .maybeSingle()

      const payload = {
        tipo: entrada.tipo,
        valor: entrada.valor,
        descricao: entrada.descricao ?? null,
        categoria_id: entrada.categoria_id ?? null,
        funcionario_id: entrada.funcionario_id ?? null,
        forma_pagamento: entrada.forma_pagamento ?? null,
        caixa_id: caixaAberto?.id ?? null,
        created_at: entrada.data ?? new Date().toISOString(),
      }

      const { error } = await supabase.from('movimentacoes_caixa').insert(payload)
      if (error) {
        toast.error('Não foi possível salvar a movimentação. ' + error.message)
        throw error
      }
      toast.success(entrada.tipo === 'entrada' ? 'Receita lançada' : 'Despesa lançada')
      await carregarDados(filtro)
    },
    [carregarDados, filtro],
  )

  const atualizarMovimentacao = useCallback(
    async (
      id: string,
      entrada: {
        tipo: TipoMovimentacao
        valor: number
        descricao?: string | null
        categoria_id?: string | null
        forma_pagamento?: string | null
        data?: string
      },
    ) => {
      const payload: Record<string, unknown> = {
        tipo: entrada.tipo,
        valor: entrada.valor,
        descricao: entrada.descricao ?? null,
        categoria_id: entrada.categoria_id ?? null,
        forma_pagamento: entrada.forma_pagamento ?? null,
      }
      if (entrada.data) payload.created_at = entrada.data

      const { error } = await supabase.from('movimentacoes_caixa').update(payload).eq('id', id)
      if (error) {
        toast.error('Não foi possível atualizar. ' + error.message)
        throw error
      }
      toast.success('Lançamento atualizado')
      await carregarDados(filtro)
    },
    [carregarDados, filtro],
  )

  const removerMovimentacao = useCallback(
    async (id: string) => {
      const { error } = await supabase.from('movimentacoes_caixa').delete().eq('id', id)
      if (error) {
        toast.error('Não foi possível excluir. ' + error.message)
        throw error
      }
      toast.success('Lançamento removido')
      await carregarDados(filtro)
    },
    [carregarDados, filtro],
  )

  return {
    carregando,
    erro,
    erroLucro,
    resumo,
    resumoLucro,
    lucroProdutos: dados.lucroProdutos,
    fluxoCaixa,
    composicaoReceita,
    resumoMensal: dados.resumoMensal,
    movimentacoes: dados.movimentacoes,
    pagamentos: dados.pagamentos,
    pedidos: dados.pedidos,
    pedidosNaoPagos: dados.pedidosNaoPagos,
    crediarios: dados.crediarios,
    categorias,
    funcionarios,
    refetch,
    adicionarMovimentacao,
    atualizarMovimentacao,
    removerMovimentacao,
  }
}

function construirFluxoCaixa(
  filtro: FiltroFinancas,
  pedidos: PedidoFinanceiro[],
  movs: MovimentacaoCaixa[],
): PontoFluxoCaixa[] {
  const inicio = new Date(filtro.inicio)
  const fim = new Date(filtro.fim)
  const dias = Math.ceil((fim.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24)) + 1
  const agregarPorMes = dias > 60

  const buckets = new Map<string, PontoFluxoCaixa>()
  const fmtRotulo = new Intl.DateTimeFormat(
    'pt-BR',
    agregarPorMes ? { month: 'short' } : { day: '2-digit', month: '2-digit' },
  )

  const chaveMes = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

  if (agregarPorMes) {
    const cur = new Date(inicio.getFullYear(), inicio.getMonth(), 1)
    const limite = new Date(fim.getFullYear(), fim.getMonth(), 1)
    while (cur <= limite) {
      const k = chaveMes(cur)
      buckets.set(k, {
        data: k,
        rotulo: fmtRotulo.format(cur).replace('.', ''),
        receita: 0,
        despesa: 0,
        lucro: 0,
      })
      cur.setMonth(cur.getMonth() + 1)
    }
  } else {
    const cur = new Date(inicio)
    cur.setHours(12, 0, 0, 0)
    const limite = new Date(fim)
    limite.setHours(12, 0, 0, 0)
    while (cur <= limite) {
      const k = chaveDiaTrabalho(cur)
      if (!buckets.has(k)) {
        const ref = obterDiaTrabalhoReferencia(cur)
        buckets.set(k, { data: k, rotulo: fmtRotulo.format(ref), receita: 0, despesa: 0, lucro: 0 })
      }
      cur.setDate(cur.getDate() + 1)
    }
  }

  for (const p of pedidos) {
    const d = new Date(p.created_at)
    const k = agregarPorMes ? chaveMes(d) : chaveDiaTrabalho(d)
    const b = buckets.get(k)
    if (b) b.receita += Number(p.total ?? 0)
  }
  for (const m of movs) {
    const d = new Date(m.created_at)
    const k = agregarPorMes ? chaveMes(d) : chaveDiaTrabalho(d)
    const b = buckets.get(k)
    if (!b) continue
    if (ehEntradaManual(m)) b.receita += Number(m.valor ?? 0)
    else if (ehSaida(m)) b.despesa += Number(m.valor ?? 0)
  }
  const lista = Array.from(buckets.values())
  for (const b of lista) {
    b.lucro = b.receita - b.despesa
  }
  return lista
}

function construirResumoMensal(
  pedidos: { total: number; created_at: string }[],
  movs: { tipo: TipoMovimentacao; valor: number; created_at: string; pedido_id: string | null }[],
  fim: Date,
): ResumoMensal[] {
  const buckets = new Map<string, ResumoMensal>()
  const fmtMes = new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit' })

  for (let i = 11; i >= 0; i--) {
    const d = new Date(fim.getFullYear(), fim.getMonth() - i, 1)
    const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const rotulo = fmtMes.format(d).replace('.', '').replace(' de ', '/')
    buckets.set(chave, { chave, rotulo, receita: 0, despesa: 0, lucro: 0, pedidos: 0 })
  }

  for (const p of pedidos) {
    const d = new Date(p.created_at)
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const b = buckets.get(k)
    if (b) {
      b.receita += Number(p.total ?? 0)
      b.pedidos += 1
    }
  }
  for (const m of movs) {
    const d = new Date(m.created_at)
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const b = buckets.get(k)
    if (!b) continue
    if (ehEntradaManual(m)) b.receita += Number(m.valor ?? 0)
    else if (ehSaida(m)) b.despesa += Number(m.valor ?? 0)
  }
  const lista = Array.from(buckets.values())
  for (const b of lista) {
    b.lucro = b.receita - b.despesa
  }
  return lista
}
