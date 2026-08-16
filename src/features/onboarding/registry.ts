import type { TourConfig } from './types'

/**
 * Registro central dos tours.
 *
 * Adicionar um novo onboarding = criar um arquivo de config e chamar
 * registerTour (ver config/index.ts). Nenhum código do engine muda.
 */

const tours = new Map<string, TourConfig>()

export const registerTour = (config: TourConfig) => {
  tours.set(config.id, config)
}

export const getTour = (id: string) => tours.get(id)

export const getAllTours = () =>
  Array.from(tours.values()).sort((a, b) => (a.order ?? 99) - (b.order ?? 99))

const routeMatchesPath = (route: string, pathname: string) =>
  pathname === route || pathname.startsWith(`${route}/`)

const matchRoute = (routes: string[], pathname: string) =>
  routes.some((route) => routeMatchesPath(route, pathname))

/** Comprimento da rota mais específica do config que casa com o pathname. */
const matchedRouteLength = (routes: string[], pathname: string) =>
  routes
    .filter((route) => routeMatchesPath(route, pathname))
    .reduce((longest, route) => Math.max(longest, route.length), -1)

/**
 * Tour "dono" da rota atual: entre os que casam, vence a rota mais longa
 * (ex.: `/admin/pedidos/novo` vence `/admin/pedidos`).
 */
export const getTourByRoute = (pathname: string): TourConfig | undefined =>
  getAllTours()
    .filter((tour) => matchRoute(tour.routes, pathname))
    .sort((a, b) => matchedRouteLength(b.routes, pathname) - matchedRouteLength(a.routes, pathname))[0]
