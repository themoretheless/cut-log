import { skadisSlots, type SkadisSettings } from '@cutlog/skadis/geometry'
import '../shared/styles.css'
import {
  domSignature,
  forceLayout,
  measuredUpdate,
  type DomSignature,
  type FrameworkBenchmark,
} from '../shared/harness'
import { RetainedSkadisRenderer } from '../retained/skadisRenderer'

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

const targetElement = document.querySelector<HTMLElement>('#app')
if (!targetElement) throw new Error('Missing #app benchmark target')
const target: HTMLElement = targetElement

let renderer: RetainedSkadisRenderer | null = null
let settings: SkadisSettings = { ...BASE_SETTINGS }
let pitchShifted = false
let boardExpanded = false

const flush = async (): Promise<void> => {}

function applySettings(): void {
  settings = {
    ...BASE_SETTINGS,
    width: boardExpanded ? 2000 : BASE_SETTINGS.width,
    height: boardExpanded ? 1400 : BASE_SETTINGS.height,
    pitch: pitchShifted ? 24 : BASE_SETTINGS.pitch,
  }
  renderer?.update(settings, skadisSlots(settings))
}

function skadisSignature(): DomSignature {
  const signature = domSignature(target)
  const slots = Array.from(target.querySelectorAll('[data-benchmark-slot]'))
  return {
    ...signature,
    interactivePieces: slots.length,
    firstPieceLabel: slots[0]?.getAttribute('data-benchmark-slot') ?? null,
    lastPieceLabel: slots[slots.length - 1]?.getAttribute('data-benchmark-slot') ?? null,
  }
}

const benchmark: FrameworkBenchmark = {
  framework: 'retained',
  workload: 'skadis',
  operations: ['pitch', 'board-size'],
  async mount() {
    if (renderer) throw new Error('Retained DOM benchmark is already mounted')
    pitchShifted = false
    boardExpanded = false
    settings = { ...BASE_SETTINGS }
    const started = performance.now()
    renderer = new RetainedSkadisRenderer(target, settings, skadisSlots(settings))
    await flush()
    forceLayout(target)
    return performance.now() - started
  },
  async prepare(operation) {
    if (!renderer) throw new Error('Retained DOM benchmark is not mounted')
    if (operation !== 'pitch' && operation !== 'board-size') {
      throw new Error(`Unknown retained DOM SKÅDIS operation: ${operation}`)
    }
    pitchShifted = false
    boardExpanded = false
    applySettings()
    await flush()
    forceLayout(target)
  },
  async run(operation) {
    if (!renderer) throw new Error('Retained DOM benchmark is not mounted')
    if (operation === 'pitch') {
      return measuredUpdate(target, () => {
        pitchShifted = !pitchShifted
        applySettings()
      }, flush)
    }
    if (operation === 'board-size') {
      return measuredUpdate(target, () => {
        boardExpanded = !boardExpanded
        applySettings()
      }, flush)
    }
    throw new Error(`Unknown retained DOM SKÅDIS operation: ${operation}`)
  },
  async destroy() {
    renderer?.destroy()
    renderer = null
    target.replaceChildren()
    await flush()
  },
  signature: skadisSignature,
}

window.__frameworkBenchmark = benchmark
