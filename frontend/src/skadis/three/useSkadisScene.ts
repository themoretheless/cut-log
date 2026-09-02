/**
 * 3D preview of the printable SKÅDIS box: the solid model plus a translucent
 * slice of pegboard behind it so the hook engagement is visible. Renders on
 * demand and owns every GPU resource it creates.
 */
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { clearGroup, disposeMaterial } from '@/box/three/panelMesh'
import { skadisBoxTriangles, type SkadisBoxModel, type SkadisBoxSettings } from '@/skadis/box'

export function useSkadisScene() {
  let scene: THREE.Scene | null = null
  let camera: THREE.PerspectiveCamera | null = null
  let renderer: THREE.WebGLRenderer | null = null
  let controls: OrbitControls | null = null
  let group: THREE.Group | null = null
  let resizeObs: ResizeObserver | null = null
  let animFrameId = 0
  let dirty = true

  const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0xe8842a, roughness: 0.55, metalness: 0.05 })
  const hookMaterial = new THREE.MeshStandardMaterial({ color: 0xf5c16c, roughness: 0.55, metalness: 0.05 })
  const boardMaterial = new THREE.MeshStandardMaterial({ color: 0x7f8c8d, transparent: true, opacity: 0.35, roughness: 0.9 })
  const slotMaterial = new THREE.MeshBasicMaterial({ color: 0x1e1e2e })
  const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x3d2a14, transparent: true, opacity: 0.6 })

  function init(container: HTMLElement) {
    const w = container.clientWidth || 600
    const h = container.clientHeight || 450

    scene = new THREE.Scene()
    scene.background = new THREE.Color(0x1e1e2e)

    camera = new THREE.PerspectiveCamera(38, w / h, 1, 5000)
    camera.up.set(0, 0, 1)
    // OrbitControls derives its spherical state from camera minus target; both at the origin yields NaN.
    camera.position.set(-120, -160, 110)

    renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(w, h)
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    container.appendChild(renderer.domElement)

    controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.12
    controls.addEventListener('change', () => { dirty = true })

    scene.add(new THREE.AmbientLight(0xffffff, 0.55))
    const key = new THREE.DirectionalLight(0xffffff, 0.9)
    key.position.set(-300, -400, 500)
    scene.add(key)
    const fill = new THREE.DirectionalLight(0xffffff, 0.35)
    fill.position.set(300, 200, -100)
    scene.add(fill)

    group = new THREE.Group()
    scene.add(group)

    const cam = camera, ctrl = controls, rend = renderer, sc = scene
    ;(function loop() {
      animFrameId = requestAnimationFrame(loop)
      if (document.hidden) return
      ctrl.update()
      if (dirty) {
        dirty = false
        rend.render(sc, cam)
      }
    })()

    resizeObs = new ResizeObserver(() => {
      const rw = container.clientWidth
      const rh = container.clientHeight
      if (rw > 0 && rh > 0) {
        cam.aspect = rw / rh
        cam.updateProjectionMatrix()
        rend.setSize(rw, rh)
        dirty = true
      }
    })
    resizeObs.observe(container)
  }

  function meshFor(model: SkadisBoxModel, filter: (id: string) => boolean, material: THREE.Material) {
    const parts = { ...model, parts: model.parts.filter(p => filter(p.id)) }
    if (!parts.parts.length) return null
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(skadisBoxTriangles(parts), 3))
    geometry.computeVertexNormals()
    const mesh = new THREE.Mesh(geometry, material)
    mesh.userData.noDispose = true
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 30), edgeMaterial)
    edges.userData.noDispose = true
    mesh.add(edges)
    return mesh
  }

  function boardSlice(model: SkadisBoxModel, s: SkadisBoxSettings): THREE.Group {
    const slice = new THREE.Group()
    const pad = s.pitch
    const width = model.hookColumns.length > 1
      ? model.hookColumns[model.hookColumns.length - 1] - model.hookColumns[0] + 2 * pad
      : 2 * pad
    const x0 = (model.hookColumns[0] ?? s.width / 2) - pad
    const y0 = s.depth + s.clearance
    const board = new THREE.Mesh(new THREE.BoxGeometry(width, s.boardThickness, s.height + 2 * pad), boardMaterial)
    board.position.set(x0 + width / 2, y0 + s.boardThickness / 2, s.height / 2)
    slice.add(board)
    // Slots along the hook rows and the rows in between, staggered like the real board.
    const rowZs: number[] = []
    for (const [bottom] of model.hookRows) rowZs.push(bottom + s.slotHeight / 2, bottom + s.slotHeight / 2 - s.pitch)
    for (const z of rowZs) {
      const stagger = rowZs.indexOf(z) % 2 === 1 ? s.pitch / 2 : 0
      for (let x = (model.hookColumns[0] ?? s.width / 2) + stagger - pad * 2; x < x0 + width + pad; x += s.pitch) {
        if (x < x0 || x > x0 + width) continue
        const slot = new THREE.Mesh(new THREE.BoxGeometry(s.slotWidth, s.boardThickness + 0.2, s.slotHeight), slotMaterial)
        slot.position.set(x, y0 + s.boardThickness / 2, z)
        slice.add(slot)
      }
    }
    return slice
  }

  function update(model: SkadisBoxModel, s: SkadisBoxSettings, resetView: boolean) {
    if (!group || !controls || !camera) return
    clearGroup(group)
    const body = meshFor(model, id => id !== 'neck' && id !== 'lip', bodyMaterial)
    const hooks = meshFor(model, id => id === 'neck' || id === 'lip', hookMaterial)
    if (body) group.add(body)
    if (hooks) group.add(hooks)
    if (model.parts.length) group.add(boardSlice(model, s))

    if (resetView) {
      const size = Math.max(s.width, s.height, model.totalDepth)
      controls.target.set(s.width / 2, s.depth / 2, s.height / 2)
      camera.position.set(s.width / 2 - size * 1.4, -size * 1.6, s.height / 2 + size * 0.9)
    }
    controls.update()
    dirty = true
  }

  function dispose() {
    if (animFrameId) cancelAnimationFrame(animFrameId)
    if (resizeObs) resizeObs.disconnect()
    if (group) {
      group.traverse(obj => {
        if ('geometry' in obj && (obj as THREE.Mesh).geometry) (obj as THREE.Mesh).geometry.dispose()
      })
      clearGroup(group)
    }
    for (const material of [bodyMaterial, hookMaterial, boardMaterial, slotMaterial, edgeMaterial]) disposeMaterial(material)
    controls?.dispose()
    scene?.clear()
    if (renderer) {
      renderer.renderLists.dispose()
      renderer.dispose()
      renderer.domElement?.remove()
    }
    animFrameId = 0
    scene = camera = renderer = controls = group = null
    resizeObs = null
  }

  return { init, update, dispose }
}
