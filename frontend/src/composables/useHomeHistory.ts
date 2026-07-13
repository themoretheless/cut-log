import { computed, nextTick, onScopeDispose, ref } from 'vue'
import { createHistory } from '@/lib/history'
import { parseHomeState, serializeHomeState, type HomeState } from '@/lib/homeState'

interface HomeHistoryOptions {
  capture: () => HomeState
  apply: (state: HomeState) => void
  saveNow: () => void
  delay?: number
  limit?: number
}

export function useHomeHistory(options: HomeHistoryOptions) {
  const history = createHistory(serializeHomeState(options.capture()), options.limit)
  const revision = ref(0)
  let restoring = false
  let timer: ReturnType<typeof setTimeout> | undefined

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

  function record() {
    if (restoring) return
    clearTimeout(timer)
    timer = setTimeout(() => {
      timer = undefined
      history.snapshot(serializeHomeState(options.capture()))
      refresh()
    }, options.delay ?? 350)
  }

  function restore(snapshot: string): boolean {
    const state = parseHomeState(snapshot)
    if (!state) return false
    restoring = true
    clearTimeout(timer)
    timer = undefined
    options.apply(state)
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
    history.reset(serializeHomeState(options.capture()))
    refresh()
  }

  function dispose() {
    clearTimeout(timer)
    timer = undefined
  }

  onScopeDispose(dispose)
  return { canUndo, canRedo, record, undo, redo, reset, dispose }
}
