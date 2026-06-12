/**
 * Persisted state for the cutting optimizer page (Home.vue), with a schema
 * version and validation so a stale, partial or tampered localStorage value
 * can't crash the page or load nonsense (NaN, negative sizes, bad pieces).
 */
import type { CutPiece } from '@/services/types'

export const HOME_STATE_KEY = 'home_state'
const VERSION = 1

export interface HomeState {
  sheetWidth: number
  sheetHeight: number
  kerf: number
  pieces: CutPiece[]
}

export function serializeHomeState(state: HomeState): string {
  return JSON.stringify({ version: VERSION, ...state })
}

const isPosNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0
const isNonNegNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0

function validPiece(p: any): CutPiece | null {
  if (!p || typeof p !== 'object') return null
  if (!isPosNum(p.width) || !isPosNum(p.height)) return null
  const quantity = Number.isFinite(p.quantity) ? Math.max(1, Math.round(p.quantity)) : 1
  return {
    id: typeof p.id === 'string' && p.id ? p.id : crypto.randomUUID(),
    label: typeof p.label === 'string' ? p.label : '',
    width: p.width,
    height: p.height,
    quantity,
    allowRotation: p.allowRotation !== false,
    color: typeof p.color === 'string' ? p.color : '#4A90D9',
  }
}

/**
 * Parse and validate a persisted value. Returns null for anything missing,
 * malformed, from another schema version, or failing range checks — the caller
 * then simply starts fresh.
 */
export function parseHomeState(raw: string | null): HomeState | null {
  if (!raw) return null
  let data: any
  try {
    data = JSON.parse(raw)
  } catch {
    return null
  }
  if (!data || data.version !== VERSION) return null
  if (!isPosNum(data.sheetWidth) || !isPosNum(data.sheetHeight) || !isNonNegNum(data.kerf)) return null

  const pieces = Array.isArray(data.pieces)
    ? data.pieces.map(validPiece).filter((p: CutPiece | null): p is CutPiece => p !== null)
    : []

  return { sheetWidth: data.sheetWidth, sheetHeight: data.sheetHeight, kerf: data.kerf, pieces }
}
