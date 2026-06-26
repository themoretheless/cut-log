import { parseHomeState, serializeHomeState, type HomeState } from './homeState'

export const PROJECT_SNAPSHOTS_KEY = 'project_snapshots'
const VERSION = 1
const MAX_NAME = 80

export interface ProjectSnapshot {
  id: string
  name: string
  createdAt: string
  summary: string
  state: HomeState
}

export function serializeProjectSnapshots(snapshots: readonly ProjectSnapshot[]): string {
  return JSON.stringify({ version: VERSION, snapshots })
}

function cleanText(value: unknown, fallback: string, max = MAX_NAME): string {
  if (typeof value !== 'string') return fallback
  const cleaned = value.trim()
  return cleaned ? cleaned.slice(0, max) : fallback
}

function validSnapshot(value: any): ProjectSnapshot | null {
  if (!value || typeof value !== 'object') return null
  let state: HomeState | null = null
  try {
    state = parseHomeState(serializeHomeState(value.state))
  } catch {
    return null
  }
  if (!state) return null
  return {
    id: cleanText(value.id, crypto.randomUUID(), 120),
    name: cleanText(value.name, 'Snapshot'),
    createdAt: cleanText(value.createdAt, new Date().toISOString(), 40),
    summary: cleanText(value.summary, '', 160),
    state,
  }
}

export function parseProjectSnapshots(raw: string | null): ProjectSnapshot[] {
  if (!raw) return []
  let data: any
  try {
    data = JSON.parse(raw)
  } catch {
    return []
  }
  if (!data || data.version !== VERSION || !Array.isArray(data.snapshots)) return []
  return data.snapshots
    .map(validSnapshot)
    .filter((snapshot: ProjectSnapshot | null): snapshot is ProjectSnapshot => snapshot !== null)
}

export function createProjectSnapshot(input: {
  id: string
  name: string
  createdAt: string
  summary: string
  state: HomeState
}): ProjectSnapshot {
  return {
    id: input.id,
    name: cleanText(input.name, 'Snapshot'),
    createdAt: input.createdAt,
    summary: cleanText(input.summary, '', 160),
    state: parseHomeState(serializeHomeState(input.state)) ?? input.state,
  }
}

export function upsertProjectSnapshot(
  snapshots: readonly ProjectSnapshot[],
  snapshot: ProjectSnapshot,
  limit = 8,
): ProjectSnapshot[] {
  return [snapshot, ...snapshots.filter(item => item.id !== snapshot.id)].slice(0, limit)
}

export function removeProjectSnapshot(
  snapshots: readonly ProjectSnapshot[],
  id: string,
): ProjectSnapshot[] {
  return snapshots.filter(snapshot => snapshot.id !== id)
}
