// @vitest-environment happy-dom
/**
 * Port of the Vue RouteErrorBoundary suite. There is no RouteErrorBoundary
 * component in the Svelte app: the fallback lives in App.svelte and covers both
 * failure modes the Vue boundary covered. A rejected dynamic import is caught
 * by the `routeError` state; an error thrown while the route renders is caught
 * by `<svelte:boundary>`, which stands in for Vue's onErrorCaptured.
 */
import { render, fireEvent } from '@testing-library/svelte'
import { tick } from 'svelte'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '@/App.svelte'
import RestoredRoute from './components/RestoredRoute.test.svelte'
import ThrowingRoute, { resetAttempts } from './components/ThrowingRoute.test.svelte'

const load = vi.fn()

vi.mock('@/router.svelte', () => ({
  routerPath: () => '/',
  navigate: () => undefined,
  matchRoute: () => ({ path: '/', load: () => load() }),
}))

afterEach(() => {
  vi.restoreAllMocks()
  load.mockReset()
})

async function settle() {
  for (let i = 0; i < 4; i++) {
    await Promise.resolve()
    await tick()
  }
}

describe('route error fallback', () => {
  it('shows a recoverable fallback and remounts the failed route', async () => {
    load
      .mockRejectedValueOnce(new Error('render failed'))
      .mockResolvedValue({ default: RestoredRoute })

    const { container } = render(App)
    await settle()

    const alert = container.querySelector('[role="alert"]')
    expect(alert).not.toBeNull()
    expect(container.textContent).not.toContain('Project restored')

    const retry = alert!.querySelector('button') as HTMLButtonElement
    await fireEvent.click(retry)
    await settle()

    expect(container.textContent).toContain('Project restored')
    expect(container.querySelector('[role="alert"]')).toBeNull()
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('catches an error thrown while the route renders and recovers on retry', async () => {
    resetAttempts()
    const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    load.mockResolvedValue({ default: ThrowingRoute })

    const { container } = render(App)
    await settle()

    const alert = container.querySelector('[role="alert"]')
    expect(alert).not.toBeNull()
    expect(container.textContent).not.toContain('Route rendered')
    // The app chrome outside the boundary must survive the failed route.
    expect(container.querySelector('.page-nav')).not.toBeNull()
    expect(logged).toHaveBeenCalled()

    const retry = alert!.querySelector('button') as HTMLButtonElement
    await fireEvent.click(retry)
    await settle()

    expect(container.textContent).toContain('Route rendered')
    expect(container.querySelector('[role="alert"]')).toBeNull()
  })

  // Not portable: the Vue test asserted that the failed route's unmount hook
  // (persistProject) ran exactly once. A component that throws while rendering
  // never finishes mounting, so it registers no effect to clean up and there is
  // no unmount to observe.
  it.skip('runs the failed route unmount hook exactly once', () => undefined)
})
