'use client'

import { useEffect, useMemo, useState } from 'react'
import { Calendar, CheckCircle2, Wallet } from 'lucide-react'
import { ListaVazia, TabelaSkeleton } from '@/components/admin/filtros/ListaEstado'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { PagamentoPedido, PedidoFinanceiro } from '../types'
import { formatarData, formatarMoeda, rotularFormaPagamento } from '../lib/formatadores'
import { PaginacaoFinancas } from './PaginacaoFinancas'

interface ListaPagamentosProps {
  pagamentos: PagamentoPedido[]
  pedidos: PedidoFinanceiro[]
  carregando?: boolean
}

const LIMITE_PADRAO = 15

export function ListaPagamentos({ pagamentos, pedidos, carregando }: ListaPagamentosProps) {
  const pedidosMap = useMemo(() => new Map(pedidos.map((p) => [p.id, p])), [pedidos])
  const [pagina, setPagina] = useState(1)
  const [limite, setLimite] = useState(LIMITE_PADRAO)

  useEffect(() => {
    setPagina(1)
  }, [pagamentos])

  const totalPaginas = Math.max(1, Math.ceil(pagamentos.length / limite))

  useEffect(() => {
    if (pagina > totalPaginas) setPagina(totalPaginas)
  }, [pagina, totalPaginas])

  const paginaItens = useMemo(() => {
    const inicio = (pagina - 1) * limite
    return pagamentos.slice(inicio, inicio + limite)
  }, [pagamentos, pagina, limite])

  return (
    <div className="overflow-hidden rounded-xl border border-border/70 bg-card">
      <div className="flex items-center gap-3 border-b border-border/70 px-5 py-3.5">
        <div>
          <h3 className="text-base font-semibold tracking-tight text-foreground">Pagamentos recebidos</h3>
          <p className="text-xs text-muted-foreground">{pagamentos.length} registros no período.</p>
        </div>
      </div>

      {carregando ? (
        <TabelaSkeleton linhas={6} />
      ) : pagamentos.length === 0 ? (
        <ListaVazia
          className="border-0 bg-transparent py-10"
          icone={<Wallet className="h-6 w-6" strokeWidth={1.6} />}
          titulo="Nenhum pagamento neste período"
          descricao="Os pagamentos dos pedidos aparecerão aqui."
        />
      ) : (
        <>
          <div className="flex flex-col gap-3 px-3 py-3 md:hidden">
            {paginaItens.map((pg) => {
              const pedido = pedidosMap.get(pg.pedido_id)
              return (
                <div
                  key={pg.id}
                  className={cn(
                    'rounded-lg border border-[#F1F1F1] bg-[#f7f9fa] p-4 shadow-sm',
                    'dark:border-[#2D2F2F] dark:bg-[#161717]',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.6} aria-hidden />
                      <span className="text-sm font-medium tabular-nums">{formatarData(pg.created_at)}</span>
                    </div>
                    <span className="text-base font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                      {formatarMoeda(Number(pg.valor))}
                    </span>
                  </div>
                  <p className="mt-3 truncate text-sm font-semibold text-foreground">
                    {pedido ? `#${pedido.numero_pedido}` : 'Pedido'} · {pedido?.nome_cliente ?? '—'}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className="rounded-full border-border/70 bg-background/50 font-medium text-foreground"
                    >
                      {rotularFormaPagamento(pg.forma_pagamento)}
                    </Badge>
                    {pg.bandeira ? (
                      <span className="text-xs text-muted-foreground">{pg.bandeira}</span>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <Table>
              <TableHeader>
                <TableRow className="border-border/60 hover:bg-transparent">
                  <TableHead className="w-10 text-xs font-medium text-muted-foreground" aria-label="Status" />
                  <TableHead className="text-xs font-medium text-muted-foreground">Data</TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground">Pedido</TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground">Cliente</TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground">Forma</TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground">Bandeira</TableHead>
                  <TableHead className="text-right text-xs font-medium text-muted-foreground">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginaItens.map((pg) => {
                  const pedido = pedidosMap.get(pg.pedido_id)
                  return (
                    <TableRow key={pg.id} className="border-border/60">
                      <TableCell className="py-3 pl-3">
                        <div className="flex h-10 items-center border-l-4 border-emerald-500">
                          <span className="pl-3">
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden />
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap py-3 text-xs tabular-nums text-muted-foreground">
                        {formatarData(pg.created_at)}
                      </TableCell>
                      <TableCell className="py-3 text-sm tabular-nums text-foreground">
                        {pedido ? `#${pedido.numero_pedido}` : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="max-w-[200px] py-3 text-sm text-foreground">
                        <span className="block truncate">
                          {pedido?.nome_cliente ?? <span className="text-xs text-muted-foreground">—</span>}
                        </span>
                      </TableCell>
                      <TableCell className="py-3">
                        <Badge
                          variant="outline"
                          className="rounded-full border-border/70 bg-background/50 font-medium text-foreground"
                        >
                          {rotularFormaPagamento(pg.forma_pagamento)}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-3 text-sm text-muted-foreground">
                        {pg.bandeira ?? <span className="text-xs">—</span>}
                      </TableCell>
                      <TableCell className="py-3 text-right text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                        {formatarMoeda(Number(pg.valor))}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          <div className="px-3 pb-3">
            <PaginacaoFinancas
              paginaAtual={pagina}
              totalPaginas={totalPaginas}
              totalItens={pagamentos.length}
              itensPorPagina={limite}
              onPaginaChange={setPagina}
              onItensPorPaginaChange={(qtd) => {
                setLimite(qtd)
                setPagina(1)
              }}
              carregando={carregando}
            />
          </div>
        </>
      )}
    </div>
  )
}
