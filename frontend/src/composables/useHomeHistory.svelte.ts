import { tick } from 'svelte'
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

/** Svelte port note: the caller must invoke dispose() on unmount (no scope hook). */
export function useHomeHistory(options: HomeHistoryOptions) {
  const history = createHistory(serializeHomeState(options.capture()), options.limit)
  const state = $state({
    revision: 0,
    lastRecordedAction: null as string | null,
    hasPendingChange: false,
  })
  let restoring = false
  let timer: ReturnType<typeof setTimeout> | undefined
  let pendingAction: string | null = null
  let pendingSnapshot: string | null = null

  const canUndo = $derived.by(() => {
    void state.revision
    return state.hasPendingChange || history.canUndo()
  })
  const canRedo = $derived.by(() => {
    void state.revision
    return !state.hasPendingChange && history.canRedo()
  })

  function refresh() {
    state.revision++
  }

  function flushPendingRecord() {
    clearTimeout(timer)
    const action = pendingAction
    const snapshot = pendingSnapshot
    pendingAction = null
    pendingSnapshot = null
    timer = undefined
    state.hasPendingChange = false
    if (snapshot === null || snapshot === history.current()) return
    history.snapshot(snapshot)
    state.lastRecordedAction = action
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
    state.hasPendingChange = snapshot !== history.current()
    timer = setTimeout(flushPendingRecord, options.delay ?? 350)
  }

  function restore(snapshot: string): boolean {
    const parsed = parseHomeState(snapshot)
    if (!parsed) return false
    if (!options.persist(parsed)) return false
    restoring = true
    clearTimeout(timer)
    timer = undefined
    pendingAction = null
    pendingSnapshot = null
    state.hasPendingChange = false
    try {
      options.apply(parsed)
      options.onRestore?.()
      return true
    } finally {
      void tick().then(() => { restoring = false })
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
    state.hasPendingChange = false
    history.reset(serializeHomeState(options.capture()))
    state.lastRecordedAction = null
    refresh()
  }

  function dispose() {
    clearTimeout(timer)
    timer = undefined
    pendingAction = null
    pendingSnapshot = null
    state.hasPendingChange = false
  }

  return {
    get canUndo() { return canUndo },
    get canRedo() { return canRedo },
    get lastRecordedAction() { return state.lastRecordedAction },
    record,
    undo,
    redo,
    reset,
    dispose,
  }
}
