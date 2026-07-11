/**
 * Isolated piece 3D view: all gallery pieces sit on a big invisible ring; the
 * selected one faces the camera, switching pieces rotates the ring with an
 * ease-out animation while the camera glides back to its home position.
 * Renders on demand. Rotation by dragging is enabled only when the drag starts
 * on the piece itself (raycast hit).
 */
import * as THREE from 'three'
import { TrackballControls } from 'three/addons/controls/TrackballControls.js'
import { buildPanel, clearGroup, type PanelData } from './panelMesh'
import type { BoxModel } from '@/box/useBoxModel'

const RING_RADIUS = 1000

export function usePieceGallery(model: BoxModel) {
  let pScene: THREE.Scene | null = null
  let pCamera: THREE.PerspectiveCamera | null = null
  let pRenderer: THREE.WebGLRenderer | null = null
  let pControls: TrackballControls | null = null
  let pGroup: THREE.Group | null = null
  let pResizeObs: ResizeObserver | null = null
  let pAnimId = 0
  let pieceDirty = true

  const pRing = { active: false, t: 1, from: 0, to: 0,
    camPos: new THREE.Vector3(), camTarget: new THREE.Vector3(), camUp: new THREE.Vector3() }
  const pCamReset = { active: false, t: 1,
    camPos: new THREE.Vector3(), camTarget: new THREE.Vector3(), camUp: new THREE.Vector3() }

  // Active piece is opaque, the rest dimmed; applied on selection change
  // instead of every frame.
  function applyPieceOpacity() {
    if (!pGroup) return
    const activeIdx = model.galIdx.value
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
    pieceDirty = true
  }

  function init(containerId: string) {
    const c = document.getElementById(containerId)
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
    pControls.addEventListener('change', () => { pieceDirty = true })
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
    window.addEventListener('pointerup', onWindowPointerUp)

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
      if (document.hidden) return
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
        pieceDirty = true
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
        pieceDirty = true
      }
      ctrl.update()
      if (pieceDirty) {
        pieceDirty = false
        rend.render(sc, cam)
      }
    })()

    pResizeObs = new ResizeObserver(() => {
      const rw = c.clientWidth, rh = c.clientHeight
      if (rw > 0 && rh > 0) {
        cam.aspect = rw / rh
        cam.updateProjectionMatrix()
        rend.setSize(rw, rh)
        pieceDirty = true
      }
    })
    pResizeObs.observe(c)
  }

  function onWindowPointerUp() {
    if (pControls) pControls.noRotate = true
  }

  function rebuildAllPieces() {
    if (!pGroup) return
    clearGroup(pGroup)

    const thick = model.T.value
    const Bevel = model.Bevel.value
    const pieces = model.galPieces.value

    for (let i = 0; i < pieces.length; i++) {
      const gp = pieces[i]
      const inner = new THREE.Group()

      const panels: PanelData[] = []
      if (gp.id === 'side') {
        panels.push({ c: model.sidePts3D(0), n: [1, 0, 0], t: thick, col: '#2980b9', ec: '#1a5276', h: model.sideHoles3D(0).length > 0 ? model.sideHoles3D(0) : undefined })
      } else if (gp.id === 'tb') {
        panels.push({ c: model.horizPts3D(0), n: [0, 0, 1], t: thick, col: '#27ae60', ec: '#1e8449' })
      } else if (gp.id === 'top') {
        panels.push({ c: model.horizPts3D(0, model.TopD.value, Math.max(Bevel, 0)), n: [0, 0, 1], t: thick, col: '#27ae60', ec: '#1e8449' })
      } else if (gp.id === 'bot') {
        panels.push({ c: model.horizPts3D(0, model.BotD.value, Math.max(-Bevel, 0)), n: [0, 0, 1], t: thick, col: '#1abc9c', ec: '#148f77' })
      } else if (gp.id === 'back') {
        panels.push({ c: model.backPts3D(0), n: [0, -1, 0], t: thick, col: '#a855f7', ec: '#7d3c98', h: model.backHoles3D(0).length > 0 ? model.backHoles3D(0) : undefined })
      } else if (gp.id.startsWith('shelf')) {
        const si = parseInt(gp.id.replace('shelf', '')) || 0
        const sys = model.shelfSlotYs()
        const sy = si < sys.length ? sys[si] : 0
        const sd = model.shelfDepthAt(sy)
        const sOff = model.shelfOffsetAt(sy)
        const sc = Bevel !== 0 ? model.shelfColor(si) : '#e67e22'
        const sec = Bevel !== 0 ? model.shelfEdgeColor(si) : '#ca6f1e'
        panels.push({ c: model.shelfPts3D(0, sd, sOff), n: [0, 0, 1], t: thick, col: sc, ec: sec })
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
    const activeIdx = model.galIdx.value
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
    return -(idx / model.galPieces.value.length) * Math.PI * 2
  }

  function update(animate = false) {
    if (!pGroup || !pControls || !pCamera) return

    if (!animate) {
      rebuildAllPieces()
      positionRing(pieceAngle(model.galIdx.value))
      setupPieceCam()
      applyPieceOpacity()
    } else {
      const target = pieceAngle(model.galIdx.value)
      const from = pGroup.userData.ringAngle ?? 0
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
      applyPieceOpacity()
    }
  }

  function resetView() {
    pCamReset.camPos.copy(pCamera!.position)
    pCamReset.camTarget.copy(pControls!.target)
    pCamReset.camUp.copy(pCamera!.up)
    pCamReset.active = true
    pCamReset.t = 0
  }

  function dispose() {
    if (pAnimId) cancelAnimationFrame(pAnimId)
    if (pResizeObs) pResizeObs.disconnect()
    window.removeEventListener('pointerup', onWindowPointerUp)
    if (pGroup) clearGroup(pGroup)
    pControls?.dispose()
    pScene?.clear()
    if (pRenderer) {
      pRenderer.renderLists.dispose()
      pRenderer.dispose()
      pRenderer.domElement?.remove()
    }
    pAnimId = 0
    pScene = pCamera = pRenderer = pControls = null
    pGroup = null
    pResizeObs = null
  }

  return { init, update, resetView, dispose }
}
