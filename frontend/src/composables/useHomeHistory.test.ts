import { describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick } from 'vue'
import type { HomeState } from '@/lib/homeState'
import { useHomeHistory } from './useHomeHistory'

function state(width = 2440): HomeState {
  return {
    sheetWidth: width,
    sheetHeight: 1220,
    kerf: 3,
    pieces: [],
    pricePerSheet: 0,
    currency: '₽',
  }
}

describe('useHomeHistory', () => {
  it('coalesces edits and restores undo and redo snapshots', async () => {
    vi.useFakeTimers()
    let current = state()
    const apply = vi.fn((next: HomeState) => { current = next })
    const saveNow = vi.fn()
    const scope = effectScope()
    const history = scope.run(() => useHomeHistory({
      capture: () => current,
      apply,
      saveNow,
      delay: 50,
    }))!

    current = state(2500)
    history.record()
    current = state(2800)
    history.record()
    vi.advanceTimersByTime(50)

    expect(history.canUndo.value).toBe(true)
    expect(history.undo()).toBe(true)
    expect(current.sheetWidth).toBe(2440)
    expect(saveNow).toHaveBeenCalledOnce()
    expect(history.canRedo.value).toBe(true)

    await nextTick()
    expect(history.redo()).toBe(true)
    expect(current.sheetWidth).toBe(2800)
    scope.stop()
    vi.useRealTimers()
  })

  it('does not record watcher feedback while a restore is flushing', async () => {
    vi.useFakeTimers()
    let current = state()
    let history: ReturnType<typeof useHomeHistory>
    const scope = effectScope()
    history = scope.run(() => useHomeHistory({
      capture: () => current,
      apply: next => {
        current = next
        history.record()
      },
      saveNow: () => undefined,
      delay: 10,
    }))!

    current = state(2500)
    history.record()
    vi.advanceTimersByTime(10)
    history.undo()
    vi.advanceTimersByTime(10)
    await nextTick()

    expect(history.canUndo.value).toBe(false)
    expect(history.canRedo.value).toBe(true)
    scope.stop()
    vi.useRealTimers()
  })

  it('cancels a pending record when disposed', () => {
    vi.useFakeTimers()
    let current = state()
    const scope = effectScope()
    const history = scope.run(() => useHomeHistory({
      capture: () => current,
      apply: next => { current = next },
      saveNow: () => undefined,
      delay: 10,
    }))!
    current = state(2500)
    history.record()
    scope.stop()
    vi.advanceTimersByTime(10)
    expect(history.canUndo.value).toBe(false)
    vi.useRealTimers()
  })
})
