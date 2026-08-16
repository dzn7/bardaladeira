import * as React from 'react'
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  MoreHorizontal,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const Pagination = ({ className, ...props }: React.ComponentProps<'nav'>) => (
  <nav
    role="navigation"
    aria-label="Paginação"
    className={cn('mx-auto flex w-full justify-center', className)}
    {...props}
  />
)

const PaginationContent = React.forwardRef<
  HTMLUListElement,
  React.ComponentProps<'ul'>
>(({ className, ...props }, ref) => (
  <ul ref={ref} className={cn('flex flex-row items-center gap-1', className)} {...props} />
))
PaginationContent.displayName = 'PaginationContent'

const PaginationItem = React.forwardRef<
  HTMLLIElement,
  React.ComponentProps<'li'>
>(({ className, ...props }, ref) => (
  <li ref={ref} className={cn(className)} {...props} />
))
PaginationItem.displayName = 'PaginationItem'

type PaginationButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  isActive?: boolean
  size?: 'default' | 'icon'
}

const PaginationButton = React.forwardRef<HTMLButtonElement, PaginationButtonProps>(
  ({ className, isActive, size = 'icon', type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'inline-flex items-center justify-center rounded-lg border text-sm font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        'disabled:pointer-events-none disabled:opacity-40',
        size === 'icon' ? 'size-10' : 'h-10 gap-1 px-3',
        isActive
          ? 'border-foreground bg-foreground text-background'
          : 'border-border/70 bg-card text-foreground hover:bg-accent',
        className,
      )}
      {...props}
    />
  ),
)
PaginationButton.displayName = 'PaginationButton'

const PaginationFirst = React.forwardRef<
  HTMLButtonElement,
  Omit<PaginationButtonProps, 'children'>
>((props, ref) => (
  <PaginationButton ref={ref} aria-label="Ir para a primeira página" {...props}>
    <ChevronsLeft className="size-4" strokeWidth={1.6} />
  </PaginationButton>
))
PaginationFirst.displayName = 'PaginationFirst'

const PaginationPrevious = React.forwardRef<
  HTMLButtonElement,
  Omit<PaginationButtonProps, 'children'>
>((props, ref) => (
  <PaginationButton ref={ref} aria-label="Ir para a página anterior" {...props}>
    <ChevronLeft className="size-4" strokeWidth={1.6} />
  </PaginationButton>
))
PaginationPrevious.displayName = 'PaginationPrevious'

const PaginationNext = React.forwardRef<
  HTMLButtonElement,
  Omit<PaginationButtonProps, 'children'>
>((props, ref) => (
  <PaginationButton ref={ref} aria-label="Ir para a próxima página" {...props}>
    <ChevronRight className="size-4" strokeWidth={1.6} />
  </PaginationButton>
))
PaginationNext.displayName = 'PaginationNext'

const PaginationLast = React.forwardRef<
  HTMLButtonElement,
  Omit<PaginationButtonProps, 'children'>
>((props, ref) => (
  <PaginationButton ref={ref} aria-label="Ir para a última página" {...props}>
    <ChevronsRight className="size-4" strokeWidth={1.6} />
  </PaginationButton>
))
PaginationLast.displayName = 'PaginationLast'

const PaginationEllipsis = ({ className, ...props }: React.ComponentProps<'span'>) => (
  <span
    aria-hidden
    className={cn('flex size-10 items-center justify-center text-muted-foreground', className)}
    {...props}
  >
    <MoreHorizontal className="size-4" strokeWidth={1.6} />
    <span className="sr-only">Mais páginas</span>
  </span>
)
PaginationEllipsis.displayName = 'PaginationEllipsis'

export {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationFirst,
  PaginationItem,
  PaginationButton,
  PaginationLast,
  PaginationNext,
  PaginationPrevious,
}
