'use client'

import { Toaster } from 'sonner'
import { useIsMobile } from '@/hooks/useIsMobile'

export const AppToaster = () => {
  const isMobile = useIsMobile()

  return (
    <Toaster
      position={isMobile ? 'top-center' : 'top-right'}
      richColors
      closeButton
      visibleToasts={isMobile ? 2 : 3}
      duration={4500}
      gap={10}
      offset={isMobile ? 12 : 16}
      toastOptions={{
        closeButton: true,
        closeButtonAriaLabel: 'Fechar notificação',
        classNames: {
          toast:
            'group border border-border/70 bg-card text-foreground shadow-lg dark:bg-[#161717] dark:border-[#2D2F2F]',
          title: 'text-sm font-semibold',
          description: 'text-xs text-muted-foreground',
          actionButton:
            '!bg-foreground !text-background !rounded-md !px-3 !text-xs !font-semibold',
          cancelButton: '!bg-muted !text-muted-foreground !rounded-md !text-xs',
          closeButton:
            '!left-0 !right-auto !top-0 !translate-x-[-30%] !translate-y-[-30%] !border-border/70 !bg-card !text-muted-foreground hover:!bg-muted hover:!text-foreground',
          error: '!border-red-200 !bg-red-50 !text-red-800 dark:!border-red-900/50 dark:!bg-red-950/40 dark:!text-red-100',
          warning:
            '!border-amber-200 !bg-amber-50 !text-amber-900 dark:!border-amber-900/50 dark:!bg-amber-950/40 dark:!text-amber-100',
          success:
            '!border-emerald-200 !bg-emerald-50 !text-emerald-800 dark:!border-emerald-900/50 dark:!bg-emerald-950/40 dark:!text-emerald-100',
        },
      }}
    />
  )
}
