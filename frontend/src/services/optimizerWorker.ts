import type { CuttingResult } from './types'
import type { OptimizerWorkerRequest, OptimizerWorkerResponse } from './optimizer.worker'

export interface OptimizationTask {
  promise: Promise<CuttingResult>
  cancel: () => void
}

function abortError(): Error {
  const error = new Error('Optimization cancelled')
  error.name = 'AbortError'
  return error
}

/** One worker per run keeps the UI responsive and makes superseded runs cancellable. */
export function startOptimization(input: OptimizerWorkerRequest): OptimizationTask {
  let worker: Worker | null = null
  let settled = false
  let rejectPromise: (reason?: unknown) => void = () => undefined

  const finish = () => {
    settled = true
    if (!worker) return
    worker.onmessage = null
    worker.onerror = null
    worker.terminate()
    worker = null
  }

  const promise = new Promise<CuttingResult>((resolve, reject) => {
    rejectPromise = reject
    try {
      worker = new Worker(new URL('./optimizer.worker.ts', import.meta.url), {
        type: 'module',
        name: 'cutlog-optimizer',
      })
      worker.onmessage = (event: MessageEvent<OptimizerWorkerResponse>) => {
        if (settled) return
        const response = event.data
        finish()
        if (response.ok) resolve(response.result)
        else reject(new Error(response.error))
      }
      worker.onerror = event => {
        if (settled) return
        finish()
        reject(new Error(event.message || 'Optimizer worker failed'))
      }
      // Vue can leave nested reactive wrappers even after a shallow spread.
      // The worker protocol is JSON-shaped, so serialize once to guarantee a
      // cloneable snapshot and a strict boundary between UI and calculation.
      const snapshot = JSON.parse(JSON.stringify(input)) as OptimizerWorkerRequest
      worker.postMessage(snapshot)
    } catch (error) {
      finish()
      reject(error)
    }
  })

  return {
    promise,
    cancel() {
      if (settled) return
      finish()
      rejectPromise(abortError())
    },
  }
}
