import { computed, ref } from 'vue'
import type { HomeState } from '@/lib/homeState'
import { pieceArea } from '@/lib/pieceEditor'
import type { ProjectSnapshot } from '@/lib/projectSnapshots'
import { useProjectSnapshots } from './useProjectSnapshots'

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

interface UseProjectActivityOptions {
  capture: () => HomeState
  apply: (state: HomeState) => void
  hasPieces: () => boolean
  snapshotSummary: () => string
  resetAfterRestore: () => void
  saveNow: () => void
  translate: (key: string) => string
  showToast: (message: string) => void
  storage?: ActivityStorage
  createId?: () => string
  now?: () => string
}

function stateArea(state: HomeState): number {
  return state.pieces.reduce((sum, piece) => sum + pieceArea(piece) * piece.quantity, 0)
}

function areaM2(areaMm2: number): string {
  return (areaMm2 / 1_000_000).toFixed(2)
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
      areaDelta: `${areaDelta >= 0 ? '+' : ''}${areaM2(areaDelta)} ${options.translate('material_area')}`,
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

  function saveSnapshot() {
    if (!options.hasPieces()) return
    const snapshot = snapshotStore.save(
      options.snapshotSummary(),
      `${options.translate('snapshot.default_name')} ${snapshots.value.length + 1}`,
    )
    options.showToast(options.translate('snapshot_saved'))
    recordOperation(options.translate('operation.save_snapshot'), snapshot.name)
  }

  function saveAutoSnapshot(name: string) {
    if (!options.hasPieces()) return
    snapshotStore.saveAuto(name, options.snapshotSummary())
  }

  function restoreSnapshot(snapshot: ProjectSnapshot) {
    saveAutoSnapshot(options.translate('snapshot.auto_before_restore'))
    snapshotCompare.value = buildComparison(snapshot)
    options.apply(snapshot.state)
    options.resetAfterRestore()
    options.saveNow()
    options.showToast(options.translate('snapshot_restored'))
    recordOperation(options.translate('operation.restore_snapshot'), snapshot.name)
  }

  function deleteSnapshot(snapshot: ProjectSnapshot) {
    snapshotStore.remove(snapshot.id)
    options.showToast(options.translate('snapshot_deleted'))
    recordOperation(options.translate('operation.delete_snapshot'), snapshot.name)
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
