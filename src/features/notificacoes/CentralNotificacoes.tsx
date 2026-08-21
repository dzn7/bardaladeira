'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Banknote, Bell, BellRing, CheckCheck, ChevronDown, ChevronRight, Loader2, PackageX, RefreshCw, Settings2, ShoppingBag, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import Interruptor from '@/components/admin/Interruptor'
import { useIsMobile } from '@/hooks/useIsMobile'
import { cn } from '@/lib/utils'
import { rotaDaNotificacao, type NotificacaoAdmin } from '@/lib/notificacoes-admin.mjs'
import { useNotificacoesAdmin } from './NotificacoesAdminContext'

function ItemNotificacao({ item, aoNavegar }: { item: NotificacaoAdmin; aoNavegar: () => void }) {
  const router = useRouter()
  const { marcarLida, dispensar } = useNotificacoesAdmin()
  const urgente = item.prioridade === 'urgente'
  const rota = rotaDaNotificacao(item)

  const abrir = async () => {
    if (!item.lida_em) await marcarLida(item.id).catch(() => undefined)
    if (rota) {
      aoNavegar()
      router.push(rota)
    }
  }

  return (
    <article className={cn(
      'group relative rounded-xl border p-3 transition-colors',
      urgente
        ? 'border-red-200 bg-red-50 dark:border-red-900/70 dark:bg-red-950/25'
        : 'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900',
      !item.lida_em && 'shadow-sm',
    )}>
      <button type="button" onClick={() => void abrir()} className="flex w-full gap-3 pr-7 text-left">
        <span className={cn(
          'mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg',
          urgente
            ? 'bg-red-100 text-red-600 dark:bg-red-950/70 dark:text-red-400'
            : 'bg-sky-100 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400',
        )}>
          {item.entidade_tipo === 'produto' ? <PackageX className="size-[18px]" />
            : item.entidade_tipo === 'funcionario' ? <Banknote className="size-[18px]" />
              : <ShoppingBag className="size-[18px]" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn(
            'block text-sm font-semibold',
            urgente ? 'text-red-700 dark:text-red-300' : 'text-zinc-900 dark:text-white',
          )}>{item.titulo}</span>
          <span className="mt-0.5 block break-words text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">{item.mensagem}</span>
        </span>
        {rota ? <ChevronRight className="mt-2 size-4 shrink-0 text-zinc-400" /> : null}
      </button>
      <button
        type="button"
        onClick={() => void dispensar(item.id).catch(() => undefined)}
        aria-label={`Dispensar ${item.titulo}`}
        className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
      >
        <X className="size-3.5" />
      </button>
    </article>
  )
}

function ConteudoCentral({ fechar }: { fechar: () => void }) {
  const [configurando, setConfigurando] = useState(false)
  const {
    notificacoes, resumo, carregando, erro, modalAtivo, preferencias,
    carregarCentral, marcarTodasLidas, definirModalAtivo, definirPreferencias,
  } = useNotificacoesAdmin()

  const alternarPreferencia = (chave: keyof typeof preferencias, ativo: boolean) => {
    void definirPreferencias({ ...preferencias, [chave]: ativo }).catch(() => undefined)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3.5 dark:border-zinc-800">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-zinc-900 dark:text-white">Notificações</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{resumo.naoLidas} não lida{resumo.naoLidas === 1 ? '' : 's'}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {resumo.naoLidas > 0 ? (
            <button
              type="button"
              className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white"
              onClick={() => void marcarTodasLidas().catch(() => undefined)}
            >
              <CheckCheck className="size-4" /> Todas lidas
            </button>
          ) : null}
          <button
            type="button"
            onClick={fechar}
            aria-label="Fechar notificações"
            className="flex size-9 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-white"
          >
            <X className="size-[18px]" />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain p-3">
        {carregando ? (
          <div className="flex min-h-40 items-center justify-center text-zinc-400"><Loader2 className="size-5 animate-spin" /></div>
        ) : erro ? (
          <div className="flex min-h-40 flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50 p-5 text-center dark:border-red-900/70 dark:bg-red-950/25">
            <p className="text-sm font-medium text-red-700 dark:text-red-300">Não foi possível carregar</p>
            <p className="mt-1 max-w-xs text-xs leading-relaxed text-red-600/80 dark:text-red-300/70">{erro}</p>
            <button
              type="button"
              onClick={() => void carregarCentral(false)}
              className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-lg bg-red-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-red-700"
            >
              <RefreshCw className="size-3.5" /> Tentar novamente
            </button>
          </div>
        ) : notificacoes.length === 0 ? (
          <div className="flex min-h-40 flex-col items-center justify-center text-center text-zinc-500 dark:text-zinc-400">
            <span className="mb-3 flex size-11 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800">
              <Bell className="size-5" />
            </span>
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Tudo em dia</p>
            <p className="mt-1 text-xs">Nenhuma ocorrência ativa.</p>
          </div>
        ) : notificacoes.map((item) => <ItemNotificacao key={item.id} item={item} aoNavegar={fechar} />)}
      </div>

      <div className="shrink-0 border-t border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/70">
        <button type="button" onClick={() => setConfigurando((atual) => !atual)} className="flex w-full items-center justify-between px-4 py-3 text-left">
          <span className="flex items-center gap-2 text-sm font-medium text-zinc-800 dark:text-zinc-100"><Settings2 className="size-4" /> Configurar notificações</span>
          <ChevronDown className={cn('size-4 text-zinc-400 transition-transform', configurando && 'rotate-180')} />
        </button>
        {configurando ? (
          <div className="space-y-3 border-t border-zinc-200 px-4 py-3 dark:border-zinc-800">
            {[
              { chave: 'estoque' as const, titulo: 'Estoque', descricao: 'Estoque baixo e produtos esgotados' },
              { chave: 'pedidos' as const, titulo: 'Pedidos', descricao: 'Novos pedidos aguardando ação' },
              { chave: 'pagamentosFuncionarios' as const, titulo: 'Pagamentos da equipe', descricao: 'Vencimentos próximos ou atrasados' },
            ].map((item) => (
              <div key={item.chave} className="flex items-center justify-between gap-4">
                <div><p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">{item.titulo}</p><p className="text-xs text-zinc-500 dark:text-zinc-400">{item.descricao}</p></div>
                <Interruptor ativado={preferencias[item.chave]} aoAlternar={(ativo) => alternarPreferencia(item.chave, ativo)} tamanho="md" aria-label={`Notificar ${item.titulo.toLowerCase()}`} />
              </div>
            ))}
            <div className="flex items-center justify-between gap-4 border-t border-zinc-200 pt-3 dark:border-zinc-800">
              <div><p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">Avisar ao entrar</p><p className="text-xs text-zinc-500 dark:text-zinc-400">Mostrar novas ocorrências no acesso</p></div>
              <Interruptor ativado={modalAtivo} aoAlternar={(ativo) => void definirModalAtivo(ativo).catch(() => undefined)} tamanho="md" aria-label="Mostrar avisos ao entrar" />
            </div>
          </div>
        ) : null}
        <div className="pb-[env(safe-area-inset-bottom)]" />
      </div>
    </div>
  )
}

export function CentralNotificacoes() {
  const { resumo, carregarCentral } = useNotificacoesAdmin()
  const isMobile = useIsMobile()
  const [aberto, setAberto] = useState(false)
  const urgente = resumo.urgentesNaoLidas > 0

  const alterar = (valor: boolean) => {
    setAberto(valor)
    if (valor) void carregarCentral(false)
  }

  useEffect(() => {
    if (!aberto) return
    const aoTeclado = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') alterar(false)
    }
    window.addEventListener('keydown', aoTeclado)
    if (isMobile) document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', aoTeclado)
      if (isMobile) document.body.style.overflow = ''
    }
  }, [aberto, isMobile])

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => alterar(!aberto)}
        aria-label={`Notificações: ${resumo.naoLidas} não lidas`}
        aria-expanded={aberto}
        className="relative flex size-9 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white"
      >
        {urgente ? <BellRing className="size-[18px] text-red-500" /> : <Bell className="size-[18px]" />}
        {resumo.naoLidas > 0 ? (
          <span className={cn(
            'absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold leading-4 text-white ring-2 ring-white dark:ring-zinc-950',
            urgente ? 'bg-red-600' : 'bg-sky-500',
          )}>{Math.min(resumo.naoLidas, 99)}</span>
        ) : null}
      </button>

      {typeof document !== 'undefined' ? createPortal(
        <AnimatePresence>
          {aberto ? (
          isMobile ? (
            <div className="fixed inset-0 z-[1000]">
              <motion.button
                type="button"
                aria-label="Fechar notificações"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => alterar(false)}
                className="absolute inset-0 bg-black/60"
              />
              <motion.section
                role="dialog"
                aria-modal="true"
                aria-label="Central de notificações"
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 340 }}
                className="absolute inset-x-0 bottom-0 flex max-h-[88dvh] min-h-[52dvh] flex-col overflow-hidden rounded-t-2xl border-t border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-zinc-300 dark:bg-zinc-700" />
                <ConteudoCentral fechar={() => alterar(false)} />
              </motion.section>
            </div>
          ) : (
            <>
              <button
                type="button"
                aria-label="Fechar notificações"
                onClick={() => alterar(false)}
                className="fixed inset-0 z-40 cursor-default"
              />
              <motion.section
                role="dialog"
                aria-label="Central de notificações"
                initial={{ opacity: 0, y: -8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                transition={{ duration: 0.16 }}
                className="fixed right-6 top-16 z-50 flex h-[min(620px,calc(100dvh-4.5rem))] w-[390px] max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
              >
                <ConteudoCentral fechar={() => alterar(false)} />
              </motion.section>
            </>
          )
          ) : null}
        </AnimatePresence>,
        document.body,
      ) : null}
    </div>
  )
}
