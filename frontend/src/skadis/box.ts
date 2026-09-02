/**
 * Hanging SKÅDIS box: an open-top finger-joint box whose side walls extend
 * backwards into hooks that drop into the pegboard slots. Pure geometry only;
 * labels and colours stay in the page. All dimensions are millimetres.
 *
 * Panel scheme (five panels): the two sides are the outer panels and carry
 * female notches on their front, back and bottom edges plus the hooks on the
 * back edge. Front and back walls sit between the sides on top of the bottom
 * panel; the bottom panel sits between all four walls. Every joint is a
 * tab (male, +thickness) on one panel and a notch (female, -thickness) on the
 * mating one at identical positions.
 */

export interface SkadisBoxSettings {
  /** Number of slot pitches between the two side walls (hook centre to hook centre). */
  slotSpan: number
  /** Outer box height. */
  height: number
  /** Outer box depth, from the pegboard face to the front wall. */
  depth: number
  /** Material thickness. Must be narrower than the slot width to pass through it. */
  thickness: number
  /** Laser kerf; tabs grow and notches shrink by it. */
  kerf: number
  /** Nominal finger-joint tab length. */
  tabSize: number
  /** Hooks per side wall, stacked vertically every two grid rows. */
  hookRows: number
  /** Distance from the side wall top to the top of the first hook lip. */
  hookTop: number
  /** Vertical height of the hook neck that rests inside the slot. */
  neckHeight: number
  /** How far the lip rises above the neck behind the board. */
  lipRise: number
  /** Thickness of the lip along the depth axis. */
  lipDepth: number
  /** Extra play between the neck and the board (both faces). */
  clearance: number
  /** Pegboard grid, matching the SKÅDIS board generator. */
  boardThickness: number
  slotWidth: number
  slotHeight: number
  pitch: number
}

export type Pt = [number, number]

export type SkadisBoxPanelId = 'left' | 'right' | 'front' | 'back' | 'bottom'

export interface SkadisBoxPanel {
  id: SkadisBoxPanelId
  /** Bounding-box size of the contour, including protruding tabs and hooks. */
  width: number
  height: number
  /** Closed contour in panel-local coordinates; the bounding box starts at (0,0). */
  points: Pt[]
}

export type SkadisBoxWarning =
  | 'thickness_vs_slot'
  | 'hook_vs_slot_height'
  | 'hooks_vs_height'
  | 'too_small'

export interface SkadisBoxModel {
  outerWidth: number
  hookSpacing: number
  hookRowSpacing: number
  panels: SkadisBoxPanel[]
  warnings: SkadisBoxWarning[]
}

const EPS = 1e-9
export const fmt = (value: number) => Number(value.toFixed(3)).toString()

export const outerWidth = (s: SkadisBoxSettings) => s.slotSpan * s.pitch + s.thickness

/** Evenly spaced tab starts along an edge of length `length`. */
export function fingerPositions(length: number, tabSize: number): number[] {
  if (!(length > 0) || !(tabSize > 0)) return []
  const count = Math.max(1, Math.floor(length / (2 * tabSize)))
  const gap = (length - count * tabSize) / (count + 1)
  if (gap < 0) return []
  return Array.from({ length: count }, (_, index) => gap + index * (gap + tabSize))
}

interface EdgeFeature {
  /** Start along the edge, before kerf compensation. */
  at: number
  length: number
  /** Positive protrudes outwards (male), negative cuts inwards (female). */
  depth: number
  /** Optional custom outline replacing the plain rectangle, as offsets [along, out]. */
  outline?: Pt[]
}

/**
 * Walk one straight edge from `start` to `end` and insert rectangular features
 * along it. `outward` is the unit normal pointing away from the panel interior.
 * Male features are widened by the kerf and female ones narrowed by it, so the
 * cut parts mate without play after the laser removes material.
 */
function walkEdge(start: Pt, end: Pt, outward: Pt, features: EdgeFeature[], kerf: number): Pt[] {
  const dx = end[0] - start[0]
  const dy = end[1] - start[1]
  const length = Math.hypot(dx, dy)
  const dir: Pt = [dx / length, dy / length]
  const at = (along: number, out: number): Pt => [
    start[0] + dir[0] * along + outward[0] * out,
    start[1] + dir[1] * along + outward[1] * out,
  ]

  const points: Pt[] = [start]
  const sorted = features.filter(f => Math.abs(f.depth) > EPS).sort((a, b) => a.at - b.at)
  for (const feature of sorted) {
    if (feature.outline) {
      for (const [along, out] of feature.outline) points.push(at(feature.at + along, out))
      continue
    }
    const grow = feature.depth > 0 ? kerf / 2 : -kerf / 2
    const a = Math.max(0, feature.at - grow)
    const b = Math.min(length, feature.at + feature.length + grow)
    if (b - a <= EPS) continue
    points.push(at(a, 0), at(a, feature.depth), at(b, feature.depth), at(b, 0))
  }
  return points
}

function normalize(points: Pt[]): { points: Pt[]; width: number; height: number } {
  const xs = points.map(p => p[0])
  const ys = points.map(p => p[1])
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  const round = (v: number) => Number(v.toFixed(4))
  return {
    points: points.map(([x, y]) => [round(x - minX), round(y - minY)] as Pt),
    width: round(Math.max(...xs) - minX),
    height: round(Math.max(...ys) - minY),
  }
}

/** Hook necks measured from the side-wall top, as [top, bottom] of the neck. */
export function hookNecks(s: SkadisBoxSettings): Array<[number, number]> {
  const spacing = hookRowSpacing(s)
  return Array.from({ length: Math.max(0, Math.floor(s.hookRows)) }, (_, row) => {
    const top = s.hookTop + s.lipRise + row * spacing
    return [top, top + s.neckHeight] as [number, number]
  })
}

/** Hook rows must land on slots in the same columns; the standard 50 % stagger repeats every second row. */
export const hookRowSpacing = (s: SkadisBoxSettings) => s.pitch * 2

/** Hook outline on the back edge of a side wall, as [along, out] offsets from the neck top. */
function hookOutline(s: SkadisBoxSettings): Pt[] {
  const neck = s.boardThickness + s.clearance * 2
  const reach = neck + s.lipDepth
  return [
    [0, 0],
    [0, neck],
    [-s.lipRise, neck],
    [-s.lipRise, reach],
    [s.neckHeight, reach],
    [s.neckHeight, 0],
  ]
}

function validate(s: SkadisBoxSettings): SkadisBoxWarning[] {
  const warnings: SkadisBoxWarning[] = []
  if (s.thickness + s.clearance > s.slotWidth + EPS) warnings.push('thickness_vs_slot')
  if (s.neckHeight + s.lipRise > s.slotHeight + EPS) warnings.push('hook_vs_slot_height')
  const necks = hookNecks(s)
  const lastNeck = necks[necks.length - 1]
  if (lastNeck && lastNeck[1] > s.height - s.thickness + EPS) warnings.push('hooks_vs_height')
  if (s.height <= 2 * s.thickness || s.depth <= 2 * s.thickness || outerWidth(s) <= 2 * s.thickness) warnings.push('too_small')
  return warnings
}

function isFinitePositive(values: number[]) {
  return values.every(v => Number.isFinite(v) && v > 0)
}

export function skadisBox(s: SkadisBoxSettings): SkadisBoxModel {
  const width = outerWidth(s)
  const empty: SkadisBoxModel = { outerWidth: width, hookSpacing: s.slotSpan * s.pitch, hookRowSpacing: hookRowSpacing(s), panels: [], warnings: ['too_small'] }
  if (!isFinitePositive([s.slotSpan, s.height, s.depth, s.thickness, s.tabSize, s.neckHeight, s.lipDepth, s.boardThickness, s.slotWidth, s.slotHeight, s.pitch])) return empty
  if (![s.kerf, s.hookRows, s.hookTop, s.lipRise, s.clearance].every(v => Number.isFinite(v) && v >= 0)) return empty

  const warnings = validate(s)
  if (warnings.includes('too_small')) return { ...empty, warnings }

  const t = s.thickness
  const H = s.height
  const D = s.depth
  const innerW = width - 2 * t
  const innerD = D - 2 * t
  const wallH = H - t

  // Joint positions shared by mating edges.
  const wallTabs = fingerPositions(wallH, s.tabSize)        // front/back <-> sides, along height
  const bottomSideTabs = fingerPositions(innerD, s.tabSize) // bottom <-> sides, along depth
  const bottomWallTabs = fingerPositions(innerW, s.tabSize) // bottom <-> front/back, along width

  // Hooks that would run past the bottom joint are dropped; the warning tells the user why.
  const necks = hookNecks(s).filter(([, bottom]) => bottom <= wallH + EPS)
  const overlapsHook = (start: number, length: number) =>
    necks.some(([top, bottom]) => start < bottom + s.kerf && start + length > top - s.lipRise - s.kerf)

  const feature = (at: number, depth: number): EdgeFeature => ({ at, length: s.tabSize, depth })

  // Side wall, local x: 0 front -> D back, y: 0 top -> H bottom. Clockwise walk.
  const sideBack: EdgeFeature[] = [
    ...wallTabs.filter(pos => !overlapsHook(pos, s.tabSize)).map(pos => feature(pos, -t)),
    ...necks.map(([top]) => ({ at: top, length: s.neckHeight, depth: 1, outline: hookOutline(s) })),
  ]
  const sidePoints = [
    ...walkEdge([0, 0], [D, 0], [0, -1], [], s.kerf),
    ...walkEdge([D, 0], [D, H], [1, 0], sideBack, s.kerf),
    ...walkEdge([D, H], [0, H], [0, 1], bottomSideTabs.map(pos => feature(D - t - pos - s.tabSize, -t)), s.kerf),
    ...walkEdge([0, H], [0, 0], [-1, 0], wallTabs.map(pos => feature(H - pos - s.tabSize, -t)), s.kerf),
  ]

  // Front/back wall, local x: 0..innerW, y: 0 top -> wallH bottom.
  const wallPoints = [
    ...walkEdge([0, 0], [innerW, 0], [0, -1], [], s.kerf),
    ...walkEdge([innerW, 0], [innerW, wallH], [1, 0], wallTabs.map(pos => feature(pos, t)), s.kerf),
    ...walkEdge([innerW, wallH], [0, wallH], [0, 1], bottomWallTabs.map(pos => feature(innerW - pos - s.tabSize, -t)), s.kerf),
    ...walkEdge([0, wallH], [0, 0], [-1, 0], wallTabs.map(pos => feature(wallH - pos - s.tabSize, t)), s.kerf),
  ]

  // Bottom, local x: 0..innerW, y: 0 front -> innerD back.
  const bottomPoints = [
    ...walkEdge([0, 0], [innerW, 0], [0, -1], bottomWallTabs.map(pos => feature(pos, t)), s.kerf),
    ...walkEdge([innerW, 0], [innerW, innerD], [1, 0], bottomSideTabs.map(pos => feature(pos, t)), s.kerf),
    ...walkEdge([innerW, innerD], [0, innerD], [0, 1], bottomWallTabs.map(pos => feature(innerW - pos - s.tabSize, t)), s.kerf),
    ...walkEdge([0, innerD], [0, 0], [-1, 0], bottomSideTabs.map(pos => feature(innerD - pos - s.tabSize, t)), s.kerf),
  ]

  const side = normalize(sidePoints)
  const mirroredSide = normalize(sidePoints.map(([x, y]) => [-x, y] as Pt))
  const wall = normalize(wallPoints)
  const bottom = normalize(bottomPoints)

  return {
    outerWidth: width,
    hookSpacing: s.slotSpan * s.pitch,
    hookRowSpacing: hookRowSpacing(s),
    warnings,
    panels: [
      { id: 'left', ...side },
      { id: 'right', ...mirroredSide },
      { id: 'front', ...wall },
      { id: 'back', ...wall },
      { id: 'bottom', ...bottom },
    ],
  }
}

// ── Sheet layout and export ─────────────────────────────────────────────────
export interface PlacedPanel extends SkadisBoxPanel { x: number; y: number }

/** Lay the panels out left to right in two rows: sides on top, walls and bottom below. */
export function skadisBoxLayout(model: SkadisBoxModel, gap = 6): { width: number; height: number; placed: PlacedPanel[] } {
  const rows: SkadisBoxPanelId[][] = [['left', 'right'], ['front', 'back', 'bottom']]
  const placed: PlacedPanel[] = []
  let y = 0
  let width = 0
  for (const ids of rows) {
    let x = 0
    let rowHeight = 0
    for (const id of ids) {
      const panel = model.panels.find(p => p.id === id)
      if (!panel) continue
      placed.push({ ...panel, x, y })
      x += panel.width + gap
      rowHeight = Math.max(rowHeight, panel.height)
    }
    width = Math.max(width, x - gap)
    y += rowHeight + gap
  }
  return { width: Math.max(0, width), height: Math.max(0, y - gap), placed }
}

export const pointsToPath = (points: Pt[]) =>
  points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${fmt(x)},${fmt(y)}`).join(' ') + ' Z'

export function skadisBoxSvg(settings: SkadisBoxSettings): string {
  const layout = skadisBoxLayout(skadisBox(settings))
  const paths = layout.placed
    .map((panel, index) => `  <path id="${panel.id}" data-cut-order="${index + 1}" transform="translate(${fmt(panel.x)} ${fmt(panel.y)})" d="${pointsToPath(panel.points)}" fill="none" stroke="#ff0000" stroke-width="0.1" stroke-linejoin="miter" />`)
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${fmt(layout.width)}mm" height="${fmt(layout.height)}mm" viewBox="0 0 ${fmt(layout.width)} ${fmt(layout.height)}">
${paths}
</svg>`
}

export function skadisBoxDxf(settings: SkadisBoxSettings): string {
  const layout = skadisBoxLayout(skadisBox(settings))
  let entities = ''
  for (const panel of layout.placed) {
    entities += `0\nLWPOLYLINE\n8\nCUT\n90\n${panel.points.length}\n70\n1\n`
    for (const [x, y] of panel.points) entities += `10\n${fmt(panel.x + x)}\n20\n${fmt(panel.y + y)}\n`
  }
  return `0\nSECTION\n2\nHEADER\n9\n$INSUNITS\n70\n4\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n${entities}0\nENDSEC\n0\nEOF\n`
}
