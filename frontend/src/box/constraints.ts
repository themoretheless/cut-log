import type { BoxParams } from './geometry'

const MIN_OUTER_SIZE = 50
const MIN_THICKNESS = 1
const MIN_TAB_SIZE = 1
const MIN_TAB_GAP = 0.5

const finite = (value: number, fallback: number): number => Number.isFinite(value) ? value : fallback
const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))

export interface BoxParamLimits {
  maxThickness: number
  maxAbsBevel: number
  maxBackInset: number
  maxKerf: number
  maxTabSize: number
  maxTabs: number
  maxShelves: number
}

export function boxParamLimits(input: BoxParams): BoxParamLimits {
  const w = Math.max(MIN_OUTER_SIZE, finite(input.w, MIN_OUTER_SIZE))
  const h = Math.max(MIN_OUTER_SIZE, finite(input.h, MIN_OUTER_SIZE))
  const d = Math.max(MIN_OUTER_SIZE, finite(input.d, MIN_OUTER_SIZE))
  const maxThickness = Math.max(MIN_THICKNESS, Math.min(w, h, d) / 2 - 0.5)
  const t = clamp(finite(input.t, MIN_THICKNESS), MIN_THICKNESS, maxThickness)
  const maxKerf = Math.max(0, Math.min(w - 2 * t, h - 2 * t, d) / 4)
  const kerf = clamp(finite(input.kerf, 0), 0, maxKerf)
  const shortestTabbedEdge = Math.max(MIN_TAB_SIZE, Math.min(w - 2 * t, h - 2 * t, d))
  const maxTabSize = Math.max(MIN_TAB_SIZE, shortestTabbedEdge - 2 * MIN_TAB_GAP)
  const tabH = clamp(finite(input.tabH, MIN_TAB_SIZE), MIN_TAB_SIZE, maxTabSize)
  const maxTabs = Math.max(1, Math.floor((shortestTabbedEdge - MIN_TAB_GAP) / (tabH + MIN_TAB_GAP)))
  const shelfPitch = Math.max(1, t + kerf)
  const maxShelves = Math.max(0, Math.floor((h - 2 * t) / shelfPitch) - 1)
  const maxAbsBevel = Math.max(0, d - 1)
  // The recessed back's through-slots must stay clear of the bevel clip and
  // leave the shelves a usable depth, so the bevel is subtracted first.
  const bevel = clamp(finite(input.bevel, 0), -maxAbsBevel, maxAbsBevel)
  const maxBackInset = Math.max(0, d - Math.abs(bevel) - (t + kerf) - MIN_TAB_GAP)

  return {
    maxThickness,
    maxAbsBevel,
    maxBackInset,
    maxKerf,
    maxTabSize,
    maxTabs,
    maxShelves,
  }
}

export function clampBoxParams(input: BoxParams): BoxParams {
  const w = Math.max(MIN_OUTER_SIZE, finite(input.w, MIN_OUTER_SIZE))
  const h = Math.max(MIN_OUTER_SIZE, finite(input.h, MIN_OUTER_SIZE))
  const d = Math.max(MIN_OUTER_SIZE, finite(input.d, MIN_OUTER_SIZE))
  const base = { ...input, w, h, d }
  const first = boxParamLimits(base)
  const t = clamp(finite(input.t, MIN_THICKNESS), MIN_THICKNESS, first.maxThickness)
  const kerf = clamp(finite(input.kerf, 0), 0, first.maxKerf)
  const withMaterial = { ...base, t, kerf }
  const limits = boxParamLimits(withMaterial)

  return {
    ...withMaterial,
    tabH: clamp(finite(input.tabH, MIN_TAB_SIZE), MIN_TAB_SIZE, limits.maxTabSize),
    nTab: clamp(Math.round(finite(input.nTab, 1)), 1, limits.maxTabs),
    nShelves: clamp(Math.round(finite(input.nShelves, 0)), 0, limits.maxShelves),
    bevel: clamp(finite(input.bevel, 0), -limits.maxAbsBevel, limits.maxAbsBevel),
    backInset: clamp(finite(input.backInset, 0), 0, limits.maxBackInset),
  }
}
