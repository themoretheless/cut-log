import { effectScope } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import type { HomeState } from '@/lib/homeState'
import { PROJECT_SNAPSHOTS_KEY } from '@/lib/projectSnapshots'
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
    const persist = vi.fn(() => true)
    const showToast = vi.fn()
    const showError = vi.fn()
    const scope = effectScope()
    const activity = scope.run(() => useProjectActivity({
      capture: () => current,
      apply,
      hasContent: () => current.pieces.length > 0,
      snapshotSummary: () => '1 type',
      resetAfterRestore,
      persist,
      translate: key => key,
      showToast,
      showError,
      storage,
      createId: () => `id-${++id}`,
      now: () => '2026-07-19T00:00:00.000Z',
    }))!

    activity.snapshotName.value = 'Baseline'
    expect(activity.saveSnapshot().ok).toBe(true)
    const baseline = activity.snapshots.value[0]
    current = project(450)
    activity.compareSnapshot(baseline)

    expect(activity.snapshotCompare.value).toMatchObject({ name: 'Baseline', changed: 1 })
    activity.operationQuery.value = 'compare'
    expect(activity.filteredOperationLog.value).toHaveLength(1)

    expect(activity.restoreSnapshot(baseline).ok).toBe(true)

    expect(apply).toHaveBeenCalledWith(baseline.state)
    expect(current.pieces[0].width).toBe(400)
    expect(resetAfterRestore).toHaveBeenCalledOnce()
    expect(persist).toHaveBeenCalledOnce()
    expect(persist).toHaveBeenCalledWith(baseline.state)
    expect(showToast).toHaveBeenCalledWith('snapshot_restored')
    expect(showError).not.toHaveBeenCalled()
    scope.stop()
  })

  it('does not report or log snapshot mutations when persistence fails', () => {
    let failSnapshotWrites = true
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        if (key === PROJECT_SNAPSHOTS_KEY && failSnapshotWrites) throw new Error('quota')
        values.set(key, value)
      },
    }
    const showToast = vi.fn()
    const showError = vi.fn()
    const scope = effectScope()
    const activity = scope.run(() => useProjectActivity({
      capture: () => project(),
      apply: () => undefined,
      hasContent: () => true,
      snapshotSummary: () => '1 type',
      resetAfterRestore: () => undefined,
      persist: () => true,
      translate: key => key,
      showToast,
      showError,
      storage,
      createId: () => 'snapshot-1',
      now: () => '2026-07-19T00:00:00.000Z',
    }))!
    activity.snapshotName.value = 'Baseline'

    expect(activity.saveSnapshot()).toMatchObject({ ok: false, reason: 'persistence' })
    expect(activity.snapshots.value).toEqual([])
    expect(activity.snapshotName.value).toBe('Baseline')
    expect(activity.operationLog.value).toEqual([])
    expect(showToast).not.toHaveBeenCalled()
    expect(showError).toHaveBeenCalledOnce()
    expect(showError).toHaveBeenCalledWith('storage_error')

    failSnapshotWrites = false
    expect(activity.saveSnapshot().ok).toBe(true)
    const snapshot = activity.snapshots.value[0]
    const operationCount = activity.operationLog.value.length
    showToast.mockClear()
    showError.mockClear()
    failSnapshotWrites = true

    expect(activity.deleteSnapshot(snapshot)).toMatchObject({ ok: false, reason: 'persistence' })
    expect(activity.snapshots.value).toHaveLength(1)
    expect(activity.operationLog.value).toHaveLength(operationCount)
    expect(showToast).not.toHaveBeenCalled()
    expect(showError).toHaveBeenCalledOnce()
    expect(showError).toHaveBeenCalledWith('storage_error')
    scope.stop()
  })

  it('aborts restore when the safety snapshot cannot be persisted', () => {
    let current = project(450)
    const target = {
      id: 'target',
      name: 'Baseline',
      createdAt: '2026-07-19T00:00:00.000Z',
      summary: '1 type',
      state: project(400),
    }
    const apply = vi.fn((state: HomeState) => { current = state })
    const resetAfterRestore = vi.fn()
    const persist = vi.fn(() => true)
    const showToast = vi.fn()
    const showError = vi.fn()
    const scope = effectScope()
    const activity = scope.run(() => useProjectActivity({
      capture: () => current,
      apply,
      hasContent: () => current.pieces.length > 0,
      snapshotSummary: () => '1 type',
      resetAfterRestore,
      persist,
      translate: key => key,
      showToast,
      showError,
      storage: {
        getItem: () => null,
        setItem: key => {
          if (key === PROJECT_SNAPSHOTS_KEY) throw new Error('quota')
        },
      },
      createId: () => 'safety-snapshot',
      now: () => '2026-07-19T00:00:00.000Z',
    }))!

    expect(activity.restoreSnapshot(target)).toMatchObject({ ok: false, reason: 'persistence' })
    expect(current.pieces[0].width).toBe(450)
    expect(apply).not.toHaveBeenCalled()
    expect(resetAfterRestore).not.toHaveBeenCalled()
    expect(persist).not.toHaveBeenCalled()
    expect(activity.snapshotCompare.value).toBeNull()
    expect(activity.operationLog.value).toEqual([])
    expect(showToast).not.toHaveBeenCalled()
    expect(showError).toHaveBeenCalledOnce()
    expect(showError).toHaveBeenCalledWith('storage_error')
    scope.stop()
  })

  it('aborts restore before applying state when home persistence fails', () => {
    let current = project(450)
    const target = {
      id: 'target',
      name: 'Baseline',
      createdAt: '2026-07-19T00:00:00.000Z',
      summary: '1 type',
      state: project(400),
    }
    const apply = vi.fn((state: HomeState) => { current = state })
    const showToast = vi.fn()
    const scope = effectScope()
    const activity = scope.run(() => useProjectActivity({
      capture: () => current,
      apply,
      hasContent: () => true,
      snapshotSummary: () => '1 type',
      resetAfterRestore: () => undefined,
      persist: () => false,
      translate: key => key,
      showToast,
      showError: () => undefined,
      storage: {
        getItem: () => null,
        setItem: () => undefined,
      },
      createId: () => 'safety-snapshot',
      now: () => '2026-07-19T00:00:00.000Z',
    }))!

    expect(activity.restoreSnapshot(target)).toMatchObject({ ok: false, reason: 'persistence' })
    expect(activity.snapshots.value).toHaveLength(1)
    expect(current.pieces[0].width).toBe(450)
    expect(apply).not.toHaveBeenCalled()
    expect(showToast).not.toHaveBeenCalled()
    scope.stop()
  })

  it('restores an empty project without requiring a safety snapshot', () => {
    let current = { ...project(), pieces: [] }
    const target = {
      id: 'target',
      name: 'Baseline',
      createdAt: '2026-07-19T00:00:00.000Z',
      summary: '1 type',
      state: project(400),
    }
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: vi.fn((key: string, value: string) => { values.set(key, value) }),
    }
    const showToast = vi.fn()
    const showError = vi.fn()
    const scope = effectScope()
    const activity = scope.run(() => useProjectActivity({
      capture: () => current,
      apply: state => { current = state },
      hasContent: () => current.pieces.length > 0,
      snapshotSummary: () => 'Empty',
      resetAfterRestore: () => undefined,
      persist: () => true,
      translate: key => key,
      showToast,
      showError,
      storage,
      createId: () => 'operation-1',
      now: () => '2026-07-19T00:00:00.000Z',
    }))!

    expect(activity.restoreSnapshot(target)).toMatchObject({ ok: true, value: target })
    expect(current.pieces[0].width).toBe(400)
    expect(storage.setItem).not.toHaveBeenCalledWith(PROJECT_SNAPSHOTS_KEY, expect.any(String))
    expect(showToast).toHaveBeenCalledWith('snapshot_restored')
    expect(showError).not.toHaveBeenCalled()
    scope.stop()
  })

  it('protects settings-only projects with a safety snapshot', () => {
    let current = { ...project(), sheetWidth: 1800, pieces: [] }
    const target = {
      id: 'target',
      name: 'Baseline',
      createdAt: '2026-07-19T00:00:00.000Z',
      summary: '1 type',
      state: project(400),
    }
    const values = new Map<string, string>()
    const scope = effectScope()
    const activity = scope.run(() => useProjectActivity({
      capture: () => current,
      apply: state => { current = state },
      hasContent: () => true,
      snapshotSummary: () => 'Settings only',
      resetAfterRestore: () => undefined,
      persist: () => true,
      translate: key => key,
      showToast: () => undefined,
      showError: () => undefined,
      storage: {
        getItem: key => values.get(key) ?? null,
        setItem: (key, value) => { values.set(key, value) },
      },
      createId: () => 'safety-snapshot',
      now: () => '2026-07-19T00:00:00.000Z',
    }))!

    expect(activity.restoreSnapshot(target).ok).toBe(true)
    expect(activity.snapshots.value).toHaveLength(1)
    expect(activity.snapshots.value[0].state).toMatchObject({ sheetWidth: 1800, pieces: [] })
    expect(current.sheetWidth).toBe(2440)
    scope.stop()
  })
})
