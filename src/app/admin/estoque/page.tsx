'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { AlertTriangle, ChevronRight, History, Package, RefreshCw, Search } from 'lucide-react'
import ProtectedRoute from '@/components/admin/ProtectedRoute'
import AdminLayout from '@/components/admin/AdminLayout'
import Interruptor from '@/components/admin/Interruptor'
import { ControleEstoqueProduto } from '@/components/admin/estoque/ControleEstoqueProduto'
import { FiltroEstoqueAdmin } from '@/components/admin/estoque/FiltroEstoqueAdmin'
import {
  buscarMovimentacoes,
  ListaCompactaMovimentacoes,
  MovimentacoesEstoque,
  Saldo,
  type Movimentacao,
} from '@/components/admin/estoque/MovimentacoesEstoque'
import { CHIP_FILTRO_ALERTA, CHIP_FILTRO_DEFAULT } from '@/components/admin/filtros/chip-classes'
import { FiltrosAtivosChips, type ChipFiltroAtivo } from '@/components/admin/filtros/FiltrosAtivosChips'
import { ListaVazia, TabelaSkeleton } from '@/components/admin/filtros/ListaEstado'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ModalSheet } from '@/components/ui/modal-sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { PaginacaoFinancas } from '@/features/financas/components/PaginacaoFinancas'
import {
  COLUNAS_ESTOQUE_ADMIN,
  formatarMoedaEstoque,
  mapearLinhaEstoque,
  situacaoDeProduto,
  type ProdutoComEstoque,
  type SituacaoEstoque,
} from '@/lib/estoque'
import { combinarItensEstoque, produtoCorrespondeBuscaEstoque } from '@/lib/estoque-produto.mjs'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

const LIMITE_PADRAO = 15
const LIMITES_PAGINA = [15, 30, 50, 100] as const

type Estado = SituacaoEstoque | 'negativo'
type FiltroEstado = 'todos' | Estado
type Aba = 'saldo' | 'movimentacoes'

const ROTULO_ESTADO: Record<Estado, string> = {
  negativo: 'Negativo',
  esgotado: 'Esgotado',
  baixo: 'Baixo',
  em_estoque: 'Em estoque',
}

const estadoDe = (produto: ProdutoComEstoque): Estado =>
  produto.estoque_quantidade < 0 ? 'negativo' : situacaoDeProduto(produto)

const EstadoEstoque = ({ estado }: { estado: Estado }) => (
  <span
    className={cn(
      'inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium',
      estado === 'negativo' && 'text-destructive',
      estado === 'esgotado' && 'text-muted-foreground',
      estado === 'baixo' && 'text-amber-700 dark:text-amber-400',
      estado === 'em_estoque' && 'text-muted-foreground',
    )}
  >
    <span
      aria-hidden
      className={cn(
        'h-1.5 w-1.5 rounded-full',
        estado === 'negativo' && 'bg-destructive',
        estado === 'esgotado' && 'bg-muted-foreground/60',
        estado === 'baixo' && 'bg-amber-500',
        estado === 'em_estoque' && 'bg-emerald-500',
      )}
    />
    {ROTULO_ESTADO[estado]}
  </span>
)

type DetalheItemProps = {
  produto: ProdutoComEstoque | null
  salvandoBloqueio: boolean
  onFechar: () => void
  onQuantidadeConfirmada: (produto: ProdutoComEstoque, quantidade: number) => void
  onBloqueioSite: (produto: ProdutoComEstoque, bloquear: boolean) => void
  onVerHistorico: (produto: ProdutoComEstoque) => void
}

const DetalheItemEstoque = ({
  produto,
  salvandoBloqueio,
  onFechar,
  onQuantidadeConfirmada,
  onBloqueioSite,
  onVerHistorico,
}: DetalheItemProps) => {
  const [recentes, setRecentes] = useState<Movimentacao[] | null>(null)
  const [erroRecentes, setErroRecentes] = useState(false)
  const produtoId = produto?.id
  const saldo = produto?.estoque_quantidade

  useEffect(() => {
    if (!produtoId) return
    let ativo = true
    setErroRecentes(false)
    buscarMovimentacoes({ itemId: produtoId, limite: 6 })
      .then((resultado) => {
        if (ativo) setRecentes(resultado.movimentacoes)
      })
      .catch(() => {
        if (ativo) setErroRecentes(true)
      })
    return () => {
      ativo = false
    }
  }, [produtoId, saldo])

  useEffect(() => {
    if (!produtoId) setRecentes(null)
  }, [produtoId])

  return (
    <ModalSheet
      open={Boolean(produto)}
      onOpenChange={(aberto) => {
        if (!aberto) onFechar()
      }}
      title={produto ? `Estoque de ${produto.nome}` : 'Estoque'}
      className="sm:max-w-md"
    >
      {produto ? (
        <div className="max-h-[85dvh] overflow-y-auto">
          <div className="space-y-1 border-b border-border/60 p-5 pr-12">
            <p className="text-xs text-muted-foreground">{produto.categoria || 'Sem categoria'}</p>
            <h2 className="text-base font-semibold leading-snug">{produto.nome}</h2>
          </div>

          <div className="space-y-5 p-5">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Saldo atual</p>
                <Saldo valor={produto.estoque_quantidade} className="text-3xl leading-tight" />
              </div>
              <EstadoEstoque estado={estadoDe(produto)} />
            </div>

            {produto.estoque_quantidade < 0 ? (
              <p className="rounded-lg bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
                Foram vendidas {Math.abs(produto.estoque_quantidade)} unidades além do estoque. Reponha ou ajuste a contagem.
              </p>
            ) : null}

            <ControleEstoqueProduto
              produtoId={produto.id}
              tabela={produto.tabela}
              quantidade={produto.estoque_quantidade}
              nomeProduto={produto.nome}
              onQuantidadeConfirmada={(quantidade) => onQuantidadeConfirmada(produto, quantidade)}
            />

            <div className="flex items-start justify-between gap-4 rounded-lg border border-border/70 p-3">
              <div>
                <p className="text-sm font-medium">Esgotado no site</p>
                <p className="text-xs text-muted-foreground">
                  Sem saldo, o item some do cardápio online. Pedidos no balcão continuam liberados.
                </p>
              </div>
              <Interruptor
                ativado={produto.bloquear_venda_sem_estoque}
                aoAlternar={(bloquear) => onBloqueioSite(produto, bloquear)}
                desabilitado={salvandoBloqueio}
                tamanho="md"
                aria-label={`${produto.bloquear_venda_sem_estoque ? 'Desativar' : 'Ativar'} esgotado automático no site para ${produto.nome}`}
              />
            </div>

            <dl className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Mínimo</dt>
                <dd className="font-mono tabular-nums">{produto.estoque_minimo}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Venda</dt>
                <dd className="font-mono tabular-nums">{formatarMoedaEstoque(produto.preco)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Custo</dt>
                <dd className="font-mono tabular-nums">{formatarMoedaEstoque(produto.custo_unitario)}</dd>
              </div>
            </dl>

            <section>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Últimas movimentações</h3>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-9 px-2 text-muted-foreground"
                  onClick={() => onVerHistorico(produto)}
                >
                  Ver tudo
                  <ChevronRight className="ml-1 h-4 w-4" aria-hidden />
                </Button>
              </div>
              {erroRecentes ? (
                <p className="py-3 text-sm text-muted-foreground">Não foi possível carregar as movimentações.</p>
              ) : recentes === null ? (
                <div className="space-y-2 py-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : recentes.length === 0 ? (
                <p className="py-3 text-sm text-muted-foreground">Nenhuma movimentação registrada ainda.</p>
              ) : (
                <ListaCompactaMovimentacoes movimentacoes={recentes} mostrarProduto={false} />
              )}
            </section>
          </div>
        </div>
      ) : null}
    </ModalSheet>
  )
}

const PainelEstoque = () => {
  const searchParams = useSearchParams()
  const produtoDeepLink = searchParams.get('produto')
  const [aba, setAba] = useState<Aba>('saldo')
  const [produtos, setProdutos] = useState<ProdutoComEstoque[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [buscaDigitada, setBuscaDigitada] = useState('')
  const [busca, setBusca] = useState('')
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('todos')
  const [categoria, setCategoria] = useState('todas')
  const [pagina, setPagina] = useState(1)
  const [itensPorPagina, setItensPorPagina] = useState<number>(LIMITE_PADRAO)
  const [produtoDestacado, setProdutoDestacado] = useState<string | null>(null)
  const [produtoSalvandoBloqueio, setProdutoSalvandoBloqueio] = useState<string | null>(null)
  const [detalhe, setDetalhe] = useState<{ id: string; tabela: ProdutoComEstoque['tabela'] } | null>(null)
  const [produtoHistorico, setProdutoHistorico] = useState<string | null>(null)
  const canalIdRef = useRef(`estoque-catalogo-${Math.random().toString(36).slice(2)}`)
  const deepLinkAplicadoRef = useRef<string | null>(null)

  const carregarProdutos = useCallback(async (silencioso = false) => {
    if (!silencioso) setCarregando(true)
    setErro(null)
    try {
      const [consultaProdutos, consultaBebidas] = await Promise.all([
        supabase.from('produtos').select(COLUNAS_ESTOQUE_ADMIN).order('nome', { ascending: true }),
        supabase.from('bebidas').select(COLUNAS_ESTOQUE_ADMIN).order('nome', { ascending: true }),
      ])
      if (consultaProdutos.error) throw consultaProdutos.error
      if (consultaBebidas.error) throw consultaBebidas.error
      setProdutos(combinarItensEstoque(
        (consultaProdutos.data || []).map((linha) =>
          mapearLinhaEstoque(linha as Record<string, unknown>, 'produtos'),
        ),
        (consultaBebidas.data || []).map((linha) =>
          mapearLinhaEstoque(linha as Record<string, unknown>, 'bebidas'),
        ),
      ))
    } catch (falha) {
      console.error('[Estoque] Falha ao carregar produtos:', falha)
      setErro('Não foi possível carregar o estoque. Tente novamente.')
    } finally {
      if (!silencioso) setCarregando(false)
    }
  }, [])

  useEffect(() => {
    void carregarProdutos(false)
  }, [carregarProdutos])

  useEffect(() => {
    const timer = window.setTimeout(() => setBusca(buscaDigitada), 200)
    return () => window.clearTimeout(timer)
  }, [buscaDigitada])

  useEffect(() => {
    const aplicarMudanca = (payload: { eventType: string; old: unknown; new: unknown }, tabela: 'produtos' | 'bebidas') => {
      const evento = payload.eventType
      if (evento === 'DELETE') {
        const idRemovido = String((payload.old as { id?: string } | null)?.id || '')
        if (!idRemovido) return
        setProdutos((atual) => atual.filter((produto) => !(produto.id === idRemovido && produto.tabela === tabela)))
        return
      }
      const linha = payload.new as Record<string, unknown> | null
      if (!linha?.id) return
      const atualizado = mapearLinhaEstoque(linha, tabela)
      setProdutos((atual) => {
        const existe = atual.some((produto) => produto.id === atualizado.id && produto.tabela === tabela)
        if (!existe) return combinarItensEstoque(
          tabela === 'produtos' ? [...atual.filter((item) => item.tabela === 'produtos'), atualizado] : atual.filter((item) => item.tabela === 'produtos'),
          tabela === 'bebidas' ? [...atual.filter((item) => item.tabela === 'bebidas'), atualizado] : atual.filter((item) => item.tabela === 'bebidas'),
        )
        return atual.map((produto) =>
          produto.id === atualizado.id && produto.tabela === tabela ? { ...produto, ...atualizado } : produto,
        )
      })
    }

    const canal = supabase
      .channel(canalIdRef.current)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'produtos' }, (payload) => {
        aplicarMudanca(payload, 'produtos')
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bebidas' }, (payload) => {
        aplicarMudanca(payload, 'bebidas')
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(canal)
    }
  }, [])

  const resumo = useMemo(() => {
    const contagem: Record<Estado, number> = { negativo: 0, esgotado: 0, baixo: 0, em_estoque: 0 }
    for (const produto of produtos) contagem[estadoDe(produto)] += 1
    return contagem
  }, [produtos])

  const categorias = useMemo(
    () =>
      Array.from(new Set(produtos.map((produto) => produto.categoria).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, 'pt-BR'),
      ),
    [produtos],
  )

  const produtosFiltrados = useMemo(() => {
    return produtos.filter((produto) => {
      if (!produtoCorrespondeBuscaEstoque(produto, busca)) return false
      if (categoria !== 'todas' && produto.categoria !== categoria) return false
      if (filtroEstado !== 'todos' && estadoDe(produto) !== filtroEstado) return false
      return true
    })
  }, [busca, categoria, filtroEstado, produtos])

  const totalPaginas = Math.max(1, Math.ceil(produtosFiltrados.length / itensPorPagina))
  const paginaSegura = Math.min(pagina, totalPaginas)
  const produtosPagina = produtosFiltrados.slice(
    (paginaSegura - 1) * itensPorPagina,
    paginaSegura * itensPorPagina,
  )

  const produtoDetalhe = detalhe
    ? produtos.find((produto) => produto.id === detalhe.id && produto.tabela === detalhe.tabela) || null
    : null

  useEffect(() => {
    setPagina(1)
  }, [busca, categoria, filtroEstado, itensPorPagina])

  useEffect(() => {
    if (filtroEstado === 'negativo' && resumo.negativo === 0) setFiltroEstado('todos')
  }, [filtroEstado, resumo.negativo])

  useEffect(() => {
    if (!produtoDeepLink || produtos.length === 0) return
    if (deepLinkAplicadoRef.current === produtoDeepLink) return
    const indiceAlvo = produtos.findIndex((produto) => produto.id === produtoDeepLink)
    if (indiceAlvo < 0) return
    deepLinkAplicadoRef.current = produtoDeepLink
    setAba('saldo')
    setBuscaDigitada('')
    setBusca('')
    setFiltroEstado('todos')
    setCategoria('todas')
    setPagina(Math.floor(indiceAlvo / itensPorPagina) + 1)
    setProdutoDestacado(produtoDeepLink)
  }, [itensPorPagina, produtoDeepLink, produtos])

  useEffect(() => {
    if (!produtoDestacado) return
    const linha =
      document.getElementById(`estoque-produto-m-${produtoDestacado}`) ||
      document.getElementById(`estoque-produto-d-${produtoDestacado}`)
    const container = document.querySelector('[data-admin-scroll-container]')
    if (linha instanceof HTMLElement) {
      const topo = linha.getBoundingClientRect().top
      const origem = container instanceof HTMLElement ? container.getBoundingClientRect().top : 0
      if (container instanceof HTMLElement) {
        container.scrollTo({ top: container.scrollTop + topo - origem - 24, behavior: 'auto' })
      } else {
        linha.scrollIntoView({ behavior: 'auto', block: 'center' })
      }
    }
  }, [produtoDestacado, paginaSegura, produtosPagina])

  const handleQuantidadeConfirmada = (
    produtoId: string,
    tabela: ProdutoComEstoque['tabela'],
    quantidade: number,
  ) => {
    setProdutos((atual) =>
      atual.map((produto) =>
        produto.id === produtoId && produto.tabela === tabela
          ? { ...produto, estoque_quantidade: quantidade }
          : produto,
      ),
    )
  }

  const handleBloqueioSite = async (produto: ProdutoComEstoque, bloquear: boolean) => {
    if (produtoSalvandoBloqueio) return
    setProdutoSalvandoBloqueio(produto.id)
    setProdutos((atual) =>
      atual.map((item) =>
        item.id === produto.id && item.tabela === produto.tabela
          ? { ...item, bloquear_venda_sem_estoque: bloquear }
          : item,
      ),
    )
    try {
      const { error } = await supabase
        .from(produto.tabela)
        .update({ bloquear_venda_sem_estoque: bloquear })
        .eq('id', produto.id)
      if (error) throw error
      toast.success(bloquear ? 'Esgotado automático ativado no site.' : 'Esgotado automático desativado no site.')
    } catch (falha) {
      setProdutos((atual) =>
        atual.map((item) =>
          item.id === produto.id && item.tabela === produto.tabela
            ? { ...item, bloquear_venda_sem_estoque: produto.bloquear_venda_sem_estoque }
            : item,
        ),
      )
      console.error('[Estoque] Falha ao alterar bloqueio no site:', falha)
      toast.error('Não foi possível alterar a exibição de esgotado no site.')
    } finally {
      setProdutoSalvandoBloqueio(null)
    }
  }

  const chips: ChipFiltroAtivo[] = []
  if (busca.trim()) chips.push({ key: 'busca', label: 'Busca', value: busca.trim() })
  if (filtroEstado !== 'todos') chips.push({ key: 'estado', label: 'Estado', value: ROTULO_ESTADO[filtroEstado] })
  if (categoria !== 'todas') chips.push({ key: 'categoria', label: 'Categoria', value: categoria })

  const handleLimparFiltros = () => {
    setBuscaDigitada('')
    setBusca('')
    setFiltroEstado('todos')
    setCategoria('todas')
  }

  const abrirDetalhe = (produto: ProdutoComEstoque) => setDetalhe({ id: produto.id, tabela: produto.tabela })

  const verHistorico = (produto: ProdutoComEstoque) => {
    setDetalhe(null)
    setProdutoHistorico(produto.id)
    setAba('movimentacoes')
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 pb-8">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight">Estoque</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {carregando && produtos.length === 0 ? (
              'Carregando…'
            ) : (
              <>
                {produtos.length} itens
                {resumo.negativo > 0 ? (
                  <> · <span className="font-medium text-destructive">{resumo.negativo} negativos</span></>
                ) : null}
                {' · '}
                {resumo.esgotado} esgotados · {resumo.baixo} com estoque baixo
              </>
            )}
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-10 w-10 shrink-0"
          onClick={() => void carregarProdutos(false)}
          disabled={carregando}
          aria-label="Atualizar estoque"
        >
          <RefreshCw className={cn('h-4 w-4', carregando && 'animate-spin')} />
        </Button>
      </header>

      {resumo.negativo > 0 && aba === 'saldo' && filtroEstado !== 'negativo' ? (
        <button
          type="button"
          onClick={() => setFiltroEstado('negativo')}
          className="flex w-full items-center gap-3 rounded-lg border border-destructive/25 bg-destructive/5 px-4 py-3 text-left text-sm transition-colors hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40"
        >
          <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="font-medium text-destructive">
              {resumo.negativo === 1 ? '1 item vendido sem estoque.' : `${resumo.negativo} itens vendidos sem estoque.`}
            </span>{' '}
            <span className="text-muted-foreground">Reponha ou ajuste a contagem.</span>
          </span>
          <span className="shrink-0 font-medium text-destructive">Ver</span>
        </button>
      ) : null}

      <Tabs value={aba} onValueChange={(valor) => setAba(valor as Aba)} className="space-y-4">
        <TabsList className="h-10">
          <TabsTrigger value="saldo" className="h-8 px-4">
            <Package className="mr-2 h-4 w-4" aria-hidden />
            Saldo
          </TabsTrigger>
          <TabsTrigger value="movimentacoes" className="h-8 px-4">
            <History className="mr-2 h-4 w-4" aria-hidden />
            Movimentações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="saldo" className="mt-0 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={buscaDigitada}
                onChange={(evento) => setBuscaDigitada(evento.target.value)}
                placeholder="Buscar produto"
                className="h-10 border-border/70 pl-9 shadow-none"
                aria-label="Buscar produtos no estoque"
              />
            </div>
            <FiltroEstoqueAdmin
              valor={{ categoria }}
              categorias={categorias}
              onChange={(proximo) => {
                if (proximo.categoria) setCategoria(proximo.categoria)
              }}
              onLimpar={handleLimparFiltros}
              hasFilter={chips.length > 0}
            />
          </div>

          <div className="w-full overflow-x-auto">
            <ToggleGroup
              type="single"
              value={filtroEstado}
              onValueChange={(valor) => {
                if (valor) setFiltroEstado(valor as FiltroEstado)
              }}
              aria-label="Filtro de estado do estoque"
              className="flex w-max items-center justify-start gap-1.5"
            >
              <ToggleGroupItem value="todos" className={CHIP_FILTRO_DEFAULT}>Todos</ToggleGroupItem>
              {resumo.negativo > 0 ? (
                <ToggleGroupItem value="negativo" className={CHIP_FILTRO_ALERTA}>
                  Negativos · {resumo.negativo}
                </ToggleGroupItem>
              ) : null}
              <ToggleGroupItem value="esgotado" className={CHIP_FILTRO_DEFAULT}>Esgotados</ToggleGroupItem>
              <ToggleGroupItem value="baixo" className={CHIP_FILTRO_DEFAULT}>Estoque baixo</ToggleGroupItem>
              <ToggleGroupItem value="em_estoque" className={CHIP_FILTRO_DEFAULT}>Em estoque</ToggleGroupItem>
            </ToggleGroup>
          </div>

          <FiltrosAtivosChips chips={chips} onLimpar={handleLimparFiltros} />

          {erro ? (
            <div className="flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
              <p className="text-destructive">{erro}</p>
              <Button type="button" variant="outline" className="h-10 shadow-none" onClick={() => void carregarProdutos(false)}>
                Tentar novamente
              </Button>
            </div>
          ) : null}

          {carregando && produtos.length === 0 ? (
            <TabelaSkeleton linhas={8} />
          ) : produtos.length === 0 && !erro ? (
            <ListaVazia
              icone={<Package className="h-5 w-5" />}
              titulo="Nenhum produto cadastrado"
              descricao="Cadastre produtos no cardápio para controlar o estoque."
            />
          ) : produtosFiltrados.length === 0 && !erro ? (
            <ListaVazia
              icone={<Search className="h-5 w-5" />}
              titulo="Nenhum produto encontrado"
              descricao="Ajuste a busca ou limpe os filtros."
              acao={
                <Button type="button" variant="outline" className="h-10 shadow-none" onClick={handleLimparFiltros}>
                  Limpar filtros
                </Button>
              }
            />
          ) : produtosFiltrados.length > 0 ? (
            <>
              <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/70 bg-card md:hidden">
                {produtosPagina.map((produto) => (
                  <li key={`${produto.tabela}-${produto.id}`} id={`estoque-produto-m-${produto.id}`}>
                    <button
                      type="button"
                      onClick={() => abrirDetalhe(produto)}
                      className={cn(
                        'flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left transition-colors active:bg-muted/60',
                        produtoDestacado === produto.id && 'bg-primary/5',
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{produto.nome}</p>
                        <div className="mt-0.5 flex items-center gap-2">
                          <EstadoEstoque estado={estadoDe(produto)} />
                          <span className="truncate text-xs text-muted-foreground">{produto.categoria}</span>
                        </div>
                      </div>
                      <Saldo valor={produto.estoque_quantidade} className="text-lg" />
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>

              <div className="hidden overflow-hidden rounded-xl border border-border/70 bg-card md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="pl-4">Produto</TableHead>
                      <TableHead className="w-24 text-right">Saldo</TableHead>
                      <TableHead className="w-20 text-right">Mínimo</TableHead>
                      <TableHead className="w-32">Estado</TableHead>
                      <TableHead className="w-[17rem]">Ajuste rápido</TableHead>
                      <TableHead className="w-12"><span className="sr-only">Detalhes</span></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {produtosPagina.map((produto) => (
                      <TableRow
                        key={`${produto.tabela}-${produto.id}`}
                        id={`estoque-produto-d-${produto.id}`}
                        className={cn(produtoDestacado === produto.id && 'bg-primary/5')}
                      >
                        <TableCell className="pl-4">
                          <button
                            type="button"
                            onClick={() => abrirDetalhe(produto)}
                            className="block max-w-[22rem] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <span className="block truncate font-medium hover:underline">{produto.nome}</span>
                            <span className="block truncate text-xs text-muted-foreground">{produto.categoria}</span>
                          </button>
                        </TableCell>
                        <TableCell className="text-right">
                          <Saldo valor={produto.estoque_quantidade} className="text-base" />
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                          {produto.estoque_minimo}
                        </TableCell>
                        <TableCell><EstadoEstoque estado={estadoDe(produto)} /></TableCell>
                        <TableCell>
                          <ControleEstoqueProduto
                            produtoId={produto.id}
                            tabela={produto.tabela}
                            quantidade={produto.estoque_quantidade}
                            nomeProduto={produto.nome}
                            onQuantidadeConfirmada={(quantidade) =>
                              handleQuantidadeConfirmada(produto.id, produto.tabela, quantidade)
                            }
                          />
                        </TableCell>
                        <TableCell className="pr-3">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9"
                            onClick={() => abrirDetalhe(produto)}
                            aria-label={`Detalhes e movimentações de ${produto.nome}`}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <PaginacaoFinancas
                paginaAtual={paginaSegura}
                totalPaginas={totalPaginas}
                totalItens={produtosFiltrados.length}
                itensPorPagina={itensPorPagina}
                onPaginaChange={setPagina}
                onItensPorPaginaChange={(quantidade) => {
                  if ((LIMITES_PAGINA as readonly number[]).includes(quantidade)) {
                    setItensPorPagina(quantidade)
                  }
                }}
                carregando={carregando}
              />
            </>
          ) : null}
        </TabsContent>

        <TabsContent value="movimentacoes" className="mt-0">
          <MovimentacoesEstoque
            itens={produtos}
            produtoId={produtoHistorico}
            onProdutoChange={setProdutoHistorico}
          />
        </TabsContent>
      </Tabs>

      <DetalheItemEstoque
        produto={produtoDetalhe}
        salvandoBloqueio={produtoSalvandoBloqueio !== null}
        onFechar={() => setDetalhe(null)}
        onQuantidadeConfirmada={(produto, quantidade) => handleQuantidadeConfirmada(produto.id, produto.tabela, quantidade)}
        onBloqueioSite={(produto, bloquear) => void handleBloqueioSite(produto, bloquear)}
        onVerHistorico={verHistorico}
      />
    </div>
  )
}

export default function EstoquePage() {
  return (
    <ProtectedRoute>
      <AdminLayout>
        <Suspense fallback={null}>
          <PainelEstoque />
        </Suspense>
      </AdminLayout>
    </ProtectedRoute>
  )
}
