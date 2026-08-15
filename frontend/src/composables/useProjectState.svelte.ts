import { DEFAULT_HOME_SETTINGS, type HomeState } from '@/lib/homeState'
import { usePieceList } from './usePieceList.svelte'

interface ProjectStateOptions {
  minMachineCut: () => number
  createId?: () => string
}

export function useProjectState(options: ProjectStateOptions) {
  const state = $state({
    sheetWidth: DEFAULT_HOME_SETTINGS.sheetWidth,
    sheetHeight: DEFAULT_HOME_SETTINGS.sheetHeight,
    kerf: DEFAULT_HOME_SETTINGS.kerf,
    pricePerSheet: DEFAULT_HOME_SETTINGS.pricePerSheet,
    currency: DEFAULT_HOME_SETTINGS.currency,
  })
  const pieceList = usePieceList({
    sheetWidth: () => state.sheetWidth,
    sheetHeight: () => state.sheetHeight,
    minMachineCut: options.minMachineCut,
    createId: options.createId,
  })

  function read(): HomeState {
    return {
      sheetWidth: state.sheetWidth,
      sheetHeight: state.sheetHeight,
      kerf: state.kerf,
      pieces: pieceList.pieces.map(piece => ({ ...piece })),
      pricePerSheet: state.pricePerSheet,
      currency: state.currency,
    }
  }

  function apply(next: HomeState) {
    state.sheetWidth = next.sheetWidth
    state.sheetHeight = next.sheetHeight
    state.kerf = next.kerf
    state.pricePerSheet = next.pricePerSheet
    state.currency = next.currency
    pieceList.replace(next.pieces.map(piece => ({ ...piece })))
  }

  function reset() {
    apply({ ...DEFAULT_HOME_SETTINGS, pieces: [] })
    pieceList.clearFilters()
    pieceList.clearSelection()
  }

  return {
    get sheetWidth() { return state.sheetWidth },
    set sheetWidth(value: number) { state.sheetWidth = value },
    get sheetHeight() { return state.sheetHeight },
    set sheetHeight(value: number) { state.sheetHeight = value },
    get kerf() { return state.kerf },
    set kerf(value: number) { state.kerf = value },
    get pricePerSheet() { return state.pricePerSheet },
    set pricePerSheet(value: number) { state.pricePerSheet = value },
    get currency() { return state.currency },
    set currency(value: string) { state.currency = value },
    pieceList,
    read,
    apply,
    reset,
  }
}
