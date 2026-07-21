/**
 * Persisted state for the cutting optimizer page (Home.vue), with a schema
 * version and validation so a stale, partial or tampered localStorage value
 * can't crash the page or load nonsense (NaN, negative sizes, bad pieces).
 */
import type { CutPiece } from '@/services/types'
import { MAX_TOTAL_QUANTITY, normalizeQuantity } from './optimizerLimits'
import { claimPieceId } from './pieceIdentity'

export const HOME_STATE_KEY = 'home_state'
const VERSION = 1
// Bounds on untrusted input (a share-link hash or localStorage value is fully
// attacker-controllable). Without these a crafted payload can carry a multi-MB
// label or hundreds of thousands of pieces and freeze the tab (memory DoS).
const MAX_LABEL = 200
const MAX_PIECES = 1000
// Currency is rendered into the UI; allow only letters, currency symbols, and a
// dot so a crafted value cannot inject control or bidi-override characters.
const CURRENCY_RE = /^[\p{L}\p{Sc}.]{1,3}$/u

export interface HomeState {
  sheetWidth: number
  sheetHeight: number
  kerf: number
  pieces: CutPiece[]
  /** Price of one stock sheet, in `currency` units. 0 means "no costing". */
  pricePerSheet: number
  /** Display symbol for the price (e.g. ₽, $, €). Bounded to keep it a symbol. */
  currency: string
}

export const DEFAULT_HOME_SETTINGS: Omit<HomeState, 'pieces'> = {
  sheetWidth: 2440,
  sheetHeight: 1220,
  kerf: 3,
  pricePerSheet: 0,
  currency: '₽',
}

export function isDefaultHomeState(state: HomeState): boolean {
  return state.pieces.length === 0
    && state.sheetWidth === DEFAULT_HOME_SETTINGS.sheetWidth
    && state.sheetHeight === DEFAULT_HOME_SETTINGS.sheetHeight
    && state.kerf === DEFAULT_HOME_SETTINGS.kerf
    && state.pricePerSheet === DEFAULT_HOME_SETTINGS.pricePerSheet
    && state.currency === DEFAULT_HOME_SETTINGS.currency
}

export function serializeHomeState(state: HomeState): string {
  return JSON.stringify({ version: VERSION, ...state })
}

const isPosNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0
const isNonNegNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0
// A CSS hex color (#rgb / #rgba / #rrggbb / #rrggbbaa). This is the single trust
// boundary for untrusted state (localStorage + share-link hash), and `color`
// flows on into raw SVG `fill`, CSS `background`, and the SVG/print export — so
// reject anything that isn't plain hex here to keep markup-injection out of all
// of those sinks at once.
const isHexColor = (v: unknown): v is string =>
  typeof v === 'string' && /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(v)

function takeUnicodeScalars(value: string, maximum: number): string {
  let result = ''
  let count = 0
  for (const scalar of value) {
    if (count === maximum) break
    result += scalar
    count++
  }
  return result
}

function validPiece(p: any, usedIds: Set<string>, remainingQuantity = MAX_TOTAL_QUANTITY): CutPiece | null {
  if (!p || typeof p !== 'object') return null
  if (!isPosNum(p.width) || !isPosNum(p.height)) return null
  const quantity = Math.min(normalizeQuantity(p.quantity), remainingQuantity)
  if (quantity <= 0) return null
  const piece: CutPiece = {
    id: claimPieceId(p.id, usedIds),
    label: typeof p.label === 'string' ? takeUnicodeScalars(p.label, MAX_LABEL) : '',
    width: p.width,
    height: p.height,
    quantity,
    allowRotation: p.allowRotation !== false,
    color: isHexColor(p.color) ? p.color : '#4A90D9',
  }
  if (p.locked === true) piece.locked = true
  return piece
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

  const pieces: CutPiece[] = []
  if (Array.isArray(data.pieces)) {
    const usedIds = new Set<string>()
    let remainingQuantity = MAX_TOTAL_QUANTITY
    for (const rawPiece of data.pieces.slice(0, MAX_PIECES)) {
      if (remainingQuantity <= 0) break
      const piece = validPiece(rawPiece, usedIds, remainingQuantity)
      if (!piece) continue
      pieces.push(piece)
      remainingQuantity -= piece.quantity
    }
  }

  // Both costing fields are optional and back-compatible: a state saved before
  // costing existed simply gets the defaults, so no schema-version bump is needed.
  const pricePerSheet = isNonNegNum(data.pricePerSheet)
    ? data.pricePerSheet
    : DEFAULT_HOME_SETTINGS.pricePerSheet
  const rawCurrency = typeof data.currency === 'string' ? data.currency.trim().slice(0, 3) : ''
  const currency = CURRENCY_RE.test(rawCurrency) ? rawCurrency : DEFAULT_HOME_SETTINGS.currency

  return { sheetWidth: data.sheetWidth, sheetHeight: data.sheetHeight, kerf: data.kerf, pieces, pricePerSheet, currency }
}
