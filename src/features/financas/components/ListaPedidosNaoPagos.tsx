'use client'

import { useEffect, useMemo, useState } from 'react'
import { Calendar, Receipt } from 'lucide-react'
import { ListaVazia, TabelaSkeleton } from '@/components/admin/filtros/ListaEstado'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
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
      <div className="flex flex-col gap-1 border-b border-border/70 px-5 py-3.5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-base font-semibold tracking-tight text-foreground">
            <Receipt strokeWidth={1.6} className="h-4 w-4 text-muted-foreground" />
            Pedidos não pagos
          </h3>
          <p className="text-xs text-muted-foreground">
            {pedidos.length} {pedidos.length === 1 ? 'pedido aguardando' : 'pedidos aguardando'} pagamento.
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">A receber</p>
          <p className="text-lg font-semibold tabular-nums text-foreground">{formatarMoeda(total)}</p>
        </div>
      </div>

      {carregando ? (
        <TabelaSkeleton linhas={5} />
      ) : pedidos.length === 0 ? (
        <ListaVazia
          className="border-0 bg-transparent py-10"
          icone={<Receipt className="h-6 w-6" strokeWidth={1.6} />}
          titulo="Tudo em dia"
          descricao="Nenhum pedido pendente de pagamento."
        />
      ) : (
        <>
          <div className="flex flex-col gap-3 px-3 py-3 md:hidden">
            {paginaItens.map((p) => (
              <div
                key={p.id}
                className={cn(
                  'rounded-lg border border-[#F1F1F1] bg-[#f7f9fa] p-4 shadow-sm',
                  'dark:border-[#2D2F2F] dark:bg-[#161717]',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.6} aria-hidden />
                    <span className="text-sm font-medium tabular-nums">{formatarData(p.created_at)}</span>
                  </div>
                  <span className="text-base font-semibold tabular-nums text-foreground">
                    {formatarMoeda(Number(p.total ?? 0))}
                  </span>
                </div>
                <p className="mt-3 truncate text-sm font-semibold text-foreground">
                  #{p.numero_pedido} · {p.nome_cliente || '—'}
                </p>
                <div className="mt-2">
                  <Badge
                    variant="outline"
                    className="rounded-full border-border/70 bg-background/50 font-medium text-muted-foreground"
                  >
                    {ROTULOS_STATUS[p.status] ?? p.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden max-h-[360px] overflow-auto md:block">
            <Table>
              <TableHeader className="sticky top-0 bg-card">
                <TableRow className="border-border/60 hover:bg-transparent">
                  <TableHead className="w-10 text-xs font-medium text-muted-foreground" aria-label="Tipo" />
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
                    <TableCell className="py-3 pl-3">
                      <div className="flex h-10 items-center border-l-4 border-amber-500">
                        <span className="pl-3">
                          <Receipt className="h-4 w-4 text-amber-600" aria-hidden />
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap py-3 text-sm font-medium tabular-nums text-foreground">
                      #{p.numero_pedido}
                    </TableCell>
                    <TableCell className="py-3 text-sm text-foreground">{p.nome_cliente || '—'}</TableCell>
                    <TableCell className="py-3">
                      <div className="flex w-full justify-center">
                        <Badge
                          variant="outline"
                          className="rounded-full border-border/70 bg-background/50 font-medium text-muted-foreground"
                        >
                          {ROTULOS_STATUS[p.status] ?? p.status}
                        </Badge>
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
