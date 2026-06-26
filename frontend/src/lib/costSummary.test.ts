import { describe, it, expect } from 'vitest'
import { computeCostSummary } from './costSummary'
import type { CuttingResult, Sheet } from '@/services/types'

function sheet(index: number, parts: number, used: number, total: number): Sheet {
  return {
    index, width: 2440, height: 1220,
    usedArea: used, totalArea: total, efficiency: total > 0 ? (used / total) * 100 : 0,
    placedPieces: Array.from({ length: parts }, (_, i) => ({
      source: { id: `p${i}`, label: '', width: 100, height: 100, quantity: 1, allowRotation: true, color: '#fff' },
      x: 0, y: 0, width: 100, height: 100, isRotated: false,
    })),
  }
}

function result(sheets: Sheet[]): CuttingResult {
  const totalUsedArea = sheets.reduce((n, s) => n + s.usedArea, 0)
  const totalArea = sheets.reduce((n, s) => n + s.totalArea, 0)
  return {
    sheets, unplacedPieces: [], strategy: 0 as any,
    totalSheets: sheets.length, totalUsedArea, totalArea,
    overallEfficiency: totalArea > 0 ? (totalUsedArea / totalArea) * 100 : 0,
  }
}

describe('computeCostSummary', () => {
  it('multiplies sheets by price and splits cost across placed parts', () => {
    const r = result([sheet(0, 4, 600, 1000), sheet(1, 2, 500, 1000)])
    const s = computeCostSummary(r, 50)
    expect(s.sheetsUsed).toBe(2)
    expect(s.partsPlaced).toBe(6)
    expect(s.totalCost).toBe(100)
    expect(s.costPerPart).toBeCloseTo(100 / 6)
  })

  it('reports utilization and the cost of waste', () => {
    const r = result([sheet(0, 1, 700, 1000)])
    const s = computeCostSummary(r, 80)
    expect(s.usedFraction).toBeCloseTo(0.7)
    expect(s.wasteFraction).toBeCloseTo(0.3)
    expect(s.wasteCost).toBeCloseTo(80 * 0.3)
  })

  it('zero price yields zero costs but still reports utilization', () => {
    const r = result([sheet(0, 2, 800, 1000)])
    const s = computeCostSummary(r, 0)
    expect(s.totalCost).toBe(0)
    expect(s.costPerPart).toBe(0)
    expect(s.wasteCost).toBe(0)
    expect(s.usedFraction).toBeCloseTo(0.8)
  })

  it('treats a negative or non-finite price as no price', () => {
    const r = result([sheet(0, 1, 500, 1000)])
    expect(computeCostSummary(r, -10).totalCost).toBe(0)
    expect(computeCostSummary(r, NaN).totalCost).toBe(0)
  })

  it('does not divide by zero when nothing is placed', () => {
    const r = result([])
    const s = computeCostSummary(r, 50)
    expect(s.partsPlaced).toBe(0)
    expect(s.costPerPart).toBe(0)
    expect(s.usedFraction).toBe(0)
    expect(s.wasteFraction).toBe(1)
  })
})
