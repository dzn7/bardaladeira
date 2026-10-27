import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { CircleNotch } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

export const variantesBotao = cva(
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    'disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  ],
  {
    variants: {
      variante: {
        primario: 'bg-primary text-primary-foreground hover:bg-primary/90',
        contorno: 'border border-border/70 bg-card text-foreground hover:bg-accent hover:text-accent-foreground',
        fantasma: 'text-foreground hover:bg-accent hover:text-accent-foreground',
        perigo: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        perigoSuave: 'text-red-600 hover:bg-red-500/10 dark:text-red-400',
      },
      tamanho: {
        padrao: 'h-10 px-4 text-sm',
        sm: 'h-9 px-3 text-sm',
        xs: 'h-8 px-2.5 text-xs',
        lg: 'h-12 px-5 text-base',
        icone: 'size-10',
        iconeSm: 'size-9',
      },
    },
    defaultVariants: { variante: 'primario', tamanho: 'padrao' },
  }
)

export interface BotaoProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof variantesBotao> {
  carregando?: boolean
}

export const Botao = React.forwardRef<HTMLButtonElement, BotaoProps>(
  ({ className, variante, tamanho, carregando = false, disabled, children, type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(variantesBotao({ variante, tamanho }), className)}
      disabled={disabled || carregando}
      aria-busy={carregando || undefined}
      {...props}
    >
      {carregando && <CircleNotch className="animate-spin" />}
      {children}
    </button>
  )
)
Botao.displayName = 'Botao'
