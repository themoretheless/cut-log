import { ref } from 'vue'
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
  const snapshots = ref<ProjectSnapshot[]>([])
  const name = ref('')
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
    return persistSnapshots(snapshots.value)
  }

  function load(): boolean {
    try {
      snapshots.value = parseProjectSnapshots(storage.getItem(PROJECT_SNAPSHOTS_KEY))
      return true
    } catch (error) {
      snapshots.value = []
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
    const next = upsertProjectSnapshot(snapshots.value, snapshot, options.limit)
    const persisted = persistSnapshots(next)
    if (!persisted.ok) return persisted
    snapshots.value = next
    return { ok: true, value: snapshot }
  }

  function save(summary: string, fallbackName: string): SnapshotOperationResult<ProjectSnapshot> {
    const result = create(name.value.trim() || fallbackName, summary)
    if (result.ok) name.value = ''
    return result
  }

  function saveAuto(snapshotName: string, summary: string): SnapshotOperationResult<ProjectSnapshot> {
    return create(snapshotName, summary)
  }

  function remove(id: string): SnapshotOperationResult<ProjectSnapshot> {
    const snapshot = snapshots.value.find(item => item.id === id)
    if (!snapshot) return { ok: false, reason: 'not_found' }
    const next = removeProjectSnapshot(snapshots.value, id)
    const persisted = persistSnapshots(next)
    if (!persisted.ok) return persisted
    snapshots.value = next
    return { ok: true, value: snapshot }
  }

  return { snapshots, name, load, save, saveAuto, remove, persist }
}
