import { describe, expect, it } from 'vitest'
import {
  cuboidTriangles, hookColumns, hookRows, skadisBox, skadisBoxStl, skadisBoxTriangles, skadisBoxVariants,
  type SkadisBoxSettings,
} from './box'

const base: SkadisBoxSettings = {
  width: 86,
  height: 60,
  depth: 60,
  wall: 2,
  floor: 2,
  frontHeight: 60,
  dividers: 0,
  hookWidth: 4.4,
  hookEveryColumn: false,
  hookRows: 1,
  hookTop: 3,
  neckHeight: 8,
  lipRise: 5,
  lipDepth: 4,
  clearance: 0.4,
  boardThickness: 5,
  slotWidth: 5,
  slotHeight: 15,
  pitch: 40,
}

const part = (s: SkadisBoxSettings, id: string) => skadisBox(s).parts.filter(p => p.id === id)

describe('SKADIS printable box', () => {
  it('places hooks on slot columns symmetric about the centre', () => {
    expect(hookColumns(base)).toEqual([3, 83])
    expect(hookColumns({ ...base, hookEveryColumn: true, width: 126 })).toEqual([3, 43, 83, 123])
    expect(hookColumns({ ...base, width: 40 })).toEqual([20])
    expect(skadisBox({ ...base, width: 40 }).warnings).toContain('single_hook_column')
  })

  it('builds a shell of touching, non-overlapping cuboids', () => {
    const model = skadisBox(base)
    expect(model.parts.map(p => p.id)).toEqual(['floor', 'left', 'right', 'back', 'front', 'neck', 'lip', 'neck', 'lip'])
    expect(part(base, 'floor')[0]).toMatchObject({ min: [0, 0, 0], max: [86, 60, 2] })
    expect(part(base, 'left')[0]).toMatchObject({ min: [0, 0, 2], max: [2, 60, 60] })
    expect(part(base, 'back')[0]).toMatchObject({ min: [2, 58, 2], max: [84, 60, 60] })
    expect(part(base, 'front')[0]).toMatchObject({ min: [2, 0, 2], max: [84, 2, 60] })
    expect(model.volume).toBeCloseTo(86 * 60 * 2 + 2 * 2 * 60 * 58 + 82 * 2 * 58 * 2 + 2 * (4.4 * 5.8 * 8 + 4.4 * 4 * 13), 3)
  })

  it('grows the hook neck through the board and the lip up behind it', () => {
    const [neck] = part(base, 'neck')
    const [lip] = part(base, 'lip')
    expect(hookRows(base)).toEqual([[44, 52]])
    expect(neck).toMatchObject({ min: [0.8, 60, 44], max: [5.2, 65.8, 52] })
    expect(lip).toMatchObject({ min: [0.8, 65.8, 44], max: [5.2, 69.8, 57] })
    expect(skadisBox(base).totalDepth).toBe(69.8)
  })

  it('stacks hook rows every two grid rows and drops rows that hit the floor', () => {
    expect(hookRows({ ...base, hookRows: 2, height: 140 })).toEqual([[124, 132], [44, 52]])
    const cramped = skadisBox({ ...base, hookRows: 2 })
    expect(cramped.hookRows).toHaveLength(1)
    expect(cramped.warnings).toContain('hooks_vs_height')
  })

  it('supports the shelf, low-front and divider variants', () => {
    const shelf = skadisBox({ ...base, ...skadisBoxVariants.shelf })
    expect(shelf.parts.some(p => p.id === 'front')).toBe(false)

    const bin = skadisBox({ ...base, ...skadisBoxVariants.bin })
    expect(part({ ...base, ...skadisBoxVariants.bin }, 'front')[0].max[2]).toBe(37)

    const organizer = skadisBox({ ...base, ...skadisBoxVariants.organizer })
    const dividers = organizer.parts.filter(p => p.id === 'divider')
    expect(dividers).toHaveLength(2)
    // Inner width 122 split in three: divider centres at 2 + 40.667 and 2 + 81.333.
    expect(dividers[0].min[0]).toBeCloseTo(42.6667 - 1, 3)
    expect(dividers[0].min[1]).toBe(2)
    expect(dividers[0].max[1]).toBe(58)
  })

  it('warns when the hook cannot pass the slot or dividers do not fit', () => {
    expect(skadisBox({ ...base, hookWidth: 4.8 }).warnings).toContain('hook_vs_slot_width')
    expect(skadisBox({ ...base, neckHeight: 10, lipRise: 6 }).warnings).toContain('hook_vs_slot_height')
    expect(skadisBox({ ...base, width: 20, dividers: 5 }).warnings).toContain('dividers_vs_width')
    expect(skadisBox({ ...base, height: 2 }).parts).toEqual([])
    expect(skadisBox({ ...base, depth: Number.NaN }).parts).toEqual([])
  })

  it('triangulates every cuboid with outward-facing faces', () => {
    const tris = cuboidTriangles({ id: 'floor', min: [0, 0, 0], max: [1, 2, 3] })
    expect(tris).toHaveLength(12 * 9)
    // Top face triangle normal must point +z.
    const [ax, ay, az, bx, by, bz, cx, cy, cz] = tris.slice(18, 27)
    const nz = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax)
    expect(nz).toBeGreaterThan(0)
    expect(skadisBoxTriangles(skadisBox(base))).toHaveLength(9 * 12 * 9)
  })

  it('writes a binary STL with one record per triangle', () => {
    const stl = skadisBoxStl(base)
    const view = new DataView(stl)
    const count = view.getUint32(80, true)
    expect(count).toBe(9 * 12)
    expect(stl.byteLength).toBe(84 + count * 50)
    // First triangle is the floor bottom; its normal points -z.
    expect(view.getFloat32(84 + 8, true)).toBe(-1)
  })
})
