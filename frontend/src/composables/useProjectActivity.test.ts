import { effectScope } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import type { HomeState } from '@/lib/homeState'
import { useProjectActivity } from './useProjectActivity'

function project(width = 400): HomeState {
  return {
    sheetWidth: 2440,
    sheetHeight: 1220,
    kerf: 3,
    pricePerSheet: 0,
    currency: '₽',
    pieces: [{
      id: 'piece-1',
      label: 'Shelf',
      width,
      height: 300,
      quantity: 1,
      allowRotation: true,
      color: '#4A90D9',
    }],
  }
}

describe('useProjectActivity', () => {
  it('owns snapshot comparison, restore, and the searchable operation trail', () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value) },
    }
    let current = project()
    let id = 0
    const apply = vi.fn((state: HomeState) => { current = state })
    const resetAfterRestore = vi.fn()
    const saveNow = vi.fn()
    const showToast = vi.fn()
    const scope = effectScope()
    const activity = scope.run(() => useProjectActivity({
      capture: () => current,
      apply,
      hasPieces: () => current.pieces.length > 0,
      snapshotSummary: () => '1 type',
      resetAfterRestore,
      saveNow,
      translate: key => key,
      showToast,
      storage,
      createId: () => `id-${++id}`,
      now: () => '2026-07-19T00:00:00.000Z',
    }))!

    activity.snapshotName.value = 'Baseline'
    activity.saveSnapshot()
    const baseline = activity.snapshots.value[0]
    current = project(450)
    activity.compareSnapshot(baseline)

    expect(activity.snapshotCompare.value).toMatchObject({ name: 'Baseline', changed: 1 })
    activity.operationQuery.value = 'compare'
    expect(activity.filteredOperationLog.value).toHaveLength(1)

    activity.restoreSnapshot(baseline)

    expect(apply).toHaveBeenCalledWith(baseline.state)
    expect(current.pieces[0].width).toBe(400)
    expect(resetAfterRestore).toHaveBeenCalledOnce()
    expect(saveNow).toHaveBeenCalledOnce()
    expect(showToast).toHaveBeenCalledWith('snapshot_restored')
    scope.stop()
  })
})
