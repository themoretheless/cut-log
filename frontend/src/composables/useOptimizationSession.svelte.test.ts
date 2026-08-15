// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import type { OptimizationTask } from '@/services/optimizerWorker'
import { CuttingStrategy, type CuttingResult } from '@/services/types'
import { useOptimizationSession } from './useOptimizationSession.svelte'

function result(efficiency = 80): CuttingResult {
  return {
    sheets: [],
    unplacedPieces: [],
    strategy: CuttingStrategy.Auto,
    totalSheets: 1,
    totalUsedArea: 80,
    totalArea: 100,
    overallEfficiency: efficiency,
  }
}

function input() {
  return {
    sheetWidth: 100,
    sheetHeight: 100,
    pieces: [],
    kerf: 0,
    strategy: CuttingStrategy.Auto,
  }
}

function deferredTask() {
  let resolve!: (value: CuttingResult) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<CuttingResult>((res, rej) => {
    resolve = res
    reject = rej
  })
  const cancel = vi.fn(() => {
    const error = new Error('cancelled')
    error.name = 'AbortError'
    reject(error)
  })
  return { task: { promise, cancel } satisfies OptimizationTask, resolve, reject }
}

function makeSession(start: Parameters<typeof useOptimizationSession>[0]) {
  let session!: ReturnType<typeof useOptimizationSession>
  const stop = $effect.root(() => {
    session = useOptimizationSession(start)
    return () => {}
  })
  return { get session() { return session }, stop }
}

describe('useOptimizationSession', () => {
  it('moves from idle through running to success', async () => {
    const deferred = deferredTask()
    const { session, stop } = makeSession(() => deferred.task)

    const pending = session.run(input())
    expect(session.state.status).toBe('running')

    deferred.resolve(result(91))
    await expect(pending).resolves.toMatchObject({ overallEfficiency: 91 })
    expect(session.state.status).toBe('success')
    expect(session.result?.overallEfficiency).toBe(91)
    stop()
  })

  it('exposes worker failures as an error state', async () => {
    const failure = new Error('worker failed')
    const { session, stop } = makeSession(() => ({
      promise: Promise.reject(failure),
      cancel: vi.fn(),
    }))

    await expect(session.run(input())).resolves.toBeNull()
    expect(session.state).toEqual({ status: 'error', result: null, error: failure })
    stop()
  })

  it('cancels a running task without allowing its rejection to overwrite state', async () => {
    const deferred = deferredTask()
    const { session, stop } = makeSession(() => deferred.task)
    const pending = session.run(input())

    session.cancel()
    await expect(pending).resolves.toBeNull()

    expect(deferred.task.cancel).toHaveBeenCalledOnce()
    expect(session.state.status).toBe('cancelled')
    stop()
  })

  it('keeps only the latest result when a run is superseded', async () => {
    const first = deferredTask()
    const second = deferredTask()
    const start = vi.fn()
      .mockReturnValueOnce(first.task)
      .mockReturnValueOnce(second.task)
    const { session, stop } = makeSession(start)

    const firstPending = session.run(input())
    const secondPending = session.run(input())
    second.resolve(result(95))

    await expect(firstPending).resolves.toBeNull()
    await expect(secondPending).resolves.toMatchObject({ overallEfficiency: 95 })
    expect(first.task.cancel).toHaveBeenCalledOnce()
    expect(session.result?.overallEfficiency).toBe(95)
    stop()
  })

  it('invalidates a result back to idle', async () => {
    const { session, stop } = makeSession(() => ({
      promise: Promise.resolve(result()),
      cancel: vi.fn(),
    }))
    await session.run(input())

    session.invalidate()

    expect(session.state.status).toBe('idle')
    expect(session.result).toBeNull()
    stop()
  })
})
