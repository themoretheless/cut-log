import { describe, it, expect } from 'vitest'
import { parsePieceList } from './parsePieceList'

describe('parsePieceList', () => {
  it('parses tab-separated rows with label, w, h, qty', () => {
    const { rows, skipped } = parsePieceList('Side\t1800\t300\t2\nShelf\t760\t300\t4')
    expect(skipped).toBe(0)
    expect(rows).toEqual([
      { label: 'Side', width: 1800, height: 300, quantity: 2 },
      { label: 'Shelf', width: 760, height: 300, quantity: 4 },
    ])
  })

  it('parses comma-separated rows and keeps multi-word Cyrillic labels', () => {
    const { rows } = parsePieceList('Полка A, 760, 300, 4')
    expect(rows).toEqual([{ label: 'Полка A', width: 760, height: 300, quantity: 4 }])
  })

  it('parses space-separated rows (single-word label)', () => {
    const { rows } = parsePieceList('Back 1800 800 1')
    expect(rows).toEqual([{ label: 'Back', width: 1800, height: 800, quantity: 1 }])
  })

  it('defaults quantity to 1 when omitted', () => {
    const { rows } = parsePieceList('Top, 600, 400')
    expect(rows[0].quantity).toBe(1)
  })

  it('accepts a combined WxH cell with x, ×, or *', () => {
    const { rows } = parsePieceList('760x300\n760×300\n760*300')
    expect(rows.map(r => [r.width, r.height])).toEqual([[760, 300], [760, 300], [760, 300]])
  })

  it('reads no label when the row is dimensions only', () => {
    const { rows } = parsePieceList('600, 400, 3')
    expect(rows[0]).toEqual({ label: '', width: 600, height: 400, quantity: 3 })
  })

  it('understands a trailing xN quantity mark', () => {
    const { rows } = parsePieceList('Door 760x300 x5')
    expect(rows[0]).toEqual({ label: 'Door', width: 760, height: 300, quantity: 5 })
  })

  it('ignores a trailing unit token', () => {
    const { rows } = parsePieceList('Lid 600 400 mm')
    expect(rows[0]).toEqual({ label: 'Lid', width: 600, height: 400, quantity: 1 })
  })

  it('handles decimal separators (dot and comma) inside cells', () => {
    const { rows } = parsePieceList('A;100.5;200,25;2')
    expect(rows[0]).toEqual({ label: 'A', width: 100.5, height: 200.25, quantity: 2 })
  })

  it('skips a header row and blank lines, counting only junk as skipped', () => {
    const text = 'name, width, height, qty\n\nSide, 800, 600, 1\n   \njust text'
    const { rows, skipped } = parsePieceList(text)
    expect(rows).toEqual([{ label: 'Side', width: 800, height: 600, quantity: 1 }])
    expect(skipped).toBe(2) // header + "just text" (blank lines don't count)
  })

  it('reads an explicit rotation column (0 = locked, else allowed)', () => {
    const { rows } = parsePieceList('Side,760,300,2,0\nShelf,760,300,4,1')
    expect(rows[0]).toEqual({ label: 'Side', width: 760, height: 300, quantity: 2, allowRotation: false })
    expect(rows[1]).toEqual({ label: 'Shelf', width: 760, height: 300, quantity: 4, allowRotation: true })
  })

  it('leaves allowRotation unset when there is no rotation column', () => {
    const { rows } = parsePieceList('Side, 760, 300, 2')
    expect(rows[0].allowRotation).toBeUndefined()
  })

  it('rejects rows with non-positive dimensions', () => {
    const { rows, skipped } = parsePieceList('Bad, 0, 300\nBad2, -5, 300')
    expect(rows).toHaveLength(0)
    expect(skipped).toBe(2)
  })

  it('rounds fractional quantities up to at least 1', () => {
    const { rows } = parsePieceList('A 100 100 2.7\nB 100 100 0')
    expect(rows[0].quantity).toBe(3)
    expect(rows[1].quantity).toBe(1)
  })

  it('returns empty for empty input', () => {
    expect(parsePieceList('')).toEqual({ rows: [], skipped: 0 })
    expect(parsePieceList('\n\n  \n')).toEqual({ rows: [], skipped: 0 })
  })
})
