import { describe, it, expect } from 'vitest'
import { useBoxModel } from './useBoxModel'

// Stub translate: return the last key segment, so labels are stable and unique.
const t = (key: string) => key.split('.').pop() as string

describe('useBoxModel', () => {
  it('lists 5 pieces sorted by area desc with defaults (no shelves)', () => {
    const m = useBoxModel(t)
    const pieces = m.allPieces()
    expect(pieces).toHaveLength(5)
    const areas = pieces.map(p => p.w * p.h)
    expect([...areas].sort((a, b) => b - a)).toEqual(areas)
    // back wall (300x400) is the largest
    expect(pieces[0].label).toBe('back_short')
  })

  it('adds shelves with per-shelf depth under bevel', () => {
    const m = useBoxModel(t)
    m.NShelves.value = 2
    m.Bevel.value = 30
    const pieces = m.allPieces()
    expect(pieces).toHaveLength(7)
    const shelves = pieces.filter(p => p.label.startsWith('shelf_short'))
    expect(shelves).toHaveLength(2)
    // beveled shelves have different depths
    expect(shelves[0].h).not.toBe(shelves[1].h)
  })

  it('groups gallery as side/tb/back when flat, splits top/bot when beveled', () => {
    const m = useBoxModel(t)
    expect(m.galPieces.value.map(p => p.id)).toEqual(['side', 'tb', 'back'])
    m.Bevel.value = 40
    expect(m.galPieces.value.map(p => p.id)).toEqual(['side', 'top', 'bot', 'back'])
    m.Bevel.value = 0
    m.NShelves.value = 3
    expect(m.galPieces.value.map(p => p.id)).toEqual(['side', 'tb', 'back', 'shelf'])
    expect(m.galPieces.value.at(-1)!.count).toBe(3)
  })

  it('computes cutting layout and stats reactively', () => {
    const m = useBoxModel(t)
    const sheets = m.cuttingSheets.value
    expect(sheets.length).toBeGreaterThan(0)
    expect(m.cutStats.value.sheets).toBe(sheets.length)
    const placed = sheets.flat()
    expect(placed).toHaveLength(5)
    // every placement carries a piece label and stays inside the sheet
    for (const p of placed) {
      expect(p.label).toBeTruthy()
      expect(p.x + p.w).toBeLessThanOrEqual(m.SheetW.value)
      expect(p.y + p.h).toBeLessThanOrEqual(m.SheetH.value)
    }
    // shrinking the sheet forces more sheets or unplaceable pieces
    m.SheetW.value = 320
    m.SheetH.value = 420
    expect(m.cuttingSheets.value.length).toBeGreaterThanOrEqual(sheets.length)
  })

  it('flags pieces too big for the sheet in any orientation', () => {
    const m = useBoxModel(t)
    expect(m.tooBigPieces.value).toHaveLength(0)
    m.W.value = 3000
    m.H.value = 3000
    expect(m.tooBigPieces.value.length).toBeGreaterThan(0)
  })

  it('pieceData resolves every layout label to a cut path', () => {
    const m = useBoxModel(t)
    m.NShelves.value = 2
    m.Bevel.value = 25
    for (const p of m.cuttingSheets.value.flat()) {
      const pd = m.pieceData(p.label)
      expect(pd.path.startsWith('M')).toBe(true)
      expect(pd.ow).toBeGreaterThan(0)
      expect(pd.oh).toBeGreaterThan(0)
      // the placement is the piece either as-is or rotated
      const asIs = Math.abs(p.w - pd.ow) < 1 && Math.abs(p.h - pd.oh) < 1
      const rotated = Math.abs(p.w - pd.oh) < 1 && Math.abs(p.h - pd.ow) < 1
      expect(asIs || rotated).toBe(true)
    }
  })

  it('getCutSheetTransform rotates 90deg only for rotated placements', () => {
    const m = useBoxModel(t)
    for (const p of m.cuttingSheets.value.flat()) {
      const pd = m.pieceData(p.label)
      const rotated = Math.abs(p.w - pd.oh) < 1 && Math.abs(p.h - pd.ow) < 1
      const tf = m.getCutSheetTransform(p)
      expect(tf.includes('rotate(90)')).toBe(rotated)
    }
  })
})
