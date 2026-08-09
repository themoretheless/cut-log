import { describe, expect, it } from 'vitest'
import { effectScope, reactive, ref } from 'vue'
import { useResultSelection } from './useResultSelection'
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
    const pieces = reactive([source, piece('other')])
    const selectedPieceId = ref<string | null>('source')
    const optimization = ref<CuttingResult | null>(result({ ...source }))
    const scope = effectScope()
    const selection = scope.run(() => useResultSelection({ pieces, result: optimization, selectedPieceId }))!

    expect(selection.selectedPiece.value).toStrictEqual(source)
    expect(selection.placements.value).toEqual([{
      sheetIndex: 2,
      x: 5,
      y: 7,
      width: 10,
      height: 20,
      isRotated: true,
    }])
    expect(selection.stats.value).toMatchObject({ area: 200, totalArea: 400 })
    scope.stop()
  })

  it('projects nothing without mutating the selection it reads', () => {
    const pieces = reactive([piece('first')])
    const selectedPieceId = ref<string | null>('missing')
    const scope = effectScope()
    const selection = scope.run(() => useResultSelection({ pieces, result: null, selectedPieceId }))!

    expect(selection.selectedPiece.value).toBeNull()
    expect(selection.stats.value).toBeNull()
    expect(selectedPieceId.value).toBe('missing')
    scope.stop()
  })
})
