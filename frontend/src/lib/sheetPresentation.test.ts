import { describe, expect, it } from 'vitest'
import { badgeWidth, grainLines, pieceAccessibleName, sheetScale } from './sheetPresentation'
import type { PlacedPiece } from '@/services/types'

describe('sheet presentation', () => {
  it('fits sheets into stable bounds and guards zero dimensions', () => {
    expect(sheetScale({ width: 2440, height: 1220 })).toBeCloseTo(520 / 2440)
    expect(Number.isFinite(sheetScale({ width: 0, height: 0 }))).toBe(true)
  })

  it('generates evenly spaced grain lines', () => {
    expect(grainLines(100, 4)).toEqual([20, 40, 60, 80])
  })

  it('grows badges for three-digit indexes', () => {
    expect(badgeWidth(9)).toBe(12)
    expect(badgeWidth(100)).toBeGreaterThan(badgeWidth(10))
  })

  it('builds a useful accessible piece name', () => {
    const piece = {
      source: { id: 'a', label: 'Shelf', width: 100, height: 50, quantity: 1, allowRotation: true, color: '#fff' },
      x: 0, y: 0, width: 50, height: 100, isRotated: true,
    } satisfies PlacedPiece
    expect(pieceAccessibleName(piece, 2)).toContain('Shelf, 50 by 100 millimeters, rotated')
    expect(pieceAccessibleName(piece, 2, {
      by: 'на', millimeters: 'миллиметров', rotated: 'повёрнута',
    })).toBe('Shelf, 50 на 100 миллиметров, повёрнута')
  })
})
