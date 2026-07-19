import { describe, it, expect } from 'vitest'
import { nextTick } from 'vue'
import { useBoxModel } from './useBoxModel'

const labels = {
  sideShort: 'side_short',
  topShort: 'top_short',
  bottomShort: 'bottom_short',
  backShort: 'back_short',
  shelfShort: 'shelf_short',
  sideWall: 'side_wall',
  topBottomWall: 'top_bottom_wall',
  backWall: 'back_wall',
  shelf: 'shelf',
}

describe('useBoxModel', () => {
  it('lists 5 pieces sorted by area desc with defaults (no shelves)', () => {
    const m = useBoxModel(labels)
    const pieces = m.allPieces()
    expect(pieces).toHaveLength(5)
    const areas = pieces.map(p => p.w * p.h)
    expect([...areas].sort((a, b) => b - a)).toEqual(areas)
    // back wall (300x400) is the largest
    expect(pieces[0].label).toBe('back_short')
  })

  it('adds shelves with per-shelf depth under bevel', () => {
    const m = useBoxModel(labels)
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
    const m = useBoxModel(labels)
    expect(m.galPieces.value.map(p => p.id)).toEqual(['side', 'tb', 'back'])
    m.Bevel.value = 40
    expect(m.galPieces.value.map(p => p.id)).toEqual(['side', 'top', 'bot', 'back'])
    m.Bevel.value = 0
    m.NShelves.value = 3
    expect(m.galPieces.value.map(p => p.id)).toEqual(['side', 'tb', 'back', 'shelf'])
    expect(m.galPieces.value.at(-1)!.count).toBe(3)
  })

  it('clamps galIdx when the gallery list shrinks', async () => {
    const m = useBoxModel(labels)
    m.Bevel.value = 40
    m.NShelves.value = 3
    await nextTick()
    m.galIdx.value = m.galPieces.value.length - 1 // select the last piece (a shelf)
    expect(m.galIdx.value).toBeGreaterThan(3)
    m.Bevel.value = 0
    m.NShelves.value = 0 // gallery shrinks back to [side, tb, back]
    await nextTick()
    expect(m.galPieces.value.length).toBe(3)
    expect(m.galIdx.value).toBe(2) // clamped to the new last index, not left dangling
  })

  it('computes cutting layout and stats reactively', () => {
    const m = useBoxModel(labels)
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
    const m = useBoxModel(labels)
    expect(m.tooBigPieces.value).toHaveLength(0)
    m.W.value = 3000
    m.H.value = 3000
    expect(m.tooBigPieces.value.length).toBeGreaterThan(0)
  })

  it('clamps interdependent parameters before geometry is generated', () => {
    const m = useBoxModel(labels)
    m.W.value = 50
    m.H.value = 50
    m.D.value = 50
    m.T.value = 500
    m.Bevel.value = 500
    m.NTab.value = 500
    m.NShelves.value = 500
    expect(m.Wi.value).toBeGreaterThan(0)
    expect(m.Hi.value).toBeGreaterThan(0)
    expect(m.TopD.value).toBeGreaterThan(0)
    expect(m.NTab.value).toBeLessThanOrEqual(m.paramLimits.value.maxTabs)
    expect(m.NShelves.value).toBeLessThanOrEqual(m.paramLimits.value.maxShelves)
  })

  it('pieceData resolves every stable layout source to a cut path', () => {
    const m = useBoxModel(labels)
    m.NShelves.value = 2
    m.Bevel.value = 25
    for (const p of m.cuttingSheets.value.flat()) {
      const pd = m.pieceData(p.sourceId)
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
    const m = useBoxModel(labels)
    for (const p of m.cuttingSheets.value.flat()) {
      const pd = m.pieceData(p.sourceId)
      const rotated = Math.abs(p.w - pd.oh) < 1 && Math.abs(p.h - pd.ow) < 1
      const tf = m.getCutSheetTransform(p)
      expect(tf.includes('rotate(90)')).toBe(rotated)
    }
  })

  it('shortens shelves and inner depth when the back wall is inset', () => {
    const m = useBoxModel(labels)
    m.NShelves.value = 2
    m.BackInset.value = 30
    expect(m.BackD.value).toBe(m.D.value - 30)
    const pieces = m.allPieces()
    const shelves = pieces.filter(p => p.label.startsWith('shelf_short'))
    expect(shelves).toHaveLength(2)
    for (const s of shelves) expect(s.h).toBe(m.D.value - 30)
    // the back wall piece itself keeps its full outer size
    const back = pieces.find(p => p.label === 'back_short')!
    expect(back.w).toBe(m.W.value)
    expect(back.h).toBe(m.H.value)
    // grouped shelf gallery entry reflects the shortened depth
    const gal = m.galPieces.value.find(p => p.id === 'shelf')!
    expect(gal.ph).toBe(m.D.value - 30)
  })

  it('clamps the back inset against depth and bevel', () => {
    const m = useBoxModel(labels)
    m.BackInset.value = 10_000
    expect(m.BackInset.value).toBeLessThanOrEqual(m.paramLimits.value.maxBackInset)
    expect(m.BackInset.value).toBeLessThan(m.D.value)
    m.Bevel.value = 100
    expect(m.D.value - m.BackInset.value - m.Bevel.value).toBeGreaterThan(0)
  })

  it('does not use translated labels as piece identity', () => {
    const sameLabels = Object.fromEntries(Object.keys(labels).map(key => [key, 'Part'])) as typeof labels
    const m = useBoxModel(sameLabels)
    const pieces = m.allPieces()

    expect(new Set(pieces.map(piece => piece.id)).size).toBe(pieces.length)
    expect(m.pieceData('top').oh).toBe(m.TopD.value)
    expect(m.pieceData('back').oh).toBe(m.H.value)
  })
})
