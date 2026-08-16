// Service Worker EXCLUSIVO para Painel Garçom
const CACHE_VERSION = 'garcom-v1.5.0'
const CACHE_NAME = `bar-da-ladeira-garcom-${CACHE_VERSION}`

// Cache mínimo - apenas essenciais
const ESSENTIAL_ASSETS = [
  '/garcom',
  '/offline.html',
]

// Tempo máximo de cache (2 minutos - reduzido para evitar dados obsoletos)
const MAX_CACHE_AGE = 2 * 60 * 1000

// Flag para controlar se deve forçar rede
let forcarRede = false

// Instalar Service Worker
self.addEventListener('install', (event) => {
  console.log('[SW Garçom] Instalando versão:', CACHE_VERSION)
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW Garçom] Cache criado')
        return cache.addAll(ESSENTIAL_ASSETS)
      })
      .then(() => self.skipWaiting())
  )
})

// Ativar e limpar caches antigos
self.addEventListener('activate', (event) => {
  console.log('[SW Garçom] Ativando versão:', CACHE_VERSION)
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // Remove TODOS os caches antigos do garcom
            if (cacheName.includes('garcom') && cacheName !== CACHE_NAME) {
              console.log('[SW Garçom] Removendo cache antigo:', cacheName)
              return caches.delete(cacheName)
            }
          })
        )
      })
      .then(() => self.clients.claim())
  )
})

// Interceptar requisições - NETWORK FIRST sempre
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Ignora requisições de outras origens
  if (url.origin !== location.origin) {
    return
  }

  // Apenas processa requisições do /garcom
  if (!url.pathname.startsWith('/garcom')) {
    return
  }

  // Ignora requisições do Supabase (sempre rede)
  if (url.hostname.includes('supabase') || url.pathname.startsWith('/api')) {
    return event.respondWith(fetch(request))
  }

  // SEMPRE tenta rede primeiro para garcom
  event.respondWith(networkFirstWithTimeout(request))
})

// Network First com timeout curto e tratamento robusto
async function networkFirstWithTimeout(request) {
  const TIMEOUT = 5000 // 5 segundos (aumentado para conexões lentas)

  try {
    // Tenta buscar da rede com timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT)

    const networkResponse = await fetch(request, {
      signal: controller.signal,
      cache: 'no-store' // Força buscar dados frescos
    })

    clearTimeout(timeoutId)

    // Se sucesso, atualiza cache
    if (networkResponse && networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME)
      
      // Adiciona timestamp ao cache
      const responseToCache = networkResponse.clone()
      const headers = new Headers(responseToCache.headers)
      headers.append('sw-cache-time', Date.now().toString())
      
      const modifiedResponse = new Response(responseToCache.body, {
        status: responseToCache.status,
        statusText: responseToCache.statusText,
        headers: headers
      })
      
      cache.put(request, modifiedResponse)
      
      // Reset flag de forçar rede após sucesso
      forcarRede = false
    }

    return networkResponse
  } catch (error) {
    console.log('[SW Garçom] Rede falhou, tentando cache:', request.url)

    // Se está forçando rede, não usa cache
    if (forcarRede) {
      console.log('[SW Garçom] Forçando rede, ignorando cache')
      if (request.mode === 'navigate') {
        return caches.match('/offline.html')
      }
      throw error
    }

    // Busca do cache
    const cachedResponse = await caches.match(request)

    if (cachedResponse) {
      // Verifica idade do cache
      const cacheTime = cachedResponse.headers.get('sw-cache-time')
      if (cacheTime) {
        const age = Date.now() - parseInt(cacheTime)
        if (age > MAX_CACHE_AGE) {
          console.log('[SW Garçom] Cache expirado, removendo')
          const cache = await caches.open(CACHE_NAME)
          cache.delete(request)
          
          // Para navegação, retorna offline ao invés de erro
          if (request.mode === 'navigate') {
            return caches.match('/offline.html')
          }
          throw new Error('Cache expirado')
        }
      }

      // Adiciona header indicando que é do cache
      const headers = new Headers(cachedResponse.headers)
      headers.set('x-from-cache', 'true')
      
      return new Response(cachedResponse.body, {
        status: cachedResponse.status,
        statusText: cachedResponse.statusText,
        headers: headers
      })
    }

    // Retorna página offline para navegação
    if (request.mode === 'navigate') {
      return caches.match('/offline.html')
    }

    throw error
  }
}

// Listener para mensagens (forçar atualização)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW Garçom] Forçando atualização')
    self.skipWaiting()
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    console.log('[SW Garçom] Limpando cache')
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName.includes('garcom')) {
              return caches.delete(cacheName)
            }
          })
        )
      })
    )
  }

  // Novo: Força buscar da rede na próxima requisição
  if (event.data && event.data.type === 'FORCE_NETWORK') {
    console.log('[SW Garçom] Forçando busca da rede')
    forcarRede = true
  }

  // Novo: Verifica se o SW está ativo e responde
  if (event.data && event.data.type === 'PING') {
    console.log('[SW Garçom] Ping recebido, respondendo...')
    event.ports[0]?.postMessage({ type: 'PONG', timestamp: Date.now() })
  }

  // Novo: Limpa cache expirado
  if (event.data && event.data.type === 'CLEAR_EXPIRED_CACHE') {
    console.log('[SW Garçom] Limpando cache expirado')
    event.waitUntil(
      caches.open(CACHE_NAME).then(async (cache) => {
        const requests = await cache.keys()
        const now = Date.now()
        
        for (const request of requests) {
          const response = await cache.match(request)
          if (response) {
            const cacheTime = response.headers.get('sw-cache-time')
            if (cacheTime && (now - parseInt(cacheTime)) > MAX_CACHE_AGE) {
              console.log('[SW Garçom] Removendo cache expirado:', request.url)
              await cache.delete(request)
            }
          }
        }
      })
    )
  }
})

// Listener para notificações
self.addEventListener('notificationclick', (event) => {
  console.log('[SW Garçom] Notificação clicada:', event.notification.tag)
  event.notification.close()

  const urlToOpen = event.notification.data?.url || '/garcom'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Tenta focar em janela existente
        for (const client of clientList) {
          if (client.url.includes('/garcom') && 'focus' in client) {
            client.navigate(urlToOpen)
            return client.focus()
          }
        }
        // Abre nova janela
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen)
        }
      })
  )
})
