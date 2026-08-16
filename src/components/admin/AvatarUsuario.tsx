'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

export type TamanhoAvatarUsuario = 'xs' | 'sm' | 'md' | 'lg'

type AvatarUsuarioProps = {
  nome: string
  src?: string | null
  cor?: string | null
  size?: TamanhoAvatarUsuario
  className?: string
  onClick?: () => void
  'aria-label'?: string
}

const TAMANHOS: Record<TamanhoAvatarUsuario, string> = {
  xs: 'h-6 w-6 text-[9px]',
  sm: 'h-8 w-8 text-[10px]',
  md: 'h-10 w-10 text-xs',
  lg: 'h-12 w-12 text-sm',
}

export const obterIniciaisNome = (nome: string) => {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '?'
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return `${partes[0][0]}${partes[partes.length - 1][0]}`.toUpperCase()
}

export const AvatarUsuario = ({
  nome,
  src,
  cor,
  size = 'md',
  className,
  onClick,
  'aria-label': ariaLabel,
}: AvatarUsuarioProps) => {
  const iniciais = obterIniciaisNome(nome)
  const corFundo = cor?.trim() || undefined
  const clicavel = typeof onClick === 'function'

  const conteudo = (
    <Avatar className={cn(TAMANHOS[size], className)}>
      {src ? <AvatarImage src={src} alt={nome} /> : null}
      <AvatarFallback
        className={cn(
          'font-semibold text-primary-foreground',
          !corFundo && 'bg-primary text-primary-foreground',
        )}
        style={corFundo ? { backgroundColor: corFundo } : undefined}
      >
        {iniciais}
      </AvatarFallback>
    </Avatar>
  )

  if (!clicavel) return conteudo

  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      aria-label={ariaLabel || `Avatar de ${nome}`}
    >
      {conteudo}
    </button>
  )
}
