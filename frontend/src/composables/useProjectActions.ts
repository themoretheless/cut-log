import { ref, shallowRef } from 'vue'

export type ProjectActionName =
  | 'sheet.preset'
  | 'sheet.width'
  | 'sheet.height'
  | 'sheet.kerf'
  | 'cost.price'
  | 'cost.currency'
  | 'piece.add'
  | 'piece.import'
  | 'piece.remove'
  | 'piece.duplicate'
  | 'piece.clear'
  | 'piece.lock'
  | 'piece.label'
  | 'piece.width'
  | 'piece.height'
  | 'piece.quantity'
  | 'piece.rotation'
  | 'pieces.rotation'
  | 'pieces.transform'
  | 'pieces.sort'
  | 'pieces.reorder'
  | 'example.load'

export interface ProjectActionEvent {
  name: ProjectActionName
  revision: number
  impact: 'layout' | 'metadata'
  committedAt: string
}

interface ProjectActionOptions {
  impact?: ProjectActionEvent['impact']
  history?: boolean
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

  function commit(name: ProjectActionName, actionOptions: ProjectActionOptions = {}) {
    const impact = actionOptions.impact ?? 'layout'
    if (impact === 'layout') options.invalidateLayout()
    options.scheduleSave()
    if (actionOptions.history !== false) options.recordHistory(name)

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

  function run<T>(
    name: ProjectActionName,
    mutate: () => T,
    actionOptions: ProjectActionOptions = {},
  ): T {
    const result = mutate()
    if (result !== false && result !== null) commit(name, actionOptions)
    return result
  }

  return { revision, lastAction, actionTrail, commit, run }
}
