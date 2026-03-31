<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import NumberField from '@/components/NumberField.vue'
import { useL10n } from '@/stores/l10n'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

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

const SheetW = ref(1220)
const SheetH = ref(2440)
const CutGap = ref(5)

const isoExplode = ref(0.22)

// ── Computed ────────────────────────────────────────────────────────────────
const TF = computed(() => T.value + Kerf.value)
const Wi = computed(() => W.value - 2 * T.value)
const Hi = computed(() => H.value - 2 * T.value)

// ── Tab positions ───────────────────────────────────────────────────────────
function tabPositions(L: number): number[] {
  const n = NTab.value
  const th = TabH.value
  const gap = (L - n * th) / (n + 1)
  const pos: number[] = []
  for (let i = 0; i < n; i++) pos.push(gap + i * (gap + th))
  return pos
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

// ── SVG path builders ───────────────────────────────────────────────────────
function f(v: number): string { return v.toFixed(2) }

function pathSide(): string {
  const pw = D.value, ph = H.value, tf = TF.value, th = TabH.value
  let d = 'M0,0'
  for (const x of tabPositions(D.value))
    d += ` L${f(x)},0 L${f(x)},${f(tf)} L${f(x + th)},${f(tf)} L${f(x + th)},0`
  d += ` L${f(pw)},0`
  for (const y of tabPositions(H.value))
    d += ` L${f(pw)},${f(y)} L${f(pw - tf)},${f(y)} L${f(pw - tf)},${f(y + th)} L${f(pw)},${f(y + th)}`
  d += ` L${f(pw)},${f(ph)}`
  for (const x of [...tabPositions(D.value)].reverse())
    d += ` L${f(x + th)},${f(ph)} L${f(x + th)},${f(ph - tf)} L${f(x)},${f(ph - tf)} L${f(x)},${f(ph)}`
  d += ` L0,${f(ph)} Z`
  for (const sy of shelfSlotYs())
    for (const x of tabPositions(D.value))
      d += ` M${f(x)},${f(sy)} L${f(x + th)},${f(sy)} L${f(x + th)},${f(sy + tf)} L${f(x)},${f(sy + tf)} Z`
  return d
}

function pathTopBottom(): string {
  const pw = W.value, ph = D.value, tf = TF.value, th = TabH.value, t = T.value, wi = Wi.value
  let d = `M${f(t)},0 L${f(pw - t)},0`
  for (const y of tabPositions(D.value))
    d += ` L${f(pw - t)},${f(y)} L${f(pw)},${f(y)} L${f(pw)},${f(y + th)} L${f(pw - t)},${f(y + th)}`
  d += ` L${f(pw - t)},${f(ph)}`
  for (const x of [...tabPositions(wi)].reverse()) {
    const rx = t + x
    d += ` L${f(rx + th)},${f(ph)} L${f(rx + th)},${f(ph - tf)} L${f(rx)},${f(ph - tf)} L${f(rx)},${f(ph)}`
  }
  d += ` L${f(t)},${f(ph)}`
  for (const y of [...tabPositions(D.value)].reverse())
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

function pathShelf(): string {
  const pw = W.value, ph = D.value, tf = TF.value, th = TabH.value, t = T.value, wi = Wi.value
  let d = `M${f(t)},0 L${f(pw - t)},0`
  for (const y of tabPositions(D.value))
    d += ` L${f(pw - t)},${f(y)} L${f(pw)},${f(y)} L${f(pw)},${f(y + th)} L${f(pw - t)},${f(y + th)}`
  d += ` L${f(pw - t)},${f(ph - t)}`
  for (const x of [...tabPositions(wi)].reverse()) {
    const rx = t + x
    d += ` L${f(rx + th)},${f(ph - t)} L${f(rx + th)},${f(ph)} L${f(rx)},${f(ph)} L${f(rx)},${f(ph - t)}`
  }
  d += ` L${f(t)},${f(ph - t)}`
  for (const y of [...tabPositions(D.value)].reverse())
    d += ` L${f(t)},${f(y + th)} L0,${f(y + th)} L0,${f(y)} L${f(t)},${f(y)}`
  d += ` L${f(t)},0 Z`
  return d
}

// ── SVG rendering helpers ───────────────────────────────────────────────────
function svgScale(pw: number, ph: number): number {
  return Math.min(460 / (pw + 20), 320 / (ph + 20))
}

// ── Piece data lookup by label ──────────────────────────────────────────────
function pieceData(label: string): { ow: number; oh: number; path: string } {
  const side = t('box.side_short')
  const back = t('box.back_short')
  if (label.startsWith(side)) return { ow: D.value, oh: H.value, path: pathSide() }
  if (label === t('box.top_short') || label === t('box.bottom_short')) return { ow: W.value, oh: D.value, path: pathTopBottom() }
  if (label.startsWith(back)) return { ow: W.value, oh: H.value, path: pathBack() }
  return { ow: W.value, oh: D.value, path: pathShelf() }
}

// ── Cutting layout (shelf-based FFD with rotation) ──────────────────────────
interface PieceInfo { w: number; h: number; label: string; color: string }
interface LayoutPiece { x: number; y: number; w: number; h: number; label: string; color: string }

function allPieces(): PieceInfo[] {
  const side = t('box.side_short')
  const list: PieceInfo[] = [
    { w: D.value, h: H.value, label: `${side}1`, color: 'var(--accent)' },
    { w: D.value, h: H.value, label: `${side}2`, color: 'var(--accent)' },
    { w: W.value, h: D.value, label: t('box.top_short'), color: '#27ae60' },
    { w: W.value, h: D.value, label: t('box.bottom_short'), color: '#27ae60' },
    { w: W.value, h: H.value, label: t('box.back_short'), color: '#8e44ad' },
  ]
  for (let i = 1; i <= NShelves.value; i++)
    list.push({ w: W.value, h: D.value, label: `${t('box.shelf_short')}${i}`, color: '#e67e22' })
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
  a(0, 0)
  for (const ty of tabPositions(d)) { a(ty, 0); a(ty, tf); a(ty + th, tf); a(ty + th, 0) }
  a(d, 0)
  for (const tz of tabPositions(h)) { a(d, tz); a(d - tf, tz); a(d - tf, tz + th); a(d, tz + th) }
  a(d, h)
  for (const ty of [...tabPositions(d)].reverse()) { a(ty + th, h); a(ty + th, h - tf); a(ty, h - tf); a(ty, h) }
  a(0, h)
  return pts
}

function horizPts3D(z0: number): number[][] {
  const pts: number[][] = []
  const a = (x: number, y: number) => pts.push([x, y, z0])
  const w = W.value, d = D.value, tf = TF.value, th = TabH.value, t = T.value, wi = Wi.value
  a(t, 0); a(w - t, 0)
  for (const ty of tabPositions(d)) { a(w - t, ty); a(w, ty); a(w, ty + th); a(w - t, ty + th) }
  a(w - t, d)
  for (const tx of [...tabPositions(wi)].reverse()) {
    const rx = t + tx
    a(rx + th, d); a(rx + th, d - tf); a(rx, d - tf); a(rx, d)
  }
  a(t, d)
  for (const ty of [...tabPositions(d)].reverse()) { a(t, ty + th); a(0, ty + th); a(0, ty); a(t, ty) }
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

function shelfPts3D(z0: number): number[][] {
  const pts: number[][] = []
  const a = (x: number, y: number) => pts.push([x, y, z0])
  const w = W.value, d = D.value, tf = TF.value, th = TabH.value, t = T.value, wi = Wi.value
  a(t, 0); a(w - t, 0)
  for (const ty of tabPositions(d)) { a(w - t, ty); a(w, ty); a(w, ty + th); a(w - t, ty + th) }
  a(w - t, d - t)
  for (const tx of [...tabPositions(wi)].reverse()) {
    const rx = t + tx
    a(rx + th, d - t); a(rx + th, d); a(rx, d); a(rx, d - t)
  }
  a(t, d - t)
  for (const ty of [...tabPositions(d)].reverse()) { a(t, ty + th); a(0, ty + th); a(0, ty); a(t, ty) }
  return pts
}

function sideHoles3D(x0: number): number[][][] {
  const holes: number[][][] = []
  const tf = TF.value, th = TabH.value
  for (const sz of shelfSlotYs())
    for (const ty of tabPositions(D.value))
      holes.push([
        [x0, ty, sz], [x0, ty + th, sz],
        [x0, ty + th, sz + tf], [x0, ty, sz + tf],
      ])
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

  ;(function loop() {
    animFrameId = requestAnimationFrame(loop)
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

function updateScene() {
  if (!panelGroup || !guidesGroup || !labelsGroup || !controls) return
  clearGroup(panelGroup)
  clearGroup(guidesGroup)
  clearGroup(labelsGroup)

  const w = W.value, h = H.value, d = D.value, thick = T.value
  const explode = Math.max(isoExplode.value, 0.001)
  const ex = w * explode, ey = d * explode, ez = h * explode

  // Panels
  const lh = sideHoles3D(-ex)
  const rh = sideHoles3D(w + ex)
  const bh = backHoles3D(d + ey)
  const panels: PanelData[] = [
    { c: sidePts3D(-ex), n: [1, 0, 0], t: thick, col: '#2980b9', ec: '#1a5276', h: lh.length > 0 ? lh : undefined },
    { c: sidePts3D(w + ex), n: [-1, 0, 0], t: thick, col: '#2980b9', ec: '#1a5276', h: rh.length > 0 ? rh : undefined },
    { c: horizPts3D(h + ez), n: [0, 0, -1], t: thick, col: '#27ae60', ec: '#1e8449' },
    { c: horizPts3D(-ez), n: [0, 0, 1], t: thick, col: '#27ae60', ec: '#1e8449' },
    { c: backPts3D(d + ey), n: [0, -1, 0], t: thick, col: '#8e44ad', ec: '#5b2c6f', h: bh.length > 0 ? bh : undefined },
  ]
  for (const sz of shelfSlotYs())
    panels.push({ c: shelfPts3D(sz), n: [0, 0, 1], t: thick, col: '#e67e22', ec: '#ca6f1e' })

  for (const p of panels) {
    const mesh = buildPanel(p)
    if (mesh) panelGroup.add(mesh)
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
  addLabel(t('box.side_short'), '#80c0e0', sz(d, h), -ex, d / 2, h / 2)
  addLabel(t('box.side_short'), '#80c0e0', sz(d, h), w + ex, d / 2, h / 2)
  addLabel(t('box.back_short'), '#c0a0d0', sz(w, h), w / 2, d + ey, h / 2)

  const shYs = shelfSlotYs()
  for (let i = 0; i < shYs.length; i++)
    addLabel(`${t('box.shelf_short')}${i + 1}`, '#e0c080', sz(w, d), w / 2, d / 2, shYs[i])

  controls.target.set(w / 2, d / 2, h / 2)
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

// ── Lifecycle ───────────────────────────────────────────────────────────────
onMounted(() => {
  initThree()
  updateScene()
})

onUnmounted(() => {
  disposeThree()
})

watch(
  [W, H, D, T, Kerf, TabH, NTab, NShelves, isoExplode],
  () => updateScene(),
  { flush: 'post' },
)

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

function wrapCutSvg(pathData: string, pw: number, ph: number): string {
  return `<?xml version="1.0" encoding="utf-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="${pw.toFixed(2)}mm" height="${ph.toFixed(2)}mm" viewBox="0 0 ${pw.toFixed(2)} ${ph.toFixed(2)}">\n` +
    `  <path d="${pathData}" fill="none" stroke="#ff0000" stroke-width="0.01" stroke-linejoin="miter"/>\n` +
    `</svg>`
}

function dlPiece(name: string, path: string, pw: number, ph: number) {
  downloadSvg(name, wrapCutSvg(path, pw, ph))
}

function getCutSheetTransform(p: LayoutPiece): string {
  const pd = pieceData(p.label)
  const rotated = Math.abs(p.w - pd.oh) < 1 && Math.abs(p.h - pd.ow) < 1
  return rotated
    ? `translate(${p.x.toFixed(2)},${(p.y + pd.ow).toFixed(2)}) rotate(90)`
    : `translate(${p.x.toFixed(2)},${p.y.toFixed(2)})`
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
          <div class="shelf-part-row"><span>{{ t('box.sides') }}</span><span>2 &times; {{ D.toFixed(0) }}&times;{{ H.toFixed(0) }} mm</span></div>
          <div class="shelf-part-row"><span>{{ t('box.top_bottom') }}</span><span>2 &times; {{ W.toFixed(0) }}&times;{{ D.toFixed(0) }} mm</span></div>
          <div class="shelf-part-row"><span>{{ t('box.back') }}</span><span>1 &times; {{ W.toFixed(0) }}&times;{{ H.toFixed(0) }} mm</span></div>
          <div v-if="NShelves > 0" class="shelf-part-row"><span>{{ t('box.shelf') }}</span><span>{{ NShelves }} &times; {{ W.toFixed(0) }}&times;{{ D.toFixed(0) }} mm</span></div>
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
        <!-- Side wall -->
        <section class="card">
          <div class="card-head">
            <h2>{{ t('box.side_wall') }} <small>(2 {{ t('box.pcs') }})</small></h2>
            <button class="btn-dl" @click="dlPiece('side.svg', pathSide(), D, H)">&#x2193; SVG</button>
          </div>
          <div class="sheet-svg-wrap">
            <svg
              :width="D * svgScale(D, H) + 30"
              :height="H * svgScale(D, H) + 30"
              :viewBox="`-15 -15 ${D * svgScale(D, H) + 30} ${H * svgScale(D, H) + 30}`"
              style="display:block;margin:auto;"
            >
              <rect x="-15" y="-15" :width="D * svgScale(D, H) + 30" :height="H * svgScale(D, H) + 30" fill="var(--laser-sheet-bg)" />
              <g :transform="`scale(${svgScale(D, H).toFixed(4)})`">
                <path :d="pathSide()" fill="var(--accent)" fill-opacity="0.28" fill-rule="evenodd" stroke="var(--laser-cut)" :stroke-width="(1.5 / svgScale(D, H)).toFixed(3)" stroke-linejoin="miter" />
              </g>
              <text :x="(D * svgScale(D, H) + 30) / 2 - 15" :y="H * svgScale(D, H) + 10" text-anchor="middle" font-size="10" fill="var(--muted)">{{ D.toFixed(0) }} &times; {{ H.toFixed(0) }} mm</text>
            </svg>
          </div>
          <div class="sheet-footer">{{ D.toFixed(0) }} &times; {{ H.toFixed(0) }} mm</div>
        </section>

        <!-- Top/Bottom wall -->
        <section class="card">
          <div class="card-head">
            <h2>{{ t('box.top_bottom_wall') }} <small>(2 {{ t('box.pcs') }})</small></h2>
            <button class="btn-dl" @click="dlPiece('top-bottom.svg', pathTopBottom(), W, D)">&#x2193; SVG</button>
          </div>
          <div class="sheet-svg-wrap">
            <svg
              :width="W * svgScale(W, D) + 30"
              :height="D * svgScale(W, D) + 30"
              :viewBox="`-15 -15 ${W * svgScale(W, D) + 30} ${D * svgScale(W, D) + 30}`"
              style="display:block;margin:auto;"
            >
              <rect x="-15" y="-15" :width="W * svgScale(W, D) + 30" :height="D * svgScale(W, D) + 30" fill="var(--laser-sheet-bg)" />
              <g :transform="`scale(${svgScale(W, D).toFixed(4)})`">
                <path :d="pathTopBottom()" fill="#27ae60" fill-opacity="0.28" fill-rule="evenodd" stroke="var(--laser-cut)" :stroke-width="(1.5 / svgScale(W, D)).toFixed(3)" stroke-linejoin="miter" />
              </g>
              <text :x="(W * svgScale(W, D) + 30) / 2 - 15" :y="D * svgScale(W, D) + 10" text-anchor="middle" font-size="10" fill="var(--muted)">{{ W.toFixed(0) }} &times; {{ D.toFixed(0) }} mm</text>
            </svg>
          </div>
          <div class="sheet-footer">{{ W.toFixed(0) }} &times; {{ D.toFixed(0) }} mm</div>
        </section>

        <!-- Back wall -->
        <section class="card">
          <div class="card-head">
            <h2>{{ t('box.back_wall') }} <small>(1 {{ t('box.pcs') }})</small></h2>
            <button class="btn-dl" @click="dlPiece('back.svg', pathBack(), W, H)">&#x2193; SVG</button>
          </div>
          <div class="sheet-svg-wrap">
            <svg
              :width="W * svgScale(W, H) + 30"
              :height="H * svgScale(W, H) + 30"
              :viewBox="`-15 -15 ${W * svgScale(W, H) + 30} ${H * svgScale(W, H) + 30}`"
              style="display:block;margin:auto;"
            >
              <rect x="-15" y="-15" :width="W * svgScale(W, H) + 30" :height="H * svgScale(W, H) + 30" fill="var(--laser-sheet-bg)" />
              <g :transform="`scale(${svgScale(W, H).toFixed(4)})`">
                <path :d="pathBack()" fill="#8e44ad" fill-opacity="0.28" fill-rule="evenodd" stroke="var(--laser-cut)" :stroke-width="(1.5 / svgScale(W, H)).toFixed(3)" stroke-linejoin="miter" />
              </g>
              <text :x="(W * svgScale(W, H) + 30) / 2 - 15" :y="H * svgScale(W, H) + 10" text-anchor="middle" font-size="10" fill="var(--muted)">{{ W.toFixed(0) }} &times; {{ H.toFixed(0) }} mm</text>
            </svg>
          </div>
          <div class="sheet-footer">{{ W.toFixed(0) }} &times; {{ H.toFixed(0) }} mm</div>
        </section>

        <!-- Shelf -->
        <section v-if="NShelves > 0" class="card">
          <div class="card-head">
            <h2>{{ t('box.shelf') }} <small>({{ NShelves }} {{ t('box.pcs') }})</small></h2>
            <button class="btn-dl" @click="dlPiece('shelf.svg', pathShelf(), W, D)">&#x2193; SVG</button>
          </div>
          <div class="sheet-svg-wrap">
            <svg
              :width="W * svgScale(W, D) + 30"
              :height="D * svgScale(W, D) + 30"
              :viewBox="`-15 -15 ${W * svgScale(W, D) + 30} ${D * svgScale(W, D) + 30}`"
              style="display:block;margin:auto;"
            >
              <rect x="-15" y="-15" :width="W * svgScale(W, D) + 30" :height="D * svgScale(W, D) + 30" fill="var(--laser-sheet-bg)" />
              <g :transform="`scale(${svgScale(W, D).toFixed(4)})`">
                <path :d="pathShelf()" fill="#e67e22" fill-opacity="0.28" fill-rule="evenodd" stroke="var(--laser-cut)" :stroke-width="(1.5 / svgScale(W, D)).toFixed(3)" stroke-linejoin="miter" />
              </g>
              <text :x="(W * svgScale(W, D) + 30) / 2 - 15" :y="D * svgScale(W, D) + 10" text-anchor="middle" font-size="10" fill="var(--muted)">{{ W.toFixed(0) }} &times; {{ D.toFixed(0) }} mm</text>
            </svg>
          </div>
          <div class="sheet-footer">{{ W.toFixed(0) }} &times; {{ D.toFixed(0) }} mm</div>
        </section>

        <!-- 3D Assembly -->
        <section class="card">
          <h2>{{ t('box.assembly_3d') }}</h2>
          <div class="iso-controls">
            <label>{{ t('box.explode') }}</label>
            <input type="range" min="0" max="0.5" step="0.01" v-model.number="isoExplode" style="flex:1" />
            <span class="iso-hint">{{ t('box.mouse_hint') }}</span>
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
