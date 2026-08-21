'use client'

import { type ReactNode, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  List,
  MinusCircle,
  PlusCircle,
  RotateCcw,
  Search,
  TrendingDown,
  TrendingUp,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { cn } from '@/lib/utils'
import { CHIP_FILTRO_ALERTA, CHIP_FILTRO_DEFAULT } from '@/components/admin/filtros/chip-classes'
import { FiltrosAtivosChips, type ChipFiltroAtivo } from '@/components/admin/filtros/FiltrosAtivosChips'
import type { MovimentacaoCaixa } from '@/lib/tipos-caixa'
import { useFinancas } from '../hooks/useFinancas'
import { calcularPeriodo, formatarMoeda, rotuloPeriodo } from '../lib/formatadores'
import type { FiltroFinancas, TipoPeriodo } from '../types'
import { CardRadialFinancas } from './CardRadialFinancas'
import { GraficoFluxoCaixa } from './GraficoFluxoCaixa'
import { GraficoLucroMensal } from './GraficoLucroMensal'
import { GraficoComposicao } from './GraficoComposicao'
import { ListaMovimentacoes } from './ListaMovimentacoes'
import { ListaPedidosNaoPagos } from './ListaPedidosNaoPagos'
import { ListaCrediarioPendente } from './ListaCrediarioPendente'
import { ListaPagamentos } from './ListaPagamentos'
import { ModalMovimentacao } from './ModalMovimentacao'
import { GestaoPagamentosFuncionarios } from './GestaoPagamentosFuncionarios'
import { PainelDiarias } from './PainelDiarias'
import { ResumoLucroProdutos } from './ResumoLucroProdutos'

const CHAVE_OCULTAR = 'financas:valoresOcultos'

type FiltroRapido = 'todos' | 'a-receber' | 'receitas' | 'despesas'
type AbaPrincipal = 'lancamentos' | 'diarias'

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

function periodoDoMes(ano: number, mes: number): FiltroFinancas {
  const inicio = new Date(ano, mes - 1, 1, 0, 0, 0, 0)
  const fim = new Date(ano, mes, 0, 23, 59, 59, 999)
  return { tipo: 'mes', inicio: inicio.toISOString(), fim: fim.toISOString() }
}

function extrairMesAno(filtro: FiltroFinancas): { ano: number; mes: number } {
  const d = new Date(filtro.inicio)
  return { ano: d.getFullYear(), mes: d.getMonth() + 1 }
}

const CHIPS: { key: FiltroRapido; label: string; ariaLabel: string; icon: ReactNode; alert?: boolean }[] = [
  { key: 'todos', label: 'Todos', ariaLabel: 'Mostrar todos os lançamentos', icon: <List className="h-3.5 w-3.5" /> },
  {
    key: 'a-receber',
    label: 'A receber',
    ariaLabel: 'Filtrar pedidos e crediário a receber',
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
    alert: true,
  },
  {
    key: 'receitas',
    label: 'Somente Receitas',
    ariaLabel: 'Filtrar somente receitas',
    icon: <TrendingUp className="h-3.5 w-3.5" />,
  },
  {
    key: 'despesas',
    label: 'Somente Despesas',
    ariaLabel: 'Filtrar somente despesas',
    icon: <TrendingDown className="h-3.5 w-3.5" />,
  },
]

export function PainelFinancas() {
  const [filtro, setFiltro] = useState<FiltroFinancas>(() => calcularPeriodo('mes'))
  const [valoresOcultos, setValoresOcultos] = useState(false)
  const [filtroRapido, setFiltroRapido] = useState<FiltroRapido>('todos')
  const [abaPrincipal, setAbaPrincipal] = useState<AbaPrincipal>('lancamentos')
  const [busca, setBusca] = useState('')
  const [editando, setEditando] = useState<MovimentacaoCaixa | null>(null)

  useEffect(() => {
    try {
      setValoresOcultos(window.localStorage.getItem(CHAVE_OCULTAR) === '1')
    } catch {
      /* ignore */
    }
  }, [])

  const handleAlternarOcultos = () => {
    setValoresOcultos((prev) => {
      const novo = !prev
      try {
        window.localStorage.setItem(CHAVE_OCULTAR, novo ? '1' : '0')
      } catch {
        /* ignore */
      }
      return novo
    })
  }

  const {
    carregando,
    erro,
    erroLucro,
    resumo,
    resumoLucro,
    lucroProdutos,
    fluxoCaixa,
    composicaoReceita,
    resumoMensal,
    movimentacoes,
    pagamentos,
    pedidos,
    pedidosNaoPagos,
    crediarios,
    categorias,
    funcionarios,
    refetch,
    adicionarMovimentacao,
    atualizarMovimentacao,
    removerMovimentacao,
  } = useFinancas(filtro)

  const { ano, mes } = extrairMesAno(filtro)
  const rotuloMes = `${MESES[mes - 1]} ${ano}`
  const ehMesAtual =
    filtro.tipo === 'mes' &&
    ano === new Date().getFullYear() &&
    mes === new Date().getMonth() + 1

  const navegarMes = (dir: -1 | 1) => {
    let novoMes = mes + dir
    let novoAno = ano
    if (novoMes < 1) {
      novoMes = 12
      novoAno -= 1
    }
    if (novoMes > 12) {
      novoMes = 1
      novoAno += 1
    }
    const agora = new Date()
    if (novoAno > agora.getFullYear() || (novoAno === agora.getFullYear() && novoMes > agora.getMonth() + 1)) {
      return
    }
    setFiltro(periodoDoMes(novoAno, novoMes))
  }

  const aplicarPreset = (tipo: TipoPeriodo) => {
    setFiltro(calcularPeriodo(tipo))
  }

  const receitaRecebida = resumo.receitaTotal
  const receitaTotalAlvo = resumo.receitaTotal + resumo.aReceberTotal
  const despesaPaga = resumo.despesas
  const despesaTotalAlvo = resumo.despesas

  const movimentacoesFiltradas = useMemo(() => {
    let lista = movimentacoes
    if (filtroRapido === 'receitas') lista = lista.filter((m) => m.tipo === 'entrada')
    if (filtroRapido === 'despesas') lista = lista.filter((m) => m.tipo === 'saida')
    const q = busca.trim().toLowerCase()
    if (q) {
      lista = lista.filter(
        (m) =>
          (m.descricao ?? '').toLowerCase().includes(q) ||
          (m.categoria?.nome ?? '').toLowerCase().includes(q) ||
          (m.funcionario?.nome ?? '').toLowerCase().includes(q) ||
          (m.forma_pagamento ?? '').toLowerCase().includes(q),
      )
    }
    return lista
  }, [movimentacoes, filtroRapido, busca])

  const chipsFiltroAtivo = useMemo((): ChipFiltroAtivo[] => {
    const chips: ChipFiltroAtivo[] = []
    if (filtro.tipo !== 'mes' || !ehMesAtual) {
      chips.push({ key: 'periodo', label: 'Período', value: rotuloPeriodo(filtro) })
    }
    if (filtroRapido !== 'todos') {
      chips.push({
        key: 'rapido',
        label: 'Filtro',
        value: CHIPS.find((chip) => chip.key === filtroRapido)?.label ?? filtroRapido,
      })
    }
    if (busca.trim()) {
      chips.push({ key: 'busca', label: 'Busca', value: busca.trim() })
    }
    return chips
  }, [filtro, ehMesAtual, filtroRapido, busca])

  const handleLimparFiltros = () => {
    setFiltro(calcularPeriodo('mes'))
    setFiltroRapido('todos')
    setBusca('')
  }
  const totalReceitaPeriodo = useMemo(
    () => composicaoReceita.reduce((acc, c) => acc + c.valor, 0),
    [composicaoReceita],
  )

  const handleVisualizar = (m: MovimentacaoCaixa) => {
    toast.message(m.descricao || (m.tipo === 'entrada' ? 'Receita' : 'Despesa'), {
      description: `${formatarMoeda(m.valor)} · ${m.forma_pagamento ?? 'sem forma'} · ${m.pedido_id ? 'Sincronizado do pedido' : 'Lançamento manual'}`,
    })
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2" data-onboarding="financas-lucro">
          <h1 className="fonte-titulo text-xl font-semibold tracking-tight text-foreground">Financeiro</h1>
          <button
            type="button"
            onClick={handleAlternarOcultos}
            aria-label={valoresOcultos ? 'Mostrar valores' : 'Ocultar valores'}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            {valoresOcultos ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
          {!valoresOcultos ? (
            <span
              className={cn(
                'text-sm font-semibold tabular-nums',
                resumo.resultadoCaixa >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400',
              )}
            >
              Resultado {formatarMoeda(resumo.resultadoCaixa)}
            </span>
          ) : (
            <span className="text-sm font-semibold text-muted-foreground">Resultado ••••••</span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ModalMovimentacao
            tipo="entrada"
            categorias={categorias}
            onSubmit={adicionarMovimentacao}
            trigger={
              <Button
                variant="outline"
                data-onboarding="financas-receita"
                className="h-10 gap-2 rounded-xl border-border/70 px-4 text-sm font-medium shadow-none hover:border-emerald-500"
              >
                Receitas
                <PlusCircle className="h-5 w-5 text-[#00C247]" strokeWidth={1.6} />
              </Button>
            }
          />
          <ModalMovimentacao
            tipo="saida"
            categorias={categorias}
            onSubmit={adicionarMovimentacao}
            trigger={
              <Button
                variant="outline"
                data-onboarding="financas-despesa"
                className="h-10 gap-2 rounded-xl border-border/70 px-4 text-sm font-medium shadow-none hover:border-rose-500"
              >
                Despesas
                <MinusCircle className="h-5 w-5 text-[#FF5151]" strokeWidth={1.6} />
              </Button>
            }
          />
          <GestaoPagamentosFuncionarios
            funcionarios={funcionarios}
            categorias={categorias}
            aoAtualizar={refetch}
          />
        </div>
      </div>

      {erro ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {erro}
        </div>
      ) : null}

      <div
        className={cn(
          'w-full overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm',
          abaPrincipal === 'diarias' ? 'p-3 md:p-4' : 'p-3.5 md:p-5',
        )}
      >
        <div className="mb-3 flex flex-col gap-3 sm:mb-4 sm:flex-row sm:items-center sm:justify-between">
          <ToggleGroup
            type="single"
            value={abaPrincipal}
            onValueChange={(v) => {
              if (v === 'lancamentos' || v === 'diarias') setAbaPrincipal(v)
            }}
            aria-label="Área principal do financeiro"
            data-onboarding="financas-toggle-principal"
            className="inline-flex h-10 w-full rounded-lg border border-border/70 bg-muted/30 p-1 sm:w-auto"
          >
            <ToggleGroupItem
              value="lancamentos"
              aria-label="Lançamentos"
              className="h-8 flex-1 gap-1.5 rounded-md px-3 text-xs font-medium data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-sm sm:flex-none"
            >
              <List className="h-3.5 w-3.5" />
              Lançamentos
            </ToggleGroupItem>
            <ToggleGroupItem
              value="diarias"
              aria-label="Diárias"
              className="h-8 flex-1 gap-1.5 rounded-md px-3 text-xs font-medium data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-sm sm:flex-none"
            >
              <CalendarDays className="h-3.5 w-3.5" />
              Diárias
            </ToggleGroupItem>
          </ToggleGroup>

          {abaPrincipal === 'lancamentos' ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-border/70 bg-muted/40 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                {rotuloPeriodo(filtro)}
              </span>
              {carregando ? <RotateCcw className="h-4 w-4 animate-spin text-sky-500" /> : null}
            </div>
          ) : null}
        </div>

        {abaPrincipal === 'diarias' ? (
          <PainelDiarias funcionarios={funcionarios} onAlterou={refetch} embutido />
        ) : (
          <>
        <div
          className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"
          data-onboarding="financas-periodo"
        >
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => aplicarPreset('hoje')}
              className={cn(
                'h-8 rounded-md border px-2.5 text-xs font-medium transition-colors',
                filtro.tipo === 'hoje'
                  ? 'border-sky-500 bg-sky-50 text-sky-800 dark:bg-sky-950/40 dark:text-sky-200'
                  : 'border-transparent text-muted-foreground hover:bg-muted',
              )}
            >
              Hoje
            </button>

            {!ehMesAtual && filtro.tipo === 'mes' ? (
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs shadow-none"
                onClick={() => setFiltro(calcularPeriodo('mes'))}
              >
                Mês Atual
              </Button>
            ) : null}

            <button
              type="button"
              className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Mês anterior"
              onClick={() => navegarMes(-1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[120px] text-center text-base font-medium text-foreground/90">
              {filtro.tipo === 'hoje' ? 'Hoje' : ehMesAtual ? 'Mês Atual' : rotuloMes}
            </span>
            <button
              type="button"
              className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Próximo mês"
              onClick={() => navegarMes(1)}
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-muted-foreground"
              onClick={refetch}
              disabled={carregando}
            >
              <RotateCcw className={cn('h-3.5 w-3.5', carregando && 'animate-spin')} />
              Atualizar
            </Button>
          </div>
        </div>

        <div className="mb-3 w-full overflow-x-auto">
          <ToggleGroup
            type="single"
            value={filtroRapido}
            onValueChange={(v) => {
              if (v) setFiltroRapido(v as FiltroRapido)
            }}
            aria-label="Filtros rápidos do financeiro"
            className="flex w-max items-center justify-start gap-2"
          >
            {CHIPS.map((chip) => (
              <ToggleGroupItem
                key={chip.key}
                value={chip.key}
                aria-label={chip.ariaLabel}
                className={chip.alert ? CHIP_FILTRO_ALERTA : CHIP_FILTRO_DEFAULT}
              >
                {chip.icon}
                <span>{chip.label}</span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar descrição"
              aria-label="Buscar descrição"
              className="h-9 rounded-lg border-border/70 bg-background pl-9 shadow-none"
            />
          </div>
        </div>

        <FiltrosAtivosChips chips={chipsFiltroAtivo} onLimpar={handleLimparFiltros} className="mb-4" />

        <div className="mb-4 grid grid-cols-1 gap-4 xl:grid-cols-2" data-onboarding="financas-cards">
          <CardRadialFinancas
            titulo="Receitas"
            descricao="recebidas até o momento"
            parcial={receitaRecebida}
            total={receitaTotalAlvo}
            tipo="incoming"
            carregando={carregando}
            valoresOcultos={valoresOcultos}
          />
          <CardRadialFinancas
            titulo="Despesas"
            descricao="pagas até o momento"
            parcial={despesaPaga}
            total={despesaTotalAlvo}
            tipo="outcoming"
            carregando={carregando}
            valoresOcultos={valoresOcultos}
          />
        </div>

        {filtroRapido === 'a-receber' ? (
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <ListaPedidosNaoPagos
              pedidos={pedidosNaoPagos}
              total={resumo.pedidosNaoPagosTotal}
              carregando={carregando}
            />
            <ListaCrediarioPendente
              crediarios={crediarios}
              total={resumo.crediarioAberto}
              carregando={carregando}
            />
          </div>
        ) : (
          <div data-onboarding="financas-lancamentos">
            <ListaMovimentacoes
              movimentacoes={movimentacoesFiltradas}
              carregando={carregando}
              onRemover={removerMovimentacao}
              onEditar={setEditando}
              onVisualizar={handleVisualizar}
              embutido
            />
          </div>
        )}
          </>
        )}
      </div>

      <ModalMovimentacao
        tipo={editando?.tipo ?? 'entrada'}
        categorias={categorias}
        movimentacao={editando}
        open={Boolean(editando)}
        onOpenChange={(aberto) => {
          if (!aberto) setEditando(null)
        }}
        onSubmit={async (entrada) => {
          if (!editando) return
          await atualizarMovimentacao(editando.id, entrada)
          setEditando(null)
        }}
      />

      <Tabs defaultValue="analise" className="space-y-4">
        <TabsList
          className="inline-flex h-10 rounded-lg border border-border/70 bg-card p-1"
          data-onboarding="financas-tabs"
        >
          <TabsTrigger value="analise" className="h-8 rounded-md px-3 text-xs font-medium">
            Análise
          </TabsTrigger>
          <TabsTrigger value="pagamentos" className="h-8 rounded-md px-3 text-xs font-medium">
            Pagamentos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="analise" className="space-y-5">
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <GraficoFluxoCaixa dados={fluxoCaixa} carregando={carregando} />
            </div>
            <GraficoComposicao dados={composicaoReceita} total={totalReceitaPeriodo} carregando={carregando} />
          </div>
          <GraficoLucroMensal dados={resumoMensal} carregando={carregando} />
          <ResumoLucroProdutos
            resumo={resumoLucro}
            produtos={lucroProdutos}
            carregando={carregando}
            erro={erroLucro}
            valoresOcultos={valoresOcultos}
          />
          {!valoresOcultos ? (
            <p className="text-xs text-muted-foreground">
              {resumo.pedidosCount} pedidos · ticket {formatarMoeda(resumo.ticketMedio)} · a receber{' '}
              {formatarMoeda(resumo.aReceberTotal)}
            </p>
          ) : null}
        </TabsContent>

        <TabsContent value="pagamentos">
          <ListaPagamentos pagamentos={pagamentos} pedidos={pedidos} carregando={carregando} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
