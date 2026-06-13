/**
 * Pure Three.js helpers shared by the assembly view and the piece gallery:
 * panel mesh construction from 2D contours and recursive disposal. No Vue
 * reactivity here.
 */
import * as THREE from 'three'

export function clearGroup(g: THREE.Group) {
  while (g.children.length) {
    const c = g.children[0]
    g.remove(c)
    disposeObj(c)
  }
}

export function disposeObj(obj: THREE.Object3D) {
  if (obj.userData.noDispose) return
  if ('children' in obj) obj.children.forEach(disposeObj)
  if ('geometry' in obj && (obj as THREE.Mesh).geometry)
    (obj as THREE.Mesh).geometry.dispose()
  if ('material' in obj) {
    const mat = (obj as THREE.Mesh).material
    if (Array.isArray(mat)) mat.forEach(m => m.dispose())
    else if (mat) (mat as THREE.Material).dispose()
  }
}

export interface PanelData {
  c: number[][]
  n: number[]
  t: number
  col: string
  ec: string
  h?: number[][][]
}

/**
 * Extrude a panel contour (with optional holes) into a mesh with edge lines.
 * The contour lies in the plane whose axis dominates the normal; the extrusion
 * is remapped from local XY+Z back into world axes.
 */
export function buildPanel(p: PanelData): THREE.Mesh | null {
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
