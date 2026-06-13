/**
 * Validation for the "add piece" form on the cutting optimizer page. Returns an
 * i18n key for the first failing rule, or null when the piece is acceptable.
 * Pure (no Vue, no i18n) so the rules are unit-testable; the caller translates.
 */
export interface NewPieceForm {
  width: number
  height: number
  quantity: number
}

export interface SheetSize {
  sheetWidth: number
  sheetHeight: number
}

export type PieceValidationError = 'invalid_dims' | 'piece_larger' | 'qty_min'

export function validateNewPiece(form: NewPieceForm, sheet: SheetSize): PieceValidationError | null {
  if (form.width <= 0 || form.height <= 0) return 'invalid_dims'
  // Reject only pieces that cannot fit the sheet in any orientation.
  if (
    form.width > sheet.sheetWidth && form.height > sheet.sheetWidth &&
    form.width > sheet.sheetHeight && form.height > sheet.sheetHeight
  ) return 'piece_larger'
  if (form.quantity <= 0) return 'qty_min'
  return null
}
