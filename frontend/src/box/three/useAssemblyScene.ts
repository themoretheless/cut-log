/**
 * Assembly 3D view: the whole box with exploded-view slider, dashed guides
 * and billboard labels. Renders on demand (only when the camera, the explode
 * animation or the scene contents change). The selected gallery piece is kept
 * opaque, the rest dimmed.
 */
import { ref } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { buildPanel, clearGroup, type PanelData } from './panelMesh'
import type { BoxModel, Translate } from '@/box/useBoxModel'

// Explode only translates objects, so geometry is built once at base
// coordinates and these records say how each object moves with the slider.
interface ExplodeRec { obj: THREE.Object3D; axis: number; sign: number }

export function useAssemblyScene(model: BoxModel, t: Translate) {
  const isoExplode = ref(0.22)
  let isoExplodeCurrent = 0.22

  let scene: THREE.Scene | null = null
  let camera: THREE.PerspectiveCamera | null = null
  let renderer: THREE.WebGLRenderer | null = null
  let controls: OrbitControls | null = null
  let panelGroup: THREE.Group | null = null
  let guidesGroup: THREE.Group | null = null
  let labelsGroup: THREE.Group | null = null
  let resizeObs: ResizeObserver | null = null
  let animFrameId = 0
  // Render-on-demand: frames are drawn only when something changed.
  let mainDirty = true

  let explodePanels: ExplodeRec[] = []
  let explodeLabels: { sprite: THREE.Sprite; base: THREE.Vector3; axis: number; sign: number }[] = []
  let explodeGuides: { line: THREE.LineSegments; base: THREE.Vector3; axis: number; sign: number }[] = []

  // Canvas textures are expensive to create and upload, so label materials are
  // cached by content and never disposed (the set of labels is small).
  const labelMatCache = new Map<string, THREE.SpriteMaterial>()

  function makeLabel(text: string, color: string, sub?: string): THREE.Sprite {
    const key = `${text}|${color}|${sub ?? ''}`
    let mat = labelMatCache.get(key)
    if (!mat) {
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
      mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false })
      labelMatCache.set(key, mat)
    }
    const sprite = new THREE.Sprite(mat)
    sprite.userData.noDispose = true
    sprite.scale.set(110, sub ? 34 : 20, 1)
    sprite.renderOrder = 999
    return sprite
  }

  function init(containerId: string) {
    const c = document.getElementById(containerId)
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
    controls.addEventListener('change', () => { mainDirty = true })
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
    let lastFrameTime = 0
    ;(function loop(now = performance.now()) {
      animFrameId = requestAnimationFrame(loop)
      const dt = lastFrameTime > 0 ? Math.min((now - lastFrameTime) / 1000, 0.1) : 1 / 60
      lastFrameTime = now
      const target = isoExplode.value
      const delta = target - isoExplodeCurrent
      const snapThreshold = 0.0005 * dt * 60
      if (Math.abs(delta) > snapThreshold) {
        const easing = 1 - Math.pow(1 - 0.18, dt * 60)
        isoExplodeCurrent += delta * easing
        if (Math.abs(target - isoExplodeCurrent) < snapThreshold) isoExplodeCurrent = target
        applyExplode()
        mainDirty = true
      }
      ctrl.update()
      if (mainDirty) {
        mainDirty = false
        lg.children.forEach(s => s.quaternion.copy(cam.quaternion))
        rend.render(sc, cam)
      }
    })()

    resizeObs = new ResizeObserver(() => {
      const rw = c.clientWidth
      const rh = c.clientHeight
      if (rw > 0 && rh > 0) {
        cam.aspect = rw / rh
        cam.updateProjectionMatrix()
        rend.setSize(rw, rh)
        mainDirty = true
      }
    })
    resizeObs.observe(c)
  }

  function applyExplode() {
    const explode = Math.max(isoExplodeCurrent, 0.001)
    const e = [model.W.value * explode, model.D.value * explode, model.H.value * explode]
    for (const r of explodePanels) {
      r.obj.position.setComponent(r.axis, r.sign * e[r.axis])
    }
    for (const l of explodeLabels) {
      l.sprite.position.copy(l.base)
      if (l.axis >= 0)
        l.sprite.position.setComponent(l.axis, l.base.getComponent(l.axis) + l.sign * e[l.axis])
    }
    for (const g of explodeGuides) {
      const pos = g.line.geometry.attributes.position as THREE.BufferAttribute
      pos.setXYZ(0, g.base.x, g.base.y, g.base.z)
      const end = [g.base.x, g.base.y, g.base.z]
      end[g.axis] += g.sign * e[g.axis]
      pos.setXYZ(1, end[0], end[1], end[2])
      pos.needsUpdate = true
      g.line.computeLineDistances()
    }
  }

  function update(resetTarget = true) {
    if (!panelGroup || !guidesGroup || !labelsGroup || !controls) return
    clearGroup(panelGroup)
    clearGroup(guidesGroup)
    clearGroup(labelsGroup)
    explodePanels = []
    explodeLabels = []
    explodeGuides = []

    const w = model.W.value, h = model.H.value, d = model.D.value, thick = model.T.value
    const Bevel = model.Bevel.value

    // Panels (at base positions; explode offsets applied via applyExplode)
    const lh = model.sideHoles3D(0)
    const rh = model.sideHoles3D(w)
    const bh = model.backHoles3D(d)
    const sel = model.galPieces.value[model.galIdx.value]?.id ?? null
    type TaggedPanel = PanelData & { gid: string; axis: number; sign: number }
    const panels: TaggedPanel[] = [
      { c: model.sidePts3D(0), n: [1, 0, 0], t: thick, col: '#2980b9', ec: '#1a5276', h: lh.length > 0 ? lh : undefined, gid: 'side', axis: 0, sign: -1 },
      { c: model.sidePts3D(w), n: [-1, 0, 0], t: thick, col: '#2980b9', ec: '#1a5276', h: rh.length > 0 ? rh : undefined, gid: 'side', axis: 0, sign: 1 },
      { c: model.horizPts3D(h, model.TopD.value, Math.max(Bevel, 0)), n: [0, 0, -1], t: thick, col: '#27ae60', ec: '#1e8449', gid: 'top', axis: 2, sign: 1 },
      { c: model.horizPts3D(0, model.BotD.value, Math.max(-Bevel, 0)), n: [0, 0, 1], t: thick, col: Bevel !== 0 ? '#1abc9c' : '#27ae60', ec: Bevel !== 0 ? '#27ae60' : '#1e8449', gid: 'bot', axis: 2, sign: -1 },
      { c: model.backPts3D(d), n: [0, -1, 0], t: thick, col: '#8e44ad', ec: '#5b2c6f', h: bh.length > 0 ? bh : undefined, gid: 'back', axis: 1, sign: 1 },
    ]
    const clipTop = Math.max(Bevel, 0)
    const clipBot = Math.max(-Bevel, 0)
    const shSlots = model.shelfSlotYs()
    for (let si = 0; si < shSlots.length; si++) {
      const frac = shSlots[si] / h
      const shelfYOff = clipBot + (clipTop - clipBot) * frac
      const shelfDepth = d - shelfYOff
      const sc = Bevel !== 0 ? model.shelfColor(si) : '#e67e22'
      const sec = Bevel !== 0 ? model.shelfEdgeColor(si) : '#ca6f1e'
      panels.push({ c: model.shelfPts3D(shSlots[si], shelfDepth, shelfYOff), n: [0, 0, 1], t: thick, col: sc, ec: sec, gid: `shelf${si}`, axis: -1, sign: 0 })
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
      if (p.axis >= 0) explodePanels.push({ obj: mesh, axis: p.axis, sign: p.sign })
      panelGroup.add(mesh)
    }

    // Guide lines: each runs from a fixed corner outward along one axis
    const gMat = new THREE.LineDashedMaterial({
      color: 0xaaaaaa, dashSize: 4, gapSize: 4, transparent: true, opacity: 0.5,
    })
    const addGuide = (x: number, y: number, z: number, axis: number, sign: number) => {
      const base = new THREE.Vector3(x, y, z)
      const gGeo = new THREE.BufferGeometry().setFromPoints([base, base.clone()])
      const line = new THREE.LineSegments(gGeo, gMat)
      guidesGroup!.add(line)
      explodeGuides.push({ line, base, axis, sign })
    }

    // Top/bottom guides
    for (const [gx, gy] of [[0, 0], [w, 0], [w, d], [0, d]]) {
      addGuide(gx, gy, 0, 2, -1)
      addGuide(gx, gy, h, 2, 1)
    }
    // Side guides
    for (const [gy, gz] of [[0, 0], [d, 0], [d, h], [0, h]]) {
      addGuide(0, gy, gz, 0, -1)
      addGuide(w, gy, gz, 0, 1)
    }
    // Back guides
    for (const [gx, gz] of [[0, 0], [w, 0], [w, h], [0, h]])
      addGuide(gx, d, gz, 1, 1)

    // Labels
    const sz = (lw: number, lh2: number) => `${lw.toFixed(0)}×${lh2.toFixed(0)}`
    const addLabel = (text: string, color: string, sub: string, x: number, y: number, z: number, axis = -1, sign = 0) => {
      const sprite = makeLabel(text, color, sub)
      sprite.position.set(x, y, z)
      labelsGroup!.add(sprite)
      explodeLabels.push({ sprite, base: new THREE.Vector3(x, y, z), axis, sign })
    }

    addLabel(t('box.top_short'), '#a0e0a0', sz(w, d), w / 2, d / 2, h, 2, 1)
    addLabel(t('box.bottom_short'), '#a0e0a0', sz(w, d), w / 2, d / 2, 0, 2, -1)
    addLabel(t('box.side_short'), '#80c0e0', sz(d + Bevel, h), 0, d / 2, h / 2, 0, -1)
    addLabel(t('box.side_short'), '#80c0e0', sz(d + Bevel, h), w, d / 2, h / 2, 0, 1)
    addLabel(t('box.back_short'), '#c0a0d0', sz(w, h), w / 2, d, h / 2, 1, 1)

    const shYs = model.shelfSlotYs()
    for (let i = 0; i < shYs.length; i++)
      addLabel(`${t('box.shelf_short')}${i + 1}`, '#e0c080', sz(w, d), w / 2, d / 2, shYs[i])

    applyExplode()
    mainDirty = true

    if (resetTarget) {
      controls.target.set(w / 2, d / 2, h / 2)
    }
    controls.update()
  }

  function dispose() {
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

  return { isoExplode, init, update, dispose }
}
