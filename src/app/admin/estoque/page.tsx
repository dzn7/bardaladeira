'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import {
  AlertTriangle,
  CheckCircle2,
  Package,
  RefreshCw,
  Search,
  XCircle,
} from 'lucide-react'
import ProtectedRoute from '@/components/admin/ProtectedRoute'
import AdminLayout from '@/components/admin/AdminLayout'
import Interruptor from '@/components/admin/Interruptor'
import { ControleEstoqueProduto } from '@/components/admin/estoque/ControleEstoqueProduto'
import { FiltroEstoqueAdmin } from '@/components/admin/estoque/FiltroEstoqueAdmin'
import { CHIP_FILTRO_DEFAULT } from '@/components/admin/filtros/chip-classes'
import { FiltrosAtivosChips, type ChipFiltroAtivo } from '@/components/admin/filtros/FiltrosAtivosChips'
import { ListaVazia, TabelaSkeleton } from '@/components/admin/filtros/ListaEstado'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { PaginacaoFinancas } from '@/features/financas/components/PaginacaoFinancas'
import {
  COLUNAS_ESTOQUE_ADMIN,
  formatarMoedaEstoque,
  mapearLinhaEstoque,
  rotuloSituacaoEstoque,
  situacaoDeProduto,
  type ProdutoComEstoque,
  type SituacaoEstoque,
} from '@/lib/estoque'
import { combinarItensEstoque, produtoCorrespondeBuscaEstoque } from '@/lib/estoque-produto.mjs'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

const LIMITE_PADRAO = 15
const LIMITES_PAGINA = [15, 30, 50, 100] as const

type FiltroSituacao = 'todos' | SituacaoEstoque

const BadgeSituacao = ({ situacao }: { situacao: SituacaoEstoque }) => {
  const Icone = situacao === 'esgotado' ? XCircle : situacao === 'baixo' ? AlertTriangle : CheckCircle2
  const variant = situacao === 'esgotado' ? 'destructive' : situacao === 'baixo' ? 'warning' : 'success'
  return (
    <Badge variant={variant} className="gap-1">
      <Icone className="h-3 w-3" aria-hidden />
      {rotuloSituacaoEstoque(situacao)}
    </Badge>
  )
}

const PainelEstoque = () => {
  const searchParams = useSearchParams()
  const produtoDeepLink = searchParams.get('produto')
  const [produtos, setProdutos] = useState<ProdutoComEstoque[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [buscaDigitada, setBuscaDigitada] = useState('')
  const [busca, setBusca] = useState('')
  const [filtroSituacao, setFiltroSituacao] = useState<FiltroSituacao>('todos')
  const [categoria, setCategoria] = useState('todas')
  const [pagina, setPagina] = useState(1)
  const [itensPorPagina, setItensPorPagina] = useState<number>(LIMITE_PADRAO)
  const [produtoDestacado, setProdutoDestacado] = useState<string | null>(null)
  const [produtoSalvandoBloqueio, setProdutoSalvandoBloqueio] = useState<string | null>(null)
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
    let emEstoque = 0
    let baixo = 0
    let esgotado = 0
    for (const produto of produtos) {
      const situacao = situacaoDeProduto(produto)
      if (situacao === 'esgotado') esgotado += 1
      else if (situacao === 'baixo') baixo += 1
      else emEstoque += 1
    }
    return { emEstoque, baixo, esgotado }
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
      if (filtroSituacao !== 'todos' && situacaoDeProduto(produto) !== filtroSituacao) return false
      return true
    })
  }, [busca, categoria, filtroSituacao, produtos])

  const totalPaginas = Math.max(1, Math.ceil(produtosFiltrados.length / itensPorPagina))
  const paginaSegura = Math.min(pagina, totalPaginas)
  const produtosPagina = produtosFiltrados.slice(
    (paginaSegura - 1) * itensPorPagina,
    paginaSegura * itensPorPagina,
  )

  useEffect(() => {
    setPagina(1)
  }, [busca, categoria, filtroSituacao, itensPorPagina])

  useEffect(() => {
    if (!produtoDeepLink || produtos.length === 0) return
    if (deepLinkAplicadoRef.current === produtoDeepLink) return
    const indiceAlvo = produtos.findIndex((produto) => produto.id === produtoDeepLink)
    if (indiceAlvo < 0) return
    deepLinkAplicadoRef.current = produtoDeepLink
    setBuscaDigitada('')
    setBusca('')
    setFiltroSituacao('todos')
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
  if (filtroSituacao !== 'todos') {
    chips.push({ key: 'situacao', label: 'Estado', value: rotuloSituacaoEstoque(filtroSituacao) })
  }
  if (categoria !== 'todas') chips.push({ key: 'categoria', label: 'Categoria', value: categoria })

  const handleLimparFiltros = () => {
    setBuscaDigitada('')
    setBusca('')
    setFiltroSituacao('todos')
    setCategoria('todas')
  }

  const renderControles = (produto: ProdutoComEstoque) => (
    <ControleEstoqueProduto
      produtoId={produto.id}
      tabela={produto.tabela}
      quantidade={produto.estoque_quantidade}
      nomeProduto={produto.nome}
      onQuantidadeConfirmada={(quantidade) =>
        handleQuantidadeConfirmada(produto.id, produto.tabela, quantidade)
      }
    />
  )

  const renderBloqueioSite = (produto: ProdutoComEstoque) => (
    <div className="flex items-center gap-2">
      <Interruptor
        ativado={produto.bloquear_venda_sem_estoque}
        aoAlternar={(bloquear) => void handleBloqueioSite(produto, bloquear)}
        desabilitado={produtoSalvandoBloqueio !== null}
        tamanho="md"
        aria-label={`${produto.bloquear_venda_sem_estoque ? 'Desativar' : 'Ativar'} esgotado automático no site para ${produto.nome}`}
      />
      <span className="text-xs text-muted-foreground">Esgotado no site</span>
    </div>
  )

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 pb-8">
      <section className="rounded-xl border border-border/70 bg-card p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" aria-hidden />
              <h1 className="text-lg font-semibold tracking-tight">Estoque</h1>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Controle operacional de quantidade, custo e alerta. Esta tela não é uma barreira de segurança.
            </p>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <span>
                Em estoque{' '}
                <strong className="tabular-nums">{resumo.emEstoque}</strong>
              </span>
              <span>
                Estoque baixo{' '}
                <strong className="tabular-nums">{resumo.baixo}</strong>
              </span>
              <span>
                Esgotados{' '}
                <strong className="tabular-nums">{resumo.esgotado}</strong>
              </span>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            className="h-11 shadow-none"
            onClick={() => void carregarProdutos(false)}
            disabled={carregando}
          >
            <RefreshCw className={cn('mr-2 h-4 w-4', carregando && 'animate-spin')} />
            Atualizar
          </Button>
        </div>
      </section>

      <section className="rounded-xl border border-border/70 bg-card p-3.5 shadow-sm md:p-5">
        <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={buscaDigitada}
              onChange={(evento) => setBuscaDigitada(evento.target.value)}
              placeholder="Buscar por nome ou categoria"
              className="h-11 border-border/70 pl-9 shadow-none"
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

        <div className="mb-3 w-full overflow-x-auto">
          <ToggleGroup
            type="single"
            value={filtroSituacao}
            onValueChange={(valor) => {
              if (valor) setFiltroSituacao(valor as FiltroSituacao)
            }}
            aria-label="Filtro de estado do estoque"
            className="flex w-max items-center justify-start gap-2"
          >
            <ToggleGroupItem value="todos" className={CHIP_FILTRO_DEFAULT}>
              Todos
            </ToggleGroupItem>
            <ToggleGroupItem value="em_estoque" className={CHIP_FILTRO_DEFAULT}>
              Em estoque
            </ToggleGroupItem>
            <ToggleGroupItem value="baixo" className={CHIP_FILTRO_DEFAULT}>
              Estoque baixo
            </ToggleGroupItem>
            <ToggleGroupItem value="esgotado" className={CHIP_FILTRO_DEFAULT}>
              Esgotados
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <FiltrosAtivosChips chips={chips} onLimpar={handleLimparFiltros} className="mb-4" />

        {erro ? (
          <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-3 text-sm">
            <p className="text-destructive">{erro}</p>
            <Button
              type="button"
              variant="outline"
              className="mt-2 h-11 shadow-none"
              onClick={() => void carregarProdutos(false)}
            >
              Tentar novamente
            </Button>
          </div>
        ) : null}

        {carregando && produtos.length === 0 ? (
          <TabelaSkeleton linhas={8} />
        ) : produtos.length === 0 ? (
          <ListaVazia
            icone={<Package className="h-5 w-5" />}
            titulo="Nenhum produto cadastrado"
            descricao="Cadastre produtos no cardápio para controlar o estoque."
          />
        ) : produtosFiltrados.length === 0 ? (
          <ListaVazia
            icone={<Search className="h-5 w-5" />}
            titulo="Nenhum produto encontrado"
            descricao="Ajuste a busca ou limpe os filtros para ver o estoque."
            acao={
              <Button type="button" variant="outline" className="h-11 shadow-none" onClick={handleLimparFiltros}>
                Limpar filtros
              </Button>
            }
          />
        ) : (
          <>
            <div className="space-y-3 md:hidden">
              {produtosPagina.map((produto) => {
                const situacao = situacaoDeProduto(produto)
                const destacado = produtoDestacado === produto.id
                return (
                  <article
                    key={produto.id}
                    id={`estoque-produto-m-${produto.id}`}
                    className={cn(
                      'rounded-xl border border-border/70 bg-card p-3.5',
                      destacado && 'ring-2 ring-primary',
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="truncate text-sm font-semibold">{produto.nome}</h2>
                        <p className="text-xs text-muted-foreground">{produto.categoria}</p>
                      </div>
                      <BadgeSituacao situacao={situacao} />
                    </div>
                    <p className="mt-2 font-mono text-lg tabular-nums">{produto.estoque_quantidade}</p>
                    <dl className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <div>
                        <dt>Venda</dt>
                        <dd className="font-medium text-foreground">{formatarMoedaEstoque(produto.preco)}</dd>
                      </div>
                      <div>
                        <dt>Custo</dt>
                        <dd className="font-medium text-foreground">{formatarMoedaEstoque(produto.custo_unitario)}</dd>
                      </div>
                      <div>
                        <dt>Mínimo</dt>
                        <dd className="font-medium text-foreground tabular-nums">{produto.estoque_minimo}</dd>
                      </div>
                    </dl>
                    <div className="mt-3 border-t border-border/60 pt-3">{renderBloqueioSite(produto)}</div>
                    <div className="mt-3">{renderControles(produto)}</div>
                  </article>
                )
              })}
            </div>

            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produto</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Venda</TableHead>
                    <TableHead>Custo</TableHead>
                    <TableHead>Quantidade</TableHead>
                    <TableHead>Mínimo</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Site</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {produtosPagina.map((produto) => {
                    const situacao = situacaoDeProduto(produto)
                    const destacado = produtoDestacado === produto.id
                    return (
                      <TableRow
                        key={produto.id}
                        id={`estoque-produto-d-${produto.id}`}
                        className={cn(destacado && 'bg-primary/5')}
                      >
                        <TableCell className="font-medium">{produto.nome}</TableCell>
                        <TableCell>{produto.categoria}</TableCell>
                        <TableCell className="font-mono tabular-nums">{formatarMoedaEstoque(produto.preco)}</TableCell>
                        <TableCell className="font-mono tabular-nums">{formatarMoedaEstoque(produto.custo_unitario)}</TableCell>
                        <TableCell className="font-mono tabular-nums">{produto.estoque_quantidade}</TableCell>
                        <TableCell className="tabular-nums">{produto.estoque_minimo}</TableCell>
                        <TableCell>
                          <BadgeSituacao situacao={situacao} />
                        </TableCell>
                        <TableCell>{renderBloqueioSite(produto)}</TableCell>
                        <TableCell>{renderControles(produto)}</TableCell>
                      </TableRow>
                    )
                  })}
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
        )}
      </section>
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
