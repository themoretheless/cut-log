// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * The module reads the deployment base once at import time, so each case gets
 * a fresh module registry with the base it wants.
 */
async function loadRouter(base: string) {
  vi.resetModules()
  vi.stubEnv('BASE_URL', base)
  return import('./router.svelte')
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('routeHref', () => {
  it('carries the deployment base, which a modified click depends on', async () => {
    const { routeHref } = await loadRouter('/cut-log/')
    expect(routeHref('/')).toBe('/cut-log/')
    expect(routeHref('/box')).toBe('/cut-log/box')
    expect(routeHref('/skadis')).toBe('/cut-log/skadis')
  })

  it('stays a plain path when the app is served from the root', async () => {
    const { routeHref } = await loadRouter('/')
    expect(routeHref('/')).toBe('/')
    expect(routeHref('/box')).toBe('/box')
  })

  it('agrees with what navigate pushes, so both click paths land alike', async () => {
    const { routeHref, navigate } = await loadRouter('/cut-log/')
    const pushed: string[] = []
    vi.spyOn(history, 'pushState').mockImplementation((_state, _title, url) => {
      pushed.push(String(url))
    })

    navigate('/box')
    expect(pushed).toEqual([routeHref('/box')])
  })
})
