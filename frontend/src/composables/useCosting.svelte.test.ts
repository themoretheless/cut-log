// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { useCosting } from './useCosting.svelte'
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
    const inputs = $state({ result: result() as CuttingResult | null, price: 100 })
    let costing!: ReturnType<typeof useCosting>
    const stop = $effect.root(() => {
      costing = useCosting({ result: () => inputs.result, pricePerSheet: () => inputs.price })
      return () => {}
    })

    expect(costing.summary).toMatchObject({
      totalCost: 100,
      costPerPart: 50,
      wasteCost: 80,
    })
    expect(costing.isVisible).toBe(true)
    inputs.price = 250
    expect(costing.summary?.totalCost).toBe(250)
    stop()
  })

  it('hides an absent or unpriced result', () => {
    const inputs = $state({ result: null as CuttingResult | null, price: 0 })
    let costing!: ReturnType<typeof useCosting>
    const stop = $effect.root(() => {
      costing = useCosting({ result: () => inputs.result, pricePerSheet: () => inputs.price })
      return () => {}
    })

    expect(costing.summary).toBeNull()
    inputs.result = result()
    expect(costing.isVisible).toBe(false)
    stop()
  })

  // The Vue composable owned fallback pricePerSheet/currency refs and a reset().
  // The Svelte port deliberately dropped them: the page now reads and mutates
  // those values on useProjectState and passes a getter in, so there is nothing
  // owned here to reset. useProjectState's own reset test covers the behavior.
  it.skip('can reset owned inputs', () => {})
})
