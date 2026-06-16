import { describe, it, expect } from 'vitest'
import type { HomeState } from './homeState'
import {
  createProjectSnapshot,
  parseProjectSnapshots,
  removeProjectSnapshot,
  serializeProjectSnapshots,
  upsertProjectSnapshot,
} from './projectSnapshots'

const state: HomeState = {
  sheetWidth: 2440,
  sheetHeight: 1220,
  kerf: 3,
  pieces: [
    { id: 'a', label: 'Shelf', width: 760, height: 300, quantity: 4, allowRotation: true, color: '#4A90D9' },
  ],
}

describe('project snapshots', () => {
  it('round-trips a valid snapshot list', () => {
    const snapshot = createProjectSnapshot({
      id: 's1',
      name: 'Base',
      createdAt: '2026-06-15T10:00:00.000Z',
      summary: '1 type · 4 pcs',
      state,
    })

    expect(parseProjectSnapshots(serializeProjectSnapshots([snapshot]))).toEqual([snapshot])
  })

  it('returns an empty list for missing, malformed or wrong-version data', () => {
    expect(parseProjectSnapshots(null)).toEqual([])
    expect(parseProjectSnapshots('{ nope')).toEqual([])
    expect(parseProjectSnapshots(JSON.stringify({ version: 999, snapshots: [] }))).toEqual([])
  })

  it('drops snapshots with invalid state while keeping valid ones', () => {
    const raw = JSON.stringify({
      version: 1,
      snapshots: [
        { id: 'empty' },
        { id: 'bad', name: 'Bad', createdAt: 'now', summary: '', state: { ...state, sheetWidth: -1 } },
        { id: 'ok', name: 'Ok', createdAt: 'now', summary: '', state },
      ],
    })

    expect(parseProjectSnapshots(raw).map(snapshot => snapshot.id)).toEqual(['ok'])
  })

  it('upserts newest snapshots first and caps the list', () => {
    const a = createProjectSnapshot({ id: 'a', name: 'A', createdAt: '1', summary: '', state })
    const b = createProjectSnapshot({ id: 'b', name: 'B', createdAt: '2', summary: '', state })
    const a2 = createProjectSnapshot({ id: 'a', name: 'A2', createdAt: '3', summary: '', state })

    expect(upsertProjectSnapshot([a, b], a2, 2).map(snapshot => snapshot.name)).toEqual(['A2', 'B'])
  })

  it('removes snapshots by id', () => {
    const a = createProjectSnapshot({ id: 'a', name: 'A', createdAt: '1', summary: '', state })
    const b = createProjectSnapshot({ id: 'b', name: 'B', createdAt: '2', summary: '', state })

    expect(removeProjectSnapshot([a, b], 'a')).toEqual([b])
  })
})
