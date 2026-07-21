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
    const persist = vi.fn(() => true)
    const onRestore = vi.fn()
    const scope = effectScope()
    const history = scope.run(() => useHomeHistory({
      capture: () => current,
      apply,
      persist,
      onRestore,
      delay: 50,
    }))!

    current = state(2500)
    history.record()
    current = state(2800)
    history.record()
    expect(history.canUndo.value).toBe(true)
    vi.advanceTimersByTime(50)

    expect(history.canUndo.value).toBe(true)
    expect(history.undo()).toBe(true)
    expect(current.sheetWidth).toBe(2440)
    expect(persist).toHaveBeenCalledOnce()
    expect(persist).toHaveBeenCalledWith(expect.objectContaining({ sheetWidth: 2440 }))
    expect(onRestore).toHaveBeenCalledOnce()
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
      persist: () => true,
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
      persist: () => true,
      delay: 10,
    }))!
    current = state(2500)
    history.record()
    expect(history.canUndo.value).toBe(true)
    scope.stop()
    vi.advanceTimersByTime(10)
    expect(history.canUndo.value).toBe(false)
    vi.useRealTimers()
  })

  it('flushes a pending snapshot before immediate undo and redo', async () => {
    vi.useFakeTimers()
    let current = state()
    const scope = effectScope()
    const history = scope.run(() => useHomeHistory({
      capture: () => current,
      apply: next => { current = next },
      persist: () => true,
      delay: 50,
    }))!

    current = state(2500)
    history.record('sheet.width')

    expect(history.canUndo.value).toBe(true)
    expect(history.undo()).toBe(true)
    expect(current.sheetWidth).toBe(2440)
    expect(history.canRedo.value).toBe(true)
    vi.advanceTimersByTime(50)
    await nextTick()
    expect(history.redo()).toBe(true)
    expect(current.sheetWidth).toBe(2500)
    scope.stop()
    vi.useRealTimers()
  })

  it('drops the redo branch when a pending edit is recorded after undo', async () => {
    vi.useFakeTimers()
    let current = state()
    const scope = effectScope()
    const history = scope.run(() => useHomeHistory({
      capture: () => current,
      apply: next => { current = next },
      persist: () => true,
      delay: 50,
    }))!

    current = state(2500)
    history.record('sheet.width')
    vi.advanceTimersByTime(50)
    expect(history.undo()).toBe(true)
    await nextTick()

    current = state(2600)
    history.record('sheet.width')
    expect(history.canUndo.value).toBe(true)
    expect(history.canRedo.value).toBe(false)
    expect(history.redo()).toBe(false)
    expect(current.sheetWidth).toBe(2600)
    expect(history.undo()).toBe(true)
    expect(current.sheetWidth).toBe(2440)
    scope.stop()
    vi.useRealTimers()
  })

  it('leaves restore mode after a restore callback throws', async () => {
    vi.useFakeTimers()
    let current = state()
    const scope = effectScope()
    const history = scope.run(() => useHomeHistory({
      capture: () => current,
      apply: next => { current = next },
      persist: () => true,
      onRestore: () => { throw new Error('restore failed') },
      delay: 10,
    }))!

    current = state(2500)
    history.record('sheet.width')
    vi.advanceTimersByTime(10)
    expect(() => history.undo()).toThrow('restore failed')
    await nextTick()

    current = state(2600)
    history.record('sheet.width')
    expect(history.canUndo.value).toBe(true)
    scope.stop()
    vi.useRealTimers()
  })

  it('keeps separate named actions as separate undo steps', () => {
    vi.useFakeTimers()
    let current = state()
    const scope = effectScope()
    const history = scope.run(() => useHomeHistory({
      capture: () => current,
      apply: next => { current = next },
      persist: () => true,
      delay: 50,
    }))!

    current = state(2500)
    history.record('sheet.width')
    current = state(2800)
    history.record('sheet.preset')
    vi.advanceTimersByTime(50)

    expect(history.lastRecordedAction.value).toBe('sheet.preset')
    expect(history.undo()).toBe(true)
    expect(current.sheetWidth).toBe(2500)
    expect(history.undo()).toBe(true)
    expect(current.sheetWidth).toBe(2440)
    scope.stop()
    vi.useRealTimers()
  })

  it('keeps the visible state and history cursor unchanged when persistence fails', async () => {
    vi.useFakeTimers()
    let current = state()
    let allowPersistence = true
    const apply = vi.fn((next: HomeState) => { current = next })
    const scope = effectScope()
    const history = scope.run(() => useHomeHistory({
      capture: () => current,
      apply,
      persist: () => allowPersistence,
      delay: 10,
    }))!

    current = state(2500)
    history.record('sheet.width')
    vi.advanceTimersByTime(10)
    allowPersistence = false

    expect(history.undo()).toBe(false)
    expect(current.sheetWidth).toBe(2500)
    expect(apply).not.toHaveBeenCalled()
    expect(history.canUndo.value).toBe(true)
    expect(history.canRedo.value).toBe(false)

    allowPersistence = true
    expect(history.undo()).toBe(true)
    expect(current.sheetWidth).toBe(2440)
    await nextTick()
    expect(history.redo()).toBe(true)
    expect(current.sheetWidth).toBe(2500)
    scope.stop()
    vi.useRealTimers()
  })
})
