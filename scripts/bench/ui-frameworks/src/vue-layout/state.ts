import { ref, shallowRef } from 'vue'
import type { Sheet } from '@cutlog/services/types'
import type { LayoutFixture } from '../shared/layoutFixture'

export const sheets = shallowRef<Sheet[]>([])
export const selectedPieceId = ref<string | null>(null)
export const pieceIndexes = shallowRef<Readonly<Record<string, number>>>({})

export function initializeLayoutState(fixture: LayoutFixture): void {
  sheets.value = fixture.initial
  selectedPieceId.value = null
  pieceIndexes.value = fixture.pieceIndexes
}
