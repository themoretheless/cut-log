import type { Sheet } from '@cutlog/services/types'
import type { LayoutFixture } from '../shared/layoutFixture'

class LayoutState {
  // The fixtures are immutable snapshots. $state.raw is the Svelte equivalent
  // of Vue's shallowRef here and avoids proxying thousands of nested pieces.
  sheets = $state.raw<Sheet[]>([])
  selectedPieceId = $state<string | null>(null)
  pieceIndexes = $state.raw<Readonly<Record<string, number>>>({})
}

export const layoutState = new LayoutState()

export function initializeLayoutState(fixture: LayoutFixture): void {
  layoutState.sheets = fixture.initial
  layoutState.selectedPieceId = null
  layoutState.pieceIndexes = fixture.pieceIndexes
}
