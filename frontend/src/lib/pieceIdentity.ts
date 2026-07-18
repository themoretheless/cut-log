const MAX_PIECE_ID_LENGTH = 120

type PieceWithId = { id: string }
type CreateId = () => string

function cleanId(value: unknown): string {
  return typeof value === 'string' ? value.trim().slice(0, MAX_PIECE_ID_LENGTH) : ''
}

export function claimPieceId(
  value: unknown,
  used: Set<string>,
  createId: CreateId = () => crypto.randomUUID(),
): string {
  const current = cleanId(value)
  if (current && !used.has(current)) {
    used.add(current)
    return current
  }

  for (let attempt = 0; attempt < 100; attempt++) {
    const candidate = cleanId(createId())
    if (candidate && !used.has(candidate)) {
      used.add(candidate)
      return candidate
    }
  }
  throw new Error('Could not allocate a unique piece id')
}

export function withStablePieceIds<T extends PieceWithId>(
  pieces: readonly T[],
  createId?: CreateId,
): T[] {
  const used = new Set<string>()
  return pieces.map(piece => ({
    ...piece,
    id: claimPieceId(piece.id, used, createId),
  }))
}

export function assertStablePieceIds(pieces: readonly PieceWithId[]): void {
  const seen = new Set<string>()
  for (const piece of pieces) {
    const id = cleanId(piece.id)
    if (!id || id !== piece.id || seen.has(id)) {
      throw new Error('Every piece must have a unique stable id')
    }
    seen.add(id)
  }
}
