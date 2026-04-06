/**
 * WebGPU 3D renderer with Phong shading, orbit camera, and grid.
 */
import {
  identity, multiply, perspective, lookAt, transpose, invert,
  type Mat4,
} from './math3d'
import type { MeshData } from './openscadParser'

// ── WGSL Shaders ──

const MESH_SHADER = /* wgsl */`
struct SceneUniforms {
  viewProj: mat4x4f,
  cameraPos: vec4f,
  lightDir: vec4f,
  ambient: vec4f,
}

struct MeshUniforms {
  model: mat4x4f,
  normalMat: mat4x4f,
  color: vec4f,
}

@group(0) @binding(0) var<uniform> scene: SceneUniforms;
@group(1) @binding(0) var<uniform> mesh: MeshUniforms;

struct VSOut {
  @builtin(position) pos: vec4f,
  @location(0) normal: vec3f,
  @location(1) worldPos: vec3f,
}

@vertex fn vs(@location(0) position: vec3f, @location(1) normal: vec3f) -> VSOut {
  let worldPos = (mesh.model * vec4f(position, 1.0)).xyz;
  let n = normalize((mesh.normalMat * vec4f(normal, 0.0)).xyz);
  return VSOut(scene.viewProj * vec4f(worldPos, 1.0), n, worldPos);
}

@fragment fn fs(v: VSOut) -> @location(0) vec4f {
  let N = normalize(v.normal);
  let L = normalize(scene.lightDir.xyz);
  let V = normalize(scene.cameraPos.xyz - v.worldPos);
  let H = normalize(L + V);

  let diff = max(dot(N, L), 0.0);
  let spec = pow(max(dot(N, H), 0.0), 32.0);
  let backDiff = max(dot(-N, L), 0.0) * 0.3;

  let ambient = scene.ambient.rgb * mesh.color.rgb;
  let diffuse = diff * mesh.color.rgb;
  let specular = spec * vec3f(0.3, 0.3, 0.3);
  let backLight = backDiff * mesh.color.rgb * 0.5;

  let color = ambient + diffuse + specular + backLight;
  return vec4f(color, mesh.color.a);
}
`

const GRID_SHADER = /* wgsl */`
struct SceneUniforms {
  viewProj: mat4x4f,
  cameraPos: vec4f,
  lightDir: vec4f,
  ambient: vec4f,
}

@group(0) @binding(0) var<uniform> scene: SceneUniforms;

struct VSOut {
  @builtin(position) pos: vec4f,
  @location(0) color: vec4f,
}

@vertex fn vs(@location(0) position: vec3f, @location(1) color: vec4f) -> VSOut {
  return VSOut(scene.viewProj * vec4f(position, 1.0), color);
}

@fragment fn fs(v: VSOut) -> @location(0) vec4f {
  return v.color;
}
`

// ── Types ──

interface GPUMesh {
  vertexBuffer: GPUBuffer
  indexBuffer: GPUBuffer
  indexCount: number
  uniformBuffer: GPUBuffer
  bindGroup: GPUBindGroup
  transparent: boolean
}

// ── Renderer ──

export class WebGPURenderer {
  private canvas!: HTMLCanvasElement
  private device!: GPUDevice
  private context!: GPUCanvasContext
  private format!: GPUTextureFormat

  private meshPipeline!: GPURenderPipeline
  private meshPipelineTransparent!: GPURenderPipeline
  private gridPipeline!: GPURenderPipeline
  private sceneBindGroupLayout!: GPUBindGroupLayout
  private meshBindGroupLayout!: GPUBindGroupLayout
  private sceneUniformBuffer!: GPUBuffer
  private sceneBindGroup!: GPUBindGroup
  private depthTexture!: GPUTexture

  private gpuMeshes: GPUMesh[] = []
  private gridVertexBuffer: GPUBuffer | null = null
  private gridVertexCount = 0

  // camera
  private yaw = 0.6
  private pitch = 0.4
  private distance = 50
  private targetX = 0
  private targetY = 0
  private targetZ = 0

  private animId = 0
  private destroyed = false

  // pointer
  private dragging = false
  private panning = false
  private lastX = 0
  private lastY = 0

  async init(canvas: HTMLCanvasElement): Promise<boolean> {
    this.canvas = canvas

    if (!navigator.gpu) return false
    const adapter = await navigator.gpu.requestAdapter()
    if (!adapter) return false
    this.device = await adapter.requestDevice()
    this.context = canvas.getContext('webgpu') as GPUCanvasContext
    this.format = navigator.gpu.getPreferredCanvasFormat()
    this.context.configure({ device: this.device, format: this.format, alphaMode: 'premultiplied' })

    this.createPipelines()
    this.createSceneUniforms()
    this.createGrid()
    this.resize()
    this.bindEvents()
    this.loop()
    return true
  }

  private createPipelines() {
    // bind group layouts
    this.sceneBindGroupLayout = this.device.createBindGroupLayout({
      entries: [{
        binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: 'uniform' },
      }],
    })
    this.meshBindGroupLayout = this.device.createBindGroupLayout({
      entries: [{
        binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: { type: 'uniform' },
      }],
    })

    // mesh pipeline (opaque)
    const meshModule = this.device.createShaderModule({ code: MESH_SHADER })
    const pipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [this.sceneBindGroupLayout, this.meshBindGroupLayout],
    })

    const vertexBufferLayout: GPUVertexBufferLayout = {
      arrayStride: 24, // 6 floats
      attributes: [
        { shaderLocation: 0, offset: 0, format: 'float32x3' },
        { shaderLocation: 1, offset: 12, format: 'float32x3' },
      ],
    }

    this.meshPipeline = this.device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: { module: meshModule, entryPoint: 'vs', buffers: [vertexBufferLayout] },
      fragment: {
        module: meshModule, entryPoint: 'fs',
        targets: [{ format: this.format }],
      },
      primitive: { topology: 'triangle-list', cullMode: 'none' },
      depthStencil: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less' },
    })

    // mesh pipeline (transparent)
    this.meshPipelineTransparent = this.device.createRenderPipeline({
      layout: pipelineLayout,
      vertex: { module: meshModule, entryPoint: 'vs', buffers: [vertexBufferLayout] },
      fragment: {
        module: meshModule, entryPoint: 'fs',
        targets: [{
          format: this.format,
          blend: {
            color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
            alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
          },
        }],
      },
      primitive: { topology: 'triangle-list', cullMode: 'none' },
      depthStencil: { format: 'depth24plus', depthWriteEnabled: false, depthCompare: 'less' },
    })

    // grid pipeline
    const gridModule = this.device.createShaderModule({ code: GRID_SHADER })
    const gridPipelineLayout = this.device.createPipelineLayout({
      bindGroupLayouts: [this.sceneBindGroupLayout],
    })
    const gridVertexLayout: GPUVertexBufferLayout = {
      arrayStride: 28, // 3 float pos + 4 float color
      attributes: [
        { shaderLocation: 0, offset: 0, format: 'float32x3' },
        { shaderLocation: 1, offset: 12, format: 'float32x4' },
      ],
    }
    this.gridPipeline = this.device.createRenderPipeline({
      layout: gridPipelineLayout,
      vertex: { module: gridModule, entryPoint: 'vs', buffers: [gridVertexLayout] },
      fragment: {
        module: gridModule, entryPoint: 'fs',
        targets: [{
          format: this.format,
          blend: {
            color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
            alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
          },
        }],
      },
      primitive: { topology: 'line-list' },
      depthStencil: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less' },
    })
  }

  private createSceneUniforms() {
    // viewProj(64) + cameraPos(16) + lightDir(16) + ambient(16) = 112 bytes
    this.sceneUniformBuffer = this.device.createBuffer({
      size: 112,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    })
    this.sceneBindGroup = this.device.createBindGroup({
      layout: this.sceneBindGroupLayout,
      entries: [{ binding: 0, resource: { buffer: this.sceneUniformBuffer } }],
    })
  }

  private createGrid() {
    const verts: number[] = []
    const gridSize = 200
    const step = 10
    const gridColor = [0.4, 0.4, 0.4, 0.5]
    const axisColorX = [0.9, 0.2, 0.2, 0.8]
    const axisColorZ = [0.2, 0.2, 0.9, 0.8]
    const axisColorY = [0.2, 0.9, 0.2, 0.8]

    for (let i = -gridSize; i <= gridSize; i += step) {
      const c = i === 0 ? axisColorX : gridColor
      verts.push(i, 0, -gridSize, ...c, i, 0, gridSize, ...c)
      const c2 = i === 0 ? axisColorZ : gridColor
      verts.push(-gridSize, 0, i, ...c2, gridSize, 0, i, ...c2)
    }
    // Y axis
    verts.push(0, 0, 0, ...axisColorY, 0, gridSize, 0, ...axisColorY)

    this.gridVertexCount = verts.length / 7
    this.gridVertexBuffer = this.device.createBuffer({
      size: verts.length * 4,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    })
    this.device.queue.writeBuffer(this.gridVertexBuffer, 0, new Float32Array(verts))
  }

  setMeshes(meshes: MeshData[]) {
    // destroy old
    for (const gm of this.gpuMeshes) {
      gm.vertexBuffer.destroy()
      gm.indexBuffer.destroy()
      gm.uniformBuffer.destroy()
    }
    this.gpuMeshes = []

    for (const mesh of meshes) {
      const vertexBuffer = this.device.createBuffer({
        size: mesh.vertices.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      })
      this.device.queue.writeBuffer(vertexBuffer, 0, mesh.vertices)

      const indexBuffer = this.device.createBuffer({
        size: mesh.indices.byteLength,
        usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
      })
      this.device.queue.writeBuffer(indexBuffer, 0, mesh.indices)

      // model(64) + normalMat(64) + color(16) = 144
      const uniformBuffer = this.device.createBuffer({
        size: 144,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      })

      // write model matrix (row-major -> needs transpose for GPU column-major)
      const modelT = transpose(mesh.transform)
      this.device.queue.writeBuffer(uniformBuffer, 0, modelT)

      // normal matrix = transpose(inverse(model)) but for GPU we need column-major
      // normalMat = transpose(transpose(inverse(model))) = inverse(model) in row-major -> transpose for GPU
      const invModel = invert(mesh.transform)
      const normalMat = transpose(invModel)  // this is transpose(inverse(model)) in row-major
      const normalMatGPU = transpose(normalMat) // convert to column-major
      this.device.queue.writeBuffer(uniformBuffer, 64, normalMatGPU)

      // color
      this.device.queue.writeBuffer(uniformBuffer, 128, new Float32Array(mesh.color))

      const bindGroup = this.device.createBindGroup({
        layout: this.meshBindGroupLayout,
        entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
      })

      this.gpuMeshes.push({
        vertexBuffer,
        indexBuffer,
        indexCount: mesh.indices.length,
        uniformBuffer,
        bindGroup,
        transparent: mesh.color[3] < 0.99,
      })
    }

    // auto-fit camera
    this.autoFitCamera(meshes)
  }

  private autoFitCamera(meshes: MeshData[]) {
    if (meshes.length === 0) return

    let minX = Infinity, minY = Infinity, minZ = Infinity
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity

    for (const mesh of meshes) {
      const t = mesh.transform
      for (let i = 0; i < mesh.vertices.length; i += 6) {
        const x = mesh.vertices[i], y = mesh.vertices[i + 1], z = mesh.vertices[i + 2]
        // transform point
        const tx = t[0]*x + t[1]*y + t[2]*z + t[3]
        const ty = t[4]*x + t[5]*y + t[6]*z + t[7]
        const tz = t[8]*x + t[9]*y + t[10]*z + t[11]
        minX = Math.min(minX, tx); maxX = Math.max(maxX, tx)
        minY = Math.min(minY, ty); maxY = Math.max(maxY, ty)
        minZ = Math.min(minZ, tz); maxZ = Math.max(maxZ, tz)
      }
    }

    this.targetX = (minX + maxX) / 2
    this.targetY = (minY + maxY) / 2
    this.targetZ = (minZ + maxZ) / 2

    const size = Math.max(maxX - minX, maxY - minY, maxZ - minZ)
    this.distance = Math.max(size * 1.8, 5)
  }

  resize() {
    const dpr = window.devicePixelRatio || 1
    const w = this.canvas.clientWidth * dpr
    const h = this.canvas.clientHeight * dpr
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w
      this.canvas.height = h
      if (this.depthTexture) this.depthTexture.destroy()
      this.depthTexture = this.device.createTexture({
        size: [w, h],
        format: 'depth24plus',
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      })
    }
  }

  private render() {
    this.resize()

    const w = this.canvas.width, h = this.canvas.height
    const aspect = w / h

    // camera position from spherical coords
    const cx = this.targetX + this.distance * Math.cos(this.pitch) * Math.sin(this.yaw)
    const cy = this.targetY + this.distance * Math.sin(this.pitch)
    const cz = this.targetZ + this.distance * Math.cos(this.pitch) * Math.cos(this.yaw)

    const view = lookAt([cx, cy, cz], [this.targetX, this.targetY, this.targetZ], [0, 1, 0])
    const proj = perspective(Math.PI / 4, aspect, 0.1, this.distance * 10)
    const viewProj = multiply(proj, view)
    const viewProjGPU = transpose(viewProj) // row-major -> column-major

    // update scene uniforms
    const sceneData = new Float32Array(28) // 112 / 4
    sceneData.set(viewProjGPU, 0) // viewProj mat4
    sceneData.set([cx, cy, cz, 1], 16) // cameraPos
    sceneData.set([0.6, 0.8, 0.5, 0], 20) // lightDir (normalized in shader)
    sceneData.set([0.25, 0.25, 0.25, 1], 24) // ambient
    this.device.queue.writeBuffer(this.sceneUniformBuffer, 0, sceneData)

    const encoder = this.device.createCommandEncoder()
    const textureView = this.context.getCurrentTexture().createView()

    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: textureView,
        clearValue: { r: 0.1, g: 0.1, b: 0.12, a: 1 },
        loadOp: 'clear',
        storeOp: 'store',
      }],
      depthStencilAttachment: {
        view: this.depthTexture.createView(),
        depthClearValue: 1.0,
        depthLoadOp: 'clear',
        depthStoreOp: 'store',
      },
    })

    // draw grid
    if (this.gridVertexBuffer) {
      pass.setPipeline(this.gridPipeline)
      pass.setBindGroup(0, this.sceneBindGroup)
      pass.setVertexBuffer(0, this.gridVertexBuffer)
      pass.draw(this.gridVertexCount)
    }

    // draw opaque meshes first
    pass.setPipeline(this.meshPipeline)
    pass.setBindGroup(0, this.sceneBindGroup)
    for (const gm of this.gpuMeshes) {
      if (gm.transparent) continue
      pass.setBindGroup(1, gm.bindGroup)
      pass.setVertexBuffer(0, gm.vertexBuffer)
      pass.setIndexBuffer(gm.indexBuffer, 'uint32')
      pass.drawIndexed(gm.indexCount)
    }

    // draw transparent meshes
    pass.setPipeline(this.meshPipelineTransparent)
    pass.setBindGroup(0, this.sceneBindGroup)
    for (const gm of this.gpuMeshes) {
      if (!gm.transparent) continue
      pass.setBindGroup(1, gm.bindGroup)
      pass.setVertexBuffer(0, gm.vertexBuffer)
      pass.setIndexBuffer(gm.indexBuffer, 'uint32')
      pass.drawIndexed(gm.indexCount)
    }

    pass.end()
    this.device.queue.submit([encoder.finish()])
  }

  private loop = () => {
    if (this.destroyed) return
    this.render()
    this.animId = requestAnimationFrame(this.loop)
  }

  // ── Input handling ──

  private onPointerDown = (e: PointerEvent) => {
    this.dragging = true
    this.panning = e.button === 2 || e.shiftKey
    this.lastX = e.clientX
    this.lastY = e.clientY
    this.canvas.setPointerCapture(e.pointerId)
  }

  private onPointerMove = (e: PointerEvent) => {
    if (!this.dragging) return
    const dx = e.clientX - this.lastX
    const dy = e.clientY - this.lastY
    this.lastX = e.clientX
    this.lastY = e.clientY

    if (this.panning) {
      // pan
      const panSpeed = this.distance * 0.002
      const cosYaw = Math.cos(this.yaw), sinYaw = Math.sin(this.yaw)
      this.targetX -= (dx * cosYaw) * panSpeed
      this.targetZ += (dx * sinYaw) * panSpeed
      this.targetY += dy * panSpeed
    } else {
      // orbit
      this.yaw -= dx * 0.005
      this.pitch += dy * 0.005
      this.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.pitch))
    }
  }

  private onPointerUp = (e: PointerEvent) => {
    this.dragging = false
    this.canvas.releasePointerCapture(e.pointerId)
  }

  private onWheel = (e: WheelEvent) => {
    e.preventDefault()
    this.distance *= 1 + e.deltaY * 0.001
    this.distance = Math.max(1, Math.min(10000, this.distance))
  }

  private onContextMenu = (e: Event) => e.preventDefault()

  private bindEvents() {
    this.canvas.addEventListener('pointerdown', this.onPointerDown)
    this.canvas.addEventListener('pointermove', this.onPointerMove)
    this.canvas.addEventListener('pointerup', this.onPointerUp)
    this.canvas.addEventListener('wheel', this.onWheel, { passive: false })
    this.canvas.addEventListener('contextmenu', this.onContextMenu)
  }

  destroy() {
    this.destroyed = true
    cancelAnimationFrame(this.animId)
    this.canvas.removeEventListener('pointerdown', this.onPointerDown)
    this.canvas.removeEventListener('pointermove', this.onPointerMove)
    this.canvas.removeEventListener('pointerup', this.onPointerUp)
    this.canvas.removeEventListener('wheel', this.onWheel)
    this.canvas.removeEventListener('contextmenu', this.onContextMenu)

    for (const gm of this.gpuMeshes) {
      gm.vertexBuffer.destroy()
      gm.indexBuffer.destroy()
      gm.uniformBuffer.destroy()
    }
    this.gpuMeshes = []
    this.gridVertexBuffer?.destroy()
    this.depthTexture?.destroy()
    this.sceneUniformBuffer?.destroy()
    this.device.destroy()
  }
}
