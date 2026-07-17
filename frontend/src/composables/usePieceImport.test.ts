import { describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import { usePieceImport } from './usePieceImport'
import type { CutPiece } from '@/services/types'

function existing(id: string, quantity: number): CutPiece {
  return {
    id,
    label: id,
    width: 100,
    height: 100,
    quantity,
    allowRotation: true,
    color: '#ffffff',
  }
}

describe('usePieceImport', () => {
  it('builds a live preview without mutating the project', () => {
    const pieces = reactive<CutPiece[]>([])
    const importer = usePieceImport({ pieces, sheetWidth: 1000, sheetHeight: 500, kerf: 3 })
    importer.text.value = 'Shelf\t400\t300\t2\nToo big\t1200\t800\t1\nnot a row'

    expect(importer.preview.value).toMatchObject({
      parsedCount: 2,
      acceptedCount: 1,
      invalidCount: 1,
      skippedCount: 1,
      totalSkipped: 2,
      totalQuantity: 2,
      capacityExceeded: false,
    })
    expect(pieces).toHaveLength(0)
  })

  it('rejects the entire import when the project quantity budget would overflow', () => {
    const pieces = reactive([existing('a', 950), existing('b', 950)])
    const importer = usePieceImport({ pieces, sheetWidth: 1000, sheetHeight: 500, kerf: 0 })
    const apply = vi.fn()
    importer.text.value = 'More\t100\t100\t200'

    expect(importer.preview.value.capacityExceeded).toBe(true)
    expect(importer.canCommit.value).toBe(false)
    expect(importer.commit(apply)).toBeNull()
    expect(apply).not.toHaveBeenCalled()
    expect(importer.text.value).not.toBe('')
  })

  it('commits valid rows once and clears text only after success', () => {
    const importer = usePieceImport({ pieces: [], sheetWidth: 1000, sheetHeight: 500, kerf: 0 })
    const apply = vi.fn()
    importer.text.value = 'A\t100\t100\t2\nB\t200\t100\t3\njunk'

    expect(importer.commit(apply)).toEqual({ added: 2, skipped: 1, quantity: 5 })
    expect(apply).toHaveBeenCalledOnce()
    expect(apply.mock.calls[0][0]).toHaveLength(2)
    expect(importer.text.value).toBe('')
  })
})
