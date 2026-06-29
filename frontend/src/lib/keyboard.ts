/**
 * Keyboard-shortcut helpers. Pure so they are unit-testable without a DOM; the
 * component passes the event target (or a minimal stand-in).
 */

/**
 * True when the target is a control that should handle keys natively, so global
 * app shortcuts must not hijack it: text inputs, textareas, selects, and any
 * contentEditable element. Without this, e.g. Ctrl+Z in a label field would run
 * the project-wide undo instead of undoing the typed text.
 */
export function isEditableTarget(
  el: { tagName?: string; isContentEditable?: boolean } | null,
): boolean {
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable === true
}
