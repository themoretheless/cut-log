import { describe, expect, it } from 'vitest'
import { skadisDxf, skadisSlots, skadisSvg, type SkadisSettings } from './geometry'

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
})
