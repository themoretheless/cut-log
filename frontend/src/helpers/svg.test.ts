import { describe, it, expect } from 'vitest'
import { PIECE_COLORS, truncate, efficiencyClass } from './svg'

describe('truncate', () => {
  it('returns empty for non-positive limits', () => {
    expect(truncate('hello', 0)).toBe('')
    expect(truncate('hello', -3)).toBe('')
  })
  it('leaves short-enough strings untouched', () => {
    expect(truncate('hi', 5)).toBe('hi')
    expect(truncate('hello', 5)).toBe('hello')
  })
  it('clips and appends an ellipsis when too long', () => {
    expect(truncate('hello world', 5)).toBe('hello…')
  })
})

describe('efficiencyClass', () => {
  it('maps efficiency to a CSS class by threshold', () => {
    expect(efficiencyClass(80)).toBe('eff-good')
    expect(efficiencyClass(79.9)).toBe('eff-ok')
    expect(efficiencyClass(55)).toBe('eff-ok')
    expect(efficiencyClass(54.9)).toBe('eff-poor')
    expect(efficiencyClass(0)).toBe('eff-poor')
  })
})

describe('PIECE_COLORS', () => {
  it('exposes a non-empty palette of hex colors', () => {
    expect(PIECE_COLORS.length).toBeGreaterThan(0)
    for (const c of PIECE_COLORS) expect(c).toMatch(/^#[0-9A-Fa-f]{6}$/)
  })
})
