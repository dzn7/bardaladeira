'use client'

import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  ArrowDownCircle,
  ArrowUpCircle,
  CheckCircle2,
  Eye,
  FileText,
  Lock,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  Trash2,
  Unlock,
  Wallet,
} from 'lucide-react'
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
import { ListaVazia, TabelaSkeleton } from '@/components/admin/filtros/ListaEstado'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MenuAcoes, type MenuAcaoItem } from '@/components/ui/menu-acoes'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
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
  const [excluirMovId, setExcluirMovId] = useState<string | null>(null)
  const [excluirCaixaId, setExcluirCaixaId] = useState<string | null>(null)

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

  const acoesExtrato = (caixa: Caixa): MenuAcaoItem[] => {
    const itens: MenuAcaoItem[] = [
      {
        key: 'detalhe',
        label: 'Ver detalhes',
        icon: <Eye className="h-4 w-4" strokeWidth={1.6} />,
        onSelect: () => setCaixaDetalhe(caixa),
      },
      {
        key: 'pdf',
        label: 'PDF',
        icon: <FileText className="h-4 w-4" strokeWidth={1.6} />,
        onSelect: () => handlePdf(caixa),
      },
    ]
    if (caixa.status === 'fechado') {
      itens.push({
        key: 'reabrir',
        label: 'Reabrir',
        icon: <Unlock className="h-4 w-4" strokeWidth={1.6} />,
        onSelect: () => void reabrirCaixa(caixa.id),
      })
    }
    itens.push({
      key: 'excluir',
      label: 'Excluir',
      icon: <Trash2 className="h-4 w-4" strokeWidth={1.6} />,
      onSelect: () => setExcluirCaixaId(caixa.id),
      variant: 'destructive',
      separatorBefore: true,
    })
    return itens
  }

  return (
    <ProtectedRoute>
      <AdminLayout>
        <div className="mx-auto w-full max-w-6xl space-y-5">
          <div className="overflow-hidden rounded-xl border border-border/70 bg-card p-4 shadow-sm md:p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-lg font-semibold tracking-tight text-foreground">Caixa</h1>
                  <Badge
                    variant="secondary"
                    className={cn(
                      'rounded-md',
                      caixaAberto
                        ? 'bg-amber-500/15 text-amber-800 dark:text-amber-100'
                        : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {caixaAberto ? 'Aberto' : 'Fechado'}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Gaveta do dia: sangria, suprimento e fechamento em dinheiro.
                </p>
                <div className="mt-3 flex flex-wrap gap-4">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Saldo gaveta</p>
                    <p className="font-mono text-xl font-semibold tabular-nums text-foreground">
                      {formatarMoedaCaixa(estatisticas.saldoGaveta)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Entradas</p>
                    <p className="font-mono text-xl font-semibold tabular-nums text-emerald-600">
                      {formatarMoedaCaixa(estatisticas.totalEntradas)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Saídas</p>
                    <p className="font-mono text-xl font-semibold tabular-nums text-destructive">
                      {formatarMoedaCaixa(estatisticas.totalSaidas)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">PIX / Cartão</p>
                    <p className="font-mono text-sm font-semibold tabular-nums text-muted-foreground">
                      {formatarMoedaCaixa(resumoFormas.pix + resumoFormas.cartao)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 shadow-none"
                  onClick={() => void carregarDados()}
                  disabled={carregando}
                >
                  <RefreshCw className={cn('mr-2 h-4 w-4', carregando && 'animate-spin')} />
                  Atualizar
                </Button>
                {!caixaAberto ? (
                  <Button type="button" size="sm" className="h-9 shadow-none" onClick={() => setModalAbrir(true)}>
                    <Unlock className="mr-2 h-4 w-4" />
                    Abrir caixa
                  </Button>
                ) : (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 shadow-none"
                      onClick={() => setModalSangria(true)}
                    >
                      <ArrowDownCircle className="mr-2 h-4 w-4" />
                      Sangria
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 shadow-none"
                      onClick={() => setModalSuprimento(true)}
                    >
                      <ArrowUpCircle className="mr-2 h-4 w-4" />
                      Suprimento
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 shadow-none"
                      disabled={sincronizando}
                      onClick={() => void sincronizarTodosPedidos()}
                    >
                      <RefreshCw className={cn('mr-2 h-4 w-4', sincronizando && 'animate-spin')} />
                      Sync
                    </Button>
                    <Button type="button" size="sm" className="h-9 shadow-none" onClick={() => setModalFechar(true)}>
                      <Lock className="mr-2 h-4 w-4" />
                      Fechar
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>

          <Tabs value={aba} onValueChange={(v) => setAba(v as Aba)} className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <TabsList className="h-10 w-full justify-start sm:w-auto">
                <TabsTrigger value="hoje">Hoje</TabsTrigger>
                <TabsTrigger value="pedidos">
                  Pedidos
                  {pedidosPendentes.length > 0 && (
                    <span className="ml-1.5 rounded-full bg-primary/15 px-1.5 text-[10px] font-semibold text-primary">
                      {pedidosPendentes.length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="extrato">Extrato</TabsTrigger>
              </TabsList>
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/admin/caixa/relatorios"
                  className="inline-flex h-9 items-center rounded-md px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Relatórios
                </Link>
                <Link
                  href="/admin/caixa/saldos"
                  className="inline-flex h-9 items-center rounded-md px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <Settings2 className="mr-2 h-4 w-4" />
                  Saldos
                </Link>
              </div>
            </div>

            <TabsContent value="hoje" className="mt-0 space-y-3">
              {!caixaAberto ? (
                <ListaVazia
                  titulo="Caixa fechado"
                  descricao="Abra o caixa para registrar movimentos da gaveta."
                  acao={
                    <Button type="button" onClick={() => setModalAbrir(true)}>
                      Abrir caixa
                    </Button>
                  }
                />
              ) : (
                <>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="relative min-w-0 flex-1">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={busca}
                        onChange={(e) => setBusca(e.target.value)}
                        placeholder="Buscar movimento"
                        className="h-9 pl-8"
                      />
                    </div>
                    <ToggleGroup
                      type="single"
                      value={filtroTipo}
                      onValueChange={(v) => v && setFiltroTipo(v as FiltroTipo)}
                      className="justify-start"
                    >
                      <ToggleGroupItem value="todos" className="h-9 px-3 text-xs">
                        Todos
                      </ToggleGroupItem>
                      <ToggleGroupItem value="entrada" className="h-9 px-3 text-xs">
                        Entradas
                      </ToggleGroupItem>
                      <ToggleGroupItem value="saida" className="h-9 px-3 text-xs">
                        Saídas
                      </ToggleGroupItem>
                    </ToggleGroup>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-9"
                      onClick={() => {
                        setTipoMov('entrada')
                        setModalMov(true)
                      }}
                    >
                      <Plus className="mr-1.5 h-4 w-4" />
                      Lançamento
                    </Button>
                  </div>

                  {carregando ? (
                    <TabelaSkeleton linhas={6} />
                  ) : movsFiltradas.length === 0 ? (
                    <ListaVazia titulo="Sem movimentos" descricao="Sincronize pedidos ou registre sangria/suprimento." />
                  ) : (
                    <>
                      <div className="hidden overflow-hidden rounded-xl border border-border/70 md:block">
                        <Table>
                          <TableHeader>
                            <TableRow className="hover:bg-transparent">
                              <TableHead className="w-12" />
                              <TableHead>Descrição</TableHead>
                              <TableHead>Forma</TableHead>
                              <TableHead className="text-right">Valor</TableHead>
                              <TableHead className="w-12" />
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {movsFiltradas.map((mov) => (
                              <LinhaMovimento
                                key={mov.id}
                                mov={mov}
                                onExcluir={() => setExcluirMovId(mov.id)}
                              />
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                      <div className="space-y-2 md:hidden">
                        {movsFiltradas.map((mov) => (
                          <CardMovimento key={mov.id} mov={mov} onExcluir={() => setExcluirMovId(mov.id)} />
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}
            </TabsContent>

            <TabsContent value="pedidos" className="mt-0 space-y-3">
              {!caixaAberto ? (
                <ListaVazia titulo="Caixa fechado" descricao="Abra o caixa para sincronizar pedidos." />
              ) : pedidosDia.length === 0 ? (
                <ListaVazia titulo="Nenhum pedido no período" descricao="Pedidos do dia de trabalho aparecem aqui." />
              ) : (
                <div className="space-y-2">
                  {pedidosDia.map((pedido) => (
                    <div
                      key={pedido.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-card px-3 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{pedido.nome_cliente}</p>
                        <p className="text-xs text-muted-foreground">
                          {pedido.forma_pagamento} · {format(new Date(pedido.created_at), 'HH:mm')}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="font-mono text-sm font-semibold tabular-nums">
                          {formatarMoedaCaixa(pedido.total)}
                        </span>
                        {pedido.sincronizado ? (
                          <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-700">
                            Sync
                          </Badge>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8"
                            onClick={() =>
                              void sincronizarPedido(
                                pedido.id,
                                pedido.total,
                                pedido.forma_pagamento,
                                pedido.nome_cliente,
                              )
                            }
                          >
                            Sync
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="extrato" className="mt-0 space-y-3">
              {carregando && historicoCaixas.length === 0 ? (
                <TabelaSkeleton linhas={6} />
              ) : historicoCaixas.length === 0 ? (
                <ListaVazia titulo="Sem sessões" descricao="O histórico de caixas aparece aqui após abrir/fechar." />
              ) : (
                <>
                  <div className="hidden overflow-hidden rounded-xl border border-border/70 md:block">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="w-12" />
                          <TableHead>Sessão</TableHead>
                          <TableHead className="text-center">Status</TableHead>
                          <TableHead className="text-right">Abertura</TableHead>
                          <TableHead className="text-right">Entradas</TableHead>
                          <TableHead className="text-right">Saídas</TableHead>
                          <TableHead className="text-right">Diferença</TableHead>
                          <TableHead className="w-12" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {extratoPaginado.map((caixa) => {
                          const aberto = caixa.status === 'aberto'
                          return (
                            <TableRow
                              key={caixa.id}
                              className="cursor-pointer border-border/60"
                              onClick={() => setCaixaDetalhe(caixa)}
                            >
                              <TableCell className="py-3 pl-3">
                                <div
                                  className={cn(
                                    'flex h-12 items-center border-l-4',
                                    aberto ? 'border-amber-500' : 'border-emerald-500',
                                  )}
                                >
                                  <span className="pl-3">
                                    {aberto ? (
                                      <Wallet className="h-4 w-4 text-amber-600" aria-hidden />
                                    ) : (
                                      <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden />
                                    )}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="py-3">
                                <span className="block text-sm font-medium">
                                  {format(new Date(caixa.data_abertura), "dd MMM yyyy · HH:mm", { locale: ptBR })}
                                </span>
                                <span className="text-[11px] text-muted-foreground">
                                  {caixa.responsavel_abertura || '—'}
                                </span>
                              </TableCell>
                              <TableCell className="py-3">
                                <div className="flex justify-center">
                                  <Badge variant="secondary" className={aberto ? 'bg-amber-500/15 text-amber-800' : ''}>
                                    {aberto ? 'Aberto' : 'Fechado'}
                                  </Badge>
                                </div>
                              </TableCell>
                              <TableCell className="py-3 text-right font-mono text-sm tabular-nums">
                                {formatarMoedaCaixa(caixa.valor_abertura)}
                              </TableCell>
                              <TableCell className="py-3 text-right font-mono text-sm tabular-nums text-emerald-600">
                                {formatarMoedaCaixa(caixa.total_entradas)}
                              </TableCell>
                              <TableCell className="py-3 text-right font-mono text-sm tabular-nums text-destructive">
                                {formatarMoedaCaixa(caixa.total_saidas)}
                              </TableCell>
                              <TableCell className="py-3 text-right font-mono text-sm tabular-nums">
                                {caixa.diferenca == null ? '—' : formatarMoedaCaixa(caixa.diferenca)}
                              </TableCell>
                              <TableCell className="py-3" onClick={(e) => e.stopPropagation()}>
                                <MenuAcoes items={acoesExtrato(caixa)} ariaLabel="Ações da sessão" />
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="space-y-2 md:hidden">
                    {extratoPaginado.map((caixa) => {
                      const aberto = caixa.status === 'aberto'
                      return (
                        <button
                          key={caixa.id}
                          type="button"
                          onClick={() => setCaixaDetalhe(caixa)}
                          className="flex w-full items-start gap-3 rounded-xl border border-border/70 bg-card p-3 text-left"
                        >
                          <div
                            className={cn(
                              'mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border-l-4',
                              aberto ? 'border-amber-500 bg-amber-500/10' : 'border-emerald-500 bg-emerald-500/10',
                            )}
                          >
                            {aberto ? (
                              <Wallet className="h-4 w-4 text-amber-600" />
                            ) : (
                              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium">
                              {format(new Date(caixa.data_abertura), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                            </p>
                            <p className="text-xs text-muted-foreground">{caixa.responsavel_abertura || '—'}</p>
                            <div className="mt-2 flex flex-wrap gap-2 text-xs">
                              <span className="font-mono tabular-nums text-emerald-600">
                                +{formatarMoedaCaixa(caixa.total_entradas)}
                              </span>
                              <span className="font-mono tabular-nums text-destructive">
                                −{formatarMoedaCaixa(caixa.total_saidas)}
                              </span>
                            </div>
                          </div>
                          <div onClick={(e) => e.stopPropagation()}>
                            <MenuAcoes items={acoesExtrato(caixa)} />
                          </div>
                        </button>
                      )
                    })}
                  </div>

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
        </div>

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
        <ModalDetalhesCaixa caixa={caixaDetalhe} onFechar={() => setCaixaDetalhe(null)} />

        <AlertDialog open={Boolean(excluirMovId)} onOpenChange={(o) => !o && setExcluirMovId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir movimento?</AlertDialogTitle>
              <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (excluirMovId) void excluirMovimentacao(excluirMovId)
                  setExcluirMovId(null)
                }}
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={Boolean(excluirCaixaId)} onOpenChange={(o) => !o && setExcluirCaixaId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir sessão de caixa?</AlertDialogTitle>
              <AlertDialogDescription>Remove a sessão e seus movimentos vinculados.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (excluirCaixaId) void excluirCaixa(excluirCaixaId)
                  setExcluirCaixaId(null)
                }}
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </AdminLayout>
    </ProtectedRoute>
  )
}

const LinhaMovimento = ({ mov, onExcluir }: { mov: MovimentacaoCaixa; onExcluir: () => void }) => {
  const entrada = mov.tipo === 'entrada'
  return (
    <TableRow className="border-border/60">
      <TableCell className="py-3 pl-3">
        <div className={cn('flex h-10 items-center border-l-4', entrada ? 'border-emerald-500' : 'border-rose-500')}>
          <span className="pl-3">
            {entrada ? (
              <ArrowUpCircle className="h-4 w-4 text-emerald-600" />
            ) : (
              <ArrowDownCircle className="h-4 w-4 text-rose-500" />
            )}
          </span>
        </div>
      </TableCell>
      <TableCell className="py-3">
        <p className="text-sm font-medium">{mov.descricao || mov.categoria?.nome || 'Movimento'}</p>
        <p className="text-[11px] text-muted-foreground">
          {format(new Date(mov.created_at), 'HH:mm')} · {mov.categoria?.nome || '—'}
        </p>
      </TableCell>
      <TableCell className="py-3 text-sm text-muted-foreground">{mov.forma_pagamento || '—'}</TableCell>
      <TableCell
        className={cn(
          'py-3 text-right font-mono text-sm font-semibold tabular-nums',
          entrada ? 'text-emerald-600' : 'text-destructive',
        )}
      >
        {entrada ? '+' : '−'}
        {formatarMoedaCaixa(mov.valor)}
      </TableCell>
      <TableCell className="py-3">
        <MenuAcoes
          items={[
            {
              key: 'excluir',
              label: 'Excluir',
              icon: <Trash2 className="h-4 w-4" />,
              onSelect: onExcluir,
              variant: 'destructive',
            },
          ]}
        />
      </TableCell>
    </TableRow>
  )
}

const CardMovimento = ({ mov, onExcluir }: { mov: MovimentacaoCaixa; onExcluir: () => void }) => {
  const entrada = mov.tipo === 'entrada'
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border/70 bg-card p-3">
      <div
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border-l-4',
          entrada ? 'border-emerald-500 bg-emerald-500/10' : 'border-rose-500 bg-rose-500/10',
        )}
      >
        {entrada ? (
          <ArrowUpCircle className="h-4 w-4 text-emerald-600" />
        ) : (
          <ArrowDownCircle className="h-4 w-4 text-rose-500" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{mov.descricao || mov.categoria?.nome || 'Movimento'}</p>
        <p className="text-xs text-muted-foreground">
          {mov.forma_pagamento || '—'} · {format(new Date(mov.created_at), 'HH:mm')}
        </p>
        <p
          className={cn(
            'mt-1 font-mono text-sm font-semibold tabular-nums',
            entrada ? 'text-emerald-600' : 'text-destructive',
          )}
        >
          {entrada ? '+' : '−'}
          {formatarMoedaCaixa(mov.valor)}
        </p>
      </div>
      <MenuAcoes
        items={[
          {
            key: 'excluir',
            label: 'Excluir',
            icon: <Trash2 className="h-4 w-4" />,
            onSelect: onExcluir,
            variant: 'destructive',
          },
        ]}
      />
    </div>
  )
}
