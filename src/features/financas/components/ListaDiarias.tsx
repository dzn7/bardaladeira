'use client'

import { useEffect, useMemo, useState } from 'react'
import { CalendarDots as CalendarDays, Trash as Trash2 } from '@phosphor-icons/react'
import { Selo, useConfirmar } from '@/components/admin/ui'
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
  const confirmar = useConfirmar()
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

  const pedirRemocao = async (d: FinancasDiaria) => {
    const ok = await confirmar({
      titulo: 'Excluir diária?',
      descricao: `Sai a diária de ${d.nome_pessoa} e a despesa dela no caixa.`,
      confirmar: 'Excluir',
      perigo: true,
    })
    if (ok) await onRemover(d)
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
          icone={<CalendarDays className="h-6 w-6" />}
          titulo="Nenhuma diária neste período"
          descricao="Toque num dia do calendário ou em Nova diária."
        />
      ) : (
        <>
          <ul className="divide-y divide-border/70 md:hidden">
            {paginaItens.map((d) => (
              <li key={d.id} className="flex min-h-16 items-center gap-3 px-1 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{d.nome_pessoa}</p>
                  <p className="mt-0.5 truncate text-[13px] text-muted-foreground">
                    {formatarDataLocal(d.data_referencia)} · {rotuloForma(d.forma_pagamento)}
                    {d.observacoes ? ` · ${d.observacoes}` : ''}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-destructive">
                  − {formatarMoeda(d.valor)}
                </span>
                <MenuAcoes
                  ariaLabel="Ações da diária"
                  items={[
                    {
                      key: 'excluir',
                      label: 'Excluir',
                      icon: <Trash2 className="h-3.5 w-3.5" />,
                      onSelect: () => void pedirRemocao(d),
                      variant: 'destructive',
                    },
                  ]}
                />
              </li>
            ))}
          </ul>

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
                      <Selo>{rotuloForma(d.forma_pagamento)}</Selo>
                    </TableCell>
                    <TableCell className="text-right text-sm font-semibold tabular-nums text-destructive">
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
                            onSelect: () => void pedirRemocao(d),
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

    </div>
  )
}
