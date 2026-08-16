// Service Worker EXCLUSIVO para Painel do Entregador
const CACHE_VERSION = 'entregador-v2.8.2'
const CACHE_NAME = `bar-da-ladeira-entregador-${CACHE_VERSION}`

// Assets essenciais para funcionamento offline
const ESSENTIAL_ASSETS = [
  '/entregador',
  '/offline-entregador.html',
  '/logo.webp',
  '/notificacao.mp3',
]

// Tempo máximo de cache (2 minutos - reduzido para evitar dados obsoletos)
const MAX_CACHE_AGE = 2 * 60 * 1000

// Flag para controlar se deve forçar rede
let forcarRede = false

// Instalação do Service Worker
self.addEventListener('install', (event) => {
  console.log('[SW Entregador] Instalando versão:', CACHE_VERSION)
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW Entregador] Cache criado')
        return cache.addAll(ESSENTIAL_ASSETS)
      })
      .then(() => self.skipWaiting())
  )
})

// Ativação e limpeza de caches antigos
self.addEventListener('activate', (event) => {
  console.log('[SW Entregador] Ativando versão:', CACHE_VERSION)
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName.includes('entregador') && cacheName !== CACHE_NAME) {
              console.log('[SW Entregador] Removendo cache antigo:', cacheName)
              return caches.delete(cacheName)
            }
          })
        )
      })
      .then(() => self.clients.claim())
  )
})

// Interceptar requisições - Network First para dados em tempo real
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Ignora requisições de outras origens
  if (url.origin !== location.origin) {
    return
  }

  // Apenas processa requisições do /entregador
  if (!url.pathname.startsWith('/entregador')) {
    return
  }

  // Requisições do Supabase sempre vão direto para rede
  if (url.hostname.includes('supabase') || url.pathname.startsWith('/api')) {
    return event.respondWith(fetch(request))
  }

  // Network First com timeout curto
  event.respondWith(networkFirstWithTimeout(request))
})

// Network First com timeout e tratamento robusto
async function networkFirstWithTimeout(request) {
  const TIMEOUT = 5000 // 5 segundos (aumentado para conexões lentas)

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT)

    const networkResponse = await fetch(request, {
      signal: controller.signal,
      cache: 'no-store' // Força buscar dados frescos
    })

    clearTimeout(timeoutId)

    if (networkResponse && networkResponse.ok) {
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
      
      // Reset flag de forçar rede após sucesso
      forcarRede = false
    }

    return networkResponse
  } catch (error) {
    console.log('[SW Entregador] Rede falhou, tentando cache:', request.url)

    // Se está forçando rede, não usa cache
    if (forcarRede) {
      console.log('[SW Entregador] Forçando rede, ignorando cache')
      if (request.mode === 'navigate') {
        return caches.match('/offline-entregador.html')
      }
      throw error
    }

    const cachedResponse = await caches.match(request)

    if (cachedResponse) {
      const cacheTime = cachedResponse.headers.get('sw-cache-time')
      if (cacheTime) {
        const age = Date.now() - parseInt(cacheTime)
        if (age > MAX_CACHE_AGE) {
          console.log('[SW Entregador] Cache expirado')
          const cache = await caches.open(CACHE_NAME)
          cache.delete(request)
          
          // Para navegação, retorna offline ao invés de erro
          if (request.mode === 'navigate') {
            return caches.match('/offline-entregador.html')
          }
          throw new Error('Cache expirado')
        }
        
        // Adiciona header indicando que é do cache
        const headers = new Headers(cachedResponse.headers)
        headers.set('x-from-cache', 'true')
        
        return new Response(cachedResponse.body, {
          status: cachedResponse.status,
          statusText: cachedResponse.statusText,
          headers: headers
        })
      } else {
        return cachedResponse
      }
    }

    if (request.mode === 'navigate') {
      return caches.match('/offline-entregador.html')
    }

    throw error
  }
}

// Listener para mensagens
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW Entregador] Forçando atualização')
    self.skipWaiting()
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    console.log('[SW Entregador] Limpando cache')
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName.includes('entregador')) {
              return caches.delete(cacheName)
            }
          })
        )
      })
    )
  }

  // Novo: Força buscar da rede na próxima requisição
  if (event.data && event.data.type === 'FORCE_NETWORK') {
    console.log('[SW Entregador] Forçando busca da rede')
    forcarRede = true
  }

  // Novo: Verifica se o SW está ativo e responde
  if (event.data && event.data.type === 'PING') {
    console.log('[SW Entregador] Ping recebido, respondendo...')
    event.ports[0]?.postMessage({ type: 'PONG', timestamp: Date.now() })
  }

  // Novo: Limpa cache expirado
  if (event.data && event.data.type === 'CLEAR_EXPIRED_CACHE') {
    console.log('[SW Entregador] Limpando cache expirado')
    event.waitUntil(
      caches.open(CACHE_NAME).then(async (cache) => {
        const requests = await cache.keys()
        const now = Date.now()
        
        for (const request of requests) {
          const response = await cache.match(request)
          if (response) {
            const cacheTime = response.headers.get('sw-cache-time')
            if (cacheTime && (now - parseInt(cacheTime)) > MAX_CACHE_AGE) {
              console.log('[SW Entregador] Removendo cache expirado:', request.url)
              await cache.delete(request)
            }
          }
        }
      })
    )
  }
})

// Listener para push notifications
self.addEventListener('push', (event) => {
  console.log('[SW Entregador] Push recebido:', event)
  
  let data = {
    title: 'Nova Entrega!',
    body: 'Voce tem uma nova entrega disponivel',
    icon: '/logo.webp',
    badge: '/logo.webp',
    tag: 'nova-entrega-' + Date.now(),
    data: { url: '/entregador' }
  }

  if (event.data) {
    try {
      const payload = event.data.json()
      data = { ...data, ...payload }
    } catch (e) {
      data.body = event.data.text()
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      badge: data.badge,
      tag: data.tag,
      requireInteraction: true,
      vibrate: [200, 100, 200, 100, 200],
      renotify: true,
      data: data.data,
      actions: [
        { action: 'ver', title: 'Ver Entrega' },
        { action: 'fechar', title: 'Fechar' }
      ]
    })
  )
})

// Ação na notificação
self.addEventListener('notificationclick', (event) => {
  console.log('[SW Entregador] Notificacao clicada:', event.action, event.notification.tag)
  event.notification.close()

  if (event.action === 'fechar') {
    return
  }

  const urlToOpen = '/entregador'

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Tenta focar em janela existente
        for (const client of clientList) {
          if (client.url.includes('/entregador') && 'focus' in client) {
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

// Fechar notificação
self.addEventListener('notificationclose', (event) => {
  console.log('[SW Entregador] Notificacao fechada:', event.notification.tag)
})
