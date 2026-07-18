import { describe, expect, it, vi } from 'vitest'
import { createShortcutHandler, type KeyboardShortcut } from './useKeyboardShortcuts'

function event(
  key: string,
  options: Partial<KeyboardEvent> & { target?: KeyboardEvent['target'] } = {},
): KeyboardEvent {
  return {
    key,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    target: null,
    defaultPrevented: false,
    preventDefault: vi.fn(),
    ...options,
  } as unknown as KeyboardEvent
}

describe('createShortcutHandler', () => {
  it('matches exact modifiers and runs only the first matching shortcut', () => {
    const undo = vi.fn()
    const redo = vi.fn()
    const shortcuts: KeyboardShortcut[] = [
      { key: 'z', ctrlOrMeta: true, run: undo },
      { key: 'z', ctrlOrMeta: true, shift: true, run: redo },
    ]
    const handler = createShortcutHandler(shortcuts)
    const undoEvent = event('Z', { metaKey: true })
    const redoEvent = event('z', { ctrlKey: true, shiftKey: true })

    handler(undoEvent)
    handler(redoEvent)
    expect(undo).toHaveBeenCalledOnce()
    expect(redo).toHaveBeenCalledOnce()
    expect(undoEvent.preventDefault).toHaveBeenCalledOnce()
  })

  it('preserves native editing unless a shortcut explicitly opts in', () => {
    const nativeSafe = vi.fn()
    const global = vi.fn()
    const handler = createShortcutHandler([
      { key: 'z', ctrlOrMeta: true, run: nativeSafe },
      { key: 'k', ctrlOrMeta: true, allowInEditable: true, run: global },
    ])
    const input = { tagName: 'INPUT', isContentEditable: false } as unknown as EventTarget

    handler(event('z', { ctrlKey: true, target: input }))
    handler(event('k', { ctrlKey: true, target: input }))
    expect(nativeSafe).not.toHaveBeenCalled()
    expect(global).toHaveBeenCalledOnce()
  })

  it('honors dynamic guards without consuming a disabled shortcut', () => {
    const run = vi.fn()
    const keydown = event('Escape')
    createShortcutHandler([{ key: 'Escape', when: () => false, run }])(keydown)
    expect(run).not.toHaveBeenCalled()
    expect(keydown.preventDefault).not.toHaveBeenCalled()
  })

  it('does not run a global shortcut after a focused control handled the key', () => {
    const run = vi.fn()
    const keydown = event('Enter', { defaultPrevented: true })

    createShortcutHandler([{ key: 'Enter', run }])(keydown)

    expect(run).not.toHaveBeenCalled()
    expect(keydown.preventDefault).not.toHaveBeenCalled()
  })
})
