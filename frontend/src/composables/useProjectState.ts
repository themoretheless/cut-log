import { ref, type MaybeRefOrGetter } from 'vue'
import type { HomeState } from '@/lib/homeState'
import { usePieceList } from './usePieceList'

interface ProjectStateOptions {
  minMachineCut: MaybeRefOrGetter<number>
  createId?: () => string
}

const DEFAULT_STATE: Omit<HomeState, 'pieces'> = {
  sheetWidth: 2440,
  sheetHeight: 1220,
  kerf: 3,
  pricePerSheet: 0,
  currency: '₽',
}

export function useProjectState(options: ProjectStateOptions) {
  const sheetWidth = ref(DEFAULT_STATE.sheetWidth)
  const sheetHeight = ref(DEFAULT_STATE.sheetHeight)
  const kerf = ref(DEFAULT_STATE.kerf)
  const pricePerSheet = ref(DEFAULT_STATE.pricePerSheet)
  const currency = ref(DEFAULT_STATE.currency)
  const pieceList = usePieceList({
    sheetWidth,
    sheetHeight,
    minMachineCut: options.minMachineCut,
    createId: options.createId,
  })

  function read(): HomeState {
    return {
      sheetWidth: sheetWidth.value,
      sheetHeight: sheetHeight.value,
      kerf: kerf.value,
      pieces: pieceList.pieces.map(piece => ({ ...piece })),
      pricePerSheet: pricePerSheet.value,
      currency: currency.value,
    }
  }

  function apply(state: HomeState) {
    sheetWidth.value = state.sheetWidth
    sheetHeight.value = state.sheetHeight
    kerf.value = state.kerf
    pricePerSheet.value = state.pricePerSheet
    currency.value = state.currency
    pieceList.replace(state.pieces.map(piece => ({ ...piece })))
  }

  function reset() {
    apply({ ...DEFAULT_STATE, pieces: [] })
    pieceList.clearFilters()
    pieceList.clearSelection()
  }

  return {
    sheetWidth,
    sheetHeight,
    kerf,
    pricePerSheet,
    currency,
    pieceList,
    read,
    apply,
    reset,
  }
}
