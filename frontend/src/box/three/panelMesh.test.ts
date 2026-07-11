import { describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { clearGroup, disposeObj } from './panelMesh'

describe('three.js disposal helpers', () => {
  it('disposes nested geometry, material, and material textures', () => {
    const geometry = new THREE.BoxGeometry(1, 1, 1)
    const texture = new THREE.Texture()
    const material = new THREE.MeshBasicMaterial({ map: texture })
    const geometryDispose = vi.spyOn(geometry, 'dispose')
    const textureDispose = vi.spyOn(texture, 'dispose')
    const materialDispose = vi.spyOn(material, 'dispose')
    const group = new THREE.Group()
    group.add(new THREE.Mesh(geometry, material))

    clearGroup(group)

    expect(group.children).toHaveLength(0)
    expect(geometryDispose).toHaveBeenCalledOnce()
    expect(textureDispose).toHaveBeenCalledOnce()
    expect(materialDispose).toHaveBeenCalledOnce()
  })

  it('keeps explicitly shared cached objects alive until their owner disposes them', () => {
    const material = new THREE.SpriteMaterial()
    const dispose = vi.spyOn(material, 'dispose')
    const sprite = new THREE.Sprite(material)
    sprite.userData.noDispose = true
    disposeObj(sprite)
    expect(dispose).not.toHaveBeenCalled()
  })
})
