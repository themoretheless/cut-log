import { describe, it, expect } from 'vitest'
import { createHistory } from './history'

describe('createHistory', () => {
  it('starts with the initial snapshot and nothing to undo/redo', () => {
    const h = createHistory('a')
    expect(h.current()).toBe('a')
    expect(h.canUndo()).toBe(false)
    expect(h.canRedo()).toBe(false)
    expect(h.size()).toBe(1)
  })

  it('records snapshots and steps back and forward', () => {
    const h = createHistory('a')
    h.snapshot('b')
    h.snapshot('c')
    expect(h.current()).toBe('c')
    expect(h.undo()).toBe('b')
    expect(h.undo()).toBe('a')
    expect(h.canUndo()).toBe(false)
    expect(h.redo()).toBe('b')
    expect(h.redo()).toBe('c')
    expect(h.canRedo()).toBe(false)
  })

  it('returns undefined at the ends without moving', () => {
    const h = createHistory('a')
    expect(h.undo()).toBeUndefined()
    expect(h.current()).toBe('a')
    h.snapshot('b')
    expect(h.redo()).toBeUndefined()
    expect(h.current()).toBe('b')
  })

  it('ignores a snapshot equal to the current state', () => {
    const h = createHistory('a')
    h.snapshot('a')
    h.snapshot('a')
    expect(h.size()).toBe(1)
    expect(h.canUndo()).toBe(false)
  })

  it('drops the redo branch when a new snapshot is taken after undo', () => {
    const h = createHistory('a')
    h.snapshot('b')
    h.snapshot('c')
    h.undo() // back to 'b'
    h.snapshot('d') // new branch from 'b'
    expect(h.current()).toBe('d')
    expect(h.canRedo()).toBe(false)
    expect(h.undo()).toBe('b')
    expect(h.undo()).toBe('a')
  })

  it('caps memory at the limit, discarding the oldest snapshots', () => {
    const h = createHistory('s0', 3)
    h.snapshot('s1')
    h.snapshot('s2')
    h.snapshot('s3') // exceeds limit 3 -> 's0' dropped
    expect(h.size()).toBe(3)
    expect(h.current()).toBe('s3')
    expect(h.undo()).toBe('s2')
    expect(h.undo()).toBe('s1')
    expect(h.canUndo()).toBe(false) // 's0' is gone
  })

  it('reset replaces the whole history with one baseline', () => {
    const h = createHistory('a')
    h.snapshot('b')
    h.snapshot('c')
    h.reset('x')
    expect(h.current()).toBe('x')
    expect(h.size()).toBe(1)
    expect(h.canUndo()).toBe(false)
    expect(h.canRedo()).toBe(false)
  })

  it('supports a custom equality comparator', () => {
    const eq = (a: { v: number }, b: { v: number }) => a.v === b.v
    const h = createHistory({ v: 1 }, 100, eq)
    h.snapshot({ v: 1 }) // equal by comparator -> ignored
    expect(h.size()).toBe(1)
    h.snapshot({ v: 2 })
    expect(h.size()).toBe(2)
  })
})
