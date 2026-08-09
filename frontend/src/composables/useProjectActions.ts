import { ref, shallowRef } from 'vue'

export interface ProjectActionEffects {
  invalidateLayout: boolean
  persist: boolean
  history: boolean
}

/**
 * Every editor command declares its browser-visible effects in one reviewable
 * registry. Adding a command without an effects policy is therefore a type
 * error instead of an implicit watcher or a special option at the call site.
 */
export const PROJECT_ACTION_EFFECTS = {
  'sheet.preset': { invalidateLayout: true, persist: true, history: true },
  'sheet.width': { invalidateLayout: true, persist: true, history: true },
  'sheet.height': { invalidateLayout: true, persist: true, history: true },
  'sheet.kerf': { invalidateLayout: true, persist: true, history: true },
  'cost.price': { invalidateLayout: false, persist: true, history: true },
  'cost.currency': { invalidateLayout: false, persist: true, history: true },
  'strategy.select': { invalidateLayout: true, persist: false, history: false },
  'piece.add': { invalidateLayout: true, persist: true, history: true },
  'piece.import': { invalidateLayout: true, persist: true, history: true },
  'piece.remove': { invalidateLayout: true, persist: true, history: true },
  'piece.duplicate': { invalidateLayout: true, persist: true, history: true },
  'piece.clear': { invalidateLayout: true, persist: true, history: true },
  'piece.lock': { invalidateLayout: false, persist: true, history: true },
  'piece.label': { invalidateLayout: false, persist: true, history: true },
  'piece.width': { invalidateLayout: true, persist: true, history: true },
  'piece.height': { invalidateLayout: true, persist: true, history: true },
  'piece.quantity': { invalidateLayout: true, persist: true, history: true },
  'piece.rotation': { invalidateLayout: true, persist: true, history: true },
  'pieces.rotation': { invalidateLayout: true, persist: true, history: true },
  'pieces.transform': { invalidateLayout: true, persist: true, history: true },
  'pieces.sort': { invalidateLayout: true, persist: true, history: true },
  'pieces.reorder': { invalidateLayout: true, persist: true, history: true },
  'example.load': { invalidateLayout: true, persist: true, history: true },
} as const satisfies Record<string, ProjectActionEffects>

export type ProjectActionName = keyof typeof PROJECT_ACTION_EFFECTS

export interface ProjectActionEvent {
  name: ProjectActionName
  revision: number
  impact: 'layout' | 'metadata'
  committedAt: string
}

interface UseProjectActionsOptions {
  invalidateLayout: () => void
  scheduleSave: () => void
  recordHistory: (action: ProjectActionName) => void
  now?: () => Date
  trailLimit?: number
}

/**
 * One explicit side-effect boundary for editor mutations. The page names the
 * user action; this owner decides whether layout, persistence, and history are
 * affected. Pure state modules remain unaware of browser effects.
 */
export function useProjectActions(options: UseProjectActionsOptions) {
  const revision = ref(0)
  const lastAction = shallowRef<ProjectActionEvent | null>(null)
  const actionTrail = shallowRef<ProjectActionEvent[]>([])

  function commit(name: ProjectActionName) {
    const effects = PROJECT_ACTION_EFFECTS[name]
    const impact: ProjectActionEvent['impact'] = effects.invalidateLayout ? 'layout' : 'metadata'
    if (effects.invalidateLayout) options.invalidateLayout()
    if (effects.persist) options.scheduleSave()
    if (effects.history) options.recordHistory(name)

    revision.value++
    const event: ProjectActionEvent = {
      name,
      revision: revision.value,
      impact,
      committedAt: (options.now?.() ?? new Date()).toISOString(),
    }
    lastAction.value = event
    actionTrail.value = [event, ...actionTrail.value].slice(0, options.trailLimit ?? 50)
  }

  /**
   * Commit contract: a mutation vetoes its side effects by returning exactly
   * `false` or `null` ("nothing changed"). Every other value commits, so
   * mutations must not use `false`/`null` to carry ordinary data, and no-op
   * paths must return one of the two sentinels (see usePieceList mutators).
   */
  function run<T>(name: ProjectActionName, mutate: () => T): T {
    const result = mutate()
    if (result !== false && result !== null) commit(name)
    return result
  }

  return { revision, lastAction, actionTrail, commit, run }
}
