import { describe, it, expect } from 'vitest'
import { buildPiecesCsv } from './piecesCsv'
import { parsePieceList } from './parsePieceList'
import type { CutPiece } from '@/services/types'

function piece(label: string, w: number, h: number, qty: number, rot = true): CutPiece {
  return { id: label, label, width: w, height: h, quantity: qty, allowRotation: rot, color: '#fff' }
}

describe('buildPiecesCsv', () => {
  it('emits a header row followed by one row per piece', () => {
    const csv = buildPiecesCsv([piece('Side', 760, 300, 2), piece('Shelf', 700, 280, 4, false)])
    const lines = csv.trimEnd().split('\r\n')
    expect(lines[0]).toBe('label,width,height,quantity,rotation')
    expect(lines[1]).toBe('Side,760,300,2,1')
    expect(lines[2]).toBe('Shelf,700,280,4,0')
  })

  it('quotes and escapes labels containing commas or quotes', () => {
    const csv = buildPiecesCsv([piece('Back, big', 800, 600, 1), piece('A "wide" panel', 100, 50, 1)])
    expect(csv).toContain('"Back, big",800,600,1,1')
    expect(csv).toContain('"A ""wide"" panel",100,50,1,1')
  })

  it('round-trips through parsePieceList (dims and quantity)', () => {
    const csv = buildPiecesCsv([piece('Полка A', 760, 300, 4), piece('Bok', 1800, 300, 2)])
    const { rows } = parsePieceList(csv)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ label: 'Полка A', width: 760, height: 300, quantity: 4 })
    expect(rows[1]).toMatchObject({ label: 'Bok', width: 1800, height: 300, quantity: 2 })
  })

  it('produces just a header for an empty list', () => {
    expect(buildPiecesCsv([])).toBe('label,width,height,quantity,rotation\r\n')
  })
})
