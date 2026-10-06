import { createApp, nextTick, type App as VueApp } from 'vue'
import App from './App.vue'
import '../shared/styles.css'
import { domSignature, forceLayout, measuredUpdate, type FrameworkBenchmark } from '../shared/harness'
import { layoutFixtureFromLocation } from '../shared/layoutFixture'
import { initializeLayoutState, selectedPieceId, sheets } from './state'

const targetElement = document.querySelector<HTMLElement>('#app')
if (!targetElement) throw new Error('Missing #app benchmark target')
const target: HTMLElement = targetElement

const fixture = layoutFixtureFromLocation()
let app: VueApp<Element> | null = null

const benchmark: FrameworkBenchmark = {
  framework: 'vue',
  workload: 'layout',
  operations: ['select-from-none', 'switch-selection', 'clear-selection', 'geometry'],
  async mount() {
    if (app) throw new Error('Vue benchmark is already mounted')
    initializeLayoutState(fixture)
    const started = performance.now()
    app = createApp(App)
    app.mount(target)
    await nextTick()
    forceLayout(target)
    return performance.now() - started
  },
  async prepare(operation) {
    if (!app) throw new Error('Vue benchmark is not mounted')
    if (operation === 'select-from-none') selectedPieceId.value = null
    else if (operation === 'switch-selection' || operation === 'clear-selection') {
      selectedPieceId.value = fixture.selectionIds[0]
    } else if (operation === 'geometry') sheets.value = fixture.initial
    else throw new Error(`Unknown Vue layout operation: ${operation}`)
    await nextTick()
    forceLayout(target)
  },
  async run(operation) {
    if (!app) throw new Error('Vue benchmark is not mounted')
    if (operation === 'select-from-none') {
      return measuredUpdate(target, () => {
        selectedPieceId.value = fixture.selectionIds[0]
      }, nextTick)
    }
    if (operation === 'switch-selection') {
      return measuredUpdate(target, () => {
        selectedPieceId.value = fixture.selectionIds[1]
      }, nextTick)
    }
    if (operation === 'clear-selection') {
      return measuredUpdate(target, () => {
        selectedPieceId.value = null
      }, nextTick)
    }
    if (operation === 'geometry') {
      return measuredUpdate(target, () => {
        sheets.value = fixture.shifted
      }, nextTick)
    }
    throw new Error(`Unknown Vue layout operation: ${operation}`)
  },
  async destroy() {
    app?.unmount()
    app = null
    target.replaceChildren()
    await nextTick()
  },
  signature() {
    return domSignature(target)
  },
}

window.__frameworkBenchmark = benchmark
