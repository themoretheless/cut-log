import type { HomeState } from '@/lib/homeState'
import {
  createProjectSnapshot,
  parseProjectSnapshots,
  PROJECT_SNAPSHOTS_KEY,
  removeProjectSnapshot,
  serializeProjectSnapshots,
  upsertProjectSnapshot,
  type ProjectSnapshot,
} from '@/lib/projectSnapshots'

interface SnapshotStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

interface ProjectSnapshotsOptions {
  capture: () => HomeState
  storage?: SnapshotStorage
  limit?: number
  createId?: () => string
  now?: () => string
  onError?: (error: unknown) => void
}

export type SnapshotOperationFailure =
  | { ok: false; reason: 'persistence'; error: unknown }
  | { ok: false; reason: 'not_found' }

export type SnapshotOperationResult<T> =
  | { ok: true; value: T }
  | SnapshotOperationFailure

export type SnapshotPersistenceResult =
  | { ok: true }
  | Extract<SnapshotOperationFailure, { reason: 'persistence' }>

export function useProjectSnapshots(options: ProjectSnapshotsOptions) {
  const state = $state({
    snapshots: [] as ProjectSnapshot[],
    name: '',
  })
  const storage = options.storage ?? localStorage

  function persistSnapshots(next: readonly ProjectSnapshot[]): SnapshotPersistenceResult {
    try {
      storage.setItem(PROJECT_SNAPSHOTS_KEY, serializeProjectSnapshots(next))
      return { ok: true }
    } catch (error) {
      options.onError?.(error)
      return { ok: false, reason: 'persistence', error }
    }
  }

  function persist(): SnapshotPersistenceResult {
    return persistSnapshots(state.snapshots)
  }

  function load(): boolean {
    try {
      state.snapshots = parseProjectSnapshots(storage.getItem(PROJECT_SNAPSHOTS_KEY))
      return true
    } catch (error) {
      state.snapshots = []
      options.onError?.(error)
      return false
    }
  }

  function create(nameValue: string, summary: string): SnapshotOperationResult<ProjectSnapshot> {
    const snapshot = createProjectSnapshot({
      id: options.createId?.() ?? crypto.randomUUID(),
      name: nameValue,
      createdAt: options.now?.() ?? new Date().toISOString(),
      summary,
      state: options.capture(),
    })
    const next = upsertProjectSnapshot(state.snapshots, snapshot, options.limit)
    const persisted = persistSnapshots(next)
    if (!persisted.ok) return persisted
    state.snapshots = [...next]
    return { ok: true, value: snapshot }
  }

  function save(summary: string, fallbackName: string): SnapshotOperationResult<ProjectSnapshot> {
    const result = create(state.name.trim() || fallbackName, summary)
    if (result.ok) state.name = ''
    return result
  }

  function saveAuto(snapshotName: string, summary: string): SnapshotOperationResult<ProjectSnapshot> {
    return create(snapshotName, summary)
  }

  function remove(id: string): SnapshotOperationResult<ProjectSnapshot> {
    const snapshot = state.snapshots.find(item => item.id === id)
    if (!snapshot) return { ok: false, reason: 'not_found' }
    const next = removeProjectSnapshot(state.snapshots, id)
    const persisted = persistSnapshots(next)
    if (!persisted.ok) return persisted
    state.snapshots = [...next]
    return { ok: true, value: snapshot }
  }

  return {
    get snapshots() { return state.snapshots },
    get name() { return state.name },
    set name(value: string) { state.name = value },
    load,
    save,
    saveAuto,
    remove,
    persist,
  }
}
