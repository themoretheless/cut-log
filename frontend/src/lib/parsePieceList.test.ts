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

  it('parses RFC 4180 commas, escaped quotes, and CRLF inside a quoted label', () => {
    const text = 'label,width,height,quantity,rotation\r\n"Back, ""wide""\r\npanel",800,600,2,0\r\n'
    const { rows, skipped } = parsePieceList(text)

    expect(skipped).toBe(0)
    expect(rows).toEqual([{
      label: 'Back, "wide"\r\npanel',
      width: 800,
      height: 600,
      quantity: 2,
      allowRotation: false,
    }])
  })

  it('rejects unknown cells after dimensions start without losing multiword labels', () => {
    const text = [
      'Wide side panel,100,missing,2',
      'Wide side panel,100,200,2',
    ].join('\n')
    const { rows, skipped } = parsePieceList(text)

    expect(rows).toEqual([{ label: 'Wide side panel', width: 100, height: 200, quantity: 2 }])
    expect(skipped).toBe(1)
  })

  it('rejects non-finite and non-decimal numeric-looking freeform cells', () => {
    const text = [
      'Infinity;Infinity;100;2',
      'Not a number;NaN;100;2',
      'Exponent;1e309;100;2',
      'Hex;0x10;100;2',
      'Binary;0b10;100;2',
    ].join('\n')

    expect(parsePieceList(text)).toEqual({ rows: [], skipped: 5 })
  })

  it('uses the exported header as a schema so numeric-looking labels stay labels', () => {
    const text = 'label,width,height,quantity,rotation\r\n123,800,600,1,1\r\n760x300,400,200,2,0\r\n'
    const { rows } = parsePieceList(text)

    expect(rows.map(row => row.label)).toEqual(['123', '760x300'])
    expect(rows.map(row => [row.width, row.height])).toEqual([[800, 600], [400, 200]])
  })

  it('counts an unclosed quoted record as malformed instead of partially importing it', () => {
    const text = 'label,width,height,quantity,rotation\r\n"unfinished,800,600,1,1'

    expect(parsePieceList(text)).toEqual({ rows: [], skipped: 1 })
  })

  it('rejects trailing junk in numeric cells from the exported schema', () => {
    const text = 'label,width,height,quantity,rotation\r\nBad,800mm,600,1,1\r\n'

    expect(parsePieceList(text)).toEqual({ rows: [], skipped: 1 })
  })

  it('strictly validates all five exported cells and accepts quoted decimal commas', () => {
    const text = [
      'label,width,height,quantity,rotation',
      'Good,100.5,200.25,2000,1',
      'Quoted,"100,5","200,25",2,0',
      'Hex,0x10,200,1,1',
      'Binary,0b10,200,1,1',
      'Exponent,1e2,200,1,1',
      'Negative,-100,200,1,1',
      'Fraction quantity,100,200,1.5,1',
      'Zero quantity,100,200,0,1',
      'Too many,100,200,2001,1',
      'Bad rotation,100,200,1,7',
      'Missing cell,100,200,1',
      'Extra cell,100,200,1,1,extra',
      'Unquoted decimal comma,100,5,200,2,1',
    ].join('\r\n')
    const { rows, skipped } = parsePieceList(text)

    expect(rows).toEqual([
      { label: 'Good', width: 100.5, height: 200.25, quantity: 2000, allowRotation: true },
      { label: 'Quoted', width: 100.5, height: 200.25, quantity: 2, allowRotation: false },
    ])
    expect(skipped).toBe(11)
  })

  it('rejects an exported header with missing or extra cells', () => {
    const extra = 'label,width,height,quantity,rotation,extra\r\nGood,100,200,1,1\r\n'
    const missing = 'label,width,height,quantity\r\nGood,100,200,1,1\r\n'

    expect(parsePieceList(extra)).toEqual({ rows: [], skipped: 2 })
    expect(parsePieceList(missing)).toEqual({ rows: [], skipped: 2 })
  })

  it('skips intro rows and lets tab or semicolon beat commas in mixed freeform rows', () => {
    const text = [
      'Workshop cut list',
      'name,width,height,qty',
      'Panel, walnut\t100\t200\t2',
      'Door, oak;300,5;400,25;3',
      'Loose panel 500 250 1',
    ].join('\n')
    const { rows, skipped } = parsePieceList(text)

    expect(rows).toEqual([
      { label: 'Panel, walnut', width: 100, height: 200, quantity: 2 },
      { label: 'Door, oak', width: 300.5, height: 400.25, quantity: 3 },
      { label: 'Loose panel', width: 500, height: 250, quantity: 1 },
    ])
    expect(skipped).toBe(2)
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

  it('requires freeform quantity and rotation to be exact bounded values', () => {
    const text = [
      'Valid 100 100 2 0',
      'Fraction 100 100 2.7',
      'Negative 100 100 -7',
      'Bad rotation 100 100 2 7',
    ].join('\n')
    const { rows, skipped } = parsePieceList(text)

    expect(rows).toEqual([{ label: 'Valid', width: 100, height: 100, quantity: 2, allowRotation: false }])
    expect(skipped).toBe(3)
  })

  it('rejects oversized input, record counts, columns, and fields deterministically', () => {
    const tooMuchInput = 'x'.repeat(1_048_577)
    const largeBoundedField = `"${'x'.repeat(1_000_000)}",100,100,1`
    const tooManyRecords = Array.from({ length: 2001 }, (_, index) => `P${index},1,1,1`).join('\n')
    const tooManyLogicalRecords = '\n'.repeat(10_001)
    const tooManyColumns = Array.from({ length: 17 }, () => 'x').join(',')
    const tooLongField = `${'x'.repeat(201)},100,100,1`

    for (const text of [
      tooMuchInput,
      largeBoundedField,
      tooManyRecords,
      tooManyLogicalRecords,
      tooManyColumns,
      tooLongField,
    ]) {
      expect(parsePieceList(text)).toEqual({ rows: [], skipped: 1 })
    }
  })

  it('returns empty for empty input', () => {
    expect(parsePieceList('')).toEqual({ rows: [], skipped: 0 })
    expect(parsePieceList('\n\n  \n')).toEqual({ rows: [], skipped: 0 })
  })
})
