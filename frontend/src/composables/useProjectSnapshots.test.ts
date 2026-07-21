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
    const result = channel.save('1 part', 'Fallback')
    expect(result).toMatchObject({ ok: true, value: { name: 'Workshop' } })
    expect(channel.name.value).toBe('')
    expect(storage.setItem).toHaveBeenCalledWith(PROJECT_SNAPSHOTS_KEY, expect.any(String))

    channel.snapshots.value = []
    expect(channel.load()).toBe(true)
    expect(channel.snapshots.value).toHaveLength(1)
    const snapshot = channel.snapshots.value[0]
    expect(channel.remove(snapshot.id)).toMatchObject({ ok: true, value: { id: snapshot.id } })
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

  it('does not publish a snapshot or clear its name when persistence fails', () => {
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
    channel.name.value = 'Keep this name'
    const result = channel.save('Empty', 'Fallback')
    expect(result).toMatchObject({ ok: false, reason: 'persistence' })
    expect(channel.snapshots.value).toEqual([])
    expect(channel.name.value).toBe('Keep this name')
    expect(onError).toHaveBeenCalledTimes(2)
    scope.stop()
  })

  it('keeps an existing snapshot when delete persistence fails', () => {
    let failWrites = false
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        if (failWrites) throw new Error('quota')
        values.set(key, value)
      },
    }
    const scope = effectScope()
    const channel = scope.run(() => useProjectSnapshots({
      capture: state,
      storage,
      createId: () => 'snapshot-1',
      now: () => '2026-07-14T10:00:00.000Z',
    }))!
    expect(channel.saveAuto('Auto', 'Empty').ok).toBe(true)
    failWrites = true

    const result = channel.remove('snapshot-1')

    expect(result).toMatchObject({ ok: false, reason: 'persistence' })
    expect(channel.snapshots.value).toHaveLength(1)
    expect(channel.snapshots.value[0].id).toBe('snapshot-1')
    scope.stop()
  })
})
