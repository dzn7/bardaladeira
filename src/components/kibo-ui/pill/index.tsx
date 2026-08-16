"use client"

import { Slot } from "radix-ui"
import type { ComponentProps, ReactNode } from "react"
import { cn } from "@/lib/utils"

export type PillProps = ComponentProps<"div"> & {
  asChild?: boolean
  themed?: boolean
}

export const Pill = ({
  asChild = false,
  themed = false,
  className,
  ...props
}: PillProps) => {
  const Comp = asChild ? Slot.Root : "div"
  return (
    <Comp
      data-themed={themed ? "true" : undefined}
      className={cn(
        "inline-flex min-h-9 items-center gap-2 whitespace-nowrap rounded-full border border-transparent bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bordo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        className,
      )}
      {...props}
    />
  )
}

export type PillStatusProps = {
  children: ReactNode
  className?: string
}

export const PillStatus = ({ children, className, ...props }: PillStatusProps) => (
  <div
    className={cn(
      "flex items-center gap-2 border-r border-current/20 pr-2 font-semibold",
      className,
    )}
    {...props}
  >
    {children}
  </div>
)

export type PillIndicatorProps = {
  variant?: "success" | "error" | "warning" | "info"
  pulse?: boolean
  className?: string
}

export const PillIndicator = ({
  variant = "success",
  pulse = false,
  className,
}: PillIndicatorProps) => (
  <span className={cn("relative flex size-2", className)}>
    {pulse && (
      <span
        className={cn(
          "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
          variant === "success" && "bg-emerald-400",
          variant === "error" && "bg-rose-400",
          variant === "warning" && "bg-amber-400",
          variant === "info" && "bg-sky-400",
        )}
      />
    )}
    <span
      className={cn(
        "relative inline-flex size-2 rounded-full",
        variant === "success" && "bg-emerald-500",
        variant === "error" && "bg-rose-500",
        variant === "warning" && "bg-amber-500",
        variant === "info" && "bg-sky-500",
      )}
    />
  </span>
)

export type PillIconProps = {
  icon: React.ComponentType<{ className?: string }>
  className?: string
}

export const PillIcon = ({ icon: Icon, className }: PillIconProps) => (
  <Icon className={cn("size-3", className)} />
)
