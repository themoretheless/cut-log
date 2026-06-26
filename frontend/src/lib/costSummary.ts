/**
 * Material cost + utilization summary for a cutting result. Pure and dependency
 * free so the arithmetic is unit-testable; the component supplies the price and
 * renders the numbers. A price of 0 yields zero costs but still reports
 * utilization, so the panel is meaningful even before a price is entered.
 */
import type { CuttingResult } from '@/services/types'

export interface CostSummary {
  sheetsUsed: number
  partsPlaced: number
  /** sheetsUsed * pricePerSheet. */
  totalCost: number
  /** totalCost / partsPlaced, or 0 when nothing was placed. */
  costPerPart: number
  /** Used material area / total sheet area, clamped to 0..1. */
  usedFraction: number
  /** 1 - usedFraction. */
  wasteFraction: number
  /** Share of the spend that ends up as offcut/waste. */
  wasteCost: number
}

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)

export function computeCostSummary(result: CuttingResult, pricePerSheet: number): CostSummary {
  const price = Number.isFinite(pricePerSheet) && pricePerSheet > 0 ? pricePerSheet : 0
  const sheetsUsed = result.totalSheets
  const partsPlaced = result.sheets.reduce((n, s) => n + s.placedPieces.length, 0)

  const totalCost = sheetsUsed * price
  const costPerPart = partsPlaced > 0 ? totalCost / partsPlaced : 0

  const usedFraction = result.totalArea > 0 ? clamp01(result.totalUsedArea / result.totalArea) : 0
  const wasteFraction = 1 - usedFraction
  const wasteCost = totalCost * wasteFraction

  return { sheetsUsed, partsPlaced, totalCost, costPerPart, usedFraction, wasteFraction, wasteCost }
}
