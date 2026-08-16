export interface SkadisSettings {
  width: number
  height: number
  cornerRadius: number
  slotWidth: number
  slotHeight: number
  pitch: number
  margin: number
  /** Horizontal offset applied to every second row, as a percentage of pitch. */
  rowOffsetPercent: number
  /** Vertical offset applied to every second column, as a percentage of pitch. */
  columnOffsetPercent: number
}

export interface SkadisSlot {
  x: number
  y: number
}

const fmt = (value: number) => Number(value.toFixed(3)).toString()
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/**
 * Positions of one axis for both parities, centred inside [min, max] so the
 * leftover space is split evenly between the two edges instead of piling up
 * against the far one. `offset` shifts the odd parity, so the two lattices are
 * centred as a single pattern to keep the stagger intact.
 */
function axisPositions(min: number, max: number, pitch: number, offset: number): { even: number[]; odd: number[] } {
  const span = max - min
  if (span < -1e-9) return { even: [], odd: [] }

  const evenCount = Math.floor(span / pitch + 1e-9) + 1
  const oddCount = span - offset >= -1e-9 ? Math.floor((span - offset) / pitch + 1e-9) + 1 : 0
  const used = Math.max((evenCount - 1) * pitch, oddCount > 0 ? offset + (oddCount - 1) * pitch : 0)
  const start = min + (span - used) / 2

  return {
    even: Array.from({ length: evenCount }, (_, index) => start + index * pitch),
    odd: Array.from({ length: oddCount }, (_, index) => start + offset + index * pitch),
  }
}

export function skadisSlots(settings: SkadisSettings): SkadisSlot[] {
  const { width, height, slotWidth, slotHeight, pitch, margin, rowOffsetPercent, columnOffsetPercent } = settings
  if (![width, height, slotWidth, slotHeight, pitch, margin, rowOffsetPercent, columnOffsetPercent].every(Number.isFinite)) return []
  if (width <= 0 || height <= 0 || slotWidth <= 0 || slotHeight <= 0 || pitch <= 0 || margin < 0) return []

  const slots: SkadisSlot[] = []
  const occupied = new Set<string>()
  const halfW = slotWidth / 2
  const halfH = slotHeight / 2
  const xMin = Math.max(margin, halfW)
  const xMax = Math.min(width - margin, width - halfW)
  const yMin = Math.max(margin, halfH)
  const yMax = Math.min(height - margin, height - halfH)
  const secondRowOffset = pitch * clamp(rowOffsetPercent, 0, 100) / 100
  const secondColumnOffset = pitch * clamp(columnOffsetPercent, 0, 100) / 100

  const xs = axisPositions(xMin, xMax, pitch, secondRowOffset)
  const ys = axisPositions(yMin, yMax, pitch, secondColumnOffset)

  const rowCount = Math.max(ys.even.length, ys.odd.length)
  for (let row = 0; row < rowCount; row += 1) {
    const columns = row % 2 === 1 ? xs.odd : xs.even
    for (let column = 0; column < columns.length; column += 1) {
      const y = (column % 2 === 1 ? ys.odd : ys.even)[row]
      if (y === undefined) continue
      const x = columns[column]
      const key = `${fmt(x)}:${fmt(y)}`
      if (occupied.has(key)) continue
      occupied.add(key)
      slots.push({ x, y })
    }
  }
  return slots
}

export interface SkadisSeam {
  /**
   * Distance between the closest facing slots of two boards butted side by
   * side, measured along one row. Rows are staggered, so the grid bounding box
   * would span two phases and describe a pair of slots that never face each
   * other across the joint.
   */
  horizontal: number
  /** The same measurement down a column, across a horizontal joint. */
  vertical: number
  /**
   * Spacing the pattern itself keeps along the measured line. A staggered grid
   * only fills every other row of a column, so a column steps by twice the
   * pitch while a row steps by the pitch: the joint continues the pattern when
   * the gap matches this, not when it matches the pitch.
   */
  horizontalStep: number
  verticalStep: number
  /** The row the horizontal measurement is drawn on, and its end slots. */
  rowY: number
  rowLeft: number
  rowRight: number
  /** The column the vertical measurement is drawn on, and its end slots. */
  columnX: number
  columnTop: number
  columnBottom: number
}

/**
 * Rows and columns carrying a single-board annotation are stepped this far in
 * from the edge, so the line does not sit on the outermost holes where the
 * margin dimensions already are. Smaller grids fall back to whatever fits.
 */
export const ANNOTATION_INDENT = 2

/**
 * Picks the middle entry. Joint measurements hang here rather than near a
 * corner, where the two joints and their annotations would pile up.
 */
function middle<T>(values: T[]): T {
  return values[Math.floor((values.length - 1) / 2)]
}

interface Line {
  /** Position of the line itself: the row's y, or the column's x. */
  at: number
  /** Slot positions along it, ascending. */
  positions: number[]
  /** Distance to the facing slot on the next board. */
  gap: number
  /** Distance between neighbouring slots on this line. */
  step: number
}

/** Groups slots into lines and measures each one across the joint. */
function lines(slots: SkadisSlot[], along: 'x' | 'y', span: number): Line[] {
  const grouped = new Map<number, number[]>()
  for (const slot of slots) {
    const key = along === 'x' ? slot.y : slot.x
    const value = along === 'x' ? slot.x : slot.y
    const line = grouped.get(key)
    if (line) line.push(value)
    else grouped.set(key, [value])
  }

  return [...grouped.entries()]
    .map(([at, values]) => {
      const positions = [...values].sort((a, b) => a - b)
      const first = positions[0]
      const last = positions[positions.length - 1]
      const gap = span - last + first
      // A line holding a single slot has no spacing of its own, so the gap is
      // the only distance there is and the joint cannot disagree with it.
      const step = positions.length > 1 ? positions[1] - first : gap
      return { at, positions, gap, step }
    })
    .sort((a, b) => a.at - b.at)
}

/** The line where the boards come closest, drawn away from the corners. */
function tightest(all: Line[]): Line {
  const smallest = Math.min(...all.map(line => line.gap))
  return middle(all.filter(line => Math.abs(line.gap - smallest) < 1e-6))
}

/**
 * Slot spacing across the joint between two butted boards, per axis, together
 * with the spacing the pattern keeps along the same line.
 */
export function skadisSeam(settings: SkadisSettings): SkadisSeam | null {
  const slots = skadisSlots(settings)
  if (!slots.length) return null

  const row = tightest(lines(slots, 'x', settings.width))
  const column = tightest(lines(slots, 'y', settings.height))

  return {
    horizontal: row.gap,
    vertical: column.gap,
    horizontalStep: row.step,
    verticalStep: column.step,
    rowY: row.at,
    rowLeft: row.positions[0],
    rowRight: row.positions[row.positions.length - 1],
    columnX: column.at,
    columnTop: column.positions[0],
    columnBottom: column.positions[column.positions.length - 1],
  }
}

/**
 * True when the holes carry on across both joints at the spacing the pattern
 * uses inside the board. Comparing against the pitch instead would call a
 * staggered board broken, since a column of a staggered grid steps by twice
 * the pitch by construction.
 */
export function skadisSeamIsUniform(settings: SkadisSettings): boolean {
  const seam = skadisSeam(settings)
  if (!seam) return false
  return Math.abs(seam.horizontal - seam.horizontalStep) < 1e-6
    && Math.abs(seam.vertical - seam.verticalStep) < 1e-6
}

/**
 * Largest board no bigger than the current one whose holes stay evenly spaced
 * both inside the board and across the joint to the next one.
 *
 * The layout repeats along a line every step that line uses, which is the
 * pitch for a row but twice the pitch for a column of a row-staggered grid, so
 * the search window is taken from the line rather than from the pitch: a
 * pitch-wide window would walk straight past the answer on the staggered axis.
 *
 * Both axes must land, otherwise the caller would offer a board that is still
 * not uniform; when one axis has no answer the size is returned unchanged.
 */
export function snapToUniformSeam(settings: SkadisSettings): { width: number; height: number } {
  const { pitch } = settings
  if (!Number.isFinite(pitch) || pitch <= 0) return { width: settings.width, height: settings.height }
  const current = skadisSeam(settings)

  const search = (axis: 'width' | 'height') => {
    const size = settings[axis]
    const lineStep = axis === 'width' ? current?.horizontalStep : current?.verticalStep
    const period = Math.max(pitch, Number.isFinite(lineStep) ? (lineStep as number) : pitch)
    const window = Math.ceil(period)
    for (let candidate = Math.floor(size); candidate > size - window - 1; candidate -= 1) {
      if (candidate <= 0) break
      const seam = skadisSeam({ ...settings, [axis]: candidate })
      if (!seam) continue
      const gap = axis === 'width' ? seam.horizontal : seam.vertical
      const step = axis === 'width' ? seam.horizontalStep : seam.verticalStep
      if (Math.abs(gap - step) < 1e-6) return candidate
    }
    return null
  }

  const width = search('width')
  const height = search('height')
  if (width == null || height == null) return { width: settings.width, height: settings.height }
  return { width, height }
}

export function skadisSvg(settings: SkadisSettings): string {
  const { width, height, cornerRadius, slotWidth, slotHeight } = settings
  const radius = Math.max(0, Math.min(cornerRadius, width / 2, height / 2))
  const slotRadius = Math.min(slotWidth, slotHeight) / 2
  const slots = skadisSlots(settings)
    .map(({ x, y }) => `    <rect x="${fmt(x - slotWidth / 2)}" y="${fmt(y - slotHeight / 2)}" width="${fmt(slotWidth)}" height="${fmt(slotHeight)}" rx="${fmt(slotRadius)}" />`)
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${fmt(width)}mm" height="${fmt(height)}mm" viewBox="0 0 ${fmt(width)} ${fmt(height)}">
  <g fill="none" stroke="#ff0000" stroke-width="0.1">
    <rect x="0" y="0" width="${fmt(width)}" height="${fmt(height)}" rx="${fmt(radius)}" />
${slots}
  </g>
</svg>`
}

function dxfLine(x1: number, y1: number, x2: number, y2: number): string {
  return `0\nLINE\n8\nCUT\n10\n${fmt(x1)}\n20\n${fmt(y1)}\n30\n0\n11\n${fmt(x2)}\n21\n${fmt(y2)}\n31\n0\n`
}

function dxfArc(cx: number, cy: number, radius: number, start: number, end: number): string {
  return `0\nARC\n8\nCUT\n10\n${fmt(cx)}\n20\n${fmt(cy)}\n30\n0\n40\n${fmt(radius)}\n50\n${fmt(start)}\n51\n${fmt(end)}\n`
}

function dxfRoundedRect(cx: number, cy: number, width: number, height: number, radius: number): string {
  const left = cx - width / 2
  const right = cx + width / 2
  const top = cy - height / 2
  const bottom = cy + height / 2
  const r = Math.max(0, Math.min(radius, width / 2, height / 2))
  let result = ''
  result += dxfLine(left + r, top, right - r, top)
  result += dxfLine(right, top + r, right, bottom - r)
  result += dxfLine(right - r, bottom, left + r, bottom)
  result += dxfLine(left, bottom - r, left, top + r)
  if (r > 0) {
    result += dxfArc(right - r, top + r, r, 270, 360)
    result += dxfArc(right - r, bottom - r, r, 0, 90)
    result += dxfArc(left + r, bottom - r, r, 90, 180)
    result += dxfArc(left + r, top + r, r, 180, 270)
  }
  return result
}

export function skadisDxf(settings: SkadisSettings): string {
  const { width, height, cornerRadius, slotWidth, slotHeight } = settings
  const r = Math.max(0, Math.min(cornerRadius, width / 2, height / 2))
  let entities = ''
  entities += dxfLine(r, 0, width - r, 0)
  entities += dxfLine(width, r, width, height - r)
  entities += dxfLine(width - r, height, r, height)
  entities += dxfLine(0, height - r, 0, r)
  if (r > 0) {
    entities += dxfArc(width - r, r, r, 270, 360)
    entities += dxfArc(width - r, height - r, r, 0, 90)
    entities += dxfArc(r, height - r, r, 90, 180)
    entities += dxfArc(r, r, r, 180, 270)
  }

  for (const { x, y } of skadisSlots(settings)) {
    entities += dxfRoundedRect(x, y, slotWidth, slotHeight, Math.min(slotWidth, slotHeight) / 2)
  }
  return `0\nSECTION\n2\nHEADER\n9\n$INSUNITS\n70\n4\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n${entities}0\nENDSEC\n0\nEOF\n`
}
