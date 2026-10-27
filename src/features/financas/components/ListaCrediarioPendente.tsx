'use client'

import { useEffect, useMemo, useState } from 'react'
import { CreditCard, Wallet } from '@phosphor-icons/react'
import { ListaVazia, TabelaSkeleton } from '@/components/admin/filtros/ListaEstado'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
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
      <div className="flex flex-col gap-1 border-b border-border/70 px-4 py-3.5 sm:flex-row sm:items-start md:px-5 sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            Crediário em aberto
          </h3>
          <p className="text-xs text-muted-foreground">
            {crediarios.length} {crediarios.length === 1 ? 'conta com saldo' : 'contas com saldo'} em aberto.
          </p>
        </div>
        <div className="sm:text-right">
          <p className="text-[13px] text-muted-foreground">Saldo total</p>
          <p className="text-lg font-semibold tabular-nums text-foreground">{formatarMoeda(total)}</p>
        </div>
      </div>

      {carregando ? (
        <TabelaSkeleton linhas={5} />
      ) : crediarios.length === 0 ? (
        <ListaVazia
          className="border-0 bg-transparent py-10"
          icone={<Wallet className="h-6 w-6" />}
          titulo="Sem saldo em aberto"
          descricao="Todos os clientes estão em dia com o crediário."
        />
      ) : (
        <>
          <ul className="divide-y divide-border/70 md:hidden">
            {paginaItens.map((c) => (
              <li key={c.id} className="flex min-h-16 items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{c.cliente_nome}</p>
                  <p className="mt-0.5 truncate text-[13px] tabular-nums text-muted-foreground">
                    {[c.telefone, formatarData(c.atualizado_em)].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-amber-700 dark:text-amber-300">
                  {formatarMoeda(Number(c.saldo_atual ?? 0))}
                </span>
              </li>
            ))}
          </ul>

          <div className="hidden max-h-[360px] overflow-auto md:block">
            <Table>
              <TableHeader className="sticky top-0 bg-card">
                <TableRow className="border-border/60 hover:bg-transparent">
                  <TableHead className="text-xs font-medium text-muted-foreground">Cliente</TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground">Telefone</TableHead>
                  <TableHead className="text-xs font-medium text-muted-foreground">Atualizado</TableHead>
                  <TableHead className="text-right text-xs font-medium text-muted-foreground">Saldo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginaItens.map((c) => (
                  <TableRow key={c.id} className="border-border/60">
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
