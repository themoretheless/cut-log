import { describe, it, expect } from 'vitest'
import { validateNewPiece } from './validatePiece'

const sheet = { sheetWidth: 1220, sheetHeight: 2440 }

describe('validateNewPiece', () => {
  it('accepts a normal piece', () => {
    expect(validateNewPiece({ width: 400, height: 300, quantity: 2 }, sheet)).toBeNull()
  })

  it('rejects non-positive dimensions first', () => {
    expect(validateNewPiece({ width: 0, height: 300, quantity: 1 }, sheet)).toBe('invalid_dims')
    expect(validateNewPiece({ width: 400, height: -5, quantity: 1 }, sheet)).toBe('invalid_dims')
    // invalid dims take precedence over quantity
    expect(validateNewPiece({ width: 0, height: 0, quantity: 0 }, sheet)).toBe('invalid_dims')
  })

  it('rejects only pieces too big for the sheet in every orientation', () => {
    expect(validateNewPiece({ width: 3000, height: 3000, quantity: 1 }, sheet)).toBe('piece_larger')
    // too wide one way but fits rotated -> allowed
    expect(validateNewPiece({ width: 2000, height: 100, quantity: 1 }, sheet)).toBeNull()
    // fits along the long side
    expect(validateNewPiece({ width: 1220, height: 2440, quantity: 1 }, sheet)).toBeNull()
  })

  it('rejects non-positive quantity', () => {
    expect(validateNewPiece({ width: 400, height: 300, quantity: 0 }, sheet)).toBe('qty_min')
  })
})
