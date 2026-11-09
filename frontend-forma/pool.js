// Growable WebGPU storage buffers. Forma re-emits whole arrays per frame, so
// buffers are reused while they fit and replaced when the scene outgrows them.
export function createStoragePool(device, usage) {
  const buffers = []
  const sizes = []
  let bufferBytes = 0

  return {
    buffers,
    update(slot, data, padded = false, force = false) {
      const bytes = Math.max(4, data.byteLength)
      let replaced = false
      if (!buffers[slot] || sizes[slot] < bytes) {
        buffers[slot]?.destroy()
        const size = Math.ceil(bytes / 256) * 256
        buffers[slot] = device.createBuffer({ size, usage })
        bufferBytes += size - (sizes[slot] ?? 0)
        sizes[slot] = size
        replaced = true
      }
      if (replaced || force || !padded) device.queue.writeBuffer(buffers[slot], 0, data)
      return replaced
    },
    snapshot() {
      return { bufferBytes, slots: buffers.length }
    },
    destroy() {
      for (const buffer of buffers) buffer?.destroy()
      buffers.length = 0
    },
  }
}
