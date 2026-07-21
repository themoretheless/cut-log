import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const packageDir = resolve(repoRoot, process.argv[2] ?? 'crates/wasm/pkg')
const gluePath = resolve(packageDir, 'cutter_wasm.js')
const binaryPath = resolve(packageDir, 'cutter_wasm_bg.wasm')

await Promise.all([access(gluePath), access(binaryPath)])

const [{ default: init, optimize_sync: optimizeSync }, wasmBytes] = await Promise.all([
  import(pathToFileURL(gluePath).href),
  readFile(binaryPath),
])

const wasmModule = await WebAssembly.compile(wasmBytes)
await init({ module_or_path: wasmModule })

const validInput = {
  sheet_width: 100,
  sheet_height: 100,
  kerf: 1,
  strategy: 1,
  pieces: [
    {
      id: 'fits',
      label: 'Fits',
      width: 40,
      height: 30,
      quantity: 2,
      allow_rotation: true,
      color: '#336699',
    },
    {
      id: 'too-wide',
      label: 'Too wide',
      width: 120,
      height: 10,
      quantity: 1,
      allow_rotation: false,
      color: '#993333',
    },
  ],
}

const outputJson = optimizeSync(JSON.stringify(validInput))
assert.equal(typeof outputJson, 'string', 'WASM optimize() must return JSON text')

const output = JSON.parse(outputJson)
assert.ok(Array.isArray(output.sheets), 'result.sheets must be an array')
assert.ok(Array.isArray(output.unplaced_pieces), 'result.unplaced_pieces must be an array')

const actualCounts = new Map()
const count = (sourceId) => {
  assert.equal(typeof sourceId, 'string', 'every result piece must have a source_id')
  actualCounts.set(sourceId, (actualCounts.get(sourceId) ?? 0) + 1)
}

for (const sheet of output.sheets) {
  assert.ok(Array.isArray(sheet.placed_pieces), 'sheet.placed_pieces must be an array')
  for (const piece of sheet.placed_pieces) count(piece.source_id)
}
for (const piece of output.unplaced_pieces) count(piece.source_id)

for (const piece of validInput.pieces) {
  assert.equal(
    actualCounts.get(piece.id),
    piece.quantity,
    `placed/unplaced quantity must be conserved for ${piece.id}`,
  )
  actualCounts.delete(piece.id)
}
assert.equal(actualCounts.size, 0, 'result must not contain unknown source ids')
assert.ok(
  output.sheets.some((sheet) => sheet.placed_pieces.length > 0),
  'valid fixture must place at least one piece',
)
assert.ok(output.unplaced_pieces.length > 0, 'valid fixture must exercise unplaced pieces')

const invalidInput = { ...validInput, kerf: -1 }
let rejection
try {
  optimizeSync(JSON.stringify(invalidInput))
} catch (error) {
  rejection = error
}

assert.notEqual(rejection, undefined, 'invalid fixture must reject')
assert.equal(rejection?.kind, 'validation', 'invalid fixture must reject as a validation error')
assert.equal(rejection?.code, 'invalid_kerf', 'invalid fixture must expose a stable error code')
assert.match(rejection?.message ?? '', /kerf/i, 'invalid fixture must reject with a kerf error')

console.log('WASM smoke passed: real module loaded, result conserved, invalid input rejected')
