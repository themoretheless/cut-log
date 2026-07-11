import { describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { useHomeStorage } from './useHomeStorage'
import type { HomeState } from '@/lib/homeState'

const state = (): HomeState => ({
  sheetWidth: 2440, sheetHeight: 1220, kerf: 3, pieces: [], pricePerSheet: 0, currency: '₽',
})

describe('useHomeStorage', () => {
  it('debounces saves and loads through the validated state parser', () => {
    vi.useFakeTimers()
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: vi.fn((key: string, value: string) => { values.set(key, value) }),
    }
    const apply = vi.fn()
    const scope = effectScope()
    const channel = scope.run(() => useHomeStorage({ capture: state, apply, storage, delay: 50 }))!
    channel.scheduleSave()
    channel.scheduleSave()
    vi.advanceTimersByTime(50)
    expect(storage.setItem).toHaveBeenCalledOnce()
    expect(channel.load()).toBe(true)
    expect(apply).toHaveBeenCalledWith(state())
    scope.stop()
    vi.useRealTimers()
  })

  it('surfaces quota errors', () => {
    const error = new DOMException('quota', 'QuotaExceededError')
    const onError = vi.fn()
    const scope = effectScope()
    const channel = scope.run(() => useHomeStorage({
      capture: state,
      apply: () => undefined,
      storage: { getItem: () => null, setItem: () => { throw error } },
      onError,
    }))!
    channel.saveNow()
    expect(onError).toHaveBeenCalledWith(error)
    scope.stop()
  })
})
