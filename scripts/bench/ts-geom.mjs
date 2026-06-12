// The ORIGINAL TypeScript box geometry (bodies copied verbatim from the
// pre-refactor BoxBuilder.vue, type annotations stripped). Exposed as a single
// buildAll(params) that produces the same payload the wasm box_model + box_layout
// produce: every SVG cut path, the full 3D assembly geometry, and the layout.

const W = { value: 0 }, H = { value: 0 }, D = { value: 0 }, T = { value: 0 }
const Kerf = { value: 0 }, TabH = { value: 0 }, NTab = { value: 0 }
const NShelves = { value: 0 }, Bevel = { value: 0 }
const SheetW = { value: 0 }, SheetH = { value: 0 }, CutGap = { value: 0 }

const TF = { get value() { return T.value + Kerf.value } }
const Wi = { get value() { return W.value - 2 * T.value } }
const Hi = { get value() { return H.value - 2 * T.value } }
const SideOW = { get value() { return D.value } }
const TopD = { get value() { return D.value - Math.max(Bevel.value, 0) } }
const BotD = { get value() { return D.value - Math.max(-Bevel.value, 0) } }

function tabPositions(L) {
  const n = NTab.value, th = TabH.value
  const gap = (L - n * th) / (n + 1)
  const pos = []
  for (let i = 0; i < n; i++) pos.push(gap + i * (gap + th))
  return pos
}
function depthTabs(fullLen, offset, len) {
  const th = TabH.value
  return tabPositions(fullLen).filter(x => x >= offset && x + th <= offset + len).map(x => x - offset)
}
function shelfSlotYs() {
  const ns = NShelves.value
  if (ns === 0) return []
  const tf = TF.value, hi = Hi.value
  const gap = (hi - ns * tf) / (ns + 1)
  const ys = []
  for (let i = 0; i < ns; i++) ys.push(T.value + gap + i * (gap + tf))
  return ys
}
function shelfOffsetAt(sy) {
  const frac = sy / H.value
  const cTop = Math.max(Bevel.value, 0), cBot = Math.max(-Bevel.value, 0)
  return cBot + (cTop - cBot) * frac
}
function shelfDepthAt(sy) { return D.value - shelfOffsetAt(sy) }
function f(v) { return v.toFixed(2) }

function pathSide() {
  const pw = D.value, ph = H.value, tf = TF.value, th = TabH.value
  const bv = Bevel.value, clipTop = Math.max(0, bv), clipBot = Math.max(0, -bv)
  let d = `M${f(clipTop)},0`
  for (const x of tabPositions(D.value)) { if (x < clipTop) continue; d += ` L${f(x)},0 L${f(x)},${f(tf)} L${f(x + th)},${f(tf)} L${f(x + th)},0` }
  d += ` L${f(pw)},0`
  for (const y of tabPositions(H.value)) d += ` L${f(pw)},${f(y)} L${f(pw - tf)},${f(y)} L${f(pw - tf)},${f(y + th)} L${f(pw)},${f(y + th)}`
  d += ` L${f(pw)},${f(ph)}`
  for (const x of [...tabPositions(D.value)].reverse()) { if (x < clipBot) continue; d += ` L${f(x + th)},${f(ph)} L${f(x + th)},${f(ph - tf)} L${f(x)},${f(ph - tf)} L${f(x)},${f(ph)}` }
  d += ` L${f(clipBot)},${f(ph)} Z`
  for (const sy of shelfSlotYs()) {
    const sOff = shelfOffsetAt(sy)
    for (const x of tabPositions(D.value)) { if (x < sOff || x + th > pw) continue; d += ` M${f(x)},${f(sy)} L${f(x + th)},${f(sy)} L${f(x + th)},${f(sy + tf)} L${f(x)},${f(sy + tf)} Z` }
  }
  return d
}
function pathTopBottom(depth, depthOff = 0) {
  const ph = depth ?? D.value
  const pw = W.value, tf = TF.value, th = TabH.value, t = T.value, wi = Wi.value
  const sideTabs = depthTabs(D.value, depthOff, ph)
  let d = `M${f(t)},0 L${f(pw - t)},0`
  for (const y of sideTabs) d += ` L${f(pw - t)},${f(y)} L${f(pw)},${f(y)} L${f(pw)},${f(y + th)} L${f(pw - t)},${f(y + th)}`
  d += ` L${f(pw - t)},${f(ph)}`
  for (const x of [...tabPositions(wi)].reverse()) { const rx = t + x; d += ` L${f(rx + th)},${f(ph)} L${f(rx + th)},${f(ph - tf)} L${f(rx)},${f(ph - tf)} L${f(rx)},${f(ph)}` }
  d += ` L${f(t)},${f(ph)}`
  for (const y of [...sideTabs].reverse()) d += ` L${f(t)},${f(y + th)} L0,${f(y + th)} L0,${f(y)} L${f(t)},${f(y)}`
  d += ` L${f(t)},0 Z`
  return d
}
function pathBack() {
  const pw = W.value, ph = H.value, tf = TF.value, th = TabH.value, t = T.value, wi = Wi.value, hi = Hi.value
  let d = `M${f(t)},${f(t)}`
  for (const x of tabPositions(wi)) { const rx = t + x; d += ` L${f(rx)},${f(t)} L${f(rx)},0 L${f(rx + th)},0 L${f(rx + th)},${f(t)}` }
  d += ` L${f(pw - t)},${f(t)}`
  for (const y of tabPositions(hi)) { const ry = t + y; d += ` L${f(pw - t)},${f(ry)} L${f(pw)},${f(ry)} L${f(pw)},${f(ry + th)} L${f(pw - t)},${f(ry + th)}` }
  d += ` L${f(pw - t)},${f(ph - t)}`
  for (const x of [...tabPositions(wi)].reverse()) { const rx = t + x; d += ` L${f(rx + th)},${f(ph - t)} L${f(rx + th)},${f(ph)} L${f(rx)},${f(ph)} L${f(rx)},${f(ph - t)}` }
  d += ` L${f(t)},${f(ph - t)}`
  for (const y of [...tabPositions(hi)].reverse()) { const ry = t + y; d += ` L${f(t)},${f(ry + th)} L0,${f(ry + th)} L0,${f(ry)} L${f(t)},${f(ry)}` }
  d += ' Z'
  for (const sy of shelfSlotYs()) for (const x of tabPositions(wi)) d += ` M${f(t + x)},${f(sy)} L${f(t + x + th)},${f(sy)} L${f(t + x + th)},${f(sy + tf)} L${f(t + x)},${f(sy + tf)} Z`
  return d
}
function pathShelf(depth, depthOff = 0) {
  const ph = depth ?? D.value
  const pw = W.value, tf = TF.value, th = TabH.value, t = T.value, wi = Wi.value
  const sideTabs = depthTabs(D.value, depthOff, ph)
  let d = `M${f(t)},0 L${f(pw - t)},0`
  for (const y of sideTabs) d += ` L${f(pw - t)},${f(y)} L${f(pw)},${f(y)} L${f(pw)},${f(y + th)} L${f(pw - t)},${f(y + th)}`
  d += ` L${f(pw - t)},${f(ph - t)}`
  for (const x of [...tabPositions(wi)].reverse()) { const rx = t + x; d += ` L${f(rx + th)},${f(ph - t)} L${f(rx + th)},${f(ph)} L${f(rx)},${f(ph)} L${f(rx)},${f(ph - t)}` }
  d += ` L${f(t)},${f(ph - t)}`
  for (const y of [...sideTabs].reverse()) d += ` L${f(t)},${f(y + th)} L0,${f(y + th)} L0,${f(y)} L${f(t)},${f(y)}`
  d += ` L${f(t)},0 Z`
  return d
}
function sidePts3D(x0) {
  const pts = [], a = (y, z) => pts.push([x0, y, z])
  const d = D.value, h = H.value, tf = TF.value, th = TabH.value, bv = Bevel.value
  const clipBot = Math.max(0, -bv), clipTop = Math.max(0, bv)
  a(clipBot, 0)
  for (const ty of tabPositions(d)) { if (ty < clipBot) continue; a(ty, 0); a(ty, tf); a(ty + th, tf); a(ty + th, 0) }
  a(d, 0)
  for (const tz of tabPositions(h)) { a(d, tz); a(d - tf, tz); a(d - tf, tz + th); a(d, tz + th) }
  a(d, h)
  for (const ty of [...tabPositions(d)].reverse()) { if (ty < clipTop) continue; a(ty + th, h); a(ty + th, h - tf); a(ty, h - tf); a(ty, h) }
  a(clipTop, h)
  return pts
}
function horizPts3D(z0, depth, yOff = 0) {
  const pts = [], a = (x, y) => pts.push([x, y + yOff, z0])
  const w = W.value, d = depth ?? D.value, tf = TF.value, th = TabH.value, t = T.value, wi = Wi.value
  const sTabs = depthTabs(D.value, yOff, d)
  a(t, 0); a(w - t, 0)
  for (const ty of sTabs) { a(w - t, ty); a(w, ty); a(w, ty + th); a(w - t, ty + th) }
  a(w - t, d)
  for (const tx of [...tabPositions(wi)].reverse()) { const rx = t + tx; a(rx + th, d); a(rx + th, d - tf); a(rx, d - tf); a(rx, d) }
  a(t, d)
  for (const ty of [...sTabs].reverse()) { a(t, ty + th); a(0, ty + th); a(0, ty); a(t, ty) }
  return pts
}
function backPts3D(y0) {
  const pts = [], a = (x, z) => pts.push([x, y0, z])
  const w = W.value, h = H.value, tf = TF.value, th = TabH.value, t = T.value, wi = Wi.value, hi = Hi.value
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
  const pts = [], a = (x, y) => pts.push([x, y + yOff, z0])
  const w = W.value, d = depth ?? D.value, tf = TF.value, th = TabH.value, t = T.value, wi = Wi.value
  const sTabs = depthTabs(D.value, yOff, d)
  a(t, 0); a(w - t, 0)
  for (const ty of sTabs) { a(w - t, ty); a(w, ty); a(w, ty + th); a(w - t, ty + th) }
  a(w - t, d - t)
  for (const tx of [...tabPositions(wi)].reverse()) { const rx = t + tx; a(rx + th, d - t); a(rx + th, d); a(rx, d); a(rx, d - t) }
  a(t, d - t)
  for (const ty of [...sTabs].reverse()) { a(t, ty + th); a(0, ty + th); a(0, ty); a(t, ty) }
  return pts
}
function sideHoles3D(x0) {
  const holes = [], tf = TF.value, th = TabH.value, d = D.value
  for (const sz of shelfSlotYs()) {
    const sOff = shelfOffsetAt(sz)
    for (const ty of tabPositions(d)) { if (ty < sOff || ty + th > d) continue; holes.push([[x0, ty, sz], [x0, ty + th, sz], [x0, ty + th, sz + tf], [x0, ty, sz + tf]]) }
  }
  return holes
}
function backHoles3D(y0) {
  const holes = [], tf = TF.value, th = TabH.value, t = T.value
  for (const sz of shelfSlotYs()) for (const tx of tabPositions(Wi.value)) holes.push([[t + tx, y0, sz], [t + tx + th, y0, sz], [t + tx + th, y0, sz + tf], [t + tx, y0, sz + tf]])
  return holes
}
function allPieces() {
  const list = [
    { w: SideOW.value, h: H.value, id: 'side1' }, { w: SideOW.value, h: H.value, id: 'side2' },
    { w: W.value, h: TopD.value, id: 'top' }, { w: W.value, h: BotD.value, id: 'bot' },
    { w: W.value, h: H.value, id: 'back' },
  ]
  const sys = shelfSlotYs()
  for (let i = 0; i < sys.length; i++) list.push({ w: W.value, h: shelfDepthAt(sys[i]), id: `shelf${i}` })
  list.sort((a, b) => b.w * b.h - a.w * a.h)
  return list
}
function computeLayout() {
  let todo = allPieces()
  const result = [], g = CutGap.value, sw = SheetW.value, sh = SheetH.value
  while (todo.length > 0) {
    const sheetPieces = [], shelves = [{ y: g, h: 0, nx: g }], remaining = []
    for (const p of todo) {
      let placed = false
      const orientations = Math.abs(p.w - p.h) < 0.01 ? [[p.w, p.h]] : [[p.w, p.h], [p.h, p.w]]
      for (const [fw, fh] of orientations) {
        if (placed) break
        if (fw > sw - 2 * g || fh > sh - 2 * g) continue
        for (let si = 0; si < shelves.length && !placed; si++) {
          const s = shelves[si]
          if (s.nx + fw + g <= sw && s.y + fh + g <= sh) { sheetPieces.push({ x: s.nx, y: s.y, w: fw, h: fh, id: p.id }); shelves[si] = { y: s.y, h: Math.max(s.h, fh), nx: s.nx + fw + g }; placed = true }
        }
        if (!placed) {
          const last = shelves[shelves.length - 1]
          if (last.h === 0) continue
          const newY = last.y + last.h + g
          if (newY + fh + g <= sh && g + fw + g <= sw) { shelves.push({ y: newY, h: fh, nx: g + fw + g }); sheetPieces.push({ x: g, y: newY, w: fw, h: fh, id: p.id }); placed = true }
        }
      }
      if (!placed) remaining.push(p)
    }
    if (sheetPieces.length === 0) break
    result.push(sheetPieces); todo = remaining
  }
  return result
}

export function setParams(c) {
  W.value = c.W; H.value = c.H; D.value = c.D; T.value = c.T; Kerf.value = c.Kerf
  TabH.value = c.TabH; NTab.value = c.NTab; NShelves.value = c.NShelves; Bevel.value = c.Bevel
  SheetW.value = c.SheetW; SheetH.value = c.SheetH; CutGap.value = c.CutGap
}

// Produces the same payload as wasm box_model + box_layout combined.
export function buildAll(c) {
  setParams(c)
  const sys = shelfSlotYs()
  const topOff = Math.max(Bevel.value, 0), botOff = Math.max(-Bevel.value, 0)

  const gallery = [{ id: 'side', count: 2, w: D.value, h: H.value, path: pathSide(), panel: { c: sidePts3D(0), h: sideHoles3D(0) } }]
  if (Bevel.value === 0) gallery.push({ id: 'tb', count: 2, w: W.value, h: D.value, path: pathTopBottom(), panel: { c: horizPts3D(0) } })
  else { gallery.push({ id: 'top', count: 1, w: W.value, h: TopD.value, path: pathTopBottom(TopD.value, topOff), panel: { c: horizPts3D(0, TopD.value, topOff) } }); gallery.push({ id: 'bot', count: 1, w: W.value, h: BotD.value, path: pathTopBottom(BotD.value, botOff), panel: { c: horizPts3D(0, BotD.value, botOff) } }) }
  gallery.push({ id: 'back', count: 1, w: W.value, h: H.value, path: pathBack(), panel: { c: backPts3D(0), h: backHoles3D(0) } })
  if (Bevel.value === 0 && sys.length > 0) gallery.push({ id: 'shelf', count: sys.length, w: W.value, h: D.value, path: pathShelf(), panel: { c: shelfPts3D(0) } })
  else for (let i = 0; i < sys.length; i++) { const sd = shelfDepthAt(sys[i]), so = shelfOffsetAt(sys[i]); gallery.push({ id: `shelf${i}`, count: 1, w: W.value, h: sd, path: pathShelf(sd, so), panel: { c: shelfPts3D(0, sd, so) } }) }

  const scene = {
    panels: [
      { id: 'side', c: sidePts3D(0), h: sideHoles3D(0) },
      { id: 'side', c: sidePts3D(W.value), h: sideHoles3D(W.value) },
      { id: 'top', c: horizPts3D(H.value, TopD.value, topOff) },
      { id: 'bot', c: horizPts3D(0, BotD.value, botOff) },
      { id: 'back', c: backPts3D(D.value), h: backHoles3D(D.value) },
      ...sys.map((sy) => ({ id: 'shelf', c: shelfPts3D(sy, shelfDepthAt(sy), shelfOffsetAt(sy)) })),
    ],
  }

  const layout = computeLayout()
  return { gallery, scene, layout }
}
