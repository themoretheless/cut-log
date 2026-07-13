import { onMounted, onScopeDispose } from 'vue'
import { isEditableTarget } from '@/lib/keyboard'

export interface KeyboardShortcut {
  key: string
  ctrlOrMeta?: boolean
  shift?: boolean
  alt?: boolean
  allowInEditable?: boolean
  when?: () => boolean
  run: (event: KeyboardEvent) => void
}

interface KeyboardEventTarget {
  addEventListener(type: 'keydown', listener: (event: KeyboardEvent) => void): void
  removeEventListener(type: 'keydown', listener: (event: KeyboardEvent) => void): void
}

function matches(event: KeyboardEvent, shortcut: KeyboardShortcut): boolean {
  const ctrlOrMeta = event.ctrlKey || event.metaKey
  return event.key.toLocaleLowerCase() === shortcut.key.toLocaleLowerCase()
    && ctrlOrMeta === (shortcut.ctrlOrMeta ?? false)
    && event.shiftKey === (shortcut.shift ?? false)
    && event.altKey === (shortcut.alt ?? false)
}

export function createShortcutHandler(shortcuts: readonly KeyboardShortcut[]) {
  return (event: KeyboardEvent) => {
    for (const shortcut of shortcuts) {
      if (!matches(event, shortcut)) continue
      if (!shortcut.allowInEditable && isEditableTarget(event.target as HTMLElement | null)) continue
      if (shortcut.when && !shortcut.when()) continue
      event.preventDefault()
      shortcut.run(event)
      return
    }
  }
}

export function useKeyboardShortcuts(
  shortcuts: readonly KeyboardShortcut[],
  target: KeyboardEventTarget = window,
) {
  const handler = createShortcutHandler(shortcuts)
  let listening = false

  function start() {
    if (listening) return
    target.addEventListener('keydown', handler)
    listening = true
  }

  function stop() {
    if (!listening) return
    target.removeEventListener('keydown', handler)
    listening = false
  }

  onMounted(start)
  onScopeDispose(stop)
  return { handler, start, stop }
}
