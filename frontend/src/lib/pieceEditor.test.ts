import { describe, it, expect } from 'vitest'
import type { CutPiece } from '@/services/types'
import {
  addDimensionDelta,
  findOversizedPieces,
  pieceFitsSheet,
  pieceMatchesQuery,
  roundDimensionsUp,
  sortPiecesForEditor,
  summarizePieces,
  swapDimensions,
} from './pieceEditor'

function piece(overrides: Partial<CutPiece>): CutPiece {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    label: overrides.label ?? '',
    width: overrides.width ?? 100,
    height: overrides.height ?? 50,
    quantity: overrides.quantity ?? 1,
    allowRotation: overrides.allowRotation ?? true,
    color: overrides.color ?? '#4A90D9',
  }
}

describe('piece editor helpers', () => {
  it('matches pieces by label, dimensions and quantity', () => {
    const p = piece({ label: 'Shelf A', width: 760, height: 300, quantity: 4 })

    expect(pieceMatchesQuery(p, 'shelf')).toBe(true)
    expect(pieceMatchesQuery(p, '760x300')).toBe(true)
    expect(pieceMatchesQuery(p, '300×760')).toBe(true)
    expect(pieceMatchesQuery(p, '4')).toBe(true)
    expect(pieceMatchesQuery(p, 'side')).toBe(false)
  })

  it('summarizes quantities, material area and rotation coverage', () => {
    const summary = summarizePieces([
      piece({ width: 100, height: 50, quantity: 2, allowRotation: true }),
      piece({ width: 40, height: 20, quantity: 3, allowRotation: false }),
    ])

    expect(summary.totalTypes).toBe(2)
    expect(summary.totalQuantity).toBe(5)
    expect(summary.totalArea).toBe(12400)
    expect(summary.largestPieceArea).toBe(5000)
    expect(summary.rotationEnabled).toBe(1)
  })

  it('checks sheet fit with rotation awareness', () => {
    const rotatesIntoSheet = piece({ width: 1200, height: 2400, allowRotation: true })
    const locked = piece({ width: 1200, height: 2400, allowRotation: false })

    expect(pieceFitsSheet(rotatesIntoSheet, 2440, 1220)).toBe(true)
    expect(pieceFitsSheet(locked, 2440, 1220)).toBe(false)
    expect(findOversizedPieces([rotatesIntoSheet, locked], 2440, 1220)).toEqual([locked])
  })

  it('sorts editor copies without mutating the source order', () => {
    const a = piece({ id: 'a', label: 'B', width: 10, height: 10, quantity: 1 })
    const b = piece({ id: 'b', label: 'A', width: 20, height: 20, quantity: 3 })
    const source = [a, b]

    expect(sortPiecesForEditor(source, 'area_desc').map(p => p.id)).toEqual(['b', 'a'])
    expect(sortPiecesForEditor(source, 'name_asc').map(p => p.id)).toEqual(['b', 'a'])
    expect(sortPiecesForEditor(source, 'quantity_desc').map(p => p.id)).toEqual(['b', 'a'])
    expect(source.map(p => p.id)).toEqual(['a', 'b'])
  })

  it('transforms dimensions for quick editor actions', () => {
    expect(addDimensionDelta({ width: 100, height: 50 }, 2)).toEqual({ width: 102, height: 52 })
    expect(addDimensionDelta({ width: 2, height: 1 }, -5)).toEqual({ width: 1, height: 1 })
    expect(swapDimensions({ width: 100, height: 50 })).toEqual({ width: 50, height: 100 })
    expect(roundDimensionsUp({ width: 101, height: 50 }, 5)).toEqual({ width: 105, height: 50 })
  })
})
