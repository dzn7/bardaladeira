'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { ArrowsClockwise, MagnifyingGlass, Package, Warning, X } from '@phosphor-icons/react'
import ProtectedRoute from '@/components/admin/ProtectedRoute'
import AdminLayout from '@/components/admin/AdminLayout'
import { ControleEstoqueProduto } from '@/components/admin/estoque/ControleEstoqueProduto'
import {
  buscarMovimentacoes,
  ListaCompactaMovimentacoes,
  MovimentacoesEstoque,
  Saldo,
  type Movimentacao,
} from '@/components/admin/estoque/MovimentacoesEstoque'
import {
  Botao,
  CabecalhoPagina,
  Chip,
  Entrada,
  Esqueleto,
  Gaveta,
  LinhaInterruptor,
  Lista,
  ListaCarregando,
  ListaVazia,
  Pagina,
  Segmentos,
  Selecao,
  Selo,
} from '@/components/admin/ui'
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

type Estado = SituacaoEstoque | 'negativo'
type FiltroEstado = 'todos' | Estado
type Aba = 'saldo' | 'movimentacoes'

const ROTULO_ESTADO: Record<Estado, string> = {
  negativo: 'Negativo',
  esgotado: 'Esgotado',
  baixo: 'Baixo',
  em_estoque: 'Em estoque',
}

const TOM_ESTADO = { negativo: 'perigo', esgotado: 'neutro', baixo: 'alerta', em_estoque: 'sucesso' } as const

const estadoDe = (produto: ProdutoComEstoque): Estado =>
  produto.estoque_quantidade < 0 ? 'negativo' : situacaoDeProduto(produto)

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
    if (!produtoId) {
      setRecentes(null)
      return
    }
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

  const estado = produto ? estadoDe(produto) : null

  return (
    <Gaveta
      aberto={Boolean(produto)}
      aoFechar={onFechar}
      largura="lg"
      titulo={produto?.nome ?? 'Estoque'}
      descricao={
        produto && estado ? (
          <span className="flex flex-wrap items-center gap-2">
            <Selo tom={TOM_ESTADO[estado]}>{ROTULO_ESTADO[estado]}</Selo>
            <span>{produto.categoria || 'Sem categoria'}</span>
          </span>
        ) : undefined
      }
      rodape={
        produto ? (
          <Botao variante="contorno" onClick={() => onVerHistorico(produto)}>
            Ver todas as movimentações
          </Botao>
        ) : undefined
      }
    >
      {produto ? (
        <div className="space-y-6">
          <section className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">Saldo atual</p>
              <Saldo valor={produto.estoque_quantidade} className="text-4xl font-semibold tracking-tight" />
            </div>
            {produto.estoque_quantidade < 0 ? (
              <p className="text-sm text-destructive">
                {Math.abs(produto.estoque_quantidade)} {Math.abs(produto.estoque_quantidade) === 1 ? 'unidade vendida' : 'unidades vendidas'} além do estoque. Reponha ou ajuste a contagem.
              </p>
            ) : null}
            <ControleEstoqueProduto
              produtoId={produto.id}
              tabela={produto.tabela}
              quantidade={produto.estoque_quantidade}
              nomeProduto={produto.nome}
              onQuantidadeConfirmada={(quantidade) => onQuantidadeConfirmada(produto, quantidade)}
            />
            <p className="text-xs text-muted-foreground">Digite o saldo (aceita negativo) ou use − e +.</p>
          </section>

          <LinhaInterruptor
            titulo="Esgotado no site"
            descricao="Sem saldo, o item some do cardápio online. Balcão e garçom continuam vendendo."
            marcado={produto.bloquear_venda_sem_estoque}
            aoMudar={(bloquear) => onBloqueioSite(produto, bloquear)}
            desabilitado={salvandoBloqueio}
            rotuloAcessivel={`Esgotado no site para ${produto.nome}`}
          />

          <dl className="divide-y divide-border/70 rounded-xl border border-border/70">
            {[
              ['Mínimo', String(produto.estoque_minimo)],
              ['Preço de venda', formatarMoedaEstoque(produto.preco)],
              ['Custo', formatarMoedaEstoque(produto.custo_unitario)],
            ].map(([rotulo, valor]) => (
              <div key={rotulo} className="flex items-baseline justify-between gap-3 px-4 py-3">
                <dt className="text-sm text-muted-foreground">{rotulo}</dt>
                <dd className="font-medium tabular-nums">{valor}</dd>
              </div>
            ))}
          </dl>

          <section className="space-y-2">
            <h3 className="px-1 text-sm font-semibold">Últimas movimentações</h3>
            {erroRecentes ? (
              <p className="px-1 text-sm text-muted-foreground">Não foi possível carregar as movimentações.</p>
            ) : recentes === null ? (
              <div className="space-y-2">
                <Esqueleto className="h-14 w-full rounded-xl" />
                <Esqueleto className="h-14 w-full rounded-xl" />
              </div>
            ) : recentes.length === 0 ? (
              <p className="px-1 text-sm text-muted-foreground">Nenhuma movimentação registrada ainda.</p>
            ) : (
              <ListaCompactaMovimentacoes movimentacoes={recentes} mostrarProduto={false} />
            )}
          </section>
        </div>
      ) : null}
    </Gaveta>
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

  const carregarProdutos = useCallback(async () => {
    setCarregando(true)
    setErro(null)
    try {
      const [consultaProdutos, consultaBebidas] = await Promise.all([
        supabase.from('produtos').select(COLUNAS_ESTOQUE_ADMIN).order('nome', { ascending: true }),
        supabase.from('bebidas').select(COLUNAS_ESTOQUE_ADMIN).order('nome', { ascending: true }),
      ])
      if (consultaProdutos.error) throw consultaProdutos.error
      if (consultaBebidas.error) throw consultaBebidas.error
      setProdutos(combinarItensEstoque(
        (consultaProdutos.data || []).map((linha) => mapearLinhaEstoque(linha as Record<string, unknown>, 'produtos')),
        (consultaBebidas.data || []).map((linha) => mapearLinhaEstoque(linha as Record<string, unknown>, 'bebidas')),
      ))
    } catch (falha) {
      console.error('[Estoque] Falha ao carregar produtos:', falha)
      setErro('Não foi possível carregar o estoque.')
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    void carregarProdutos()
  }, [carregarProdutos])

  useEffect(() => {
    const timer = window.setTimeout(() => setBusca(buscaDigitada), 200)
    return () => window.clearTimeout(timer)
  }, [buscaDigitada])

  useEffect(() => {
    const aplicarMudanca = (payload: { eventType: string; old: unknown; new: unknown }, tabela: 'produtos' | 'bebidas') => {
      if (payload.eventType === 'DELETE') {
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
        if (!existe) {
          return combinarItensEstoque(
            [...atual.filter((item) => item.tabela === 'produtos'), ...(tabela === 'produtos' ? [atualizado] : [])],
            [...atual.filter((item) => item.tabela === 'bebidas'), ...(tabela === 'bebidas' ? [atualizado] : [])],
          )
        }
        return atual.map((produto) =>
          produto.id === atualizado.id && produto.tabela === tabela ? { ...produto, ...atualizado } : produto,
        )
      })
    }

    const canal = supabase
      .channel(canalIdRef.current)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'produtos' }, (payload) => aplicarMudanca(payload, 'produtos'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bebidas' }, (payload) => aplicarMudanca(payload, 'bebidas'))
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
    () => Array.from(new Set(produtos.map((produto) => produto.categoria).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [produtos],
  )

  const produtosFiltrados = useMemo(
    () => produtos.filter((produto) => {
      if (!produtoCorrespondeBuscaEstoque(produto, busca)) return false
      if (categoria !== 'todas' && produto.categoria !== categoria) return false
      if (filtroEstado !== 'todos' && estadoDe(produto) !== filtroEstado) return false
      return true
    }),
    [busca, categoria, filtroEstado, produtos],
  )

  const totalPaginas = Math.max(1, Math.ceil(produtosFiltrados.length / itensPorPagina))
  const paginaSegura = Math.min(pagina, totalPaginas)
  const produtosPagina = produtosFiltrados.slice((paginaSegura - 1) * itensPorPagina, paginaSegura * itensPorPagina)

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
    document.getElementById(`estoque-produto-${produtoDestacado}`)?.scrollIntoView({ block: 'center' })
  }, [produtoDestacado, paginaSegura])

  const handleQuantidadeConfirmada = (produto: ProdutoComEstoque, quantidade: number) => {
    setProdutos((atual) =>
      atual.map((item) =>
        item.id === produto.id && item.tabela === produto.tabela ? { ...item, estoque_quantidade: quantidade } : item,
      ),
    )
  }

  const handleBloqueioSite = async (produto: ProdutoComEstoque, bloquear: boolean) => {
    if (produtoSalvandoBloqueio) return
    const trocar = (valor: boolean) =>
      setProdutos((atual) =>
        atual.map((item) =>
          item.id === produto.id && item.tabela === produto.tabela ? { ...item, bloquear_venda_sem_estoque: valor } : item,
        ),
      )
    setProdutoSalvandoBloqueio(produto.id)
    trocar(bloquear)
    const { error } = await supabase.from(produto.tabela).update({ bloquear_venda_sem_estoque: bloquear }).eq('id', produto.id)
    setProdutoSalvandoBloqueio(null)
    if (error) {
      console.error('[Estoque] Falha ao alterar bloqueio no site:', error)
      trocar(produto.bloquear_venda_sem_estoque)
      toast.error('Não foi possível alterar o site.', { description: produto.nome })
      return
    }
    toast.success(bloquear ? 'Esgota no site sem saldo' : 'Continua no site sem saldo', { description: produto.nome })
  }

  const temFiltro = Boolean(busca.trim()) || filtroEstado !== 'todos' || categoria !== 'todas'

  const limparFiltros = () => {
    setBuscaDigitada('')
    setBusca('')
    setFiltroEstado('todos')
    setCategoria('todas')
  }

  const verHistorico = (produto: ProdutoComEstoque) => {
    setDetalhe(null)
    setProdutoHistorico(produto.id)
    setAba('movimentacoes')
  }

  const filtrosEstado: { valor: FiltroEstado; rotulo: string; alerta?: boolean }[] = [
    { valor: 'todos', rotulo: 'Todos' },
    ...(resumo.negativo > 0 ? [{ valor: 'negativo' as const, rotulo: `Negativos · ${resumo.negativo}`, alerta: true }] : []),
    { valor: 'esgotado', rotulo: 'Esgotados' },
    { valor: 'baixo', rotulo: 'Estoque baixo' },
    { valor: 'em_estoque', rotulo: 'Em estoque' },
  ]

  return (
    <Pagina>
      <CabecalhoPagina
        titulo="Estoque"
        descricao={
          carregando && produtos.length === 0
            ? 'Carregando…'
            : `${produtos.length} itens · ${resumo.esgotado} esgotados · ${resumo.baixo} com estoque baixo`
        }
        acoes={
          <Botao variante="contorno" onClick={() => void carregarProdutos()} disabled={carregando}>
            <ArrowsClockwise className={cn('size-4', carregando && 'animate-spin')} />
            Atualizar
          </Botao>
        }
      />

      <Segmentos
        opcoes={[
          { valor: 'saldo', rotulo: 'Saldo' },
          { valor: 'movimentacoes', rotulo: 'Movimentações' },
        ]}
        valor={aba}
        aoMudar={setAba}
        rotuloAcessivel="Ver saldo ou movimentações"
      />

      {aba === 'movimentacoes' ? (
        <MovimentacoesEstoque itens={produtos} produtoId={produtoHistorico} onProdutoChange={setProdutoHistorico} />
      ) : (
        <>
          {resumo.negativo > 0 && filtroEstado !== 'negativo' ? (
            <button
              type="button"
              onClick={() => setFiltroEstado('negativo')}
              className="flex w-full items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-left text-sm transition-colors hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40"
            >
              <Warning className="size-5 shrink-0 text-destructive" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="font-medium text-destructive">
                  {resumo.negativo === 1 ? '1 item vendido sem estoque' : `${resumo.negativo} itens vendidos sem estoque`}
                </span>
                <span className="block text-muted-foreground">Reponha ou ajuste a contagem.</span>
              </span>
              <span className="shrink-0 font-medium text-destructive">Ver</span>
            </button>
          ) : null}

          <div className="space-y-3">
            <div className="relative">
              <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Entrada
                type="search"
                value={buscaDigitada}
                onChange={(evento) => setBuscaDigitada(evento.target.value)}
                placeholder="Buscar produto ou categoria"
                aria-label="Buscar produtos no estoque"
                className="pl-9 pr-11"
              />
              {buscaDigitada ? (
                <button
                  type="button"
                  onClick={() => setBuscaDigitada('')}
                  className="absolute right-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                  aria-label="Limpar busca"
                >
                  <X className="size-4" />
                </button>
              ) : null}
            </div>

            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex gap-2 overflow-x-auto pb-1 md:pb-0" role="group" aria-label="Filtro de estado do estoque">
                {filtrosEstado.map((filtro) => (
                  <Chip
                    key={filtro.valor}
                    ativo={filtroEstado === filtro.valor}
                    onClick={() => setFiltroEstado(filtro.valor)}
                    className={cn('h-11 shrink-0 md:h-9', filtro.alerta && filtroEstado !== filtro.valor && 'text-destructive')}
                  >
                    {filtro.rotulo}
                  </Chip>
                ))}
              </div>
              <Selecao
                value={categoria}
                onChange={(evento) => setCategoria(evento.target.value)}
                aria-label="Categoria"
                className="md:w-52"
              >
                <option value="todas">Todas as categorias</option>
                {categorias.map((nome) => (
                  <option key={nome} value={nome}>{nome}</option>
                ))}
              </Selecao>
            </div>
          </div>

          <div className="flex min-h-9 items-center justify-between gap-3 px-1">
            <p className="text-sm text-muted-foreground">
              {produtosFiltrados.length} {produtosFiltrados.length === 1 ? 'item' : 'itens'}
            </p>
            {temFiltro ? (
              <Botao variante="fantasma" tamanho="sm" onClick={limparFiltros}>
                Limpar filtros
              </Botao>
            ) : null}
          </div>

          {erro ? (
            <ListaVazia
              icone={<Package />}
              titulo="Não foi possível carregar o estoque"
              descricao="Verifique a conexão e tente de novo."
              acao={<Botao variante="contorno" onClick={() => void carregarProdutos()}>Tentar de novo</Botao>}
            />
          ) : carregando && produtos.length === 0 ? (
            <ListaCarregando linhas={6} />
          ) : produtosFiltrados.length === 0 ? (
            <ListaVazia
              icone={<Package />}
              titulo={produtos.length === 0 ? 'Nenhum produto cadastrado' : 'Nenhum produto encontrado'}
              descricao={produtos.length === 0 ? 'Cadastre produtos no cardápio para controlar o estoque.' : 'Ajuste a busca ou os filtros.'}
              acao={temFiltro ? <Botao variante="contorno" onClick={limparFiltros}>Limpar filtros</Botao> : undefined}
            />
          ) : (
            <>
              <Lista>
                {produtosPagina.map((produto) => {
                  const estado = estadoDe(produto)
                  const abrir = () => setDetalhe({ id: produto.id, tabela: produto.tabela })
                  return (
                    <li key={`${produto.tabela}-${produto.id}`} id={`estoque-produto-${produto.id}`}>
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={abrir}
                        onKeyDown={(evento) => {
                          if (evento.key === 'Enter' || evento.key === ' ') {
                            evento.preventDefault()
                            abrir()
                          }
                        }}
                        aria-label={`Abrir estoque de ${produto.nome}`}
                        className={cn(
                          'flex min-h-16 cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                          produtoDestacado === produto.id && 'bg-accent/40',
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-foreground">{produto.nome}</p>
                          <p className="mt-0.5 truncate text-sm text-muted-foreground">
                            {produto.categoria || 'Sem categoria'}
                            <span className="hidden sm:inline"> · mínimo {produto.estoque_minimo}</span>
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <Saldo valor={produto.estoque_quantidade} className="text-lg font-semibold" />
                          <div className="mt-0.5">
                            <Selo tom={TOM_ESTADO[estado]}>{ROTULO_ESTADO[estado]}</Selo>
                          </div>
                        </div>
                      </div>
                    </li>
                  )
                })}
              </Lista>

              <PaginacaoFinancas
                paginaAtual={paginaSegura}
                totalPaginas={totalPaginas}
                totalItens={produtosFiltrados.length}
                itensPorPagina={itensPorPagina}
                onPaginaChange={setPagina}
                onItensPorPaginaChange={setItensPorPagina}
                carregando={carregando}
              />
            </>
          )}
        </>
      )}

      <DetalheItemEstoque
        produto={produtoDetalhe}
        salvandoBloqueio={produtoSalvandoBloqueio !== null}
        onFechar={() => setDetalhe(null)}
        onQuantidadeConfirmada={handleQuantidadeConfirmada}
        onBloqueioSite={(produto, bloquear) => void handleBloqueioSite(produto, bloquear)}
        onVerHistorico={verHistorico}
      />
    </Pagina>
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
