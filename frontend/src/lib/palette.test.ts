import { describe, expect, it } from 'vitest'
import { PIECE_COLORS, SHELF_COLORS, SHELF_EDGE_COLORS, colorAt } from './palette'

describe('shared palettes', () => {
  it('contains only six-digit hex colors', () => {
    for (const color of [...PIECE_COLORS, ...SHELF_COLORS, ...SHELF_EDGE_COLORS]) {
      expect(color).toMatch(/^#[0-9A-F]{6}$/)
    }
  })

  it('wraps positive and negative indexes', () => {
    expect(colorAt(PIECE_COLORS, PIECE_COLORS.length)).toBe(PIECE_COLORS[0])
    expect(colorAt(PIECE_COLORS, -1)).toBe(PIECE_COLORS.at(-1))
  })
})
