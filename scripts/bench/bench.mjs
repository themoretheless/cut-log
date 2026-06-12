// Benchmark: box "drawing" (geometry generation) — original TypeScript vs the
// new Rust/wasm box_model + box_layout. Both run in the same Node runtime so the
// comparison is apples-to-apples (JS arithmetic+strings vs wasm + JSON bridge).
//
// Run: node scripts/bench/bench.mjs

import { buildAll } from './ts-geom.mjs'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const wasm = require('../../crates/wasm/pkg-node/cutter_wasm.js')

const cases = [
  { name: 'basic',       W: 300, H: 400, D: 200, T: 6, Kerf: 0.1, TabH: 30, NTab: 1, NShelves: 0, Bevel: 0,  SheetW: 1220, SheetH: 2440, CutGap: 5 },
  { name: 'shelves2',    W: 300, H: 400, D: 200, T: 6, Kerf: 0.1, TabH: 30, NTab: 1, NShelves: 2, Bevel: 0,  SheetW: 1220, SheetH: 2440, CutGap: 5 },
  { name: 'bevel+shelf', W: 350, H: 500, D: 250, T: 6, Kerf: 0.1, TabH: 30, NTab: 2, NShelves: 2, Bevel: 30, SheetW: 1220, SheetH: 2440, CutGap: 5 },
  { name: 'heavy',       W: 800, H: 1200, D: 600, T: 10, Kerf: 0.3, TabH: 40, NTab: 4, NShelves: 5, Bevel: 0, SheetW: 1220, SheetH: 2440, CutGap: 6 },
]

const N = 20000
const WARM = 2000

function paramsFor(c) {
  return { w: c.W, h: c.H, d: c.D, t: c.T, kerf: c.Kerf, tab_h: c.TabH, n_tab: c.NTab, n_shelves: c.NShelves, bevel: c.Bevel }
}

// TS path: build the JS objects the renderer consumes (no serialization needed).
function runTS(c) {
  const r = buildAll(c)
  // touch outputs so nothing is optimized away
  return r.gallery.length + r.scene.panels.length + r.layout.length
}

// wasm path: call into wasm and JSON.parse the result (what the frontend does).
function runWasm(c) {
  const p = JSON.stringify(paramsFor(c))
  const model = JSON.parse(wasm.box_model(p))
  const layout = JSON.parse(wasm.box_layout(p, c.SheetW, c.SheetH, c.CutGap))
  return model.gallery.length + model.scene.panels.length + layout.length
}

function timeit(fn, c, n) {
  let acc = 0
  for (let i = 0; i < WARM; i++) acc += fn(c)
  const t0 = process.hrtime.bigint()
  for (let i = 0; i < n; i++) acc += fn(c)
  const t1 = process.hrtime.bigint()
  const ns = Number(t1 - t0)
  return { acc, usPerOp: ns / n / 1000, opsPerSec: n / (ns / 1e9) }
}

function verifyParity(c) {
  // Spot-check: wasm and TS produce the same SVG paths and layout positions.
  const p = JSON.stringify(paramsFor(c))
  const model = JSON.parse(wasm.box_model(p))
  const layout = JSON.parse(wasm.box_layout(p, c.SheetW, c.SheetH, c.CutGap))
  const ts = buildAll(c)
  const wPaths = model.gallery.map(g => g.path).join('|')
  const tPaths = ts.gallery.map(g => g.path).join('|')
  const wLay = layout.flat().map(p => `${p.x},${p.y},${p.w},${p.h}`).join('|')
  const tLay = ts.layout.flat().map(p => `${p.x},${p.y},${p.w},${p.h}`).join('|')
  return wPaths === tPaths && wLay === tLay
}

console.log(`Box geometry generation — TypeScript vs Rust/wasm (Node ${process.version})`)
console.log(`iterations per case: ${N} (after ${WARM} warmup)\n`)
console.log('case'.padEnd(13), 'parity'.padEnd(8), 'TS µs/op'.padEnd(11), 'wasm µs/op'.padEnd(12), 'speedup')
console.log('-'.repeat(58))

let tsTotal = 0, wasmTotal = 0
for (const c of cases) {
  const parity = verifyParity(c) ? 'ok' : 'MISMATCH'
  const ts = timeit(runTS, c, N)
  const ws = timeit(runWasm, c, N)
  tsTotal += ts.usPerOp; wasmTotal += ws.usPerOp
  const speedup = ts.usPerOp / ws.usPerOp
  const faster = speedup >= 1 ? `${speedup.toFixed(2)}x wasm` : `${(1 / speedup).toFixed(2)}x TS`
  console.log(
    c.name.padEnd(13),
    parity.padEnd(8),
    ts.usPerOp.toFixed(2).padEnd(11),
    ws.usPerOp.toFixed(2).padEnd(12),
    faster,
  )
}
console.log('-'.repeat(58))
console.log('totals'.padEnd(13), ''.padEnd(8), tsTotal.toFixed(2).padEnd(11), wasmTotal.toFixed(2).padEnd(12), `${(tsTotal / wasmTotal).toFixed(2)}x`)
