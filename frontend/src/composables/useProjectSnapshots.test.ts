import { describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import type { HomeState } from '@/lib/homeState'
import { PROJECT_SNAPSHOTS_KEY } from '@/lib/projectSnapshots'
import { useProjectSnapshots } from './useProjectSnapshots'

const state = (): HomeState => ({
  sheetWidth: 2440,
  sheetHeight: 1220,
  kerf: 3,
  pieces: [],
  pricePerSheet: 0,
  currency: '₽',
})

describe('useProjectSnapshots', () => {
  it('creates, persists, reloads, and removes snapshots', () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: vi.fn((key: string, value: string) => { values.set(key, value) }),
    }
    const scope = effectScope()
    const channel = scope.run(() => useProjectSnapshots({
      capture: state,
      storage,
      createId: () => 'snapshot-1',
      now: () => '2026-07-14T10:00:00.000Z',
    }))!

    channel.name.value = 'Workshop'
    const snapshot = channel.save('1 part', 'Fallback')
    expect(snapshot.name).toBe('Workshop')
    expect(channel.name.value).toBe('')
    expect(storage.setItem).toHaveBeenCalledWith(PROJECT_SNAPSHOTS_KEY, expect.any(String))

    channel.snapshots.value = []
    expect(channel.load()).toBe(true)
    expect(channel.snapshots.value).toHaveLength(1)
    expect(channel.remove(snapshot.id)).toBe(true)
    expect(channel.snapshots.value).toEqual([])
    scope.stop()
  })

  it('keeps manual name input when creating an automatic snapshot', () => {
    const scope = effectScope()
    const channel = scope.run(() => useProjectSnapshots({
      capture: state,
      storage: { getItem: () => null, setItem: () => undefined },
      createId: () => 'auto-1',
      now: () => '2026-07-14T10:00:00.000Z',
    }))!
    channel.name.value = 'Draft name'
    channel.saveAuto('Before import', 'Empty')
    expect(channel.name.value).toBe('Draft name')
    expect(channel.snapshots.value[0].name).toBe('Before import')
    scope.stop()
  })

  it('reports storage failures without throwing', () => {
    const onError = vi.fn()
    const scope = effectScope()
    const channel = scope.run(() => useProjectSnapshots({
      capture: state,
      storage: {
        getItem: () => { throw new Error('blocked') },
        setItem: () => { throw new Error('quota') },
      },
      onError,
    }))!
    expect(channel.load()).toBe(false)
    channel.saveAuto('Auto', 'Empty')
    expect(onError).toHaveBeenCalledTimes(2)
    scope.stop()
  })
})
