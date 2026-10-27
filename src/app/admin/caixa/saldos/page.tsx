'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Calendar, ArrowCircleUp as ArrowUpCircle, ArrowCircleDown as ArrowDownCircle, CaretLeft as ChevronLeft, MagnifyingGlass as Search, CreditCard, Money as Banknote, ArrowsClockwise as RefreshCw, Plus, Minus, X } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { format, subDays, startOfMonth, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { supabase } from '@/lib/supabase'
import AdminLayout from '@/components/admin/AdminLayout'
import ProtectedRoute from '@/components/admin/ProtectedRoute'
import Link from 'next/link'
import { obterDataInicioAnoAtual } from '@/lib/filtros-ano'
import {
  AreaTexto,
  Botao,
  CabecalhoPagina,
  Campo,
  Cartao,
  Entrada,
  EntradaPreco,
  Gaveta,
  Lista,
  ListaCarregando,
  ListaVazia,
  Pagina,
  Secao,
  Segmentos,
  Selo,
  lerPreco,
} from '@/components/admin/ui'
import { cn } from '@/lib/utils'

type Caixa = {
  id: string
  data_abertura: string
  data_fechamento: string | null
  valor_abertura: number
  valor_fechamento: number | null
  total_entradas: number
  total_saidas: number
  saldo_esperado: number
  diferenca: number | null
  responsavel_abertura: string
  responsavel_fechamento: string | null
  status: 'aberto' | 'fechado'
  observacoes: string | null
}

type Movimentacao = {
  id: string
  caixa_id: string
  tipo: 'entrada' | 'saida'
  valor: number
  descricao: string | null
  forma_pagamento: string | null
  created_at: string
  categoria: { nome: string; cor: string; icone: string } | null
  funcionario: { nome: string } | null
}

type ResumoSaldos = {
  saldoAtual: number
  totalEntradas: number
  totalSaidas: number
  totalCaixasFechados: number
  mediaFaturamentoDiario: number
  maiorFaturamento: number
  menorFaturamento: number
  diferencaAcumulada: number
  caixaAberto: boolean
}

export default function SaldosPage() {
  const [caixas, setCaixas] = useState<Caixa[]>([])
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([])
  const [resumo, setResumo] = useState<ResumoSaldos>({
    saldoAtual: 0,
    totalEntradas: 0,
    totalSaidas: 0,
    totalCaixasFechados: 0,
    mediaFaturamentoDiario: 0,
    maiorFaturamento: 0,
    menorFaturamento: 0,
    diferencaAcumulada: 0,
    caixaAberto: false,
  })
  const [carregando, setCarregando] = useState(true)
  const [periodoFiltro, setPeriodoFiltro] = useState<'7dias' | '30dias' | 'mes' | 'todos'>('30dias')
  const [caixaSelecionado, setCaixaSelecionado] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  
  // Modal de ajuste de saldo
  const [modalAjuste, setModalAjuste] = useState(false)
  const [tipoAjuste, setTipoAjuste] = useState<'entrada' | 'saida'>('entrada')
  const [valorAjuste, setValorAjuste] = useState('')
  const [descricaoAjuste, setDescricaoAjuste] = useState('')
  const [processandoAjuste, setProcessandoAjuste] = useState(false)
  const [caixaAberto, setCaixaAberto] = useState<Caixa | null>(null)

  const carregarDados = useCallback(async () => {
    setCarregando(true)
    try {
      // Data mínima: início do ano atual (2026)
      const dataInicioAnoAtual = obterDataInicioAnoAtual()

      // Calcular datas do filtro
      let dataInicio: Date | null = null
      const hoje = new Date()

      switch (periodoFiltro) {
        case '7dias':
          dataInicio = subDays(hoje, 7)
          break
        case '30dias':
          dataInicio = subDays(hoje, 30)
          break
        case 'mes':
          dataInicio = startOfMonth(hoje)
          break
        case 'todos':
          // "Todos" agora significa desde o início de 2026
          dataInicio = new Date(dataInicioAnoAtual)
          break
      }

      // Garantir que a data de início não seja anterior a 01/01/2026
      const dataInicioAno = new Date(dataInicioAnoAtual)
      if (dataInicio && dataInicio < dataInicioAno) {
        dataInicio = dataInicioAno
      }

      // Buscar caixas (apenas de 2026+)
      let queryCaixas = supabase
        .from('caixas')
        .select('*')
        .gte('data_abertura', dataInicioAnoAtual)
        .order('data_abertura', { ascending: false })

      if (dataInicio) {
        queryCaixas = queryCaixas.gte('data_abertura', dataInicio.toISOString())
      }

      const { data: caixasData } = await queryCaixas

      // Buscar movimentações (apenas de 2026+)
      let queryMovs = supabase
        .from('movimentacoes_caixa')
        .select('*, categoria:categorias_caixa(*), funcionario:funcionarios(*)')
        .gte('created_at', dataInicioAnoAtual)
        .order('created_at', { ascending: false })

      if (dataInicio) {
        queryMovs = queryMovs.gte('created_at', dataInicio.toISOString())
      }

      const { data: movsData } = await queryMovs

      const caixasFormatados = (caixasData || []).map(c => ({
        ...c,
        valor_abertura: Number(c.valor_abertura),
        valor_fechamento: c.valor_fechamento ? Number(c.valor_fechamento) : null,
        total_entradas: Number(c.total_entradas || 0),
        total_saidas: Number(c.total_saidas || 0),
        saldo_esperado: Number(c.saldo_esperado || 0),
        diferenca: c.diferenca ? Number(c.diferenca) : null
      }))

      const movsFormatadas = (movsData || []).map(m => ({
        ...m,
        valor: Number(m.valor)
      }))

      setCaixas(caixasFormatados)
      setMovimentacoes(movsFormatadas)

      // Calcular resumo
      const caixasFechados = caixasFormatados.filter(c => c.status === 'fechado')
      const caixaAberto = caixasFormatados.find(c => c.status === 'aberto')
      
      // Total de entradas e saídas de todas as movimentações do período
      const totalEntradas = movsFormatadas.filter(m => m.tipo === 'entrada').reduce((acc, m) => acc + m.valor, 0)
      const totalSaidas = movsFormatadas.filter(m => m.tipo === 'saida').reduce((acc, m) => acc + m.valor, 0)
      
      // Saldo atual: se há caixa aberto, calcular apenas com as movimentações DELE
      // O valor_abertura do caixa aberto já é o saldo do caixa anterior
      let saldoAtual = 0
      if (caixaAberto) {
        // Movimentações apenas do caixa aberto
        const movsDoAberto = movsFormatadas.filter(m => m.caixa_id === caixaAberto.id)
        const entradasAberto = movsDoAberto.filter(m => m.tipo === 'entrada').reduce((acc, m) => acc + m.valor, 0)
        const saidasAberto = movsDoAberto.filter(m => m.tipo === 'saida').reduce((acc, m) => acc + m.valor, 0)
        saldoAtual = caixaAberto.valor_abertura + entradasAberto - saidasAberto
      } else {
        // Se não há caixa aberto, usar o saldo do último caixa fechado
        const ultimoFechado = caixasFechados[0] // Já está ordenado por data desc
        saldoAtual = ultimoFechado ? (ultimoFechado.valor_fechamento || ultimoFechado.saldo_esperado) : 0
      }

      const faturamentos = caixasFechados.map(c => c.total_entradas)
      const mediaFaturamento = faturamentos.length > 0 
        ? faturamentos.reduce((a, b) => a + b, 0) / faturamentos.length 
        : 0
      const diferencaAcumulada = caixasFechados.reduce((acc, caixa) => acc + Number(caixa.diferenca || 0), 0)

      setResumo({
        saldoAtual,
        totalEntradas,
        totalSaidas,
        totalCaixasFechados: caixasFechados.length,
        mediaFaturamentoDiario: mediaFaturamento,
        maiorFaturamento: Math.max(...faturamentos, 0),
        menorFaturamento: faturamentos.length > 0 ? Math.min(...faturamentos) : 0,
        diferencaAcumulada,
        caixaAberto: Boolean(caixaAberto),
      })

    // Verificar se há caixa aberto
      const caixaAbertoEncontrado = caixasData?.find(c => c.status === 'aberto') || null
      setCaixaAberto(caixaAbertoEncontrado as Caixa | null)

    } catch (erro) {
      console.error('Erro ao carregar dados:', erro)
    } finally {
      setCarregando(false)
    }
  }, [periodoFiltro])

  useEffect(() => {
    carregarDados()
  }, [carregarDados])

  useEffect(() => {
    const canal = supabase
      .channel('saldos-realtime-' + Date.now())
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'caixas' },
        () => {
          carregarDados()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'movimentacoes_caixa' },
        () => {
          carregarDados()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(canal)
    }
  }, [carregarDados])

  // Função para registrar ajuste de saldo
  const registrarAjuste = async () => {
    if (!caixaAberto || !valorAjuste || !descricaoAjuste) return

    setProcessandoAjuste(true)
    try {
      // Buscar categoria "Ajuste de Saldo" ou criar uma genérica
      const { data: categorias } = await supabase
        .from('categorias_caixa')
        .select('id')
        .eq('nome', 'Ajuste de Saldo')
        .maybeSingle()

      let categoriaId = categorias?.id

      // Se não existir, buscar "Outros" ou a primeira categoria disponível
      if (!categoriaId) {
        const { data: outrasCategorias } = await supabase
          .from('categorias_caixa')
          .select('id')
          .eq('ativo', true)
          .limit(1)
          .single()
        categoriaId = outrasCategorias?.id
      }

      // Inserir movimentação de ajuste
      const { error } = await supabase.from('movimentacoes_caixa').insert({
        caixa_id: caixaAberto.id,
        categoria_id: categoriaId,
        tipo: tipoAjuste,
        valor: Math.abs(lerPreco(valorAjuste) ?? 0),
        descricao: `Ajuste de Saldo: ${descricaoAjuste}`,
        forma_pagamento: 'Ajuste'
      })

      if (error) throw error
      toast.success(tipoAjuste === 'entrada' ? 'Valor adicionado ao saldo' : 'Valor retirado do saldo', { description: descricaoAjuste })

      // Fechar modal e recarregar dados
      setModalAjuste(false)
      setValorAjuste('')
      setDescricaoAjuste('')
      carregarDados()
    } catch (erro) {
      console.error('Erro ao registrar ajuste:', erro)
      toast.error('Não foi possível registrar o ajuste.', { description: 'Tente de novo em instantes.' })
    } finally {
      setProcessandoAjuste(false)
    }
  }

  const abrirModalAjuste = (tipo: 'entrada' | 'saida') => {
    setTipoAjuste(tipo)
    setModalAjuste(true)
  }

  // Filtrar movimentações por caixa selecionado e busca
  const movimentacoesFiltradas = movimentacoes.filter(m => {
    const passaCaixa = !caixaSelecionado || m.caixa_id === caixaSelecionado
    const passaBusca = !busca || 
      m.descricao?.toLowerCase().includes(busca.toLowerCase()) ||
      m.categoria?.nome.toLowerCase().includes(busca.toLowerCase()) ||
      m.funcionario?.nome.toLowerCase().includes(busca.toLowerCase())
    return passaCaixa && passaBusca
  })

  // Agrupar movimentações por data
  const movimentacoesAgrupadas = movimentacoesFiltradas.reduce((acc, mov) => {
    const data = format(parseISO(mov.created_at), 'yyyy-MM-dd')
    if (!acc[data]) {
      acc[data] = []
    }
    acc[data].push(mov)
    return acc
  }, {} as Record<string, Movimentacao[]>)

  const entradasPorFormaPagamento = useMemo(() => {
    const agrupado = movimentacoesFiltradas.reduce<Record<string, number>>((acc, mov) => {
      if (mov.tipo !== 'entrada') return acc
      const forma = (mov.forma_pagamento || 'Não informado').trim() || 'Não informado'
      acc[forma] = (acc[forma] || 0) + Number(mov.valor || 0)
      return acc
    }, {})

    const total = Object.values(agrupado).reduce((sum, valor) => sum + valor, 0)

    return Object.entries(agrupado)
      .map(([forma, valor]) => ({
        forma,
        valor,
        percentual: total > 0 ? (valor / total) * 100 : 0,
      }))
      .sort((a, b) => b.valor - a.valor)
  }, [movimentacoesFiltradas])

  const formatarMoeda = (valor: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)
  }

  const resumoCards = [
    { rotulo: 'Entradas', valor: formatarMoeda(resumo.totalEntradas), classe: 'text-emerald-700 dark:text-emerald-400' },
    { rotulo: 'Saídas', valor: formatarMoeda(resumo.totalSaidas), classe: 'text-destructive' },
    { rotulo: 'Média diária', valor: formatarMoeda(resumo.mediaFaturamentoDiario), classe: 'text-foreground' },
    { rotulo: 'Caixas fechados', valor: String(resumo.totalCaixasFechados), classe: 'text-foreground' },
    {
      rotulo: 'Diferença acumulada',
      valor: `${resumo.diferencaAcumulada >= 0 ? '+' : ''}${formatarMoeda(resumo.diferencaAcumulada)}`,
      classe: resumo.diferencaAcumulada >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-destructive',
    },
  ]

  return (
    <ProtectedRoute><AdminLayout>
      <Pagina>
        <div className="flex items-start gap-2">
          <Link
            href="/admin/caixa"
            aria-label="Voltar para o caixa"
            className="-ml-2 flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <ChevronLeft className="size-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <CabecalhoPagina
              titulo="Extrato de saldos"
              descricao="Visão de todos os caixas do período."
              acoes={
                <>
                  {caixaAberto && (
                    <>
                      <Botao variante="contorno" onClick={() => abrirModalAjuste('entrada')}>
                        <Plus className="size-4" />
                        Entrada
                      </Botao>
                      <Botao variante="contorno" onClick={() => abrirModalAjuste('saida')}>
                        <Minus className="size-4" />
                        Saída
                      </Botao>
                    </>
                  )}
                  <Botao
                    variante="fantasma"
                    tamanho="icone"
                    onClick={carregarDados}
                    aria-label="Atualizar"
                    className="!flex-none"
                  >
                    <RefreshCw className={cn('size-4', carregando && 'animate-spin')} />
                  </Botao>
                </>
              }
            />
          </div>
        </div>

        {!caixaAberto && !carregando && (
          <p className="rounded-xl border border-border/70 bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            Nenhum caixa aberto. Abra um caixa para lançar ajustes de saldo.
          </p>
        )}

        <Segmentos
          rotuloAcessivel="Período"
          valor={periodoFiltro}
          aoMudar={setPeriodoFiltro}
          opcoes={[
            { valor: '7dias', rotulo: '7 dias' },
            { valor: '30dias', rotulo: '30 dias' },
            { valor: 'mes', rotulo: 'Este mês' },
            { valor: 'todos', rotulo: 'Todos' },
          ]}
        />

        {carregando ? (
          <ListaCarregando linhas={4} />
        ) : (
          <>
            <Cartao className="p-4">
              <p className="text-sm text-muted-foreground">Saldo atual</p>
              <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums text-foreground">
                {formatarMoeda(resumo.saldoAtual)}
              </p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                {resumo.caixaAberto ? 'Caixa aberto agora' : 'Valor do último fechamento'}
              </p>
            </Cartao>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {resumoCards.map((card) => (
                <Cartao key={card.rotulo} className="p-3">
                  <p className="truncate text-[13px] text-muted-foreground">{card.rotulo}</p>
                  <p className={cn('mt-0.5 truncate text-base font-semibold tabular-nums', card.classe)}>{card.valor}</p>
                </Cartao>
              ))}
            </div>

            <Secao titulo="Entradas por forma de pagamento" descricao="Só entradas, no período e filtro atuais.">
              {entradasPorFormaPagamento.length === 0 ? (
                <ListaVazia icone={<CreditCard />} titulo="Sem entradas no período" />
              ) : (
                <Cartao className="space-y-3 p-4">
                  {entradasPorFormaPagamento.slice(0, 6).map((item) => (
                    <div key={item.forma} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="truncate font-medium text-foreground">{item.forma}</span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">
                          {formatarMoeda(item.valor)} · {item.percentual.toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted">
                        <div className="h-1.5 rounded-full bg-primary" style={{ width: `${Math.max(4, item.percentual)}%` }} />
                      </div>
                    </div>
                  ))}
                </Cartao>
              )}
            </Secao>

            <Secao
              titulo="Histórico de caixas"
              descricao="Toque num caixa para ver só as movimentações dele."
              acao={
                caixaSelecionado ? (
                  <Botao variante="fantasma" tamanho="sm" onClick={() => setCaixaSelecionado(null)}>
                    <X className="size-4" />
                    Ver todos
                  </Botao>
                ) : null
              }
            >
              {caixas.length === 0 ? (
                <ListaVazia icone={<Calendar />} titulo="Nenhum caixa no período" descricao="Escolha outro período acima." />
              ) : (
                <Lista className="max-h-[420px] overflow-y-auto">
                  {caixas.map((caixa) => {
                    const selecionado = caixaSelecionado === caixa.id
                    return (
                      <li key={caixa.id}>
                        <button
                          type="button"
                          aria-pressed={selecionado}
                          onClick={() => setCaixaSelecionado(selecionado ? null : caixa.id)}
                          className={cn(
                            'flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                            selecionado && 'bg-primary/5',
                          )}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="truncate font-medium text-foreground">
                                {format(parseISO(caixa.data_abertura), "dd 'de' MMMM", { locale: ptBR })}
                              </p>
                              {caixa.status === 'aberto' && <Selo tom="sucesso">Aberto</Selo>}
                            </div>
                            <p className="mt-0.5 truncate text-sm text-muted-foreground">{caixa.responsavel_abertura}</p>
                          </div>
                          <div className="shrink-0 text-right tabular-nums">
                            <p className="font-semibold text-foreground">
                              {formatarMoeda(caixa.valor_fechamento || caixa.saldo_esperado)}
                            </p>
                            <p className="text-[13px] text-muted-foreground">
                              +{formatarMoeda(caixa.total_entradas)} · −{formatarMoeda(caixa.total_saidas)}
                            </p>
                          </div>
                        </button>
                      </li>
                    )
                  })}
                </Lista>
              )}
            </Secao>

            <Secao
              titulo="Extrato detalhado"
              descricao={`${movimentacoesFiltradas.length} ${movimentacoesFiltradas.length === 1 ? 'movimentação' : 'movimentações'}`}
            >
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Entrada
                  type="search"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Buscar por descrição, categoria ou funcionário"
                  aria-label="Buscar movimentação"
                  className="pl-9"
                />
              </div>

              {Object.keys(movimentacoesAgrupadas).length === 0 ? (
                <ListaVazia
                  icone={<Banknote />}
                  titulo="Nenhuma movimentação encontrada"
                  descricao={busca || caixaSelecionado ? 'Limpe a busca ou o caixa selecionado.' : undefined}
                />
              ) : (
                <div className="space-y-4">
                  {Object.entries(movimentacoesAgrupadas).map(([data, movs]) => (
                    <div key={data} className="space-y-1.5">
                      <p className="px-1 text-sm font-medium capitalize text-muted-foreground">
                        {format(parseISO(data), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                      </p>
                      <Lista>
                        {movs.map((mov) => (
                          <li key={mov.id} className="flex items-center gap-3 px-4 py-3">
                            {mov.tipo === 'entrada' ? (
                              <ArrowUpCircle className="size-5 shrink-0 text-emerald-700 dark:text-emerald-400" aria-label="Entrada" />
                            ) : (
                              <ArrowDownCircle className="size-5 shrink-0 text-destructive" aria-label="Saída" />
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium text-foreground">{mov.categoria?.nome || 'Sem categoria'}</p>
                              <p className="truncate text-sm text-muted-foreground">
                                {mov.descricao || 'Sem descrição'}
                                {mov.funcionario && ` · ${mov.funcionario.nome}`}
                              </p>
                              <p className="text-[13px] text-muted-foreground">
                                {format(parseISO(mov.created_at), 'HH:mm')}
                                {mov.forma_pagamento && ` · ${mov.forma_pagamento}`}
                              </p>
                            </div>
                            <p
                              className={cn(
                                'shrink-0 font-semibold tabular-nums',
                                mov.tipo === 'entrada' ? 'text-emerald-700 dark:text-emerald-400' : 'text-destructive',
                              )}
                            >
                              {mov.tipo === 'entrada' ? '+' : '−'}{formatarMoeda(mov.valor)}
                            </p>
                          </li>
                        ))}
                      </Lista>
                    </div>
                  ))}
                </div>
              )}
            </Secao>
          </>
        )}
      </Pagina>

      <Gaveta
        aberto={modalAjuste}
        aoFechar={() => setModalAjuste(false)}
        bloqueada={processandoAjuste}
        titulo={tipoAjuste === 'entrada' ? 'Adicionar ao saldo' : 'Retirar do saldo'}
        descricao="Ajuste manual no caixa aberto."
        rodape={
          <>
            <Botao variante="contorno" onClick={() => setModalAjuste(false)} disabled={processandoAjuste}>
              Cancelar
            </Botao>
            <Botao
              variante={tipoAjuste === 'entrada' ? 'primario' : 'perigo'}
              carregando={processandoAjuste}
              disabled={!valorAjuste || !descricaoAjuste}
              onClick={() => void registrarAjuste()}
            >
              {tipoAjuste === 'entrada' ? 'Adicionar' : 'Retirar'}
            </Botao>
          </>
        }
      >
        <form
          className="space-y-4"
          onSubmit={(evento) => {
            evento.preventDefault()
            void registrarAjuste()
          }}
        >
          <Segmentos
            rotuloAcessivel="Tipo de ajuste"
            valor={tipoAjuste}
            aoMudar={setTipoAjuste}
            opcoes={[
              { valor: 'entrada', rotulo: 'Adicionar' },
              { valor: 'saida', rotulo: 'Retirar' },
            ]}
          />
          <Campo rotulo="Valor" htmlFor="ajuste-valor">
            <EntradaPreco id="ajuste-valor" valor={valorAjuste} aoMudar={setValorAjuste} disabled={processandoAjuste} autoFocus />
          </Campo>
          <Campo rotulo="Motivo" htmlFor="ajuste-motivo">
            <AreaTexto
              id="ajuste-motivo"
              value={descricaoAjuste}
              onChange={(e) => setDescricaoAjuste(e.target.value)}
              placeholder="Ex.: troco inicial, correção de valor"
              disabled={processandoAjuste}
            />
          </Campo>
          {caixaAberto && (
            <p className="text-sm text-muted-foreground">
              Caixa de {format(parseISO(caixaAberto.data_abertura), "dd/MM/yyyy 'às' HH:mm")} · {caixaAberto.responsavel_abertura}
            </p>
          )}
          <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
        </form>
      </Gaveta>
    </AdminLayout></ProtectedRoute>
  )
}
