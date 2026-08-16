'use client'

import { ReactNode } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

type ModalSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: ReactNode
  className?: string
  showCloseButton?: boolean
  variant?: 'responsive' | 'dialog'
}

export const ModalSheet = ({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  showCloseButton = true,
  variant = 'responsive',
}: ModalSheetProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} variant={variant}>
      <DialogContent
        showCloseButton={showCloseButton}
        className={cn('gap-0 overflow-hidden p-0 sm:max-w-lg', className)}
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        {description ? <DialogDescription className="sr-only">{description}</DialogDescription> : null}
        {children}
      </DialogContent>
    </Dialog>
  )
}
