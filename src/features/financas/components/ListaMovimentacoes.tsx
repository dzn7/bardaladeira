'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowDownLeft, ArrowUpRight, PencilSimple as Edit, Eye, Trash as Trash2, Wallet } from '@phosphor-icons/react'
import { Selo, useConfirmar } from '@/components/admin/ui'
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
  const confirmar = useConfirmar()
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

  const pedirRemocao = async (m: MovimentacaoCaixa) => {
    const ok = await confirmar({
      titulo: 'Excluir lançamento?',
      descricao: (
        <>
          <span className="block font-medium text-foreground">
            {m.descricao || (m.tipo === 'entrada' ? 'Receita' : 'Despesa')} · {formatarMoeda(m.valor)}
          </span>
          {m.pedido_id
            ? 'Sai só o registro do caixa. O pedido continua.'
            : 'O registro sai do caixa. Não dá para desfazer.'}
        </>
      ),
      confirmar: 'Excluir',
      perigo: true,
    })
    if (ok) await onRemover(m.id)
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
          icone={<Wallet className="h-6 w-6" />}
          titulo="Nenhum lançamento neste período"
          descricao="Use Receitas ou Despesas, no topo, para lançar entradas e saídas."
        />
      ) : (
        <>
          <ul className="divide-y divide-border/70 md:hidden">
            {paginaItens.map((m) => (
              <CardMovimentacaoFinancas
                key={m.id}
                movimentacao={m}
                onVisualizar={onVisualizar}
                onEditar={onEditar}
                onRemover={(m) => void pedirRemocao(m)}
              />
            ))}
          </ul>

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
                        {entrada ? (
                          <ArrowDownLeft className="size-4 text-emerald-600 dark:text-emerald-400" aria-label="Receita" />
                        ) : (
                          <ArrowUpRight className="size-4 text-rose-600 dark:text-rose-400" aria-label="Despesa" />
                        )}
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
                          <Selo tom={syncPedido ? 'primario' : 'neutro'}>{syncPedido ? 'Pedido' : 'Manual'}</Selo>
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
                              onSelect: () => void pedirRemocao(m),
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
              <h3 className="text-base font-semibold text-foreground">Lançamentos do período</h3>
              <p className="text-xs text-muted-foreground">{movimentacoes.length} lançamentos.</p>
            </div>
          </div>
          <div className="px-1">{conteudo}</div>
        </div>
      )}

    </>
  )
}
