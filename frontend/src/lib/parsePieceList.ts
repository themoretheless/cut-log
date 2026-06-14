/**
 * Parse a pasted/typed cut list (from Excel, Google Sheets, Numbers, or plain
 * text) into piece rows. Tolerant of the common shapes woodworkers actually
 * paste: tab/comma/semicolon/space separated, an optional leading label, a
 * combined "WxH" cell, an optional quantity, and a header row (auto-skipped).
 *
 * Pure and side-effect free so it can be unit-tested exhaustively; the caller
 * turns rows into CutPiece objects (ids, colors, palette).
 */

export interface ParsedRow {
  label: string
  width: number
  height: number
  quantity: number
}

export interface ParseResult {
  rows: ParsedRow[]
  /** Non-empty lines that yielded no valid width/height (headers, junk). */
  skipped: number
}

const DIM_PAIR = /^(\d+(?:[.,]\d+)?)\s*[x×*]\s*(\d+(?:[.,]\d+)?)$/i
const NUMBER = /^\d+(?:[.,]\d+)?$/
const QTY_MARK = /^[x×*](\d+)$/i // trailing quantity notation, e.g. "x4" / "×4"

function num(s: string): number {
  return parseFloat(s.replace(',', '.'))
}

function parseLine(raw: string): ParsedRow | null {
  const line = raw.trim()
  if (!line) return null

  // Pick one delimiter so a multi-word label ("Полка A") stays intact. Tab and
  // semicolon win over comma, which lets comma keep working as a decimal
  // separator ("200,25") when the row is tab/semicolon delimited. Comma is a
  // delimiter only when nothing stronger is present; otherwise split on spaces.
  const splitter = /[\t;]/.test(line) ? /[\t;]/ : line.includes(',') ? /,/ : /\s+/
  const cells = line.split(splitter).map(c => c.trim()).filter(Boolean)

  const labelParts: string[] = []
  const nums: number[] = []
  let qtyMark = 0

  for (const cell of cells) {
    const pair = cell.match(DIM_PAIR)
    if (pair) {
      nums.push(num(pair[1]), num(pair[2]))
      continue
    }
    if (NUMBER.test(cell)) {
      nums.push(num(cell))
      continue
    }
    const qm = cell.match(QTY_MARK)
    if (qm && nums.length >= 2) {
      qtyMark = parseInt(qm[1], 10)
      continue
    }
    // Leading non-numeric text is the label; trailing units ("mm") are ignored.
    if (nums.length === 0) labelParts.push(cell)
  }

  if (nums.length < 2) return null
  const width = nums[0]
  const height = nums[1]
  if (!(width > 0) || !(height > 0)) return null

  const rawQty = qtyMark || (nums.length >= 3 ? nums[2] : 1)
  const quantity = Number.isFinite(rawQty) ? Math.max(1, Math.round(rawQty)) : 1

  return { label: labelParts.join(' '), width, height, quantity }
}

export function parsePieceList(text: string): ParseResult {
  const rows: ParsedRow[] = []
  let skipped = 0
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue
    const row = parseLine(line)
    if (row) rows.push(row)
    else skipped++
  }
  return { rows, skipped }
}
