import { describe, it, expect } from 'vitest'
import { serializeHomeState, parseHomeState, type HomeState } from './homeState'

const valid: HomeState = {
  sheetWidth: 2440,
  sheetHeight: 1220,
  kerf: 3,
  pieces: [
    { id: 'a', label: 'X', width: 400, height: 300, quantity: 2, allowRotation: true, color: '#fff' },
  ],
}

describe('homeState persistence', () => {
  it('round-trips a valid state', () => {
    const parsed = parseHomeState(serializeHomeState(valid))
    expect(parsed).toEqual(valid)
  })

  it('returns null for missing / empty / malformed input', () => {
    expect(parseHomeState(null)).toBeNull()
    expect(parseHomeState('')).toBeNull()
    expect(parseHomeState('{ not json')).toBeNull()
  })

  it('rejects another schema version', () => {
    expect(parseHomeState(JSON.stringify({ ...valid, version: 999 }))).toBeNull()
    expect(parseHomeState(JSON.stringify(valid))).toBeNull() // no version field
  })

  it('rejects invalid sheet dimensions', () => {
    const bad = (o: object) => parseHomeState(serializeHomeState({ ...valid, ...o } as HomeState))
    expect(bad({ sheetWidth: 0 })).toBeNull()
    expect(bad({ sheetHeight: -5 })).toBeNull()
    expect(bad({ sheetWidth: NaN })).toBeNull()
    expect(bad({ kerf: -1 })).toBeNull()
  })

  it('keeps kerf of zero (valid)', () => {
    expect(parseHomeState(serializeHomeState({ ...valid, kerf: 0 }))?.kerf).toBe(0)
  })

  it('drops invalid pieces and coerces quantity', () => {
    const raw = serializeHomeState({
      ...valid,
      pieces: [
        { id: 'ok', label: 'A', width: 100, height: 50, quantity: 2.7, allowRotation: false, color: '#abc' },
        { id: 'bad', label: 'B', width: -1, height: 50, quantity: 1, allowRotation: true, color: '#abc' } as any,
        { width: 10, height: 10 } as any, // missing fields -> filled with defaults
      ],
    })
    const parsed = parseHomeState(raw)!
    expect(parsed.pieces).toHaveLength(2)
    expect(parsed.pieces[0].quantity).toBe(3) // rounded
    expect(parsed.pieces[0].allowRotation).toBe(false)
    expect(parsed.pieces[0].locked).toBeUndefined()
    expect(parsed.pieces[1].quantity).toBe(1) // default
    expect(parsed.pieces[1].id).toBeTruthy() // generated
  })

  it('preserves locked pieces', () => {
    const parsed = parseHomeState(serializeHomeState({
      ...valid,
      pieces: [{ ...valid.pieces[0], locked: true }],
    }))!

    expect(parsed.pieces[0].locked).toBe(true)
  })
})
