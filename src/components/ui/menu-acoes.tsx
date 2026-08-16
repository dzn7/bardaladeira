'use client'

import type { ReactNode } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

export type MenuAcaoItem = {
  key: string
  label: string
  icon?: ReactNode
  onSelect: () => void
  disabled?: boolean
  variant?: 'default' | 'destructive' | 'success'
  separatorBefore?: boolean
}

type MenuAcoesProps = {
  items: MenuAcaoItem[]
  ariaLabel?: string
  align?: 'start' | 'center' | 'end'
  side?: 'top' | 'right' | 'bottom' | 'left'
  triggerClassName?: string
  contentClassName?: string
  disabled?: boolean
}

const VARIANTE_ITEM: Record<NonNullable<MenuAcaoItem['variant']>, string> = {
  default:
    'cursor-pointer gap-2 focus:bg-[#0399F9]/10 focus:text-[#0369A1] dark:focus:bg-[#0399F9]/15 dark:focus:text-[#7DD3FC]',
  success:
    'cursor-pointer gap-2 text-emerald-700 focus:bg-emerald-500/10 focus:text-emerald-800 dark:text-emerald-300 dark:focus:bg-emerald-500/20',
  destructive:
    'cursor-pointer gap-2 bg-red-500/5 text-red-500 focus:bg-red-500/20 focus:text-red-600 dark:text-red-400',
}

export const MenuAcoes = ({
  items,
  ariaLabel = 'Abrir ações',
  align = 'end',
  side = 'bottom',
  triggerClassName,
  contentClassName,
  disabled = false,
}: MenuAcoesProps) => {
  if (items.length === 0) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled}
          className={cn(
            'h-8 w-8 shrink-0 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground',
            triggerClassName,
          )}
          aria-label={ariaLabel}
          onClick={(event) => event.stopPropagation()}
        >
          <MoreHorizontal className="h-4 w-4" strokeWidth={1.6} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        side={side}
        className={cn('w-48 p-1', contentClassName)}
        onClick={(event) => event.stopPropagation()}
      >
        <DropdownMenuGroup>
          {items.map((item) => (
            <span key={item.key} className="contents">
              {item.separatorBefore ? <DropdownMenuSeparator /> : null}
              <DropdownMenuItem
                disabled={item.disabled}
                className={VARIANTE_ITEM[item.variant ?? 'default']}
                onSelect={() => {
                  if (item.disabled) return
                  window.setTimeout(() => {
                    item.onSelect()
                  }, 0)
                }}
              >
                {item.icon}
                {item.label}
              </DropdownMenuItem>
            </span>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
