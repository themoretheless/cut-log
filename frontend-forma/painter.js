// WebGPU transport for Forma scenes. All geometry comes from Rust as flat
// arrays; this only uploads them and runs Forma's own WGSL.
import { createStoragePool } from './pool.js'

export async function createPainter(canvas, shader) {
  if (!navigator.gpu) throw Error('WebGPU is unavailable in this browser')
  const adapter = await navigator.gpu.requestAdapter()
  if (!adapter) throw Error('No WebGPU adapter')
  const device = await adapter.requestDevice()
  const context = canvas.getContext('webgpu')
  if (!context) throw Error('WebGPU canvas context is unavailable')

  const format = navigator.gpu.getPreferredCanvasFormat()
  const module = device.createShaderModule({ code: shader, label: 'Forma vector' })
  const pipeline = await device.createRenderPipelineAsync({
    layout: 'auto',
    vertex: { module, entryPoint: 'vs' },
    fragment: { module, entryPoint: 'fs', targets: [{ format }] },
    primitive: { topology: 'triangle-list' },
  })
  context.configure({ device, format, alphaMode: 'premultiplied' })
  // viewport, fill, border and scroll: 16 floats.
  const uniform = device.createBuffer({ size: 64, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST })
  const pool = createStoragePool(device, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST)
  let bindGroup = null
  let frames = 0

  return {
    draw(model, width, height, scale) {
      let edges = model.gpu_edges(scale, false)
      if (!edges.length) edges = new Float32Array(4)
      const commands = model.gpu_commands(scale, false)
      const tiles = model.gpu_tiles(width, height, scale, false)
      const paints = model.gpu_paints()

      if (pool.update(0, commands)) bindGroup = null
      if (pool.update(1, edges)) bindGroup = null
      if (pool.update(2, tiles)) bindGroup = null
      if (pool.update(3, paints)) bindGroup = null
      if (!bindGroup) {
        bindGroup = device.createBindGroup({
          layout: pipeline.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: { buffer: uniform } },
            ...pool.buffers.map((buffer, index) => ({ binding: index + 1, resource: { buffer } })),
          ],
        })
      }
      if (canvas.width !== width) canvas.width = width
      if (canvas.height !== height) canvas.height = height
      device.queue.writeBuffer(uniform, 0, model.gpu_params(width, height, scale, false))

      const encoder = device.createCommandEncoder()
      const pass = encoder.beginRenderPass({
        colorAttachments: [{
          view: context.getCurrentTexture().createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 0 },
          loadOp: 'clear',
          storeOp: 'store',
        }],
      })
      pass.setPipeline(pipeline)
      pass.setBindGroup(0, bindGroup)
      pass.draw(3)
      pass.end()
      device.queue.submit([encoder.finish()])
      frames++
      model.release_cpu_cache?.()
      return { commands: commands.length, edges: edges.length, tiles: tiles.length, paints: paints.length }
    },
    /** Resolves once the GPU has finished the submitted work. */
    settled() {
      return device.queue.onSubmittedWorkDone()
    },
    stats() {
      return { frames, ...pool.snapshot() }
    },
  }
}
