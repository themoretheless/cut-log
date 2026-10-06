import { createApp, nextTick, type App as VueApp } from 'vue'
import App from './App.vue'
import '../shared/styles.css'
import {
  domSignature,
  forceLayout,
  measuredUpdate,
  type DomSignature,
  type FrameworkBenchmark,
} from '../shared/harness'
import { initializeSkadisState, toggleBoardSize, togglePitch } from './state'

const targetElement = document.querySelector<HTMLElement>('#app')
if (!targetElement) throw new Error('Missing #app benchmark target')
const target: HTMLElement = targetElement

let app: VueApp<Element> | null = null

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
  framework: 'vue',
  workload: 'skadis',
  operations: ['pitch', 'board-size'],
  async mount() {
    if (app) throw new Error('Vue benchmark is already mounted')
    initializeSkadisState()
    const started = performance.now()
    app = createApp(App)
    app.mount(target)
    await nextTick()
    forceLayout(target)
    return performance.now() - started
  },
  async prepare(operation) {
    if (!app) throw new Error('Vue benchmark is not mounted')
    if (operation !== 'pitch' && operation !== 'board-size') {
      throw new Error(`Unknown Vue SKÅDIS operation: ${operation}`)
    }
    initializeSkadisState()
    await nextTick()
    forceLayout(target)
  },
  async run(operation) {
    if (!app) throw new Error('Vue benchmark is not mounted')
    if (operation === 'pitch') {
      return measuredUpdate(target, togglePitch, nextTick)
    }
    if (operation === 'board-size') {
      return measuredUpdate(target, toggleBoardSize, nextTick)
    }
    throw new Error(`Unknown Vue SKÅDIS operation: ${operation}`)
  },
  async destroy() {
    app?.unmount()
    app = null
    target.replaceChildren()
    await nextTick()
  },
  signature: skadisSignature,
}

window.__frameworkBenchmark = benchmark
