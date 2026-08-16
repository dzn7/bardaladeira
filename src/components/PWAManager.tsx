'use client'

import { useEffect, useState, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { RefreshCw } from 'lucide-react'

// Flag global para prevenir múltiplos reloads
let isReloading = false

export default function PWAManager() {
  const pathname = usePathname()
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null)
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const controllerChangeHandledRef = useRef(false)
  const controllerChangeHandlerRef = useRef<(() => void) | null>(null)
  const updateCheckIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const deveGerenciarPwaCliente =
    !(pathname?.startsWith('/admin') || pathname?.startsWith('/garcom') || pathname?.startsWith('/entregador'))

  useEffect(() => {
    if (!deveGerenciarPwaCliente) {
      if (updateCheckIntervalRef.current) {
        clearInterval(updateCheckIntervalRef.current)
        updateCheckIntervalRef.current = null
      }
      setUpdateAvailable(false)
      setIsUpdating(false)
      if (controllerChangeHandlerRef.current) {
        navigator.serviceWorker?.removeEventListener('controllerchange', controllerChangeHandlerRef.current)
        controllerChangeHandlerRef.current = null
      }
      return
    }

    // Previne execução no servidor
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return
    }

    if (process.env.NODE_ENV !== 'production') {
      void navigator.serviceWorker.getRegistrations().then((registrations) =>
        Promise.all(registrations.map((registration) => registration.unregister()))
      )

      if (typeof caches !== 'undefined') {
        void caches.keys().then((cacheNames) =>
          Promise.all(
            cacheNames
              .filter((cacheName) =>
                cacheName.includes('bar-da-ladeira-client') || cacheName.includes('edienai-lanches-client')
              )
              .map((cacheName) => caches.delete(cacheName))
          )
        )
      }
      return
    }

    // Verifica se já está recarregando
    const reloadFlag = sessionStorage.getItem('pwa_client_reloading')
    if (reloadFlag === 'true') {
      console.log('[PWA] Reload em progresso, aguardando...')
      sessionStorage.removeItem('pwa_client_reloading')
      return
    }

    registerServiceWorker()

    // Cleanup ao desmontar
    return () => {
      if (updateCheckIntervalRef.current) {
        clearInterval(updateCheckIntervalRef.current)
        updateCheckIntervalRef.current = null
      }
      if (controllerChangeHandlerRef.current) {
        navigator.serviceWorker.removeEventListener('controllerchange', controllerChangeHandlerRef.current)
        controllerChangeHandlerRef.current = null
      }
    }
  }, [deveGerenciarPwaCliente])

  const registerServiceWorker = async () => {
    try {
      console.log('[PWA] Iniciando registro do Service Worker')

      // Registra o service worker
      const reg = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none'
      })

      console.log('[PWA] Service Worker registrado com sucesso')
      setRegistration(reg)

      const ativarAtualizacaoImediata = () => {
        if (!reg.waiting) return false
        console.log('[PWA] Atualização pendente detectada, forçando ativação')
        setIsUpdating(true)
        reg.waiting.postMessage({ type: 'SKIP_WAITING' })
        return true
      }

      // Busca atualização logo após registrar (sem esperar intervalo)
      try {
        await reg.update()
      } catch (erroUpdate) {
        console.warn('[PWA] Falha ao atualizar imediatamente:', erroUpdate)
      }

      // Verifica se já existe uma atualização esperando
      if (reg.waiting && navigator.serviceWorker.controller) {
        const atualizou = ativarAtualizacaoImediata()
        if (!atualizou) {
          setUpdateAvailable(true)
        }
      } else if (reg.waiting) {
        console.log('[PWA] Atualização já disponível')
        setUpdateAvailable(true)
      }

      // Listener para novas atualizações encontradas
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing
        console.log('[PWA] Nova atualização encontrada')
        
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            console.log('[PWA] Estado do novo SW:', newWorker.state)
            
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              console.log('[PWA] Nova versão instalada e pronta')
              const atualizou = ativarAtualizacaoImediata()
              if (!atualizou) {
                setUpdateAvailable(true)
              }
            }
          })
        }
      })

      // Listener único para mudança de controller
      const handleControllerChange = () => {
        console.log('[PWA] Controller mudou')
        
        // Previne múltiplas execuções
        if (controllerChangeHandledRef.current || isReloading) {
          console.log('[PWA] Controller change já tratado, ignorando')
          return
        }

        controllerChangeHandledRef.current = true
        isReloading = true
        setUpdateAvailable(false)
        setIsUpdating(true)
        
        // Marca no sessionStorage para prevenir loops
        sessionStorage.setItem('pwa_client_reloading', 'true')
        
        console.log('[PWA] Recarregando página após atualização...')
        
        // Pequeno delay para garantir que o novo SW assumiu controle
        setTimeout(() => {
          window.location.reload()
        }, 100)
      }

      if (controllerChangeHandlerRef.current) {
        navigator.serviceWorker.removeEventListener('controllerchange', controllerChangeHandlerRef.current)
      }
      controllerChangeHandlerRef.current = handleControllerChange
      navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange)

      // Verifica atualizações periodicamente (60 segundos)
      updateCheckIntervalRef.current = setInterval(() => {
        console.log('[PWA] Verificando atualizações...')
        reg.update().then(() => {
          if (reg.waiting && navigator.serviceWorker.controller) {
            ativarAtualizacaoImediata()
          }
        }).catch(err => {
          console.warn('[PWA] Erro ao verificar atualização:', err)
        })
      }, 60000)

    } catch (error) {
      console.error('[PWA] Erro ao registrar Service Worker:', error)
    }
  }

  const handleUpdate = async () => {
    if (!registration?.waiting) {
      console.warn('[PWA] Nenhum SW esperando')
      setUpdateAvailable(false)
      return
    }

    try {
      setIsUpdating(true)
      console.log('[PWA] Enviando SKIP_WAITING para o SW')
      
      // Envia mensagem para o SW waiting pular a espera
      registration.waiting.postMessage({ type: 'SKIP_WAITING' })
      
      // O reload será automático via controllerchange
    } catch (error) {
      console.error('[PWA] Erro ao atualizar:', error)
      setIsUpdating(false)
      setUpdateAvailable(false)
    }
  }

  // Banner de atualização
  if (updateAvailable) {
    return (
      <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-[10001] 
                    bg-gradient-to-r from-amber-600 to-amber-500 text-white rounded-xl shadow-2xl p-4 
                    border border-amber-400 animate-slide-up">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <h4 className="font-bold mb-1 flex items-center gap-2">
              <RefreshCw className={`w-4 h-4 ${isUpdating ? 'animate-spin' : ''}`} />
              {isUpdating ? 'Atualizando...' : 'Nova versão disponível!'}
            </h4>
            <p className="text-sm text-amber-100">
              {isUpdating 
                ? 'Aguarde, estamos aplicando as melhorias...' 
                : 'Clique em atualizar para ter acesso às últimas melhorias.'}
            </p>
          </div>
          <button
            onClick={handleUpdate}
            disabled={isUpdating}
            className={`px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap
                     ${isUpdating 
                       ? 'bg-amber-300 text-amber-700 cursor-not-allowed opacity-75' 
                       : 'bg-white text-amber-600 hover:bg-amber-50 hover:shadow-lg'}`}
          >
            {isUpdating ? (
              <span className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Atualizando
              </span>
            ) : (
              'Atualizar'
            )}
          </button>
        </div>
      </div>
    )
  }

  return null
}
