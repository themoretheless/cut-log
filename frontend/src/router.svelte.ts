import type { Component } from 'svelte'

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '')

export interface RouteDef {
  path: string
  load: () => Promise<{ default: Component }>
}

export const routes: RouteDef[] = [
  { path: '/', load: () => import('./pages/Home.svelte') },
  { path: '/box', load: () => import('./pages/BoxBuilder.svelte') },
  { path: '/skadis', load: () => import('./pages/SkadisBuilder.svelte') },
]

export const notFound: RouteDef = { path: '*', load: () => import('./pages/NotFound.svelte') }

function currentPath(): string {
  let p = window.location.pathname
  if (BASE && p.startsWith(BASE)) p = p.slice(BASE.length)
  if (!p.startsWith('/')) p = '/' + p
  if (p.length > 1) p = p.replace(/\/$/, '')
  return p
}

const state = $state({ path: currentPath() })

window.addEventListener('popstate', () => {
  state.path = currentPath()
})

export function navigate(to: string) {
  if (to === state.path) return
  history.pushState(null, '', BASE + (to === '/' ? '/' : to))
  state.path = currentPath()
}

export function routerPath(): string {
  return state.path
}

export function matchRoute(path: string): RouteDef {
  return routes.find(r => r.path === path) ?? notFound
}
