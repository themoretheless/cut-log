import type { CutPiece } from '@/services/types'

/** Hard limits shared by every browser-side entry point into the optimizer. */
export const MAX_PIECE_QUANTITY = 1_000
export const MAX_TOTAL_QUANTITY = 2_000

export function normalizeQuantity(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 1
  return Math.min(MAX_PIECE_QUANTITY, Math.max(1, Math.round(value)))
}

export function totalQuantity(pieces: readonly Pick<CutPiece, 'quantity'>[]): number {
  return pieces.reduce((sum, piece) => sum + normalizeQuantity(piece.quantity), 0)
}

export function assertOptimizerCapacity(pieces: readonly Pick<CutPiece, 'quantity'>[]): void {
  let total = 0
  for (const piece of pieces) {
    if (!Number.isFinite(piece.quantity) || piece.quantity <= 0 || piece.quantity > MAX_PIECE_QUANTITY) {
      throw new RangeError(`Invalid piece quantity: ${piece.quantity} (max ${MAX_PIECE_QUANTITY})`)
    }
    total += Math.round(piece.quantity)
  }
  if (total > MAX_TOTAL_QUANTITY) {
    throw new RangeError(`Too many pieces for one calculation: ${total} (max ${MAX_TOTAL_QUANTITY})`)
  }
}
