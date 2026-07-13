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

export function useProjectSnapshots(options: ProjectSnapshotsOptions) {
  const snapshots = ref<ProjectSnapshot[]>([])
  const name = ref('')
  const storage = options.storage ?? localStorage

  function persist(): boolean {
    try {
      storage.setItem(PROJECT_SNAPSHOTS_KEY, serializeProjectSnapshots(snapshots.value))
      return true
    } catch (error) {
      options.onError?.(error)
      return false
    }
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

  function create(nameValue: string, summary: string): ProjectSnapshot {
    const snapshot = createProjectSnapshot({
      id: options.createId?.() ?? crypto.randomUUID(),
      name: nameValue,
      createdAt: options.now?.() ?? new Date().toISOString(),
      summary,
      state: options.capture(),
    })
    snapshots.value = upsertProjectSnapshot(snapshots.value, snapshot, options.limit)
    persist()
    return snapshot
  }

  function save(summary: string, fallbackName: string): ProjectSnapshot {
    const snapshot = create(name.value.trim() || fallbackName, summary)
    name.value = ''
    return snapshot
  }

  function saveAuto(snapshotName: string, summary: string): ProjectSnapshot {
    return create(snapshotName, summary)
  }

  function remove(id: string): boolean {
    const next = removeProjectSnapshot(snapshots.value, id)
    if (next.length === snapshots.value.length) return false
    snapshots.value = next
    persist()
    return true
  }

  return { snapshots, name, load, save, saveAuto, remove, persist }
}
