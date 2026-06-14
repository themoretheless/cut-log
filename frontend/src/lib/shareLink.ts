/**
 * Encode/decode a cutting-optimizer project into a URL-hash payload so a plan
 * can be shared by link (client-side, no backend). Reuses the validated
 * homeState serializer/parser, wrapped in UTF-8-safe base64url.
 */
import type { HomeState } from './homeState'
import { serializeHomeState, parseHomeState } from './homeState'

export const SHARE_HASH_PREFIX = '#p='

function toBase64Url(json: string): string {
  const bytes = new TextEncoder().encode(json)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(b64url: string): string | null {
  try {
    const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/')
    const bin = atob(b64)
    const bytes = Uint8Array.from(bin, c => c.charCodeAt(0))
    return new TextDecoder().decode(bytes)
  } catch {
    return null
  }
}

/** Compact base64url payload for the URL hash. */
export function encodeShare(state: HomeState): string {
  return toBase64Url(serializeHomeState(state))
}

/** Decode a payload back to a validated HomeState, or null if invalid. */
export function decodeShare(payload: string): HomeState | null {
  const json = fromBase64Url(payload)
  if (json === null) return null
  return parseHomeState(json)
}

/** Build a full shareable URL from the current location and a state. */
export function buildShareUrl(origin: string, pathname: string, state: HomeState): string {
  return `${origin}${pathname}${SHARE_HASH_PREFIX}${encodeShare(state)}`
}

/** Extract and decode a shared state from a location hash, or null. */
export function readShareFromHash(hash: string): HomeState | null {
  if (!hash.startsWith(SHARE_HASH_PREFIX)) return null
  return decodeShare(hash.slice(SHARE_HASH_PREFIX.length))
}
