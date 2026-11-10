// Same rows and the same measurement as the Svelte and Forma benches, written
// against svet-engine's own primitives: a signal holding the list and <For>,
// which reconciles keyed rows through its WASM LIS.
// ?v=<tag> picks a build from vendor/svet-<tag>; reactivity.js and dom.js are
// imported directly because the index of older builds pulls in the compiler.
const version = new URLSearchParams(location.search).get('v')
const base = version ? `./vendor/svet-${version}` : './vendor/svet-engine'
// Since 0.3.2 the WASM core lives in wasm-embedded.js; earlier builds embed it
// in the reactivity module and have no such file.
await import(`${base}/wasm-embedded.js`).catch(() => {})
const [{ signal }, { h, For, mount }] = await Promise.all([
  import(`${base}/reactivity.js`),
  import(`${base}/dom.js`),
])

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
status.textContent = `Svet ${version ?? 'engine'} ready\n${JSON.stringify(first, null, 2)}`
