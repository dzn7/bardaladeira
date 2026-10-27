'use client'

import * as React from 'react'
import { Drawer } from 'vaul'
import { X } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useAjusteTecladoVirtual } from '@/hooks/useAjusteTecladoVirtual'

let travasAtivas = 0

/**
 * Trava a rolagem do documento enquanto um drawer está aberto. O lock do Radix
 * age no <body>, mas aqui quem rola é o <html> (overflow-x em html e body), então
 * a página continuava rolando por baixo. Contador para drawers aninhados.
 */
export function useTravarRolagemPagina(ativo: boolean) {
  React.useEffect(() => {
    if (!ativo) return
    const raiz = document.documentElement
    if (travasAtivas++ === 0) {
      raiz.style.overflow = 'hidden'
      raiz.style.overscrollBehavior = 'none'
    }
    return () => {
      if (--travasAtivas === 0) {
        raiz.style.overflow = ''
        raiz.style.overscrollBehavior = ''
      }
    }
  }, [ativo])
}

type GavetaProps = {
  aberto: boolean
  aoFechar: () => void
  titulo: React.ReactNode
  descricao?: React.ReactNode
  /** Ações fixas no rodapé (nunca rolam junto com o conteúdo). */
  rodape?: React.ReactNode
  /** Faixa fixa abaixo do título (progresso, busca, filtros): não rola com o corpo. */
  cabecalho?: React.ReactNode
  /** Largura do painel lateral no desktop. */
  largura?: 'md' | 'lg' | 'xl'
  /** Impede fechar arrastando/tocando fora (ex.: durante um salvamento). */
  bloqueada?: boolean
  className?: string
  children: React.ReactNode
}

const larguras = {
  md: 'md:w-[min(480px,calc(100vw-1rem))]',
  lg: 'md:w-[min(600px,calc(100vw-1rem))]',
  xl: 'md:w-[min(820px,calc(100vw-1rem))]',
}

/**
 * Formulário em drawer: de baixo para cima no mobile, painel à direita no desktop.
 * Corpo rola por dentro; rodapé fica fixo respeitando safe area e teclado do iOS.
 */
export function Gaveta({
  aberto,
  aoFechar,
  titulo,
  descricao,
  rodape,
  cabecalho,
  largura = 'md',
  bloqueada = false,
  className,
  children,
}: GavetaProps) {
  const ehMobile = useIsMobile()
  const ajuste = useAjusteTecladoVirtual(ehMobile && aberto)
  useTravarRolagemPagina(aberto)
  const estiloTeclado = ajuste
    ? { height: ajuste.altura, maxHeight: ajuste.altura, bottom: ajuste.base }
    : undefined

  return (
    <Drawer.Root
      open={aberto}
      onOpenChange={(abrir) => !abrir && aoFechar()}
      direction={ehMobile ? 'bottom' : 'right'}
      dismissible={!bloqueada}
      repositionInputs={false}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-[1000] bg-black/60" />
        <Drawer.Content
          style={estiloTeclado}
          // Foco/scrollIntoView não podem rolar a casca: só o corpo rola.
          onScroll={(evento) => {
            if (evento.target === evento.currentTarget) evento.currentTarget.scrollTop = 0
          }}
          className={cn(
            'fixed z-[1001] flex min-h-0 flex-col overflow-clip border border-border/70 bg-card text-card-foreground outline-none',
            'inset-x-0 bottom-0 max-h-[94dvh] rounded-t-2xl',
            'md:inset-x-auto md:bottom-2 md:right-2 md:top-2 md:max-h-none md:rounded-xl md:shadow-[0_8px_32px_-12px_rgba(15,23,42,0.25)] md:after:!hidden',
            larguras[largura],
            className
          )}
        >
          <div className="mx-auto mt-2.5 h-1.5 w-12 shrink-0 rounded-full bg-muted md:hidden" aria-hidden />
          <div className="flex shrink-0 items-start gap-3 border-b border-border/70 px-4 pb-3 pt-2 md:px-6 md:pt-4">
            <div className="min-w-0 flex-1 pt-1.5">
              <Drawer.Title className="text-lg font-semibold leading-tight tracking-tight text-foreground">
                {titulo}
              </Drawer.Title>
              {descricao ? (
                <Drawer.Description className="mt-1 text-sm text-muted-foreground">{descricao}</Drawer.Description>
              ) : (
                <Drawer.Description className="sr-only">Formulário</Drawer.Description>
              )}
            </div>
            <Drawer.Close
              aria-label="Fechar"
              disabled={bloqueada}
              data-vaul-no-drag=""
              className="-mr-2 flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
            >
              <X className="size-5" />
            </Drawer.Close>
          </div>

          {cabecalho && (
            <div data-vaul-no-drag="" className="shrink-0 border-b border-border/70 bg-card px-4 py-3 md:px-6">
              {cabecalho}
            </div>
          )}

          <div
            data-vaul-no-drag=""
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 md:px-6 md:py-5"
          >
            {children}
          </div>

          {rodape && (
            <div
              data-vaul-no-drag=""
              className="flex shrink-0 gap-2 border-t border-border/70 bg-card px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:px-6 md:pb-4 [&>*]:flex-1 md:[&>*]:flex-none md:justify-end"
            >
              {rodape}
            </div>
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
