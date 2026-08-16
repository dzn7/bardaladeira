'use client'

import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'

import { useIsMobile } from '@/hooks/useIsMobile'
import { cn } from '@/lib/utils'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer'

type DialogSurface = 'dialog' | 'drawer'

const DialogSurfaceContext = React.createContext<DialogSurface>('dialog')

const useDialogSurface = () => React.useContext(DialogSurfaceContext)

type DialogProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Root> & {
  variant?: 'responsive' | 'dialog'
  /** Somente mobile (Drawer vaul): quando false, não fecha ao arrastar/tocar fora. */
  dismissible?: boolean
}

const Dialog = ({ variant = 'responsive', dismissible, ...props }: DialogProps) => {
  const isMobile = useIsMobile()
  const surface: DialogSurface = variant === 'dialog' || !isMobile ? 'dialog' : 'drawer'

  if (surface === 'drawer') {
    return (
      <DialogSurfaceContext.Provider value="drawer">
        <Drawer dismissible={dismissible} {...props} />
      </DialogSurfaceContext.Provider>
    )
  }

  return (
    <DialogSurfaceContext.Provider value="dialog">
      <DialogPrimitive.Root {...props} />
    </DialogSurfaceContext.Provider>
  )
}

const DialogTrigger = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Trigger>
>((props, ref) => {
  const surface = useDialogSurface()
  if (surface === 'drawer') {
    return <DrawerTrigger ref={ref} {...props} />
  }
  return <DialogPrimitive.Trigger ref={ref} {...props} />
})
DialogTrigger.displayName = DialogPrimitive.Trigger.displayName

const DialogPortal = ({ ...props }: DialogPrimitive.DialogPortalProps) => {
  const surface = useDialogSurface()
  if (surface === 'drawer') {
    return <>{props.children}</>
  }
  return <DialogPrimitive.Portal {...props} />
}
DialogPortal.displayName = DialogPrimitive.Portal.displayName

const DialogClose = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Close>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Close>
>((props, ref) => {
  const surface = useDialogSurface()
  if (surface === 'drawer') {
    return <DrawerClose ref={ref} {...props} />
  }
  return <DialogPrimitive.Close ref={ref} {...props} />
})
DialogClose.displayName = DialogPrimitive.Close.displayName

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    className={cn(
      'fixed inset-0 z-[1000] bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className,
    )}
    {...props}
    ref={ref}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

type DialogContentProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
}

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({ className, children, showCloseButton = true, ...props }, ref) => {
  const surface = useDialogSurface()

  if (surface === 'drawer') {
    return (
      <DrawerContent
        ref={ref as React.Ref<HTMLDivElement>}
        className={cn(
          'gap-0 overflow-y-auto p-6',
          className,
          'left-0 right-0 top-auto w-full max-w-none translate-x-0 translate-y-0 rounded-t-[10px]',
        )}
        {...props}
      >
        {showCloseButton ? (
          <DrawerClose className="absolute right-4 top-3 z-20 rounded-md opacity-70 ring-offset-background transition-opacity hover:bg-accent hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DrawerClose>
        ) : null}
        {children}
      </DrawerContent>
    )
  }

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          'fixed left-1/2 top-1/2 z-[1001] grid max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 overflow-y-auto rounded-xl border border-border/70 bg-card p-6 text-card-foreground shadow-[0_8px_32px_-12px_rgba(15,23,42,0.12)] outline-none duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:w-full',
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton ? (
          <DialogPrimitive.Close className="absolute right-4 top-4 rounded-md opacity-70 ring-offset-background transition-opacity hover:bg-accent hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        ) : null}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
})
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col space-y-1.5 text-center sm:text-left', className)} {...props} />
)
DialogHeader.displayName = 'DialogHeader'

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'mt-auto flex shrink-0 flex-col-reverse gap-2 pb-[max(0px,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end sm:space-x-2',
      className,
    )}
    {...props}
  />
)
DialogFooter.displayName = 'DialogFooter'

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => {
  const surface = useDialogSurface()
  if (surface === 'drawer') {
    return (
      <DrawerTitle
        ref={ref}
        className={cn('text-lg font-semibold leading-none tracking-tight', className)}
        {...props}
      />
    )
  }
  return (
    <DialogPrimitive.Title
      ref={ref}
      className={cn('text-lg font-semibold leading-none tracking-tight', className)}
      {...props}
    />
  )
})
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => {
  const surface = useDialogSurface()
  if (surface === 'drawer') {
    return (
      <DrawerDescription
        ref={ref}
        className={cn('text-sm text-muted-foreground', className)}
        {...props}
      />
    )
  }
  return (
    <DialogPrimitive.Description
      ref={ref}
      className={cn('text-sm text-muted-foreground', className)}
      {...props}
    />
  )
})
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
