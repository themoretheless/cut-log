// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { usePieceList } from './usePieceList.svelte'
import { addDimensionDelta } from '@/lib/pieceEditor'
import { PIECE_COLORS } from '@/lib/palette'

const input = (label: string, width = 400, height = 300) => ({
  label,
  width,
  height,
  quantity: 1,
  allowRotation: true,
})

function withList(
  options: Parameters<typeof usePieceList>[0],
  run: (list: ReturnType<typeof usePieceList>) => void,
) {
  let list!: ReturnType<typeof usePieceList>
  const stop = $effect.root(() => {
    list = usePieceList(options)
    return () => {}
  })
  try {
    run(list)
  } finally {
    stop()
  }
}

describe('usePieceList', () => {
  it('owns CRUD, selection, and deterministic color allocation', () => {
    let id = 0
    withList({
      sheetWidth: () => 2440,
      sheetHeight: () => 1220,
      minMachineCut: () => 30,
      createId: () => `copy-${++id}`,
    }, (list) => {
      const first = list.add(input('First'))
      list.add(input('Second'))
      const duplicate = list.duplicate(first.id, true)

      expect(list.pieces.map(piece => piece.label)).toEqual(['First', 'First', 'Second'])
      expect([first.id, duplicate?.copy.id]).toEqual(['copy-1', 'copy-3'])
      expect(duplicate?.copy.color).not.toBe(first.color)
      expect(list.selectedPieceId).toBe(duplicate?.copy.id)
      expect(list.remove(duplicate!.copy)).toBe(true)
      expect(list.selectedPieceId).toBeNull()
      expect(list.clear()).toBe(2)
    })
  })

  it('filters by query, diagnostics, and live sheet dimensions', () => {
    const sheet = $state({ width: 1000 })
    withList({
      sheetWidth: () => sheet.width,
      sheetHeight: () => 500,
      minMachineCut: () => 30,
    }, (list) => {
      list.addMany([
        input('', 20, 100),
        input('Door', 1200, 600),
        input('Shelf', 400, 300),
      ])

      expect(list.unnamedPiecesCount).toBe(1)
      expect(list.smallMachinePieces).toHaveLength(1)
      expect(list.oversizedPieces).toHaveLength(1)
      list.quickFilterMode = 'oversized'
      expect(list.visiblePieces.map(entry => entry.piece.label)).toEqual(['Door'])
      sheet.width = 1300
      expect(list.oversizedPieces).toHaveLength(1)
      list.pieceQuery = 'shelf'
      list.quickFilterMode = 'all'
      expect(list.visiblePieces.map(entry => entry.piece.label)).toEqual(['Shelf'])
    })
  })

  it('keeps locked slots stable during sort, bulk edit, and reorder', () => {
    withList({
      sheetWidth: () => 2440,
      sheetHeight: () => 1220,
      minMachineCut: () => 30,
    }, (list) => {
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
  })

  it('keeps the color sequence stable across deletion and reorder', () => {
    withList({
      sheetWidth: () => 2440,
      sheetHeight: () => 1220,
      minMachineCut: () => 30,
    }, (list) => {
      list.addMany([input('A'), input('B'), input('C')])
      list.remove(list.pieces[1])
      expect(list.move(0, 1)).toBe(true)
      expect(list.add(input('D')).color).toBe(PIECE_COLORS[3])
    })
  })

  it('clears selection when the selected piece leaves the list by any path', () => {
    withList({
      sheetWidth: () => 2440,
      sheetHeight: () => 1220,
      minMachineCut: () => 30,
    }, (list) => {
      const piece = list.add(input('Solo'))
      list.toggleSelect(piece.id)
      expect(list.selectedPieceId).toBe(piece.id)

      list.replace([])
      expect(list.selectedPieceId).toBeNull()
    })
  })

  it('reports a change for every lock toggle so run() always commits it', () => {
    withList({
      sheetWidth: () => 2440,
      sheetHeight: () => 1220,
      minMachineCut: () => 30,
    }, (list) => {
      const piece = list.add(input('Lockable'))

      expect(list.toggleLock(piece)).toBe(true)
      expect(piece.locked).toBe(true)
      expect(list.toggleLock(piece)).toBe(true)
      expect(piece.locked).toBeUndefined()
    })
  })

  it('repairs duplicate ids when applying external project state', () => {
    const ids = ['repaired-id']
    withList({
      sheetWidth: () => 2440,
      sheetHeight: () => 1220,
      minMachineCut: () => 30,
      createId: () => ids.shift()!,
    }, (list) => {
      const base = {
        id: 'same-id', label: 'Same', width: 400, height: 300,
        quantity: 1, allowRotation: true, color: '#fff',
      }

      list.replace([base, { ...base }])

      expect(list.pieces.map(piece => piece.id)).toEqual(['same-id', 'repaired-id'])
    })
  })
})
