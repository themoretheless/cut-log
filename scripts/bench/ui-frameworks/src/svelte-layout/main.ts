import { mount as mountComponent, tick, unmount } from 'svelte'
import App from './App.svelte'
import '../shared/styles.css'
import { domSignature, forceLayout, measuredUpdate, type FrameworkBenchmark } from '../shared/harness'
import { layoutFixtureFromLocation } from '../shared/layoutFixture'
import { initializeLayoutState, layoutState } from './state.svelte.ts'

const targetElement = document.querySelector<HTMLElement>('#app')
if (!targetElement) throw new Error('Missing #app benchmark target')
const target: HTMLElement = targetElement

const fixture = layoutFixtureFromLocation()
let app: Record<string, unknown> | null = null

const benchmark: FrameworkBenchmark = {
  framework: 'svelte',
  workload: 'layout',
  operations: ['select-from-none', 'switch-selection', 'clear-selection', 'geometry'],
  async mount() {
    if (app) throw new Error('Svelte benchmark is already mounted')
    initializeLayoutState(fixture)
    const started = performance.now()
    app = mountComponent(App, { target })
    await tick()
    forceLayout(target)
    return performance.now() - started
  },
  async prepare(operation) {
    if (!app) throw new Error('Svelte benchmark is not mounted')
    if (operation === 'select-from-none') layoutState.selectedPieceId = null
    else if (operation === 'switch-selection' || operation === 'clear-selection') {
      layoutState.selectedPieceId = fixture.selectionIds[0]
    } else if (operation === 'geometry') layoutState.sheets = fixture.initial
    else throw new Error(`Unknown Svelte layout operation: ${operation}`)
    await tick()
    forceLayout(target)
  },
  async run(operation) {
    if (!app) throw new Error('Svelte benchmark is not mounted')
    if (operation === 'select-from-none') {
      return measuredUpdate(target, () => {
        layoutState.selectedPieceId = fixture.selectionIds[0]
      }, tick)
    }
    if (operation === 'switch-selection') {
      return measuredUpdate(target, () => {
        layoutState.selectedPieceId = fixture.selectionIds[1]
      }, tick)
    }
    if (operation === 'clear-selection') {
      return measuredUpdate(target, () => {
        layoutState.selectedPieceId = null
      }, tick)
    }
    if (operation === 'geometry') {
      return measuredUpdate(target, () => {
        layoutState.sheets = fixture.shifted
      }, tick)
    }
    throw new Error(`Unknown Svelte layout operation: ${operation}`)
  },
  async destroy() {
    if (app) await unmount(app)
    app = null
    target.replaceChildren()
    await tick()
  },
  signature() {
    return domSignature(target)
  },
}

window.__frameworkBenchmark = benchmark
