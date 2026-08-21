'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, Loader2, PackageX, X } from 'lucide-react'
import Interruptor from '@/components/admin/Interruptor'
import { useNotificacoesAdmin } from './NotificacoesAdminContext'

export function ModalNotificacoesEntrada() {
  const { notificacoesModal, fecharModalEntrada } = useNotificacoesAdmin()
  const [naoMostrar, setNaoMostrar] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const botaoFecharRef = useRef<HTMLButtonElement>(null)
  const aberto = notificacoesModal.length > 0

  const fechar = async () => {
    if (salvando) return
    setSalvando(true)
    try {
      await fecharModalEntrada(naoMostrar)
    } catch {
      /* o estado será reconciliado no próximo carregamento da Central */
    } finally {
      setSalvando(false)
    }
  }

  useEffect(() => {
    if (!aberto) return
    const overflowAnterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    botaoFecharRef.current?.focus()
    const aoTeclado = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') void fechar()
    }
    window.addEventListener('keydown', aoTeclado)
    return () => {
      document.body.style.overflow = overflowAnterior
      window.removeEventListener('keydown', aoTeclado)
    }
  }, [aberto, salvando, naoMostrar])

  return (
    <AnimatePresence>
      {aberto ? (
        <div className="fixed inset-0 z-[1100]">
          <motion.button
            type="button"
            aria-label="Fechar aviso"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => void fechar()}
            className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
          />

          <div className="relative flex min-h-full items-end justify-center p-0 sm:items-center sm:p-4">
            <motion.section
              role="dialog"
              aria-modal="true"
              aria-labelledby="titulo-notificacoes-entrada"
              initial={{ opacity: 0, y: 28, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.98 }}
              transition={{ duration: 0.18 }}
              className="relative z-[1101] flex max-h-[88dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 sm:rounded-2xl"
            >
              <div className="flex shrink-0 items-start justify-between gap-4 border-b border-zinc-200 px-5 py-4 dark:border-zinc-800 sm:px-6 sm:py-5">
                <div className="flex min-w-0 gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600 dark:bg-red-950/70 dark:text-red-400">
                    <AlertTriangle className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <h2 id="titulo-notificacoes-entrada" className="text-lg font-bold text-zinc-900 dark:text-white">Atenção necessária</h2>
                    <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">Novas ocorrências precisam da sua atenção.</p>
                  </div>
                </div>
                <button
                  ref={botaoFecharRef}
                  type="button"
                  onClick={() => void fechar()}
                  disabled={salvando}
                  aria-label="Fechar aviso"
                  className="flex size-11 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-50 dark:hover:bg-zinc-800 dark:hover:text-white"
                >
                  <X className="size-5" />
                </button>
              </div>

              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
                {notificacoesModal.map((item) => (
                  <article key={item.id} className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900/70 dark:bg-red-950/25">
                    <div className="flex gap-3">
                      <PackageX className="mt-0.5 size-5 shrink-0 text-red-600 dark:text-red-400" />
                      <div className="min-w-0">
                        <p className="font-semibold text-red-700 dark:text-red-300">{item.titulo}</p>
                        <p className="mt-1 break-words text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">{item.mensagem}</p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              <div className="shrink-0 border-t border-zinc-200 bg-zinc-50 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 dark:border-zinc-800 dark:bg-zinc-900/70 sm:px-6 sm:pb-5">
                <div className="mb-4 flex min-h-11 items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">Não mostrar novamente</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">Pode ser reativado na Central</p>
                  </div>
                  <Interruptor
                    ativado={naoMostrar}
                    aoAlternar={setNaoMostrar}
                    tamanho="md"
                    aria-label="Não mostrar novamente ao entrar"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void fechar()}
                  disabled={salvando}
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  {salvando ? <Loader2 className="size-4 animate-spin" /> : null}
                  {salvando ? 'Salvando…' : 'Entendi'}
                </button>
              </div>
            </motion.section>
          </div>
        </div>
      ) : null}
    </AnimatePresence>
  )
}
