// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { useToast } from './useToast.svelte'

describe('useToast', () => {
  it('replaces and clears messages with an explicit tone', () => {
    vi.useFakeTimers()
    let toast!: ReturnType<typeof useToast>
    const stop = $effect.root(() => {
      toast = useToast(100)
      return () => {}
    })
    toast.showError('Failed')
    expect(toast.message).toBe('Failed')
    expect(toast.tone).toBe('error')
    vi.advanceTimersByTime(100)
    expect(toast.message).toBe('')
    stop()
    vi.useRealTimers()
  })
})
