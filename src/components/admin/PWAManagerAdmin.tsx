'use client'

import { useEffect, useState, useRef } from 'react'
import { RefreshCw } from 'lucide-react'

let isReloading = false
const PREFIXO_CACHE_ADMIN = 'bar-da-ladeira-admin-'

type SwVersionInfo = {
  cacheVersion?: string
  improvements?: string[]
}

export default function PWAManagerAdmin() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null)
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isClearingCache, setIsClearingCache] = useState(false)
  const [currentVersion, setCurrentVersion] = useState<string | null>(null)
  const [nextVersion, setNextVersion] = useState<string | null>(null)
  const [updateImprovements, setUpdateImprovements] = useState<string[]>([])
  const controllerChangeHandledRef = useRef(false)
  const controllerChangeHandlerRef = useRef<(() => void) | null>(null)
  const updateCheckIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const obterVersaoDoCacheAdmin = async () => {
    try {
      const cacheNames = await caches.keys()
      const cacheAdmin = cacheNames.find((c) => c.startsWith(PREFIXO_CACHE_ADMIN))
      if (!cacheAdmin) return null
      return cacheAdmin.replace(PREFIXO_CACHE_ADMIN, '')
    } catch {
      return null
    }
  }

  const solicitarInfoVersao = async (worker: ServiceWorker | null | undefined): Promise<SwVersionInfo | null> => {
    if (!worker) return null
    return new Promise((resolve) => {
      const canal = new MessageChannel()
      const timeoutId = window.setTimeout(() => resolve(null), 1500)
      canal.port1.onmessage = (event) => {
        window.clearTimeout(timeoutId)
        const data = event.data as SwVersionInfo | undefined
        resolve(data && typeof data === 'object' ? data : null)
      }
      try {
        worker.postMessage({ type: 'GET_VERSION_INFO' }, [canal.port2])
      } catch {
        window.clearTimeout(timeoutId)
        resolve(null)
      }
    })
  }

  const carregarInfoVersao = async (reg: ServiceWorkerRegistration) => {
    const [activeInfo, waitingInfo] = await Promise.all([
      solicitarInfoVersao(reg.active || navigator.serviceWorker.controller),
      solicitarInfoVersao(reg.waiting),
    ])
    const versaoAtiva = activeInfo?.cacheVersion || (await obterVersaoDoCacheAdmin())
    const versaoNova = waitingInfo?.cacheVersion || null
    const melhorias = Array.isArray(waitingInfo?.improvements)
      ? waitingInfo.improvements.filter((i): i is string => typeof i === 'string' && i.trim().length > 0)
      : []
    setCurrentVersion(versaoAtiva || null)
    setNextVersion(versaoNova)
    setUpdateImprovements(melhorias)
  }

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return

    if (process.env.NODE_ENV !== 'production') {
      void navigator.serviceWorker.getRegistrations().then((registrations) =>
        Promise.all(
          registrations
            .filter((item) => item.scope.includes('/admin/'))
            .map((item) => item.unregister()),
        ),
      )
      if (typeof caches !== 'undefined') {
        void caches.keys().then((cacheNames) =>
          Promise.all(
            cacheNames
              .filter((cacheName) => cacheName.startsWith(PREFIXO_CACHE_ADMIN))
              .map((cacheName) => caches.delete(cacheName)),
          ),
        )
      }
      return
    }

    const reloadFlag = sessionStorage.getItem('pwa_reloading')
    if (reloadFlag === 'true') {
      sessionStorage.removeItem('pwa_reloading')
      return
    }
    registerServiceWorker()
    return () => {
      if (updateCheckIntervalRef.current) clearInterval(updateCheckIntervalRef.current)
      if (controllerChangeHandlerRef.current) {
        navigator.serviceWorker.removeEventListener(
          'controllerchange',
          controllerChangeHandlerRef.current,
        )
        controllerChangeHandlerRef.current = null
      }
    }
  }, [])

  const registerServiceWorker = async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw-admin.js', {
        scope: '/admin/',
        updateViaCache: 'none',
      })
      setRegistration(reg)

      const controllerAnterior = navigator.serviceWorker.controller
      const handleControllerChange = () => {
        if (controllerChangeHandledRef.current || isReloading) return
        if (!controllerAnterior) return
        controllerChangeHandledRef.current = true
        isReloading = true
        sessionStorage.setItem('pwa_reloading', 'true')
        setTimeout(() => window.location.reload(), 100)
      }
      if (controllerChangeHandlerRef.current) {
        navigator.serviceWorker.removeEventListener(
          'controllerchange',
          controllerChangeHandlerRef.current,
        )
      }
      controllerChangeHandlerRef.current = handleControllerChange
      navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange)

      if (reg.waiting && navigator.serviceWorker.controller) {
        setUpdateAvailable(true)
        void carregarInfoVersao(reg)
      } else {
        void carregarInfoVersao(reg)
      }
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              setUpdateAvailable(true)
              void carregarInfoVersao(reg)
            }
          })
        }
      })

      await reg.update().catch(() => {})
      updateCheckIntervalRef.current = setInterval(() => {
        if (!updateAvailable) {
          reg.update().catch(() => {})
          void carregarInfoVersao(reg)
        }
      }, 300000)
    } catch (error) {
      console.error('[PWA Admin] Erro ao registrar Service Worker:', error)
    }
  }

  const handleUpdate = async () => {
    if (!registration?.waiting) {
      setUpdateAvailable(false)
      return
    }
    try {
      setIsUpdating(true)
      registration.waiting.postMessage({ type: 'SKIP_WAITING' })
    } catch (error) {
      console.error('[PWA Admin] Erro ao atualizar:', error)
      setIsUpdating(false)
      setUpdateAvailable(false)
    }
  }

  const clearCache = async () => {
    if (isClearingCache || isReloading) return
    try {
      setIsClearingCache(true)
      isReloading = true
      const cacheNames = await caches.keys()
      await Promise.all(
        cacheNames.filter((n) => n.includes('admin')).map((n) => caches.delete(n))
      )
      if (registration?.active) {
        registration.active.postMessage({ type: 'CLEAR_CACHE' })
      }
      sessionStorage.setItem('pwa_reloading', 'true')
      setTimeout(() => window.location.reload(), 300)
    } catch (error) {
      console.error('[PWA Admin] Erro ao limpar cache:', error)
      setIsClearingCache(false)
      isReloading = false
    }
  }

  if (!updateAvailable) return null

  const ocupado = isUpdating || isClearingCache

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[10001] px-3 pb-3 sm:inset-x-auto sm:bottom-4 sm:right-4 sm:w-full sm:max-w-md sm:px-0 sm:pb-0 animate-slide-up"
      role="status"
      aria-live="polite"
    >
      <div className="max-h-[calc(100vh-1.5rem)] overflow-y-auto rounded-xl border border-border/70 bg-card p-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-muted/40">
            <RefreshCw
              className={`h-3.5 w-3.5 text-muted-foreground ${ocupado ? 'animate-spin' : ''}`}
              strokeWidth={1.6}
            />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold tracking-tight text-foreground">
              {isUpdating
                ? 'Atualizando painel...'
                : isClearingCache
                  ? 'Limpando cache...'
                  : 'Atualização disponível'}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {isUpdating
                ? 'Aguarde, aplicando a nova versão.'
                : isClearingCache
                  ? 'Removendo arquivos antigos para sincronização limpa.'
                  : 'Recomendado atualizar para receber os ajustes mais recentes.'}
            </p>
          </div>
        </div>

        {/* Versões */}
        <div className="mt-3 rounded-lg border border-border/70 bg-muted/30 p-3">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Versões do cache
          </p>
          <div className="mt-1.5 space-y-0.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Atual</span>
              <span className="font-mono font-medium tabular-nums">{currentVersion || '—'}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Nova</span>
              <span className="font-mono font-medium tabular-nums">{nextVersion || '—'}</span>
            </div>
          </div>
        </div>

        {/* Melhorias */}
        {updateImprovements.length > 0 ? (
          <div className="mt-3">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Melhorias desta versão
            </p>
            <ul className="mt-1.5 list-disc space-y-1 pl-4">
              {updateImprovements.map((item) => (
                <li key={item} className="text-xs text-foreground">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">
            Nenhuma melhoria detalhada informada nesta versão.
          </p>
        )}

        {/* Botões */}
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <button
            onClick={handleUpdate}
            disabled={ocupado}
            className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-foreground px-4 text-sm font-medium text-background transition-colors hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isUpdating ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" strokeWidth={1.6} />
                Atualizando
              </>
            ) : (
              'Atualizar agora'
            )}
          </button>
          <button
            onClick={clearCache}
            disabled={ocupado}
            className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-border/70 px-4 text-sm font-medium transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isClearingCache ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" strokeWidth={1.6} />
                Limpando
              </>
            ) : (
              'Limpar cache'
            )}
          </button>
        </div>

        <p className="mt-2 text-center text-xs text-muted-foreground">
          O painel recarrega automaticamente após concluir.
        </p>
      </div>
    </div>
  )
}
