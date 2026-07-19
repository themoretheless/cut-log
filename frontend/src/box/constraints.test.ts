import { describe, expect, it } from 'vitest'
import { boxParamLimits, clampBoxParams } from './constraints'
import type { BoxParams } from './geometry'

const defaults: BoxParams = {
  w: 300, h: 400, d: 200, t: 6, kerf: 0.1,
  tabH: 30, nTab: 1, nShelves: 0, bevel: 0, backInset: 0,
}

describe('box parameter constraints', () => {
  it('preserves a valid parameter set', () => {
    expect(clampBoxParams(defaults)).toEqual(defaults)
  })

  it('keeps derived inner dimensions and bevel depths positive', () => {
    const safe = clampBoxParams({
      ...defaults, w: 50, h: 50, d: 50, t: 999, bevel: 999,
      tabH: 999, nTab: 999, nShelves: 999,
    })
    expect(safe.w - 2 * safe.t).toBeGreaterThan(0)
    expect(safe.h - 2 * safe.t).toBeGreaterThan(0)
    expect(safe.d - Math.abs(safe.bevel)).toBeGreaterThan(0)
    expect(safe.d - safe.t).toBeGreaterThan(0)
    const limits = boxParamLimits(safe)
    expect(safe.nTab).toBeLessThanOrEqual(limits.maxTabs)
    expect(safe.nShelves).toBeLessThanOrEqual(limits.maxShelves)
  })

  it('uses depth when limiting thickness and preserves positive tab gaps', () => {
    const safe = clampBoxParams({
      ...defaults, w: 500, h: 500, d: 50, t: 999, tabH: 999, nTab: 999,
    })
    const shortestEdge = Math.min(safe.w - 2 * safe.t, safe.h - 2 * safe.t, safe.d)
    const gap = (shortestEdge - safe.nTab * safe.tabH) / (safe.nTab + 1)

    expect(safe.t).toBeLessThan(safe.d / 2)
    expect(gap).toBeGreaterThanOrEqual(0.5)
  })

  it('normalizes non-finite values and integer counts', () => {
    const safe = clampBoxParams({ ...defaults, kerf: Number.NaN, nTab: 2.7, nShelves: 1.6 })
    expect(safe.kerf).toBe(0)
    expect(Number.isInteger(safe.nTab)).toBe(true)
    expect(Number.isInteger(safe.nShelves)).toBe(true)
  })

  it('clamps the back inset to a non-negative usable range', () => {
    expect(clampBoxParams({ ...defaults, backInset: -10 }).backInset).toBe(0)
    expect(clampBoxParams({ ...defaults, backInset: Number.NaN }).backInset).toBe(0)
    const limits = boxParamLimits(defaults)
    const safe = clampBoxParams({ ...defaults, backInset: 999 })
    expect(safe.backInset).toBe(limits.maxBackInset)
    // the recessed back must still leave room in front of it
    expect(safe.d - safe.backInset - (safe.t + safe.kerf)).toBeGreaterThan(0)
  })

  it('shrinks the back-inset limit when a bevel eats into the depth', () => {
    const flat = boxParamLimits(defaults)
    const beveled = boxParamLimits({ ...defaults, bevel: 60 })
    expect(beveled.maxBackInset).toBe(flat.maxBackInset - 60)
    const safe = clampBoxParams({ ...defaults, bevel: 60, backInset: 999 })
    expect(safe.backInset).toBe(beveled.maxBackInset)
    // worst-case shelf keeps a positive depth: d - inset - |bevel| > 0
    expect(safe.d - safe.backInset - Math.abs(safe.bevel)).toBeGreaterThan(0)
  })
})
