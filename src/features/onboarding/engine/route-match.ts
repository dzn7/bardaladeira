/**
 * Casamento de rotas do onboarding (Next App Router, via usePathname).
 *
 * As rotas do admin são estáticas (`/admin/crediario`, `/admin/pedidos/novo`),
 * então o casamento é por igualdade ou por prefixo de segmento — sem os
 * padrões `[id]` do pages router.
 */

/** Casa exatamente a rota (mesmo pathname). */
export const routeMatches = (route: string, pathname: string) => pathname === route

/**
 * Casa a rota ou qualquer sub-rota dela (prefixo de segmento).
 * `/admin/pedidos` casa com `/admin/pedidos/novo`, mas não com `/admin/pedidos-x`.
 */
export const routeMatchesPrefix = (route: string, pathname: string) =>
  pathname === route || pathname.startsWith(`${route}/`)
