// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { PROJECT_ACTION_EFFECTS, useProjectActions } from './useProjectActions.svelte'

function withActions(
  options: Parameters<typeof useProjectActions>[0],
  run: (actions: ReturnType<typeof useProjectActions>) => void,
) {
  let actions!: ReturnType<typeof useProjectActions>
  const stop = $effect.root(() => {
    actions = useProjectActions(options)
    return () => {}
  })
  try {
    run(actions)
  } finally {
    stop()
  }
}

describe('useProjectActions', () => {
  it('commits a named layout action through invalidation, storage, and history', () => {
    const invalidateLayout = vi.fn()
    const scheduleSave = vi.fn()
    const recordHistory = vi.fn()
    withActions({
      invalidateLayout,
      scheduleSave,
      recordHistory,
      now: () => new Date('2026-07-18T12:00:00Z'),
    }, (actions) => {
      const result = actions.run('piece.add', () => ({ id: 'piece-1' }))

      expect(result).toEqual({ id: 'piece-1' })
      expect(invalidateLayout).toHaveBeenCalledOnce()
      expect(scheduleSave).toHaveBeenCalledOnce()
      expect(recordHistory).toHaveBeenCalledWith('piece.add')
      expect(actions.lastAction).toEqual({
        name: 'piece.add',
        revision: 1,
        impact: 'layout',
        committedAt: '2026-07-18T12:00:00.000Z',
      })
    })
  })

  it('supports metadata actions that persist and record history without invalidating layout', () => {
    const invalidateLayout = vi.fn()
    const scheduleSave = vi.fn()
    const recordHistory = vi.fn()
    withActions({ invalidateLayout, scheduleSave, recordHistory }, (actions) => {
      actions.commit('cost.currency')

      expect(invalidateLayout).not.toHaveBeenCalled()
      expect(scheduleSave).toHaveBeenCalledOnce()
      expect(recordHistory).toHaveBeenCalledWith('cost.currency')
      expect(actions.lastAction?.impact).toBe('metadata')
    })
  })

  it('does not commit a mutation that reports no change', () => {
    const invalidateLayout = vi.fn()
    const scheduleSave = vi.fn()
    const recordHistory = vi.fn()
    withActions({ invalidateLayout, scheduleSave, recordHistory }, (actions) => {
      expect(actions.run('pieces.sort', () => false)).toBe(false)
      expect(actions.run('piece.remove', () => null)).toBeNull()
      expect(invalidateLayout).not.toHaveBeenCalled()
      expect(scheduleSave).not.toHaveBeenCalled()
      expect(recordHistory).not.toHaveBeenCalled()
      expect(actions.revision).toBe(0)
    })
  })

  it('keeps a bounded newest-first semantic trail', () => {
    withActions({
      invalidateLayout: () => undefined,
      scheduleSave: () => undefined,
      recordHistory: () => undefined,
      trailLimit: 2,
    }, (actions) => {
      actions.commit('piece.add')
      actions.commit('piece.width')
      actions.commit('piece.height')

      expect(actions.actionTrail.map(event => event.name)).toEqual(['piece.height', 'piece.width'])
      expect(actions.revision).toBe(3)
    })
  })

  it('declares persistence, history, and layout effects for every action', () => {
    expect(Object.keys(PROJECT_ACTION_EFFECTS)).toHaveLength(23)
    expect(PROJECT_ACTION_EFFECTS['piece.add']).toEqual({
      invalidateLayout: true,
      persist: true,
      history: true,
    })
    expect(PROJECT_ACTION_EFFECTS['cost.price']).toEqual({
      invalidateLayout: false,
      persist: true,
      history: true,
    })
    // Metadata edits must never discard a computed layout.
    expect(PROJECT_ACTION_EFFECTS['piece.label'].invalidateLayout).toBe(false)
    expect(PROJECT_ACTION_EFFECTS['piece.lock'].invalidateLayout).toBe(false)
    expect(PROJECT_ACTION_EFFECTS['strategy.select']).toEqual({
      invalidateLayout: true,
      persist: false,
      history: false,
    })

    for (const effects of Object.values(PROJECT_ACTION_EFFECTS)) {
      expect(typeof effects.invalidateLayout).toBe('boolean')
      expect(typeof effects.persist).toBe('boolean')
      expect(typeof effects.history).toBe('boolean')
    }
  })
})
