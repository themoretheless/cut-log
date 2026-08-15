// @vitest-environment happy-dom
// Runes need the client build of Svelte, which Vitest only resolves for a
// browser-like environment. The Worker itself is faked below.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { startOptimization } from './optimizerWorker'
import { CuttingStrategy, type CuttingResult } from './types'

const input = () => ({
  sheetWidth: 2440,
  sheetHeight: 1220,
  pieces: [{
    id: 'piece-1', label: 'Shelf', width: 500, height: 300,
    quantity: 1, allowRotation: true, color: '#4A90D9',
  }],
  kerf: 3,
  strategy: CuttingStrategy.Auto,
})

const result: CuttingResult = {
  sheets: [], unplacedPieces: [], strategy: CuttingStrategy.Auto,
  totalSheets: 0, totalUsedArea: 0, totalArea: 0, overallEfficiency: 0,
}

class FakeWorker {
  static instances: FakeWorker[] = []
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: ErrorEvent) => void) | null = null
  posted: unknown
  terminated = false

  constructor() {
    FakeWorker.instances.push(this)
  }

  postMessage(value: unknown) {
    this.posted = value
  }

  terminate() {
    this.terminated = true
  }
}

/**
 * Stands in for Vue's `isReactive`: a Svelte `$state` proxy is an exotic
 * object, so `structuredClone` (what `postMessage` does for real) rejects it.
 * A plain snapshot clones without throwing.
 */
function isStructuredCloneable(value: unknown): boolean {
  try {
    structuredClone(value)
    return true
  } catch {
    return false
  }
}

afterEach(() => {
  FakeWorker.instances = []
  vi.unstubAllGlobals()
})

describe('optimizer Worker client', () => {
  it('posts a plain snapshot and disposes after success', async () => {
    vi.stubGlobal('Worker', FakeWorker)
    const reactiveInput = $state(input())
    // Guard the guard: the reactive source really is not postable as-is.
    expect(isStructuredCloneable(reactiveInput)).toBe(false)

    const task = startOptimization(reactiveInput)
    const worker = FakeWorker.instances[0]

    expect(worker.posted).not.toBe(reactiveInput)
    expect(isStructuredCloneable(worker.posted)).toBe(true)
    expect(isStructuredCloneable((worker.posted as ReturnType<typeof input>).pieces)).toBe(true)
    expect(worker.posted).toEqual(input())
    worker.onmessage?.({ data: { ok: true, result } } as MessageEvent)

    await expect(task.promise).resolves.toBe(result)
    expect(worker.terminated).toBe(true)
  })

  it('rejects cancellation with AbortError and terminates the Worker', async () => {
    vi.stubGlobal('Worker', FakeWorker)
    const task = startOptimization(input())
    const worker = FakeWorker.instances[0]
    const rejection = expect(task.promise).rejects.toMatchObject({ name: 'AbortError' })

    task.cancel()

    await rejection
    expect(worker.terminated).toBe(true)
  })

  it('turns Worker construction failures into task rejections', async () => {
    vi.stubGlobal('Worker', class {
      constructor() { throw new Error('Workers blocked') }
    })

    const task = startOptimization(input())
    await expect(task.promise).rejects.toThrow('Workers blocked')
  })

  it('rejects runtime Worker failures and still terminates', async () => {
    vi.stubGlobal('Worker', FakeWorker)
    const task = startOptimization(input())
    const worker = FakeWorker.instances[0]

    worker.onerror?.({ message: 'Worker crashed' } as ErrorEvent)

    await expect(task.promise).rejects.toThrow('Worker crashed')
    expect(worker.terminated).toBe(true)
  })

  it('preserves a validation message returned by the Worker', async () => {
    vi.stubGlobal('Worker', FakeWorker)
    const task = startOptimization(input())
    const worker = FakeWorker.instances[0]

    worker.onmessage?.({
      data: { ok: false, error: 'kerf must be zero or greater' },
    } as MessageEvent)

    await expect(task.promise).rejects.toThrow('kerf must be zero or greater')
    expect(worker.terminated).toBe(true)
  })
})
