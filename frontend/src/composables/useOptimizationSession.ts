import { computed, shallowRef } from 'vue'
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
  const state = shallowRef<OptimizationState>(idleState())
  let generation = 0
  let activeTask: OptimizationTask | null = null

  const status = computed(() => state.value.status)
  const result = computed(() => state.value.result)
  const isRunning = computed(() => state.value.status === 'running')

  async function run(input: OptimizerWorkerRequest): Promise<CuttingResult | null> {
    const currentGeneration = ++generation
    activeTask?.cancel()
    activeTask = null
    state.value = { status: 'running', result: null, error: null }

    let task: OptimizationTask | null = null
    try {
      task = start(input)
      activeTask = task
      const nextResult = await task.promise
      if (currentGeneration !== generation) return null
      state.value = { status: 'success', result: nextResult, error: null }
      return nextResult
    } catch (error) {
      if (currentGeneration !== generation) return null
      const failure = toError(error)
      if (failure.name === 'AbortError') {
        state.value = { status: 'cancelled', result: null, error: null }
        return null
      }
      state.value = { status: 'error', result: null, error: failure }
      return null
    } finally {
      if (activeTask === task) activeTask = null
    }
  }

  function cancel() {
    if (state.value.status !== 'running') return
    generation++
    const task = activeTask
    activeTask = null
    state.value = { status: 'cancelled', result: null, error: null }
    task?.cancel()
  }

  function invalidate() {
    generation++
    const task = activeTask
    activeTask = null
    state.value = idleState()
    task?.cancel()
  }

  function dispose() {
    invalidate()
  }

  return { state, status, result, isRunning, run, cancel, invalidate, dispose }
}
