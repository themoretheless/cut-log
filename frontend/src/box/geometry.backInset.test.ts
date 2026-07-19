import { describe, it, expect } from 'vitest'
import * as G from './geometry'

// Back-inset behaviour. The backInset=0 baseline is pinned by the golden
// fixtures (geometry.golden.test.ts); these tests cover the recessed case.
const base: G.BoxParams = {
  w: 300, h: 400, d: 200, t: 6, kerf: 0.1,
  tabH: 30, nTab: 1, nShelves: 0, bevel: 0, backInset: 0,
}
const inset: G.BoxParams = { ...base, backInset: 20 }

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
})
