import { describe, it, expect, vi, beforeEach } from 'vitest'
import { optimize } from './optimizer'
import { CuttingStrategy, type CutPiece } from './types'

// Capture the JSON the service sends into wasm, and return a crafted raw result.
let captured = ''
const rawResult = {
  sheets: [{
    index: 0, width: 2440, height: 1220,
    used_area: 240000, total_area: 2976800, efficiency: 8.06,
    placed_pieces: [
      { source_id: 'p1', source_label: 'A', source_color: '#111', x: 0, y: 0, width: 400, height: 300, is_rotated: false },
      { source_id: 'gone', source_label: 'X', source_color: '#222', x: 400, y: 0, width: 300, height: 400, is_rotated: true },
    ],
  }],
  unplaced_pieces: [{ label: 'B', width: 9999, height: 9999 }],
  strategy: CuttingStrategy.Auto,
  auto_picked_strategy: CuttingStrategy.BestArea_AreaDesc,
  total_sheets: 1,
  total_used_area: 240000,
  total_area: 2976800,
  overall_efficiency: 8.06,
}

vi.mock('./rustService', () => ({
  ensureWasm: async () => ({
    optimize_sync: (input: string) => {
      captured = input
      return JSON.stringify(rawResult)
    },
  }),
}))

const piece: CutPiece = {
  id: 'p1', label: 'A', width: 400, height: 300, quantity: 2, allowRotation: false, color: '#111',
}

beforeEach(() => { captured = '' })

describe('optimize() service glue', () => {
  it('builds the wasm request with snake_case fields', async () => {
    await optimize(2440, 1220, [piece], 3, CuttingStrategy.BestArea_AreaDesc)
    const req = JSON.parse(captured)
    expect(req).toMatchObject({ sheet_width: 2440, sheet_height: 1220, kerf: 3, strategy: CuttingStrategy.BestArea_AreaDesc })
    expect(req.pieces).toHaveLength(1)
    expect(req.pieces[0]).toMatchObject({ id: 'p1', label: 'A', width: 400, height: 300, quantity: 2, allow_rotation: false, color: '#111' })
  })

  it('resolves placed pieces back to their source object by id', async () => {
    const res = await optimize(2440, 1220, [piece], 3)
    const placed = res.sheets[0].placedPieces
    // known source_id -> original piece object
    expect(placed[0].source).toBe(piece)
    expect(placed[0].isRotated).toBe(false)
  })

  it('falls back to a synthetic source when the id is unknown', async () => {
    const res = await optimize(2440, 1220, [piece], 3)
    const fallback = res.sheets[0].placedPieces[1].source
    expect(fallback).toMatchObject({ id: 'gone', label: 'X', color: '#222', width: 300, height: 400 })
  })

  it('maps unplaced pieces and top-level totals', async () => {
    const res = await optimize(2440, 1220, [piece], 3)
    expect(res.unplacedPieces).toEqual([{ label: 'B', width: 9999, height: 9999 }])
    expect(res).toMatchObject({
      totalSheets: 1, totalUsedArea: 240000, totalArea: 2976800, overallEfficiency: 8.06,
      strategy: CuttingStrategy.Auto, autoPickedStrategy: CuttingStrategy.BestArea_AreaDesc,
    })
    expect(res.sheets[0]).toMatchObject({ usedArea: 240000, totalArea: 2976800, efficiency: 8.06 })
  })
})
