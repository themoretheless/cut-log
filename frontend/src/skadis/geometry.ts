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

export function skadisSvg(settings: SkadisSettings): string {
  const { width, height, cornerRadius, slotWidth, slotHeight } = settings
  const radius = Math.max(0, Math.min(cornerRadius, width / 2, height / 2))
  const slotRadius = Math.min(slotWidth, slotHeight) / 2
  const slots = skadisSlots(settings)
    .map(({ x, y }) => `    <rect x="${fmt(x - slotWidth / 2)}" y="${fmt(y - slotHeight / 2)}" width="${fmt(slotWidth)}" height="${fmt(slotHeight)}" rx="${fmt(slotRadius)}" />`)
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" width="${fmt(width)}mm" height="${fmt(height)}mm" viewBox="0 0 ${fmt(width)} ${fmt(height)}">
  <g id="board-contour" inkscape:groupmode="layer" inkscape:label="Board contour" fill="none" stroke="#ff0000" stroke-width="0.1">
    <rect x="0" y="0" width="${fmt(width)}" height="${fmt(height)}" rx="${fmt(radius)}" />
  </g>
  <g id="slots" inkscape:groupmode="layer" inkscape:label="Slots" fill="none" stroke="#ff0000" stroke-width="0.1">
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
