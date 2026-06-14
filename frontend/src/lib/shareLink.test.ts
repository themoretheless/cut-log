import { describe, it, expect } from 'vitest'
import { encodeShare, decodeShare, buildShareUrl, readShareFromHash, SHARE_HASH_PREFIX } from './shareLink'
import type { HomeState } from './homeState'
import type { CutPiece } from '@/services/types'

function piece(id: string, label: string, w: number, h: number): CutPiece {
  return { id, label, width: w, height: h, quantity: 1, allowRotation: true, color: '#4A90D9' }
}

const state: HomeState = {
  sheetWidth: 2440,
  sheetHeight: 1220,
  kerf: 3,
  pieces: [piece('a', 'Полка A', 760, 300), piece('b', 'Side', 1800, 300)],
}

describe('encodeShare / decodeShare', () => {
  it('round-trips a project including Cyrillic labels', () => {
    const back = decodeShare(encodeShare(state))
    expect(back).toEqual(state)
  })

  it('produces a URL-safe payload (no +, /, or = padding)', () => {
    const payload = encodeShare(state)
    expect(payload).not.toMatch(/[+/=]/)
  })

  it('returns null for a garbage payload', () => {
    expect(decodeShare('!!!not-base64!!!')).toBeNull()
  })

  it('returns null when the decoded JSON is valid base64 but fails state validation', () => {
    // a well-formed base64url payload whose JSON has the wrong schema version
    const json = JSON.stringify({ version: 999, sheetWidth: 2440, sheetHeight: 1220, kerf: 3, pieces: [] })
    const b64url = btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    expect(decodeShare(b64url)).toBeNull()
  })
})

describe('buildShareUrl', () => {
  it('embeds the payload in the hash after origin + pathname', () => {
    const url = buildShareUrl('https://cutlog.app', '/cut', state)
    expect(url.startsWith('https://cutlog.app/cut' + SHARE_HASH_PREFIX)).toBe(true)
    const fromUrl = readShareFromHash(url.slice(url.indexOf('#')))
    expect(fromUrl).toEqual(state)
  })
})

describe('readShareFromHash', () => {
  it('decodes a hash that carries a share payload', () => {
    const hash = SHARE_HASH_PREFIX + encodeShare(state)
    expect(readShareFromHash(hash)).toEqual(state)
  })

  it('returns null for an empty or unrelated hash', () => {
    expect(readShareFromHash('')).toBeNull()
    expect(readShareFromHash('#section')).toBeNull()
    expect(readShareFromHash('#p=')).toBeNull()
  })
})
