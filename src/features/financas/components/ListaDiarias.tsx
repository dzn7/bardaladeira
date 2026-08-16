'use client'

import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Trash2 } from 'lucide-react'
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
import type { FinancasDiaria } from '../types'
import { formatarMoeda } from '../lib/formatadores'
import { cn } from '@/lib/utils'
import { PaginacaoFinancas } from './PaginacaoFinancas'

const LIMITE_PADRAO = 15

const formatarDataLocal = (ymd: string) => {
  const [y, m, d] = ymd.split('-').map(Number)
  if (!y || !m || !d) return ymd
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(
    new Date(y, m - 1, d),
  )
}

const rotuloForma = (forma: string | null) => {
  if (!forma) return '—'
  const mapa: Record<string, string> = {
    pix: 'Pix',
    dinheiro: 'Dinheiro',
    transferencia: 'Transferência',
    cartao_debito: 'Débito',
    cartao_credito: 'Crédito',
  }
  return mapa[forma] ?? forma
}

type ListaDiariasProps = {
  diarias: FinancasDiaria[]
  carregando?: boolean
  onRemover: (diaria: FinancasDiaria) => Promise<void>
  embutido?: boolean
}

export function ListaDiarias({ diarias, carregando, onRemover, embutido = false }: ListaDiariasProps) {
  const [confirmacao, setConfirmacao] = useState<FinancasDiaria | null>(null)
  const [removendo, setRemovendo] = useState(false)
  const [pagina, setPagina] = useState(1)
  const [limite, setLimite] = useState(LIMITE_PADRAO)

  useEffect(() => {
    setPagina(1)
  }, [diarias])

  const totalPaginas = Math.max(1, Math.ceil(diarias.length / limite))

  useEffect(() => {
    if (pagina > totalPaginas) setPagina(totalPaginas)
  }, [pagina, totalPaginas])

  const paginaItens = useMemo(() => {
    const inicio = (pagina - 1) * limite
    return diarias.slice(inicio, inicio + limite)
  }, [diarias, pagina, limite])

  const handleConfirmarRemocao = async () => {
    if (!confirmacao) return
    setRemovendo(true)
    try {
      await onRemover(confirmacao)
      setConfirmacao(null)
    } finally {
      setRemovendo(false)
    }
  }

  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl bg-card',
        embutido ? 'border-0' : 'border border-border/70',
      )}
    >
      {carregando ? (
        <TabelaSkeleton linhas={6} />
      ) : diarias.length === 0 ? (
        <ListaVazia
          className="border-0 bg-transparent py-10"
          icone={<CalendarDays className="h-6 w-6" strokeWidth={1.6} />}
          titulo="Nenhuma diária neste período"
          descricao="Clique num dia do calendário ou use Nova diária para lançar o pagamento."
        />
      ) : (
        <>
          <div className="flex flex-col gap-3 p-3 md:hidden">
            {paginaItens.map((d) => (
              <article
                key={d.id}
                className="rounded-lg border border-border/70 bg-muted/20 p-3"
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{d.nome_pessoa}</p>
                    <p className="text-xs text-muted-foreground">{formatarDataLocal(d.data_referencia)}</p>
                  </div>
                  <p className="shrink-0 font-mono text-sm font-semibold tabular-nums text-destructive">
                    − {formatarMoeda(d.valor)}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="outline" className="rounded-md border-border/70 font-normal shadow-none">
                    {rotuloForma(d.forma_pagamento)}
                  </Badge>
                  <MenuAcoes
                    ariaLabel="Ações da diária"
                    items={[
                      {
                        key: 'excluir',
                        label: 'Excluir',
                        icon: <Trash2 className="h-3.5 w-3.5" />,
                        onSelect: () => setConfirmacao(d),
                        variant: 'destructive',
                      },
                    ]}
                  />
                </div>
                {d.observacoes ? (
                  <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{d.observacoes}</p>
                ) : null}
              </article>
            ))}
          </div>

          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[120px]">Data</TableHead>
                  <TableHead>Pessoa</TableHead>
                  <TableHead className="w-[120px]">Forma</TableHead>
                  <TableHead className="w-[140px] text-right">Valor</TableHead>
                  <TableHead className="w-[56px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginaItens.map((d) => (
                  <TableRow key={d.id} className="group">
                    <TableCell className="text-sm text-muted-foreground">
                      {formatarDataLocal(d.data_referencia)}
                    </TableCell>
                    <TableCell>
                      <p className="text-sm font-medium text-foreground">{d.nome_pessoa}</p>
                      {d.observacoes ? (
                        <p className="line-clamp-1 text-xs text-muted-foreground">{d.observacoes}</p>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="rounded-md border-border/70 font-normal shadow-none">
                        {rotuloForma(d.forma_pagamento)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm font-semibold tabular-nums text-destructive">
                      − {formatarMoeda(d.valor)}
                    </TableCell>
                    <TableCell>
                      <MenuAcoes
                        ariaLabel="Ações da diária"
                        items={[
                          {
                            key: 'excluir',
                            label: 'Excluir',
                            icon: <Trash2 className="h-3.5 w-3.5" />,
                            onSelect: () => setConfirmacao(d),
                            variant: 'destructive',
                          },
                        ]}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <PaginacaoFinancas
            paginaAtual={pagina}
            totalPaginas={totalPaginas}
            totalItens={diarias.length}
            itensPorPagina={limite}
            onPaginaChange={setPagina}
            onItensPorPaginaChange={(qtd) => {
              setLimite(qtd)
              setPagina(1)
            }}
            carregando={carregando}
          />
        </>
      )}

      <AlertDialog open={Boolean(confirmacao)} onOpenChange={(aberto) => !aberto && setConfirmacao(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir diária?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso remove o lançamento de {confirmacao?.nome_pessoa} e a despesa correspondente no caixa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removendo}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                void handleConfirmarRemocao()
              }}
              disabled={removendo}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removendo ? 'Excluindo…' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
