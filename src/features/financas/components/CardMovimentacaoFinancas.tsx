'use client'

import { ArrowDownLeft, ArrowUpRight, PencilSimple as Edit, Eye, Trash as Trash2 } from '@phosphor-icons/react'
import { MenuAcoes } from '@/components/ui/menu-acoes'
import { Selo } from '@/components/admin/ui'
import { cn } from '@/lib/utils'
import type { MovimentacaoCaixa } from '@/lib/tipos-caixa'
import { formatarData, formatarMoeda } from '../lib/formatadores'

type CardMovimentacaoFinancasProps = {
  movimentacao: MovimentacaoCaixa
  onVisualizar?: (movimentacao: MovimentacaoCaixa) => void
  onEditar: (movimentacao: MovimentacaoCaixa) => void
  onRemover: (movimentacao: MovimentacaoCaixa) => void
}

/** Linha de lançamento para a lista mobile (renderiza um <li>). */
export const CardMovimentacaoFinancas = ({
  movimentacao,
  onVisualizar,
  onEditar,
  onRemover,
}: CardMovimentacaoFinancasProps) => {
  const entrada = movimentacao.tipo === 'entrada'
  const syncPedido = Boolean(movimentacao.pedido_id)
  const titulo = movimentacao.descricao || (entrada ? 'Receita' : 'Despesa')
  const detalhes = [
    formatarData(movimentacao.created_at),
    movimentacao.categoria?.nome,
    movimentacao.forma_pagamento,
    movimentacao.funcionario?.nome,
  ].filter(Boolean)

  return (
    <li
      className="flex min-h-16 cursor-pointer items-center gap-3 px-1 py-3 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      onClick={() => onVisualizar?.(movimentacao)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onVisualizar?.(movimentacao)
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`Abrir lançamento ${titulo}`}
    >
      <span
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-full',
          entrada ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
        )}
        aria-label={entrada ? 'Receita' : 'Despesa'}
      >
        {entrada ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-foreground">{titulo}</p>
          {syncPedido ? <Selo tom="primario">Pedido</Selo> : null}
        </div>
        <p className="mt-0.5 truncate text-[13px] capitalize text-muted-foreground">{detalhes.join(' · ')}</p>
      </div>

      <span
        className={cn(
          'shrink-0 text-sm font-semibold tabular-nums',
          entrada ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400',
        )}
      >
        {entrada ? '+' : '−'} {formatarMoeda(movimentacao.valor)}
      </span>

      <div onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
        <MenuAcoes
          ariaLabel="Ações do lançamento"
          items={[
            ...(onVisualizar
              ? [{ key: 'ver', label: 'Visualizar', icon: <Eye className="h-3.5 w-3.5" />, onSelect: () => onVisualizar(movimentacao) }]
              : []),
            ...(!syncPedido
              ? [{ key: 'editar', label: 'Editar', icon: <Edit className="h-3.5 w-3.5" />, onSelect: () => onEditar(movimentacao) }]
              : []),
            {
              key: 'excluir',
              label: 'Excluir',
              icon: <Trash2 className="h-3.5 w-3.5" />,
              onSelect: () => onRemover(movimentacao),
              variant: 'destructive' as const,
              separatorBefore: true,
            },
          ]}
        />
      </div>
    </li>
  )
}
