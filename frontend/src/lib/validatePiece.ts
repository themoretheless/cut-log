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
  /** Saw/laser kerf; a piece needs width+kerf to fit. Defaults to 0. */
  kerf?: number
}

export type PieceValidationError = 'invalid_dims' | 'piece_larger' | 'qty_min'

export function validateNewPiece(form: NewPieceForm, sheet: SheetSize): PieceValidationError | null {
  // Number.isFinite rejects NaN/Infinity, which a bare `<= 0` lets through
  // (NaN <= 0 is false), so an empty or garbage field is caught here.
  if (!Number.isFinite(form.width) || !Number.isFinite(form.height) || form.width <= 0 || form.height <= 0) {
    return 'invalid_dims'
  }
  // The packer needs width+kerf (and height+kerf) to fit, so account for kerf
  // here too; otherwise a piece the optimizer will reject passes the form.
  const kerf = Number.isFinite(sheet.kerf) ? Math.max(0, sheet.kerf as number) : 0
  const fits = (a: number, b: number) => a + kerf <= sheet.sheetWidth && b + kerf <= sheet.sheetHeight
  if (!fits(form.width, form.height) && !fits(form.height, form.width)) return 'piece_larger'
  if (!Number.isFinite(form.quantity) || form.quantity <= 0) return 'qty_min'
  return null
}
