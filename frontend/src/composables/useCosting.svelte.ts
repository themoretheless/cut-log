import { computeCostSummary } from '@/lib/costSummary'
import type { CuttingResult } from '@/services/types'

interface CostingOptions {
  result: () => CuttingResult | null
  pricePerSheet: () => number
}

/**
 * Svelte port note: unlike the Vue version this composable no longer owns
 * pricePerSheet/currency fallback refs. The page reads and mutates them on
 * useProjectState directly and passes a getter here.
 */
export function useCosting(options: CostingOptions) {
  const summary = $derived.by(() => {
    const result = options.result()
    return result ? computeCostSummary(result, options.pricePerSheet()) : null
  })
  const isVisible = $derived(summary !== null && options.pricePerSheet() > 0)

  return {
    get summary() { return summary },
    get isVisible() { return isVisible },
  }
}
