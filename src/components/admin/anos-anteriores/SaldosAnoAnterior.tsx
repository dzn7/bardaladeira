'use client'

import { useState, useEffect, useCallback } from 'react'
import { Wallet, ArrowCircleUp as ArrowUpCircle, ArrowCircleDown as ArrowDownCircle, CaretRight } from '@phosphor-icons/react'
import { Cartao, Esqueleto, Gaveta, Lista, ListaCarregando, ListaVazia, Secao, Selo } from '@/components/admin/ui'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { supabase } from '@/lib/supabase'
import { obterDataInicioAno, obterDataFimAno } from '@/lib/filtros-ano'

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
  totalEntradas: number
  totalSaidas: number
  totalCaixasFechados: number
  mediaFaturamentoDiario: number
  maiorFaturamento: number
  menorFaturamento: number
  saldoFinal: number
}

type SaldosAnoAnteriorProps = {
  ano: number
}

const formatarMoeda = (valor: number): string => {
  return valor.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
}

export default function SaldosAnoAnterior({ ano }: SaldosAnoAnteriorProps) {
  const [caixas, setCaixas] = useState<Caixa[]>([])
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([])
  const [resumo, setResumo] = useState<ResumoSaldos>({
    totalEntradas: 0,
    totalSaidas: 0,
    totalCaixasFechados: 0,
    mediaFaturamentoDiario: 0,
    maiorFaturamento: 0,
    menorFaturamento: 0,
    saldoFinal: 0
  })
  const [carregando, setCarregando] = useState(true)
  const [caixaSelecionado, setCaixaSelecionado] = useState<string | null>(null)

  const carregarDados = useCallback(async () => {
    setCarregando(true)
    try {
      const dataInicio = obterDataInicioAno(ano)
      const dataFim = obterDataFimAno(ano)

      const [caixasRes, movsRes] = await Promise.all([
        supabase
          .from('caixas')
          .select('*')
          .gte('data_abertura', dataInicio)
          .lt('data_abertura', dataFim)
          .order('data_abertura', { ascending: false }),
        supabase
          .from('movimentacoes_caixa')
          .select('*, categoria:categorias_caixa(*), funcionario:funcionarios(*)')
          .gte('created_at', dataInicio)
          .lt('created_at', dataFim)
          .order('created_at', { ascending: false })
      ])

      const caixasFormatados = (caixasRes.data || []).map(c => ({
        ...c,
        valor_abertura: Number(c.valor_abertura),
        valor_fechamento: c.valor_fechamento ? Number(c.valor_fechamento) : null,
        total_entradas: Number(c.total_entradas || 0),
        total_saidas: Number(c.total_saidas || 0),
        saldo_esperado: Number(c.saldo_esperado || 0),
        diferenca: c.diferenca ? Number(c.diferenca) : null
      }))

      const movsFormatadas = (movsRes.data || []).map(m => ({
        ...m,
        valor: Number(m.valor)
      }))

      setCaixas(caixasFormatados)
      setMovimentacoes(movsFormatadas)

      const caixasFechados = caixasFormatados.filter(c => c.status === 'fechado')
      const totalEntradas = movsFormatadas.filter(m => m.tipo === 'entrada').reduce((acc, m) => acc + m.valor, 0)
      const totalSaidas = movsFormatadas.filter(m => m.tipo === 'saida').reduce((acc, m) => acc + m.valor, 0)
      
      const faturamentos = caixasFechados.map(c => c.total_entradas)
      const mediaFaturamento = faturamentos.length > 0 
        ? faturamentos.reduce((a, b) => a + b, 0) / faturamentos.length 
        : 0

      const ultimoCaixa = caixasFechados[0]
      const saldoFinal = ultimoCaixa 
        ? (ultimoCaixa.valor_fechamento || ultimoCaixa.saldo_esperado) 
        : 0

      setResumo({
        totalEntradas,
        totalSaidas,
        totalCaixasFechados: caixasFechados.length,
        mediaFaturamentoDiario: mediaFaturamento,
        maiorFaturamento: Math.max(...faturamentos, 0),
        menorFaturamento: faturamentos.length > 0 ? Math.min(...faturamentos) : 0,
        saldoFinal
      })
    } catch (erro) {
      console.error('Erro ao carregar saldos:', erro)
    } finally {
      setCarregando(false)
    }
  }, [ano])

  useEffect(() => {
    carregarDados()
  }, [carregarDados])

  const movimentacoesDoCaixa = caixaSelecionado 
    ? movimentacoes.filter(m => m.caixa_id === caixaSelecionado)
    : []

  const caixaAtual = caixaSelecionado ? caixas.find(c => c.id === caixaSelecionado) : undefined

  if (carregando) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label={`Carregando saldos de ${ano}`}>
        <Esqueleto className="h-[76px] w-full rounded-xl" />
        <ListaCarregando linhas={4} />
      </div>
    )
  }

  const kpis = [
    { rotulo: 'Entradas', valor: resumo.totalEntradas, ajuda: `Total de ${ano}`, classe: 'text-emerald-600 dark:text-emerald-400' },
    { rotulo: 'Saídas', valor: resumo.totalSaidas, ajuda: `Total de ${ano}`, classe: 'text-destructive' },
    { rotulo: 'Média por dia', valor: resumo.mediaFaturamentoDiario, ajuda: `${resumo.totalCaixasFechados} caixas fechados` },
    { rotulo: 'Saldo final', valor: resumo.saldoFinal, ajuda: `31/12/${ano}` },
  ]

  return (
    <div className="space-y-5">
      <Cartao className="grid grid-cols-2 md:grid-cols-4">
        {kpis.map((kpi, indice) => (
          <div
            key={kpi.rotulo}
            className={cn(
              'min-w-0 px-4 py-3.5 md:px-5 md:py-4',
              indice % 2 === 1 && 'border-l border-border/70',
              indice >= 2 && 'border-t border-border/70 md:border-t-0',
              indice === 2 && 'md:border-l',
            )}
          >
            <p className="truncate text-[13px] text-muted-foreground">{kpi.rotulo}</p>
            <p className={cn('mt-1 truncate text-lg font-semibold tabular-nums tracking-tight text-foreground md:text-xl', kpi.classe)}>
              R$ {formatarMoeda(kpi.valor)}
            </p>
            <p className="mt-0.5 truncate text-[13px] text-muted-foreground">{kpi.ajuda}</p>
          </div>
        ))}
      </Cartao>

      <p className="px-1 text-sm text-muted-foreground">
        Melhor dia: <span className="font-medium tabular-nums text-foreground">R$ {formatarMoeda(resumo.maiorFaturamento)}</span>
        {' · '}
        Pior dia: <span className="font-medium tabular-nums text-foreground">R$ {formatarMoeda(resumo.menorFaturamento)}</span>
      </p>

      <Secao titulo={`Caixas de ${ano}`} descricao="Toque em um caixa para ver as movimentações.">
        {caixas.length === 0 ? (
          <ListaVazia icone={<Wallet />} titulo={`Nenhum caixa em ${ano}`} />
        ) : (
          <Lista>
            {caixas.map((caixa) => (
              <li key={caixa.id}>
                <button
                  type="button"
                  onClick={() => setCaixaSelecionado(caixa.id)}
                  className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="font-medium tabular-nums text-foreground">
                        {format(new Date(caixa.data_abertura), "dd/MM/yyyy", { locale: ptBR })}
                      </p>
                      {caixa.status === 'aberto' && <Selo tom="sucesso">Aberto</Selo>}
                      {caixa.diferenca && caixa.diferenca !== 0 ? (
                        <Selo tom={caixa.diferenca > 0 ? 'sucesso' : 'perigo'}>
                          Diferença R$ {formatarMoeda(caixa.diferenca)}
                        </Selo>
                      ) : null}
                    </div>
                    <p className="mt-0.5 truncate text-[13px] text-muted-foreground">
                      {caixa.responsavel_abertura}
                      <span className="tabular-nums">
                        {' · '}+R$ {formatarMoeda(caixa.total_entradas)} · −R$ {formatarMoeda(caixa.total_saidas)}
                      </span>
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[13px] text-muted-foreground">Saldo</p>
                    <p className="text-sm font-semibold tabular-nums text-foreground">
                      R$ {formatarMoeda(caixa.valor_fechamento || caixa.saldo_esperado)}
                    </p>
                  </div>
                  <CaretRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                </button>
              </li>
            ))}
          </Lista>
        )}
      </Secao>

      <Gaveta
        aberto={caixaSelecionado !== null}
        aoFechar={() => setCaixaSelecionado(null)}
        largura="lg"
        titulo="Movimentações do caixa"
        descricao={caixaAtual ? `${format(new Date(caixaAtual.data_abertura), "dd/MM/yyyy", { locale: ptBR })} · ${caixaAtual.responsavel_abertura}` : undefined}
      >
        {movimentacoesDoCaixa.length === 0 ? (
          <ListaVazia icone={<Wallet />} titulo="Nenhuma movimentação neste caixa" />
        ) : (
          <Lista>
            {movimentacoesDoCaixa.map((mov) => (
              <li key={mov.id} className="flex items-center gap-3 px-4 py-3">
                {mov.tipo === 'entrada'
                  ? <ArrowUpCircle className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-label="Entrada" />
                  : <ArrowDownCircle className="size-5 shrink-0 text-destructive" aria-label="Saída" />
                }
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {mov.descricao || mov.categoria?.nome || 'Movimentação'}
                  </p>
                  <p className="text-[13px] tabular-nums text-muted-foreground">
                    {format(new Date(mov.created_at), "dd/MM HH:mm", { locale: ptBR })}
                  </p>
                </div>
                <span className={cn(
                  'shrink-0 text-sm font-semibold tabular-nums',
                  mov.tipo === 'entrada' ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'
                )}>
                  {mov.tipo === 'entrada' ? '+' : '−'} R$ {formatarMoeda(mov.valor)}
                </span>
              </li>
            ))}
          </Lista>
        )}
      </Gaveta>
    </div>
  )
}
