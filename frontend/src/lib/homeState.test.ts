import { describe, it, expect } from 'vitest'
import {
  isDefaultHomeState,
  serializeHomeState,
  parseHomeState,
  type HomeState,
} from './homeState'

const valid: HomeState = {
  sheetWidth: 2440,
  sheetHeight: 1220,
  kerf: 3,
  pieces: [
    { id: 'a', label: 'X', width: 400, height: 300, quantity: 2, allowRotation: true, color: '#fff' },
  ],
  pricePerSheet: 0,
  currency: '₽',
}

describe('homeState persistence', () => {
  it('round-trips a valid state', () => {
    const parsed = parseHomeState(serializeHomeState(valid))
    expect(parsed).toEqual(valid)
  })

  it('distinguishes a pristine project from settings-only content', () => {
    const empty = { ...valid, pieces: [] }
    expect(isDefaultHomeState(empty)).toBe(true)
    expect(isDefaultHomeState({ ...empty, sheetWidth: 1800 })).toBe(false)
    expect(isDefaultHomeState({ ...empty, pricePerSheet: 50 })).toBe(false)
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

  it('defaults costing fields for a state saved before they existed', () => {
    // An old payload (version 1, no pricePerSheet / currency) must still load.
    const old = JSON.stringify({ version: 1, sheetWidth: 2440, sheetHeight: 1220, kerf: 3, pieces: [] })
    const parsed = parseHomeState(old)!
    expect(parsed.pricePerSheet).toBe(0)
    expect(parsed.currency).toBe('₽')
  })

  it('keeps a valid price and currency, rejects a bad price, bounds the symbol', () => {
    const a = parseHomeState(serializeHomeState({ ...valid, pricePerSheet: 42.5, currency: '$' }))!
    expect(a.pricePerSheet).toBe(42.5)
    expect(a.currency).toBe('$')
    const b = parseHomeState(serializeHomeState({ ...valid, pricePerSheet: -5, currency: 'долл' }))!
    expect(b.pricePerSheet).toBe(0) // negative -> default
    expect(b.currency).toBe('дол') // trimmed to 3 chars
  })

  it('rejects a currency with control or bidi characters', () => {
    const cur = (c: string) => parseHomeState(serializeHomeState({ ...valid, currency: c }))!.currency
    const rtlOverride = String.fromCharCode(0x202E)
    expect(cur(rtlOverride + '$')).toBe('₽') // bidi override -> default
    expect(cur('"x')).toBe('₽')               // quote not allowed -> default
    expect(cur('€')).toBe('€')                 // legit symbol kept
    expect(cur('USD')).toBe('USD')             // letters kept
  })

  it('bounds an oversized label and an oversized piece list', () => {
    const huge = 'L'.repeat(5000)
    const many = Array.from({ length: 5000 }, (_, i) => ({
      id: 'p' + i, label: 'x', width: 100, height: 50, quantity: 1, allowRotation: true, color: '#abc',
    }))
    const parsed = parseHomeState(serializeHomeState({
      ...valid,
      pieces: [{ ...valid.pieces[0], label: huge }, ...many],
    }))!
    expect(parsed.pieces.length).toBe(1000)         // piece count capped
    expect(parsed.pieces[0].label.length).toBe(200) // label length capped
  })

  it('preserves up to 200 Unicode scalar values without splitting surrogate pairs', () => {
    const accepted = '😀'.repeat(200)
    const oversized = `${accepted}😀tail`
    const parsed = parseHomeState(serializeHomeState({
      ...valid,
      pieces: [
        { ...valid.pieces[0], id: 'accepted', label: accepted },
        { ...valid.pieces[0], id: 'oversized', label: oversized },
      ],
    }))!

    expect(parsed.pieces[0].label).toBe(accepted)
    expect(parsed.pieces[1].label).toBe(accepted)
    expect([...parsed.pieces[1].label]).toHaveLength(200)
  })

  it('keeps valid hex colors but replaces non-hex / injected ones with the default', () => {
    const raw = serializeHomeState({
      ...valid,
      pieces: [
        { id: 'short', label: 'A', width: 100, height: 50, quantity: 1, allowRotation: true, color: '#abc' },
        { id: 'long', label: 'B', width: 100, height: 50, quantity: 1, allowRotation: true, color: '#aabbccdd' },
        { id: 'evil', label: 'C', width: 100, height: 50, quantity: 1, allowRotation: true, color: 'red"/><script>x</script>' },
        { id: 'named', label: 'D', width: 100, height: 50, quantity: 1, allowRotation: true, color: 'rebeccapurple' },
      ],
    })
    const parsed = parseHomeState(raw)!
    expect(parsed.pieces.map(p => p.color)).toEqual(['#abc', '#aabbccdd', '#4A90D9', '#4A90D9'])
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

  it('repairs duplicate persisted ids while preserving the first source identity', () => {
    const parsed = parseHomeState(serializeHomeState({
      ...valid,
      pieces: [valid.pieces[0], { ...valid.pieces[0], label: 'Same label' }],
    }))!

    expect(parsed.pieces[0].id).toBe('a')
    expect(parsed.pieces[1].id).not.toBe('a')
    expect(new Set(parsed.pieces.map(piece => piece.id)).size).toBe(2)
  })

  it('preserves locked pieces', () => {
    const parsed = parseHomeState(serializeHomeState({
      ...valid,
      pieces: [{ ...valid.pieces[0], locked: true }],
    }))!

    expect(parsed.pieces[0].locked).toBe(true)
  })
})
