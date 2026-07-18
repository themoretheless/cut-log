import { describe, expect, it, vi } from 'vitest'
import { useProjectActions } from './useProjectActions'

describe('useProjectActions', () => {
  it('commits a named layout action through invalidation, storage, and history', () => {
    const invalidateLayout = vi.fn()
    const scheduleSave = vi.fn()
    const recordHistory = vi.fn()
    const actions = useProjectActions({
      invalidateLayout,
      scheduleSave,
      recordHistory,
      now: () => new Date('2026-07-18T12:00:00Z'),
    })

    const result = actions.run('piece.add', () => ({ id: 'piece-1' }))

    expect(result).toEqual({ id: 'piece-1' })
    expect(invalidateLayout).toHaveBeenCalledOnce()
    expect(scheduleSave).toHaveBeenCalledOnce()
    expect(recordHistory).toHaveBeenCalledWith('piece.add')
    expect(actions.lastAction.value).toEqual({
      name: 'piece.add',
      revision: 1,
      impact: 'layout',
      committedAt: '2026-07-18T12:00:00.000Z',
    })
  })

  it('supports metadata-only actions without invalidating layout or recording history', () => {
    const invalidateLayout = vi.fn()
    const scheduleSave = vi.fn()
    const recordHistory = vi.fn()
    const actions = useProjectActions({ invalidateLayout, scheduleSave, recordHistory })

    actions.commit('cost.currency', { impact: 'metadata', history: false })

    expect(invalidateLayout).not.toHaveBeenCalled()
    expect(scheduleSave).toHaveBeenCalledOnce()
    expect(recordHistory).not.toHaveBeenCalled()
    expect(actions.lastAction.value?.impact).toBe('metadata')
  })

  it('does not commit a mutation that reports no change', () => {
    const invalidateLayout = vi.fn()
    const scheduleSave = vi.fn()
    const recordHistory = vi.fn()
    const actions = useProjectActions({ invalidateLayout, scheduleSave, recordHistory })

    expect(actions.run('pieces.sort', () => false)).toBe(false)
    expect(actions.run('piece.remove', () => null)).toBeNull()
    expect(invalidateLayout).not.toHaveBeenCalled()
    expect(scheduleSave).not.toHaveBeenCalled()
    expect(recordHistory).not.toHaveBeenCalled()
    expect(actions.revision.value).toBe(0)
  })

  it('keeps a bounded newest-first semantic trail', () => {
    const actions = useProjectActions({
      invalidateLayout: () => undefined,
      scheduleSave: () => undefined,
      recordHistory: () => undefined,
      trailLimit: 2,
    })

    actions.commit('piece.add')
    actions.commit('piece.width')
    actions.commit('piece.height')

    expect(actions.actionTrail.value.map(event => event.name)).toEqual(['piece.height', 'piece.width'])
    expect(actions.revision.value).toBe(3)
  })
})
