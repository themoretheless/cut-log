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
  staggered: true,
}

describe('SKADIS geometry', () => {
  it('builds a staggered 40 mm grid inside the margin', () => {
    const slots = skadisSlots(standard)
    expect(slots.slice(0, 10)).toEqual([
      { x: 20, y: 20 }, { x: 60, y: 20 }, { x: 100, y: 20 }, { x: 140, y: 20 },
      { x: 180, y: 20 }, { x: 220, y: 20 }, { x: 260, y: 20 }, { x: 300, y: 20 },
      { x: 340, y: 20 }, { x: 40, y: 60 },
    ])
    expect(slots).toHaveLength(119)
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
