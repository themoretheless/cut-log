import { describe, it, expect, vi, afterEach } from 'vitest'
import { downloadFile } from './downloadFile'

afterEach(() => vi.unstubAllGlobals())

describe('downloadFile', () => {
  it('names the anchor, clicks it, and revokes the object URL', () => {
    const anchor = { href: '', download: '', click: vi.fn() }
    vi.stubGlobal('document', { createElement: vi.fn(() => anchor) })
    const revoke = vi.fn()
    vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:test'), revokeObjectURL: revoke })

    downloadFile('cutlog-parts.csv', 'a,b\n1,2', 'text/csv')

    expect(anchor.download).toBe('cutlog-parts.csv')
    expect(anchor.href).toBe('blob:test')
    expect(anchor.click).toHaveBeenCalledOnce()
    expect(revoke).toHaveBeenCalledWith('blob:test')
  })
})
