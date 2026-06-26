/**
 * Small pure operations on the cut list. Kept separate from the component so the
 * array bookkeeping (insertion position, fallbacks) is unit-testable; the caller
 * supplies the fresh id and color and applies the returned list.
 */
import type { CutPiece } from '@/services/types'

/**
 * Return a new list with a copy of the `id` piece inserted right after it. The
 * copy takes `newId` and `newColor`; all other fields are preserved. When `id`
 * is null or not found, the last piece is duplicated and appended (the natural
 * "duplicate" target when nothing is selected). An empty list is returned as-is.
 */
export function duplicatePiece(
  pieces: CutPiece[],
  id: string | null,
  newId: string,
  newColor: string,
): CutPiece[] {
  if (pieces.length === 0) return pieces.slice()
  let idx = id ? pieces.findIndex(p => p.id === id) : -1
  if (idx < 0) idx = pieces.length - 1
  const copy: CutPiece = { ...pieces[idx], id: newId, color: newColor }
  const out = pieces.slice()
  out.splice(idx + 1, 0, copy)
  return out
}
