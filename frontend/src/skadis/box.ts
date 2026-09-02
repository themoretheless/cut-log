/**
 * 3D-printable SKÅDIS box: a solid open-top container with hooks grown out of
 * its back wall that drop into the pegboard slots. Pure geometry only; labels
 * and colours stay in the page. All dimensions are millimetres.
 *
 * Axes: x across the width, y from the front face (0) towards the pegboard
 * (depth), z up from the print bed. The model is a set of axis-aligned
 * cuboids that touch but never overlap, so the STL is a clean union.
 */

export interface SkadisBoxSettings {
  /** Outer width, height and depth of the box body (hooks stick out beyond the depth). */
  width: number
  height: number
  depth: number
  /** Wall thickness. */
  wall: number
  /** Floor thickness. */
  floor: number
  /** Front wall height above the floor; 0 removes the front wall (open shelf). */
  frontHeight: number
  /** Vertical dividers across the width. */
  dividers: number
  /** Hook bar width across the slot; must be narrower than the slot. */
  hookWidth: number
  /** Put a hook on every slot column, not only the outermost two. */
  hookEveryColumn: boolean
  /** Hook rows stacked down the back wall, every two grid rows. */
  hookRows: number
  /** Distance from the box top to the top of the first hook lip. */
  hookTop: number
  /** Vertical height of the neck that rests inside the slot. */
  neckHeight: number
  /** How far the lip rises above the neck behind the board. */
  lipRise: number
  /** Thickness of the lip along the depth axis. */
  lipDepth: number
  /** Play between the neck and the board faces. */
  clearance: number
  /** Pegboard grid, matching the SKÅDIS board generator. */
  boardThickness: number
  slotWidth: number
  slotHeight: number
  pitch: number
}

export type Vec3 = [number, number, number]

export type SkadisBoxPartId = 'floor' | 'left' | 'right' | 'back' | 'front' | 'divider' | 'neck' | 'lip'

export interface Cuboid {
  id: SkadisBoxPartId
  min: Vec3
  max: Vec3
}

export type SkadisBoxWarning =
  | 'hook_vs_slot_width'
  | 'hook_vs_slot_height'
  | 'hooks_vs_height'
  | 'single_hook_column'
  | 'dividers_vs_width'
  | 'too_small'

export interface SkadisBoxModel {
  parts: Cuboid[]
  warnings: SkadisBoxWarning[]
  /** Slot columns used by the hooks, as x centres. */
  hookColumns: number[]
  /** Hook neck rows, as [zBottom, zTop] pairs. */
  hookRows: Array<[number, number]>
  /** Total depth including the hooks. */
  totalDepth: number
  /** Material volume in cubic millimetres. */
  volume: number
}

const EPS = 1e-9
const round = (v: number) => Number(v.toFixed(4))

/** Hook rows must land on slots in the same columns; the standard 50 % stagger repeats every second row. */
export const hookRowSpacing = (s: SkadisBoxSettings) => s.pitch * 2

/** X centres of the hook columns: symmetric about the middle, whole pitches apart. */
export function hookColumns(s: SkadisBoxSettings): number[] {
  const usable = s.width - s.hookWidth
  if (usable < -EPS) return []
  const span = Math.max(0, Math.floor(usable / s.pitch + EPS))
  if (span === 0) return [s.width / 2]
  const first = s.width / 2 - span * s.pitch / 2
  if (s.hookEveryColumn) return Array.from({ length: span + 1 }, (_, index) => first + index * s.pitch)
  return [first, first + span * s.pitch]
}

/** Hook necks measured from the print bed, as [zBottom, zTop]; rows that would cut into the floor are dropped. */
export function hookRows(s: SkadisBoxSettings): Array<[number, number]> {
  const rows: Array<[number, number]> = []
  for (let row = 0; row < Math.max(0, Math.floor(s.hookRows)); row += 1) {
    const top = s.height - s.hookTop - s.lipRise - row * hookRowSpacing(s)
    const bottom = top - s.neckHeight
    if (bottom < s.floor - EPS) break
    rows.push([bottom, top])
  }
  return rows
}

function validate(s: SkadisBoxSettings): SkadisBoxWarning[] {
  const warnings: SkadisBoxWarning[] = []
  if (s.hookWidth + s.clearance > s.slotWidth + EPS) warnings.push('hook_vs_slot_width')
  if (s.neckHeight + s.lipRise > s.slotHeight + EPS) warnings.push('hook_vs_slot_height')
  if (hookRows(s).length < Math.floor(s.hookRows)) warnings.push('hooks_vs_height')
  if (hookColumns(s).length === 1) warnings.push('single_hook_column')
  const innerW = s.width - 2 * s.wall
  if (s.dividers > 0 && innerW / (Math.floor(s.dividers) + 1) < 2 * s.wall) warnings.push('dividers_vs_width')
  if (s.width <= 2 * s.wall || s.depth <= 2 * s.wall || s.height <= s.floor) warnings.push('too_small')
  return warnings
}

const box = (id: SkadisBoxPartId, min: Vec3, max: Vec3): Cuboid =>
  ({ id, min: min.map(round) as Vec3, max: max.map(round) as Vec3 })

export function skadisBox(s: SkadisBoxSettings): SkadisBoxModel {
  const empty: SkadisBoxModel = { parts: [], warnings: ['too_small'], hookColumns: [], hookRows: [], totalDepth: s.depth, volume: 0 }
  const positive = [s.width, s.height, s.depth, s.wall, s.floor, s.hookWidth, s.neckHeight, s.lipDepth, s.boardThickness, s.slotWidth, s.slotHeight, s.pitch]
  const nonNegative = [s.frontHeight, s.dividers, s.hookRows, s.hookTop, s.lipRise, s.clearance]
  if (!positive.every(v => Number.isFinite(v) && v > 0) || !nonNegative.every(v => Number.isFinite(v) && v >= 0)) return empty

  const warnings = validate(s)
  if (warnings.includes('too_small')) return { ...empty, warnings }

  const { width: W, height: H, depth: D, wall: t, floor: f } = s
  const frontH = Math.min(Math.max(0, s.frontHeight), H - f)
  const parts: Cuboid[] = [
    box('floor', [0, 0, 0], [W, D, f]),
    box('left', [0, 0, f], [t, D, H]),
    box('right', [W - t, 0, f], [W, D, H]),
    box('back', [t, D - t, f], [W - t, D, H]),
  ]
  if (frontH > EPS) parts.push(box('front', [t, 0, f], [W - t, t, f + frontH]))

  const dividerCount = Math.max(0, Math.floor(s.dividers))
  const innerW = W - 2 * t
  for (let index = 0; index < dividerCount; index += 1) {
    const x = t + innerW * (index + 1) / (dividerCount + 1)
    parts.push(box('divider', [x - t / 2, t, f], [x + t / 2, D - t, H]))
  }

  const neckLength = s.boardThickness + 2 * s.clearance
  const columns = hookColumns(s)
  const rows = hookRows(s)
  for (const x of columns) {
    for (const [zBottom, zTop] of rows) {
      parts.push(box('neck', [x - s.hookWidth / 2, D, zBottom], [x + s.hookWidth / 2, D + neckLength, zTop]))
      parts.push(box('lip', [x - s.hookWidth / 2, D + neckLength, zBottom], [x + s.hookWidth / 2, D + neckLength + s.lipDepth, zTop + s.lipRise]))
    }
  }

  const volume = parts.reduce((sum, p) => sum + (p.max[0] - p.min[0]) * (p.max[1] - p.min[1]) * (p.max[2] - p.min[2]), 0)
  return {
    parts,
    warnings,
    hookColumns: columns.map(round),
    hookRows: rows.map(([a, b]) => [round(a), round(b)] as [number, number]),
    totalDepth: round(D + neckLength + s.lipDepth),
    volume: round(volume),
  }
}

// ── Mesh and STL ────────────────────────────────────────────────────────────

/** Twelve outward-facing triangles per cuboid, flat vertex list of 36 xyz triples per box. */
export function cuboidTriangles(c: Cuboid): number[] {
  const [x0, y0, z0] = c.min
  const [x1, y1, z1] = c.max
  const q = (a: Vec3, b: Vec3, d: Vec3, e: Vec3) => [...a, ...b, ...d, ...a, ...d, ...e]
  return [
    ...q([x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0]), // bottom (z0), normal -z
    ...q([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]), // top, +z
    ...q([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]), // front (y0), -y
    ...q([x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]), // back (y1), +y
    ...q([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]), // left (x0), -x
    ...q([x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]), // right (x1), +x
  ]
}

export function skadisBoxTriangles(model: SkadisBoxModel): Float32Array {
  return new Float32Array(model.parts.flatMap(cuboidTriangles))
}

/** Binary STL, millimetres, with a per-triangle normal computed from the winding. */
export function skadisBoxStl(settings: SkadisBoxSettings): ArrayBuffer {
  const tris = skadisBoxTriangles(skadisBox(settings))
  const count = tris.length / 9
  const buffer = new ArrayBuffer(84 + count * 50)
  const view = new DataView(buffer)
  const header = 'CutLog SKADIS box'
  for (let i = 0; i < header.length; i += 1) view.setUint8(i, header.charCodeAt(i))
  view.setUint32(80, count, true)
  let offset = 84
  for (let i = 0; i < count; i += 1) {
    const b = i * 9
    const ax = tris[b + 3] - tris[b], ay = tris[b + 4] - tris[b + 1], az = tris[b + 5] - tris[b + 2]
    const bx = tris[b + 6] - tris[b], by = tris[b + 7] - tris[b + 1], bz = tris[b + 8] - tris[b + 2]
    const nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx
    const len = Math.hypot(nx, ny, nz) || 1
    view.setFloat32(offset, nx / len, true)
    view.setFloat32(offset + 4, ny / len, true)
    view.setFloat32(offset + 8, nz / len, true)
    for (let k = 0; k < 9; k += 1) view.setFloat32(offset + 12 + k * 4, tris[b + k], true)
    view.setUint16(offset + 48, 0, true)
    offset += 50
  }
  return buffer
}

// ── Variants ────────────────────────────────────────────────────────────────
export type SkadisBoxVariant = 'tray' | 'cup' | 'shelf' | 'bin' | 'organizer' | 'wide'

/** Body-shape overrides per variant; hook and board settings are left untouched. */
export const skadisBoxVariants: Record<SkadisBoxVariant, Partial<SkadisBoxSettings>> = {
  tray: { width: 86, height: 60, depth: 60, frontHeight: 60, dividers: 0 },
  cup: { width: 46, height: 100, depth: 46, frontHeight: 100, dividers: 0 },
  shelf: { width: 126, height: 40, depth: 80, frontHeight: 0, dividers: 0 },
  bin: { width: 86, height: 80, depth: 70, frontHeight: 35, dividers: 0 },
  organizer: { width: 126, height: 50, depth: 60, frontHeight: 50, dividers: 2 },
  wide: { width: 206, height: 45, depth: 50, frontHeight: 45, dividers: 4 },
}
