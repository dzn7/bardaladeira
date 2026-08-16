'use client'

import { ReactNode, useEffect, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ActionDialogProps {
  trigger?: ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
  title: string
  description?: string
  submitLabel?: string
  cancelLabel?: string
  successMessage?: string
  contentClassName?: string
  formClassName?: string
  action: (formData: FormData) => Promise<void>
  children: ReactNode | ((helpers: { pending: boolean; close: () => void }) => ReactNode)
}

export function ActionDialog({
  trigger,
  open: openControlado,
  onOpenChange,
  title,
  description,
  submitLabel = 'Salvar',
  cancelLabel = 'Cancelar',
  successMessage,
  contentClassName,
  formClassName,
  action,
  children,
}: ActionDialogProps) {
  const [openInterno, setOpenInterno] = useState(false)
  const controlado = openControlado !== undefined
  const open = controlado ? openControlado : openInterno
  const [pending, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)

  const handleOpenChange = (proximo: boolean) => {
    if (!controlado) setOpenInterno(proximo)
    onOpenChange?.(proximo)
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!formRef.current) return
    const formData = new FormData(formRef.current)

    startTransition(async () => {
      try {
        await action(formData)
        if (successMessage) toast.success(successMessage)
        handleOpenChange(false)
        formRef.current?.reset()
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Não foi possível concluir a operação.'
        if (!successMessage) toast.error(message)
      }
    })
  }

  useEffect(() => {
    if (!open && formRef.current) {
      formRef.current.reset()
    }
  }, [open])

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent
        className={cn(
          'grid max-h-[calc(100dvh-1rem)] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden rounded-2xl border border-border/60 bg-card p-0 shadow-lg sm:max-w-[540px]',
          contentClassName,
        )}
      >
        <DialogHeader className="space-y-1 border-b border-border/60 px-5 pb-4 pt-5 text-left">
          <DialogTitle className="text-[15px] font-semibold tracking-tight text-foreground">{title}</DialogTitle>
          {description ? (
            <DialogDescription className="text-[13px] leading-relaxed text-muted-foreground">
              {description}
            </DialogDescription>
          ) : null}
        </DialogHeader>

        <form ref={formRef} onSubmit={handleSubmit} className={cn('flex min-h-0 flex-col', formClassName)}>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-4">
            {typeof children === 'function' ? children({ pending, close: () => handleOpenChange(false) }) : children}
          </div>

          <DialogFooter className="flex flex-col-reverse gap-2 border-t border-border/60 bg-muted/20 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:pb-3.5 sm:pt-3.5">
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleOpenChange(false)}
              disabled={pending}
              className="h-11 w-full text-muted-foreground hover:text-foreground sm:h-9 sm:w-auto"
            >
              {cancelLabel}
            </Button>
            <Button type="submit" disabled={pending} className="h-11 w-full sm:h-9 sm:min-w-[120px] sm:w-auto">
              {pending ? 'Salvando…' : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
