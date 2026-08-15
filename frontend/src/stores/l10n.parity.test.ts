import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { ru, en } from './l10n.svelte'

// The `t()` lookup falls back to ru when an en key is missing, and falls back to
// the raw key string when neither locale has it, so both kinds of gap are
// invisible at runtime. These guards turn that silent drift into a red test.
const ruKeys = Object.keys(ru)
const enKeys = Object.keys(en)

describe('l10n key parity', () => {
  it('ru and en define exactly the same keys', () => {
    const missingInEn = ruKeys.filter(k => !(k in en)).sort()
    const missingInRu = enKeys.filter(k => !(k in ru)).sort()
    expect({ missingInEn, missingInRu }).toEqual({ missingInEn: [], missingInRu: [] })
  })

  it('has no empty translations', () => {
    const emptyRu = ruKeys.filter(k => !ru[k]?.trim()).sort()
    const emptyEn = enKeys.filter(k => !en[k]?.trim()).sort()
    expect({ emptyRu, emptyEn }).toEqual({ emptyRu: [], emptyEn: [] })
  })
})

// ── Static usage scan: every literal t('key') in the source must be defined ────
const srcDir = fileURLToPath(new URL('..', import.meta.url))

function walk(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const full = `${dir}/${name}`
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (/\.(ts|svelte)$/.test(name) && !name.endsWith('.test.ts')) out.push(full)
  }
  return out
}

// Match t('...') and l10n.t('...') calls (not foo.t(), not truncate(); the
// lookbehind rejects any other preceding word char or dot). Dynamic
// t(`...${x}`) calls are skipped: they can't be resolved statically.
const CALL = /(?<![\w.])(?:l10n\.)?t\(\s*(['"])([^'"]+)\1\s*\)/g
const KEY_LIKE = /^[\w.]+$/

function usedKeys(): Set<string> {
  const keys = new Set<string>()
  for (const file of walk(srcDir)) {
    const text = readFileSync(file, 'utf8')
    for (const m of text.matchAll(CALL)) {
      if (KEY_LIKE.test(m[2])) keys.add(m[2])
    }
  }
  return keys
}

describe('l10n usage', () => {
  it('every literal t() key used in source is defined in ru', () => {
    const used = usedKeys()
    // Guard against a vacuous pass if the scan ever stops matching call sites.
    expect(used.size).toBeGreaterThan(20)
    const undefinedKeys = [...used].filter(k => !(k in ru)).sort()
    expect(undefinedKeys).toEqual([])
  })
})
