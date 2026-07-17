import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { useCosting } from './useCosting'
import { CuttingStrategy, type CutPiece, type CuttingResult } from '@/services/types'

const piece: CutPiece = {
  id: 'piece-1',
  label: 'Shelf',
  width: 10,
  height: 10,
  quantity: 2,
  allowRotation: true,
  color: '#ffffff',
}

function result(): CuttingResult {
  return {
    sheets: [{
      index: 0,
      width: 100,
      height: 10,
      placedPieces: [
        { source: piece, x: 0, y: 0, width: 10, height: 10, isRotated: false },
        { source: piece, x: 10, y: 0, width: 10, height: 10, isRotated: false },
      ],
      usedArea: 200,
      totalArea: 1000,
      efficiency: 20,
    }],
    unplacedPieces: [],
    strategy: CuttingStrategy.Auto,
    totalSheets: 1,
    totalUsedArea: 200,
    totalArea: 1000,
    overallEfficiency: 20,
  }
}

describe('useCosting', () => {
  it('derives a live summary from the shared project inputs', () => {
    const optimization = ref<CuttingResult | null>(result())
    const price = ref(100)
    const currency = ref('$')
    const costing = useCosting({ result: optimization, pricePerSheet: price, currency })

    expect(costing.summary.value).toMatchObject({
      totalCost: 100,
      costPerPart: 50,
      wasteCost: 80,
    })
    expect(costing.isVisible.value).toBe(true)
    price.value = 250
    expect(costing.summary.value?.totalCost).toBe(250)
  })

  it('hides an absent or unpriced result and can reset owned inputs', () => {
    const optimization = ref<CuttingResult | null>(null)
    const costing = useCosting({ result: optimization })
    expect(costing.summary.value).toBeNull()
    optimization.value = result()
    expect(costing.isVisible.value).toBe(false)

    costing.pricePerSheet.value = 50
    costing.currency.value = '€'
    costing.reset()
    expect([costing.pricePerSheet.value, costing.currency.value]).toEqual([0, '₽'])
  })
})
