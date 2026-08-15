import { HOME_STATE_KEY, parseHomeState, serializeHomeState, type HomeState } from '@/lib/homeState'

interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export interface HomeStorageOptions {
  capture: () => HomeState
  apply: (state: HomeState) => void
  onError?: (error: unknown) => void
  storage?: StorageLike
  delay?: number
}

/** Svelte port note: the caller must invoke dispose() on unmount (no scope hook). */
export function useHomeStorage(options: HomeStorageOptions) {
  const storage = options.storage ?? localStorage
  const delay = options.delay ?? 300
  let timer: ReturnType<typeof setTimeout> | undefined

  function saveState(state: HomeState): boolean {
    clearTimeout(timer)
    timer = undefined
    try {
      storage.setItem(HOME_STATE_KEY, serializeHomeState(state))
      return true
    } catch (error) {
      options.onError?.(error)
      return false
    }
  }

  function saveNow(): boolean {
    return saveState(options.capture())
  }

  function scheduleSave() {
    clearTimeout(timer)
    timer = setTimeout(saveNow, delay)
  }

  function load(): boolean {
    try {
      const saved = parseHomeState(storage.getItem(HOME_STATE_KEY))
      if (!saved) return false
      options.apply(saved)
      // Persist the validated canonical form so repaired legacy/duplicate ids
      // stay stable on the next reload instead of being allocated again.
      try {
        storage.setItem(HOME_STATE_KEY, serializeHomeState(saved))
      } catch (error) {
        options.onError?.(error)
      }
      return true
    } catch (error) {
      options.onError?.(error)
      return false
    }
  }

  function dispose() {
    clearTimeout(timer)
    timer = undefined
  }

  return { scheduleSave, saveNow, saveState, load, dispose }
}
