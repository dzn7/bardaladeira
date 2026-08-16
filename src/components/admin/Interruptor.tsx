'use client'

import { cn } from '@/lib/utils'

type Tamanho = 'md' | 'lg'

type Props = {
  ativado: boolean
  aoAlternar: (novoValor: boolean) => void
  desabilitado?: boolean
  tamanho?: Tamanho
  'aria-label': string
}

const estilosPorTamanho: Record<Tamanho, { trilho: string; bola: string; bolaAtivada: string }> = {
  md: {
    trilho: 'w-12 h-7',
    bola: 'w-5 h-5 translate-x-1',
    bolaAtivada: 'translate-x-6',
  },
  lg: {
    trilho: 'w-14 h-8',
    bola: 'w-6 h-6 translate-x-1',
    bolaAtivada: 'translate-x-7',
  },
}

export default function Interruptor({
  ativado,
  aoAlternar,
  desabilitado = false,
  tamanho = 'lg',
  'aria-label': ariaLabel,
}: Props) {
  const estilos = estilosPorTamanho[tamanho]

  return (
    <button
      type="button"
      role="switch"
      aria-checked={ativado}
      aria-label={ariaLabel}
      disabled={desabilitado}
      onClick={() => aoAlternar(!ativado)}
      className={cn(
        'relative inline-flex flex-shrink-0 items-center rounded-full transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-laranja-500 focus-visible:ring-offset-2',
        'ring-offset-white dark:ring-offset-zinc-900',
        estilos.trilho,
        ativado ? 'bg-green-500' : 'bg-zinc-300 dark:bg-zinc-600',
        desabilitado && 'opacity-50 cursor-not-allowed'
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none inline-block rounded-full bg-white shadow-sm transition-transform',
          estilos.bola,
          ativado && estilos.bolaAtivada
        )}
      />
    </button>
  )
}
