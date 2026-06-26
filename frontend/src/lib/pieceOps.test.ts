import { describe, it, expect } from 'vitest'
import { duplicatePiece } from './pieceOps'
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
