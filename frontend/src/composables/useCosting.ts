import { computed, ref, toValue, type MaybeRefOrGetter, type Ref } from 'vue'
import { computeCostSummary } from '@/lib/costSummary'
import type { CuttingResult } from '@/services/types'

interface CostingOptions {
  result: MaybeRefOrGetter<CuttingResult | null>
  pricePerSheet?: Ref<number>
  currency?: Ref<string>
}

export function useCosting(options: CostingOptions) {
  const pricePerSheet = options.pricePerSheet ?? ref(0)
  const currency = options.currency ?? ref('₽')
  const summary = computed(() => {
    const result = toValue(options.result)
    return result ? computeCostSummary(result, pricePerSheet.value) : null
  })
  const isVisible = computed(() => summary.value !== null && pricePerSheet.value > 0)

  function reset() {
    pricePerSheet.value = 0
    currency.value = '₽'
  }

  return { pricePerSheet, currency, summary, isVisible, reset }
}
