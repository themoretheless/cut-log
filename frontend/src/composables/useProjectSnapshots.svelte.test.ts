// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import type { HomeState } from '@/lib/homeState'
import { PROJECT_SNAPSHOTS_KEY } from '@/lib/projectSnapshots'
import { useProjectSnapshots } from './useProjectSnapshots.svelte'

const state = (): HomeState => ({
  sheetWidth: 2440,
  sheetHeight: 1220,
  kerf: 3,
  pieces: [],
  pricePerSheet: 0,
  currency: '₽',
})

function withChannel(
  options: Parameters<typeof useProjectSnapshots>[0],
  run: (channel: ReturnType<typeof useProjectSnapshots>) => void,
) {
  let channel!: ReturnType<typeof useProjectSnapshots>
  const stop = $effect.root(() => {
    channel = useProjectSnapshots(options)
    return () => {}
  })
  try {
    run(channel)
  } finally {
    stop()
  }
}

describe('useProjectSnapshots', () => {
  it('creates, persists, reloads, and removes snapshots', () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: vi.fn((key: string, value: string) => { values.set(key, value) }),
    }
    withChannel({
      capture: state,
      storage,
      createId: () => 'snapshot-1',
      now: () => '2026-07-14T10:00:00.000Z',
    }, (channel) => {
      channel.name = 'Workshop'
      const result = channel.save('1 part', 'Fallback')
      expect(result).toMatchObject({ ok: true, value: { name: 'Workshop' } })
      expect(channel.name).toBe('')
      expect(storage.setItem).toHaveBeenCalledWith(PROJECT_SNAPSHOTS_KEY, expect.any(String))

      // The Svelte store exposes `snapshots` as a read-only getter over a $state
      // array, so the list is emptied in place instead of reassigned.
      channel.snapshots.splice(0, channel.snapshots.length)
      expect(channel.load()).toBe(true)
      expect(channel.snapshots).toHaveLength(1)
      const snapshot = channel.snapshots[0]
      expect(channel.remove(snapshot.id)).toMatchObject({ ok: true, value: { id: snapshot.id } })
      expect(channel.snapshots).toEqual([])
    })
  })

  it('keeps manual name input when creating an automatic snapshot', () => {
    withChannel({
      capture: state,
      storage: { getItem: () => null, setItem: () => undefined },
      createId: () => 'auto-1',
      now: () => '2026-07-14T10:00:00.000Z',
    }, (channel) => {
      channel.name = 'Draft name'
      channel.saveAuto('Before import', 'Empty')
      expect(channel.name).toBe('Draft name')
      expect(channel.snapshots[0].name).toBe('Before import')
    })
  })

  it('does not publish a snapshot or clear its name when persistence fails', () => {
    const onError = vi.fn()
    withChannel({
      capture: state,
      storage: {
        getItem: () => { throw new Error('blocked') },
        setItem: () => { throw new Error('quota') },
      },
      onError,
    }, (channel) => {
      expect(channel.load()).toBe(false)
      channel.name = 'Keep this name'
      const result = channel.save('Empty', 'Fallback')
      expect(result).toMatchObject({ ok: false, reason: 'persistence' })
      expect(channel.snapshots).toEqual([])
      expect(channel.name).toBe('Keep this name')
      expect(onError).toHaveBeenCalledTimes(2)
    })
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
    withChannel({
      capture: state,
      storage,
      createId: () => 'snapshot-1',
      now: () => '2026-07-14T10:00:00.000Z',
    }, (channel) => {
      expect(channel.saveAuto('Auto', 'Empty').ok).toBe(true)
      failWrites = true

      const result = channel.remove('snapshot-1')

      expect(result).toMatchObject({ ok: false, reason: 'persistence' })
      expect(channel.snapshots).toHaveLength(1)
      expect(channel.snapshots[0].id).toBe('snapshot-1')
    })
  })
})
