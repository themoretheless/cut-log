import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OptimizerInputError, OptimizerProtocolError, optimize } from './optimizer'
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
  unplaced_pieces: [{ source_id: 'p2', label: 'B', width: 9999, height: 9999 }],
  strategy: CuttingStrategy.Auto,
  auto_picked_strategy: CuttingStrategy.BestArea_AreaDesc,
  total_sheets: 1,
  total_used_area: 240000,
  total_area: 2976800,
  overall_efficiency: 8.06,
}

// Mutable so individual tests can make the optimizer return malformed output,
// or throw the way the wasm binding does when Rust returns Err (bad input JSON).
let wasmOutput = JSON.stringify(rawResult)
let wasmRejection: unknown = undefined

vi.mock('./rustService', () => ({
  ensureWasm: async () => ({
    optimize_sync: (input: string) => {
      captured = input
      if (wasmRejection !== undefined) throw wasmRejection
      return wasmOutput
    },
  }),
}))

const piece: CutPiece = {
  id: 'p1', label: 'A', width: 400, height: 300, quantity: 2, allowRotation: false, color: '#111',
}

beforeEach(() => {
  captured = ''
  wasmOutput = JSON.stringify(rawResult)
  wasmRejection = undefined
})

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

  it('throws a clear error when wasm returns invalid JSON', async () => {
    wasmOutput = 'this is not json'
    await expect(optimize(2440, 1220, [piece], 3)).rejects.toMatchObject({
      name: 'OptimizerProtocolError',
      code: 'invalid_json',
      message: expect.stringMatching(/invalid JSON/i),
    })
  })

  it('throws when the wasm output shape is unexpected', async () => {
    wasmOutput = JSON.stringify({ sheets: 'nope' })
    await expect(optimize(2440, 1220, [piece], 3)).rejects.toMatchObject({
      name: 'OptimizerProtocolError',
      code: 'unexpected_output',
      message: expect.stringMatching(/unexpected shape/i),
    })
  })

  it.each([
    {
      ...rawResult,
      sheets: [{ ...rawResult.sheets[0], placed_pieces: null }],
    },
    {
      ...rawResult,
      sheets: [{ ...rawResult.sheets[0], width: '2440' }],
    },
    {
      ...rawResult,
      auto_picked_strategy: 255,
    },
  ])('rejects malformed nested WASM output as a protocol error', async malformed => {
    wasmOutput = JSON.stringify(malformed)

    await expect(optimize(2440, 1220, [piece], 3)).rejects.toMatchObject({
      name: 'OptimizerProtocolError',
      code: 'unexpected_output',
    })
  })

  it.each([
    ['invalid_kerf', 'kerf must be zero or greater'],
    ['invalid_strategy', 'strategy 255 is not supported'],
    ['duplicate_piece_id', "duplicate piece id 'piece-1'"],
    ['invalid_piece_id', 'piece at index 0 id must not be empty'],
  ])('maps the %s WASM validation envelope to OptimizerInputError', async (code, message) => {
    wasmRejection = { kind: 'validation', code, message }

    await expect(optimize(2440, 1220, [piece], 3)).rejects.toMatchObject({
      name: 'OptimizerInputError',
      code,
      message,
    })
  })

  it('maps an Error-wrapped validation envelope without losing its message', async () => {
    wasmRejection = new Error(JSON.stringify({
      kind: 'validation',
      code: 'invalid_kerf',
      message: 'kerf must be zero or greater',
    }))

    const result = optimize(2440, 1220, [piece], 3)
    await expect(result).rejects.toBeInstanceOf(OptimizerInputError)
    await expect(result).rejects.toMatchObject({
      code: 'invalid_kerf',
      message: 'kerf must be zero or greater',
    })
  })

  it('turns an unstructured WASM rejection into a readable protocol error', async () => {
    wasmRejection = new Error('WASM runtime failed')

    const result = optimize(2440, 1220, [piece], 3)
    await expect(result).rejects.toBeInstanceOf(OptimizerProtocolError)
    await expect(result).rejects.toMatchObject({
      code: 'wasm_rejection',
      message: expect.stringContaining('WASM runtime failed'),
    })
  })

  it('keeps a structured WASM protocol rejection distinct from malformed success JSON', async () => {
    wasmRejection = {
      kind: 'protocol',
      code: 'invalid_input_json',
      message: 'Optimizer input payload is not valid JSON',
    }

    await expect(optimize(2440, 1220, [piece], 3)).rejects.toMatchObject({
      name: 'OptimizerProtocolError',
      code: 'invalid_input_json',
      message: 'Optimizer input payload is not valid JSON',
    })
  })

  it('rejects excessive quantity before loading or calling wasm', async () => {
    await expect(optimize(2440, 1220, [{ ...piece, quantity: 1001 }], 3)).rejects.toThrow(/quantity/i)
    expect(captured).toBe('')
  })

  it('rejects duplicate source ids before optimization can mis-reconcile equal labels', async () => {
    const duplicate = { ...piece, label: 'Same label', width: 200 }
    await expect(optimize(2440, 1220, [piece, duplicate], 3)).rejects.toThrow(/unique stable id/i)
    expect(captured).toBe('')
  })

  it('maps unplaced pieces and top-level totals', async () => {
    const res = await optimize(2440, 1220, [piece], 3)
    expect(res.unplacedPieces).toEqual([{ sourceId: 'p2', label: 'B', width: 9999, height: 9999 }])
    expect(res).toMatchObject({
      totalSheets: 1, totalUsedArea: 240000, totalArea: 2976800, overallEfficiency: 8.06,
      strategy: CuttingStrategy.Auto, autoPickedStrategy: CuttingStrategy.BestArea_AreaDesc,
    })
    expect(res.sheets[0]).toMatchObject({ usedArea: 240000, totalArea: 2976800, efficiency: 8.06 })
  })
})
