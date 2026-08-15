import { describe, expect, it } from 'vitest'
import { ANNOTATION_INDENT, skadisDxf, skadisSeam, skadisSeamIsUniform, skadisSlots, skadisSvg, snapToUniformSeam, type SkadisSettings } from './geometry'

const standard: SkadisSettings = {
  width: 360,
  height: 560,
  cornerRadius: 8,
  slotWidth: 5,
  slotHeight: 15,
  pitch: 40,
  margin: 20,
  rowOffsetPercent: 50,
  columnOffsetPercent: 0,
}

describe('SKADIS geometry', () => {
  it('builds the standard 50% staggered grid inside the margin', () => {
    const slots = skadisSlots(standard)
    expect(slots.slice(0, 10)).toEqual([
      { x: 20, y: 20 }, { x: 60, y: 20 }, { x: 100, y: 20 }, { x: 140, y: 20 },
      { x: 180, y: 20 }, { x: 220, y: 20 }, { x: 260, y: 20 }, { x: 300, y: 20 },
      { x: 340, y: 20 }, { x: 40, y: 60 },
    ])
    expect(slots).toHaveLength(119)
  })

  it('centres the grid when the pitch does not divide the available span', () => {
    const slots = skadisSlots({ ...standard, width: 740, height: 740 })
    const ys = slots.map(slot => slot.y)
    const xs = slots.map(slot => slot.x)
    expect(Math.min(...ys)).toBe(30)
    expect(740 - Math.max(...ys)).toBe(30)
    expect(Math.min(...xs)).toBe(20)
    expect(740 - Math.max(...xs)).toBe(20)
  })

  it.each([
    [0, 20],
    [25, 30],
    [50, 40],
    [100, 60],
  ])('offsets every second row by %s%% of the pitch', (rowOffsetPercent, expectedX) => {
    const secondRow = skadisSlots({ ...standard, rowOffsetPercent }).find(slot => slot.y === 60)
    expect(secondRow?.x).toBe(expectedX)
  })

  it.each([
    [0, 20],
    [25, 30],
    [50, 40],
    [100, 60],
  ])('offsets every second column vertically by %s%% of the pitch', (columnOffsetPercent, expectedY) => {
    const firstRow = skadisSlots({ ...standard, rowOffsetPercent: 0, columnOffsetPercent })
    expect(firstRow.find(slot => slot.x === 60)?.y).toBe(expectedY)
  })

  it('clamps both offset percentages to the 0-100% range', () => {
    const below = skadisSlots({ ...standard, rowOffsetPercent: -10, columnOffsetPercent: -10 })
    const above = skadisSlots({ ...standard, rowOffsetPercent: 110, columnOffsetPercent: 110 })
    expect(below.find(slot => slot.y === 60)?.x).toBe(20)
    expect(below.find(slot => slot.x === 60)?.y).toBe(20)
    expect(above.find(slot => slot.y === 60)?.x).toBe(60)
    expect(above.find(slot => slot.x === 60)?.y).toBe(60)
    expect(new Set(above.map(slot => `${slot.x}:${slot.y}`)).size).toBe(above.length)
  })

  it('exports millimeter SVG with rounded 5 by 15 mm slots', () => {
    const svg = skadisSvg(standard)
    expect(svg).toContain('width="360mm" height="560mm"')
    expect(svg).toContain('<rect x="0" y="0" width="360" height="560" rx="8"')
    expect(svg).toContain('x="17.5" y="12.5" width="5" height="15" rx="2.5"')
  })

  it('exports an ASCII DXF using millimeters', () => {
    const dxf = skadisDxf(standard)
    expect(dxf).toContain('$INSUNITS\n70\n4')
    expect(dxf).toContain('SECTION\n2\nENTITIES')
    expect(dxf.endsWith('0\nEOF\n')).toBe(true)
  })

  it('reports a seam equal to the pitch when the grid continues across boards', () => {
    const seam = skadisSeam(standard)!
    expect(seam.horizontal).toBe(40)
    expect(seam.vertical).toBe(40)
    expect(skadisSeamIsUniform(standard)).toBe(true)
  })

  it('measures the seam inside one row, not across the staggered bounding box', () => {
    // The rows are offset by half a pitch, so the outermost slots of the grid
    // sit in different rows and never face each other across a joint.
    const seam = skadisSeam(standard)!
    const row = skadisSlots(standard).filter(slot => slot.y === seam.rowY).map(slot => slot.x)
    expect(Math.min(...row)).toBe(seam.rowLeft)
    expect(Math.max(...row)).toBe(seam.rowRight)
    expect(seam.horizontal).toBe(standard.width - seam.rowRight + seam.rowLeft)
  })

  it('detects a board size that breaks the pattern at the joint', () => {
    const wide = { ...standard, width: 380 }
    expect(skadisSeam(wide)!.horizontal).toBe(60)
    expect(skadisSeam(wide)!.vertical).toBe(40)
    expect(skadisSeamIsUniform(wide)).toBe(false)

    const tall = { ...standard, height: 590 }
    expect(skadisSeam(tall)!.vertical).toBe(70)
    expect(skadisSeamIsUniform(tall)).toBe(false)
  })

  it('snaps down to the nearest size with a uniform seam on both axes', () => {
    const snapped = snapToUniformSeam({ ...standard, width: 380, height: 590 })
    expect(snapped).toEqual({ width: 360, height: 560 })
    expect(skadisSeamIsUniform({ ...standard, ...snapped })).toBe(true)
  })

  it('leaves an already uniform board untouched', () => {
    expect(snapToUniformSeam(standard)).toEqual({ width: 360, height: 560 })
  })

  it('never snaps upwards', () => {
    for (const width of [361, 375, 399, 400]) {
      const snapped = snapToUniformSeam({ ...standard, width })
      expect(snapped.width).toBeLessThanOrEqual(width)
      expect(skadisSeamIsUniform({ ...standard, width: snapped.width })).toBe(true)
    }
  })

  it('leaves the board alone when no size can make the seam uniform', () => {
    // The seam is the sum of the two edge margins, so it can never be smaller
    // than 2 * margin. With a margin wider than half the pitch no board size
    // helps, and the snap must report that by changing nothing.
    const roomy = { ...standard, margin: 30, width: 400, height: 600 }
    expect(skadisSeam(roomy)!.horizontal).toBeGreaterThanOrEqual(2 * roomy.margin)
    expect(skadisSeamIsUniform(roomy)).toBe(false)
    expect(snapToUniformSeam(roomy)).toEqual({ width: 400, height: 600 })
  })

  it('snaps with a narrow margin that leaves the pattern room to line up', () => {
    const narrow = { ...standard, margin: 10, width: 383, height: 604 }
    const snapped = snapToUniformSeam(narrow)
    expect(skadisSeamIsUniform({ ...narrow, ...snapped })).toBe(true)
    expect(snapped.width).toBeLessThanOrEqual(383)
    expect(snapped.height).toBeLessThanOrEqual(604)
  })

  it('hangs the seam measurement clear of both edges, not near a corner', () => {
    const seam = skadisSeam(standard)!
    const rows = [...new Set(skadisSlots(standard).map(slot => slot.y))].sort((a, b) => a - b)
    // Only the line's position moves; the measured value stays the same.
    expect(seam.horizontal).toBe(40)
    expect(seam.rowY).toBeGreaterThan(rows[0])
    expect(seam.rowY).toBeLessThan(rows[rows.length - 1])

    const rowSlots = skadisSlots(standard).filter(slot => slot.y === seam.rowY).map(slot => slot.x).sort((a, b) => a - b)
    expect(seam.columnX).toBeGreaterThan(rowSlots[0])
    expect(seam.columnX).toBeLessThan(rowSlots[rowSlots.length - 1])
  })

  it('keeps the annotation indent available for single-board dimensions', () => {
    // The page hangs the pitch dimension this far in from the edge row.
    expect(ANNOTATION_INDENT).toBeGreaterThan(0)
  })

  it('falls back to what fits when the grid is too small to indent', () => {
    const tiny = { ...standard, width: 100, height: 100 }
    const seam = skadisSeam(tiny)!
    const rowSlots = skadisSlots(tiny).filter(slot => slot.y === seam.rowY).map(slot => slot.x)
    expect(rowSlots).toContain(seam.columnX)
    expect(Number.isFinite(seam.horizontal)).toBe(true)
  })
})
