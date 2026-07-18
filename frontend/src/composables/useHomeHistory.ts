import { computed, nextTick, onScopeDispose, ref } from 'vue'
import { createHistory } from '@/lib/history'
import { parseHomeState, serializeHomeState, type HomeState } from '@/lib/homeState'

interface HomeHistoryOptions {
  capture: () => HomeState
  apply: (state: HomeState) => void
  saveNow: () => void
  onRestore?: () => void
  delay?: number
  limit?: number
}

export function useHomeHistory(options: HomeHistoryOptions) {
  const history = createHistory(serializeHomeState(options.capture()), options.limit)
  const revision = ref(0)
  const lastRecordedAction = ref<string | null>(null)
  let restoring = false
  let timer: ReturnType<typeof setTimeout> | undefined
  let pendingAction: string | null = null
  let pendingSnapshot: string | null = null

  const canUndo = computed(() => {
    revision.value
    return history.canUndo()
  })
  const canRedo = computed(() => {
    revision.value
    return history.canRedo()
  })

  function refresh() {
    revision.value++
  }

  function flushPendingRecord() {
    const action = pendingAction
    const snapshot = pendingSnapshot
    pendingAction = null
    pendingSnapshot = null
    timer = undefined
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
    timer = setTimeout(flushPendingRecord, options.delay ?? 350)
  }

  function restore(snapshot: string): boolean {
    const state = parseHomeState(snapshot)
    if (!state) return false
    restoring = true
    clearTimeout(timer)
    timer = undefined
    pendingAction = null
    pendingSnapshot = null
    options.apply(state)
    options.onRestore?.()
    options.saveNow()
    nextTick(() => { restoring = false })
    return true
  }

  function undo(): boolean {
    const snapshot = history.undo()
    if (snapshot === undefined) return false
    const restored = restore(snapshot)
    refresh()
    return restored
  }

  function redo(): boolean {
    const snapshot = history.redo()
    if (snapshot === undefined) return false
    const restored = restore(snapshot)
    refresh()
    return restored
  }

  function reset() {
    clearTimeout(timer)
    timer = undefined
    pendingAction = null
    pendingSnapshot = null
    history.reset(serializeHomeState(options.capture()))
    lastRecordedAction.value = null
    refresh()
  }

  function dispose() {
    clearTimeout(timer)
    timer = undefined
    pendingAction = null
    pendingSnapshot = null
  }

  onScopeDispose(dispose)
  return { canUndo, canRedo, lastRecordedAction, record, undo, redo, reset, dispose }
}
