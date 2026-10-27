'use client'

import * as React from 'react'
import { Drawer } from 'vaul'
import { Warning } from '@phosphor-icons/react'
import { Botao } from './botao'
import { cn } from '@/lib/utils'
import { useTravarRolagemPagina } from './gaveta'

type OpcoesConfirmacao = {
  titulo: string
  descricao?: React.ReactNode
  confirmar?: string
  cancelar?: string
  /** Ação destrutiva (botão vermelho + ícone de alerta). */
  perigo?: boolean
}

type Pendente = OpcoesConfirmacao & { resolver: (ok: boolean) => void }

const ContextoConfirmacao = React.createContext<((opcoes: OpcoesConfirmacao) => Promise<boolean>) | null>(null)

/** `const confirmar = useConfirmar(); if (await confirmar({...})) { ... }` */
export function useConfirmar() {
  const contexto = React.useContext(ContextoConfirmacao)
  if (!contexto) throw new Error('useConfirmar precisa de <ProvedorConfirmacao>')
  return contexto
}

export function ProvedorConfirmacao({ children }: { children: React.ReactNode }) {
  const [pendente, setPendente] = React.useState<Pendente | null>(null)
  const [aberto, setAberto] = React.useState(false)
  useTravarRolagemPagina(aberto)

  const confirmar = React.useCallback(
    (opcoes: OpcoesConfirmacao) =>
      new Promise<boolean>((resolver) => {
        setPendente({ ...opcoes, resolver })
        setAberto(true)
      }),
    []
  )

  const responder = (ok: boolean) => {
    pendente?.resolver(ok)
    setAberto(false)
  }

  return (
    <ContextoConfirmacao.Provider value={confirmar}>
      {children}
      <Drawer.Root open={aberto} onOpenChange={(abrir) => !abrir && responder(false)} repositionInputs={false}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-[1100] bg-black/60" />
          <Drawer.Content
            role="alertdialog"
            className="fixed inset-x-0 bottom-0 z-[1101] flex flex-col rounded-t-2xl border border-border/70 bg-card px-5 pt-2.5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-card-foreground outline-none md:inset-x-0 md:bottom-[calc(50dvh-120px)] md:mx-auto md:w-[min(440px,calc(100vw-2rem))] md:rounded-xl md:p-6 md:shadow-[0_8px_32px_-12px_rgba(15,23,42,0.25)] md:after:!hidden"
          >
            <div className="mx-auto mb-4 h-1.5 w-12 shrink-0 rounded-full bg-muted md:hidden" aria-hidden />
            {pendente && (
              <>
                <div className="flex gap-3">
                  {pendente.perigo && (
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-red-500/10 text-red-600 dark:text-red-400">
                      <Warning className="size-5" weight="fill" />
                    </span>
                  )}
                  <div className="min-w-0">
                    <Drawer.Title className="text-base font-semibold text-foreground">{pendente.titulo}</Drawer.Title>
                    <Drawer.Description className={cn('mt-1 text-sm text-muted-foreground', !pendente.descricao && 'sr-only')}>
                      {pendente.descricao || pendente.titulo}
                    </Drawer.Description>
                  </div>
                </div>
                <div className="mt-6 flex flex-col-reverse gap-2 md:flex-row md:justify-end" data-vaul-no-drag="">
                  <Botao variante="contorno" tamanho="lg" className="md:h-10 md:text-sm" onClick={() => responder(false)}>
                    {pendente.cancelar || 'Cancelar'}
                  </Botao>
                  <Botao
                    variante={pendente.perigo ? 'perigo' : 'primario'}
                    tamanho="lg"
                    className="md:h-10 md:text-sm"
                    onClick={() => responder(true)}
                    autoFocus
                  >
                    {pendente.confirmar || 'Confirmar'}
                  </Botao>
                </div>
              </>
            )}
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </ContextoConfirmacao.Provider>
  )
}
