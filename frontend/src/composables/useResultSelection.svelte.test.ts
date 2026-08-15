// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { useResultSelection } from './useResultSelection.svelte'
import { CuttingStrategy, type CutPiece, type CuttingResult } from '@/services/types'

function piece(id: string, quantity = 2): CutPiece {
  return { id, label: id, width: 20, height: 10, quantity, allowRotation: true, color: '#ffffff' }
}

function result(source: CutPiece): CuttingResult {
  return {
    sheets: [{
      index: 2,
      width: 100,
      height: 100,
      placedPieces: [{ source, x: 5, y: 7, width: 10, height: 20, isRotated: true }],
      usedArea: 200,
      totalArea: 10000,
      efficiency: 2,
    }],
    unplacedPieces: [],
    strategy: CuttingStrategy.Auto,
    totalSheets: 1,
    totalUsedArea: 200,
    totalArea: 10000,
    overallEfficiency: 2,
  }
}

describe('useResultSelection', () => {
  it('reconciles placements by stable piece id and derives inspector stats', () => {
    const source = piece('source')
    const holder = $state({
      pieces: [source, piece('other')] as CutPiece[],
      result: result({ ...source }) as CuttingResult | null,
      selectedPieceId: 'source' as string | null,
    })
    let selection!: ReturnType<typeof useResultSelection>
    const stop = $effect.root(() => {
      selection = useResultSelection({
        pieces: () => holder.pieces,
        result: () => holder.result,
        selectedPieceId: () => holder.selectedPieceId,
      })
      return () => {}
    })

    expect(selection.selectedPiece).toStrictEqual(source)
    expect(selection.placements).toEqual([{
      sheetIndex: 2,
      x: 5,
      y: 7,
      width: 10,
      height: 20,
      isRotated: true,
    }])
    expect(selection.stats).toMatchObject({ area: 200, totalArea: 400 })
    stop()
  })

  it('projects nothing without mutating the selection it reads', () => {
    const holder = $state({
      pieces: [piece('first')] as CutPiece[],
      selectedPieceId: 'missing' as string | null,
    })
    let selection!: ReturnType<typeof useResultSelection>
    const stop = $effect.root(() => {
      selection = useResultSelection({
        pieces: () => holder.pieces,
        result: () => null,
        selectedPieceId: () => holder.selectedPieceId,
      })
      return () => {}
    })

    expect(selection.selectedPiece).toBeNull()
    expect(selection.stats).toBeNull()
    expect(holder.selectedPieceId).toBe('missing')
    stop()
  })
})
