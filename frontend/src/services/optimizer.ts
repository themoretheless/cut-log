/**
 * Cutting optimizer — calls Rust WASM guillotine bin-packing algorithm.
 */
import type { CutPiece, CuttingResult, PlacedPiece, Sheet } from './types'
import { CuttingStrategy } from './types'
import { ensureWasm } from './rustService'
import { assertOptimizerCapacity, normalizeQuantity } from '@/lib/optimizerLimits'
import { assertStablePieceIds } from '@/lib/pieceIdentity'

// Shape of the JSON the Rust/WASM optimizer returns (snake_case, mirrors the
// serde structs). Validated at runtime before use, since it crosses a language
// boundary with no compile-time contract.
interface RawPlaced {
  source_id: string; source_label: string; source_color: string
  x: number; y: number; width: number; height: number; is_rotated: boolean
}
interface RawSheet {
  index: number; width: number; height: number
  used_area: number; total_area: number; efficiency: number
  placed_pieces: RawPlaced[]
}
interface RawUnplaced { source_id: string; label: string; width: number; height: number }
interface RawOutput {
  sheets: RawSheet[]; unplaced_pieces: RawUnplaced[]
  strategy: CuttingStrategy; auto_picked_strategy?: CuttingStrategy | null
  total_sheets: number; total_used_area: number; total_area: number; overall_efficiency: number
}

interface WasmErrorEnvelope {
  kind: 'validation' | 'protocol' | 'internal'
  code: string
  message: string
}

export class OptimizerInputError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'OptimizerInputError'
    this.code = code
  }
}

export class OptimizerProtocolError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'OptimizerProtocolError'
    this.code = code
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isPositiveNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value > 0
}

function isNonNegativeNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function isStrategy(value: unknown): value is CuttingStrategy {
  return isNonNegativeInteger(value) && value <= CuttingStrategy.BestLongSide_PerimeterDesc
}

function isRawPlaced(value: unknown): value is RawPlaced {
  if (!isRecord(value)) return false
  return typeof value.source_id === 'string'
    && typeof value.source_label === 'string'
    && typeof value.source_color === 'string'
    && isNonNegativeNumber(value.x)
    && isNonNegativeNumber(value.y)
    && isPositiveNumber(value.width)
    && isPositiveNumber(value.height)
    && typeof value.is_rotated === 'boolean'
}

function isRawSheet(value: unknown): value is RawSheet {
  if (!isRecord(value) || !Array.isArray(value.placed_pieces)) return false
  return isNonNegativeInteger(value.index)
    && isPositiveNumber(value.width)
    && isPositiveNumber(value.height)
    && isNonNegativeNumber(value.used_area)
    && isPositiveNumber(value.total_area)
    && isNonNegativeNumber(value.efficiency)
    && value.placed_pieces.every(isRawPlaced)
}

function isRawUnplaced(value: unknown): value is RawUnplaced {
  if (!isRecord(value)) return false
  return typeof value.source_id === 'string'
    && typeof value.label === 'string'
    && isPositiveNumber(value.width)
    && isPositiveNumber(value.height)
}

function isRawOutput(value: unknown): value is RawOutput {
  if (!isRecord(value) || !Array.isArray(value.sheets) || !Array.isArray(value.unplaced_pieces)) {
    return false
  }
  const autoStrategy = value.auto_picked_strategy
  return value.sheets.every(isRawSheet)
    && value.unplaced_pieces.every(isRawUnplaced)
    && isStrategy(value.strategy)
    && (autoStrategy == null || isStrategy(autoStrategy))
    && isNonNegativeInteger(value.total_sheets)
    && isNonNegativeNumber(value.total_used_area)
    && isNonNegativeNumber(value.total_area)
    && isNonNegativeNumber(value.overall_efficiency)
}

function asErrorEnvelope(value: unknown): WasmErrorEnvelope | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Record<string, unknown>
  if (
    candidate.kind !== 'validation'
    && candidate.kind !== 'protocol'
    && candidate.kind !== 'internal'
  ) return null
  if (typeof candidate.code !== 'string' || candidate.code.length === 0) return null
  if (typeof candidate.message !== 'string' || candidate.message.length === 0) return null
  return {
    kind: candidate.kind,
    code: candidate.code,
    message: candidate.message,
  }
}

function parseWasmRejection(error: unknown): WasmErrorEnvelope | null {
  let candidate: unknown = error instanceof Error ? error.message : error
  if (typeof candidate === 'string') {
    try {
      candidate = JSON.parse(candidate) as unknown
    } catch {
      return null
    }
  }
  return asErrorEnvelope(candidate)
}

function rejectionMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'string' && error) return error
  return 'Unknown WASM rejection'
}

function mapWasmRejection(error: unknown): OptimizerInputError | OptimizerProtocolError {
  const envelope = parseWasmRejection(error)
  if (envelope?.kind === 'validation') {
    return new OptimizerInputError(envelope.code, envelope.message)
  }
  if (envelope) return new OptimizerProtocolError(envelope.code, envelope.message)
  return new OptimizerProtocolError(
    'wasm_rejection',
    `Optimizer rejected the request: ${rejectionMessage(error)}`,
  )
}

export async function optimize(
  sheetW: number, sheetH: number,
  pieces: CutPiece[], kerf: number,
  strategy: CuttingStrategy = CuttingStrategy.Auto,
): Promise<CuttingResult> {
  assertOptimizerCapacity(pieces)
  assertStablePieceIds(pieces)
  const wasm = await ensureWasm()

  const input = JSON.stringify({
    sheet_width: sheetW,
    sheet_height: sheetH,
    kerf,
    strategy,
    pieces: pieces.map(p => ({
      id: p.id,
      label: p.label,
      width: p.width,
      height: p.height,
      quantity: normalizeQuantity(p.quantity),
      allow_rotation: p.allowRotation,
      color: p.color,
    })),
  })

  let outputJson: string
  try {
    outputJson = wasm.optimize_sync(input)
  } catch (e) {
    throw mapWasmRejection(e)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(outputJson) as unknown
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e)
    throw new OptimizerProtocolError('invalid_json', `Optimizer returned invalid JSON: ${detail}`)
  }
  if (!isRawOutput(parsed)) {
    throw new OptimizerProtocolError('unexpected_output', 'Optimizer returned an unexpected shape')
  }
  const raw = parsed

  const piecesById = new Map(pieces.map(p => [p.id, p]))

  const sheets: Sheet[] = raw.sheets.map((s: RawSheet) => ({
    index: s.index,
    width: s.width,
    height: s.height,
    usedArea: s.used_area,
    totalArea: s.total_area,
    efficiency: s.efficiency,
    placedPieces: s.placed_pieces.map((pp: RawPlaced): PlacedPiece => ({
      source: piecesById.get(pp.source_id) ?? {
        id: pp.source_id, label: pp.source_label, color: pp.source_color,
        width: pp.width, height: pp.height, quantity: 1, allowRotation: true,
      },
      x: pp.x, y: pp.y, width: pp.width, height: pp.height,
      isRotated: pp.is_rotated,
    })),
  }))

  return {
    sheets,
    unplacedPieces: raw.unplaced_pieces.map((u: RawUnplaced) => ({
      sourceId: u.source_id,
      label: u.label,
      width: u.width,
      height: u.height,
    })),
    strategy: raw.strategy,
    autoPickedStrategy: raw.auto_picked_strategy ?? undefined,
    totalSheets: raw.total_sheets,
    totalUsedArea: raw.total_used_area,
    totalArea: raw.total_area,
    overallEfficiency: raw.overall_efficiency,
  }
}
