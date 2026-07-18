import { CuttingStrategy } from '@/services/types'

export interface SheetPreset {
  key: string
  width: number
  height: number
}

export interface StrategyGroup {
  labelKey: string
  items: { value: CuttingStrategy; sortKey: string }[]
}

export const SHEET_PRESETS: readonly SheetPreset[] = [
  { key: '2440x1220', width: 2440, height: 1220 },
  { key: '2500x1250', width: 2500, height: 1250 },
  { key: '1525x1525', width: 1525, height: 1525 },
  { key: '2800x2070', width: 2800, height: 2070 },
  { key: '2750x1830', width: 2750, height: 1830 },
  { key: '2440x1830', width: 2440, height: 1830 },
  { key: '3050x1525', width: 3050, height: 1525 },
  { key: '1200x600', width: 1200, height: 600 },
]

export const STRATEGY_GROUPS: readonly StrategyGroup[] = [
  { labelKey: 'strategy.best_area', items: [
    { value: CuttingStrategy.BestArea_AreaDesc, sortKey: 'sort.area' },
    { value: CuttingStrategy.BestArea_MaxSideDesc, sortKey: 'sort.max_side' },
    { value: CuttingStrategy.BestArea_PerimeterDesc, sortKey: 'sort.perimeter' },
  ] },
  { labelKey: 'strategy.best_short', items: [
    { value: CuttingStrategy.BestShortSide_AreaDesc, sortKey: 'sort.area' },
    { value: CuttingStrategy.BestShortSide_MaxSideDesc, sortKey: 'sort.max_side' },
    { value: CuttingStrategy.BestShortSide_PerimeterDesc, sortKey: 'sort.perimeter' },
  ] },
  { labelKey: 'strategy.best_long', items: [
    { value: CuttingStrategy.BestLongSide_AreaDesc, sortKey: 'sort.area' },
    { value: CuttingStrategy.BestLongSide_MaxSideDesc, sortKey: 'sort.max_side' },
    { value: CuttingStrategy.BestLongSide_PerimeterDesc, sortKey: 'sort.perimeter' },
  ] },
]

export function strategyDisplayName(strategy: CuttingStrategy, translate: (key: string) => string): string {
  for (const group of STRATEGY_GROUPS) {
    for (const item of group.items) {
      if (item.value === strategy) return `${translate(group.labelKey)} \u00b7 ${translate(item.sortKey)}`
    }
  }
  return translate('strategy.auto')
}
