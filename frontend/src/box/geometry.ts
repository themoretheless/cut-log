/**
 * Parametric finger-joint box geometry — the single source of truth for the
 * box builder. Pure functions of a {@link BoxParams} object: SVG cut paths, 3D
 * assembly vertices, shelf-slot holes and the cutting layout. Presentation
 * (localized labels, colors) stays in the component; this module is geometry
 * only. Behavior is pinned by scripts/golden.json (see geometry.golden.test.ts).
 */

export interface BoxParams {
  w: number
  h: number
  d: number
  t: number
  kerf: number
  tabH: number
  nTab: number
  nShelves: number
  bevel: number
}

export type Pt3 = [number, number, number]

// ── Derived quantities ───────────────────────────────────────────────────────
export const tf = (p: BoxParams) => p.t + p.kerf
export const wi = (p: BoxParams) => p.w - 2 * p.t
export const hi = (p: BoxParams) => p.h - 2 * p.t
export const topD = (p: BoxParams) => p.d - Math.max(p.bevel, 0)
export const botD = (p: BoxParams) => p.d - Math.max(-p.bevel, 0)

// ── Tabs and shelves ─────────────────────────────────────────────────────────
export function tabPositions(p: BoxParams, L: number): number[] {
  const n = p.nTab
  const th = p.tabH
  const gap = (L - n * th) / (n + 1)
  const pos: number[] = []
  for (let i = 0; i < n; i++) pos.push(gap + i * (gap + th))
  return pos
}

/** Tab positions of a full edge, restricted to [offset, offset+len] and shifted local. */
export function depthTabs(p: BoxParams, fullLen: number, offset: number, len: number): number[] {
  const th = p.tabH
  return tabPositions(p, fullLen)
    .filter(x => x >= offset && x + th <= offset + len)
    .map(x => x - offset)
}

export function shelfSlotYs(p: BoxParams): number[] {
  const ns = p.nShelves
  if (ns === 0) return []
  const t = tf(p)
  const hin = hi(p)
  const gap = (hin - ns * t) / (ns + 1)
  const ys: number[] = []
  for (let i = 0; i < ns; i++) ys.push(p.t + gap + i * (gap + t))
  return ys
}

export function shelfOffsetAt(p: BoxParams, sy: number): number {
  const frac = sy / p.h
  const cTop = Math.max(p.bevel, 0)
  const cBot = Math.max(-p.bevel, 0)
  return cBot + (cTop - cBot) * frac
}

export function shelfDepthAt(p: BoxParams, sy: number): number {
  return p.d - shelfOffsetAt(p, sy)
}

// ── SVG path builders ────────────────────────────────────────────────────────
function f(v: number): string { return v.toFixed(2) }

export function pathSide(p: BoxParams): string {
  const pw = p.d, ph = p.h, th = p.tabH
  const t = tf(p)
  const bv = p.bevel
  const clipTop = Math.max(0, bv)
  const clipBot = Math.max(0, -bv)
  let d = `M${f(clipTop)},0`
  for (const x of tabPositions(p, p.d)) {
    if (x < clipTop) continue
    d += ` L${f(x)},0 L${f(x)},${f(t)} L${f(x + th)},${f(t)} L${f(x + th)},0`
  }
  d += ` L${f(pw)},0`
  for (const y of tabPositions(p, p.h))
    d += ` L${f(pw)},${f(y)} L${f(pw - t)},${f(y)} L${f(pw - t)},${f(y + th)} L${f(pw)},${f(y + th)}`
  d += ` L${f(pw)},${f(ph)}`
  for (const x of [...tabPositions(p, p.d)].reverse()) {
    if (x < clipBot) continue
    d += ` L${f(x + th)},${f(ph)} L${f(x + th)},${f(ph - t)} L${f(x)},${f(ph - t)} L${f(x)},${f(ph)}`
  }
  d += ` L${f(clipBot)},${f(ph)} Z`
  for (const sy of shelfSlotYs(p)) {
    const sOff = shelfOffsetAt(p, sy)
    for (const x of tabPositions(p, p.d)) {
      if (x < sOff || x + th > pw) continue
      d += ` M${f(x)},${f(sy)} L${f(x + th)},${f(sy)} L${f(x + th)},${f(sy + t)} L${f(x)},${f(sy + t)} Z`
    }
  }
  return d
}

export function pathTopBottom(p: BoxParams, depth?: number, depthOff = 0): string {
  const ph = depth ?? p.d
  const pw = p.w, th = p.tabH, t = p.t
  const tfv = tf(p), wiv = wi(p)
  const sideTabs = depthTabs(p, p.d, depthOff, ph)
  let d = `M${f(t)},0 L${f(pw - t)},0`
  for (const y of sideTabs)
    d += ` L${f(pw - t)},${f(y)} L${f(pw)},${f(y)} L${f(pw)},${f(y + th)} L${f(pw - t)},${f(y + th)}`
  d += ` L${f(pw - t)},${f(ph)}`
  for (const x of [...tabPositions(p, wiv)].reverse()) {
    const rx = t + x
    d += ` L${f(rx + th)},${f(ph)} L${f(rx + th)},${f(ph - tfv)} L${f(rx)},${f(ph - tfv)} L${f(rx)},${f(ph)}`
  }
  d += ` L${f(t)},${f(ph)}`
  for (const y of [...sideTabs].reverse())
    d += ` L${f(t)},${f(y + th)} L0,${f(y + th)} L0,${f(y)} L${f(t)},${f(y)}`
  d += ` L${f(t)},0 Z`
  return d
}

export function pathBack(p: BoxParams): string {
  const pw = p.w, ph = p.h, th = p.tabH, t = p.t
  const tfv = tf(p), wiv = wi(p), hiv = hi(p)
  let d = `M${f(t)},${f(t)}`
  for (const x of tabPositions(p, wiv)) {
    const rx = t + x
    d += ` L${f(rx)},${f(t)} L${f(rx)},0 L${f(rx + th)},0 L${f(rx + th)},${f(t)}`
  }
  d += ` L${f(pw - t)},${f(t)}`
  for (const y of tabPositions(p, hiv)) {
    const ry = t + y
    d += ` L${f(pw - t)},${f(ry)} L${f(pw)},${f(ry)} L${f(pw)},${f(ry + th)} L${f(pw - t)},${f(ry + th)}`
  }
  d += ` L${f(pw - t)},${f(ph - t)}`
  for (const x of [...tabPositions(p, wiv)].reverse()) {
    const rx = t + x
    d += ` L${f(rx + th)},${f(ph - t)} L${f(rx + th)},${f(ph)} L${f(rx)},${f(ph)} L${f(rx)},${f(ph - t)}`
  }
  d += ` L${f(t)},${f(ph - t)}`
  for (const y of [...tabPositions(p, hiv)].reverse()) {
    const ry = t + y
    d += ` L${f(t)},${f(ry + th)} L0,${f(ry + th)} L0,${f(ry)} L${f(t)},${f(ry)}`
  }
  d += ' Z'
  for (const sy of shelfSlotYs(p))
    for (const x of tabPositions(p, wiv))
      d += ` M${f(t + x)},${f(sy)} L${f(t + x + th)},${f(sy)} L${f(t + x + th)},${f(sy + tfv)} L${f(t + x)},${f(sy + tfv)} Z`
  return d
}

export function pathShelf(p: BoxParams, depth?: number, depthOff = 0): string {
  const ph = depth ?? p.d
  const pw = p.w, th = p.tabH, t = p.t
  const wiv = wi(p)
  const sideTabs = depthTabs(p, p.d, depthOff, ph)
  let d = `M${f(t)},0 L${f(pw - t)},0`
  for (const y of sideTabs)
    d += ` L${f(pw - t)},${f(y)} L${f(pw)},${f(y)} L${f(pw)},${f(y + th)} L${f(pw - t)},${f(y + th)}`
  d += ` L${f(pw - t)},${f(ph - t)}`
  for (const x of [...tabPositions(p, wiv)].reverse()) {
    const rx = t + x
    d += ` L${f(rx + th)},${f(ph - t)} L${f(rx + th)},${f(ph)} L${f(rx)},${f(ph)} L${f(rx)},${f(ph - t)}`
  }
  d += ` L${f(t)},${f(ph - t)}`
  for (const y of [...sideTabs].reverse())
    d += ` L${f(t)},${f(y + th)} L0,${f(y + th)} L0,${f(y)} L${f(t)},${f(y)}`
  d += ` L${f(t)},0 Z`
  return d
}

export function svgScale(pw: number, ph: number): number {
  return Math.min(460 / (pw + 20), 320 / (ph + 20))
}

// ── 3D contour generators ────────────────────────────────────────────────────
export function sidePts3D(p: BoxParams, x0: number): Pt3[] {
  const pts: Pt3[] = []
  const a = (y: number, z: number) => pts.push([x0, y, z])
  const d = p.d, h = p.h, th = p.tabH, t = tf(p), bv = p.bevel
  const clipBot = Math.max(0, -bv)
  const clipTop = Math.max(0, bv)
  a(clipBot, 0)
  for (const ty of tabPositions(p, d)) {
    if (ty < clipBot) continue
    a(ty, 0); a(ty, t); a(ty + th, t); a(ty + th, 0)
  }
  a(d, 0)
  for (const tz of tabPositions(p, h)) { a(d, tz); a(d - t, tz); a(d - t, tz + th); a(d, tz + th) }
  a(d, h)
  for (const ty of [...tabPositions(p, d)].reverse()) {
    if (ty < clipTop) continue
    a(ty + th, h); a(ty + th, h - t); a(ty, h - t); a(ty, h)
  }
  a(clipTop, h)
  return pts
}

export function horizPts3D(p: BoxParams, z0: number, depth?: number, yOff = 0): Pt3[] {
  const pts: Pt3[] = []
  const a = (x: number, y: number) => pts.push([x, y + yOff, z0])
  const w = p.w, d = depth ?? p.d, th = p.tabH, t = p.t
  const tfv = tf(p), wiv = wi(p)
  const sTabs = depthTabs(p, p.d, yOff, d)
  a(t, 0); a(w - t, 0)
  for (const ty of sTabs) { a(w - t, ty); a(w, ty); a(w, ty + th); a(w - t, ty + th) }
  a(w - t, d)
  for (const tx of [...tabPositions(p, wiv)].reverse()) {
    const rx = t + tx
    a(rx + th, d); a(rx + th, d - tfv); a(rx, d - tfv); a(rx, d)
  }
  a(t, d)
  for (const ty of [...sTabs].reverse()) { a(t, ty + th); a(0, ty + th); a(0, ty); a(t, ty) }
  return pts
}

export function backPts3D(p: BoxParams, y0: number): Pt3[] {
  const pts: Pt3[] = []
  const a = (x: number, z: number) => pts.push([x, y0, z])
  const w = p.w, h = p.h, th = p.tabH, t = p.t
  const wiv = wi(p), hiv = hi(p)
  a(t, t)
  for (const tx of tabPositions(p, wiv)) { const rx = t + tx; a(rx, t); a(rx, 0); a(rx + th, 0); a(rx + th, t) }
  a(w - t, t)
  for (const tz of tabPositions(p, hiv)) { const rz = t + tz; a(w - t, rz); a(w, rz); a(w, rz + th); a(w - t, rz + th) }
  a(w - t, h - t)
  for (const tx of [...tabPositions(p, wiv)].reverse()) { const rx = t + tx; a(rx + th, h - t); a(rx + th, h); a(rx, h); a(rx, h - t) }
  a(t, h - t)
  for (const tz of [...tabPositions(p, hiv)].reverse()) { const rz = t + tz; a(t, rz + th); a(0, rz + th); a(0, rz); a(t, rz) }
  return pts
}

export function shelfPts3D(p: BoxParams, z0: number, depth?: number, yOff = 0): Pt3[] {
  const pts: Pt3[] = []
  const a = (x: number, y: number) => pts.push([x, y + yOff, z0])
  const w = p.w, d = depth ?? p.d, th = p.tabH, t = p.t
  const wiv = wi(p)
  const sTabs = depthTabs(p, p.d, yOff, d)
  a(t, 0); a(w - t, 0)
  for (const ty of sTabs) { a(w - t, ty); a(w, ty); a(w, ty + th); a(w - t, ty + th) }
  a(w - t, d - t)
  for (const tx of [...tabPositions(p, wiv)].reverse()) {
    const rx = t + tx
    a(rx + th, d - t); a(rx + th, d); a(rx, d); a(rx, d - t)
  }
  a(t, d - t)
  for (const ty of [...sTabs].reverse()) { a(t, ty + th); a(0, ty + th); a(0, ty); a(t, ty) }
  return pts
}

export function sideHoles3D(p: BoxParams, x0: number): Pt3[][] {
  const holes: Pt3[][] = []
  const t = tf(p), th = p.tabH, d = p.d
  for (const sz of shelfSlotYs(p)) {
    const sOff = shelfOffsetAt(p, sz)
    for (const ty of tabPositions(p, d)) {
      if (ty < sOff || ty + th > d) continue
      holes.push([
        [x0, ty, sz], [x0, ty + th, sz],
        [x0, ty + th, sz + t], [x0, ty, sz + t],
      ])
    }
  }
  return holes
}

export function backHoles3D(p: BoxParams, y0: number): Pt3[][] {
  const holes: Pt3[][] = []
  const t = tf(p), th = p.tabH
  for (const sz of shelfSlotYs(p))
    for (const tx of tabPositions(p, wi(p)))
      holes.push([
        [p.t + tx, y0, sz], [p.t + tx + th, y0, sz],
        [p.t + tx + th, y0, sz + t], [p.t + tx, y0, sz + t],
      ])
  return holes
}

// ── Cutting layout (shelf-based First Fit Decreasing) ────────────────────────
export interface Placed<T> { x: number; y: number; w: number; h: number; piece: T }

/**
 * First-Fit-Decreasing shelf packing. Generic over the piece payload so callers
 * keep their own labels/colors; pieces must already be sorted by descending area.
 */
export function computeLayout<T extends { w: number; h: number }>(
  pieces: T[], sheetW: number, sheetH: number, gap: number,
): Placed<T>[][] {
  let todo = pieces.slice()
  const result: Placed<T>[][] = []
  const g = gap, sw = sheetW, sh = sheetH

  while (todo.length > 0) {
    const sheetPieces: Placed<T>[] = []
    const shelves: { y: number; h: number; nx: number }[] = [{ y: g, h: 0, nx: g }]
    const remaining: T[] = []

    for (const p of todo) {
      let placed = false
      const orientations = Math.abs(p.w - p.h) < 0.01
        ? [[p.w, p.h]]
        : [[p.w, p.h], [p.h, p.w]]

      for (const [fw, fh] of orientations) {
        if (placed) break
        if (fw > sw - 2 * g || fh > sh - 2 * g) continue

        for (let si = 0; si < shelves.length && !placed; si++) {
          const s = shelves[si]
          if (s.nx + fw + g <= sw && s.y + fh + g <= sh) {
            sheetPieces.push({ x: s.nx, y: s.y, w: fw, h: fh, piece: p })
            shelves[si] = { y: s.y, h: Math.max(s.h, fh), nx: s.nx + fw + g }
            placed = true
          }
        }

        if (!placed) {
          const last = shelves[shelves.length - 1]
          if (last.h === 0) continue
          const newY = last.y + last.h + g
          if (newY + fh + g <= sh && g + fw + g <= sw) {
            shelves.push({ y: newY, h: fh, nx: g + fw + g })
            sheetPieces.push({ x: g, y: newY, w: fw, h: fh, piece: p })
            placed = true
          }
        }
      }

      if (!placed) remaining.push(p)
    }

    if (sheetPieces.length === 0) break
    result.push(sheetPieces)
    todo = remaining
  }

  return result
}

// ── SVG export ───────────────────────────────────────────────────────────────
export function wrapCutSvg(pathData: string, pw: number, ph: number, xOff = 0): string {
  return `<?xml version="1.0" encoding="utf-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="${pw.toFixed(2)}mm" height="${ph.toFixed(2)}mm" viewBox="${(-xOff).toFixed(2)} 0 ${pw.toFixed(2)} ${ph.toFixed(2)}">\n` +
    `  <path d="${pathData}" fill="none" stroke="#ff0000" stroke-width="0.01" stroke-linejoin="miter"/>\n` +
    `</svg>`
}
