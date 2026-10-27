'use client'

import { useEffect, useMemo, useState } from 'react'
import { Receipt } from '@phosphor-icons/react'
import { ListaVazia, TabelaSkeleton } from '@/components/admin/filtros/ListaEstado'
import { Selo } from '@/components/admin/ui'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { PedidoFinanceiro } from '../types'
import { formatarData, formatarMoeda } from '../lib/formatadores'
import { PaginacaoFinancas } from './PaginacaoFinancas'

interface ListaPedidosNaoPagosProps {
  pedidos: PedidoFinanceiro[]
  total: number
  carregando?: boolean
}

const LIMITE_PADRAO = 15

const ROTULOS_STATUS: Record<string, string> = {
  aguardando_pagamento: 'Aguardando',
  pendente: 'Pendente',
  confirmado: 'Confirmado',
  preparando: 'Preparando',
  pronto: 'Pronto',
  saiu_para_entrega: 'Em entrega',
  entregue: 'Entregue',
}

export function ListaPedidosNaoPagos({ pedidos, total, carregando }: ListaPedidosNaoPagosProps) {
  const [pagina, setPagina] = useState(1)
  const [limite, setLimite] = useState(LIMITE_PADRAO)

  useEffect(() => {
    setPagina(1)
  }, [pedidos])

  const totalPaginas = Math.max(1, Math.ceil(pedidos.length / limite))

  useEffect(() => {
    if (pagina > totalPaginas) setPagina(totalPaginas)
  }, [pagina, totalPaginas])

  const paginaItens = useMemo(() => {
    const inicio = (pagina - 1) * limite
    return pedidos.slice(inicio, inicio + limite)
  }, [pedidos, pagina, limite])

  return (
    <div className="overflow-hidden rounded-xl border border-border/70 bg-card">
      <div className="flex flex-col gap-1 border-b border-border/70 px-4 py-3.5 sm:flex-row sm:items-start md:px-5 sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <Receipt className="h-4 w-4 text-muted-foreground" />
            Pedidos não pagos
          </h3>
          <p className="text-xs text-muted-foreground">
            {pedidos.length} {pedidos.length === 1 ? 'pedido aguardando' : 'pedidos aguardando'} pagamento.
          </p>
        </div>
        <div className="sm:text-right">
          <p className="text-[13px] text-muted-foreground">A receber</p>
          <p className="text-lg font-semibold tabular-nums text-foreground">{formatarMoeda(total)}</p>
        </div>
      </div>

      {carregando ? (
        <TabelaSkeleton linhas={5} />
      ) : pedidos.length === 0 ? (
        <ListaVazia
          className="border-0 bg-transparent py-10"
          icone={<Receipt className="h-6 w-6" />}
          titulo="Tudo em dia"
          descricao="Nenhum pedido pendente de pagamento."
        />
      ) : (
        <>
          <ul className="divide-y divide-border/70 md:hidden">
            {paginaItens.map((p) => (
              <li key={p.id} className="flex min-h-16 items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    #{p.numero_pedido} · {p.nome_cliente || 'Sem nome'}
                  </p>
                  <p className="mt-0.5 text-[13px] tabular-nums text-muted-foreground">
                    {formatarData(p.created_at)} · {ROTULOS_STATUS[p.status] ?? p.status}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                  {formatarMoeda(Number(p.total ?? 0))}
                </span>
              </li>
            ))}
          </ul>

          <div className="hidden max-h-[360px] overflow-auto md:block">
            <Table>
              <TableHeader className="sticky top-0 bg-card">
                <TableRow className="border-border/60 hover:bg-transparent">
                  <TableHead className="text-xs font-medium text-muted-foreground">Pedido</TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground">Cliente</TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground">
                    <div className="flex w-full justify-center">Status</div>
                  </TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground">Data</TableHead>
                  <TableHead className="text-right text-xs font-medium text-muted-foreground">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginaItens.map((p) => (
                  <TableRow key={p.id} className="border-border/60">
                    <TableCell className="whitespace-nowrap py-3 text-sm font-medium tabular-nums text-foreground">
                      #{p.numero_pedido}
                    </TableCell>
                    <TableCell className="py-3 text-sm text-foreground">{p.nome_cliente || '—'}</TableCell>
                    <TableCell className="py-3">
                      <div className="flex w-full justify-center">
                        <Selo>{ROTULOS_STATUS[p.status] ?? p.status}</Selo>
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap py-3 text-xs tabular-nums text-muted-foreground">
                      {formatarData(p.created_at)}
                    </TableCell>
                    <TableCell className="py-3 text-right text-sm font-semibold tabular-nums text-foreground">
                      {formatarMoeda(Number(p.total ?? 0))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="px-3 pb-3">
            <PaginacaoFinancas
              paginaAtual={pagina}
              totalPaginas={totalPaginas}
              totalItens={pedidos.length}
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
