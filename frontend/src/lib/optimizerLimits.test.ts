import { describe, expect, it } from 'vitest'
import {
  MAX_PIECE_QUANTITY,
  MAX_TOTAL_QUANTITY,
  assertOptimizerCapacity,
  normalizeQuantity,
  totalQuantity,
} from './optimizerLimits'

describe('optimizer limits', () => {
  it('normalizes invalid, fractional, and excessive quantities', () => {
    expect(normalizeQuantity(Number.NaN)).toBe(1)
    expect(normalizeQuantity(-4)).toBe(1)
    expect(normalizeQuantity(2.6)).toBe(3)
    expect(normalizeQuantity(MAX_PIECE_QUANTITY + 99)).toBe(MAX_PIECE_QUANTITY)
  })

  it('rejects a total that would overwork the wasm packer', () => {
    const safe = [{ quantity: MAX_PIECE_QUANTITY }, { quantity: MAX_PIECE_QUANTITY }]
    const unsafe = [...safe, { quantity: 1 }]
    expect(totalQuantity(safe)).toBe(MAX_TOTAL_QUANTITY)
    expect(() => assertOptimizerCapacity(safe)).not.toThrow()
    expect(() => assertOptimizerCapacity(unsafe)).toThrow(RangeError)
  })
})
