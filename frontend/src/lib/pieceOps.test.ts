import { describe, it, expect } from 'vitest'
import { duplicatePiece, reorderByDrag } from './pieceOps'
import type { CutPiece } from '@/services/types'

function piece(id: string, label = id): CutPiece {
  return { id, label, width: 400, height: 300, quantity: 2, allowRotation: true, color: '#abc' }
}

describe('duplicatePiece', () => {
  it('inserts a copy right after the matched piece with the new id and color', () => {
    const out = duplicatePiece([piece('a'), piece('b'), piece('c')], 'b', 'new', '#f00')
    expect(out.map(p => p.id)).toEqual(['a', 'b', 'new', 'c'])
    const copy = out[2]
    expect(copy).toMatchObject({ id: 'new', color: '#f00', label: 'b', width: 400, height: 300, quantity: 2 })
  })

  it('falls back to duplicating the last piece when id is null', () => {
    const out = duplicatePiece([piece('a'), piece('b')], null, 'new', '#0f0')
    expect(out.map(p => p.id)).toEqual(['a', 'b', 'new'])
  })

  it('falls back to the last piece when the id is not found', () => {
    const out = duplicatePiece([piece('a'), piece('b')], 'missing', 'new', '#0f0')
    expect(out.map(p => p.id)).toEqual(['a', 'b', 'new'])
  })

  it('does not mutate the input list', () => {
    const input = [piece('a'), piece('b')]
    duplicatePiece(input, 'a', 'new', '#fff')
    expect(input.map(p => p.id)).toEqual(['a', 'b'])
  })

  it('returns an empty copy for an empty list', () => {
    expect(duplicatePiece([], null, 'new', '#fff')).toEqual([])
  })
})

describe('reorderByDrag', () => {
  const ids = (list: CutPiece[]) => list.map(p => p.id)
  const lock = (p: CutPiece): CutPiece => ({ ...p, locked: true })

  it('moves a piece down (insert after the target)', () => {
    const out = reorderByDrag([piece('A'), piece('B'), piece('C'), piece('D')], 0, 2)
    expect(ids(out)).toEqual(['B', 'C', 'A', 'D'])
  })

  it('moves a piece up (insert before the target)', () => {
    const out = reorderByDrag([piece('A'), piece('B'), piece('C'), piece('D')], 3, 1)
    expect(ids(out)).toEqual(['A', 'D', 'B', 'C'])
  })

  it('keeps locked pieces in their absolute slots', () => {
    const out = reorderByDrag([piece('A'), lock(piece('L')), piece('C')], 0, 2)
    expect(ids(out)).toEqual(['C', 'L', 'A'])
  })

  it('reorders across a hidden (filtered) but present piece by absolute index', () => {
    // B is hidden by a filter; dragging A (0) onto C (2) still uses absolute
    // indices, so the result is well-defined and B keeps its data.
    const out = reorderByDrag([piece('A'), piece('B'), piece('C')], 0, 2)
    expect(ids(out)).toEqual(['B', 'C', 'A'])
  })

  it('is a no-op when an index is equal, out of range, or points at a locked piece', () => {
    const list = [piece('A'), lock(piece('L')), piece('C')]
    expect(ids(reorderByDrag(list, 1, 1))).toEqual(['A', 'L', 'C']) // equal
    expect(ids(reorderByDrag(list, 0, 1))).toEqual(['A', 'L', 'C']) // target locked
    expect(ids(reorderByDrag(list, 1, 2))).toEqual(['A', 'L', 'C']) // source locked
    expect(ids(reorderByDrag(list, 0, 9))).toEqual(['A', 'L', 'C']) // out of range
  })

  it('does not mutate the input list', () => {
    const input = [piece('A'), piece('B'), piece('C')]
    reorderByDrag(input, 0, 2)
    expect(ids(input)).toEqual(['A', 'B', 'C'])
  })
})
