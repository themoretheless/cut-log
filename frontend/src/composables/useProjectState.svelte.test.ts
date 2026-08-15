// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { useProjectState } from './useProjectState.svelte'
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

function withProject(
  options: Parameters<typeof useProjectState>[0],
  run: (project: ReturnType<typeof useProjectState>) => void,
) {
  let project!: ReturnType<typeof useProjectState>
  const stop = $effect.root(() => {
    project = useProjectState(options)
    return () => {}
  })
  try {
    run(project)
  } finally {
    stop()
  }
}

describe('useProjectState', () => {
  it('owns project refs and returns detached snapshots', () => {
    let id = 0
    withProject({ minMachineCut: () => 30, createId: () => `piece-${++id}` }, (project) => {
      project.pieceList.add({ label: 'A', width: 100, height: 50, quantity: 1, allowRotation: true })
      const snapshot = project.read()
      snapshot.pieces[0].label = 'Changed outside'

      expect(project.pieceList.pieces[0].label).toBe('A')
      expect(snapshot).toMatchObject({ sheetWidth: 2440, sheetHeight: 1220, kerf: 3 })
    })
  })

  it('applies a detached project and does not mutate the source state later', () => {
    const state = savedState()
    withProject({ minMachineCut: () => 30 }, (project) => {
      project.apply(state)
      project.pieceList.pieces[0].label = 'Edited after restore'

      expect(state.pieces[0].label).toBe('Saved piece')
      expect(project.read()).toMatchObject({
        sheetWidth: 2500,
        pricePerSheet: 80,
        currency: '$',
      })
    })
  })

  it('resets project data, filters, and selection through one operation', () => {
    withProject({ minMachineCut: () => 30 }, (project) => {
      project.apply(savedState())
      project.pieceList.pieceQuery = 'saved'
      project.pieceList.selectedPieceId = 'saved'
      project.reset()

      expect(project.read()).toEqual({
        sheetWidth: 2440,
        sheetHeight: 1220,
        kerf: 3,
        pieces: [],
        pricePerSheet: 0,
        currency: '₽',
      })
      expect(project.pieceList.pieceQuery).toBe('')
      expect(project.pieceList.selectedPieceId).toBeNull()
    })
  })
})
