// Service Worker EXCLUSIVO para Admin Dashboard
const CACHE_VERSION = 'admin-v4.3.5'
const CACHE_NAME = `bar-da-ladeira-admin-${CACHE_VERSION}`

// Opcional: descreva aqui as melhorias desta versao para exibir no card de atualizacao
const CACHE_IMPROVEMENTS = [
  'cache do painel corrigido para não misturar versões do Next.js',
  'lista de pedidos com rolagem e atualização mais estáveis',
]

// Cache mínimo - apenas essenciais
const ESSENTIAL_ASSETS = [
  '/offline.html',
]

// Tempo máximo de cache (5 minutos)
const MAX_CACHE_AGE = 5 * 60 * 1000

// Instalar Service Worker
self.addEventListener('install', (event) => {
  console.log('[SW Admin] Instalando versão:', CACHE_VERSION)

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW Admin] Cache criado')
        return cache.addAll(ESSENTIAL_ASSETS)
      })
      .then(() => self.skipWaiting())
  )
})

// Ativar e limpar caches antigos
self.addEventListener('activate', (event) => {
  console.log('[SW Admin] Ativando versão:', CACHE_VERSION)

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // Remove TODOS os caches antigos do admin
            if (cacheName.includes('admin') && cacheName !== CACHE_NAME) {
              console.log('[SW Admin] Removendo cache antigo:', cacheName)
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

  // Apenas processa requisições do /admin
  if (!url.pathname.startsWith('/admin')) {
    return
  }

  // Ignora APIs (sempre rede)
  if (url.hostname.includes('supabase') || url.pathname.startsWith('/api')) {
    return event.respondWith(fetch(request))
  }

  const requisicaoRsc =
    request.headers.get('RSC') === '1' ||
    url.searchParams.has('_rsc') ||
    url.pathname.startsWith('/_next/data')

  // HTML e payloads RSC precisam pertencer à mesma versão dos chunks do Next.
  if (request.mode === 'navigate') {
    return event.respondWith(networkNavigation(request))
  }

  if (requisicaoRsc) {
    return event.respondWith(fetch(request))
  }

  event.respondWith(networkFirstWithTimeout(request))
})

async function networkNavigation(request) {
  try {
    return await fetch(request)
  } catch {
    return (await caches.match('/offline.html')) || Response.error()
  }
}

// Network First apenas para recursos seguros de cache
async function networkFirstWithTimeout(request) {
  const TIMEOUT = 4000

  try {
    // Tenta buscar da rede com timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT)

    const networkResponse = await fetch(request, {
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    const contentType = String(networkResponse.headers.get('content-type') || '')
    const deveSalvarEmCache =
      networkResponse.ok &&
      request.method === 'GET' &&
      request.mode !== 'navigate' &&
      !contentType.includes('text/x-component') &&
      !contentType.includes('text/html')

    if (deveSalvarEmCache) {
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
    }

    return networkResponse
  } catch (error) {
    console.log('[SW Admin] Rede falhou, tentando cache:', request.url)

    // Busca do cache
    const cachedResponse = await caches.match(request)

    if (cachedResponse) {
      // Verifica idade do cache
      const cacheTime = cachedResponse.headers.get('sw-cache-time')
      if (cacheTime) {
        const age = Date.now() - parseInt(cacheTime)
        if (age > MAX_CACHE_AGE) {
          console.log('[SW Admin] Cache expirado, removendo')
          const cache = await caches.open(CACHE_NAME)
          cache.delete(request)
          throw new Error('Cache expirado')
        }
      }

      return cachedResponse
    }

    return new Response('', { status: 503, statusText: 'Service unavailable' })
  }
}

// Listener para mensagens (forçar atualização)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'GET_VERSION_INFO') {
    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage({
        cacheVersion: CACHE_VERSION,
        improvements: CACHE_IMPROVEMENTS,
      })
    }
    return
  }

  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW Admin] Forçando atualização')
    self.skipWaiting()
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    console.log('[SW Admin] Limpando cache')
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName.includes('admin')) {
              return caches.delete(cacheName)
            }
          })
        )
      })
    )
  }
})

// Listener para notificações
self.addEventListener('notificationclick', (event) => {
  console.log('[SW Admin] Notificação clicada:', event.notification.tag)
  event.notification.close()

  const urlToOpen = event.notification.data?.url || '/admin/dashboard'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Tenta focar em janela existente
        for (const client of clientList) {
          if (client.url.includes('/admin') && 'focus' in client) {
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
