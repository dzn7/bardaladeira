// Service Worker EXCLUSIVO para Cliente (Cardápio)
const CACHE_VERSION = 'client-v2.10.12'
const CACHE_NAME = `bar-da-ladeira-client-${CACHE_VERSION}`

// Cache mínimo - apenas essenciais
const CLIENT_ASSETS = [
  '/offline.html',
]

// Tempo máximo de cache (10 minutos)
const MAX_CACHE_AGE = 10 * 60 * 1000

// Estratégia de cache
const CACHE_STRATEGIES = {
  NETWORK_FIRST: 'network-first',
  CACHE_FIRST: 'cache-first',
  STALE_WHILE_REVALIDATE: 'stale-while-revalidate',
}

// Instalar Service Worker
self.addEventListener('install', (event) => {
  console.log('[SW Cliente] Instalando versão:', CACHE_VERSION)

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW Cliente] Cache criado')
        return cache.addAll(CLIENT_ASSETS)
      })
      .then(() => self.skipWaiting())
  )
})

// Ativar Service Worker e limpar caches antigos
self.addEventListener('activate', (event) => {
  console.log('[SW Cliente] Ativando versão:', CACHE_VERSION)

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // Remove apenas caches antigos do CLIENTE (não toca no admin)
            if (cacheName.includes('client') && cacheName !== CACHE_NAME) {
              console.log('[SW Cliente] Removendo cache antigo:', cacheName)
              return caches.delete(cacheName)
            }
            // Remove caches sem prefixo (versões antigas)
            if (cacheName.startsWith('edienai-lanches-v') || cacheName.startsWith('lima-burger-') || cacheName.startsWith('meu-burguer-')) {
              console.log('[SW Cliente] Removendo cache legado:', cacheName)
              return caches.delete(cacheName)
            }
          })
        )
      })
      .then(() => self.clients.claim())
  )
})

// Interceptar requisições
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Ignora requisições de outras origens
  if (url.origin !== location.origin) {
    return
  }

  // NÃO processa requisições do /admin (deixa para sw-admin.js)
  if (url.pathname.startsWith('/admin')) {
    return
  }

  // Ignora requisições do Supabase e API (sempre rede)
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

  // Estratégias para cliente
  if (url.pathname.startsWith('/_next/static')) {
    event.respondWith(cacheFirst(request))
  } else {
    event.respondWith(networkFirstWithTimeout(request))
  }
})

async function networkNavigation(request) {
  try {
    return await fetch(request)
  } catch {
    return (await caches.match('/offline.html')) || Response.error()
  }
}

// Network First com timeout
async function networkFirstWithTimeout(request) {
  const TIMEOUT = 3000 // 3 segundos

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT)

    const networkResponse = await fetch(request, {
      signal: controller.signal
    })

    clearTimeout(timeoutId)

    const deveSalvarEmCache =
      networkResponse &&
      networkResponse.ok &&
      request.method === 'GET' &&
      request.mode !== 'navigate' &&
      !String(networkResponse.headers.get('content-type') || '').includes('text/x-component') &&
      !String(networkResponse.headers.get('content-type') || '').includes('text/html')

    if (deveSalvarEmCache) {
      const cache = await caches.open(CACHE_NAME)
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
    console.log('[SW Cliente] Rede falhou, tentando cache:', request.url)
    const cachedResponse = await caches.match(request)

    if (cachedResponse) {
      const cacheTime = cachedResponse.headers.get('sw-cache-time')
      if (cacheTime) {
        const age = Date.now() - parseInt(cacheTime)
        if (age > MAX_CACHE_AGE) {
          console.log('[SW Cliente] Cache expirado')
          const cache = await caches.open(CACHE_NAME)
          cache.delete(request)
          throw new Error('Cache expirado')
        }
      }
      return cachedResponse
    }

    if (request.mode === 'navigate') {
      return caches.match('/offline.html')
    }

    throw error
  }
}

// Cache First para assets estáticos
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request)

  if (cachedResponse) {
    return cachedResponse
  }

  try {
    const networkResponse = await fetch(request)

    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME)
      cache.put(request, networkResponse.clone())
    }

    return networkResponse
  } catch (error) {
    console.error('[SW Cliente] Falha ao buscar:', request.url)
    throw error
  }
}

// Listener para mensagens (atualização forçada e limpeza de cache)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW Cliente] Forçando atualização')
    self.skipWaiting()
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    console.log('[SW Cliente] Limpando cache')
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName.includes('client')) {
              return caches.delete(cacheName)
            }
          })
        )
      })
    )
  }
})

// Push Notifications para Admin
self.addEventListener('push', (event) => {
  console.log('[SW] Push recebido:', event)

  const data = event.data ? event.data.json() : {}
  const title = data.title || 'Novo Pedido!'
  const options = {
    body: data.body || 'Você tem um novo pedido',
    icon: '/assets/favicon/android-chrome-192x192.png',
    badge: '/assets/favicon/android-chrome-192x192.png',
    vibrate: [200, 100, 200],
    tag: 'novo-pedido',
    requireInteraction: true,
    data: {
      url: data.url || '/admin/pedidos'
    },
    actions: [
      {
        action: 'view',
        title: 'Ver Pedido'
      },
      {
        action: 'close',
        title: 'Fechar'
      }
    ]
  }

  event.waitUntil(
    self.registration.showNotification(title, options)
  )
})

// Clique na notificação
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notificação clicada:', event)

  event.notification.close()

  if (event.action === 'view' || !event.action) {
    const url = event.notification.data.url

    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        // Verifica se já existe uma janela aberta
        for (const client of clientList) {
          if (client.url === url && 'focus' in client) {
            return client.focus()
          }
        }

        // Abre nova janela
        if (clients.openWindow) {
          return clients.openWindow(url)
        }
      })
    )
  }
})
