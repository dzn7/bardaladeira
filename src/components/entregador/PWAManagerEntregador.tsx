'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { RefreshCw, WifiOff } from 'lucide-react'

let isReloading = false
const PREFIXO_CACHE_ENTREGADOR = 'bar-da-ladeira-entregador-'
const EVENTO_RECONEXAO_ENTREGADOR = 'pwa-entregador-reconectar'
const TEMPO_MAX_BACKGROUND = 30000

type SwVersionInfo = {
  cacheVersion?: string
  improvements?: string[]
}

export default function PWAManagerEntregador() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null)
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isClearingCache, setIsClearingCache] = useState(false)
  const [estaOffline, setEstaOffline] = useState(false)
  const [reconectando, setReconectando] = useState(false)
  const [currentVersion, setCurrentVersion] = useState<string | null>(null)
  const [nextVersion, setNextVersion] = useState<string | null>(null)
  const [updateImprovements, setUpdateImprovements] = useState<string[]>([])
  const controllerChangeHandledRef = useRef(false)
  const updateCheckIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const timestampBackground = useRef<number | null>(null)

  const obterVersaoDoCache = async () => {
    try {
      const cacheNames = await caches.keys()
      const cache = cacheNames.find((c) => c.startsWith(PREFIXO_CACHE_ENTREGADOR))
      if (!cache) return null
      return cache.replace(PREFIXO_CACHE_ENTREGADOR, '')
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
    const versaoAtiva = activeInfo?.cacheVersion || (await obterVersaoDoCache())
    const versaoNova = waitingInfo?.cacheVersion || null
    const melhorias = Array.isArray(waitingInfo?.improvements)
      ? waitingInfo.improvements.filter((i): i is string => typeof i === 'string' && i.trim().length > 0)
      : []
    setCurrentVersion(versaoAtiva || null)
    setNextVersion(versaoNova)
    setUpdateImprovements(melhorias)
  }

  const limparCacheExpirado = useCallback(() => {
    if (registration?.active) {
      registration.active.postMessage({ type: 'CLEAR_EXPIRED_CACHE' })
    }
  }, [registration])

  const forcarBuscaRede = useCallback(() => {
    if (registration?.active) {
      registration.active.postMessage({ type: 'FORCE_NETWORK' })
    }
  }, [registration])

  const dispararEventoReconexao = useCallback(() => {
    window.dispatchEvent(new CustomEvent(EVENTO_RECONEXAO_ENTREGADOR))
  }, [])

  const handleVisibilityChange = useCallback(async () => {
    if (document.hidden) {
      timestampBackground.current = Date.now()
    } else {
      const tempoEmBackground = timestampBackground.current ? Date.now() - timestampBackground.current : 0
      if (tempoEmBackground > TEMPO_MAX_BACKGROUND) {
        setReconectando(true)
        limparCacheExpirado()
        forcarBuscaRede()
        dispararEventoReconexao()
        setTimeout(() => setReconectando(false), 2000)
      }
      timestampBackground.current = null
    }
  }, [limparCacheExpirado, forcarBuscaRede, dispararEventoReconexao])

  const handleOnline = useCallback(() => {
    setEstaOffline(false)
    limparCacheExpirado()
    forcarBuscaRede()
    dispararEventoReconexao()
  }, [limparCacheExpirado, forcarBuscaRede, dispararEventoReconexao])

  const handleOffline = useCallback(() => {
    setEstaOffline(true)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
    const reloadFlag = sessionStorage.getItem('pwa_entregador_reloading')
    if (reloadFlag === 'true') {
      sessionStorage.removeItem('pwa_entregador_reloading')
      return
    }
    setEstaOffline(!navigator.onLine)
    registerServiceWorker()
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      if (updateCheckIntervalRef.current) clearInterval(updateCheckIntervalRef.current)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [handleVisibilityChange, handleOnline, handleOffline])

  const registerServiceWorker = async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw-entregador.js', {
        scope: '/entregador/',
        updateViaCache: 'none',
      })
      setRegistration(reg)
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
      const handleControllerChange = () => {
        if (controllerChangeHandledRef.current || isReloading) return
        controllerChangeHandledRef.current = true
        isReloading = true
        sessionStorage.setItem('pwa_entregador_reloading', 'true')
        setTimeout(() => window.location.reload(), 100)
      }
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange)
      navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange)
      updateCheckIntervalRef.current = setInterval(() => {
        reg.update().catch(() => {})
      }, 60000)
    } catch (error) {
      console.error('[PWA Entregador] Erro ao registrar Service Worker:', error)
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
      console.error('[PWA Entregador] Erro ao atualizar:', error)
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
        cacheNames.filter((n) => n.includes('entregador')).map((n) => caches.delete(n))
      )
      if (registration?.active) {
        registration.active.postMessage({ type: 'CLEAR_CACHE' })
      }
      sessionStorage.setItem('pwa_entregador_reloading', 'true')
      setTimeout(() => window.location.reload(), 300)
    } catch (error) {
      console.error('[PWA Entregador] Erro ao limpar cache:', error)
      setIsClearingCache(false)
      isReloading = false
    }
  }

  if (estaOffline) {
    return (
      <div className="fixed inset-x-0 top-0 z-[10002] flex items-center justify-center gap-2 bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground shadow-md safe-area-top">
        <WifiOff className="h-4 w-4" strokeWidth={1.6} />
        <span>Sem conexão</span>
        <button
          onClick={() => window.location.reload()}
          className="ml-2 rounded-md bg-white/20 px-3 py-1 text-xs font-medium transition-colors hover:bg-white/30"
        >
          Tentar
        </button>
      </div>
    )
  }

  if (reconectando) {
    return (
      <div className="fixed inset-x-0 top-0 z-[10002] flex items-center justify-center gap-2 bg-muted px-4 py-2 text-sm font-medium text-muted-foreground shadow-md safe-area-top">
        <RefreshCw className="h-4 w-4 animate-spin" strokeWidth={1.6} />
        <span>Atualizando...</span>
      </div>
    )
  }

  if (!updateAvailable) return null

  const ocupado = isUpdating || isClearingCache

  return (
    <div
      className="fixed bottom-20 left-4 right-4 z-[10001] sm:bottom-4 sm:left-auto sm:right-4 sm:w-full sm:max-w-sm animate-slide-up"
      role="status"
      aria-live="polite"
    >
      <div className="rounded-xl border border-border/70 bg-card p-4 shadow-2xl">
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
              {isUpdating ? 'Atualizando...' : isClearingCache ? 'Limpando cache...' : 'Nova versão disponível'}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {isUpdating
                ? 'Aguarde, aplicando a nova versão.'
                : isClearingCache
                  ? 'Removendo arquivos antigos.'
                  : 'Atualize para receber as últimas melhorias.'}
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
        {updateImprovements.length > 0 && (
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
        )}

        {/* Botões */}
        <div className="mt-3 grid grid-cols-2 gap-2">
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
              'Atualizar'
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
          O app recarrega automaticamente após concluir.
        </p>
      </div>
    </div>
  )
}

export { EVENTO_RECONEXAO_ENTREGADOR }
