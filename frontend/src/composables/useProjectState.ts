import { ref, type MaybeRefOrGetter } from 'vue'
import { DEFAULT_HOME_SETTINGS, type HomeState } from '@/lib/homeState'
import { usePieceList } from './usePieceList'

interface ProjectStateOptions {
  minMachineCut: MaybeRefOrGetter<number>
  createId?: () => string
}

export function useProjectState(options: ProjectStateOptions) {
  const sheetWidth = ref(DEFAULT_HOME_SETTINGS.sheetWidth)
  const sheetHeight = ref(DEFAULT_HOME_SETTINGS.sheetHeight)
  const kerf = ref(DEFAULT_HOME_SETTINGS.kerf)
  const pricePerSheet = ref(DEFAULT_HOME_SETTINGS.pricePerSheet)
  const currency = ref(DEFAULT_HOME_SETTINGS.currency)
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
    apply({ ...DEFAULT_HOME_SETTINGS, pieces: [] })
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
