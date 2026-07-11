import { optimize } from './optimizer'
import type { CutPiece, CuttingResult, CuttingStrategy } from './types'

export interface OptimizerWorkerRequest {
  sheetWidth: number
  sheetHeight: number
  pieces: CutPiece[]
  kerf: number
  strategy: CuttingStrategy
}

export type OptimizerWorkerResponse =
  | { ok: true; result: CuttingResult }
  | { ok: false; error: string }

self.onmessage = async (event: MessageEvent<OptimizerWorkerRequest>) => {
  const { sheetWidth, sheetHeight, pieces, kerf, strategy } = event.data
  try {
    const result = await optimize(sheetWidth, sheetHeight, pieces, kerf, strategy)
    self.postMessage({ ok: true, result } satisfies OptimizerWorkerResponse)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    self.postMessage({ ok: false, error: message } satisfies OptimizerWorkerResponse)
  }
}
