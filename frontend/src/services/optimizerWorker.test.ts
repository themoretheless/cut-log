import { afterEach, describe, expect, it, vi } from 'vitest'
import { isReactive, reactive } from 'vue'
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

afterEach(() => {
  FakeWorker.instances = []
  vi.unstubAllGlobals()
})

describe('optimizer Worker client', () => {
  it('posts a plain snapshot and disposes after success', async () => {
    vi.stubGlobal('Worker', FakeWorker)
    const task = startOptimization(reactive(input()))
    const worker = FakeWorker.instances[0]

    expect(isReactive(worker.posted)).toBe(false)
    expect(isReactive((worker.posted as ReturnType<typeof input>).pieces)).toBe(false)
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
