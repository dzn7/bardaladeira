'use client'

import { Calendar, CheckCircle2, Edit, Eye, Trash2, XCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { MenuAcoes } from '@/components/ui/menu-acoes'
import { cn } from '@/lib/utils'
import type { MovimentacaoCaixa } from '@/lib/tipos-caixa'
import { formatarData, formatarMoeda } from '../lib/formatadores'

type CardMovimentacaoFinancasProps = {
  movimentacao: MovimentacaoCaixa
  onVisualizar?: (movimentacao: MovimentacaoCaixa) => void
  onEditar: (movimentacao: MovimentacaoCaixa) => void
  onRemover: (movimentacao: MovimentacaoCaixa) => void
}

export const CardMovimentacaoFinancas = ({
  movimentacao,
  onVisualizar,
  onEditar,
  onRemover,
}: CardMovimentacaoFinancasProps) => {
  const entrada = movimentacao.tipo === 'entrada'
  const syncPedido = Boolean(movimentacao.pedido_id)

  return (
    <div
      className={cn(
        'cursor-pointer rounded-lg border border-[#F1F1F1] bg-[#f7f9fa] p-4 shadow-sm transition-shadow hover:shadow-md',
        'dark:border-[#2D2F2F] dark:bg-[#161717]',
      )}
      onClick={() => onVisualizar?.(movimentacao)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onVisualizar?.(movimentacao)
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`Abrir lançamento ${movimentacao.descricao || (entrada ? 'Receita' : 'Despesa')}`}
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.6} aria-hidden />
            <span className="text-sm font-medium tabular-nums">{formatarData(movimentacao.created_at)}</span>
          </div>

          <div className="flex items-center gap-1">
            <span
              className={cn(
                'text-base font-semibold tabular-nums',
                entrada ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400',
              )}
            >
              {entrada ? '+' : '−'} {formatarMoeda(movimentacao.valor)}
            </span>
            <MenuAcoes
              ariaLabel="Ações do lançamento"
              items={[
                ...(onVisualizar
                  ? [
                      {
                        key: 'ver',
                        label: 'Visualizar',
                        icon: <Eye className="h-3.5 w-3.5" />,
                        onSelect: () => onVisualizar(movimentacao),
                      },
                    ]
                  : []),
                ...(!syncPedido
                  ? [
                      {
                        key: 'editar',
                        label: 'Editar',
                        icon: <Edit className="h-3.5 w-3.5" />,
                        onSelect: () => onEditar(movimentacao),
                      },
                    ]
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
        </div>

        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">
            {movimentacao.descricao || (entrada ? 'Receita' : 'Despesa')}
          </p>
          {movimentacao.funcionario?.nome ? (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{movimentacao.funcionario.nome}</p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge
            className={cn(
              'rounded-full px-2 py-0.5 text-xs font-medium shadow-none',
              entrada
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100'
                : 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-100',
            )}
          >
            {entrada ? 'Receita' : 'Despesa'}
          </Badge>
          {syncPedido ? (
            <Badge
              variant="secondary"
              className="rounded-full border border-emerald-200 bg-emerald-50 font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300"
            >
              Pedido
            </Badge>
          ) : (
            <Badge variant="outline" className="rounded-full border-border/70 bg-background/50 font-medium">
              Manual
            </Badge>
          )}
          {movimentacao.categoria?.nome ? (
            <span className="text-xs text-muted-foreground">{movimentacao.categoria.nome}</span>
          ) : null}
          {movimentacao.forma_pagamento ? (
            <span className="text-xs capitalize text-muted-foreground">{movimentacao.forma_pagamento}</span>
          ) : null}
        </div>

        <div
          className={cn(
            'flex items-center gap-2 border-l-4 pl-3',
            entrada ? 'border-emerald-500' : 'border-rose-500',
          )}
        >
          {entrada ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden />
          ) : (
            <XCircle className="h-4 w-4 text-rose-500" aria-hidden />
          )}
          <span className="text-xs text-muted-foreground">
            {entrada ? 'Entrada no caixa' : 'Saída do caixa'}
          </span>
        </div>
      </div>
    </div>
  )
}
