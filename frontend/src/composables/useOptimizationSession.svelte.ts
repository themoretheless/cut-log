import { startOptimization, type OptimizationTask } from '@/services/optimizerWorker'
import type { OptimizerWorkerRequest } from '@/services/optimizer.worker'
import type { CuttingResult } from '@/services/types'

export type OptimizationState =
  | { status: 'idle'; result: null; error: null }
  | { status: 'running'; result: null; error: null }
  | { status: 'success'; result: CuttingResult; error: null }
  | { status: 'error'; result: null; error: Error }
  | { status: 'cancelled'; result: null; error: null }

type OptimizationStarter = (input: OptimizerWorkerRequest) => OptimizationTask

function idleState(): OptimizationState {
  return { status: 'idle', result: null, error: null }
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}

/** Owns worker lifetime and exposes one explicit state instead of coupled flags. */
export function useOptimizationSession(start: OptimizationStarter = startOptimization) {
  // Mirrors Vue's shallowRef: the state object is swapped wholesale.
  let current = $state.raw<OptimizationState>(idleState())
  let generation = 0
  let activeTask: OptimizationTask | null = null

  const status = $derived(current.status)
  const result = $derived(current.result)
  const isRunning = $derived(current.status === 'running')

  async function run(input: OptimizerWorkerRequest): Promise<CuttingResult | null> {
    const currentGeneration = ++generation
    activeTask?.cancel()
    activeTask = null
    current = { status: 'running', result: null, error: null }

    let task: OptimizationTask | null = null
    try {
      task = start(input)
      activeTask = task
      const nextResult = await task.promise
      if (currentGeneration !== generation) return null
      current = { status: 'success', result: nextResult, error: null }
      return nextResult
    } catch (error) {
      if (currentGeneration !== generation) return null
      const failure = toError(error)
      if (failure.name === 'AbortError') {
        current = { status: 'cancelled', result: null, error: null }
        return null
      }
      current = { status: 'error', result: null, error: failure }
      return null
    } finally {
      if (activeTask === task) activeTask = null
    }
  }

  function cancel() {
    if (current.status !== 'running') return
    generation++
    const task = activeTask
    activeTask = null
    current = { status: 'cancelled', result: null, error: null }
    task?.cancel()
  }

  function invalidate() {
    generation++
    const task = activeTask
    activeTask = null
    current = idleState()
    task?.cancel()
  }

  function dispose() {
    invalidate()
  }

  return {
    get state() { return current },
    get status() { return status },
    get result() { return result },
    get isRunning() { return isRunning },
    run,
    cancel,
    invalidate,
    dispose,
  }
}
