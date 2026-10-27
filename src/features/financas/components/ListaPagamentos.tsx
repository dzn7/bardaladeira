'use client'

import { useEffect, useMemo, useState } from 'react'
import { Wallet } from '@phosphor-icons/react'
import { ListaVazia, TabelaSkeleton } from '@/components/admin/filtros/ListaEstado'
import { Selo } from '@/components/admin/ui'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
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
      <div className="flex items-center gap-3 border-b border-border/70 px-4 py-3.5 md:px-5">
        <div>
          <h3 className="text-base font-semibold text-foreground">Pagamentos recebidos</h3>
          <p className="text-xs text-muted-foreground">{pagamentos.length} registros no período.</p>
        </div>
      </div>

      {carregando ? (
        <TabelaSkeleton linhas={6} />
      ) : pagamentos.length === 0 ? (
        <ListaVazia
          className="border-0 bg-transparent py-10"
          icone={<Wallet className="h-6 w-6" />}
          titulo="Nenhum pagamento neste período"
          descricao="Os pagamentos dos pedidos aparecerão aqui."
        />
      ) : (
        <>
          <ul className="divide-y divide-border/70 md:hidden">
            {paginaItens.map((pg) => {
              const pedido = pedidosMap.get(pg.pedido_id)
              return (
                <li key={pg.id} className="flex min-h-16 items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {pedido ? `#${pedido.numero_pedido}` : 'Pedido'} · {pedido?.nome_cliente ?? 'Sem nome'}
                    </p>
                    <p className="mt-0.5 truncate text-[13px] tabular-nums text-muted-foreground">
                      {[formatarData(pg.created_at), rotularFormaPagamento(pg.forma_pagamento), pg.bandeira]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                    {formatarMoeda(Number(pg.valor))}
                  </span>
                </li>
              )
            })}
          </ul>

          <div className="hidden overflow-x-auto md:block">
            <Table>
              <TableHeader>
                <TableRow className="border-border/60 hover:bg-transparent">
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
                        <Selo>{rotularFormaPagamento(pg.forma_pagamento)}</Selo>
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
