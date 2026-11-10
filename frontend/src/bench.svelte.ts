import { mount, tick } from 'svelte'
import BenchRows from './BenchRows.svelte'
// @ts-expect-error plain JS module shared with frontend-svet
import { createOps } from './benchOps.js'

/**
 * Same content as the Forma scene: one static text row per piece, so the
 * measurement compares the frameworks rather than two different screens.
 */
interface Row {
  key: number
  text: string
}

function buildRows(count: number, filter: string): Row[] {
  const rows: Row[] = []
  for (let index = 0; index < count; index++) {
    const label = `Piece ${index}`
    if (filter && !label.includes(filter)) continue
    rows.push({ key: index, text: `${label}  ${200 + (index % 400)} x ${150 + (index % 300)}  1` })
  }
  return rows
}

const host = document.getElementById('app')!
let rows = $state<Row[]>([])
mount(BenchRows, { target: host, props: { get rows() { return rows } } })

const round = (value: number) => Math.round(value * 10) / 10

const ops = createOps()

;(window as unknown as Record<string, unknown>).__svelteBench = {
  async op(name: string) {
    const next = ops[name](rows)
    const start = performance.now()
    rows = next
    await tick()
    void host.offsetHeight
    return Math.round((performance.now() - start) * 100) / 100
  },
  text: () => [...host.querySelectorAll('.bench-row')].map(n => n.textContent),
  async render(count: number, filter = '') {
    const buildStart = performance.now()
    const next = buildRows(count, filter)
    const buildMs = performance.now() - buildStart

    const commitStart = performance.now()
    rows = next
    await tick()
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
