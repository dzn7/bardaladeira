'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { 
  Funcionario, CategoriaCaixa, Caixa, MovimentacaoCaixa, 
  EstatisticasCaixa, EstatisticasPedidosDia, NotificacaoCaixa 
} from '@/lib/tipos-caixa'
import { calcularPeriodoDiaTrabalho, obterDiaTrabalhoReferencia } from '@/lib/utils'
import { obterDataInicioAnoAtual } from '@/lib/filtros-ano'
import {
  type CaixaAutomacaoConfig,
  DEFAULT_CAIXA_AUTOMACAO,
  getZonedDateKey,
  getZonedMinutes,
  getZonedWeekday,
  isDayActive,
  isWithinOpenWindow,
  normalizeAutomacaoConfig,
  parseHorario,
} from '@/lib/caixa-automacao'
import {
  calcularSaldoGaveta,
  montarFechamentoFormas,
  resumoPorForma,
  type ResumoFormasCaixa,
} from '@/lib/caixa-gaveta'

// ============================================================================
// TIPOS
// ============================================================================

export type PedidoDia = {
  id: string
  nome_cliente: string
  total: number
  forma_pagamento: string
  status: string
  tipo_entrega?: string
  created_at: string
  sincronizado: boolean
}

type ModoAberturaCaixa = 'manual' | 'pedidos' | 'saldo_atual'

// Mapeamento de formas de pagamento para categorias
const MAPA_CATEGORIAS_PAGAMENTO: Record<string, string> = {
  'Dinheiro': 'Pedido - Dinheiro',
  'PIX': 'Pedido - PIX',
  'Cartão de Débito': 'Pedido - Cartão Débito',
  'Cartão de Crédito': 'Pedido - Cartão Crédito',
  'Cartão Débito': 'Pedido - Cartão Débito',
  'Cartão Crédito': 'Pedido - Cartão Crédito',
  'Espécie': 'Pedido - Dinheiro'
}

const STATUS_PEDIDO_IGNORAR_CAIXA = new Set(['cancelado', 'aguardando_pagamento'])

const ESTATISTICAS_VAZIAS: EstatisticasCaixa = {
  saldoAtual: 0,
  totalEntradas: 0,
  totalSaidas: 0,
  quantidadeMovimentacoes: 0,
  saldoGaveta: 0,
  esperadoDinheiro: 0,
}

const RESUMO_FORMAS_VAZIO: ResumoFormasCaixa = {
  dinheiro: 0,
  pix: 0,
  cartao: 0,
  outros: 0,
}


const COLUNAS_FUNCIONARIO = 'id, nome, cargo, ativo'
const COLUNAS_CATEGORIA_CAIXA = 'id, nome, tipo, cor, icone, ativo, ordem'
const COLUNAS_CAIXA =
  'id, data_abertura, data_fechamento, valor_abertura, valor_fechamento, total_entradas, total_saidas, saldo_esperado, diferenca, responsavel_abertura, responsavel_fechamento, observacoes, status, fechamento_formas'
const COLUNAS_AUTOMACAO_CAIXA =
  'id, ativo, timezone, horario_abertura, horario_fechamento, dias_ativos, responsavel_padrao, valor_abertura_padrao, auto_sincronizar_pedidos, fechar_com_saldo_esperado, ultimo_dia_abertura, ultimo_dia_fechamento'
const COLUNAS_MOVIMENTACAO =
  'id, caixa_id, categoria_id, funcionario_id, tipo, valor, descricao, forma_pagamento, pedido_id, created_at, categoria:categorias_caixa(id, nome, tipo, cor, icone, ativo, ordem), funcionario:funcionarios(id, nome, cargo, ativo)'

// ============================================================================
// HOOK PRINCIPAL
// ============================================================================

export function useCaixa() {
  // Estados principais
  const [caixaAtual, setCaixaAtual] = useState<Caixa | null>(null)
  const [movimentacoes, setMovimentacoes] = useState<MovimentacaoCaixa[]>([])
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([])
  const [categorias, setCategorias] = useState<CategoriaCaixa[]>([])
  const [historicoCaixas, setHistoricoCaixas] = useState<Caixa[]>([])
  const [pedidosDia, setPedidosDia] = useState<PedidoDia[]>([])
  const [pedidosHoje, setPedidosHoje] = useState<PedidoDia[]>([])
  const [carregando, setCarregando] = useState(true)
  const [sincronizando, setSincronizando] = useState(false)
  const [automacaoCaixa, setAutomacaoCaixa] = useState<CaixaAutomacaoConfig | null>(null)
  const [salvandoAutomacaoCaixa, setSalvandoAutomacaoCaixa] = useState(false)
  const [executandoAutomacaoCaixa, setExecutandoAutomacaoCaixa] = useState(false)
  
  const [estatisticas, setEstatisticas] = useState<EstatisticasCaixa>({
    saldoAtual: 0,
    totalEntradas: 0,
    totalSaidas: 0,
    quantidadeMovimentacoes: 0,
    saldoGaveta: 0,
    esperadoDinheiro: 0,
  })
  const [resumoFormas, setResumoFormas] = useState<ResumoFormasCaixa>({
    dinheiro: 0,
    pix: 0,
    cartao: 0,
    outros: 0,
  })
  
  const [estatisticasPedidos, setEstatisticasPedidos] = useState<EstatisticasPedidosDia>({
    entregas: { quantidade: 0, total: 0 },
    retiradas: { quantidade: 0, total: 0 },
    local: { quantidade: 0, total: 0 },
    totalPedidos: 0,
    totalFaturamento: 0
  })
  
  const [notificacao, setNotificacao] = useState<NotificacaoCaixa>({
    aberto: false, tipo: 'info', titulo: '', mensagem: ''
  })
  
  const [movimentacoesOrfas, setMovimentacoesOrfas] = useState<MovimentacaoCaixa[]>([])
  
  // Refs para evitar closures desatualizadas no realtime
  const canalRealtimeRef = useRef<RealtimeChannel | null>(null)
  const caixaAtualRef = useRef<Caixa | null>(null)
  const categoriasRef = useRef<CategoriaCaixa[]>([])
  const sincronizandoRef = useRef(false)
  const automacaoCaixaRef = useRef<CaixaAutomacaoConfig | null>(null)
  const estatisticasRef = useRef<EstatisticasCaixa>(estatisticas)
  const executandoAutomacaoCaixaRef = useRef(false)
  
  // Manter refs sincronizadas com estados
  useEffect(() => {
    caixaAtualRef.current = caixaAtual
  }, [caixaAtual])
  
  useEffect(() => {
    categoriasRef.current = categorias
  }, [categorias])
  
  useEffect(() => {
    sincronizandoRef.current = sincronizando
  }, [sincronizando])

  useEffect(() => {
    automacaoCaixaRef.current = automacaoCaixa
  }, [automacaoCaixa])

  useEffect(() => {
    estatisticasRef.current = estatisticas
  }, [estatisticas])

  useEffect(() => {
    executandoAutomacaoCaixaRef.current = executandoAutomacaoCaixa
  }, [executandoAutomacaoCaixa])

  // ==========================================================================
  // FUNÇÕES DE NOTIFICAÇÃO
  // ==========================================================================
  
  const mostrarNotificacao = useCallback((
    tipo: NotificacaoCaixa['tipo'], 
    titulo: string, 
    mensagem: string, 
    onConfirmar?: () => void
  ) => {
    setNotificacao({ aberto: true, tipo, titulo, mensagem, onConfirmar })
  }, [])

  const fecharNotificacao = useCallback(() => {
    setNotificacao(prev => ({ ...prev, aberto: false }))
  }, [])

  // ==========================================================================
  // AUTOMAÇÃO DE CAIXA (TIMEZONE + UTC)
  // ==========================================================================

  const carregarAutomacaoCaixa = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('caixa_automacao_config')
        .select(COLUNAS_AUTOMACAO_CAIXA)
        .eq('singleton', true)
        .limit(1)
        .maybeSingle()

      if (error) {
        console.error('Erro ao carregar configuração de automação do caixa:', error)
        return null
      }

      if (!data) {
        const base = normalizeAutomacaoConfig(DEFAULT_CAIXA_AUTOMACAO)
        const { data: criado, error: erroCriar } = await supabase
          .from('caixa_automacao_config')
          .upsert(
            {
              singleton: true,
              ...base,
            },
            { onConflict: 'singleton' }
          )
          .select(COLUNAS_AUTOMACAO_CAIXA)
          .single()

        if (erroCriar || !criado) {
          if (erroCriar) {
            console.error('Erro ao criar configuração padrão de automação:', erroCriar)
          }
          return null
        }

        const normalizadoCriado = normalizeAutomacaoConfig(criado)
        const configCriada: CaixaAutomacaoConfig = {
          id: criado.id,
          ...normalizadoCriado,
        }
        setAutomacaoCaixa(configCriada)
        return configCriada
      }

      const normalizado = normalizeAutomacaoConfig(data)
      const config: CaixaAutomacaoConfig = {
        id: data.id,
        ...normalizado,
      }

      setAutomacaoCaixa(config)
      return config
    } catch (erro) {
      console.error('Erro inesperado ao carregar automação do caixa:', erro)
      return null
    }
  }, [])

  const salvarAutomacaoCaixa = useCallback(async (patch: Partial<Omit<CaixaAutomacaoConfig, 'id'>>) => {
    setSalvandoAutomacaoCaixa(true)
    try {
      const base = normalizeAutomacaoConfig({
        ...(automacaoCaixa || DEFAULT_CAIXA_AUTOMACAO),
        ...patch,
      })

      const { data, error } = await supabase
        .from('caixa_automacao_config')
        .upsert(
          {
            id: automacaoCaixa?.id,
            singleton: true,
            ...base,
          },
          { onConflict: 'singleton' }
        )
        .select(COLUNAS_AUTOMACAO_CAIXA)
        .single()

      if (error || !data) {
        if (error) {
          console.error('Erro ao salvar configuração de automação do caixa:', error)
        }
        mostrarNotificacao('erro', 'Erro', 'Não foi possível salvar a agenda automática do caixa.')
        return false
      }

      const normalizado = normalizeAutomacaoConfig(data)
      setAutomacaoCaixa({
        id: data.id,
        ...normalizado,
      })
      return true
    } catch (erro) {
      console.error('Erro inesperado ao salvar automação do caixa:', erro)
      mostrarNotificacao('erro', 'Erro', 'Falha ao atualizar agenda automática do caixa.')
      return false
    } finally {
      setSalvandoAutomacaoCaixa(false)
    }
  }, [automacaoCaixa, mostrarNotificacao])

  const atualizarMarcadorAutomacao = useCallback(async (
    patch: Partial<Pick<CaixaAutomacaoConfig, 'ultimo_dia_abertura' | 'ultimo_dia_fechamento'>>
  ) => {
    const config = automacaoCaixaRef.current
    if (!config) return

    try {
      const { data, error } = await supabase
        .from('caixa_automacao_config')
        .update(patch)
        .eq('id', config.id)
        .select(COLUNAS_AUTOMACAO_CAIXA)
        .single()

      if (error || !data) {
        if (error) {
          console.error('Erro ao atualizar marcador da automação do caixa:', error)
        }
        return
      }

      setAutomacaoCaixa({
        id: data.id,
        ...normalizeAutomacaoConfig(data),
      })
    } catch (erro) {
      console.error('Erro inesperado ao atualizar marcador da automação:', erro)
    }
  }, [])

  // ==========================================================================
  // FUNÇÕES DE CÁLCULO
  // ==========================================================================

  const calcularEstatisticas = useCallback((movs: MovimentacaoCaixa[], caixa: Caixa | null) => {
    const totalEntradas = movs
      .filter(m => m.tipo === 'entrada')
      .reduce((acc, m) => acc + Number(m.valor || 0), 0)
    
    const totalSaidas = movs
      .filter(m => m.tipo === 'saida')
      .reduce((acc, m) => acc + Number(m.valor || 0), 0)
    
    const valorAbertura = Number(caixa?.valor_abertura || 0)
    const saldoAtual = valorAbertura + totalEntradas - totalSaidas
    const gaveta = calcularSaldoGaveta(caixa, movs)
    const resumo = resumoPorForma(movs)

    setResumoFormas(resumo)
    setEstatisticas({
      saldoAtual,
      totalEntradas,
      totalSaidas,
      quantidadeMovimentacoes: movs.length,
      saldoGaveta: gaveta.saldoGaveta,
      esperadoDinheiro: gaveta.esperadoDinheiro,
    })
  }, [])

  const calcularEstatisticasPedidos = useCallback((pedidos: PedidoDia[]) => {
    const stats: EstatisticasPedidosDia = {
      entregas: { quantidade: 0, total: 0 },
      retiradas: { quantidade: 0, total: 0 },
      local: { quantidade: 0, total: 0 },
      totalPedidos: 0,
      totalFaturamento: 0
    }

    for (const pedido of pedidos) {
      const tipo = (pedido.tipo_entrega || 'local').toLowerCase()
      const valor = Number(pedido.total) || 0

      if (tipo === 'entrega') {
        stats.entregas.quantidade++
        stats.entregas.total += valor
      } else if (tipo === 'retirada') {
        stats.retiradas.quantidade++
        stats.retiradas.total += valor
      } else {
        stats.local.quantidade++
        stats.local.total += valor
      }

      stats.totalPedidos++
      stats.totalFaturamento += valor
    }

    setEstatisticasPedidos(stats)
    return stats
  }, [])

  // ==========================================================================
  // FUNÇÕES DE CARREGAMENTO DE DADOS
  // ==========================================================================

  const carregarMovimentacoes = useCallback(async (caixaId: string, caixa: Caixa | null) => {
    if (!caixaId) return
    
    try {
      const { data, error } = await supabase
        .from('movimentacoes_caixa')
        .select(COLUNAS_MOVIMENTACAO)
        .eq('caixa_id', caixaId)
        .order('created_at', { ascending: false })
      
      if (error) {
        console.error('Erro ao carregar movimentações:', error)
        return
      }
      
      const movimentacoesValidas = (data || []) as unknown as MovimentacaoCaixa[]
      setMovimentacoes(movimentacoesValidas)
      calcularEstatisticas(movimentacoesValidas, caixa)
    } catch (erro) {
      console.error('Erro inesperado ao carregar movimentações:', erro)
    }
  }, [calcularEstatisticas])

  const carregarPedidosHoje = useCallback(async () => {
    try {
      // Obter o dia de trabalho atual (considera que após meia-noite até 10:00 ainda é o dia anterior)
      const agora = new Date()
      const diaTrabalhoAtual = obterDiaTrabalhoReferencia(agora)
      const { inicio, fim } = calcularPeriodoDiaTrabalho(diaTrabalhoAtual)
      
      // Se ainda não passou das 10:00, o fim é "agora"
      const fimEfetivo = agora < fim ? agora : fim
      
      const { data: pedidos } = await supabase
        .from('pedidos')
        .select('id, nome_cliente, total, forma_pagamento, status, tipo_entrega, created_at')
        .gte('created_at', inicio.toISOString())
        .lte('created_at', fimEfetivo.toISOString())
        .neq('status', 'cancelado')
        .neq('status', 'aguardando_pagamento')
        .order('created_at', { ascending: false })

      const pedidosFormatados = (pedidos || []).map(p => ({
        ...p,
        sincronizado: false
      }))

      setPedidosHoje(pedidosFormatados)
      return pedidosFormatados
    } catch (erro) {
      console.error('Erro ao carregar pedidos de hoje:', erro)
      return []
    }
  }, [])

  const carregarPedidosDia = useCallback(async (caixa: Caixa | null) => {
    if (!caixa) {
      setPedidosDia([])
      setEstatisticasPedidos({
        entregas: { quantidade: 0, total: 0 },
        retiradas: { quantidade: 0, total: 0 },
        local: { quantidade: 0, total: 0 },
        totalPedidos: 0,
        totalFaturamento: 0
      })
      return []
    }

    try {
      // Calcular o início do dia de trabalho (10h da manhã)
      // Se caixa foi aberto antes das 10h, considerar o dia anterior
      const dataAbertura = new Date(caixa.data_abertura)
      const inicioDiaTrabalho = new Date(dataAbertura)
      
      // Se abriu antes das 10h, o dia de trabalho começou no dia anterior às 10h
      if (dataAbertura.getHours() < 10) {
        inicioDiaTrabalho.setDate(inicioDiaTrabalho.getDate() - 1)
      }
      inicioDiaTrabalho.setHours(10, 0, 0, 0)
      
      // Fim do período: 10:00 do dia seguinte
      const fimDia = new Date(inicioDiaTrabalho)
      fimDia.setDate(fimDia.getDate() + 1)
      fimDia.setHours(10, 0, 0, 0)
      
      // Se o caixa ainda está aberto, usar a data atual como limite
      const agora = new Date()
      const limiteData = caixa.status === 'aberto' ? agora : (caixa.data_fechamento ? new Date(caixa.data_fechamento) : fimDia)

      // Buscar TODOS os pedidos do dia de trabalho (desde 10h, não apenas após abertura do caixa)
      const { data: pedidos } = await supabase
        .from('pedidos')
        .select('id, nome_cliente, total, forma_pagamento, status, tipo_entrega, created_at')
        .gte('created_at', inicioDiaTrabalho.toISOString())
        .lte('created_at', limiteData.toISOString())
        .neq('status', 'cancelado')
        .neq('status', 'aguardando_pagamento')
        .order('created_at', { ascending: false })

      // Buscar movimentações já sincronizadas com pedidos
      const { data: movsSincronizadas } = await supabase
        .from('movimentacoes_caixa')
        .select('pedido_id')
        .eq('caixa_id', caixa.id)
        .not('pedido_id', 'is', null)

      const pedidosSincronizados = new Set(movsSincronizadas?.map(m => m.pedido_id) || [])

      const pedidosComStatus = (pedidos || []).map(p => ({
        ...p,
        sincronizado: pedidosSincronizados.has(p.id)
      }))

      setPedidosDia(pedidosComStatus)
      
      // Calcular estatísticas por tipo de pedido
      calcularEstatisticasPedidos(pedidosComStatus)
      
      return pedidosComStatus
    } catch (erro) {
      console.error('Erro ao carregar pedidos:', erro)
      return []
    }
  }, [calcularEstatisticasPedidos])

  // Sincroniza pedidos pendentes (não sincronizados) silenciosamente
  // Esta função é chamada ao carregar o caixa para garantir que todos os pedidos estejam sincronizados
  const sincronizarPedidosPendentes = useCallback(async (caixa: Caixa) => {
    if (!caixa || caixa.status !== 'aberto') return
    
    try {
      // Calcular período do dia de trabalho
      const dataAbertura = new Date(caixa.data_abertura)
      const inicioDiaTrabalho = new Date(dataAbertura)
      
      if (dataAbertura.getHours() < 10) {
        inicioDiaTrabalho.setDate(inicioDiaTrabalho.getDate() - 1)
      }
      inicioDiaTrabalho.setHours(10, 0, 0, 0)
      
      const agora = new Date()

      // Buscar pedidos do período que não estão cancelados
      const { data: pedidosDoPeriodo } = await supabase
        .from('pedidos')
        .select('id, nome_cliente, total, forma_pagamento, status')
        .gte('created_at', inicioDiaTrabalho.toISOString())
        .lte('created_at', agora.toISOString())
        .neq('status', 'cancelado')
        .neq('status', 'aguardando_pagamento')

      if (!pedidosDoPeriodo || pedidosDoPeriodo.length === 0) return

      // Buscar movimentações já sincronizadas
      const { data: movsSincronizadas } = await supabase
        .from('movimentacoes_caixa')
        .select('pedido_id')
        .eq('caixa_id', caixa.id)
        .not('pedido_id', 'is', null)

      const pedidosSincronizados = new Set(movsSincronizadas?.map(m => m.pedido_id) || [])
      
      // Filtrar pedidos não sincronizados
      const pedidosNaoSincronizados = pedidosDoPeriodo.filter(p => !pedidosSincronizados.has(p.id))
      
      if (pedidosNaoSincronizados.length === 0) return

      console.log(`[Caixa] Sincronizando ${pedidosNaoSincronizados.length} pedido(s) pendente(s)...`)

      // Preparar movimentações para inserção em batch
      const movimentacoesParaInserir = pedidosNaoSincronizados.map(pedido => {
        const nomeCategoria = MAPA_CATEGORIAS_PAGAMENTO[pedido.forma_pagamento] || 'Vendas do Dia'
        const categoria = categoriasRef.current.find(c => c.nome === nomeCategoria) || 
                          categoriasRef.current.find(c => c.nome === 'Vendas do Dia')

        return {
          caixa_id: caixa.id,
          categoria_id: categoria?.id || null,
          tipo: 'entrada' as const,
          valor: Number(pedido.total) || 0,
          descricao: `Pedido de ${pedido.nome_cliente} - ${pedido.forma_pagamento}`,
          forma_pagamento: pedido.forma_pagamento,
          pedido_id: pedido.id
        }
      })

      // Inserir movimentações em batch (silenciosamente)
      if (movimentacoesParaInserir.length > 0) {
        const { error } = await supabase
          .from('movimentacoes_caixa')
          .insert(movimentacoesParaInserir)

        // Ignora erros de duplicata (já sincronizados por outro processo)
        if (error && error.code !== '23505') {
          console.error('[Caixa] Erro ao sincronizar pedidos pendentes:', error)
        } else {
          console.log(`[Caixa] ${movimentacoesParaInserir.length} pedido(s) sincronizado(s) automaticamente`)
        }
      }
    } catch (erro) {
      console.error('[Caixa] Erro ao sincronizar pedidos pendentes:', erro)
    }
  }, [])

  const carregarDados = useCallback(async () => {
    setCarregando(true)
    try {
      // Data de início do ano atual (2026+)
      const dataInicioAnoAtual = obterDataInicioAnoAtual()

      const [funcRes, catRes, caixaRes, histRes, automacaoRes] = await Promise.all([
        supabase.from('funcionarios').select(COLUNAS_FUNCIONARIO).eq('ativo', true).order('nome'),
        supabase.from('categorias_caixa').select(COLUNAS_CATEGORIA_CAIXA).eq('ativo', true).order('ordem'),
        supabase.from('caixas').select(COLUNAS_CAIXA).eq('status', 'aberto').order('data_abertura', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('caixas').select(COLUNAS_CAIXA).gte('data_abertura', dataInicioAnoAtual).order('data_abertura', { ascending: false }).limit(30),
        supabase.from('caixa_automacao_config').select(COLUNAS_AUTOMACAO_CAIXA).eq('singleton', true).limit(1).maybeSingle(),
      ])

      if (funcRes.data) setFuncionarios(funcRes.data as Funcionario[])
      if (catRes.data) setCategorias(catRes.data as CategoriaCaixa[])
      if (histRes.data) setHistoricoCaixas(histRes.data as Caixa[])
      if (automacaoRes.data) {
        setAutomacaoCaixa({
          id: automacaoRes.data.id,
          ...normalizeAutomacaoConfig(automacaoRes.data),
        })
      } else if (!automacaoRes.error) {
        await carregarAutomacaoCaixa()
      }

      // Sempre carregar pedidos de hoje
      await carregarPedidosHoje()

      if (caixaRes.data) {
        const caixaAberto = caixaRes.data as Caixa
        setCaixaAtual(caixaAberto)
        await carregarMovimentacoes(caixaAberto.id, caixaAberto)
        await carregarPedidosDia(caixaAberto)
        
        // Sincronizar pedidos não sincronizados ao carregar o caixa
        // Isso garante que pedidos criados enquanto o usuário estava offline sejam sincronizados
        await sincronizarPedidosPendentes(caixaAberto)
      } else {
        setCaixaAtual(null)
        setMovimentacoes([])
        setPedidosDia([])
        setEstatisticas(ESTATISTICAS_VAZIAS)
        setResumoFormas(RESUMO_FORMAS_VAZIO)
      }
    } catch (erro) {
      console.error('Erro ao carregar dados:', erro)
      mostrarNotificacao('erro', 'Erro', 'Não foi possível carregar os dados do caixa.')
    } finally {
      setCarregando(false)
    }
  }, [carregarAutomacaoCaixa, carregarMovimentacoes, carregarPedidosDia, carregarPedidosHoje, mostrarNotificacao, sincronizarPedidosPendentes])

  const abrirCaixa = async (
    valorAbertura: number, 
    responsavel: string, 
    dataReferencia?: Date,
    modoAbertura?: 'manual' | 'pedidos' | 'saldo_atual'
  ) => {
    try {
      // Se tiver data de referência, usar ela como data de abertura
      const dataAbertura = dataReferencia ? dataReferencia.toISOString() : new Date().toISOString()
      
      // Se modo for 'pedidos', o valor de abertura é 0 e os pedidos serão registrados como entradas
      // Isso evita duplicação: valor inicial = 0, pedidos = entradas
      const valorInicialReal = modoAbertura === 'pedidos' ? 0 : valorAbertura
      
      const { data, error } = await supabase.from('caixas').insert({
        data_abertura: dataAbertura,
        valor_abertura: valorInicialReal,
        responsavel_abertura: responsavel,
        status: 'aberto',
        total_entradas: 0,
        total_saidas: 0,
        saldo_esperado: valorInicialReal
      }).select().single()

      if (error) throw error

      setCaixaAtual(data)
      setMovimentacoes([])
      
      // Se abriu com pedidos, sincronizar os pedidos do período como movimentações
      if (modoAbertura === 'pedidos' && data) {
        // Buscar pedidos do período usando a função utilitária
        const dataRef = dataReferencia || new Date()
        const diaTrabalho = obterDiaTrabalhoReferencia(dataRef)
        const { inicio: inicioDia, fim: fimDia } = calcularPeriodoDiaTrabalho(diaTrabalho)

        const { data: pedidosDoPeriodo } = await supabase
          .from('pedidos')
          .select('id, nome_cliente, total, forma_pagamento, status')
          .gte('created_at', inicioDia.toISOString())
          .lte('created_at', fimDia.toISOString())
          .neq('status', 'cancelado')
          .neq('status', 'aguardando_pagamento')

        // Inserir todos os pedidos como movimentações em batch
        if (pedidosDoPeriodo && pedidosDoPeriodo.length > 0) {
          // Preparar todas as movimentações usando mapeamento centralizado
          const movimentacoesParaInserir = pedidosDoPeriodo.map(pedido => {
            const nomeCategoria = MAPA_CATEGORIAS_PAGAMENTO[pedido.forma_pagamento] || 'Vendas do Dia'
            const categoria = categoriasRef.current.find(c => c.nome === nomeCategoria) || 
                              categoriasRef.current.find(c => c.nome === 'Vendas do Dia')

            return {
              caixa_id: data.id,
              categoria_id: categoria?.id || null,
              tipo: 'entrada' as const,
              valor: Number(pedido.total) || 0,
              descricao: `Pedido de ${pedido.nome_cliente} - ${pedido.forma_pagamento}`,
              forma_pagamento: pedido.forma_pagamento,
              pedido_id: pedido.id
            }
          })

          // Inserir todas as movimentações de uma vez
          if (movimentacoesParaInserir.length > 0) {
            const { error: erroInsert } = await supabase
              .from('movimentacoes_caixa')
              .insert(movimentacoesParaInserir)
            
            if (erroInsert) {
              console.error('Erro ao inserir movimentações na abertura:', erroInsert)
            }
          }
        }
        
        // Quando abre com pedidos, o total de entradas é o valor dos pedidos
        const totalEntradasPedidos = pedidosDoPeriodo?.reduce((acc, p) => acc + Number(p.total), 0) || 0
        setEstatisticas({
          saldoAtual: totalEntradasPedidos,
          totalEntradas: totalEntradasPedidos,
          totalSaidas: 0,
          quantidadeMovimentacoes: pedidosDoPeriodo?.length || 0,
          saldoGaveta: 0,
          esperadoDinheiro: 0,
        })
      } else {
        setEstatisticas({
          saldoAtual: valorAbertura,
          totalEntradas: 0,
          totalSaidas: 0,
          quantidadeMovimentacoes: 0,
          saldoGaveta: valorAbertura,
          esperadoDinheiro: valorAbertura,
        })
      }
      
      const mensagem = dataReferencia 
        ? `Caixa aberto para ${dataReferencia.toLocaleDateString('pt-BR')}!`
        : 'O caixa foi aberto com sucesso!'
      mostrarNotificacao('sucesso', 'Caixa Aberto', mensagem)
      
      // Recarregar dados
      await carregarDados()
      
      return true
    } catch (erro: unknown) {
      console.error('Erro ao abrir caixa:', erro)

      // Caixa já aberto (unique constraint violation)
      const codigoErro = erro && typeof erro === 'object' && 'code' in erro ? (erro as { code: string }).code : null
      if (codigoErro === '23505') {
        mostrarNotificacao('aviso', 'Caixa já aberto', 'Já existe um caixa aberto. Carregando dados...')
        await carregarDados()
        return false
      }

      mostrarNotificacao('erro', 'Erro', 'Não foi possível abrir o caixa.')
      return false
    }
  }

  const fecharCaixa = async (
    contadoDinheiro: number,
    responsavel: string,
    observacoes?: string,
  ) => {
    if (!caixaAtual) return false

    const gaveta = calcularSaldoGaveta(caixaAtual, movimentacoes)
    const resumo = resumoPorForma(movimentacoes)
    const esperadoDinheiro = gaveta.esperadoDinheiro
    const diferenca = contadoDinheiro - esperadoDinheiro
    const fechamentoFormas = montarFechamentoFormas(
      resumo,
      contadoDinheiro,
      Number(caixaAtual.valor_abertura || 0),
    )

    try {
      const { error } = await supabase.from('caixas').update({
        data_fechamento: new Date().toISOString(),
        valor_fechamento: contadoDinheiro,
        total_entradas: estatisticas.totalEntradas,
        total_saidas: estatisticas.totalSaidas,
        saldo_esperado: esperadoDinheiro,
        diferenca,
        responsavel_fechamento: responsavel,
        observacoes: observacoes || null,
        status: 'fechado',
        fechamento_formas: fechamentoFormas,
      }).eq('id', caixaAtual.id)

      if (error) throw error

      setCaixaAtual(null)
      setMovimentacoes([])
      setEstatisticas(ESTATISTICAS_VAZIAS)
      setResumoFormas(RESUMO_FORMAS_VAZIO)
      
      const msgDiferenca = diferenca !== 0 ? ` Diferença (dinheiro): R$ ${diferenca.toFixed(2)}` : ''
      mostrarNotificacao('sucesso', 'Caixa Fechado', `Caixa fechado com sucesso!${msgDiferenca}`)
      carregarDados()
      return true
    } catch (erro) {
      console.error('Erro ao fechar caixa:', erro)
      mostrarNotificacao('erro', 'Erro', 'Não foi possível fechar o caixa.')
      return false
    }
  }

  // Reabrir caixa fechado para edição
  const reabrirCaixa = async (caixaId: string) => {
    try {
      // Verificar se já existe um caixa aberto
      const { data: caixaAberto } = await supabase
        .from('caixas')
        .select('id')
        .eq('status', 'aberto')
        .maybeSingle()

      if (caixaAberto) {
        mostrarNotificacao('aviso', 'Caixa já aberto', 'Já existe um caixa aberto. Feche-o antes de reabrir outro.')
        return false
      }

      // Buscar dados do caixa a ser reaberto
      const { data: caixaParaReabrir, error: erroConsulta } = await supabase
        .from('caixas')
        .select(COLUNAS_CAIXA)
        .eq('id', caixaId)
        .single()

      if (erroConsulta || !caixaParaReabrir) {
        mostrarNotificacao('erro', 'Erro', 'Caixa não encontrado.')
        return false
      }

      if (caixaParaReabrir.status === 'aberto') {
        mostrarNotificacao('info', 'Já aberto', 'Este caixa já está aberto.')
        return false
      }

      // Reabrir o caixa (limpar dados de fechamento)
      const { error } = await supabase
        .from('caixas')
        .update({
          status: 'aberto',
          data_fechamento: null,
          valor_fechamento: null,
          responsavel_fechamento: null,
          diferenca: null,
          observacoes: null,
          fechamento_formas: null,
        })
        .eq('id', caixaId)

      if (error) throw error

      mostrarNotificacao('sucesso', 'Caixa Reaberto', 'Caixa reaberto com sucesso! Agora você pode editar e adicionar movimentações.')
      await carregarDados()
      return true
    } catch (erro) {
      console.error('Erro ao reabrir caixa:', erro)
      mostrarNotificacao('erro', 'Erro', 'Não foi possível reabrir o caixa.')
      return false
    }
  }

  const registrarMovimentacao = async (
    tipo: 'entrada' | 'saida',
    valor: number,
    categoriaId: string,
    funcionarioId?: string,
    descricao?: string,
    formaPagamento?: string
  ) => {
    if (!caixaAtual) {
      mostrarNotificacao('aviso', 'Caixa fechado', 'Abra o caixa antes de registrar movimentações.')
      return false
    }

    try {
      const { error } = await supabase.from('movimentacoes_caixa').insert({
        caixa_id: caixaAtual.id,
        categoria_id: categoriaId || null,
        funcionario_id: funcionarioId || null,
        tipo,
        valor,
        descricao: descricao || null,
        forma_pagamento: formaPagamento || null
      })

      if (error) throw error

      const tipoTexto = tipo === 'entrada' ? 'Entrada' : 'Saída'
      mostrarNotificacao('sucesso', 'Registrado', `${tipoTexto} de R$ ${valor.toFixed(2)} registrada!`)
      await carregarMovimentacoes(caixaAtual.id, caixaAtual)
      return true
    } catch (erro) {
      console.error('Erro ao registrar movimentação:', erro)
      mostrarNotificacao('erro', 'Erro', 'Não foi possível registrar a movimentação.')
      return false
    }
  }

  const registrarSangria = async (valor: number, descricao?: string, funcionarioId?: string) => {
    const categoria = categoriasRef.current.find((c) => c.nome === 'Sangria')
    if (!categoria) {
      mostrarNotificacao('erro', 'Erro', 'Categoria Sangria não encontrada. Atualize o cadastro.')
      return false
    }
    return registrarMovimentacao(
      'saida',
      valor,
      categoria.id,
      funcionarioId,
      descricao || 'Sangria de caixa',
      'Dinheiro',
    )
  }

  const registrarSuprimento = async (valor: number, descricao?: string, funcionarioId?: string) => {
    const categoria = categoriasRef.current.find((c) => c.nome === 'Suprimento')
    if (!categoria) {
      mostrarNotificacao('erro', 'Erro', 'Categoria Suprimento não encontrada. Atualize o cadastro.')
      return false
    }
    return registrarMovimentacao(
      'entrada',
      valor,
      categoria.id,
      funcionarioId,
      descricao || 'Suprimento de caixa',
      'Dinheiro',
    )
  }

  const excluirMovimentacao = async (movimentacaoId: string) => {
    try {
      const { error } = await supabase.from('movimentacoes_caixa').delete().eq('id', movimentacaoId)
      if (error) throw error

      if (caixaAtual) {
        await Promise.all([
          carregarMovimentacoes(caixaAtual.id, caixaAtual),
          carregarPedidosDia(caixaAtual)
        ])
      }
      mostrarNotificacao('sucesso', 'Excluído', 'Movimentação excluída com sucesso!')
      return true
    } catch (erro) {
      console.error('Erro ao excluir movimentação:', erro)
      mostrarNotificacao('erro', 'Erro', 'Não foi possível excluir a movimentação.')
      return false
    }
  }

  const excluirCaixa = async (caixaId: string) => {
    try {
      // Primeiro excluir as movimentações do caixa
      const { error: erroMovimentacoes } = await supabase.from('movimentacoes_caixa').delete().eq('caixa_id', caixaId)
      if (erroMovimentacoes) throw erroMovimentacoes
      
      // Depois excluir o caixa
      const { error } = await supabase.from('caixas').delete().eq('id', caixaId)
      if (error) throw error

      // Atualizar histórico
      setHistoricoCaixas(prev => prev.filter(c => c.id !== caixaId))
      mostrarNotificacao('sucesso', 'Excluído', 'Caixa excluído com sucesso!')
      return true
    } catch (erro) {
      console.error('Erro ao excluir caixa:', erro)
      mostrarNotificacao('erro', 'Erro', 'Não foi possível excluir o caixa.')
      return false
    }
  }

  const sincronizarPedido = async (
    pedidoId: string, 
    pedidoTotal: number, 
    formaPagamento: string, 
    nomeCliente: string,
    silencioso: boolean = false
  ) => {
    if (!caixaAtual) {
      if (!silencioso) mostrarNotificacao('aviso', 'Caixa fechado', 'Abra o caixa antes de sincronizar pedidos.')
      return false
    }

    // Usar mapeamento centralizado de categorias
    const nomeCategoria = MAPA_CATEGORIAS_PAGAMENTO[formaPagamento] || 'Vendas do Dia'
    const categoria = categoriasRef.current.find(c => c.nome === nomeCategoria) || 
                      categoriasRef.current.find(c => c.nome === 'Vendas do Dia')

    try {
      const { error } = await supabase.from('movimentacoes_caixa').insert({
        caixa_id: caixaAtual.id,
        categoria_id: categoria?.id || null,
        tipo: 'entrada',
        valor: pedidoTotal,
        descricao: `Pedido de ${nomeCliente} - ${formaPagamento}`,
        forma_pagamento: formaPagamento,
        pedido_id: pedidoId
      })

      if (error) throw error

      // Atualizar dados silenciosamente
      await Promise.all([
        carregarMovimentacoes(caixaAtual.id, caixaAtual),
        carregarPedidosDia(caixaAtual)
      ])
      return true
    } catch (erro) {
      console.error('Erro ao sincronizar pedido:', erro)
      if (!silencioso) mostrarNotificacao('erro', 'Erro', 'Não foi possível sincronizar o pedido.')
      return false
    }
  }

  // ==========================================================================
  // SINCRONIZAÇÃO EM BATCH (mais robusta e eficiente)
  // ==========================================================================
  
  const sincronizarTodosPedidos = async () => {
    if (!caixaAtual) {
      mostrarNotificacao('aviso', 'Caixa fechado', 'Abra o caixa antes de sincronizar pedidos.')
      return false
    }

    // Evitar sincronizações simultâneas
    if (sincronizandoRef.current) {
      mostrarNotificacao('info', 'Aguarde', 'Sincronização em andamento...')
      return false
    }

    setSincronizando(true)

    try {
      // IMPORTANTE: Buscar pedidos DIRETAMENTE do banco para garantir valores atualizados
      // Não usar o estado pedidosDia que pode estar desatualizado
      const dataAbertura = new Date(caixaAtual.data_abertura)
      const inicioDiaTrabalho = new Date(dataAbertura)
      
      if (dataAbertura.getHours() < 10) {
        inicioDiaTrabalho.setDate(inicioDiaTrabalho.getDate() - 1)
      }
      inicioDiaTrabalho.setHours(10, 0, 0, 0)
      
      const fimDia = new Date(inicioDiaTrabalho)
      fimDia.setDate(fimDia.getDate() + 1)
      fimDia.setHours(10, 0, 0, 0)
      
      const agora = new Date()
      const limiteData = caixaAtual.status === 'aberto' ? agora : (caixaAtual.data_fechamento ? new Date(caixaAtual.data_fechamento) : fimDia)

      // Buscar pedidos atualizados do banco
      const { data: pedidosFrescos } = await supabase
        .from('pedidos')
        .select('id, nome_cliente, total, forma_pagamento, status, tipo_entrega, created_at')
        .gte('created_at', inicioDiaTrabalho.toISOString())
        .lte('created_at', limiteData.toISOString())
        .neq('status', 'cancelado')
        .neq('status', 'aguardando_pagamento')
        .order('created_at', { ascending: false })

      // Buscar movimentações já sincronizadas
      const { data: movsSincronizadas } = await supabase
        .from('movimentacoes_caixa')
        .select('pedido_id')
        .eq('caixa_id', caixaAtual.id)
        .not('pedido_id', 'is', null)

      const pedidosSincronizados = new Set(movsSincronizadas?.map(m => m.pedido_id) || [])
      
      // Filtrar pedidos não sincronizados
      const pedidosNaoSincronizados = (pedidosFrescos || []).filter(p => !pedidosSincronizados.has(p.id))
      
      if (pedidosNaoSincronizados.length === 0) {
        mostrarNotificacao('info', 'Nada a sincronizar', 'Todos os pedidos já estão no caixa.')
        return true
      }

      // 1. Preparar todas as movimentações para inserção em batch
      const movimentacoesParaInserir = pedidosNaoSincronizados.map(pedido => {
        const nomeCategoria = MAPA_CATEGORIAS_PAGAMENTO[pedido.forma_pagamento] || 'Vendas do Dia'
        const categoria = categoriasRef.current.find(c => c.nome === nomeCategoria) || 
                          categoriasRef.current.find(c => c.nome === 'Vendas do Dia')

        return {
          caixa_id: caixaAtual.id,
          categoria_id: categoria?.id || null,
          tipo: 'entrada' as const,
          valor: Number(pedido.total) || 0,
          descricao: `Pedido de ${pedido.nome_cliente} - ${pedido.forma_pagamento}`,
          forma_pagamento: pedido.forma_pagamento,
          pedido_id: pedido.id
        }
      })

      // 2. Inserir todas as movimentações de uma vez
      let sucesso = 0
      if (movimentacoesParaInserir.length > 0) {
        const { data: inseridos, error: erroInsert } = await supabase
          .from('movimentacoes_caixa')
          .insert(movimentacoesParaInserir)
          .select('id')
        
        if (erroInsert) {
          // Se for erro de duplicata (constraint violation), tentar um por um
          if (erroInsert.code === '23505') {
            console.warn('Algumas movimentações já existiam, sincronizando individualmente...')
            for (const mov of movimentacoesParaInserir) {
              try {
                await supabase.from('movimentacoes_caixa').insert(mov)
                sucesso++
              } catch {
                // Ignora duplicatas silenciosamente
              }
            }
          } else {
            throw erroInsert
          }
        } else {
          sucesso = inseridos?.length || movimentacoesParaInserir.length
        }
      }

      // 3. Recarregar dados
      await Promise.all([
        carregarMovimentacoes(caixaAtual.id, caixaAtual),
        carregarPedidosDia(caixaAtual)
      ])

      // 4. Notificação final
      if (sucesso > 0) {
        mostrarNotificacao('sucesso', 'Sincronização completa', `${sucesso} pedido(s) sincronizado(s) com o caixa`)
      }

      return sucesso === movimentacoesParaInserir.length
    } catch (erro) {
      console.error('Erro ao sincronizar pedidos:', erro)
      mostrarNotificacao('erro', 'Erro', 'Não foi possível sincronizar os pedidos.')
      return false
    } finally {
      setSincronizando(false)
    }
  }

  // Função para verificar movimentações órfãs (pedidos deletados/cancelados)
  const verificarMovimentacoesOrfas = useCallback(async () => {
    if (!caixaAtual) {
      setMovimentacoesOrfas([])
      return []
    }

    try {
      // Buscar movimentações que têm pedido_id
      const movsComPedido = movimentacoes.filter(m => m.pedido_id)
      
      if (movsComPedido.length === 0) {
        setMovimentacoesOrfas([])
        return []
      }

      // Buscar os pedidos correspondentes
      const pedidoIds = movsComPedido.map(m => m.pedido_id)
      const { data: pedidosExistentes } = await supabase
        .from('pedidos')
        .select('id, status')
        .in('id', pedidoIds)

      const pedidosMap = new Map(pedidosExistentes?.map(p => [p.id, p]) || [])
      
      // Encontrar movimentações órfãs (pedido não existe ou foi cancelado)
      const orfas = movsComPedido.filter(m => {
        const pedido = pedidosMap.get(m.pedido_id)
        return !pedido || pedido.status === 'cancelado'
      })

      setMovimentacoesOrfas(orfas)
      return orfas
    } catch (erro) {
      console.error('Erro ao verificar movimentações órfãs:', erro)
      return []
    }
  }, [caixaAtual, movimentacoes])

  // Função para remover movimentações órfãs
  const removerMovimentacoesOrfas = async () => {
    if (!caixaAtual || movimentacoesOrfas.length === 0) {
      mostrarNotificacao('info', 'Nada a remover', 'Não há movimentações órfãs para remover.')
      return false
    }

    try {
      const ids = movimentacoesOrfas.map(m => m.id)
      const totalRemovido = movimentacoesOrfas.reduce((acc, m) => acc + Number(m.valor), 0)
      
      const { error } = await supabase
        .from('movimentacoes_caixa')
        .delete()
        .in('id', ids)

      if (error) throw error

      // Recarregar dados
      await carregarMovimentacoes(caixaAtual.id, caixaAtual)
      setMovimentacoesOrfas([])
      
      mostrarNotificacao('sucesso', 'Limpeza concluída', 
        `${ids.length} movimentação(ões) removida(s). Total: R$ ${totalRemovido.toFixed(2)}`)
      return true
    } catch (erro) {
      console.error('Erro ao remover movimentações órfãs:', erro)
      mostrarNotificacao('erro', 'Erro', 'Não foi possível remover as movimentações.')
      return false
    }
  }

  // Verificar órfãs quando movimentações mudam
  useEffect(() => {
    if (caixaAtual && movimentacoes.length > 0) {
      verificarMovimentacoesOrfas()
    }
  }, [caixaAtual, movimentacoes, verificarMovimentacoesOrfas])

  // Função para limpar TODAS as movimentações do caixa (reset)
  const limparTodasMovimentacoes = async () => {
    if (!caixaAtual) {
      mostrarNotificacao('aviso', 'Caixa fechado', 'Abra o caixa primeiro.')
      return false
    }

    try {
      const totalRemovido = movimentacoes.reduce((acc, m) => acc + Number(m.valor), 0)
      
      const { error } = await supabase
        .from('movimentacoes_caixa')
        .delete()
        .eq('caixa_id', caixaAtual.id)

      if (error) throw error

      // Recarregar dados
      await carregarMovimentacoes(caixaAtual.id, caixaAtual)
      await carregarPedidosDia(caixaAtual)
      setMovimentacoesOrfas([])
      
      mostrarNotificacao('sucesso', 'Movimentações limpas', 
        `${movimentacoes.length} movimentação(ões) removida(s). Total: R$ ${totalRemovido.toFixed(2)}`)
      return true
    } catch (erro) {
      console.error('Erro ao limpar movimentações:', erro)
      mostrarNotificacao('erro', 'Erro', 'Não foi possível limpar as movimentações.')
      return false
    }
  }

  // Função para ressincronizar todos os pedidos (limpa e sincroniza novamente)
  const ressincronizarTodosPedidos = async () => {
    if (!caixaAtual) {
      mostrarNotificacao('aviso', 'Caixa fechado', 'Abra o caixa primeiro.')
      return false
    }

    // Evitar operações simultâneas
    if (sincronizandoRef.current) {
      mostrarNotificacao('info', 'Aguarde', 'Operação em andamento...')
      return false
    }

    setSincronizando(true)

    try {
      // 1. Remove todas as movimentações de pedidos (mantém as manuais)
      const { error: erroDeletar } = await supabase
        .from('movimentacoes_caixa')
        .delete()
        .eq('caixa_id', caixaAtual.id)
        .not('pedido_id', 'is', null)

      if (erroDeletar) {
        throw erroDeletar
      }

      // 2. Recarrega os pedidos (agora todos estarão como não sincronizados)
      await carregarPedidosDia(caixaAtual)
      
      // 3. Sincroniza todos novamente usando batch
      // Nota: setSincronizando já está true, então sincronizarTodosPedidos vai funcionar
      setSincronizando(false) // Temporariamente para permitir chamada
      const resultado = await sincronizarTodosPedidos()
      
      return resultado
    } catch (erro) {
      console.error('Erro ao ressincronizar:', erro)
      mostrarNotificacao('erro', 'Erro', 'Não foi possível ressincronizar os pedidos.')
      
      // Tentar recarregar dados mesmo em caso de erro
      try {
        await carregarMovimentacoes(caixaAtual.id, caixaAtual)
        await carregarPedidosDia(caixaAtual)
      } catch {
        // Ignora erros secundários
      }
      
      return false
    } finally {
      setSincronizando(false)
    }
  }

  // Função para sincronizar pedido automaticamente (usada pelo realtime)
  // Usa constraint UNIQUE no banco para evitar duplicatas - não precisa verificar antes
  const sincronizarPedidoAutomatico = useCallback(async (
    pedidoId: string, 
    pedidoTotal: number, 
    formaPagamento: string, 
    nomeCliente: string,
    status?: string,
    createdAt?: string
  ) => {
    // Evitar durante sincronização em batch
    if (sincronizandoRef.current) return false
    
    const caixa = caixaAtualRef.current
    const cats = categoriasRef.current
    
    if (!caixa || !pedidoId) return false
    const statusNormalizado = (status || '').toLowerCase()
    if (STATUS_PEDIDO_IGNORAR_CAIXA.has(statusNormalizado)) return false

    if (createdAt) {
      const pedidoCriadoEm = new Date(createdAt)
      const caixaAbertoEm = new Date(caixa.data_abertura)
      if (pedidoCriadoEm < caixaAbertoEm) return false
    }

    // Usar mapeamento centralizado
    const nomeCategoria = MAPA_CATEGORIAS_PAGAMENTO[formaPagamento] || 'Vendas do Dia'
    const categoria = cats.find(c => c.nome === nomeCategoria) || cats.find(c => c.nome === 'Vendas do Dia')

    try {
      const { error } = await supabase
        .from('movimentacoes_caixa')
        .upsert(
          {
            caixa_id: caixa.id,
            categoria_id: categoria?.id || null,
            tipo: 'entrada',
            valor: Number(pedidoTotal) || 0,
            descricao: `Pedido de ${nomeCliente} - ${formaPagamento}`,
            forma_pagamento: formaPagamento,
            pedido_id: pedidoId,
          },
          {
            onConflict: 'pedido_id',
            ignoreDuplicates: true,
          }
        )

      if (error) {
        console.error('Erro ao sincronizar pedido automaticamente:', error)
        return false
      }

      return true
    } catch (erro) {
      console.error('Erro ao sincronizar pedido automaticamente:', erro)
      return false
    }
  }, [])

  const processarAutomacaoCaixa = useCallback(async () => {
    const config = automacaoCaixaRef.current
    if (!config?.ativo) return
    if (executandoAutomacaoCaixaRef.current) return

    const timezone = config.timezone || 'America/Sao_Paulo'
    const agora = new Date()
    const diaAtualLocal = getZonedDateKey(agora, timezone)
    const diaSemanaLocal = getZonedWeekday(agora, timezone)

    if (!isDayActive(config, diaSemanaLocal)) return

    const minutosAgora = getZonedMinutes(agora, timezone)
    const minutosAbertura = parseHorario(config.horario_abertura)
    const minutosFechamento = parseHorario(config.horario_fechamento)
    const dentroJanelaAberta = isWithinOpenWindow(minutosAgora, minutosAbertura, minutosFechamento)
    const caixa = caixaAtualRef.current

    const podeAbrirAutomatico =
      !caixa &&
      dentroJanelaAberta &&
      config.ultimo_dia_abertura !== diaAtualLocal

    const janelaFechamentoNoDia =
      minutosAbertura < minutosFechamento
        ? minutosAgora >= minutosFechamento
        : minutosAgora >= minutosFechamento && minutosAgora < minutosAbertura

    const podeFecharAutomatico =
      Boolean(caixa) &&
      janelaFechamentoNoDia &&
      config.ultimo_dia_fechamento !== diaAtualLocal

    if (!podeAbrirAutomatico && !podeFecharAutomatico) return

    setExecutandoAutomacaoCaixa(true)
    try {
      if (podeAbrirAutomatico) {
        const responsavel = (config.responsavel_padrao || 'Sistema Automatico').trim() || 'Sistema Automatico'
        const valorAbertura = Number(config.valor_abertura_padrao || 0)
        const sucesso = await abrirCaixa(valorAbertura, responsavel, undefined, 'manual')
        if (sucesso) {
          await atualizarMarcadorAutomacao({ ultimo_dia_abertura: diaAtualLocal })
        }
      }

      if (podeFecharAutomatico && caixaAtualRef.current) {
        const responsavel = (config.responsavel_padrao || 'Sistema Automatico').trim() || 'Sistema Automatico'
        const contadoDinheiro = Number(
          estatisticasRef.current.esperadoDinheiro ?? estatisticasRef.current.saldoGaveta ?? 0,
        )
        const sucesso = await fecharCaixa(
          contadoDinheiro,
          responsavel,
          `Fechamento automático (${timezone})`,
        )
        if (sucesso) {
          await atualizarMarcadorAutomacao({ ultimo_dia_fechamento: diaAtualLocal })
        }
      }
    } catch (erro) {
      console.error('[Caixa] Falha na rotina de automação diária:', erro)
    } finally {
      setExecutandoAutomacaoCaixa(false)
    }
  }, [abrirCaixa, atualizarMarcadorAutomacao, fecharCaixa])

  useEffect(() => {
    if (!automacaoCaixa?.ativo) return

    processarAutomacaoCaixa()
    const timer = window.setInterval(() => {
      processarAutomacaoCaixa()
    }, 30 * 1000)

    return () => {
      window.clearInterval(timer)
    }
  }, [automacaoCaixa?.ativo, processarAutomacaoCaixa])

  // Configurar Realtime para sincronização automática
  useEffect(() => {
    carregarDados()

    const recarregarCaixaAtivo = async () => {
      const caixa = caixaAtualRef.current
      if (!caixa) return

      await Promise.all([
        carregarMovimentacoes(caixa.id, caixa),
        carregarPedidosDia(caixa),
      ])
    }

    // Configurar canal Realtime para pedidos e movimentações
    const canal = supabase
      .channel('caixa-realtime-' + Date.now())
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'pedidos' },
        async (payload) => {
          const caixa = caixaAtualRef.current
          
          // Atualizar lista de pedidos de hoje
          await carregarPedidosHoje()
          
          if (!caixa) return
          
          const pedido = payload.new as { 
            id: string
            nome_cliente: string
            total: number
            forma_pagamento: string
            status: string
            created_at: string
          }

          if (!STATUS_PEDIDO_IGNORAR_CAIXA.has((pedido.status || '').toLowerCase())) {
            await sincronizarPedidoAutomatico(
              pedido.id,
              Number(pedido.total),
              pedido.forma_pagamento,
              pedido.nome_cliente,
              pedido.status,
              pedido.created_at
            )
          }
          
          await recarregarCaixaAtivo()
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'pedidos' },
        async (payload) => {
          const caixa = caixaAtualRef.current
          
          await carregarPedidosHoje()
          
          if (!caixa) return
          
          const pedido = payload.new as { 
            id: string
            nome_cliente: string
            total: number
            forma_pagamento: string
            status: string
            created_at: string
            }
            
          // Se foi cancelado, remover a movimentação correspondente
          if (STATUS_PEDIDO_IGNORAR_CAIXA.has((pedido.status || '').toLowerCase())) {
            console.log('[Caixa] Removendo movimentação de pedido cancelado:', pedido.id)
            await supabase
              .from('movimentacoes_caixa')
              .delete()
              .eq('pedido_id', pedido.id)
              .eq('caixa_id', caixa.id)
          } else {
            await sincronizarPedidoAutomatico(
              pedido.id,
              Number(pedido.total),
              pedido.forma_pagamento,
              pedido.nome_cliente,
              pedido.status,
              pedido.created_at
            )
          }

          await recarregarCaixaAtivo()
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'pedidos' },
        async (payload) => {
          const caixa = caixaAtualRef.current
          
          console.log('[Caixa] Pedido deletado, atualizando interface:', payload.old?.id)
          
          await carregarPedidosHoje()
          
          if (!caixa) return
          
          // O trigger do banco já remove as movimentações automaticamente
          // Apenas recarregar dados para atualizar a interface
          await recarregarCaixaAtivo()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'movimentacoes_caixa' },
        async () => {
          if (caixaAtualRef.current) {
            await recarregarCaixaAtivo()
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'caixa_automacao_config' },
        (payload) => {
          if (!payload.new || typeof payload.new !== 'object') return
          const cfg = payload.new as (Partial<CaixaAutomacaoConfig> & { id: string })
          setAutomacaoCaixa({
            id: cfg.id,
            ...normalizeAutomacaoConfig(cfg),
          })
        }
      )
      .subscribe((status) => {
        console.log('[Caixa] Realtime status:', status)
      })

    canalRealtimeRef.current = canal

    return () => {
      if (canalRealtimeRef.current) {
        supabase.removeChannel(canalRealtimeRef.current)
      }
    }
  }, [carregarDados, carregarMovimentacoes, carregarPedidosDia, carregarPedidosHoje, sincronizarPedidoAutomatico])

  // Calcular total dos pedidos de hoje (entregues)
  const totalPedidosHoje = pedidosHoje
    .filter(p => p.status === 'entregue')
    .reduce((acc, p) => acc + Number(p.total), 0)

  return {
    // Estados
    caixaAtual,
    movimentacoes,
    funcionarios,
    categorias,
    historicoCaixas,
    pedidosDia,
    pedidosHoje,
    totalPedidosHoje,
    estatisticas,
    resumoFormas,
    estatisticasPedidos,
    carregando,
    sincronizando,
    automacaoCaixa,
    salvandoAutomacaoCaixa,
    executandoAutomacaoCaixa,
    notificacao,
    movimentacoesOrfas,
    
    // Ações
    carregarDados,
    abrirCaixa,
    fecharCaixa,
    reabrirCaixa,
    registrarMovimentacao,
    registrarSangria,
    registrarSuprimento,
    excluirMovimentacao,
    excluirCaixa,
    sincronizarPedido,
    sincronizarTodosPedidos,
    removerMovimentacoesOrfas,
    limparTodasMovimentacoes,
    ressincronizarTodosPedidos,
    salvarAutomacaoCaixa,
    mostrarNotificacao,
    fecharNotificacao
  }
}
