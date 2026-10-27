'use client'

import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { ArrowCircleDown as ArrowDownCircle, ArrowCircleUp as ArrowUpCircle, CaretRight, CheckCircle as CheckCircle2, FileText, Lock, Plus, ArrowsClockwise as RefreshCw, MagnifyingGlass as Search, GearSix as Settings2, Trash as Trash2, LockOpen as Unlock, Wallet } from '@phosphor-icons/react'
import Link from 'next/link'
import { toast } from 'sonner'
import ProtectedRoute from '@/components/admin/ProtectedRoute'
import AdminLayout from '@/components/admin/AdminLayout'
import {
  ModalAbrirCaixa,
  ModalDetalhesCaixa,
  ModalFecharCaixa,
  ModalNovaMovimentacao,
  ModalSangriaSuprimento,
} from '@/components/admin/caixa'
import {
  Botao,
  CabecalhoPagina,
  Cartao,
  Chip,
  Entrada,
  Lista,
  ListaCarregando,
  ListaVazia,
  Pagina,
  Selo,
  useConfirmar,
} from '@/components/admin/ui'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PaginacaoFinancas } from '@/features/financas/components/PaginacaoFinancas'
import { formatarMoedaCaixa } from '@/lib/caixa-gaveta'
import { gerarPdfCaixa } from '@/lib/gerarPdfCaixa'
import type { Caixa, MovimentacaoCaixa } from '@/lib/tipos-caixa'
import { useCaixa } from '@/lib/useCaixa'
import { cn } from '@/lib/utils'

type Aba = 'hoje' | 'pedidos' | 'extrato'
type FiltroTipo = 'todos' | 'entrada' | 'saida'

export default function GestaoCaixaPage() {
  const {
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
    carregando,
    sincronizando,
    notificacao,
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
    mostrarNotificacao,
    fecharNotificacao,
  } = useCaixa()

  const [aba, setAba] = useState<Aba>('hoje')
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>('todos')
  const [busca, setBusca] = useState('')
  const [paginaExtrato, setPaginaExtrato] = useState(1)
  const [itensPorPagina, setItensPorPagina] = useState(15)

  const [modalAbrir, setModalAbrir] = useState(false)
  const [modalFechar, setModalFechar] = useState(false)
  const [modalMov, setModalMov] = useState(false)
  const [tipoMov, setTipoMov] = useState<'entrada' | 'saida'>('entrada')
  const [modalSangria, setModalSangria] = useState(false)
  const [modalSuprimento, setModalSuprimento] = useState(false)
  const [caixaDetalhe, setCaixaDetalhe] = useState<Caixa | null>(null)
  const confirmar = useConfirmar()

  useEffect(() => {
    if (!notificacao.aberto) return
    if (notificacao.tipo === 'confirmacao') return
    const map = {
      sucesso: toast.success,
      erro: toast.error,
      aviso: toast.warning,
      info: toast.info,
    } as const
    const fn = map[notificacao.tipo] || toast
    fn(notificacao.titulo, { description: notificacao.mensagem })
    fecharNotificacao()
  }, [notificacao, fecharNotificacao])

  const movsFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return movimentacoes.filter((m) => {
      if (filtroTipo !== 'todos' && m.tipo !== filtroTipo) return false
      if (!termo) return true
      return (
        (m.descricao || '').toLowerCase().includes(termo) ||
        (m.categoria?.nome || '').toLowerCase().includes(termo) ||
        (m.forma_pagamento || '').toLowerCase().includes(termo)
      )
    })
  }, [movimentacoes, filtroTipo, busca])

  const pedidosPendentes = useMemo(() => pedidosDia.filter((p) => !p.sincronizado), [pedidosDia])

  const extratoPaginado = useMemo(() => {
    const inicio = (paginaExtrato - 1) * itensPorPagina
    return historicoCaixas.slice(inicio, inicio + itensPorPagina)
  }, [historicoCaixas, paginaExtrato, itensPorPagina])

  const totalPaginasExtrato = Math.max(1, Math.ceil(historicoCaixas.length / itensPorPagina))

  const caixaAberto = Boolean(caixaAtual)

  const handlePdf = (caixa: Caixa) => {
    try {
      gerarPdfCaixa({
        caixa,
        movimentacoes: caixa.id === caixaAtual?.id ? movimentacoes : [],
        estatisticas:
          caixa.id === caixaAtual?.id
            ? estatisticas
            : {
                saldoAtual: Number(caixa.saldo_esperado || 0),
                totalEntradas: Number(caixa.total_entradas || 0),
                totalSaidas: Number(caixa.total_saidas || 0),
                quantidadeMovimentacoes: 0,
                saldoGaveta: Number(caixa.saldo_esperado || 0),
                esperadoDinheiro: Number(caixa.saldo_esperado || 0),
              },
      })
    } catch (erro) {
      console.error(erro)
      toast.error('Não foi possível gerar o PDF')
    }
  }

  const pedirExclusaoMov = async (mov: MovimentacaoCaixa) => {
    const ok = await confirmar({
      titulo: 'Excluir movimento?',
      descricao: `${mov.descricao || mov.categoria?.nome || 'Movimento'} · ${formatarMoedaCaixa(mov.valor)}. Não dá para desfazer.`,
      confirmar: 'Excluir',
      perigo: true,
    })
    if (ok) void excluirMovimentacao(mov.id)
  }

  const pedirExclusaoCaixa = async (caixa: Caixa) => {
    const ok = await confirmar({
      titulo: 'Excluir este caixa?',
      descricao: 'Apaga o caixa e todos os movimentos dele. Não dá para desfazer.',
      confirmar: 'Excluir caixa',
      perigo: true,
    })
    if (!ok) return
    setCaixaDetalhe(null)
    void excluirCaixa(caixa.id)
  }

  const abrirLancamento = () => {
    setTipoMov('entrada')
    setModalMov(true)
  }

  return (
    <ProtectedRoute>
      <AdminLayout>
        <Pagina className="max-w-6xl">
          <CabecalhoPagina
            titulo="Caixa"
            descricao={
              caixaAberto
                ? 'Aberto · dinheiro da gaveta, sangria, suprimento e fechamento.'
                : 'Fechado · abra o caixa para começar o dia.'
            }
            acoes={
              !caixaAberto ? (
                <Botao onClick={() => setModalAbrir(true)}>
                  <Unlock />
                  Abrir caixa
                </Botao>
              ) : (
                <Botao onClick={() => setModalFechar(true)}>
                  <Lock />
                  Fechar caixa
                </Botao>
              )
            }
          />

          <Cartao className="p-4 md:p-5">
            <p className="text-sm text-muted-foreground">Dinheiro na gaveta</p>
            <p className="mt-1 font-mono text-3xl font-semibold tabular-nums tracking-tight text-foreground">
              {formatarMoedaCaixa(estatisticas.saldoGaveta)}
            </p>
            <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-border/70 pt-4">
              <div className="min-w-0">
                <dt className="text-[13px] text-muted-foreground">Entradas</dt>
                <dd className="truncate font-mono text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400 md:text-base">
                  {formatarMoedaCaixa(estatisticas.totalEntradas)}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[13px] text-muted-foreground">Saídas</dt>
                <dd className="truncate font-mono text-sm font-semibold tabular-nums text-destructive md:text-base">
                  {formatarMoedaCaixa(estatisticas.totalSaidas)}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[13px] text-muted-foreground">PIX e cartão</dt>
                <dd className="truncate font-mono text-sm font-semibold tabular-nums text-foreground md:text-base">
                  {formatarMoedaCaixa(resumoFormas.pix + resumoFormas.cartao)}
                </dd>
              </div>
            </dl>

            {caixaAberto && (
              <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border/70 pt-4 sm:flex sm:flex-wrap">
                <Botao variante="contorno" onClick={() => setModalSangria(true)}>
                  <ArrowDownCircle />
                  Sangria
                </Botao>
                <Botao variante="contorno" onClick={() => setModalSuprimento(true)}>
                  <ArrowUpCircle />
                  Suprimento
                </Botao>
                <Botao variante="contorno" onClick={abrirLancamento}>
                  <Plus />
                  Lançamento
                </Botao>
                <Botao
                  variante="contorno"
                  carregando={sincronizando}
                  onClick={() => void sincronizarTodosPedidos()}
                >
                  {!sincronizando && <RefreshCw />}
                  Puxar pedidos
                </Botao>
              </div>
            )}
          </Cartao>

          <Tabs value={aba} onValueChange={(v) => setAba(v as Aba)} className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <TabsList className="h-11 w-full justify-start sm:w-auto">
                <TabsTrigger value="hoje" className="h-9 flex-1 sm:flex-none">Hoje</TabsTrigger>
                <TabsTrigger value="pedidos" className="h-9 flex-1 sm:flex-none">
                  Pedidos
                  {pedidosPendentes.length > 0 && (
                    <span className="ml-1.5 rounded-full bg-primary/15 px-1.5 text-[11px] font-semibold text-primary">
                      {pedidosPendentes.length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="extrato" className="h-9 flex-1 sm:flex-none">Histórico</TabsTrigger>
              </TabsList>
              <div className="flex gap-1">
                <Link
                  href="/admin/caixa/relatorios"
                  className="inline-flex h-11 items-center gap-2 rounded-lg px-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:h-9"
                >
                  <FileText className="size-4" />
                  Relatórios
                </Link>
                <Link
                  href="/admin/caixa/saldos"
                  className="inline-flex h-11 items-center gap-2 rounded-lg px-3 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:h-9"
                >
                  <Settings2 className="size-4" />
                  Saldos
                </Link>
                <Botao
                  variante="fantasma"
                  tamanho="icone"
                  className="md:size-9"
                  aria-label="Atualizar"
                  onClick={() => void carregarDados()}
                  disabled={carregando}
                >
                  <RefreshCw className={cn(carregando && 'animate-spin')} />
                </Botao>
              </div>
            </div>

            <TabsContent value="hoje" className="mt-0 space-y-3">
              {!caixaAberto ? (
                <ListaVazia
                  icone={<Wallet />}
                  titulo="Caixa fechado"
                  descricao="Abra o caixa para registrar o dinheiro que entra e sai da gaveta."
                  acao={
                    <Botao onClick={() => setModalAbrir(true)}>
                      <Unlock />
                      Abrir caixa
                    </Botao>
                  }
                />
              ) : (
                <>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="relative min-w-0 flex-1">
                      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Entrada
                        type="search"
                        value={busca}
                        onChange={(e) => setBusca(e.target.value)}
                        placeholder="Buscar movimento"
                        aria-label="Buscar movimento"
                        className="pl-9"
                      />
                    </div>
                    <div className="flex gap-2 overflow-x-auto" role="group" aria-label="Filtrar por tipo">
                      {FILTROS.map((filtro) => (
                        <Chip
                          key={filtro.valor}
                          ativo={filtroTipo === filtro.valor}
                          className="h-10"
                          onClick={() => setFiltroTipo(filtro.valor)}
                        >
                          {filtro.rotulo}
                        </Chip>
                      ))}
                    </div>
                  </div>

                  {carregando ? (
                    <ListaCarregando linhas={6} />
                  ) : movsFiltradas.length === 0 ? (
                    busca || filtroTipo !== 'todos' ? (
                      <ListaVazia
                        icone={<Search />}
                        titulo="Nenhum movimento encontrado"
                        descricao="Tente outra busca ou filtro."
                        acao={
                          <Botao
                            variante="contorno"
                            onClick={() => {
                              setBusca('')
                              setFiltroTipo('todos')
                            }}
                          >
                            Limpar filtros
                          </Botao>
                        }
                      />
                    ) : (
                      <ListaVazia
                        icone={<Wallet />}
                        titulo="Nenhum movimento ainda"
                        descricao="Puxe os pedidos do dia ou registre uma sangria ou suprimento."
                      />
                    )
                  ) : (
                    <Lista>
                      {movsFiltradas.map((mov) => (
                        <LinhaMovimento key={mov.id} mov={mov} onExcluir={() => void pedirExclusaoMov(mov)} />
                      ))}
                    </Lista>
                  )}
                </>
              )}
            </TabsContent>

            <TabsContent value="pedidos" className="mt-0 space-y-3">
              {!caixaAberto ? (
                <ListaVazia
                  icone={<Wallet />}
                  titulo="Caixa fechado"
                  descricao="Abra o caixa para lançar os pedidos do dia."
                />
              ) : pedidosDia.length === 0 ? (
                <ListaVazia
                  icone={<FileText />}
                  titulo="Nenhum pedido hoje"
                  descricao="Os pedidos do dia de trabalho aparecem aqui."
                />
              ) : (
                <Lista>
                  {pedidosDia.map((pedido) => (
                    <li key={pedido.id} className="flex min-h-16 items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{pedido.nome_cliente}</p>
                        <p className="text-[13px] text-muted-foreground">
                          {pedido.forma_pagamento} · {format(new Date(pedido.created_at), 'HH:mm')}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
                          {formatarMoedaCaixa(pedido.total)}
                        </span>
                        {pedido.sincronizado ? (
                          <Selo tom="sucesso">
                            <CheckCircle2 className="size-3" weight="bold" />
                            No caixa
                          </Selo>
                        ) : (
                          <Botao
                            variante="contorno"
                            tamanho="sm"
                            className="h-10 md:h-9"
                            onClick={() =>
                              void sincronizarPedido(
                                pedido.id,
                                pedido.total,
                                pedido.forma_pagamento,
                                pedido.nome_cliente,
                              )
                            }
                          >
                            Lançar
                          </Botao>
                        )}
                      </div>
                    </li>
                  ))}
                </Lista>
              )}
            </TabsContent>

            <TabsContent value="extrato" className="mt-0 space-y-3">
              {carregando && historicoCaixas.length === 0 ? (
                <ListaCarregando linhas={6} />
              ) : historicoCaixas.length === 0 ? (
                <ListaVazia
                  icone={<FileText />}
                  titulo="Nenhum caixa ainda"
                  descricao="Cada caixa aberto e fechado aparece aqui."
                />
              ) : (
                <>
                  <Lista>
                    {extratoPaginado.map((caixa) => {
                      const aberto = caixa.status === 'aberto'
                      return (
                        <li key={caixa.id}>
                          <button
                            type="button"
                            onClick={() => setCaixaDetalhe(caixa)}
                            className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="truncate text-sm font-medium text-foreground">
                                  {format(new Date(caixa.data_abertura), "dd MMM yyyy · HH:mm", { locale: ptBR })}
                                </p>
                                {aberto && <Selo tom="alerta">Aberto</Selo>}
                              </div>
                              <p className="truncate text-[13px] text-muted-foreground">
                                {caixa.responsavel_abertura || 'Sem responsável'}
                              </p>
                            </div>
                            <div className="hidden shrink-0 text-right md:block">
                              <p className="text-[13px] text-muted-foreground">Abertura</p>
                              <p className="font-mono text-sm tabular-nums text-foreground">
                                {formatarMoedaCaixa(caixa.valor_abertura)}
                              </p>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="font-mono text-sm tabular-nums text-emerald-600 dark:text-emerald-400">
                                +{formatarMoedaCaixa(caixa.total_entradas)}
                              </p>
                              <p className="font-mono text-sm tabular-nums text-destructive">
                                −{formatarMoedaCaixa(caixa.total_saidas)}
                              </p>
                            </div>
                            <div className="hidden w-28 shrink-0 text-right md:block">
                              <p className="text-[13px] text-muted-foreground">Diferença</p>
                              <p className="font-mono text-sm tabular-nums text-foreground">
                                {caixa.diferenca == null ? '—' : formatarMoedaCaixa(caixa.diferenca)}
                              </p>
                            </div>
                            <CaretRight className="size-4 shrink-0 text-muted-foreground" />
                          </button>
                        </li>
                      )
                    })}
                  </Lista>

                  <PaginacaoFinancas
                    paginaAtual={paginaExtrato}
                    totalPaginas={totalPaginasExtrato}
                    totalItens={historicoCaixas.length}
                    itensPorPagina={itensPorPagina}
                    onPaginaChange={setPaginaExtrato}
                    onItensPorPaginaChange={(n) => {
                      setItensPorPagina(n)
                      setPaginaExtrato(1)
                    }}
                  />
                </>
              )}
            </TabsContent>
          </Tabs>
        </Pagina>

        <ModalAbrirCaixa
          aberto={modalAbrir}
          funcionarios={funcionarios}
          pedidosHoje={pedidosHoje}
          totalPedidosHoje={totalPedidosHoje}
          onFechar={() => setModalAbrir(false)}
          onConfirmar={abrirCaixa}
        />
        <ModalFecharCaixa
          aberto={modalFechar}
          caixa={caixaAtual}
          funcionarios={funcionarios}
          estatisticas={estatisticas}
          resumoFormas={resumoFormas}
          onFechar={() => setModalFechar(false)}
          onConfirmar={fecharCaixa}
        />
        <ModalSangriaSuprimento
          aberto={modalSangria}
          tipo="sangria"
          funcionarios={funcionarios}
          onFechar={() => setModalSangria(false)}
          onConfirmar={registrarSangria}
        />
        <ModalSangriaSuprimento
          aberto={modalSuprimento}
          tipo="suprimento"
          funcionarios={funcionarios}
          onFechar={() => setModalSuprimento(false)}
          onConfirmar={registrarSuprimento}
        />
        <ModalNovaMovimentacao
          aberto={modalMov}
          tipo={tipoMov}
          categorias={categorias}
          funcionarios={funcionarios}
          onFechar={() => setModalMov(false)}
          onConfirmar={async (tipo, valor, categoriaId, funcionarioId, descricao, forma) =>
            registrarMovimentacao(tipo, valor, categoriaId, funcionarioId, descricao, forma)
          }
        />
        <ModalDetalhesCaixa
          caixa={caixaDetalhe}
          onFechar={() => setCaixaDetalhe(null)}
          acoes={
            caixaDetalhe ? (
              <>
                <Botao
                  variante="perigoSuave"
                  className="md:mr-auto"
                  onClick={() => void pedirExclusaoCaixa(caixaDetalhe)}
                >
                  Excluir
                </Botao>
                {caixaDetalhe.status === 'fechado' && (
                  <Botao
                    variante="contorno"
                    onClick={() => {
                      void reabrirCaixa(caixaDetalhe.id)
                      setCaixaDetalhe(null)
                    }}
                  >
                    Reabrir
                  </Botao>
                )}
                <Botao variante="contorno" onClick={() => handlePdf(caixaDetalhe)}>
                  <FileText />
                  PDF
                </Botao>
              </>
            ) : null
          }
        />
      </AdminLayout>
    </ProtectedRoute>
  )
}

const FILTROS: { valor: FiltroTipo; rotulo: string }[] = [
  { valor: 'todos', rotulo: 'Todos' },
  { valor: 'entrada', rotulo: 'Entradas' },
  { valor: 'saida', rotulo: 'Saídas' },
]

const LinhaMovimento = ({ mov, onExcluir }: { mov: MovimentacaoCaixa; onExcluir: () => void }) => {
  const entrada = mov.tipo === 'entrada'
  return (
    <li className="flex min-h-16 items-center gap-3 py-2 pl-4 pr-2">
      <span
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-lg',
          entrada
            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
            : 'bg-red-500/10 text-red-600 dark:text-red-400',
        )}
        aria-hidden
      >
        {entrada ? <ArrowUpCircle className="size-4" /> : <ArrowDownCircle className="size-4" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{mov.descricao || mov.categoria?.nome || 'Movimento'}</p>
        <p className="truncate text-[13px] text-muted-foreground">
          {format(new Date(mov.created_at), 'HH:mm')}
          {mov.categoria?.nome ? ` · ${mov.categoria.nome}` : ''}
          {mov.forma_pagamento ? ` · ${mov.forma_pagamento}` : ''}
        </p>
      </div>
      <span
        className={cn(
          'shrink-0 font-mono text-sm font-semibold tabular-nums',
          entrada ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive',
        )}
      >
        {entrada ? '+' : '−'}
        {formatarMoedaCaixa(mov.valor)}
      </span>
      <Botao
        variante="fantasma"
        tamanho="icone"
        className="shrink-0 text-muted-foreground hover:text-destructive"
        aria-label={`Excluir ${mov.descricao || mov.categoria?.nome || 'movimento'}`}
        onClick={onExcluir}
      >
        <Trash2 />
      </Botao>
    </li>
  )
}
