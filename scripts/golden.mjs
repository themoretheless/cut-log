// FROZEN baseline generator for the box geometry fixtures (scripts/golden.json).
//
// This is a verbatim snapshot of the ORIGINAL geometry (taken when it still
// lived in BoxBuilder.vue, before it moved to frontend/src/box/geometry.ts). It
// is intentionally NOT kept in sync with geometry.ts: golden.json pins the
// behaviour, and frontend/src/box/geometry.golden.test.ts asserts geometry.ts
// still matches it. If you deliberately change the geometry, regenerate the
// fixtures from geometry.ts (e.g. via a tsx script) rather than from this file.
//
// Run: node scripts/golden.mjs > scripts/golden.json

// ── Reactive params modelled as {value} / computed getters ──────────────────
const W = { value: 0 }, H = { value: 0 }, D = { value: 0 }, T = { value: 0 }
const Kerf = { value: 0 }, TabH = { value: 0 }, NTab = { value: 0 }
const NShelves = { value: 0 }, Bevel = { value: 0 }
const SheetW = { value: 0 }, SheetH = { value: 0 }, CutGap = { value: 0 }

const TF = { get value() { return T.value + Kerf.value } }
const Wi = { get value() { return W.value - 2 * T.value } }
const Hi = { get value() { return H.value - 2 * T.value } }
const SideOW = { get value() { return D.value } }
const SideOff = { get value() { return 0 } }
const TopD = { get value() { return D.value - Math.max(Bevel.value, 0) } }
const BotD = { get value() { return D.value - Math.max(-Bevel.value, 0) } }

// stub i18n: return the last path segment, matching how labels are compared
const t = (k) => k.split('.').pop()

// ── tab positions ───────────────────────────────────────────────────────────
function tabPositions(L) {
  const n = NTab.value
  const th = TabH.value
  const gap = (L - n * th) / (n + 1)
  const pos = []
  for (let i = 0; i < n; i++) pos.push(gap + i * (gap + th))
  return pos
}

function depthTabs(fullLen, offset, len) {
  const th = TabH.value
  return tabPositions(fullLen)
    .filter(x => x >= offset && x + th <= offset + len)
    .map(x => x - offset)
}

function shelfSlotYs() {
  const ns = NShelves.value
  if (ns === 0) return []
  const tf = TF.value
  const hi = Hi.value
  const gap = (hi - ns * tf) / (ns + 1)
  const ys = []
  for (let i = 0; i < ns; i++) ys.push(T.value + gap + i * (gap + tf))
  return ys
}

const shelfColors = ['#e67e22', '#e74c3c', '#9b59b6', '#1abc9c', '#f1c40f', '#3498db']
function shelfColor(i) { return shelfColors[i % shelfColors.length] }

function shelfOffsetAt(sy) {
  const frac = sy / H.value
  const cTop = Math.max(Bevel.value, 0)
  const cBot = Math.max(-Bevel.value, 0)
  return cBot + (cTop - cBot) * frac
}

function shelfDepthAt(sy) {
  return D.value - shelfOffsetAt(sy)
}

// ── SVG path builders ───────────────────────────────────────────────────────
function f(v) { return v.toFixed(2) }

function pathSide() {
  const pw = D.value, ph = H.value, tf = TF.value, th = TabH.value
  const bv = Bevel.value
  const clipTop = Math.max(0, bv)
  const clipBot = Math.max(0, -bv)
  let d = `M${f(clipTop)},0`
  for (const x of tabPositions(D.value)) {
    if (x < clipTop) continue
    d += ` L${f(x)},0 L${f(x)},${f(tf)} L${f(x + th)},${f(tf)} L${f(x + th)},0`
  }
  d += ` L${f(pw)},0`
  for (const y of tabPositions(H.value))
    d += ` L${f(pw)},${f(y)} L${f(pw - tf)},${f(y)} L${f(pw - tf)},${f(y + th)} L${f(pw)},${f(y + th)}`
  d += ` L${f(pw)},${f(ph)}`
  for (const x of [...tabPositions(D.value)].reverse()) {
    if (x < clipBot) continue
    d += ` L${f(x + th)},${f(ph)} L${f(x + th)},${f(ph - tf)} L${f(x)},${f(ph - tf)} L${f(x)},${f(ph)}`
  }
  d += ` L${f(clipBot)},${f(ph)} Z`
  for (const sy of shelfSlotYs()) {
    const sOff = shelfOffsetAt(sy)
    for (const x of tabPositions(D.value)) {
      if (x < sOff || x + th > pw) continue
      d += ` M${f(x)},${f(sy)} L${f(x + th)},${f(sy)} L${f(x + th)},${f(sy + tf)} L${f(x)},${f(sy + tf)} Z`
    }
  }
  return d
}

function pathTopBottom(depth, depthOff = 0) {
  const ph = depth ?? D.value
  const pw = W.value, tf = TF.value, th = TabH.value, t = T.value, wi = Wi.value
  const sideTabs = depthTabs(D.value, depthOff, ph)
  let d = `M${f(t)},0 L${f(pw - t)},0`
  for (const y of sideTabs)
    d += ` L${f(pw - t)},${f(y)} L${f(pw)},${f(y)} L${f(pw)},${f(y + th)} L${f(pw - t)},${f(y + th)}`
  d += ` L${f(pw - t)},${f(ph)}`
  for (const x of [...tabPositions(wi)].reverse()) {
    const rx = t + x
    d += ` L${f(rx + th)},${f(ph)} L${f(rx + th)},${f(ph - tf)} L${f(rx)},${f(ph - tf)} L${f(rx)},${f(ph)}`
  }
  d += ` L${f(t)},${f(ph)}`
  for (const y of [...sideTabs].reverse())
    d += ` L${f(t)},${f(y + th)} L0,${f(y + th)} L0,${f(y)} L${f(t)},${f(y)}`
  d += ` L${f(t)},0 Z`
  return d
}

function pathBack() {
  const pw = W.value, ph = H.value, tf = TF.value, th = TabH.value, t = T.value
  const wi = Wi.value, hi = Hi.value
  let d = `M${f(t)},${f(t)}`
  for (const x of tabPositions(wi)) {
    const rx = t + x
    d += ` L${f(rx)},${f(t)} L${f(rx)},0 L${f(rx + th)},0 L${f(rx + th)},${f(t)}`
  }
  d += ` L${f(pw - t)},${f(t)}`
  for (const y of tabPositions(hi)) {
    const ry = t + y
    d += ` L${f(pw - t)},${f(ry)} L${f(pw)},${f(ry)} L${f(pw)},${f(ry + th)} L${f(pw - t)},${f(ry + th)}`
  }
  d += ` L${f(pw - t)},${f(ph - t)}`
  for (const x of [...tabPositions(wi)].reverse()) {
    const rx = t + x
    d += ` L${f(rx + th)},${f(ph - t)} L${f(rx + th)},${f(ph)} L${f(rx)},${f(ph)} L${f(rx)},${f(ph - t)}`
  }
  d += ` L${f(t)},${f(ph - t)}`
  for (const y of [...tabPositions(hi)].reverse()) {
    const ry = t + y
    d += ` L${f(t)},${f(ry + th)} L0,${f(ry + th)} L0,${f(ry)} L${f(t)},${f(ry)}`
  }
  d += ' Z'
  for (const sy of shelfSlotYs())
    for (const x of tabPositions(wi))
      d += ` M${f(t + x)},${f(sy)} L${f(t + x + th)},${f(sy)} L${f(t + x + th)},${f(sy + tf)} L${f(t + x)},${f(sy + tf)} Z`
  return d
}

function pathShelf(depth, depthOff = 0) {
  const ph = depth ?? D.value
  const pw = W.value, tf = TF.value, th = TabH.value, t = T.value, wi = Wi.value
  const sideTabs = depthTabs(D.value, depthOff, ph)
  let d = `M${f(t)},0 L${f(pw - t)},0`
  for (const y of sideTabs)
    d += ` L${f(pw - t)},${f(y)} L${f(pw)},${f(y)} L${f(pw)},${f(y + th)} L${f(pw - t)},${f(y + th)}`
  d += ` L${f(pw - t)},${f(ph - t)}`
  for (const x of [...tabPositions(wi)].reverse()) {
    const rx = t + x
    d += ` L${f(rx + th)},${f(ph - t)} L${f(rx + th)},${f(ph)} L${f(rx)},${f(ph)} L${f(rx)},${f(ph - t)}`
  }
  d += ` L${f(t)},${f(ph - t)}`
  for (const y of [...sideTabs].reverse())
    d += ` L${f(t)},${f(y + th)} L0,${f(y + th)} L0,${f(y)} L${f(t)},${f(y)}`
  d += ` L${f(t)},0 Z`
  return d
}

function svgScale(pw, ph) {
  return Math.min(460 / (pw + 20), 320 / (ph + 20))
}

// ── pieces + layout ─────────────────────────────────────────────────────────
function allPieces() {
  const side = t('box.side_short')
  const list = [
    { w: SideOW.value, h: H.value, label: `${side}1`, color: 'var(--accent)' },
    { w: SideOW.value, h: H.value, label: `${side}2`, color: 'var(--accent)' },
    { w: W.value, h: TopD.value, label: t('box.top_short'), color: '#27ae60' },
    { w: W.value, h: BotD.value, label: t('box.bottom_short'), color: Bevel.value !== 0 ? '#1abc9c' : '#27ae60' },
    { w: W.value, h: H.value, label: t('box.back_short'), color: '#8e44ad' },
  ]
  const sys = shelfSlotYs()
  for (let i = 0; i < sys.length; i++) {
    const sd = shelfDepthAt(sys[i])
    list.push({ w: W.value, h: sd, label: `${t('box.shelf_short')}${i + 1}`, color: Bevel.value !== 0 ? shelfColor(i) : '#e67e22' })
  }
  list.sort((a, b) => b.w * b.h - a.w * a.h)
  return list
}

function computeLayout() {
  let todo = allPieces()
  const result = []
  const g = CutGap.value
  const sw = SheetW.value
  const sh = SheetH.value

  while (todo.length > 0) {
    const sheetPieces = []
    const shelves = [{ y: g, h: 0, nx: g }]
    const remaining = []

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
            sheetPieces.push({ x: s.nx, y: s.y, w: fw, h: fh, label: p.label, color: p.color })
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
            sheetPieces.push({ x: g, y: newY, w: fw, h: fh, label: p.label, color: p.color })
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

// ── 3D contour generators ───────────────────────────────────────────────────
function sidePts3D(x0) {
  const pts = []
  const a = (y, z) => pts.push([x0, y, z])
  const d = D.value, h = H.value, tf = TF.value, th = TabH.value
  const bv = Bevel.value
  const clipBot = Math.max(0, -bv)
  const clipTop = Math.max(0, bv)
  a(clipBot, 0)
  for (const ty of tabPositions(d)) {
    if (ty < clipBot) continue
    a(ty, 0); a(ty, tf); a(ty + th, tf); a(ty + th, 0)
  }
  a(d, 0)
  for (const tz of tabPositions(h)) { a(d, tz); a(d - tf, tz); a(d - tf, tz + th); a(d, tz + th) }
  a(d, h)
  for (const ty of [...tabPositions(d)].reverse()) {
    if (ty < clipTop) continue
    a(ty + th, h); a(ty + th, h - tf); a(ty, h - tf); a(ty, h)
  }
  a(clipTop, h)
  return pts
}

function horizPts3D(z0, depth, yOff = 0) {
  const pts = []
  const a = (x, y) => pts.push([x, y + yOff, z0])
  const w = W.value, d = depth ?? D.value, tf = TF.value, th = TabH.value, t = T.value, wi = Wi.value
  const sTabs = depthTabs(D.value, yOff, d)
  a(t, 0); a(w - t, 0)
  for (const ty of sTabs) { a(w - t, ty); a(w, ty); a(w, ty + th); a(w - t, ty + th) }
  a(w - t, d)
  for (const tx of [...tabPositions(wi)].reverse()) {
    const rx = t + tx
    a(rx + th, d); a(rx + th, d - tf); a(rx, d - tf); a(rx, d)
  }
  a(t, d)
  for (const ty of [...sTabs].reverse()) { a(t, ty + th); a(0, ty + th); a(0, ty); a(t, ty) }
  return pts
}

function backPts3D(y0) {
  const pts = []
  const a = (x, z) => pts.push([x, y0, z])
  const w = W.value, h = H.value, tf = TF.value, th = TabH.value, t = T.value
  const wi = Wi.value, hi = Hi.value
  a(t, t)
  for (const tx of tabPositions(wi)) { const rx = t + tx; a(rx, t); a(rx, 0); a(rx + th, 0); a(rx + th, t) }
  a(w - t, t)
  for (const tz of tabPositions(hi)) { const rz = t + tz; a(w - t, rz); a(w, rz); a(w, rz + th); a(w - t, rz + th) }
  a(w - t, h - t)
  for (const tx of [...tabPositions(wi)].reverse()) { const rx = t + tx; a(rx + th, h - t); a(rx + th, h); a(rx, h); a(rx, h - t) }
  a(t, h - t)
  for (const tz of [...tabPositions(hi)].reverse()) { const rz = t + tz; a(t, rz + th); a(0, rz + th); a(0, rz); a(t, rz) }
  return pts
}

function shelfPts3D(z0, depth, yOff = 0) {
  const pts = []
  const a = (x, y) => pts.push([x, y + yOff, z0])
  const w = W.value, d = depth ?? D.value, tf = TF.value, th = TabH.value, t = T.value, wi = Wi.value
  const sTabs = depthTabs(D.value, yOff, d)
  a(t, 0); a(w - t, 0)
  for (const ty of sTabs) { a(w - t, ty); a(w, ty); a(w, ty + th); a(w - t, ty + th) }
  a(w - t, d - t)
  for (const tx of [...tabPositions(wi)].reverse()) {
    const rx = t + tx
    a(rx + th, d - t); a(rx + th, d); a(rx, d); a(rx, d - t)
  }
  a(t, d - t)
  for (const ty of [...sTabs].reverse()) { a(t, ty + th); a(0, ty + th); a(0, ty); a(t, ty) }
  return pts
}

function sideHoles3D(x0) {
  const holes = []
  const tf = TF.value, th = TabH.value, d = D.value
  for (const sz of shelfSlotYs()) {
    const sOff = shelfOffsetAt(sz)
    for (const ty of tabPositions(d)) {
      if (ty < sOff || ty + th > d) continue
      holes.push([
        [x0, ty, sz], [x0, ty + th, sz],
        [x0, ty + th, sz + tf], [x0, ty, sz + tf],
      ])
    }
  }
  return holes
}

function backHoles3D(y0) {
  const holes = []
  const tf = TF.value, th = TabH.value, t = T.value
  for (const sz of shelfSlotYs())
    for (const tx of tabPositions(Wi.value))
      holes.push([
        [t + tx, y0, sz], [t + tx + th, y0, sz],
        [t + tx + th, y0, sz + tf], [t + tx, y0, sz + tf],
      ])
  return holes
}

// ── parameter matrix ────────────────────────────────────────────────────────
const cases = [
  { name: 'basic',           W: 300, H: 400, D: 200, T: 6, Kerf: 0.1, TabH: 30, NTab: 1, NShelves: 0, Bevel: 0,   SheetW: 1220, SheetH: 2440, CutGap: 5 },
  { name: 'shelves',         W: 300, H: 400, D: 200, T: 6, Kerf: 0.1, TabH: 30, NTab: 1, NShelves: 2, Bevel: 0,   SheetW: 1220, SheetH: 2440, CutGap: 5 },
  { name: 'multitab',        W: 500, H: 600, D: 300, T: 8, Kerf: 0.2, TabH: 25, NTab: 3, NShelves: 0, Bevel: 0,   SheetW: 1220, SheetH: 2440, CutGap: 5 },
  { name: 'bevel_pos',       W: 300, H: 400, D: 200, T: 6, Kerf: 0.1, TabH: 30, NTab: 1, NShelves: 0, Bevel: 40,  SheetW: 1220, SheetH: 2440, CutGap: 5 },
  { name: 'bevel_neg',       W: 300, H: 400, D: 200, T: 6, Kerf: 0.1, TabH: 30, NTab: 1, NShelves: 0, Bevel: -40, SheetW: 1220, SheetH: 2440, CutGap: 5 },
  { name: 'bevel_shelves',   W: 350, H: 500, D: 250, T: 6, Kerf: 0.1, TabH: 30, NTab: 2, NShelves: 2, Bevel: 30,  SheetW: 1220, SheetH: 2440, CutGap: 5 },
  { name: 'bevel_neg_shelf', W: 350, H: 500, D: 250, T: 6, Kerf: 0.1, TabH: 30, NTab: 2, NShelves: 3, Bevel: -25, SheetW: 1220, SheetH: 2440, CutGap: 4 },
  { name: 'big_multi',       W: 800, H: 1200, D: 600, T: 10, Kerf: 0.3, TabH: 40, NTab: 4, NShelves: 5, Bevel: 0, SheetW: 1220, SheetH: 2440, CutGap: 6 },
]

function setParams(c) {
  W.value = c.W; H.value = c.H; D.value = c.D; T.value = c.T; Kerf.value = c.Kerf
  TabH.value = c.TabH; NTab.value = c.NTab; NShelves.value = c.NShelves; Bevel.value = c.Bevel
  SheetW.value = c.SheetW; SheetH.value = c.SheetH; CutGap.value = c.CutGap
}

const out = {}
for (const c of cases) {
  setParams(c)
  const sys = shelfSlotYs()
  const topOff = Math.max(Bevel.value, 0), botOff = Math.max(-Bevel.value, 0)
  out[c.name] = {
    params: c,
    tabPositions: { d: tabPositions(D.value), h: tabPositions(H.value), wi: tabPositions(Wi.value), hi: tabPositions(Hi.value) },
    shelfSlotYs: sys,
    shelfDepths: sys.map(shelfDepthAt),
    shelfOffsets: sys.map(shelfOffsetAt),
    pathSide: pathSide(),
    pathTopBottom_full: pathTopBottom(),
    pathTop: pathTopBottom(TopD.value, topOff),
    pathBottom: pathTopBottom(BotD.value, botOff),
    pathBack: pathBack(),
    pathShelf_full: pathShelf(),
    pathShelf_each: sys.map(sy => pathShelf(shelfDepthAt(sy), shelfOffsetAt(sy))),
    sidePts3D_0: sidePts3D(0),
    sidePts3D_w: sidePts3D(W.value),
    horizPts3D_top: horizPts3D(H.value, TopD.value, topOff),
    horizPts3D_bot: horizPts3D(0, BotD.value, botOff),
    backPts3D: backPts3D(D.value),
    shelfPts3D_each: sys.map(sy => shelfPts3D(sy, shelfDepthAt(sy), shelfOffsetAt(sy))),
    sideHoles3D_0: sideHoles3D(0),
    sideHoles3D_w: sideHoles3D(W.value),
    backHoles3D: backHoles3D(D.value),
    allPieces: allPieces(),
    computeLayout: computeLayout(),
  }
}

process.stdout.write(JSON.stringify(out, null, 1))
