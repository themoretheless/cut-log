import { computed, ref } from 'vue'
import type { HomeState } from '@/lib/homeState'
import { formatAreaM2, pieceArea } from '@/lib/pieceEditor'
import type { ProjectSnapshot } from '@/lib/projectSnapshots'
import {
  useProjectSnapshots,
  type SnapshotOperationResult,
} from './useProjectSnapshots'

const OPERATION_LOG_KEY = 'operation_log'
const OPERATION_LOG_LIMIT = 14

interface ActivityStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export interface OperationEntry {
  id: string
  label: string
  detail: string
  createdAt: string
}

export interface SnapshotComparison {
  name: string
  piecesDelta: number
  areaDelta: string
  added: number
  removed: number
  changed: number
  sheetChanged: boolean
}

export type ProjectActivitySnapshotResult =
  | SnapshotOperationResult<ProjectSnapshot>
  | { ok: false; reason: 'empty_project' }

export function safetySnapshotAllowsMutation(result: ProjectActivitySnapshotResult): boolean {
  return result.ok || result.reason === 'empty_project'
}

interface UseProjectActivityOptions {
  capture: () => HomeState
  apply: (state: HomeState) => void
  hasContent: () => boolean
  snapshotSummary: () => string
  resetAfterRestore: () => void
  persist: (state: HomeState) => boolean
  translate: (key: string) => string
  showToast: (message: string) => void
  showError: (message: string) => void
  storage?: ActivityStorage
  createId?: () => string
  now?: () => string
}

function stateArea(state: HomeState): number {
  return state.pieces.reduce((sum, piece) => sum + pieceArea(piece) * piece.quantity, 0)
}

function validOperationEntry(value: any, createId: () => string): OperationEntry | null {
  if (!value || typeof value !== 'object') return null
  if (typeof value.label !== 'string' || typeof value.createdAt !== 'string') return null
  return {
    id: typeof value.id === 'string' && value.id ? value.id : createId(),
    label: value.label.slice(0, 80),
    detail: typeof value.detail === 'string' ? value.detail.slice(0, 140) : '',
    createdAt: value.createdAt,
  }
}

export function useProjectActivity(options: UseProjectActivityOptions) {
  const storage = options.storage ?? localStorage
  const createId = options.createId ?? (() => crypto.randomUUID())
  const operationLog = ref<OperationEntry[]>([])
  const operationQuery = ref('')
  const snapshotCompare = ref<SnapshotComparison | null>(null)
  const snapshotStore = useProjectSnapshots({
    capture: options.capture,
    storage,
    createId,
    now: options.now,
    onError: () => options.showError(options.translate('storage_error')),
  })
  const { snapshots, name: snapshotName } = snapshotStore

  const filteredOperationLog = computed(() => {
    const query = operationQuery.value.trim().toLocaleLowerCase()
    if (!query) return operationLog.value
    return operationLog.value.filter(entry =>
      entry.label.toLocaleLowerCase().includes(query)
      || entry.detail.toLocaleLowerCase().includes(query),
    )
  })

  function saveOperationLogNow() {
    try {
      storage.setItem(OPERATION_LOG_KEY, JSON.stringify(operationLog.value))
    } catch { /* Project persistence reports its own user-facing errors. */ }
  }

  function loadOperationLog() {
    let raw = ''
    try {
      raw = storage.getItem(OPERATION_LOG_KEY) ?? ''
    } catch {
      raw = ''
    }
    if (!raw) return
    try {
      const parsed = JSON.parse(raw)
      operationLog.value = Array.isArray(parsed)
        ? parsed
            .map(value => validOperationEntry(value, createId))
            .filter((entry: OperationEntry | null): entry is OperationEntry => entry !== null)
            .slice(0, OPERATION_LOG_LIMIT)
        : []
    } catch {
      operationLog.value = []
    }
  }

  function load() {
    snapshotStore.load()
    loadOperationLog()
  }

  function recordOperation(label: string, detail = '') {
    operationLog.value = [{
      id: createId(),
      label,
      detail,
      createdAt: options.now?.() ?? new Date().toISOString(),
    }, ...operationLog.value].slice(0, OPERATION_LOG_LIMIT)
    saveOperationLogNow()
  }

  function clearOperationLog() {
    operationLog.value = []
    saveOperationLogNow()
  }

  function buildComparison(snapshot: ProjectSnapshot): SnapshotComparison {
    const current = options.capture()
    const currentById = new Map(current.pieces.map(piece => [piece.id, piece]))
    const snapshotById = new Map(snapshot.state.pieces.map(piece => [piece.id, piece]))
    let changed = 0
    for (const [id, piece] of currentById) {
      const previous = snapshotById.get(id)
      if (!previous) continue
      if (
        piece.label !== previous.label
        || piece.width !== previous.width
        || piece.height !== previous.height
        || piece.quantity !== previous.quantity
        || piece.allowRotation !== previous.allowRotation
        || piece.locked !== previous.locked
      ) changed++
    }

    const areaDelta = stateArea(current) - stateArea(snapshot.state)
    return {
      name: snapshot.name,
      piecesDelta: current.pieces.length - snapshot.state.pieces.length,
      areaDelta: `${areaDelta >= 0 ? '+' : ''}${formatAreaM2(areaDelta)} ${options.translate('material_area')}`,
      added: current.pieces.filter(piece => !snapshotById.has(piece.id)).length,
      removed: snapshot.state.pieces.filter(piece => !currentById.has(piece.id)).length,
      changed,
      sheetChanged: current.sheetWidth !== snapshot.state.sheetWidth
        || current.sheetHeight !== snapshot.state.sheetHeight
        || current.kerf !== snapshot.state.kerf,
    }
  }

  function compareSnapshot(snapshot: ProjectSnapshot) {
    snapshotCompare.value = buildComparison(snapshot)
    recordOperation(options.translate('operation.compare_snapshot'), snapshot.name)
  }

  function saveSnapshot(): ProjectActivitySnapshotResult {
    if (!options.hasContent()) return { ok: false, reason: 'empty_project' }
    const result = snapshotStore.save(
      options.snapshotSummary(),
      `${options.translate('snapshot.default_name')} ${snapshots.value.length + 1}`,
    )
    if (!result.ok) return result
    const snapshot = result.value
    options.showToast(options.translate('snapshot_saved'))
    recordOperation(options.translate('operation.save_snapshot'), snapshot.name)
    return result
  }

  function saveAutoSnapshot(name: string): ProjectActivitySnapshotResult {
    if (!options.hasContent()) return { ok: false, reason: 'empty_project' }
    return snapshotStore.saveAuto(name, options.snapshotSummary())
  }

  function restoreSnapshot(snapshot: ProjectSnapshot): ProjectActivitySnapshotResult {
    const safetySnapshot = saveAutoSnapshot(options.translate('snapshot.auto_before_restore'))
    if (!safetySnapshotAllowsMutation(safetySnapshot)) return safetySnapshot
    if (!options.persist(snapshot.state)) {
      return { ok: false, reason: 'persistence', error: new Error('home state persistence failed') }
    }
    snapshotCompare.value = buildComparison(snapshot)
    options.apply(snapshot.state)
    options.resetAfterRestore()
    options.showToast(options.translate('snapshot_restored'))
    recordOperation(options.translate('operation.restore_snapshot'), snapshot.name)
    return { ok: true, value: snapshot }
  }

  function deleteSnapshot(snapshot: ProjectSnapshot): SnapshotOperationResult<ProjectSnapshot> {
    const result = snapshotStore.remove(snapshot.id)
    if (!result.ok) return result
    options.showToast(options.translate('snapshot_deleted'))
    recordOperation(options.translate('operation.delete_snapshot'), snapshot.name)
    return result
  }

  function dispose() {
    saveOperationLogNow()
  }

  return {
    operationLog,
    operationQuery,
    filteredOperationLog,
    snapshotCompare,
    snapshots,
    snapshotName,
    load,
    dispose,
    recordOperation,
    clearOperationLog,
    compareSnapshot,
    saveSnapshot,
    saveAutoSnapshot,
    restoreSnapshot,
    deleteSnapshot,
  }
}
