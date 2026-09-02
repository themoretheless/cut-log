import { describe, expect, it } from 'vitest'
import {
  fingerPositions, hookNecks, outerWidth, skadisBox, skadisBoxDxf, skadisBoxLayout, skadisBoxSvg,
  type Pt, type SkadisBoxSettings,
} from './box'

const base: SkadisBoxSettings = {
  slotSpan: 2,
  height: 80,
  depth: 60,
  thickness: 4,
  kerf: 0,
  tabSize: 10,
  hookRows: 1,
  hookTop: 3,
  neckHeight: 8,
  lipRise: 5,
  lipDepth: 4,
  clearance: 0.5,
  boardThickness: 5,
  slotWidth: 5,
  slotHeight: 15,
  pitch: 40,
}

const panel = (s: SkadisBoxSettings, id: string) => {
  const found = skadisBox(s).panels.find(p => p.id === id)
  if (!found) throw new Error(`missing panel ${id}`)
  return found
}

const has = (points: Pt[], x: number, y: number) => points.some(([px, py]) => Math.abs(px - x) < 1e-6 && Math.abs(py - y) < 1e-6)

describe('SKADIS box geometry', () => {
  it('spaces the side walls by whole slot pitches', () => {
    expect(outerWidth(base)).toBe(84)
    expect(skadisBox(base).hookSpacing).toBe(80)
    expect(skadisBox({ ...base, slotSpan: 1 }).outerWidth).toBe(44)
  })

  it('spreads finger tabs evenly with equal gaps', () => {
    expect(fingerPositions(76, 10)).toEqual([11.5, 33, 54.5])
    expect(fingerPositions(15, 10)).toEqual([2.5])
    expect(fingerPositions(0, 10)).toEqual([])
  })

  it('produces five panels whose sides reach past the board by neck and lip', () => {
    const model = skadisBox(base)
    expect(model.panels.map(p => p.id)).toEqual(['left', 'right', 'front', 'back', 'bottom'])
    const left = panel(base, 'left')
    // depth 60 + board 5 + 2 * clearance 0.5 + lip 4
    expect(left.width).toBe(70)
    expect(left.height).toBe(80)
    expect(panel(base, 'right').width).toBe(70)
    expect(panel(base, 'front')).toMatchObject({ width: 84, height: 76 })
    expect(panel(base, 'bottom')).toMatchObject({ width: 84, height: 60 })
  })

  it('cuts the hook lip above the neck so it catches behind the board', () => {
    const left = panel(base, 'left')
    const [neckTop, neckBottom] = hookNecks(base)[0]
    expect(neckTop).toBe(8)
    expect(neckBottom).toBe(16)
    expect(has(left.points, 60, 8)).toBe(true)      // neck starts on the back edge
    expect(has(left.points, 66, 3)).toBe(true)      // lip rises 5 mm above the neck behind the board
    expect(has(left.points, 70, 16)).toBe(true)     // lip bottom at full reach
  })

  it('mirrors the right side so both hooks point backwards after assembly', () => {
    const left = panel(base, 'left')
    const right = panel(base, 'right')
    expect(right.points).toHaveLength(left.points.length)
    expect(has(right.points, 70 - 66, 3)).toBe(true)
  })

  it('stacks extra hooks every two grid rows and warns when they leave the wall', () => {
    expect(hookNecks({ ...base, hookRows: 2, height: 200 })).toEqual([[8, 16], [88, 96]])
    const cramped = skadisBox({ ...base, hookRows: 2 })
    expect(cramped.warnings).toContain('hooks_vs_height')
    expect(cramped.panels.find(p => p.id === 'left')?.height).toBe(80)
    expect(skadisBox({ ...base, hookRows: 2, height: 200 }).warnings).toEqual([])
  })

  it('warns when the material or the hook cannot pass the slot', () => {
    expect(skadisBox({ ...base, thickness: 5 }).warnings).toContain('thickness_vs_slot')
    expect(skadisBox({ ...base, neckHeight: 10, lipRise: 6 }).warnings).toContain('hook_vs_slot_height')
    expect(skadisBox({ ...base, height: 8 }).warnings).toContain('too_small')
    expect(skadisBox({ ...base, height: Number.NaN }).panels).toEqual([])
  })

  it('keeps mating tabs and notches at the same positions', () => {
    const front = panel(base, 'front')
    const left = panel(base, 'left')
    // Front wall tab protrudes on its right edge at y = 11.5..21.5; the side has a notch at the same height.
    expect(has(front.points, 84, 11.5)).toBe(true)
    expect(has(front.points, 84, 21.5)).toBe(true)
    expect(has(left.points, 4, 11.5)).toBe(true)
    expect(has(left.points, 4, 21.5)).toBe(true)
  })

  it('widens tabs and narrows notches by the kerf', () => {
    const s = { ...base, kerf: 0.2 }
    expect(has(panel(s, 'front').points, 84, 11.4)).toBe(true)
    expect(has(panel(s, 'left').points, 4, 11.6)).toBe(true)
  })

  it('lays panels out in two non-overlapping rows', () => {
    const layout = skadisBoxLayout(skadisBox(base))
    expect(layout.placed.map(p => [p.id, p.x, p.y])).toEqual([
      ['left', 0, 0], ['right', 76, 0], ['front', 0, 86], ['back', 90, 86], ['bottom', 180, 86],
    ])
    expect(layout.width).toBe(264)
    expect(layout.height).toBe(162)
  })

  it('exports millimetre SVG and DXF with one closed contour per panel', () => {
    const svg = skadisBoxSvg(base)
    expect(svg).toContain('width="264mm" height="162mm"')
    expect([...svg.matchAll(/<path id="(\w+)" data-cut-order="(\d+)"/g)].map(m => m[1])).toEqual(['left', 'right', 'front', 'back', 'bottom'])
    expect(svg).toMatch(/d="M0,0 L[^"]* Z"/)

    const dxf = skadisBoxDxf(base)
    expect(dxf).toContain('$INSUNITS\n70\n4')
    expect(dxf.match(/LWPOLYLINE/g)).toHaveLength(5)
    expect(dxf.endsWith('0\nEOF\n')).toBe(true)
  })
})
