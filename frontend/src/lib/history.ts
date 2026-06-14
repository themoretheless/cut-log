/**
 * A small linear undo/redo history over immutable snapshots, the model most
 * editors use: recording a new snapshot after an undo discards the redo branch.
 * Generic and side-effect free so it can be unit-tested on its own; the caller
 * decides what a snapshot is (here: a serialized project string) and how to
 * apply a restored one.
 */

export interface History<T> {
  /** Record a new state. A no-op if equal to the current one. Drops redos. */
  snapshot(value: T): void
  /** Step back; returns the now-current state, or undefined if at the start. */
  undo(): T | undefined
  /** Step forward; returns the now-current state, or undefined if at the end. */
  redo(): T | undefined
  canUndo(): boolean
  canRedo(): boolean
  /** The state at the current position. */
  current(): T
  /** Replace the whole history with a single baseline snapshot. */
  reset(value: T): void
  /** Number of stored snapshots (for tests/diagnostics). */
  size(): number
}

export function createHistory<T>(
  initial: T,
  limit = 100,
  isEqual: (a: T, b: T) => boolean = Object.is,
): History<T> {
  let stack: T[] = [initial]
  let index = 0

  return {
    snapshot(value) {
      if (isEqual(value, stack[index])) return
      // Drop any redo branch, then append the new state.
      stack = stack.slice(0, index + 1)
      stack.push(value)
      index++
      // Cap memory: discard the oldest entries past the limit.
      if (stack.length > limit) {
        const overflow = stack.length - limit
        stack = stack.slice(overflow)
        index -= overflow
      }
    },
    undo() {
      if (index === 0) return undefined
      index--
      return stack[index]
    },
    redo() {
      if (index >= stack.length - 1) return undefined
      index++
      return stack[index]
    },
    canUndo() {
      return index > 0
    },
    canRedo() {
      return index < stack.length - 1
    },
    current() {
      return stack[index]
    },
    reset(value) {
      stack = [value]
      index = 0
    },
    size() {
      return stack.length
    },
  }
}
