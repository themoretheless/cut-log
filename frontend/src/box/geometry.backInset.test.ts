import { describe, it, expect } from 'vitest'
import * as G from './geometry'

// Back-inset behaviour. The backInset=0 baseline is pinned by the golden
// fixtures (geometry.golden.test.ts); these tests cover the recessed case.
const base: G.BoxParams = {
  w: 300, h: 400, d: 200, t: 6, kerf: 0.1,
  tabH: 30, nTab: 1, nShelves: 0, bevel: 0, backInset: 0,
}
const inset: G.BoxParams = { ...base, backInset: 20 }

type Interval = [number, number]
const EPS = 1e-9

function intervalsFrom(values: number[]): Interval[] {
  const sorted = values.slice().sort((a, b) => a - b)
  const unique = sorted.filter((value, i) => i === 0 || Math.abs(value - sorted[i - 1]) > EPS)
  if (unique.length % 2 !== 0) throw new Error(`Expected interval endpoints, received ${unique.length}`)
  const intervals: Interval[] = []
  for (let i = 0; i < unique.length; i += 2) intervals.push([unique[i], unique[i + 1]])
  return intervals
}

function sideSlotIntervals(p: G.BoxParams): Interval[] {
  return G.sideHoles3D(p, 0).map((hole) => {
    const zs = hole.map(([, , z]) => z)
    return [Math.min(...zs), Math.max(...zs)]
  })
}

function backTabIntervals(p: G.BoxParams, x: number): Interval[] {
  return intervalsFrom(G.backPts3D(p, G.backD(p))
    .filter(([px]) => Math.abs(px - x) < 1e-9)
    .map(([, , z]) => z))
}

function backHorizontalTabIntervals(p: G.BoxParams, z: number): Interval[] {
  return intervalsFrom(G.backPts3D(p, G.backD(p))
    .filter(([, , pz]) => Math.abs(pz - z) < EPS)
    .map(([x]) => x))
}

function flushSideNotchIntervals(p: G.BoxParams): Interval[] {
  const notchDepth = p.d - G.tf(p)
  return intervalsFrom(G.sidePts3D(p, 0)
    .filter(([, y]) => Math.abs(y - notchDepth) < EPS)
    .map(([, , z]) => z))
}

function flushHorizontalNotchIntervals(p: G.BoxParams, z: number): Interval[] {
  const notchDepth = p.d - G.tf(p)
  return intervalsFrom(G.horizPts3D(p, z)
    .filter(([x, y]) => x > p.t && x < p.w - p.t && Math.abs(y - notchDepth) < EPS)
    .map(([x]) => x))
}

function shelfSlotIntervals(p: G.BoxParams, shelfZ: number): Interval[] {
  return G.sideHoles3D(p, 0)
    .filter((hole) => {
      const zs = hole.map(([, , z]) => z)
      return Math.abs(Math.min(...zs) - shelfZ) < EPS
        && Math.abs(Math.max(...zs) - shelfZ - G.tf(p)) < EPS
    })
    .map((hole) => {
      const ys = hole.map(([, y]) => y)
      return [Math.min(...ys), Math.max(...ys)]
    })
}

function shelfTabIntervals(p: G.BoxParams, shelfZ: number, x: number): Interval[] {
  const offset = G.shelfOffsetAt(p, shelfZ)
  const depth = G.shelfDepthAt(p, shelfZ)
  return intervalsFrom(G.shelfPts3D(p, shelfZ, depth, offset)
    .filter(([px]) => Math.abs(px - x) < EPS)
    .map(([, y]) => y))
}

function expectIntervals(actual: Interval[], expected: Interval[]) {
  expect(actual).toHaveLength(expected.length)
  actual.forEach(([start, end], i) => {
    expect(start).toBeCloseTo(expected[i][0], 9)
    expect(end).toBeCloseTo(expected[i][1], 9)
  })
}

describe('back wall inset', () => {
  it('keeps the back wall panel itself unchanged', () => {
    expect(G.pathBack(inset)).toBe(G.pathBack(base))
    expect(G.backD(inset)).toBe(180)
  })

  it('replaces the side wall rear-edge notches with through-slots', () => {
    const flat = G.pathSide(base)
    const recessed = G.pathSide(inset)
    // flat: notches cut into the rear edge at d - tf = 193.90
    expect(flat).toContain('193.90')
    expect(recessed).not.toContain('193.90')
    // recessed: one interior slot per height tab at u in [d-inset-tf, d-inset]
    expect(recessed).toContain(' M173.90,185.00 L180.00,185.00 L180.00,215.00 L173.90,215.00 Z')
  })

  it('replaces the top/bottom rear-edge notches with through-slots', () => {
    const flat = G.pathTopBottom(base)
    const recessed = G.pathTopBottom(inset)
    expect(flat).toContain('193.90')
    expect(recessed).not.toContain('193.90')
    expect(recessed).toContain(' M135.00,173.90 L165.00,173.90 L165.00,180.00 L135.00,180.00 Z')
  })

  it('adds matching 3D holes for the back tabs', () => {
    const sideHoles = G.sideHoles3D(inset, 0)
    expect(sideHoles).toHaveLength(inset.nTab)
    for (const hole of sideHoles)
      for (const [, y] of hole) {
        expect(y).toBeGreaterThanOrEqual(173.9 - 1e-9)
        expect(y).toBeLessThanOrEqual(180 + 1e-9)
      }
    const topHoles = G.horizHoles3D(inset, inset.h)
    expect(topHoles).toHaveLength(inset.nTab)
    for (const hole of topHoles)
      for (const [, y, z] of hole) {
        expect(z).toBe(inset.h)
        expect(y).toBeGreaterThanOrEqual(173.9 - 1e-9)
        expect(y).toBeLessThanOrEqual(180 + 1e-9)
      }
    // no holes at all when the back is flush
    expect(G.horizHoles3D(base, base.h)).toHaveLength(0)
  })

  it('shortens shelves so their rear tabs land in the recessed back', () => {
    const p = { ...inset, nShelves: 2 }
    const ys = G.shelfSlotYs(p)
    expect(ys.length).toBe(2)
    for (const sy of ys)
      expect(G.shelfDepthAt(p, sy)).toBe(G.shelfDepthAt({ ...base, nShelves: 2 }, sy) - 20)
    // default-depth shelf path ends at the recessed back plane
    expect(G.pathShelf(p)).toBe(G.pathShelf(p, G.backD(p), 0))
    // side-wall shelf slots stop at the recessed back plane
    for (const hole of G.sideHoles3D(p, 0).slice(0, -p.nTab))
      for (const [, y] of hole)
        expect(y).toBeLessThanOrEqual(G.backD(p) + 1e-9)
  })

  it('keeps the recessed back wall assembly-consistent with the side slots', () => {
    // back tab spans y in [backD - t, backD]; the side slot spans [backD - tf, backD]
    const pts = G.backPts3D(inset, G.backD(inset))
    for (const [, y] of pts) expect(y).toBe(180)
  })

  const jointCases = [
    { w: 220, h: 180, t: 3, kerf: 0, tabH: 12, backInset: 8 },
    { w: 300, h: 400, t: 6, kerf: 0.1, tabH: 30, backInset: 20 },
    { w: 520, h: 735, t: 12, kerf: 0.25, tabH: 38, backInset: 45 },
  ]

  for (const dimensions of jointCases) {
    for (let nTab = 1; nTab <= 8; nTab++) {
      it(`aligns side slots with both rear edges for h=${dimensions.h}, t=${dimensions.t}, inset=${dimensions.backInset}, nTab=${nTab}`, () => {
        const p: G.BoxParams = {
          ...base,
          ...dimensions,
          nTab,
          nShelves: 0,
        }
        const expected = G.tabPositions(p, G.hi(p)).map((z): Interval => [
          p.t + z,
          p.t + z + p.tabH,
        ])

        expectIntervals(sideSlotIntervals(p), expected)
        expectIntervals(backTabIntervals(p, 0), expected)
        expectIntervals(backTabIntervals(p, p.w), expected)
      })

      it(`aligns flush side and horizontal notches with rear tabs for w=${dimensions.w}, h=${dimensions.h}, nTab=${nTab}`, () => {
        const p: G.BoxParams = {
          ...base,
          ...dimensions,
          backInset: 0,
          nTab,
          nShelves: 0,
        }
        const vertical = G.tabPositions(p, G.hi(p)).map((z): Interval => [
          p.t + z,
          p.t + z + p.tabH,
        ])
        const horizontal = G.tabPositions(p, G.wi(p)).map((x): Interval => [
          p.t + x,
          p.t + x + p.tabH,
        ])

        expectIntervals(flushSideNotchIntervals(p), vertical)
        expectIntervals(backTabIntervals(p, 0), vertical)
        expectIntervals(backTabIntervals(p, p.w), vertical)
        expectIntervals(flushHorizontalNotchIntervals(p, 0), horizontal)
        expectIntervals(flushHorizontalNotchIntervals(p, p.h), horizontal)
        expectIntervals(backHorizontalTabIntervals(p, 0), horizontal)
        expectIntervals(backHorizontalTabIntervals(p, p.h), horizontal)
      })
    }
  }

  it('keeps a full-width material web between shelf slots and a recessed-back slot', () => {
    // Critic fixture: the fourth 30 mm shelf joint ended at 184 while the
    // recessed-back slot started at 178.9, so the two cuts overlapped by 5.1 mm.
    const p: G.BoxParams = {
      ...base,
      nTab: 4,
      nShelves: 1,
      backInset: 15,
    }
    const shelfZ = G.shelfSlotYs(p)[0]
    const backSlotStart = G.backD(p) - G.tf(p)
    const raw = G.tabPositions(p, p.d).map((start): Interval => [start, start + p.tabH])
    const expected = raw.filter(([, end]) => end <= backSlotStart - G.tf(p))

    expect(raw.some(([, end]) => end > backSlotStart)).toBe(true)
    expectIntervals(shelfSlotIntervals(p, shelfZ), expected)
    expectIntervals(shelfTabIntervals(p, shelfZ, 0), expected)
    expectIntervals(shelfTabIntervals(p, shelfZ, p.w), expected)
    for (const [, end] of expected)
      expect(backSlotStart - end).toBeGreaterThanOrEqual(G.tf(p) - EPS)

    const sidePath = G.pathSide(p)
    for (const [start, end] of expected)
      expect(sidePath).toContain(` M${start.toFixed(2)},${shelfZ.toFixed(2)} L${end.toFixed(2)},${shelfZ.toFixed(2)}`)
    for (const [start, end] of raw.filter((interval) => !expected.includes(interval)))
      expect(sidePath).not.toContain(` M${start.toFixed(2)},${shelfZ.toFixed(2)} L${end.toFixed(2)},${shelfZ.toFixed(2)}`)
  })

  it('preserves the centred nTab=1 joint geometry', () => {
    const expected: Interval[] = [[(inset.h - inset.tabH) / 2, (inset.h + inset.tabH) / 2]]
    expectIntervals(sideSlotIntervals(inset), expected)
    expectIntervals(backTabIntervals(inset, 0), expected)
    expectIntervals(backTabIntervals(inset, inset.w), expected)
  })
})
