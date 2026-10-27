'use client'

import { ReactNode, useEffect, useId, useRef, useState, useTransition } from 'react'
import { Slot } from '@radix-ui/react-slot'
import { toast } from 'sonner'
import { Botao, Gaveta } from '@/components/admin/ui'
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
  /** Mantido por compatibilidade; aplicado ao painel da gaveta. */
  contentClassName?: string
  formClassName?: string
  action: (formData: FormData) => Promise<void>
  children: ReactNode | ((helpers: { pending: boolean; close: () => void }) => ReactNode)
}

/** Formulário em gaveta (bottom sheet no celular, painel à direita no desktop). */
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
  const idForm = useId()

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
    <>
      {trigger ? <Slot onClick={() => handleOpenChange(true)}>{trigger}</Slot> : null}
      <Gaveta
        aberto={open}
        aoFechar={() => handleOpenChange(false)}
        bloqueada={pending}
        titulo={title}
        descricao={description}
        className={contentClassName}
        rodape={
          <>
            <Botao variante="contorno" onClick={() => handleOpenChange(false)} disabled={pending}>
              {cancelLabel}
            </Botao>
            <Botao type="submit" form={idForm} carregando={pending}>
              {submitLabel}
            </Botao>
          </>
        }
      >
        <form id={idForm} ref={formRef} onSubmit={handleSubmit} className={cn('space-y-4', formClassName)}>
          {typeof children === 'function' ? children({ pending, close: () => handleOpenChange(false) }) : children}
        </form>
      </Gaveta>
    </>
  )
}
