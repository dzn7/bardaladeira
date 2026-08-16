import { cn } from '@/lib/utils'

export const CHIP_FILTRO_BASE =
  'inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-xs font-medium shadow-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0399F9]/40 data-[state=on]:shadow-none'

export const CHIP_FILTRO_DEFAULT = cn(
  CHIP_FILTRO_BASE,
  'border-border/70 bg-card text-muted-foreground hover:bg-muted',
  'data-[state=on]:border-[#0399F9] data-[state=on]:bg-[#E6F4FE] data-[state=on]:text-[#0369A1]',
  'dark:data-[state=on]:border-[#0399F9] dark:data-[state=on]:bg-[#0F2A3A] dark:data-[state=on]:text-[#7DD3FC]',
)

export const CHIP_FILTRO_ALERTA = cn(
  CHIP_FILTRO_BASE,
  'border-amber-300 bg-card text-amber-700 hover:bg-amber-50 dark:border-amber-700/60 dark:text-amber-300',
  'data-[state=on]:border-amber-500 data-[state=on]:bg-amber-50 data-[state=on]:text-amber-800',
  'dark:data-[state=on]:bg-amber-900/30 dark:data-[state=on]:text-amber-200',
)

export const CHIP_FILTRO_BOTAO = cn(
  CHIP_FILTRO_BASE,
  'border-border/70 bg-card text-muted-foreground hover:bg-muted',
  'aria-[pressed=true]:border-[#0399F9] aria-[pressed=true]:bg-[#E6F4FE] aria-[pressed=true]:text-[#0369A1]',
  'dark:aria-[pressed=true]:border-[#0399F9] dark:aria-[pressed=true]:bg-[#0F2A3A] dark:aria-[pressed=true]:text-[#7DD3FC]',
)
