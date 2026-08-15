// @vitest-environment happy-dom
// Runes need the client build of Svelte, which Vitest only resolves for a
// browser-like environment; the model itself touches no DOM.
import { describe, it, expect, afterEach } from 'vitest'
import { useBoxModel } from './useBoxModel.svelte'

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

// $derived needs an owning reactive context, which $effect.root provides
// outside a component. Each test gets its own root, torn down afterwards.
const cleanups: Array<() => void> = []

function createModel(source: typeof labels = labels) {
  let model!: ReturnType<typeof useBoxModel>
  const stop = $effect.root(() => { model = useBoxModel(source) })
  cleanups.push(stop)
  return model
}

afterEach(() => {
  while (cleanups.length) cleanups.pop()!()
})

describe('useBoxModel', () => {
  it('lists 5 pieces sorted by area desc with defaults (no shelves)', () => {
    const m = createModel()
    const pieces = m.allPieces()
    expect(pieces).toHaveLength(5)
    const areas = pieces.map(p => p.w * p.h)
    expect([...areas].sort((a, b) => b - a)).toEqual(areas)
    // back wall (300x400) is the largest
    expect(pieces[0].label).toBe('back_short')
  })

  it('adds shelves with per-shelf depth under bevel', () => {
    const m = createModel()
    m.NShelves = 2
    m.Bevel = 30
    const pieces = m.allPieces()
    expect(pieces).toHaveLength(7)
    const shelves = pieces.filter(p => p.label.startsWith('shelf_short'))
    expect(shelves).toHaveLength(2)
    // beveled shelves have different depths
    expect(shelves[0].h).not.toBe(shelves[1].h)
  })

  it('groups gallery as side/tb/back when flat, splits top/bot when beveled', () => {
    const m = createModel()
    expect(m.galPieces.map(p => p.id)).toEqual(['side', 'tb', 'back'])
    m.Bevel = 40
    expect(m.galPieces.map(p => p.id)).toEqual(['side', 'top', 'bot', 'back'])
    m.Bevel = 0
    m.NShelves = 3
    expect(m.galPieces.map(p => p.id)).toEqual(['side', 'tb', 'back', 'shelf'])
    expect(m.galPieces.at(-1)!.count).toBe(3)
  })

  it('clamps galIdx when the gallery list shrinks', () => {
    const m = createModel()
    m.Bevel = 40
    m.NShelves = 3
    m.galIdx = m.galPieces.length - 1 // select the last piece (a shelf)
    expect(m.galIdx).toBeGreaterThan(3)
    m.Bevel = 0
    m.NShelves = 0 // gallery shrinks back to [side, tb, back]
    expect(m.galPieces.length).toBe(3)
    expect(m.galIdx).toBe(2) // clamped to the new last index, not left dangling
  })

  it('computes cutting layout and stats reactively', () => {
    const m = createModel()
    const sheets = m.cuttingSheets
    expect(sheets.length).toBeGreaterThan(0)
    expect(m.cutStats.sheets).toBe(sheets.length)
    const placed = sheets.flat()
    expect(placed).toHaveLength(5)
    // every placement carries a piece label and stays inside the sheet
    for (const p of placed) {
      expect(p.label).toBeTruthy()
      expect(p.x + p.w).toBeLessThanOrEqual(m.SheetW)
      expect(p.y + p.h).toBeLessThanOrEqual(m.SheetH)
    }
    // shrinking the sheet forces more sheets or unplaceable pieces
    m.SheetW = 320
    m.SheetH = 420
    expect(m.cuttingSheets.length).toBeGreaterThanOrEqual(sheets.length)
  })

  it('flags pieces too big for the sheet in any orientation', () => {
    const m = createModel()
    expect(m.tooBigPieces).toHaveLength(0)
    m.W = 3000
    m.H = 3000
    expect(m.tooBigPieces.length).toBeGreaterThan(0)
  })

  it('clamps interdependent parameters before geometry is generated', () => {
    const m = createModel()
    m.W = 50
    m.H = 50
    m.D = 50
    m.T = 500
    m.Bevel = 500
    m.NTab = 500
    m.NShelves = 500
    expect(m.Wi).toBeGreaterThan(0)
    expect(m.Hi).toBeGreaterThan(0)
    expect(m.TopD).toBeGreaterThan(0)
    expect(m.NTab).toBeLessThanOrEqual(m.paramLimits.maxTabs)
    expect(m.NShelves).toBeLessThanOrEqual(m.paramLimits.maxShelves)
  })

  it('pieceData resolves every stable layout source to a cut path', () => {
    const m = createModel()
    m.NShelves = 2
    m.Bevel = 25
    for (const p of m.cuttingSheets.flat()) {
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
    const m = createModel()
    for (const p of m.cuttingSheets.flat()) {
      const pd = m.pieceData(p.sourceId)
      const rotated = Math.abs(p.w - pd.oh) < 1 && Math.abs(p.h - pd.ow) < 1
      const tf = m.getCutSheetTransform(p)
      expect(tf.includes('rotate(90)')).toBe(rotated)
    }
  })

  it('shortens shelves and inner depth when the back wall is inset', () => {
    const m = createModel()
    m.NShelves = 2
    m.BackInset = 30
    expect(m.BackD).toBe(m.D - 30)
    const pieces = m.allPieces()
    const shelves = pieces.filter(p => p.label.startsWith('shelf_short'))
    expect(shelves).toHaveLength(2)
    for (const s of shelves) expect(s.h).toBe(m.D - 30)
    // the back wall piece itself keeps its full outer size
    const back = pieces.find(p => p.label === 'back_short')!
    expect(back.w).toBe(m.W)
    expect(back.h).toBe(m.H)
    // grouped shelf gallery entry reflects the shortened depth
    const gal = m.galPieces.find(p => p.id === 'shelf')!
    expect(gal.ph).toBe(m.D - 30)
  })

  it('clamps the back inset against depth and bevel', () => {
    const m = createModel()
    expect(m.paramLimits.minBackInset).toBeCloseTo(m.TF)
    const minInset = m.paramLimits.minBackInset
    expect(m.backInsetStep).toBeCloseTo(minInset)
    m.BackInset += m.backInsetStep
    expect(m.BackInset).toBeCloseTo(minInset)
    expect(m.backInsetStep).toBeCloseTo(minInset)
    m.BackInset -= m.backInsetStep
    expect(m.BackInset).toBe(0)
    m.BackInset = minInset + 1
    expect(m.backInsetStep).toBe(1)
    m.BackInset = 1
    expect(m.BackInset).toBeCloseTo(minInset)
    m.BackInset = 10_000
    expect(m.BackInset).toBeLessThanOrEqual(m.paramLimits.maxBackInset)
    expect(m.BackInset).toBeLessThan(m.D)
    m.Bevel = 100
    expect(m.D - m.BackInset - m.Bevel).toBeGreaterThan(0)
  })

  it('does not use translated labels as piece identity', () => {
    const sameLabels = Object.fromEntries(Object.keys(labels).map(key => [key, 'Part'])) as typeof labels
    const m = createModel(sameLabels)
    const pieces = m.allPieces()

    expect(new Set(pieces.map(piece => piece.id)).size).toBe(pieces.length)
    expect(m.pieceData('top').oh).toBe(m.TopD)
    expect(m.pieceData('back').oh).toBe(m.H)
  })
})
