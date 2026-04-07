<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import NumberField from '@/components/NumberField.vue'
import { useL10n } from '@/stores/l10n'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { TrackballControls } from 'three/addons/controls/TrackballControls.js'

const { t } = useL10n()

// ── Parameters ──────────────────────────────────────────────────────────────
const W = ref(300)
const H = ref(400)
const D = ref(200)
const T = ref(6)
const Kerf = ref(0.1)
const TabH = ref(30)
const NTab = ref(1)
const NShelves = ref(0)
const Bevel = ref(0)

const SheetW = ref(1220)
const SheetH = ref(2440)
const CutGap = ref(5)

const isoExplode = ref(0.22)
let isoExplodeCurrent = 0.22

// ── Computed ────────────────────────────────────────────────────────────────
const TF = computed(() => T.value + Kerf.value)
const Wi = computed(() => W.value - 2 * T.value)
const Hi = computed(() => H.value - 2 * T.value)
const SideOW = computed(() => D.value)
const SideOff = computed(() => 0)
const TopD = computed(() => D.value - Math.max(Bevel.value, 0))
const BotD = computed(() => D.value - Math.max(-Bevel.value, 0))

// ── Tab positions ───────────────────────────────────────────────────────────
function tabPositions(L: number): number[] {
  const n = NTab.value
  const th = TabH.value
  const gap = (L - n * th) / (n + 1)
  const pos: number[] = []
  for (let i = 0; i < n; i++) pos.push(gap + i * (gap + th))
  return pos
}

/** Tab positions from tabPositions(fullLen), filtered to [offset, offset+len] and shifted by -offset */
function depthTabs(fullLen: number, offset: number, len: number): number[] {
  const th = TabH.value
  return tabPositions(fullLen)
    .filter(x => x >= offset && x + th <= offset + len)
    .map(x => x - offset)
}

// ── Shelf slot Y positions ──────────────────────────────────────────────────
function shelfSlotYs(): number[] {
  const ns = NShelves.value
  if (ns === 0) return []
  const tf = TF.value
  const hi = Hi.value
  const gap = (hi - ns * tf) / (ns + 1)
  const ys: number[] = []
  for (let i = 0; i < ns; i++) ys.push(T.value + gap + i * (gap + tf))
  return ys
}

const shelfColors = ['#e67e22', '#e74c3c', '#9b59b6', '#1abc9c', '#f1c40f', '#3498db']
function shelfColor(i: number) { return shelfColors[i % shelfColors.length] }
function shelfEdgeColor(i: number) {
  const cols = ['#ca6f1e', '#c0392b', '#7d3c98', '#148f77', '#d4ac0d', '#2471a3']
  return cols[i % cols.length]
}

function shelfOffsetAt(sy: number): number {
  const frac = sy / H.value
  const cTop = Math.max(Bevel.value, 0)
  const cBot = Math.max(-Bevel.value, 0)
  return cBot + (cTop - cBot) * frac
}

function shelfDepthAt(sy: number): number {
  return D.value - shelfOffsetAt(sy)
}

// ── SVG path builders ───────────────────────────────────────────────────────
function f(v: number): string { return v.toFixed(2) }

function pathSide(): string {
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

function pathTopBottom(depth?: number, depthOff = 0): string {
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

function pathBack(): string {
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

function pathShelf(depth?: number, depthOff = 0): string {
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

// ── SVG rendering helpers ───────────────────────────────────────────────────
function svgScale(pw: number, ph: number): number {
  return Math.min(460 / (pw + 20), 320 / (ph + 20))
}

// ── Piece data lookup by label ──────────────────────────────────────────────
function pieceData(label: string): { ow: number; oh: number; path: string; xOff: number } {
  const side = t('box.side_short')
  const back = t('box.back_short')
  if (label.startsWith(side)) return { ow: SideOW.value, oh: H.value, path: pathSide(), xOff: SideOff.value }
  if (label === t('box.top_short')) return { ow: W.value, oh: TopD.value, path: pathTopBottom(TopD.value, Math.max(Bevel.value, 0)), xOff: 0 }
  if (label === t('box.bottom_short')) return { ow: W.value, oh: BotD.value, path: pathTopBottom(BotD.value, Math.max(-Bevel.value, 0)), xOff: 0 }
  if (label.startsWith(back)) return { ow: W.value, oh: H.value, path: pathBack(), xOff: 0 }
  const shIdx = parseInt(label.replace(t('box.shelf_short'), '')) - 1
  const sys = shelfSlotYs()
  const sy = shIdx >= 0 && shIdx < sys.length ? sys[shIdx] : 0
  const sd = shelfDepthAt(sy)
  const sOff = shelfOffsetAt(sy)
  return { ow: W.value, oh: sd, path: pathShelf(sd, sOff), xOff: 0 }
}

// ── Cutting layout (shelf-based FFD with rotation) ──────────────────────────
interface PieceInfo { w: number; h: number; label: string; color: string }
interface LayoutPiece { x: number; y: number; w: number; h: number; label: string; color: string }

function allPieces(): PieceInfo[] {
  const side = t('box.side_short')
  const list: PieceInfo[] = [
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

function computeLayout(): LayoutPiece[][] {
  let todo = allPieces()
  const result: LayoutPiece[][] = []
  const g = CutGap.value
  const sw = SheetW.value
  const sh = SheetH.value

  while (todo.length > 0) {
    const sheetPieces: LayoutPiece[] = []
    const shelves: { y: number; h: number; nx: number }[] = [{ y: g, h: 0, nx: g }]
    const remaining: PieceInfo[] = []

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

const cuttingSheets = computed(() => computeLayout())
const cuttingPieces = computed(() => allPieces())

const cutStats = computed(() => {
  const sheets = cuttingSheets.value
  const all = cuttingPieces.value
  const totalPieceArea = all.reduce((s, p) => s + p.w * p.h, 0)
  const totalSheetArea = sheets.length * SheetW.value * SheetH.value
  const util = totalSheetArea > 0 ? (totalPieceArea / totalSheetArea * 100) : 0
  return {
    sheets: sheets.length,
    pieceArea: (totalPieceArea / 1e6).toFixed(4),
    sheetArea: (totalSheetArea / 1e6).toFixed(4),
    util: util.toFixed(1),
  }
})

const cutScale = computed(() => Math.min(480 / SheetW.value, 480 / SheetH.value))

const tooBigPieces = computed(() => {
  const all = cuttingPieces.value
  const g = CutGap.value
  const sw = SheetW.value
  const sh = SheetH.value
  return all.filter(p =>
    (p.w > sw - 2 * g || p.h > sh - 2 * g) &&
    (p.h > sw - 2 * g || p.w > sh - 2 * g)
  )
})

// ── THREE.JS 3D scene ───────────────────────────────────────────────────────
let scene: THREE.Scene | null = null
let camera: THREE.PerspectiveCamera | null = null
let renderer: THREE.WebGLRenderer | null = null
let controls: OrbitControls | null = null
let panelGroup: THREE.Group | null = null
let guidesGroup: THREE.Group | null = null
let labelsGroup: THREE.Group | null = null
let resizeObs: ResizeObserver | null = null
let animFrameId = 0

function clearGroup(g: THREE.Group) {
  while (g.children.length) {
    const c = g.children[0]
    g.remove(c)
    disposeObj(c)
  }
}

function disposeObj(obj: THREE.Object3D) {
  if ('children' in obj) obj.children.forEach(disposeObj)
  if ('geometry' in obj && (obj as THREE.Mesh).geometry)
    (obj as THREE.Mesh).geometry.dispose()
  if ('material' in obj) {
    const mat = (obj as THREE.Mesh).material
    if (Array.isArray(mat)) mat.forEach(m => m.dispose())
    else if (mat) (mat as THREE.Material).dispose()
  }
}

function makeLabel(text: string, color: string, sub?: string): THREE.Sprite {
  const canvas = document.createElement('canvas')
  const sz = 256
  canvas.width = sz
  canvas.height = sub ? 80 : 48
  const ctx = canvas.getContext('2d')!
  ctx.textAlign = 'center'
  ctx.font = 'bold 26px sans-serif'
  ctx.fillStyle = color
  ctx.fillText(text, sz / 2, sub ? 24 : 28)
  if (sub) {
    ctx.font = '20px sans-serif'
    ctx.fillStyle = '#999'
    ctx.fillText(sub, sz / 2, 56)
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.minFilter = THREE.LinearFilter
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false })
  const sprite = new THREE.Sprite(mat)
  sprite.scale.set(110, sub ? 34 : 20, 1)
  sprite.renderOrder = 999
  return sprite
}

interface PanelData {
  c: number[][]
  n: number[]
  t: number
  col: string
  ec: string
  h?: number[][][]
}

function buildPanel(p: PanelData): THREE.Mesh | null {
  const pts = p.c
  const n = p.n
  const thick = p.t
  const col = p.col
  const ec = p.ec
  const holes = p.h

  const ax = Math.abs(n[0])
  const ay = Math.abs(n[1])
  const az = Math.abs(n[2])
  let drop: number, u: number, v: number

  if (az >= ax && az >= ay) { drop = 2; u = 0; v = 1 }
  else if (ax >= ay) { drop = 0; u = 1; v = 2 }
  else { drop = 1; u = 0; v = 2 }

  const base = pts[0][drop]

  const shape = new THREE.Shape()
  shape.moveTo(pts[0][u], pts[0][v])
  for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i][u], pts[i][v])

  if (holes) {
    for (const hole of holes) {
      const hp = new THREE.Path()
      hp.moveTo(hole[0][u], hole[0][v])
      for (let i = 1; i < hole.length; i++) hp.lineTo(hole[i][u], hole[i][v])
      shape.holes.push(hp)
    }
  }

  const geo = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false })

  const pos = geo.attributes.position as THREE.BufferAttribute
  const sign = n[drop] > 0 ? 1 : -1
  for (let i = 0; i < pos.count; i++) {
    const lu = pos.getX(i)
    const lv = pos.getY(i)
    const lw = pos.getZ(i)
    const coords = [0, 0, 0]
    coords[u] = lu
    coords[v] = lv
    coords[drop] = base + sign * lw
    pos.setXYZ(i, coords[0], coords[1], coords[2])
  }
  pos.needsUpdate = true
  geo.computeVertexNormals()

  const mat = new THREE.MeshPhongMaterial({
    color: new THREE.Color(col),
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
  })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.renderOrder = 1

  const eg = new THREE.EdgesGeometry(geo, 15)
  const em = new THREE.LineBasicMaterial({ color: new THREE.Color(ec), transparent: true, opacity: 0.65, depthWrite: false })
  const lines = new THREE.LineSegments(eg, em)
  lines.renderOrder = 2
  mesh.add(lines)

  return mesh
}

// ── 3D contour generators ───────────────────────────────────────────────────
function sidePts3D(x0: number): number[][] {
  const pts: number[][] = []
  const a = (y: number, z: number) => pts.push([x0, y, z])
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

function horizPts3D(z0: number, depth?: number, yOff = 0): number[][] {
  const pts: number[][] = []
  const a = (x: number, y: number) => pts.push([x, y + yOff, z0])
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

function backPts3D(y0: number): number[][] {
  const pts: number[][] = []
  const a = (x: number, z: number) => pts.push([x, y0, z])
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

function shelfPts3D(z0: number, depth?: number, yOff = 0): number[][] {
  const pts: number[][] = []
  const a = (x: number, y: number) => pts.push([x, y + yOff, z0])
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

function sideHoles3D(x0: number): number[][][] {
  const holes: number[][][] = []
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

function backHoles3D(y0: number): number[][][] {
  const holes: number[][][] = []
  const tf = TF.value, th = TabH.value, t = T.value
  for (const sz of shelfSlotYs())
    for (const tx of tabPositions(Wi.value))
      holes.push([
        [t + tx, y0, sz], [t + tx + th, y0, sz],
        [t + tx + th, y0, sz + tf], [t + tx, y0, sz + tf],
      ])
  return holes
}

function initThree() {
  const c = document.getElementById('box3d-container')
  if (!c) return
  const w = c.clientWidth || 600
  const h = c.clientHeight || 450

  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x1e1e2e)

  camera = new THREE.PerspectiveCamera(38, w / h, 1, 20000)
  camera.up.set(0, 0, 1)
  camera.position.set(700, -550, 500)

  renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setSize(w, h)
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  c.appendChild(renderer.domElement)

  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.12
  controls.zoomSpeed = 0.2
  controls.target.set(150, 100, 150)
  controls.update()

  scene.add(new THREE.AmbientLight(0xffffff, 0.5))
  const d1 = new THREE.DirectionalLight(0xffffff, 0.8)
  d1.position.set(400, -500, 600)
  scene.add(d1)
  const d2 = new THREE.DirectionalLight(0xffffff, 0.3)
  d2.position.set(-300, 400, -200)
  scene.add(d2)

  panelGroup = new THREE.Group()
  guidesGroup = new THREE.Group()
  labelsGroup = new THREE.Group()
  scene.add(panelGroup)
  scene.add(guidesGroup)
  scene.add(labelsGroup)

  const cam = camera
  const ctrl = controls
  const rend = renderer
  const sc = scene
  const lg = labelsGroup

  isoExplodeCurrent = isoExplode.value
  ;(function loop() {
    animFrameId = requestAnimationFrame(loop)
    const target = isoExplode.value
    if (Math.abs(isoExplodeCurrent - target) > 0.0005) {
      isoExplodeCurrent += (target - isoExplodeCurrent) * 0.18
      if (Math.abs(isoExplodeCurrent - target) < 0.0005) isoExplodeCurrent = target
      updateScene(false)
    }
    ctrl.update()
    lg.children.forEach(s => s.quaternion.copy(cam.quaternion))
    rend.render(sc, cam)
  })()

  resizeObs = new ResizeObserver(() => {
    const rw = c.clientWidth
    const rh = c.clientHeight
    if (rw > 0 && rh > 0) {
      cam.aspect = rw / rh
      cam.updateProjectionMatrix()
      rend.setSize(rw, rh)
    }
  })
  resizeObs.observe(c)
}

function updateScene(resetTarget = true) {
  if (!panelGroup || !guidesGroup || !labelsGroup || !controls) return
  clearGroup(panelGroup)
  clearGroup(guidesGroup)
  clearGroup(labelsGroup)

  const w = W.value, h = H.value, d = D.value, thick = T.value
  const explode = Math.max(isoExplodeCurrent, 0.001)
  const ex = w * explode, ey = d * explode, ez = h * explode

  // Panels
  const lh = sideHoles3D(-ex)
  const rh = sideHoles3D(w + ex)
  const bh = backHoles3D(d + ey)
  const sel = galPieces.value[galIdx.value]?.id ?? null
  type TaggedPanel = PanelData & { gid: string }
  const panels: TaggedPanel[] = [
    { c: sidePts3D(-ex), n: [1, 0, 0], t: thick, col: '#2980b9', ec: '#1a5276', h: lh.length > 0 ? lh : undefined, gid: 'side' },
    { c: sidePts3D(w + ex), n: [-1, 0, 0], t: thick, col: '#2980b9', ec: '#1a5276', h: rh.length > 0 ? rh : undefined, gid: 'side' },
    { c: horizPts3D(h + ez, TopD.value, Math.max(Bevel.value, 0)), n: [0, 0, -1], t: thick, col: '#27ae60', ec: '#1e8449', gid: 'top' },
    { c: horizPts3D(-ez, BotD.value, Math.max(-Bevel.value, 0)), n: [0, 0, 1], t: thick, col: Bevel.value !== 0 ? '#1abc9c' : '#27ae60', ec: Bevel.value !== 0 ? '#27ae60' : '#1e8449', gid: 'bot' },
    { c: backPts3D(d + ey), n: [0, -1, 0], t: thick, col: '#8e44ad', ec: '#5b2c6f', h: bh.length > 0 ? bh : undefined, gid: 'back' },
  ]
  const clipTop = Math.max(Bevel.value, 0)
  const clipBot = Math.max(-Bevel.value, 0)
  const shSlots = shelfSlotYs()
  for (let si = 0; si < shSlots.length; si++) {
    const frac = shSlots[si] / h
    const shelfYOff = clipBot + (clipTop - clipBot) * frac
    const shelfDepth = d - shelfYOff
    const sc = Bevel.value !== 0 ? shelfColor(si) : '#e67e22'
    const sec = Bevel.value !== 0 ? shelfEdgeColor(si) : '#ca6f1e'
    panels.push({ c: shelfPts3D(shSlots[si], shelfDepth, shelfYOff), n: [0, 0, 1], t: thick, col: sc, ec: sec, gid: `shelf${si}` })
  }

  for (const p of panels) {
    const mesh = buildPanel(p)
    if (!mesh) continue
    const match = sel === 'tb' ? (p.gid === 'top' || p.gid === 'bot') : sel === 'shelf' ? p.gid.startsWith('shelf') : p.gid === sel
    if (sel && !match) {
      mesh.traverse(child => {
        if ('material' in child) {
          const mat = (child as THREE.Mesh).material as THREE.Material
          if (mat) { mat.transparent = true; mat.opacity = 0.15 }
        }
      })
    }
    panelGroup.add(mesh)
  }

  // Guide lines
  const gMat = new THREE.LineDashedMaterial({
    color: 0xaaaaaa, dashSize: 4, gapSize: 4, transparent: true, opacity: 0.5,
  })
  const addGuide = (x1: number, y1: number, z1: number, x2: number, y2: number, z2: number) => {
    const gGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(x1, y1, z1), new THREE.Vector3(x2, y2, z2),
    ])
    const line = new THREE.LineSegments(gGeo, gMat)
    line.computeLineDistances()
    guidesGroup!.add(line)
  }

  // Top/bottom guides
  for (const [gx, gy] of [[0, 0], [w, 0], [w, d], [0, d]]) {
    addGuide(gx, gy, -ez, gx, gy, 0)
    addGuide(gx, gy, h + ez, gx, gy, h)
  }
  // Side guides
  for (const [gy, gz] of [[0, 0], [d, 0], [d, h], [0, h]]) {
    addGuide(-ex, gy, gz, 0, gy, gz)
    addGuide(w + ex, gy, gz, w, gy, gz)
  }
  // Back guides
  for (const [gx, gz] of [[0, 0], [w, 0], [w, h], [0, h]])
    addGuide(gx, d + ey, gz, gx, d, gz)

  // Labels
  const sz = (lw: number, lh: number) => `${lw.toFixed(0)}\u00D7${lh.toFixed(0)}`
  const addLabel = (text: string, color: string, sub: string, x: number, y: number, z: number) => {
    const sprite = makeLabel(text, color, sub)
    sprite.position.set(x, y, z)
    labelsGroup!.add(sprite)
  }

  addLabel(t('box.top_short'), '#a0e0a0', sz(w, d), w / 2, d / 2, h + ez)
  addLabel(t('box.bottom_short'), '#a0e0a0', sz(w, d), w / 2, d / 2, -ez)
  const bv = Bevel.value
  addLabel(t('box.side_short'), '#80c0e0', sz(d + bv, h), -ex, d / 2, h / 2)
  addLabel(t('box.side_short'), '#80c0e0', sz(d + bv, h), w + ex, d / 2, h / 2)
  addLabel(t('box.back_short'), '#c0a0d0', sz(w, h), w / 2, d + ey, h / 2)

  const shYs = shelfSlotYs()
  for (let i = 0; i < shYs.length; i++)
    addLabel(`${t('box.shelf_short')}${i + 1}`, '#e0c080', sz(w, d), w / 2, d / 2, shYs[i])

  if (resetTarget) {
    controls.target.set(w / 2, d / 2, h / 2)
  }
  controls.update()
}

function disposeThree() {
  if (animFrameId) cancelAnimationFrame(animFrameId)
  if (resizeObs) resizeObs.disconnect()
  if (renderer) {
    renderer.dispose()
    renderer.domElement?.remove()
  }
  scene = camera = renderer = controls = null
  panelGroup = guidesGroup = labelsGroup = null
  resizeObs = null
}

// ── Piece 3D (isolated view) ────────────────────────────────────────────────
let pScene: THREE.Scene | null = null
let pCamera: THREE.PerspectiveCamera | null = null
let pRenderer: THREE.WebGLRenderer | null = null
let pControls: TrackballControls | null = null
let pGroup: THREE.Group | null = null
let pResizeObs: ResizeObserver | null = null
let pAnimId = 0

function initPieceThree() {
  const c = document.getElementById('piece3d-container')
  if (!c) return
  const w = c.clientWidth || 400
  const h = c.clientHeight || 300

  pScene = new THREE.Scene()
  pScene.background = new THREE.Color(0x1e1e2e)

  pCamera = new THREE.PerspectiveCamera(38, w / h, 1, 20000)
  pCamera.up.set(0, 0, 1)
  pCamera.position.set(400, -300, 250)

  pRenderer = new THREE.WebGLRenderer({ antialias: true })
  pRenderer.setSize(w, h)
  pRenderer.setPixelRatio(Math.min(devicePixelRatio, 2))
  c.appendChild(pRenderer.domElement)

  pControls = new TrackballControls(pCamera, pRenderer.domElement)
  pControls.rotateSpeed = 3
  pControls.zoomSpeed = 1.2
  pControls.panSpeed = 0.8
  pControls.dynamicDampingFactor = 0.12
  pControls.staticMoving = false
  pControls.noZoom = true
  pControls.noPan = true
  const raycaster = new THREE.Raycaster()
  const mouse = new THREE.Vector2()
  let hitPiece = false
  pRenderer.domElement.addEventListener('pointerdown', (e) => {
    if (!pCamera || !pGroup) return
    const rect = pRenderer!.domElement.getBoundingClientRect()
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
    raycaster.setFromCamera(mouse, pCamera)
    hitPiece = raycaster.intersectObjects(pGroup.children, true).length > 0
    pControls!.noRotate = !hitPiece
  }, true)
  window.addEventListener('pointerup', () => {
    hitPiece = false
    if (pControls) pControls.noRotate = true
  })

  pScene.add(new THREE.AmbientLight(0xffffff, 0.5))
  const d1 = new THREE.DirectionalLight(0xffffff, 0.8)
  d1.position.set(400, -500, 600)
  pScene.add(d1)
  const d2 = new THREE.DirectionalLight(0xffffff, 0.3)
  d2.position.set(-300, 400, -200)
  pScene.add(d2)

  pGroup = new THREE.Group()
  pScene.add(pGroup)

  const cam = pCamera, ctrl = pControls, rend = pRenderer, sc = pScene
  ;(function loop() {
    pAnimId = requestAnimationFrame(loop)
    if (pRing.active && pGroup) {
      pRing.t += 0.04
      if (pRing.t >= 1) {
        pRing.active = false
        pRing.t = 1
      }
      const e = 1 - Math.pow(1 - pRing.t, 3)
      const curAngle = pRing.from + (pRing.to - pRing.from) * e
      positionRing(curAngle)
      // smoothly reset camera to initial view
      const p0 = (ctrl as any)._position0 as THREE.Vector3
      const t0 = (ctrl as any)._target0 as THREE.Vector3
      const u0 = (ctrl as any)._up0 as THREE.Vector3
      cam.position.lerpVectors(pRing.camPos, p0, e)
      ctrl.target.lerpVectors(pRing.camTarget, t0, e)
      cam.up.lerpVectors(pRing.camUp, u0, e).normalize()
    }
    // set opacity: active piece = 1, others = 0.3
    if (pGroup) {
      const activeIdx = galIdx.value
      pGroup.children.forEach((sub, i) => {
        const isActive = i === activeIdx
        sub.traverse(child => {
          if ('material' in child) {
            const mat = (child as THREE.Mesh).material as THREE.Material
            if (mat) {
              mat.transparent = !isActive
              mat.opacity = isActive ? 1 : 0.3
              mat.depthWrite = isActive
            }
          }
        })
      })
    }
    if (pCamReset.active) {
      pCamReset.t += 0.04
      if (pCamReset.t >= 1) {
        pCamReset.active = false
        pCamReset.t = 1
      }
      const e = 1 - Math.pow(1 - pCamReset.t, 3)
      const p0 = (ctrl as any)._position0 as THREE.Vector3
      const t0 = (ctrl as any)._target0 as THREE.Vector3
      const u0 = (ctrl as any)._up0 as THREE.Vector3
      cam.position.lerpVectors(pCamReset.camPos, p0, e)
      ctrl.target.lerpVectors(pCamReset.camTarget, t0, e)
      cam.up.lerpVectors(pCamReset.camUp, u0, e).normalize()
    }
    ctrl.update()
    rend.render(sc, cam)
  })()

  pResizeObs = new ResizeObserver(() => {
    const rw = c.clientWidth, rh = c.clientHeight
    if (rw > 0 && rh > 0) {
      cam.aspect = rw / rh
      cam.updateProjectionMatrix()
      rend.setSize(rw, rh)
    }
  })
  pResizeObs.observe(c)
}

const RING_RADIUS = 1000
const pRing = { active: false, t: 1, from: 0, to: 0,
  camPos: new THREE.Vector3(), camTarget: new THREE.Vector3(), camUp: new THREE.Vector3() }
const pCamReset = { active: false, t: 1,
  camPos: new THREE.Vector3(), camTarget: new THREE.Vector3(), camUp: new THREE.Vector3() }

function rebuildAllPieces() {
  if (!pGroup) return
  clearGroup(pGroup)

  const thick = T.value
  const pieces = galPieces.value

  for (let i = 0; i < pieces.length; i++) {
    const gp = pieces[i]
    const inner = new THREE.Group()

    const panels: PanelData[] = []
    if (gp.id === 'side') {
      panels.push({ c: sidePts3D(0), n: [1, 0, 0], t: thick, col: '#2980b9', ec: '#1a5276', h: sideHoles3D(0).length > 0 ? sideHoles3D(0) : undefined })
    } else if (gp.id === 'tb') {
      panels.push({ c: horizPts3D(0), n: [0, 0, 1], t: thick, col: '#27ae60', ec: '#1e8449' })
    } else if (gp.id === 'top') {
      panels.push({ c: horizPts3D(0, TopD.value, Math.max(Bevel.value, 0)), n: [0, 0, 1], t: thick, col: '#27ae60', ec: '#1e8449' })
    } else if (gp.id === 'bot') {
      panels.push({ c: horizPts3D(0, BotD.value, Math.max(-Bevel.value, 0)), n: [0, 0, 1], t: thick, col: '#1abc9c', ec: '#148f77' })
    } else if (gp.id === 'back') {
      panels.push({ c: backPts3D(0), n: [0, -1, 0], t: thick, col: '#8e44ad', ec: '#5b2c6f', h: backHoles3D(0).length > 0 ? backHoles3D(0) : undefined })
    } else if (gp.id.startsWith('shelf')) {
      const si = parseInt(gp.id.replace('shelf', '')) || 0
      const sys = shelfSlotYs()
      const sy = si < sys.length ? sys[si] : 0
      const sd = shelfDepthAt(sy)
      const sOff = shelfOffsetAt(sy)
      const sc = Bevel.value !== 0 ? shelfColor(si) : '#e67e22'
      const sec = Bevel.value !== 0 ? shelfEdgeColor(si) : '#ca6f1e'
      panels.push({ c: shelfPts3D(0, sd, sOff), n: [0, 0, 1], t: thick, col: sc, ec: sec })
    }

    for (const p of panels) {
      const mesh = buildPanel(p)
      if (mesh) inner.add(mesh)
    }

    // rotate inner so panel faces -Y (camera direction)
    const norm = panels[0]?.n ?? [0, -1, 0]
    if (Math.abs(norm[0]) > 0.5) {
      inner.rotation.set(0, 0, -Math.sign(norm[0]) * Math.PI / 2)
    } else if (Math.abs(norm[2]) > 0.5) {
      inner.rotation.set(Math.sign(norm[2]) * Math.PI / 2, 0, 0)
    }

    // center at origin and scale to fit uniform size
    const sub = new THREE.Group()
    sub.add(inner)
    let box = new THREE.Box3().setFromObject(sub)
    let center = box.getCenter(new THREE.Vector3())
    inner.position.sub(center)

    let sz = box.getSize(new THREE.Vector3())
    const fitSize = 300
    const aspect = pCamera!.aspect
    const fovRad = pCamera!.fov * Math.PI / 180

    // check if 90° Y rotation fits viewport better
    const distNorm = Math.max((sz.z / 2) / Math.tan(fovRad / 2), (sz.x / 2) / (Math.tan(fovRad / 2) * aspect))
    const distRot = Math.max((sz.x / 2) / Math.tan(fovRad / 2), (sz.z / 2) / (Math.tan(fovRad / 2) * aspect))
    if (distRot < distNorm) {
      inner.rotation.y += Math.PI / 2
      box = new THREE.Box3().setFromObject(sub)
      center = box.getCenter(new THREE.Vector3())
      inner.position.sub(center)
      sz = box.getSize(new THREE.Vector3())
    }

    const scale = fitSize / Math.max(sz.x, sz.z, 1)
    sub.scale.setScalar(scale)

    const angle = (i / pieces.length) * Math.PI * 2
    sub.userData.angle = angle
    pGroup.add(sub)
  }
}

function ringLift(a: number): number { return (1 - Math.cos(a)) * 30 }

function positionRing(angle: number) {
  if (!pGroup) return
  pGroup.userData.ringAngle = angle
  const activeIdx = galIdx.value
  pGroup.children.forEach((sub, i) => {
    const sa = (sub.userData.angle || 0) + angle
    sub.position.set(Math.sin(sa) * RING_RADIUS, -Math.cos(sa) * RING_RADIUS, ringLift(sa))
    // active piece faces camera, others angled along ring
    sub.rotation.z = i === activeIdx ? 0 : sa
  })
}

function setupPieceCam() {
  if (!pCamera || !pControls) return
  const fitSize = 300
  const aspect = pCamera.aspect
  const fovRad = pCamera.fov * Math.PI / 180
  const distH = (fitSize / 2) / Math.tan(fovRad / 2)
  const distW = (fitSize / 2) / (Math.tan(fovRad / 2) * aspect)
  const dist = Math.max(distH, distW) * 1.02
  pCamera.up.set(0, 0, 1)
  pCamera.position.set(0, -(RING_RADIUS + dist), 0)
  pControls.target.set(0, -RING_RADIUS, 0)
  ;(pControls as any)._target0.set(0, -RING_RADIUS, 0)
  ;(pControls as any)._position0.copy(pCamera.position)
  ;(pControls as any)._up0.set(0, 0, 1)
  pControls.reset()
}

function pieceAngle(idx: number): number {
  return -(idx / galPieces.value.length) * Math.PI * 2
}

function updatePieceScene(animate = false) {
  if (!pGroup || !pControls || !pCamera) return

  if (!animate) {
    rebuildAllPieces()
    positionRing(pieceAngle(galIdx.value))
    setupPieceCam()
  } else {
    const target = pieceAngle(galIdx.value)
    let from = pGroup.userData.ringAngle ?? 0
    let delta = target - from
    while (delta > Math.PI) delta -= Math.PI * 2
    while (delta < -Math.PI) delta += Math.PI * 2
    pRing.from = from
    pRing.to = from + delta
    pRing.camPos.copy(pCamera!.position)
    pRing.camTarget.copy(pControls!.target)
    pRing.camUp.copy(pCamera!.up)
    pRing.active = true
    pRing.t = 0
  }
}

function disposePieceThree() {
  if (pAnimId) cancelAnimationFrame(pAnimId)
  if (pResizeObs) pResizeObs.disconnect()
  if (pRenderer) {
    pRenderer.dispose()
    pRenderer.domElement?.remove()
  }
  pScene = pCamera = pRenderer = pControls = null
  pGroup = null
  pResizeObs = null
}

// ── Gallery ────────────────────────────────────────────────────────────────
const galIdx = ref(0)

const galPieces = computed(() => {
  const bv = Bevel.value
  const list: { id: string; title: string; count: number; pw: number; ph: number; path: () => string; color: string; xOff: number }[] = [
    { id: 'side', title: `${t('box.side_wall')}`, count: 2, pw: SideOW.value, ph: H.value, path: pathSide, color: 'var(--accent)', xOff: SideOff.value },
  ]
  if (bv === 0) {
    list.push({ id: 'tb', title: `${t('box.top_bottom_wall')}`, count: 2, pw: W.value, ph: D.value, path: () => pathTopBottom(), color: '#27ae60', xOff: 0 })
  } else {
    const topOff = Math.max(bv, 0), botOff = Math.max(-bv, 0)
    list.push({ id: 'top', title: `${t('box.top_short')}`, count: 1, pw: W.value, ph: TopD.value, path: () => pathTopBottom(TopD.value, topOff), color: '#27ae60', xOff: 0 })
    list.push({ id: 'bot', title: `${t('box.bottom_short')}`, count: 1, pw: W.value, ph: BotD.value, path: () => pathTopBottom(BotD.value, botOff), color: '#1abc9c', xOff: 0 })
  }
  list.push({ id: 'back', title: `${t('box.back_wall')}`, count: 1, pw: W.value, ph: H.value, path: pathBack, color: '#8e44ad', xOff: 0 })
  const sys = shelfSlotYs()
  if (bv === 0 && sys.length > 0) {
    list.push({ id: 'shelf', title: `${t('box.shelf')}`, count: sys.length, pw: W.value, ph: D.value, path: () => pathShelf(), color: '#e67e22', xOff: 0 })
  } else {
    for (let i = 0; i < sys.length; i++) {
      const sd = shelfDepthAt(sys[i])
      const sOff = shelfOffsetAt(sys[i])
      list.push({ id: `shelf${i}`, title: `${t('box.shelf_short')}${i + 1}`, count: 1, pw: W.value, ph: sd, path: () => pathShelf(sd, sOff), color: shelfColor(i), xOff: 0 })
    }
  }
  return list
})

function galResetView() {
  pCamReset.camPos.copy(pCamera!.position)
  pCamReset.camTarget.copy(pControls!.target)
  pCamReset.camUp.copy(pCamera!.up)
  pCamReset.active = true
  pCamReset.t = 0
}

function galDlSvg() {
  const p = galPieces.value[galIdx.value]
  dlPiece(`${p.id}.svg`, p.path(), p.pw, p.ph, p.xOff)
}

// ── Lifecycle ───────────────────────────────────────────────────────────────
onMounted(() => {
  initThree()
  updateScene()
  initPieceThree()
  updatePieceScene()
})

onUnmounted(() => {
  disposeThree()
  disposePieceThree()
})

watch(
  [W, H, D, T, Kerf, TabH, NTab, NShelves, Bevel],
  () => { updateScene(); updatePieceScene() },
  { flush: 'post' },
)

watch(galIdx, () => { updateScene(); updatePieceScene(true) }, { flush: 'post' })

// ── Download helpers ────────────────────────────────────────────────────────
function downloadSvg(name: string, content: string) {
  const blob = new Blob([content], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

function wrapCutSvg(pathData: string, pw: number, ph: number, xOff = 0): string {
  return `<?xml version="1.0" encoding="utf-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="${pw.toFixed(2)}mm" height="${ph.toFixed(2)}mm" viewBox="${(-xOff).toFixed(2)} 0 ${pw.toFixed(2)} ${ph.toFixed(2)}">\n` +
    `  <path d="${pathData}" fill="none" stroke="#ff0000" stroke-width="0.01" stroke-linejoin="miter"/>\n` +
    `</svg>`
}

function dlPiece(name: string, path: string, pw: number, ph: number, xOff = 0) {
  downloadSvg(name, wrapCutSvg(path, pw, ph, xOff))
}

function getCutSheetTransform(p: LayoutPiece): string {
  const pd = pieceData(p.label)
  const rotated = Math.abs(p.w - pd.oh) < 1 && Math.abs(p.h - pd.ow) < 1
  const bvOff = pd.xOff
  return rotated
    ? `translate(${(p.x + bvOff).toFixed(2)},${(p.y + pd.ow).toFixed(2)}) rotate(90)`
    : `translate(${(p.x + bvOff).toFixed(2)},${p.y.toFixed(2)})`
}

function getCutSheetPath(p: LayoutPiece): string {
  return pieceData(p.label).path
}
</script>

<template>
  <div class="app-container">
    <header class="app-header">
      <h1>{{ t('box.title') }}</h1>
      <p class="subtitle">{{ t('box.subtitle') }}</p>
    </header>

    <div class="main-layout">
      <aside class="panel panel-input">
        <section class="card">
          <h2>{{ t('sheet_params') }}</h2>
          <div class="form-row"><label>{{ t('box.outer_width') }}</label><NumberField v-model="W" :min="50" :step="10" /></div>
          <div class="form-row"><label>{{ t('box.height') }}</label><NumberField v-model="H" :min="50" :step="10" /></div>
          <div class="form-row"><label>{{ t('box.depth') }}</label><NumberField v-model="D" :min="50" :step="10" /></div>
          <div class="form-row"><label>{{ t('box.bevel') }}</label><NumberField v-model="Bevel" :step="5" /></div>
        </section>
        <section class="card">
          <h2>{{ t('box.material') }}</h2>
          <div class="form-row"><label>{{ t('box.thickness') }}</label><NumberField v-model="T" :min="1" :step="0.5" /></div>
          <div class="form-row"><label>{{ t('box.kerf') }}</label><NumberField v-model="Kerf" :min="0" :step="0.05" /></div>
          <div class="form-row"><label>{{ t('box.tab_size') }}</label><NumberField v-model="TabH" :min="10" :step="5" /></div>
          <div class="form-row"><label>{{ t('box.tabs_per_edge') }}</label><NumberField v-model="NTab" :min="1" :step="1" /></div>
          <div class="form-row"><label>{{ t('box.shelves') }}</label><NumberField v-model="NShelves" :min="0" :step="1" /></div>
        </section>
        <section class="card shelf-summary">
          <h2>{{ t('box.parts') }}</h2>
          <div class="shelf-part-row"><span>{{ t('box.sides') }}</span><span>2 &times; {{ SideOW.toFixed(0) }}&times;{{ H.toFixed(0) }} mm</span></div>
          <div v-if="Bevel === 0" class="shelf-part-row"><span>{{ t('box.top_bottom') }}</span><span>2 &times; {{ W.toFixed(0) }}&times;{{ D.toFixed(0) }} mm</span></div>
          <div v-else class="shelf-part-row"><span>{{ t('box.top_short') }}</span><span>1 &times; {{ W.toFixed(0) }}&times;{{ TopD.toFixed(0) }} mm</span></div>
          <div v-if="Bevel !== 0" class="shelf-part-row"><span>{{ t('box.bottom_short') }}</span><span>1 &times; {{ W.toFixed(0) }}&times;{{ BotD.toFixed(0) }} mm</span></div>
          <div class="shelf-part-row"><span>{{ t('box.back') }}</span><span>1 &times; {{ W.toFixed(0) }}&times;{{ H.toFixed(0) }} mm</span></div>
          <template v-if="NShelves > 0 && Bevel === 0">
            <div class="shelf-part-row"><span>{{ t('box.shelf') }}</span><span>{{ NShelves }} &times; {{ W.toFixed(0) }}&times;{{ D.toFixed(0) }} mm</span></div>
          </template>
          <template v-else-if="NShelves > 0">
            <div v-for="(sy, i) in shelfSlotYs()" :key="i" class="shelf-part-row"><span>{{ t('box.shelf_short') }}{{ i + 1 }}</span><span>1 &times; {{ W.toFixed(0) }}&times;{{ shelfDepthAt(sy).toFixed(0) }} mm</span></div>
          </template>
          <div class="shelf-part-row shelf-total"><span>{{ t('box.total') }}</span><span>{{ 5 + NShelves }} {{ t('box.pcs') }}</span></div>
        </section>
        <section class="card">
          <h2>{{ t('box.sheet_title') }}</h2>
          <div class="form-row"><label>{{ t('box.sheet_width') }}</label><NumberField v-model="SheetW" :min="300" :step="10" /></div>
          <div class="form-row"><label>{{ t('box.sheet_height') }}</label><NumberField v-model="SheetH" :min="300" :step="10" /></div>
          <div class="form-row"><label>{{ t('box.gap') }}</label><NumberField v-model="CutGap" :min="1" :step="1" /></div>
        </section>
        <section class="card">
          <h2>{{ t('box.assembly') }}</h2>
          <p style="font-size:0.82rem;color:var(--muted);line-height:1.5">
            {{ t('box.inner') }}
            <strong>{{ Wi.toFixed(0) }}&times;{{ Hi.toFixed(0) }}&times;{{ (D - T).toFixed(0) }} mm</strong>
          </p>
        </section>
      </aside>

      <main class="panel panel-result">
        <!-- Pieces gallery + 3D -->
        <section class="card gallery">
          <div class="piece3d-wrap">
            <button class="piece3d-nav piece3d-prev" @click="galIdx = (galIdx - 1 + galPieces.length) % galPieces.length">&lsaquo;</button>
            <div id="piece3d-container" style="width:100%;height:350px;border-radius:8px;overflow:hidden;"></div>
            <button class="piece3d-nav piece3d-next" @click="galIdx = (galIdx + 1) % galPieces.length">&rsaquo;</button>
            <button class="piece3d-nav piece3d-reset" @click="galResetView" title="Reset view">&#x21ba;</button>
          </div>
          <div class="gallery-3d-bar">
            <span class="gallery-sel-title">{{ galPieces[galIdx].title }} <small>({{ galPieces[galIdx].count }} {{ t('box.pcs') }}, {{ galPieces[galIdx].pw.toFixed(0) }}&times;{{ galPieces[galIdx].ph.toFixed(0) }} mm)</small></span>
            <button class="btn-dl" @click="galDlSvg">&#x2193; SVG</button>
          </div>
          <div class="gallery-thumbs">
            <div
              v-for="(p, i) in galPieces" :key="p.id"
              :class="['gallery-thumb', i === galIdx && 'active']"
              @click="galIdx = i"
            >
              <svg
                :width="p.pw * svgScale(p.pw, p.ph) * 0.22 + 6"
                :height="p.ph * svgScale(p.pw, p.ph) * 0.22 + 6"
                :viewBox="`-3 -3 ${p.pw * svgScale(p.pw, p.ph) * 0.22 + 6} ${p.ph * svgScale(p.pw, p.ph) * 0.22 + 6}`"
              >
                <g :transform="`translate(${(p.xOff * svgScale(p.pw, p.ph) * 0.22).toFixed(4)}, 0) scale(${(svgScale(p.pw, p.ph) * 0.22).toFixed(4)})`">
                  <path :d="p.path()" :fill="p.color" fill-opacity="0.4" fill-rule="evenodd" stroke="var(--laser-cut)" :stroke-width="(2 / (svgScale(p.pw, p.ph) * 0.22)).toFixed(1)" stroke-linejoin="miter" />
                </g>
              </svg>
              <span class="gallery-thumb-label">{{ p.title }}</span>
              <span class="gallery-thumb-info">{{ p.count }} {{ t('box.pcs') }}</span>
            </div>
          </div>
        </section>

        <!-- 3D Assembly -->
        <section class="card">
          <h2>{{ t('box.assembly_3d') }}</h2>
          <div class="iso-controls">
            <label>{{ t('box.explode') }}</label>
            <input type="range" min="0" max="0.5" step="0.01" v-model.number="isoExplode" style="flex:1" />
          </div>
          <div id="box3d-container" style="width:100%;height:450px;border-radius:8px;overflow:hidden;"></div>
        </section>

        <!-- Cutting layout -->
        <section class="card">
          <h2>{{ t('box.cutting_layout') }}</h2>

          <div v-if="tooBigPieces.length > 0" class="cut-warning">
            {{ t('box.too_big') }} ({{ SheetW.toFixed(0) }}&times;{{ SheetH.toFixed(0) }} mm):
            {{ tooBigPieces.map(p => `${p.label} (${p.w.toFixed(0)}\u00D7${p.h.toFixed(0)})`).join(', ') }}
          </div>

          <div class="cut-stats">
            {{ t('box.stats')
              .replace('{0}', String(cutStats.sheets))
              .replace('{1}', cutStats.pieceArea)
              .replace('{2}', cutStats.sheetArea)
              .replace('{3}', cutStats.util) }}
          </div>

          <div class="cut-sheets-wrap">
            <div v-for="(sheetPieces, sheetIdx) in cuttingSheets" :key="sheetIdx" class="cut-sheet">
              <div class="cut-sheet-title">
                {{ t('box.sheet_label') }} {{ sheetIdx + 1 }} &mdash; {{ SheetW.toFixed(0) }}&times;{{ SheetH.toFixed(0) }} mm
              </div>
              <svg
                :width="(SheetW * cutScale).toFixed(0)"
                :height="(SheetH * cutScale).toFixed(0)"
                :viewBox="`0 0 ${SheetW.toFixed(1)} ${SheetH.toFixed(1)}`"
                style="display:block;"
              >
                <rect x="0" y="0" :width="SheetW.toFixed(1)" :height="SheetH.toFixed(1)" fill="var(--laser-sheet-bg)" stroke="var(--laser-sheet-border)" :stroke-width="(1 / cutScale).toFixed(2)" />
                <template v-for="(p, pi) in sheetPieces" :key="pi">
                  <g :transform="getCutSheetTransform(p)">
                    <path :d="getCutSheetPath(p)" :fill="p.color" fill-opacity="0.28" fill-rule="evenodd" stroke="var(--laser-cut)" :stroke-width="(0.8 / cutScale).toFixed(2)" stroke-linejoin="miter" />
                  </g>
                  <text :x="(p.x + p.w / 2).toFixed(1)" :y="(p.y + p.h / 2).toFixed(1)" text-anchor="middle" dominant-baseline="middle" :font-size="(9 / cutScale).toFixed(1)" fill="var(--muted)">
                    {{ p.label }} {{ p.w.toFixed(0) }}&times;{{ p.h.toFixed(0) }}
                  </text>
                </template>
              </svg>
            </div>
          </div>
        </section>
      </main>
    </div>
  </div>
</template>
