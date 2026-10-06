import '../shared/styles.css'
import { domSignature, forceLayout, measuredUpdate, type FrameworkBenchmark } from '../shared/harness'
import { layoutFixtureFromLocation } from '../shared/layoutFixture'
import { RetainedLayoutRenderer } from '../retained/layoutRenderer'

const targetElement = document.querySelector<HTMLElement>('#app')
if (!targetElement) throw new Error('Missing #app benchmark target')
const target: HTMLElement = targetElement

const fixture = layoutFixtureFromLocation()
let renderer: RetainedLayoutRenderer | null = null

const flush = async (): Promise<void> => {}

const benchmark: FrameworkBenchmark = {
  framework: 'retained',
  workload: 'layout',
  operations: ['select-from-none', 'switch-selection', 'clear-selection', 'geometry'],
  async mount() {
    if (renderer) throw new Error('Retained DOM benchmark is already mounted')
    const started = performance.now()
    renderer = new RetainedLayoutRenderer(target, fixture.initial, fixture.pieceIndexes)
    await flush()
    forceLayout(target)
    return performance.now() - started
  },
  async prepare(operation) {
    if (!renderer) throw new Error('Retained DOM benchmark is not mounted')
    if (operation === 'select-from-none') renderer.updateSelection(null)
    else if (operation === 'switch-selection' || operation === 'clear-selection') {
      renderer.updateSelection(fixture.selectionIds[0])
    } else if (operation === 'geometry') {
      renderer.updateGeometry(fixture.initial, fixture.pieceIndexes)
    } else throw new Error(`Unknown retained DOM layout operation: ${operation}`)
    await flush()
    forceLayout(target)
  },
  async run(operation) {
    if (!renderer) throw new Error('Retained DOM benchmark is not mounted')
    if (operation === 'select-from-none') {
      return measuredUpdate(target, () => {
        renderer?.updateSelection(fixture.selectionIds[0])
      }, flush)
    }
    if (operation === 'switch-selection') {
      return measuredUpdate(target, () => {
        renderer?.updateSelection(fixture.selectionIds[1])
      }, flush)
    }
    if (operation === 'clear-selection') {
      return measuredUpdate(target, () => {
        renderer?.updateSelection(null)
      }, flush)
    }
    if (operation === 'geometry') {
      return measuredUpdate(target, () => {
        renderer?.updateGeometry(fixture.shifted, fixture.pieceIndexes)
      }, flush)
    }
    throw new Error(`Unknown retained DOM layout operation: ${operation}`)
  },
  async destroy() {
    renderer?.destroy()
    renderer = null
    target.replaceChildren()
    await flush()
  },
  signature() {
    return domSignature(target)
  },
}

window.__frameworkBenchmark = benchmark
