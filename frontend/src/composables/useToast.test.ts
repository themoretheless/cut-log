import { describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { useToast } from './useToast'

describe('useToast', () => {
  it('replaces and clears messages with an explicit tone', () => {
    vi.useFakeTimers()
    const scope = effectScope()
    const toast = scope.run(() => useToast(100))!
    toast.showError('Failed')
    expect(toast.message.value).toBe('Failed')
    expect(toast.tone.value).toBe('error')
    vi.advanceTimersByTime(100)
    expect(toast.message.value).toBe('')
    scope.stop()
    vi.useRealTimers()
  })
})
