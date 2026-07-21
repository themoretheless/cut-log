import { computed, nextTick, onScopeDispose, ref } from 'vue'
import { createHistory } from '@/lib/history'
import { parseHomeState, serializeHomeState, type HomeState } from '@/lib/homeState'

interface HomeHistoryOptions {
  capture: () => HomeState
  apply: (state: HomeState) => void
  persist: (state: HomeState) => boolean
  onRestore?: () => void
  delay?: number
  limit?: number
}

export function useHomeHistory(options: HomeHistoryOptions) {
  const history = createHistory(serializeHomeState(options.capture()), options.limit)
  const revision = ref(0)
  const lastRecordedAction = ref<string | null>(null)
  const hasPendingChange = ref(false)
  let restoring = false
  let timer: ReturnType<typeof setTimeout> | undefined
  let pendingAction: string | null = null
  let pendingSnapshot: string | null = null

  const canUndo = computed(() => {
    revision.value
    return hasPendingChange.value || history.canUndo()
  })
  const canRedo = computed(() => {
    revision.value
    return !hasPendingChange.value && history.canRedo()
  })

  function refresh() {
    revision.value++
  }

  function flushPendingRecord() {
    clearTimeout(timer)
    const action = pendingAction
    const snapshot = pendingSnapshot
    pendingAction = null
    pendingSnapshot = null
    timer = undefined
    hasPendingChange.value = false
    if (snapshot === null || snapshot === history.current()) return
    history.snapshot(snapshot)
    lastRecordedAction.value = action
    refresh()
  }

  function record(action = 'project.edit') {
    if (restoring) return
    const snapshot = serializeHomeState(options.capture())
    if (timer && pendingAction !== action) {
      clearTimeout(timer)
      flushPendingRecord()
    }
    clearTimeout(timer)
    pendingAction = action
    pendingSnapshot = snapshot
    hasPendingChange.value = snapshot !== history.current()
    timer = setTimeout(flushPendingRecord, options.delay ?? 350)
  }

  function restore(snapshot: string): boolean {
    const state = parseHomeState(snapshot)
    if (!state) return false
    if (!options.persist(state)) return false
    restoring = true
    clearTimeout(timer)
    timer = undefined
    pendingAction = null
    pendingSnapshot = null
    hasPendingChange.value = false
    try {
      options.apply(state)
      options.onRestore?.()
      return true
    } finally {
      nextTick(() => { restoring = false })
    }
  }

  function undo(): boolean {
    flushPendingRecord()
    const snapshot = history.undo()
    if (snapshot === undefined) return false
    const restored = restore(snapshot)
    if (!restored) history.redo()
    refresh()
    return restored
  }

  function redo(): boolean {
    flushPendingRecord()
    const snapshot = history.redo()
    if (snapshot === undefined) return false
    const restored = restore(snapshot)
    if (!restored) history.undo()
    refresh()
    return restored
  }

  function reset() {
    clearTimeout(timer)
    timer = undefined
    pendingAction = null
    pendingSnapshot = null
    hasPendingChange.value = false
    history.reset(serializeHomeState(options.capture()))
    lastRecordedAction.value = null
    refresh()
  }

  function dispose() {
    clearTimeout(timer)
    timer = undefined
    pendingAction = null
    pendingSnapshot = null
    hasPendingChange.value = false
  }

  onScopeDispose(dispose)
  return { canUndo, canRedo, lastRecordedAction, record, undo, redo, reset, dispose }
}
