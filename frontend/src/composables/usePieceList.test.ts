import { describe, expect, it } from 'vitest'
import { nextTick, ref } from 'vue'
import { usePieceList } from './usePieceList'
import { addDimensionDelta } from '@/lib/pieceEditor'
import { PIECE_COLORS } from '@/lib/palette'

const input = (label: string, width = 400, height = 300) => ({
  label,
  width,
  height,
  quantity: 1,
  allowRotation: true,
})

describe('usePieceList', () => {
  it('owns CRUD, selection, and deterministic color allocation', () => {
    let id = 0
    const list = usePieceList({
      sheetWidth: 2440,
      sheetHeight: 1220,
      minMachineCut: 30,
      createId: () => `copy-${++id}`,
    })
    const first = list.add(input('First'))
    list.add(input('Second'))
    const duplicate = list.duplicate(first.id, true)

    expect(list.pieces.map(piece => piece.label)).toEqual(['First', 'First', 'Second'])
    expect([first.id, duplicate?.copy.id]).toEqual(['copy-1', 'copy-3'])
    expect(duplicate?.copy.color).not.toBe(first.color)
    expect(list.selectedPieceId.value).toBe(duplicate?.copy.id)
    expect(list.remove(duplicate!.copy)).toBe(true)
    expect(list.selectedPieceId.value).toBeNull()
    expect(list.clear()).toBe(2)
  })

  it('filters by query, diagnostics, and live sheet dimensions', () => {
    const sheetWidth = ref(1000)
    const list = usePieceList({ sheetWidth, sheetHeight: 500, minMachineCut: 30 })
    list.addMany([
      input('', 20, 100),
      input('Door', 1200, 600),
      input('Shelf', 400, 300),
    ])

    expect(list.unnamedPiecesCount.value).toBe(1)
    expect(list.smallMachinePieces.value).toHaveLength(1)
    expect(list.oversizedPieces.value).toHaveLength(1)
    list.quickFilterMode.value = 'oversized'
    expect(list.visiblePieces.value.map(entry => entry.piece.label)).toEqual(['Door'])
    sheetWidth.value = 1300
    expect(list.oversizedPieces.value).toHaveLength(1)
    list.pieceQuery.value = 'shelf'
    list.quickFilterMode.value = 'all'
    expect(list.visiblePieces.value.map(entry => entry.piece.label)).toEqual(['Shelf'])
  })

  it('keeps locked slots stable during sort, bulk edit, and reorder', () => {
    const list = usePieceList({ sheetWidth: 2440, sheetHeight: 1220, minMachineCut: 30 })
    list.addMany([input('Small', 100, 100), input('Locked', 200, 200), input('Large', 500, 500)])
    list.pieces[1].locked = true

    expect(list.sort('area_desc')).toBe(true)
    expect(list.pieces.map(piece => piece.label)).toEqual(['Large', 'Locked', 'Small'])
    const mutation = list.mutateVisibleDimensions(piece => addDimensionDelta(piece, 2))
    expect(mutation).toMatchObject({ changed: 2, skipped: 1 })
    expect(list.pieces[1]).toMatchObject({ label: 'Locked', width: 200, height: 200 })
    expect(list.move(0, 1)).toBe(true)
    expect(list.pieces.map(piece => piece.label)).toEqual(['Small', 'Locked', 'Large'])
  })

  it('keeps the color sequence stable across deletion and reorder', () => {
    const list = usePieceList({ sheetWidth: 2440, sheetHeight: 1220, minMachineCut: 30 })
    list.addMany([input('A'), input('B'), input('C')])
    list.remove(list.pieces[1])
    expect(list.move(0, 1)).toBe(true)
    expect(list.add(input('D')).color).toBe(PIECE_COLORS[3])
  })

  it('clears selection when the selected piece leaves the list by any path', async () => {
    const list = usePieceList({ sheetWidth: 2440, sheetHeight: 1220, minMachineCut: 30 })
    const piece = list.add(input('Solo'))
    list.toggleSelect(piece.id)
    expect(list.selectedPieceId.value).toBe(piece.id)

    list.replace([])
    await nextTick()
    expect(list.selectedPieceId.value).toBeNull()
  })

  it('reports a change for every lock toggle so run() always commits it', () => {
    const list = usePieceList({ sheetWidth: 2440, sheetHeight: 1220, minMachineCut: 30 })
    const piece = list.add(input('Lockable'))

    expect(list.toggleLock(piece)).toBe(true)
    expect(piece.locked).toBe(true)
    expect(list.toggleLock(piece)).toBe(true)
    expect(piece.locked).toBeUndefined()
  })

  it('repairs duplicate ids when applying external project state', () => {
    const ids = ['repaired-id']
    const list = usePieceList({
      sheetWidth: 2440,
      sheetHeight: 1220,
      minMachineCut: 30,
      createId: () => ids.shift()!,
    })
    const base = {
      id: 'same-id', label: 'Same', width: 400, height: 300,
      quantity: 1, allowRotation: true, color: '#fff',
    }

    list.replace([base, { ...base }])

    expect(list.pieces.map(piece => piece.id)).toEqual(['same-id', 'repaired-id'])
  })
})
