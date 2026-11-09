// Same rows and the same measurement as the Svelte and Forma benches, written
// against svet-engine's own primitives: a signal holding the list and <For>,
// which reconciles keyed rows through its WASM LIS.
// Imported from the runtime modules rather than the package barrel: the barrel
// also re-exports the JSX compiler, which pulls @babel/parser and cannot load
// from a plain static server.
import { signal } from './vendor/svet-engine/reactivity.js'
import { h, For, mount } from './vendor/svet-engine/dom.js'

const status = document.getElementById('status')
const host = document.getElementById('app')

function buildRows(count, filter) {
  const rows = []
  for (let index = 0; index < count; index++) {
    const label = `Piece ${index}`
    if (filter && !label.includes(filter)) continue
    rows.push({ key: index, text: `${label}  ${200 + (index % 400)} x ${150 + (index % 300)}  1` })
  }
  return rows
}

const rows = signal(buildRows(0, ''))

mount(() => h('div', { class: 'bench-list' },
  For({
    each: rows,
    keyFn: row => row.key,
    children: row => h('div', { class: 'bench-row' }, row.text),
  }),
), host)

const round = value => Math.round(value * 10) / 10

window.__svetBench = {
  render(count, filter = '') {
    const buildStart = performance.now()
    const next = buildRows(count, filter)
    const buildMs = performance.now() - buildStart

    const commitStart = performance.now()
    rows.set(next)
    const commitMs = performance.now() - commitStart

    const layoutStart = performance.now()
    void host.offsetHeight
    const layoutMs = performance.now() - layoutStart

    return {
      rows: next.length,
      buildMs: round(buildMs),
      commitMs: round(commitMs),
      layoutMs: round(layoutMs),
      totalMs: round(buildMs + commitMs + layoutMs),
      domRows: host.querySelectorAll('.bench-row').length,
    }
  },
}

const first = window.__svetBench.render(20)
status.textContent = `Svet ready\n${JSON.stringify(first, null, 2)}`
