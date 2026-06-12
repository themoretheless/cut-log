/**
 * Cutting optimizer — calls Rust WASM guillotine bin-packing algorithm.
 */
import type { CutPiece, CuttingResult, PlacedPiece, Sheet } from './types'
import { CuttingStrategy } from './types'
import { ensureWasm } from './rustService'

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

  const raw = JSON.parse(wasm.optimize_sync(input))

  const piecesById = new Map(pieces.map(p => [p.id, p]))

  const sheets: Sheet[] = raw.sheets.map((s: any) => ({
    index: s.index,
    width: s.width,
    height: s.height,
    usedArea: s.used_area,
    totalArea: s.total_area,
    efficiency: s.efficiency,
    placedPieces: s.placed_pieces.map((pp: any): PlacedPiece => ({
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
    unplacedPieces: raw.unplaced_pieces,
    strategy: raw.strategy,
    autoPickedStrategy: raw.auto_picked_strategy ?? undefined,
    totalSheets: raw.total_sheets,
    totalUsedArea: raw.total_used_area,
    totalArea: raw.total_area,
    overallEfficiency: raw.overall_efficiency,
  }
}
