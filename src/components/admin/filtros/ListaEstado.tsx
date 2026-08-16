'use client'

import type { ReactNode } from 'react'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

type ListaVaziaProps = {
  icone?: ReactNode
  titulo: string
  descricao?: string
  acao?: ReactNode
  className?: string
}

export const ListaVazia = ({ icone, titulo, descricao, acao, className }: ListaVaziaProps) => {
  return (
    <Empty className={cn('border border-dashed border-border/70 bg-card', className)}>
      <EmptyHeader>
        {icone ? <EmptyMedia variant="icon">{icone}</EmptyMedia> : null}
        <EmptyTitle>{titulo}</EmptyTitle>
        {descricao ? <EmptyDescription>{descricao}</EmptyDescription> : null}
      </EmptyHeader>
      {acao}
    </Empty>
  )
}

type GradeSkeletonProps = {
  quantidade?: number
  className?: string
  itemClassName?: string
}

export const GradeSkeleton = ({
  quantidade = 6,
  className,
  itemClassName,
}: GradeSkeletonProps) => {
  return (
    <div className={cn('grid gap-3 md:grid-cols-2 lg:grid-cols-3', className)}>
      {Array.from({ length: quantidade }).map((_, indice) => (
        <div
          key={indice}
          className={cn('space-y-3 rounded-xl border border-border/70 bg-card p-4', itemClassName)}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-6 w-16" />
          </div>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
          <div className="flex gap-2 pt-1">
            <Skeleton className="h-8 flex-1" />
            <Skeleton className="h-8 w-20" />
          </div>
        </div>
      ))}
    </div>
  )
}

type ListaSkeletonProps = {
  quantidade?: number
  className?: string
}

export const ListaSkeleton = ({ quantidade = 6, className }: ListaSkeletonProps) => {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: quantidade }).map((_, indice) => (
        <div
          key={indice}
          className="flex items-center gap-3 rounded-lg border border-border/70 bg-card p-3.5"
        >
          <Skeleton className="h-2 w-2 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-5 w-16" />
        </div>
      ))}
    </div>
  )
}

type TabelaSkeletonProps = {
  linhas?: number
  className?: string
}

export const TabelaSkeleton = ({ linhas = 6, className }: TabelaSkeletonProps) => {
  return (
    <div className={cn('space-y-2 py-2', className)}>
      {Array.from({ length: linhas }).map((_, indice) => (
        <Skeleton key={indice} className="h-12 w-full rounded-md" />
      ))}
    </div>
  )
}
