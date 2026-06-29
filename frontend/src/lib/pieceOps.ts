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

/**
 * Move the piece at `fromIndex` to `toIndex`, reordering only the non-locked
 * pieces (locked pieces keep their absolute slots). Indices are absolute
 * positions in `pieces`; the visible list carries each piece's original index,
 * so an active filter does not change the mapping. Returns a new array, or an
 * unchanged copy when an index is equal, out of range, or points at a locked
 * piece. Insert-after on a downward move, insert-before on an upward move
 * (the usual drag convention).
 */
export function reorderByDrag(pieces: CutPiece[], fromIndex: number, toIndex: number): CutPiece[] {
  const out = pieces.slice()
  if (fromIndex === toIndex) return out
  if (fromIndex < 0 || fromIndex >= pieces.length || toIndex < 0 || toIndex >= pieces.length) return out
  if (pieces[fromIndex]?.locked || pieces[toIndex]?.locked) return out

  const unlockedIndexes = pieces.map((p, i) => (p.locked ? -1 : i)).filter(i => i >= 0)
  const sourcePos = unlockedIndexes.indexOf(fromIndex)
  const targetPos = unlockedIndexes.indexOf(toIndex)
  if (sourcePos < 0 || targetPos < 0) return out

  const unlocked = unlockedIndexes.map(i => pieces[i])
  const [item] = unlocked.splice(sourcePos, 1)
  unlocked.splice(targetPos, 0, item)
  unlockedIndexes.forEach((i, k) => { out[i] = unlocked[k] })
  return out
}
