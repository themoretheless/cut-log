<script lang="ts">
  import NumberField from '../components/NumberField.svelte'
  import { downloadFile } from '../lib/downloadFile'
  import { useL10n } from '../stores/l10n.svelte'
  import { ANNOTATION_INDENT, skadisDxf, skadisSeam, skadisSeamIsUniform, skadisSlots, skadisSvg, snapToUniformSeam, type SkadisSettings } from '../skadis/geometry'

  const l10n = useL10n()

  const settings = $state<SkadisSettings>({
    width: 360,
    height: 560,
    cornerRadius: 8,
    slotWidth: 5,
    slotHeight: 15,
    pitch: 40,
    margin: 20,
    rowOffsetPercent: 50,
    columnOffsetPercent: 0,
  })

  let showDimensions = $state(true)
  let showTiled = $state(false)

  /** Boards in the 3x3 preview are butted flush, with no gap between them. */
  const TILE_COUNT = 3

  const slots = $derived(skadisSlots(settings))
  const isStandardGrid = $derived(settings.slotWidth === 5 && settings.slotHeight === 15 && settings.pitch === 40 && settings.rowOffsetPercent === 50 && settings.columnOffsetPercent === 0)
  const boardArea = $derived((settings.width * settings.height / 1_000_000).toFixed(3))

  /** Drawing unit scaled to the board, so annotations stay readable at any size. */
  const unit = $derived(Math.max(settings.width, settings.height) / 100)

  /**
   * Screen pixels per drawing unit, read from the live transform. It changes
   * with the zoom, the board size and the size of the preview pane, so the
   * annotation cannot be sized from the drawing alone.
   */
  let pixelsPerUnit = $state(1)
  let paneWidth = $state(0)
  let paneHeight = $state(0)

  /**
   * Annotation glyph size expressed in drawing units but pinned to a constant
   * size on screen: labels stay legible at every zoom level and on every pane
   * width, instead of shrinking to a few pixels when zoomed in. Positions still
   * follow the drawing, only the glyphs hold their size.
   */
  const ANNOTATION_PX = 7
  const glyph = $derived(ANNOTATION_PX / pixelsPerUnit)

  /**
   * Gutter reserved around the drawing for the annotation, in screen pixels.
   * The annotation itself is screen-sized, so a gutter measured in drawing
   * units would clip the labels whenever the board is large or the pane small.
   */
  const ANNOTATION_GUTTER_PX = 78
  const BARE_GUTTER_PX = 10

  /**
   * Gutter converted to drawing units. Solving it directly instead of scaling
   * a drawing-unit guess avoids a feedback loop: the gutter would change the
   * fitted scale, which would change the gutter. Reserving a fixed number of
   * screen pixels simply takes them off the viewport before fitting.
   */
  const previewPadding = $derived.by(() => {
    const box = showTiled ? tiledBounds : { left: 0, top: 0, right: settings.width, bottom: settings.height }
    const boxWidth = box.right - box.left
    const boxHeight = box.bottom - box.top
    const gutter = showDimensions ? ANNOTATION_GUTTER_PX : BARE_GUTTER_PX
    const fallback = Math.max(settings.width, settings.height) * (showDimensions ? 0.11 : 0.025)
    if (!paneWidth || !paneHeight || boxWidth <= 0 || boxHeight <= 0) return fallback
    const scale = Math.min((paneWidth - 2 * gutter) / boxWidth, (paneHeight - 2 * gutter) / boxHeight)
    if (!(scale > 0)) return fallback
    return gutter / scale
  })

  /**
   * Bounding box of the slot centres. Dimensions follow the drawing convention of
   * measuring hole positions to their centrelines, so the shown margins and pitch
   * match the entered values exactly.
   */
  const gridBounds = $derived.by(() => {
    const list = slots
    if (!list.length) return null
    const xs = list.map(slot => slot.x)
    const ys = list.map(slot => slot.y)
    return { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) }
  })

  interface Dimension {
    x1: number
    y1: number
    x2: number
    y2: number
    label: string
    labelX: number
    labelY: number
    rotate: boolean
    /** Arrows are moved outside the extension lines when the span is too short to fit them. */
    outside: boolean
  }

  const round = (value: number) => Number(value.toFixed(2)).toString()

  function horizontalDim(x1: number, x2: number, y: number, above: number, unitValue: number): Dimension {
    const outside = x2 - x1 < unitValue * 3.4
    return { x1, y1: y, x2, y2: y, label: round(x2 - x1), labelX: (x1 + x2) / 2, labelY: y - above, rotate: false, outside }
  }

  function verticalDim(y1: number, y2: number, x: number, left: number, unitValue: number): Dimension {
    const outside = y2 - y1 < unitValue * 3.4
    return { x1: x, y1, x2: x, y2, label: round(y2 - y1), labelX: x - left, labelY: (y1 + y2) / 2, rotate: true, outside }
  }

  /** Actual edge margins, from the board outline to the nearest slot centreline. */
  const marginDimensions = $derived.by<Dimension[]>(() => {
    const b = gridBounds
    if (!b) return []
    const u = glyph
    return [
      horizontalDim(0, b.left, -u * 4, u * 1.4, u),
      horizontalDim(b.right, settings.width, -u * 4, u * 1.4, u),
      verticalDim(0, b.top, -u * 4, u * 1.4, u),
      verticalDim(b.bottom, settings.height, -u * 4, u * 1.4, u),
    ].filter(dim => Math.abs(dim.x2 - dim.x1) + Math.abs(dim.y2 - dim.y1) > 1e-6)
  })

  /** Extension lines tying each margin dimension back to the feature it measures. */
  const marginExtensions = $derived.by(() => {
    const b = gridBounds
    if (!b) return []
    const u = glyph
    return [
      { x1: 0, y1: 0, x2: 0, y2: -u * 4.8 },
      { x1: b.left, y1: b.top, x2: b.left, y2: -u * 4.8 },
      { x1: b.right, y1: b.top, x2: b.right, y2: -u * 4.8 },
      { x1: settings.width, y1: 0, x2: settings.width, y2: -u * 4.8 },
      { x1: 0, y1: 0, x2: -u * 4.8, y2: 0 },
      { x1: b.left, y1: b.top, x2: -u * 4.8, y2: b.top },
      { x1: b.left, y1: b.bottom, x2: -u * 4.8, y2: b.bottom },
      { x1: 0, y1: settings.height, x2: -u * 4.8, y2: settings.height },
    ]
  })

  /** Row the inside annotations sit on, stepped in from the edge where the
   * margin dimensions already are. Small grids fall back to the first row. */
  const annotationRow = $derived.by(() => {
    const rows = [...new Set(slots.map(slot => slot.y))].sort((a, b) => a - b)
    return rows.length ? rows[Math.min(ANNOTATION_INDENT, rows.length - 1)] : null
  })

  /**
   * Centre-to-centre spacing: between the first pair of slots in the annotation
   * row (drawn on that row centreline) and between the first two rows (drawn on
   * a dimension track to the right of the board).
   */
  const pitchDimensions = $derived.by<Dimension[]>(() => {
    const b = gridBounds
    if (!b) return []
    const u = glyph
    const list = slots
    const dims: Dimension[] = []

    const row = annotationRow ?? b.top
    const rowSlots = list.filter(slot => slot.y === row).map(slot => slot.x).sort((a, c) => a - c)
    if (rowSlots.length >= 2) dims.push(horizontalDim(rowSlots[0], rowSlots[1], row, u * 1.3, u))

    const rows = [...new Set(list.map(slot => slot.y))].sort((a, c) => a - c)
    if (rows.length >= 2) dims.push(verticalDim(rows[0], rows[1], settings.width + u * 4, -u * 1.4, u))

    return dims
  })

  /** Extension lines from the first two rows out to the right-hand pitch dimension. */
  const pitchExtensions = $derived.by(() => {
    const list = slots
    if (!list.length) return []
    const u = glyph
    const rows = [...new Set(list.map(slot => slot.y))].sort((a, c) => a - c)
    if (rows.length < 2) return []
    return rows.slice(0, 2).map(y => ({
      x1: Math.max(...list.filter(slot => slot.y === y).map(slot => slot.x)),
      y1: y,
      x2: settings.width + u * 4.8,
      y2: y,
    }))
  })

  const allDimensions = $derived([...marginDimensions, ...pitchDimensions])
  const allExtensions = $derived([...marginExtensions, ...pitchExtensions])

  /**
   * Tile origins for the 3x3 preview. The centre tile sits at (0, 0) so every
   * dimension already computed against a single board stays valid as drawn.
   */
  const tiles = $derived.by(() => {
    if (!showTiled) return [{ x: 0, y: 0 }]
    const stepX = settings.width
    const stepY = settings.height
    const offset = (TILE_COUNT - 1) / 2
    const list: { x: number; y: number }[] = []
    for (let row = 0; row < TILE_COUNT; row++) {
      for (let col = 0; col < TILE_COUNT; col++) {
        list.push({ x: (col - offset) * stepX, y: (row - offset) * stepY })
      }
    }
    return list
  })

  /** Outer bounds of the whole 3x3 block, measured on the board outlines. */
  const tiledBounds = $derived.by(() => {
    const stepX = settings.width
    const stepY = settings.height
    const offset = (TILE_COUNT - 1) / 2
    return {
      left: -offset * stepX,
      right: settings.width + offset * stepX,
      top: -offset * stepY,
      bottom: settings.height + offset * stepY,
    }
  })

  /** Overall size of the assembled block, drawn at half opacity next to it. */
  const tiledDimensions = $derived.by<Dimension[]>(() => {
    if (!showTiled) return []
    const b = tiledBounds
    const u = glyph
    return [
      horizontalDim(b.left, b.right, b.top - u * 4, u * 1.4, u),
      verticalDim(b.top, b.bottom, b.left - u * 4, u * 1.4, u),
    ]
  })

  const tiledExtensions = $derived.by(() => {
    if (!showTiled) return []
    const b = tiledBounds
    const u = glyph
    return [
      { x1: b.left, y1: b.top, x2: b.left, y2: b.top - u * 4.8 },
      { x1: b.right, y1: b.top, x2: b.right, y2: b.top - u * 4.8 },
      { x1: b.left, y1: b.top, x2: b.left - u * 4.8, y2: b.top },
      { x1: b.left, y1: b.bottom, x2: b.left - u * 4.8, y2: b.bottom },
    ]
  })

  /** Slot spacing across the joint to the next board, computed by the geometry layer. */
  const seamSpacing = $derived(skadisSeam(settings))

  /** Largest board no bigger than this one whose holes stay evenly spaced. */
  const uniformSize = $derived(snapToUniformSeam(settings))
  const canSnapToUniform = $derived(
    uniformSize.width !== settings.width || uniformSize.height !== settings.height,
  )
  const seamIsUniform = $derived(skadisSeamIsUniform(settings))

  function applyUniformSize() {
    settings.width = uniformSize.width
    settings.height = uniformSize.height
  }

  const seamDimensions = $derived.by<Dimension[]>(() => {
    const s = seamSpacing
    if (!showTiled || !s) return []
    const u = glyph
    // The neighbouring boards sit exactly one board away, so the facing slot
    // is the same slot shifted by the board size.
    return [
      horizontalDim(-settings.width + s.rowRight, s.rowLeft, s.rowY, u * 1.3, u),
      verticalDim(-settings.height + s.columnBottom, s.columnTop, s.columnX, -u * 1.4, u),
    ]
  })

  const seamExtensions = $derived.by(() => {
    const s = seamSpacing
    if (!showTiled || !s) return []
    const u = glyph
    return [
      { x1: -settings.width + s.rowRight, y1: s.rowY, x2: -settings.width + s.rowRight, y2: s.rowY - u * 2.2 },
      { x1: s.rowLeft, y1: s.rowY, x2: s.rowLeft, y2: s.rowY - u * 2.2 },
      { x1: s.columnX, y1: -settings.height + s.columnBottom, x2: s.columnX - u * 2.2, y2: -settings.height + s.columnBottom },
      { x1: s.columnX, y1: s.columnTop, x2: s.columnX - u * 2.2, y2: s.columnTop },
    ]
  })

  /** The fitted view: every tile plus the annotation gutter, at zoom 1. */
  const baseView = $derived.by(() => {
    const pad = previewPadding
    const b = showTiled
      ? tiledBounds
      : { left: 0, top: 0, right: settings.width, bottom: settings.height }
    return {
      x: b.left - pad,
      y: b.top - pad,
      w: b.right - b.left + pad * 2,
      h: b.bottom - b.top + pad * 2,
    }
  })

  const MIN_ZOOM = 1
  const MAX_ZOOM = 24
  let zoom = $state(1)
  let panX = $state(0)
  let panY = $state(0)
  let svgEl: SVGSVGElement | null = $state(null)
  let panning = $state(false)
  let pointerId: number | null = null
  let lastClient = { x: 0, y: 0 }

  const isFitted = $derived(zoom === 1 && panX === 0 && panY === 0)

  const view = $derived.by(() => {
    const b = baseView
    const w = b.w / zoom
    const h = b.h / zoom
    return { x: b.x + b.w / 2 + panX - w / 2, y: b.y + b.h / 2 + panY - h / 2, w, h }
  })

  const viewBox = $derived(`${view.x} ${view.y} ${view.w} ${view.h}`)

  // Re-read the transform whenever the view or the pane changes, so the
  // annotation keeps its on-screen size in every case.
  $effect(() => {
    const el = svgEl
    void viewBox
    if (!el) return
    const sync = () => {
      const scale = el.getScreenCTM()?.a
      if (scale && Number.isFinite(scale) && scale > 0) pixelsPerUnit = scale
      if (el.clientWidth > 0 && el.clientHeight > 0) {
        paneWidth = el.clientWidth
        paneHeight = el.clientHeight
      }
    }
    sync()
    const observer = new ResizeObserver(sync)
    observer.observe(el)
    return () => observer.disconnect()
  })

  function resetView() {
    zoom = 1
    panX = 0
    panY = 0
  }

  /**
   * Keeps the visible window inside the fitted view, so the board cannot be
   * dragged off screen leaving an empty pane with no way back but the reset.
   */
  function clampPan() {
    const b = baseView
    const limitX = Math.max(0, (b.w - b.w / zoom) / 2)
    const limitY = Math.max(0, (b.h - b.h / zoom) / 2)
    panX = Math.min(limitX, Math.max(-limitX, panX))
    panY = Math.min(limitY, Math.max(-limitY, panY))
  }

  /** Screen point to user units, so zooming can keep the cursor anchored. */
  function toUserSpace(clientX: number, clientY: number) {
    if (!svgEl) return null
    const ctm = svgEl.getScreenCTM()
    if (!ctm) return null
    const point = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse())
    return { x: point.x, y: point.y }
  }

  /** Zooms about a screen point; without one, about the centre of the view. */
  function zoomBy(factor: number, clientX?: number, clientY?: number) {
    const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * factor))
    if (next === zoom) return
    const anchor = clientX != null && clientY != null ? toUserSpace(clientX, clientY) : null
    const b = baseView
    if (!anchor) {
      zoom = next
      if (next === MIN_ZOOM) { panX = 0; panY = 0 }
      return
    }
    // Keep the anchored point still: solve the new centre from the new size.
    const before = view
    const fx = (anchor.x - before.x) / before.w
    const fy = (anchor.y - before.y) / before.h
    const w = b.w / next
    const h = b.h / next
    const x = anchor.x - fx * w
    const y = anchor.y - fy * h
    zoom = next
    panX = x + w / 2 - (b.x + b.w / 2)
    panY = y + h / 2 - (b.y + b.h / 2)
    if (next === MIN_ZOOM) { panX = 0; panY = 0 }
    else clampPan()
  }

  function onWheel(event: WheelEvent) {
    // A plain wheel must keep scrolling the page: hijacking it traps the
    // reader as soon as the pointer crosses the preview. Zooming takes the
    // modifier, which is also how a trackpad pinch arrives (ctrlKey set, with
    // much finer deltas than a mouse wheel notch).
    if (!event.ctrlKey && !event.metaKey) return
    event.preventDefault()
    // A trackpad pinch streams many small deltas, a mouse wheel sends one
    // coarse notch. Feeding a notch through the exponential would jump 2.7x at
    // a time, so coarse deltas get a fixed, gentler step.
    const fine = Math.abs(event.deltaY) < 50
    const factor = fine
      ? Math.exp(-event.deltaY / 100)
      : event.deltaY < 0 ? 1.2 : 1 / 1.2
    zoomBy(factor, event.clientX, event.clientY)
  }

  /** Live touch points, so two of them can be read as a pinch. */
  const activePointers = new Map<number, { x: number; y: number }>()
  let pinchDistance = 0

  function pinchState() {
    const [a, b] = [...activePointers.values()]
    return {
      distance: Math.hypot(a.x - b.x, a.y - b.y),
      midX: (a.x + b.x) / 2,
      midY: (a.y + b.y) / 2,
    }
  }

  function onPointerDown(event: PointerEvent) {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
    svgEl?.setPointerCapture(event.pointerId)

    if (activePointers.size === 2) {
      panning = false
      pointerId = null
      pinchDistance = pinchState().distance
      return
    }
    if (activePointers.size === 1 && zoom > MIN_ZOOM) {
      panning = true
      pointerId = event.pointerId
      lastClient = { x: event.clientX, y: event.clientY }
    }
  }

  function onPointerMove(event: PointerEvent) {
    if (!svgEl) return
    if (activePointers.has(event.pointerId)) {
      activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
    }

    if (activePointers.size === 2) {
      const { distance, midX, midY } = pinchState()
      if (pinchDistance > 0 && distance > 0) zoomBy(distance / pinchDistance, midX, midY)
      pinchDistance = distance
      return
    }

    if (!panning || event.pointerId !== pointerId) return
    const scale = svgEl.getScreenCTM()?.a ?? 1
    panX -= (event.clientX - lastClient.x) / scale
    panY -= (event.clientY - lastClient.y) / scale
    clampPan()
    lastClient = { x: event.clientX, y: event.clientY }
  }

  function endPan(event: PointerEvent) {
    activePointers.delete(event.pointerId)
    svgEl?.releasePointerCapture(event.pointerId)
    if (activePointers.size < 2) pinchDistance = 0
    // Dropping from three fingers to two leaves a distance measured between a
    // pair that no longer exists, which would jump the zoom on the next move.
    else pinchDistance = pinchState().distance
    if (event.pointerId === pointerId) {
      panning = false
      pointerId = null
    }
    // A finger lifted from a pinch leaves one down: hand it back to panning.
    if (activePointers.size === 1 && zoom > MIN_ZOOM) {
      const [id] = [...activePointers.keys()]
      const point = activePointers.get(id)!
      panning = true
      pointerId = id
      lastClient = { x: point.x, y: point.y }
    }
  }

  /** Keyboard zoom, active while the preview has focus. */
  function onKeydown(event: KeyboardEvent) {
    if (event.metaKey || event.ctrlKey || event.altKey) return
    const panStep = 0.12
    switch (event.key) {
      case '+': case '=': zoomBy(1.4); break
      case '-': case '_': zoomBy(1 / 1.4); break
      case '0': resetView(); break
      // While fitted there is nothing to pan, and swallowing the key would
      // stop the page from scrolling for no action.
      case 'ArrowLeft': if (zoom === MIN_ZOOM) return; panX -= view.w * panStep; clampPan(); break
      case 'ArrowRight': if (zoom === MIN_ZOOM) return; panX += view.w * panStep; clampPan(); break
      case 'ArrowUp': if (zoom === MIN_ZOOM) return; panY -= view.h * panStep; clampPan(); break
      case 'ArrowDown': if (zoom === MIN_ZOOM) return; panY += view.h * panStep; clampPan(); break
      default: return
    }
    event.preventDefault()
  }

  /** Dimension line segments; short spans get a pair of stubs with arrows pointing inwards. */
  function dimLines(dim: Dimension) {
    const stub = glyph * 2.4
    if (!dim.outside) {
      return [{ x1: dim.x1, y1: dim.y1, x2: dim.x2, y2: dim.y2, start: true }]
    }
    if (dim.rotate) {
      return [
        { x1: dim.x1, y1: dim.y1 - stub, x2: dim.x1, y2: dim.y1, start: false },
        { x1: dim.x2, y1: dim.y2 + stub, x2: dim.x2, y2: dim.y2, start: false },
      ]
    }
    return [
      { x1: dim.x1 - stub, y1: dim.y1, x2: dim.x1, y2: dim.y1, start: false },
      { x1: dim.x2 + stub, y1: dim.y2, x2: dim.x2, y2: dim.y2, start: false },
    ]
  }

  function applyPreset(width: number, height: number) {
    settings.width = width
    settings.height = height
  }

  function fileStem() {
    return `skadis-${settings.width}x${settings.height}`.replace(/[^a-z0-9.-]+/gi, '-')
  }

  function downloadSvg() {
    downloadFile(`${fileStem()}.svg`, skadisSvg(settings), 'image/svg+xml')
  }

  function downloadDxf() {
    downloadFile(`${fileStem()}.dxf`, skadisDxf(settings), 'application/dxf')
  }
</script>

<div class="app-container skadis-page">
  <header class="app-header">
    <h1>{l10n.t('skadis.title')}</h1>
    <p class="subtitle">{l10n.t('skadis.subtitle')}</p>
  </header>

  <div class="main-layout">
    <aside class="panel panel-input">
      <section class="card">
        <h2>{l10n.t('skadis.board')}</h2>
        <div class="preset-grid">
          <button type="button" class="preset-button" onclick={() => applyPreset(560, 560)}>560 × 560</button>
          <button type="button" class="preset-button" onclick={() => applyPreset(760, 560)}>760 × 560</button>
          <button type="button" class="preset-button" onclick={() => applyPreset(720, 720)}>720 × 720</button>
        </div>
        <div class="form-row"><label for="skadis-width">{l10n.t('width_mm')}</label><NumberField id="skadis-width" ariaLabel={l10n.t('width_mm')} value={settings.width} onUpdate={(v) => { settings.width = v }} min={40} max={3000} step={10} /></div>
        <div class="form-row"><label for="skadis-height">{l10n.t('height_mm')}</label><NumberField id="skadis-height" ariaLabel={l10n.t('height_mm')} value={settings.height} onUpdate={(v) => { settings.height = v }} min={40} max={3000} step={10} /></div>
        <div class="form-row"><label for="skadis-radius">{l10n.t('skadis.corner_radius')}</label><NumberField id="skadis-radius" ariaLabel={l10n.t('skadis.corner_radius')} value={settings.cornerRadius} onUpdate={(v) => { settings.cornerRadius = v }} min={0} max={100} step={1} /></div>
        {#if canSnapToUniform}
          <button
            type="button"
            class="snap-button"
            onclick={applyUniformSize}
            title={l10n.t('skadis.snap_uniform_hint')}
          >
            <span>{l10n.t('skadis.snap_uniform')}</span>
            <span class="snap-target">{uniformSize.width} × {uniformSize.height}</span>
          </button>
        {:else}
          <p class={['snap-state', seamIsUniform ? 'is-ok' : 'is-blocked']}>
            <span aria-hidden="true">{seamIsUniform ? '✓' : '!'}</span>
            {seamIsUniform ? l10n.t('skadis.snap_uniform_ok') : l10n.t('skadis.snap_uniform_none')}
          </p>
        {/if}
      </section>

      <section class="card">
        <h2>{l10n.t('skadis.grid')}</h2>
        <div class="form-row"><label for="skadis-slot-width">{l10n.t('skadis.slot_width')}</label><NumberField id="skadis-slot-width" ariaLabel={l10n.t('skadis.slot_width')} value={settings.slotWidth} onUpdate={(v) => { settings.slotWidth = v }} min={1} max={20} step={0.1} /></div>
        <div class="form-row"><label for="skadis-slot-height">{l10n.t('skadis.slot_height')}</label><NumberField id="skadis-slot-height" ariaLabel={l10n.t('skadis.slot_height')} value={settings.slotHeight} onUpdate={(v) => { settings.slotHeight = v }} min={1} max={40} step={0.1} /></div>
        <div class="form-row"><label for="skadis-pitch">{l10n.t('skadis.pitch')}</label><NumberField id="skadis-pitch" ariaLabel={l10n.t('skadis.pitch')} value={settings.pitch} onUpdate={(v) => { settings.pitch = v }} min={10} max={100} step={1} /></div>
        <div class="form-row"><label for="skadis-margin">{l10n.t('skadis.margin')}</label><NumberField id="skadis-margin" ariaLabel={l10n.t('skadis.margin')} value={settings.margin} onUpdate={(v) => { settings.margin = v }} min={0} max={200} step={1} /></div>
        <div class="form-row"><label for="skadis-row-offset">{l10n.t('skadis.row_offset')}</label><NumberField id="skadis-row-offset" ariaLabel={l10n.t('skadis.row_offset')} value={settings.rowOffsetPercent} onUpdate={(v) => { settings.rowOffsetPercent = v }} min={0} max={100} step={1} /></div>
        <div class="form-row"><label for="skadis-column-offset">{l10n.t('skadis.column_offset')}</label><NumberField id="skadis-column-offset" ariaLabel={l10n.t('skadis.column_offset')} value={settings.columnOffsetPercent} onUpdate={(v) => { settings.columnOffsetPercent = v }} min={0} max={100} step={1} /></div>
        <p class={['compatibility', isStandardGrid ? 'is-compatible' : 'is-custom']}>
          <span aria-hidden="true">{isStandardGrid ? '✓' : '!'}</span>
          {isStandardGrid ? l10n.t('skadis.compatible') : l10n.t('skadis.custom_warning')}
        </p>
      </section>
    </aside>

    <main class="panel panel-result">
      <section class="card preview-card">
        <div class="card-head">
          <h2>{l10n.t('skadis.preview')}</h2>
          <div class="head-actions">
            <label class="check-row"><input type="checkbox" bind:checked={showDimensions}> {l10n.t('skadis.dimensions')}</label>
            <label class="check-row"><input type="checkbox" bind:checked={showTiled}> {l10n.t('skadis.tiled')}</label>
            <span class="slot-count">{slots.length} {l10n.t('skadis.slots')}</span>
            <div class="zoom-controls">
              <button type="button" class="btn btn-ghost btn-square" onclick={() => zoomBy(1 / 1.4)} disabled={zoom <= MIN_ZOOM} title={l10n.t('skadis.zoom_out')} aria-label={l10n.t('skadis.zoom_out')}>&minus;</button>
              <span class="zoom-level">{Math.round(zoom * 100)}%</span>
              <button type="button" class="btn btn-ghost btn-square" onclick={() => zoomBy(1.4)} disabled={zoom >= MAX_ZOOM} title={l10n.t('skadis.zoom_in')} aria-label={l10n.t('skadis.zoom_in')}>+</button>
              <button type="button" class="btn btn-ghost" onclick={resetView} disabled={isFitted} title={l10n.t('skadis.zoom_reset')}>{l10n.t('skadis.zoom_reset')}</button>
            </div>
          </div>
        </div>
        <!--
          A zoom and pan viewport is a composite widget the a11y rules cannot
          classify: it has no native element, yet it must take focus so the
          keyboard shortcuts below work without a mouse or a touch screen.
        -->
        <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
        <div
          class="board-preview"
          role="application"
          tabindex="0"
          aria-label={l10n.t('skadis.zoom_hint')}
          onkeydown={onKeydown}
        >
          <svg
            bind:this={svgEl}
            viewBox={viewBox}
            role="img"
            aria-label={l10n.t('skadis.preview_label')}
            class:zoomed={zoom > 1}
            class:panning
            onwheel={onWheel}
            onpointerdown={onPointerDown}
            onpointermove={onPointerMove}
            onpointerup={endPan}
            onpointercancel={endPan}
          >
            <defs>
              <marker id="dim-arrow" markerWidth={glyph * 1.6} markerHeight={glyph * 1.1} refX={glyph * 1.5} refY={glyph * 0.55} orient="auto" markerUnits="userSpaceOnUse">
                <path class="dim-arrowhead" d={`M0,0 L${glyph * 1.6},${glyph * 0.55} L0,${glyph * 1.1} z`} />
              </marker>
              <marker id="dim-arrow-start" markerWidth={glyph * 1.6} markerHeight={glyph * 1.1} refX={glyph * 0.1} refY={glyph * 0.55} orient="auto" markerUnits="userSpaceOnUse">
                <path class="dim-arrowhead" d={`M${glyph * 1.6},0 L0,${glyph * 0.55} L${glyph * 1.6},${glyph * 1.1} z`} />
              </marker>
            </defs>

            {#each tiles as tile, tileIndex (tileIndex)}
              <g transform={`translate(${tile.x} ${tile.y})`}>
                <rect class="board-shadow" x="3" y="5" width={settings.width} height={settings.height} rx={settings.cornerRadius} />
                <rect class="board-shape" x="0" y="0" width={settings.width} height={settings.height} rx={settings.cornerRadius} />
                {#each slots as slot, index (index)}
                  <rect
                    class="board-slot"
                    x={slot.x - settings.slotWidth / 2}
                    y={slot.y - settings.slotHeight / 2}
                    width={settings.slotWidth}
                    height={settings.slotHeight}
                    rx={Math.min(settings.slotWidth, settings.slotHeight) / 2}
                  />
                {/each}
              </g>
            {/each}

            {#if showTiled && showDimensions}
              <g class="dim-layer dim-layer-total">
                {#each tiledExtensions as line, index (`total-ext-${index}`)}
                  <line
                    class="dim-extension"
                    x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2}
                  />
                {/each}
                {#each tiledDimensions as dim, index (`total-dim-${index}`)}
                  <g>
                    {#each dimLines(dim) as line, part (part)}
                      <line
                        class="dim-line"
                        x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2}
                        marker-start={line.start ? 'url(#dim-arrow-start)' : undefined}
                        marker-end="url(#dim-arrow)"
                      />
                    {/each}
                    <text
                      class="dim-label"
                      x={dim.labelX}
                      y={dim.labelY}
                      font-size={glyph * 2.6}
                      transform={dim.rotate ? `rotate(-90 ${dim.labelX} ${dim.labelY})` : undefined}
                    >{dim.label}</text>
                  </g>
                {/each}
              </g>

              <!-- Slot spacing across the joint, in the same drawing style. -->
              <g class="dim-layer dim-layer-seam" class:mismatch={!!seamSpacing && (seamSpacing.horizontal !== settings.pitch || seamSpacing.vertical !== settings.pitch)}>
                {#each seamExtensions as line, index (`seam-ext-${index}`)}
                  <line
                    class="dim-extension"
                    x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2}
                  />
                {/each}
                {#each seamDimensions as dim, index (`seam-dim-${index}`)}
                  <g>
                    {#each dimLines(dim) as line, part (part)}
                      <line
                        class="dim-line"
                        x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2}
                        marker-start={line.start ? 'url(#dim-arrow-start)' : undefined}
                        marker-end="url(#dim-arrow)"
                      />
                    {/each}
                    <text
                      class="dim-label"
                      x={dim.labelX}
                      y={dim.labelY}
                      font-size={glyph * 2.6}
                      transform={dim.rotate ? `rotate(-90 ${dim.labelX} ${dim.labelY})` : undefined}
                    >{dim.label}</text>
                  </g>
                {/each}
              </g>
            {/if}

            <!-- Single-board details need the outside gutter, which the tiled view
                 gives to the neighbouring boards, so they are shown alone. -->
            {#if showDimensions && !showTiled && gridBounds}
              <g class="dim-layer">
                <rect
                  class="dim-margin-box"
                  x={gridBounds.left}
                  y={gridBounds.top}
                  width={gridBounds.right - gridBounds.left}
                  height={gridBounds.bottom - gridBounds.top}
                  stroke-dasharray={`${glyph * 1.4} ${glyph}`}
                />

                {#each allExtensions as line, index (`ext-${index}`)}
                  <line
                    class="dim-extension"
                    x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2}
                  />
                {/each}

                {#each allDimensions as dim, index (`dim-${index}`)}
                  <g>
                    {#each dimLines(dim) as line, part (part)}
                      <line
                        class="dim-line"
                        x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2}
                        marker-start={line.start ? 'url(#dim-arrow-start)' : undefined}
                        marker-end="url(#dim-arrow)"
                      />
                    {/each}
                    <text
                      class="dim-label"
                      x={dim.labelX}
                      y={dim.labelY}
                      font-size={glyph * 2.6}
                      transform={dim.rotate ? `rotate(-90 ${dim.labelX} ${dim.labelY})` : undefined}
                    >{dim.label}</text>
                  </g>
                {/each}
              </g>
            {/if}
          </svg>
        </div>
        <div class="board-stats">
          <div><span>{l10n.t('skadis.size')}</span><strong>{settings.width} × {settings.height} mm</strong></div>
          <div><span>{l10n.t('skadis.area')}</span><strong>{boardArea} m²</strong></div>
          <div><span>{l10n.t('skadis.slot_size')}</span><strong>{settings.slotWidth} × {settings.slotHeight} mm</strong></div>
        </div>
      </section>

      <section class="card export-card">
        <div>
          <h2>{l10n.t('skadis.export')}</h2>
          <p>{l10n.t('skadis.export_hint')}</p>
        </div>
        <div class="export-actions">
          <button type="button" class="btn-primary" onclick={downloadSvg}>↓ SVG</button>
          <button type="button" class="btn-dl export-dxf" onclick={downloadDxf}>↓ DXF</button>
        </div>
      </section>
    </main>
  </div>
</div>

<style>
/* Shown only when it can act, and styled to read as a real control: as a
   disabled ghost it was invisible against the card in the default state,
   which is exactly the state most boards start in. */
.snap-button { width: 100%; margin-top: 14px; padding: 9px 12px; display: flex; align-items: center; justify-content: center; gap: 8px;
  border: 1px solid var(--accent); border-radius: 8px; background: color-mix(in srgb, var(--accent) 12%, transparent);
  color: var(--accent); font: inherit; font-weight: 600; font-size: .84rem; cursor: pointer; }
.snap-button:hover { background: color-mix(in srgb, var(--accent) 22%, transparent); }
.snap-target { color: inherit; opacity: .8; font-variant-numeric: tabular-nums; font-weight: 500; }
.snap-state.is-blocked { color: var(--alert-warn-tx); }
.snap-state { margin-top: 14px; display: flex; align-items: center; gap: 7px; color: var(--muted); font-size: .78rem; line-height: 1.35; }
.preset-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-bottom: 14px; }
.preset-button { padding: 7px 4px; border: 1px solid var(--border-input); border-radius: 6px; background: var(--input-bg); color: var(--text); cursor: pointer; font-size: .75rem; }
.preset-button:hover { border-color: var(--accent); }
.check-row { display: flex; align-items: center; gap: 9px; margin-top: 12px; color: var(--text); font-size: .84rem; cursor: pointer; }
.check-row input { accent-color: var(--accent); width: 16px; height: 16px; }
.compatibility { display: flex; gap: 8px; align-items: flex-start; margin-top: 14px; padding: 9px 10px; border-radius: 6px; font-size: .78rem; line-height: 1.4; }
.compatibility span { display: grid; place-items: center; flex: 0 0 18px; height: 18px; border-radius: 50%; font-weight: 800; }
.is-compatible { color: var(--eff-good-tx); background: var(--eff-good-bg); }
.is-compatible span { border: 1px solid currentColor; }
.is-custom { color: var(--alert-warn-tx); background: var(--alert-warn-bg); border: 1px solid var(--alert-warn-bd); }
.is-custom span { border: 1px solid currentColor; }
.preview-card { min-height: 560px; }
.slot-count { color: var(--accent); font-size: .8rem; font-weight: 600; }
.board-preview { height: min(62vh, 610px); min-height: 390px; display: grid; place-items: center; overflow: hidden; border: 1px solid var(--border); border-radius: 10px; background: var(--svg-bg); }
.board-preview svg { width: 100%; height: 100%; }
.board-shadow { fill: rgba(0,0,0,.28); }
.board-shape { fill: var(--piece-bg); stroke: var(--heading); stroke-width: 1.5; }
.board-slot { fill: var(--bg); stroke: var(--border-input); stroke-width: .35; }
/* The head carries the title, two toggles, the slot count and the zoom
   controls, which stops fitting on one line well before the mobile
   breakpoint, so both rows are allowed to wrap. */
.card-head { flex-wrap: wrap; gap: 8px 14px; }
.head-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 14px; }
.head-actions .check-row { margin-top: 0; font-size: .78rem; color: var(--muted); white-space: nowrap; }
.head-actions .check-row input { width: 14px; height: 14px; }
/* The markers live in <defs> outside the dimension groups, so --dim has to be
   declared on the svg itself: a custom property set on .dim-layer would not
   reach them, and fill: var(--dim) would fall back to black. */
.board-preview svg { --dim: #e8842a; }
/* The whole annotation sits at half opacity: it has to stay readable over the
   slots without competing with the geometry it measures. Every layer shares
   the value, so the total-size dimensions no longer need their own. */
.dim-layer { --dim: #e8842a; opacity: .5; }
/* A seam that breaks the pattern is the one number worth interrupting for, so
   it swaps to the warning colour while keeping the shared half opacity. */
.dim-layer-seam.mismatch { --dim: var(--alert-warn-tx); }
.zoom-controls { display: flex; align-items: center; gap: 4px; }
.zoom-level { min-width: 3.4em; text-align: center; color: var(--muted); font-size: .8rem; font-variant-numeric: tabular-nums; }
.board-preview svg { touch-action: none; }
.board-preview svg.zoomed { cursor: grab; }
.board-preview svg.panning { cursor: grabbing; }
.board-preview:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
/* context-stroke makes each arrowhead take the colour of the line that
   references it, so the warning-coloured seam keeps matching arrows from one
   shared marker. The var() line is the fallback where it is unsupported. */
.dim-arrowhead { fill: var(--dim); fill: context-stroke; }
/* Dimension strokes are screen-space hairlines: non-scaling-stroke keeps them
   the same weight at every zoom level, so zooming reveals detail instead of
   fattening the annotation over the geometry it measures. */
.dim-margin-box { fill: none; stroke: var(--dim); stroke-width: 1; vector-effect: non-scaling-stroke; }
.dim-extension { stroke: var(--dim); opacity: .55; stroke-width: .75; vector-effect: non-scaling-stroke; }
.dim-line { stroke: var(--dim); stroke-width: 1; vector-effect: non-scaling-stroke; }
.dim-label { fill: var(--dim); text-anchor: middle; font-weight: 600; paint-order: stroke; stroke: var(--svg-bg); stroke-width: .3em; stroke-linejoin: round; }
.board-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 14px; }
.board-stats div { display: flex; flex-direction: column; gap: 3px; padding: 10px 12px; border-radius: 7px; background: var(--input-bg); }
.board-stats span { color: var(--muted); font-size: .72rem; }
.board-stats strong { color: var(--text); font-size: .86rem; }
.export-card { display: flex; align-items: center; justify-content: space-between; gap: 20px; }
.export-card h2 { margin-bottom: 5px; }
.export-card p { color: var(--muted); font-size: .8rem; line-height: 1.45; }
.export-actions { display: flex; gap: 8px; flex-shrink: 0; }
.export-dxf { padding: 8px 16px; font-size: .82rem; }
@media (max-width: 620px) {
  .board-stats { grid-template-columns: 1fr; }
  .export-card { align-items: stretch; flex-direction: column; }
  .export-actions > button { flex: 1; }
  .board-preview { min-height: 320px; height: 55vh; }
}
</style>
