import * as React from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-10 w-full rounded-lg border border-zinc-300 dark:border-zinc-700',
          'bg-white dark:bg-zinc-900 px-3 py-2 text-sm',
          'placeholder:text-zinc-400 dark:placeholder:text-zinc-500',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bordo-500',
          'disabled:cursor-not-allowed disabled:opacity-50',
          type === 'date' && 'min-w-0 appearance-none text-left leading-5',
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)

Input.displayName = 'Input'

export { Input }
