import type { SkadisSettings } from '@cutlog/skadis/geometry'

const BASE_SETTINGS: Readonly<SkadisSettings> = {
  width: 1800,
  height: 1200,
  cornerRadius: 8,
  slotWidth: 5,
  slotHeight: 15,
  pitch: 20,
  margin: 20,
  rowOffsetPercent: 50,
  columnOffsetPercent: 0,
}

let pitchShifted = false
let boardExpanded = false

class SkadisState {
  settings = $state.raw<SkadisSettings>({ ...BASE_SETTINGS })
}

export const skadisState = new SkadisState()

function applySettings(): void {
  skadisState.settings = {
    ...BASE_SETTINGS,
    width: boardExpanded ? 2000 : BASE_SETTINGS.width,
    height: boardExpanded ? 1400 : BASE_SETTINGS.height,
    pitch: pitchShifted ? 24 : BASE_SETTINGS.pitch,
  }
}

export function initializeSkadisState(): void {
  pitchShifted = false
  boardExpanded = false
  applySettings()
}

export function togglePitch(): void {
  pitchShifted = !pitchShifted
  applySettings()
}

export function toggleBoardSize(): void {
  boardExpanded = !boardExpanded
  applySettings()
}
