import { describe, expect, it } from 'vitest'
import { useProjectState } from './useProjectState'
import type { HomeState } from '@/lib/homeState'

function savedState(): HomeState {
  return {
    sheetWidth: 2500,
    sheetHeight: 1250,
    kerf: 4,
    pricePerSheet: 80,
    currency: '$',
    pieces: [{
      id: 'saved',
      label: 'Saved piece',
      width: 400,
      height: 300,
      quantity: 2,
      allowRotation: true,
      color: '#123456',
    }],
  }
}

describe('useProjectState', () => {
  it('owns project refs and returns detached snapshots', () => {
    let id = 0
    const project = useProjectState({ minMachineCut: 30, createId: () => `piece-${++id}` })
    project.pieceList.add({ label: 'A', width: 100, height: 50, quantity: 1, allowRotation: true })
    const snapshot = project.read()
    snapshot.pieces[0].label = 'Changed outside'

    expect(project.pieceList.pieces[0].label).toBe('A')
    expect(snapshot).toMatchObject({ sheetWidth: 2440, sheetHeight: 1220, kerf: 3 })
  })

  it('applies a detached project and does not mutate the source state later', () => {
    const state = savedState()
    const project = useProjectState({ minMachineCut: 30 })
    project.apply(state)
    project.pieceList.pieces[0].label = 'Edited after restore'

    expect(state.pieces[0].label).toBe('Saved piece')
    expect(project.read()).toMatchObject({
      sheetWidth: 2500,
      pricePerSheet: 80,
      currency: '$',
    })
  })

  it('resets project data, filters, and selection through one operation', () => {
    const project = useProjectState({ minMachineCut: 30 })
    project.apply(savedState())
    project.pieceList.pieceQuery.value = 'saved'
    project.pieceList.selectedPieceId.value = 'saved'
    project.reset()

    expect(project.read()).toEqual({
      sheetWidth: 2440,
      sheetHeight: 1220,
      kerf: 3,
      pieces: [],
      pricePerSheet: 0,
      currency: '₽',
    })
    expect(project.pieceList.pieceQuery.value).toBe('')
    expect(project.pieceList.selectedPieceId.value).toBeNull()
  })
})
