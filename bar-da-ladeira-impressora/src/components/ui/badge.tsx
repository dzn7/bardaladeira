import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-5 whitespace-nowrap',
  {
    variants: {
      variant: {
        neutro: 'border-border bg-muted text-muted-foreground',
        primario: 'border-primary/25 bg-primary/10 text-primary',
        sucesso: 'border-success/25 bg-success/10 text-success',
        aviso: 'border-warning/30 bg-warning/10 text-warning',
        erro: 'border-destructive/25 bg-destructive/10 text-destructive'
      }
    },
    defaultVariants: { variant: 'neutro' }
  }
)

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>

const Badge = ({ className, variant, ...props }: BadgeProps) => (
  <span className={cn(badgeVariants({ variant }), className)} {...props} />
)

export { Badge, badgeVariants }
