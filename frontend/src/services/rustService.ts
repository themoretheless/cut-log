/**
 * Low-level WASM module loader.
 * All Rust logic is compiled into cutter-wasm and loaded lazily on first call.
 */

type WasmModule = typeof import('../../wasm/cutter_wasm')

let wasm: WasmModule | null = null
let initPromise: Promise<void> | null = null

export async function ensureWasm(): Promise<WasmModule> {
  if (wasm) return wasm
  if (!initPromise) {
    initPromise = (async () => {
      const mod = await import('../../wasm/cutter_wasm')
      await mod.default({ module_or_path: `${import.meta.env.BASE_URL}cutter_wasm_bg.wasm` })
      wasm = mod
    })()
  }
  await initPromise
  return wasm!
}

export function getWasm(): WasmModule | null {
  return wasm
}
