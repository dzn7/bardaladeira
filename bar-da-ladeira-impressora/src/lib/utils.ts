import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export const cn = (...entradas: ClassValue[]) => twMerge(clsx(entradas))
