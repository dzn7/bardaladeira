'use client'

import { useEffect, useMemo, useState } from 'react'
import { Calendar, CreditCard, Wallet } from 'lucide-react'
import { ListaVazia, TabelaSkeleton } from '@/components/admin/filtros/ListaEstado'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { ContaCrediarioResumo } from '../types'
import { formatarData, formatarMoeda } from '../lib/formatadores'
import { PaginacaoFinancas } from './PaginacaoFinancas'

interface ListaCrediarioPendenteProps {
  crediarios: ContaCrediarioResumo[]
  total: number
  carregando?: boolean
}

const LIMITE_PADRAO = 15

export function ListaCrediarioPendente({ crediarios, total, carregando }: ListaCrediarioPendenteProps) {
  const [pagina, setPagina] = useState(1)
  const [limite, setLimite] = useState(LIMITE_PADRAO)

  useEffect(() => {
    setPagina(1)
  }, [crediarios])

  const totalPaginas = Math.max(1, Math.ceil(crediarios.length / limite))

  useEffect(() => {
    if (pagina > totalPaginas) setPagina(totalPaginas)
  }, [pagina, totalPaginas])

  const paginaItens = useMemo(() => {
    const inicio = (pagina - 1) * limite
    return crediarios.slice(inicio, inicio + limite)
  }, [crediarios, pagina, limite])

  return (
    <div className="overflow-hidden rounded-xl border border-border/70 bg-card">
      <div className="flex flex-col gap-1 border-b border-border/70 px-5 py-3.5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-base font-semibold tracking-tight text-foreground">
            <CreditCard strokeWidth={1.6} className="h-4 w-4 text-muted-foreground" />
            Crediário em aberto
          </h3>
          <p className="text-xs text-muted-foreground">
            {crediarios.length} {crediarios.length === 1 ? 'conta com saldo' : 'contas com saldo'} em aberto.
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Saldo total</p>
          <p className="text-lg font-semibold tabular-nums text-foreground">{formatarMoeda(total)}</p>
        </div>
      </div>

      {carregando ? (
        <TabelaSkeleton linhas={5} />
      ) : crediarios.length === 0 ? (
        <ListaVazia
          className="border-0 bg-transparent py-10"
          icone={<Wallet className="h-6 w-6" strokeWidth={1.6} />}
          titulo="Sem saldo em aberto"
          descricao="Todos os clientes estão em dia com o crediário."
        />
      ) : (
        <>
          <div className="flex flex-col gap-3 px-3 py-3 md:hidden">
            {paginaItens.map((c) => (
              <div
                key={c.id}
                className={cn(
                  'rounded-lg border border-[#F1F1F1] bg-[#f7f9fa] p-4 shadow-sm',
                  'dark:border-[#2D2F2F] dark:bg-[#161717]',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.6} aria-hidden />
                    <span className="text-sm font-medium tabular-nums">{formatarData(c.atualizado_em)}</span>
                  </div>
                  <span className="text-base font-semibold tabular-nums text-amber-700 dark:text-amber-300">
                    {formatarMoeda(Number(c.saldo_atual ?? 0))}
                  </span>
                </div>
                <p className="mt-3 truncate text-sm font-semibold text-foreground">{c.cliente_nome}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{c.telefone ?? '—'}</p>
              </div>
            ))}
          </div>

          <div className="hidden max-h-[360px] overflow-auto md:block">
            <Table>
              <TableHeader className="sticky top-0 bg-card">
                <TableRow className="border-border/60 hover:bg-transparent">
                  <TableHead className="w-10 text-xs font-medium text-muted-foreground" aria-label="Tipo" />
                  <TableHead className="text-xs font-medium text-muted-foreground">Cliente</TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground">Telefone</TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground">Atualizado</TableHead>
                  <TableHead className="text-right text-xs font-medium text-muted-foreground">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginaItens.map((c) => (
                  <TableRow key={c.id} className="border-border/60">
                    <TableCell className="py-3 pl-3">
                      <div className="flex h-10 items-center border-l-4 border-amber-500">
                        <span className="pl-3">
                          <CreditCard className="h-4 w-4 text-amber-600" aria-hidden />
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="py-3 text-sm font-medium text-foreground">{c.cliente_nome}</TableCell>
                    <TableCell className="whitespace-nowrap py-3 text-sm text-muted-foreground">
                      {c.telefone ?? '—'}
                    </TableCell>
                    <TableCell className="whitespace-nowrap py-3 text-xs tabular-nums text-muted-foreground">
                      {formatarData(c.atualizado_em)}
                    </TableCell>
                    <TableCell className="py-3 text-right text-sm font-semibold tabular-nums text-amber-700 dark:text-amber-300">
                      {formatarMoeda(Number(c.saldo_atual ?? 0))}
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
              totalItens={crediarios.length}
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
