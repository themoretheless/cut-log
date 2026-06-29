/**
 * Cutting optimizer — calls Rust WASM guillotine bin-packing algorithm.
 */
import type { CutPiece, CuttingResult, PlacedPiece, Sheet } from './types'
import { CuttingStrategy } from './types'
import { ensureWasm } from './rustService'

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
interface RawUnplaced { label: string; width: number; height: number }
interface RawOutput {
  sheets: RawSheet[]; unplaced_pieces: RawUnplaced[]
  strategy: CuttingStrategy; auto_picked_strategy?: CuttingStrategy
  total_sheets: number; total_used_area: number; total_area: number; overall_efficiency: number
}

export async function optimize(
  sheetW: number, sheetH: number,
  pieces: CutPiece[], kerf: number,
  strategy: CuttingStrategy = CuttingStrategy.Auto,
): Promise<CuttingResult> {
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
      quantity: p.quantity,
      allow_rotation: p.allowRotation,
      color: p.color,
    })),
  })

  let raw: RawOutput
  try {
    raw = JSON.parse(wasm.optimize_sync(input)) as RawOutput
  } catch (e) {
    throw new Error(`Optimizer returned invalid JSON: ${(e as Error).message}`)
  }
  if (!raw || !Array.isArray(raw.sheets) || !Array.isArray(raw.unplaced_pieces)) {
    throw new Error('Optimizer returned an unexpected shape')
  }

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
    unplacedPieces: raw.unplaced_pieces.map((u: RawUnplaced) => ({ label: u.label, width: u.width, height: u.height })),
    strategy: raw.strategy,
    autoPickedStrategy: raw.auto_picked_strategy ?? undefined,
    totalSheets: raw.total_sheets,
    totalUsedArea: raw.total_used_area,
    totalArea: raw.total_area,
    overallEfficiency: raw.overall_efficiency,
  }
}
