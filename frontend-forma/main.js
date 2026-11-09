import init, { create_runtime, forma_shader, piece_list_markup, piece_list_rows, piece_row_component } from './wasm/cutter_forma_ui.js'
import { createPainter } from './painter.js'

const status = document.getElementById('status')
const canvas = document.getElementById('scene')

async function boot() {
  await init()
  const runtime = create_runtime()
  const painter = await createPainter(canvas, forma_shader())
  const scale = window.devicePixelRatio || 1
  const width = Math.round(720 * scale)
  const height = Math.round(560 * scale)

  const component = piece_row_component()
  const api = {
    runtime,
    painter,
    scale,
    width,
    height,
    /** Loads a scene of `count` rows and paints it, returning the timings. */
    async render(count, filter = '') {
      const markupStart = performance.now()
      const markup = piece_list_markup(count, filter)
      const markupMs = performance.now() - markupStart

      const loadStart = performance.now()
      runtime.load_component(markup, component)
      const loadMs = performance.now() - loadStart

      const drawStart = performance.now()
      const buffers = painter.draw(runtime, width, height, scale)
      const drawMs = performance.now() - drawStart

      await painter.settled()
      return {
        rows: piece_list_rows(count, filter),
        markupMs: round(markupMs),
        loadMs: round(loadMs),
        drawMs: round(drawMs),
        totalMs: round(markupMs + loadMs + drawMs),
        buffers,
      }
    },
  }
  const round = value => Math.round(value * 10) / 10
  window.__forma = api

  const first = await api.render(20)
  status.textContent = `Forma ready\n${JSON.stringify(first, null, 2)}`
}

boot().catch(error => {
  status.textContent = `failed: ${error?.message ?? error}\n${error?.stack ?? ''}`
})
