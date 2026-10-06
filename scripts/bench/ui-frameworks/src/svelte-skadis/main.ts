import { mount as mountComponent, tick, unmount } from 'svelte'
import App from './App.svelte'
import '../shared/styles.css'
import {
  domSignature,
  forceLayout,
  measuredUpdate,
  type DomSignature,
  type FrameworkBenchmark,
} from '../shared/harness'
import { initializeSkadisState, toggleBoardSize, togglePitch } from './state.svelte.ts'

const targetElement = document.querySelector<HTMLElement>('#app')
if (!targetElement) throw new Error('Missing #app benchmark target')
const target: HTMLElement = targetElement

let app: Record<string, unknown> | null = null

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
  framework: 'svelte',
  workload: 'skadis',
  operations: ['pitch', 'board-size'],
  async mount() {
    if (app) throw new Error('Svelte benchmark is already mounted')
    initializeSkadisState()
    const started = performance.now()
    app = mountComponent(App, { target })
    await tick()
    forceLayout(target)
    return performance.now() - started
  },
  async prepare(operation) {
    if (!app) throw new Error('Svelte benchmark is not mounted')
    if (operation !== 'pitch' && operation !== 'board-size') {
      throw new Error(`Unknown Svelte SKÅDIS operation: ${operation}`)
    }
    initializeSkadisState()
    await tick()
    forceLayout(target)
  },
  async run(operation) {
    if (!app) throw new Error('Svelte benchmark is not mounted')
    if (operation === 'pitch') {
      return measuredUpdate(target, togglePitch, tick)
    }
    if (operation === 'board-size') {
      return measuredUpdate(target, toggleBoardSize, tick)
    }
    throw new Error(`Unknown Svelte SKÅDIS operation: ${operation}`)
  },
  async destroy() {
    if (app) await unmount(app)
    app = null
    target.replaceChildren()
    await tick()
  },
  signature: skadisSignature,
}

window.__frameworkBenchmark = benchmark
