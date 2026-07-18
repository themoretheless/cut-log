import { describe, expect, it } from 'vitest'
import { assertStablePieceIds, claimPieceId, withStablePieceIds } from './pieceIdentity'

describe('piece identity', () => {
  it('preserves unique opaque ids and repairs missing or duplicate ids', () => {
    const generated = ['generated-1', 'generated-2']
    const pieces = withStablePieceIds([
      { id: 'source-a', label: 'Shelf' },
      { id: 'source-a', label: 'Shelf' },
      { id: '', label: 'Shelf' },
    ], () => generated.shift()!)

    expect(pieces.map(piece => piece.id)).toEqual(['source-a', 'generated-1', 'generated-2'])
    expect(new Set(pieces.map(piece => piece.id)).size).toBe(3)
  })

  it('bounds imported ids before claiming them', () => {
    const used = new Set<string>()
    const id = claimPieceId(`  ${'a'.repeat(200)}  `, used)
    expect(id).toHaveLength(120)
    expect(used.has(id)).toBe(true)
  })

  it('rejects empty, normalized, or duplicate ids at the optimizer boundary', () => {
    expect(() => assertStablePieceIds([{ id: 'a' }, { id: 'b' }])).not.toThrow()
    expect(() => assertStablePieceIds([{ id: ' a ' }])).toThrow(/unique stable id/)
    expect(() => assertStablePieceIds([{ id: 'a' }, { id: 'a' }])).toThrow(/unique stable id/)
  })
})
