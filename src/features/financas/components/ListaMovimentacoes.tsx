'use client'

import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Edit, Eye, Trash2, Wallet, XCircle } from 'lucide-react'
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
import { Badge } from '@/components/ui/badge'
import { MenuAcoes } from '@/components/ui/menu-acoes'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ListaVazia, TabelaSkeleton } from '@/components/admin/filtros/ListaEstado'
import { cn } from '@/lib/utils'
import type { MovimentacaoCaixa } from '@/lib/tipos-caixa'
import { formatarData, formatarMoeda } from '../lib/formatadores'
import { CardMovimentacaoFinancas } from './CardMovimentacaoFinancas'
import { PaginacaoFinancas } from './PaginacaoFinancas'

const LIMITE_PADRAO = 15

interface ListaMovimentacoesProps {
  movimentacoes: MovimentacaoCaixa[]
  carregando?: boolean
  onRemover: (id: string) => Promise<void>
  onEditar: (movimentacao: MovimentacaoCaixa) => void
  onVisualizar?: (movimentacao: MovimentacaoCaixa) => void
  embutido?: boolean
}

export function ListaMovimentacoes({
  movimentacoes,
  carregando,
  onRemover,
  onEditar,
  onVisualizar,
  embutido = false,
}: ListaMovimentacoesProps) {
  const [confirmacao, setConfirmacao] = useState<MovimentacaoCaixa | null>(null)
  const [removendo, setRemovendo] = useState(false)
  const [pagina, setPagina] = useState(1)
  const [limite, setLimite] = useState(LIMITE_PADRAO)

  useEffect(() => {
    setPagina(1)
  }, [movimentacoes])

  const totalPaginas = Math.max(1, Math.ceil(movimentacoes.length / limite))

  useEffect(() => {
    if (pagina > totalPaginas) setPagina(totalPaginas)
  }, [pagina, totalPaginas])

  const paginaItens = useMemo(() => {
    const inicio = (pagina - 1) * limite
    return movimentacoes.slice(inicio, inicio + limite)
  }, [movimentacoes, pagina, limite])

  const handleConfirmarRemocao = async () => {
    if (!confirmacao) return
    setRemovendo(true)
    try {
      await onRemover(confirmacao.id)
      setConfirmacao(null)
    } finally {
      setRemovendo(false)
    }
  }

  const handleLimiteChange = (qtd: number) => {
    setLimite(qtd)
    setPagina(1)
  }

  const conteudo = (
    <>
      {carregando ? (
        <TabelaSkeleton linhas={6} />
      ) : movimentacoes.length === 0 ? (
        <ListaVazia
          className="border-0 bg-transparent py-10"
          icone={<Wallet className="h-6 w-6" strokeWidth={1.6} />}
          titulo="Nenhum lançamento neste período"
          descricao="Use Receitas ou Despesas acima para registrar movimentos manuais do caixa."
        />
      ) : (
        <>
          <div className="flex flex-col gap-3 px-3 md:hidden">
            {paginaItens.map((m) => (
              <CardMovimentacaoFinancas
                key={m.id}
                movimentacao={m}
                onVisualizar={onVisualizar}
                onEditar={onEditar}
                onRemover={setConfirmacao}
              />
            ))}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <Table>
              <TableHeader>
                <TableRow className="border-border/60 hover:bg-transparent">
                  <TableHead className="w-10 text-xs font-medium text-muted-foreground" aria-label="Tipo" />
                  <TableHead className="text-xs font-medium text-muted-foreground">Descrição</TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground">
                    <div className="flex w-full justify-center">Status</div>
                  </TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground">Data</TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground">Categoria</TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground">Forma</TableHead>
                  <TableHead className="text-right text-xs font-medium text-muted-foreground">Valor</TableHead>
                  <TableHead className="w-12" aria-label="Ações" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginaItens.map((m) => {
                  const entrada = m.tipo === 'entrada'
                  const syncPedido = Boolean(m.pedido_id)
                  return (
                    <TableRow
                      key={m.id}
                      className="cursor-pointer border-border/60"
                      onClick={() => onVisualizar?.(m)}
                    >
                      <TableCell className="relative py-3 pl-3">
                        <div
                          className={cn(
                            'flex h-12 items-center border-l-4',
                            entrada ? 'border-emerald-500' : 'border-rose-500',
                          )}
                        >
                          <span className="pl-3">
                            {entrada ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-label="Receita" />
                            ) : (
                              <XCircle className="h-4 w-4 text-rose-500" aria-label="Despesa" />
                            )}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[280px] py-3">
                        <span className="block truncate text-sm text-foreground">
                          {m.descricao || (entrada ? 'Receita' : 'Despesa')}
                        </span>
                        {m.funcionario?.nome ? (
                          <span className="text-[11px] text-muted-foreground">{m.funcionario.nome}</span>
                        ) : null}
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="flex w-full justify-center">
                          {syncPedido ? (
                            <Badge
                              variant="secondary"
                              className="rounded-full border border-emerald-200 bg-emerald-50 font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"
                            >
                              Pedido
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="rounded-full border-border/70 bg-background/50 font-medium text-foreground"
                            >
                              Manual
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap py-3 text-xs tabular-nums text-muted-foreground">
                        {formatarData(m.created_at)}
                      </TableCell>
                      <TableCell className="py-3 text-sm text-muted-foreground">
                        {m.categoria?.nome ?? <span className="text-xs">—</span>}
                      </TableCell>
                      <TableCell className="py-3 text-sm capitalize text-muted-foreground">
                        {m.forma_pagamento ?? <span className="text-xs">—</span>}
                      </TableCell>
                      <TableCell
                        className={cn(
                          'py-3 text-right text-sm font-semibold tabular-nums',
                          entrada
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400',
                        )}
                      >
                        {entrada ? '+' : '−'} {formatarMoeda(m.valor)}
                      </TableCell>
                      <TableCell className="py-3 text-right">
                        <MenuAcoes
                          ariaLabel="Ações do lançamento"
                          items={[
                            ...(onVisualizar
                              ? [
                                  {
                                    key: 'ver',
                                    label: 'Visualizar',
                                    icon: <Eye className="h-3.5 w-3.5" />,
                                    onSelect: () => onVisualizar(m),
                                  },
                                ]
                              : []),
                            ...(!syncPedido
                              ? [
                                  {
                                    key: 'editar',
                                    label: 'Editar',
                                    icon: <Edit className="h-3.5 w-3.5" />,
                                    onSelect: () => onEditar(m),
                                  },
                                ]
                              : []),
                            {
                              key: 'excluir',
                              label: 'Excluir',
                              icon: <Trash2 className="h-3.5 w-3.5" />,
                              onSelect: () => setConfirmacao(m),
                              variant: 'destructive' as const,
                              separatorBefore: true,
                            },
                          ]}
                        />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          <PaginacaoFinancas
            paginaAtual={pagina}
            totalPaginas={totalPaginas}
            totalItens={movimentacoes.length}
            itensPorPagina={limite}
            onPaginaChange={setPagina}
            onItensPorPaginaChange={handleLimiteChange}
            carregando={carregando}
          />
        </>
      )}
    </>
  )

  return (
    <>
      {embutido ? (
        conteudo
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/70 bg-card">
          <div className="flex items-center justify-between gap-3 border-b border-border/70 px-5 py-3.5">
            <div>
              <h3 className="text-base font-semibold tracking-tight text-foreground">Movimentações do período</h3>
              <p className="text-xs text-muted-foreground">{movimentacoes.length} lançamentos.</p>
            </div>
          </div>
          <div className="px-1">{conteudo}</div>
        </div>
      )}

      <AlertDialog open={!!confirmacao} onOpenChange={(o) => !o && setConfirmacao(null)}>
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-semibold tracking-tight">Excluir lançamento?</AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-muted-foreground">
              {confirmacao?.pedido_id
                ? 'Isso remove só o registro sincronizado do caixa. O pedido original permanece.'
                : 'Essa ação remove permanentemente o registro do caixa.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="rounded-lg border border-border/70 bg-muted/30 p-3 text-sm">
            <p className="font-medium text-foreground">
              {confirmacao?.descricao || (confirmacao?.tipo === 'entrada' ? 'Receita' : 'Despesa')}
            </p>
            <p className="tabular-nums text-muted-foreground">
              {formatarMoeda(confirmacao?.valor ?? 0)} · {formatarData(confirmacao?.created_at)}
            </p>
          </div>
          <AlertDialogFooter className="gap-2 sm:justify-between">
            <AlertDialogCancel disabled={removendo}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleConfirmarRemocao()
              }}
              disabled={removendo}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removendo ? 'Excluindo…' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
