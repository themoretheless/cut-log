import { mount, tick } from 'svelte'
import BenchRows from './BenchRows.svelte'

/**
 * Same content as the Forma scene: one static text row per piece, so the
 * measurement compares the frameworks rather than two different screens.
 */
function buildRows(count: number, filter: string): string[] {
  const rows: string[] = []
  for (let index = 0; index < count; index++) {
    const label = `Piece ${index}`
    if (filter && !label.includes(filter)) continue
    rows.push(`${label}  ${200 + (index % 400)} x ${150 + (index % 300)}  1`)
  }
  return rows
}

const host = document.getElementById('app')!
let rows = $state<string[]>([])
mount(BenchRows, { target: host, props: { get rows() { return rows } } })

const round = (value: number) => Math.round(value * 10) / 10

;(window as unknown as Record<string, unknown>).__svelteBench = {
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
