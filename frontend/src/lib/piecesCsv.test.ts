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

  it('neutralizes spreadsheet formula injection in labels', () => {
    const csv = buildPiecesCsv([
      piece('=1+2', 100, 50, 1),
      piece('+SUM(A1)', 100, 50, 1),
      piece('-2', 100, 50, 1),
      piece('@cmd', 100, 50, 1),
    ])
    // each dangerous label is prefixed with a single quote so it reads as text
    expect(csv).toContain("'=1+2,100,50,1,1")
    expect(csv).toContain("'+SUM(A1),100,50,1,1")
    expect(csv).toContain("'-2,100,50,1,1")
    expect(csv).toContain("'@cmd,100,50,1,1")
    // and no data cell starts with a bare formula lead
    for (const line of csv.trimEnd().split('\r\n').slice(1)) {
      expect(/^[=+\-@\t\r]/.test(line)).toBe(false)
    }
  })

  it('still quotes a formula-lead label that also contains a comma', () => {
    const csv = buildPiecesCsv([piece('=a,b', 100, 50, 1)])
    expect(csv).toContain('"\'=a,b",100,50,1,1')
  })

  it('round-trips formula-safe prefixes without changing the original label', () => {
    const source = [
      piece('=1+2', 100, 50, 1),
      piece("'=already text", 100, 50, 1),
      piece("''@literal", 100, 50, 1),
      piece('   =SUM(A1)', 100, 50, 1),
      piece(" '  @spaced", 100, 50, 1),
      piece(`=${'😀'.repeat(199)}`, 100, 50, 1),
    ]

    const csv = buildPiecesCsv(source)
    const { rows } = parsePieceList(csv)

    expect(csv).toContain("'   =SUM(A1),100,50,1,1")
    expect(rows.map(row => row.label)).toEqual(source.map(item => item.label))
  })

  it('round-trips the rotation flag through parsePieceList', () => {
    const csv = buildPiecesCsv([piece('Fixed', 760, 300, 1, false), piece('Free', 760, 300, 1, true)])
    const { rows } = parsePieceList(csv)
    expect(rows[0].allowRotation).toBe(false)
    expect(rows[1].allowRotation).toBe(true)
  })

  it('round-trips through parsePieceList (dims and quantity)', () => {
    const csv = buildPiecesCsv([piece('Полка A', 760, 300, 4), piece('Bok', 1800, 300, 2)])
    const { rows } = parsePieceList(csv)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ label: 'Полка A', width: 760, height: 300, quantity: 4 })
    expect(rows[1]).toMatchObject({ label: 'Bok', width: 1800, height: 300, quantity: 2 })
  })

  it('round-trips labels containing commas, quotes, and embedded newlines', () => {
    const source = [
      piece('Back, big', 800, 600, 1),
      piece('A "wide" panel', 100, 50, 2, false),
      piece('Upper\nLower', 320, 180, 3),
      piece('First\r\nSecond', 640, 240, 4),
      piece('123', 500, 250, 1),
      piece('Panel; walnut', 450, 225, 2),
    ]

    const { rows, skipped } = parsePieceList(buildPiecesCsv(source))

    expect(skipped).toBe(0)
    expect(rows.map(row => row.label)).toEqual(source.map(item => item.label))
    expect(rows.map(row => [row.width, row.height, row.quantity, row.allowRotation])).toEqual(
      source.map(item => [item.width, item.height, item.quantity, item.allowRotation]),
    )
  })

  it('counts Unicode scalar values rather than UTF-16 code units in labels', () => {
    const accepted = '😀'.repeat(200)
    const rejected = '😀'.repeat(201)

    expect(parsePieceList(buildPiecesCsv([piece(accepted, 100, 50, 1)])).rows[0].label).toBe(accepted)
    expect(parsePieceList(buildPiecesCsv([piece(rejected, 100, 50, 1)]))).toEqual({ rows: [], skipped: 1 })
  })

  it('round-trips exactly 2000 exported data rows without counting header or blanks', () => {
    const source = Array.from({ length: 2000 }, (_, index) => piece(`P${index}`, 100, 50, 1))
    const csvWithBlanks = buildPiecesCsv(source).replace('\r\n', '\r\n\r\n\r\n')
    const { rows, skipped } = parsePieceList(csvWithBlanks)

    expect(rows).toHaveLength(2000)
    expect(rows[0].label).toBe('P0')
    expect(rows[1999].label).toBe('P1999')
    expect(skipped).toBe(0)
  })

  it('rejects 2001 exported data rows deterministically', () => {
    const source = Array.from({ length: 2001 }, (_, index) => piece(`P${index}`, 100, 50, 1))

    expect(parsePieceList(buildPiecesCsv(source))).toEqual({ rows: [], skipped: 1 })
  })

  it('produces just a header for an empty list', () => {
    expect(buildPiecesCsv([])).toBe('label,width,height,quantity,rotation\r\n')
  })
})
