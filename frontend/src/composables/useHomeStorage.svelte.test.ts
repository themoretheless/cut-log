// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { useHomeStorage } from './useHomeStorage.svelte'
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
    const channel = useHomeStorage({ capture: state, apply, storage, delay: 50 })
    channel.scheduleSave()
    channel.scheduleSave()
    vi.advanceTimersByTime(50)
    expect(storage.setItem).toHaveBeenCalledOnce()
    expect(channel.load()).toBe(true)
    expect(apply).toHaveBeenCalledWith(state())
    channel.dispose()
    vi.useRealTimers()
  })

  it('surfaces quota errors', () => {
    const error = new DOMException('quota', 'QuotaExceededError')
    const onError = vi.fn()
    const channel = useHomeStorage({
      capture: state,
      apply: () => undefined,
      storage: { getItem: () => null, setItem: () => { throw error } },
      onError,
    })
    expect(channel.saveNow()).toBe(false)
    expect(onError).toHaveBeenCalledWith(error)
    channel.dispose()
  })

  it('persists an explicit state before a caller applies it', () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value) },
    }
    const channel = useHomeStorage({
      capture: state,
      apply: () => undefined,
      storage,
    })
    const target = { ...state(), sheetWidth: 1800 }

    expect(channel.saveState(target)).toBe(true)
    expect(channel.load()).toBe(true)
    expect(JSON.parse(values.get('home_state')!).sheetWidth).toBe(1800)
    channel.dispose()
  })

  it('keeps a loaded project even when canonical rewrite fails', () => {
    const error = new DOMException('quota', 'QuotaExceededError')
    const onError = vi.fn()
    const apply = vi.fn()
    const channel = useHomeStorage({
      capture: state,
      apply,
      storage: {
        getItem: () => JSON.stringify({ version: 1, ...state() }),
        setItem: () => { throw error },
      },
      onError,
    })

    expect(channel.load()).toBe(true)
    expect(apply).toHaveBeenCalledWith(state())
    expect(onError).toHaveBeenCalledWith(error)
    channel.dispose()
  })
})
