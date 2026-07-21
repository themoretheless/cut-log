/**
 * Parse a pasted/typed cut list (from Excel, Google Sheets, Numbers, or plain
 * text) into piece rows. The parser accepts RFC 4180 CSV plus the tab,
 * semicolon, and whitespace formats commonly pasted from spreadsheets.
 */

export interface ParsedRow {
  label: string
  width: number
  height: number
  quantity: number
  /** Present only when the row carried an explicit rotation column. */
  allowRotation?: boolean
}

export interface ParseResult {
  rows: ParsedRow[]
  /** Non-empty logical records that could not be imported. */
  skipped: number
}

const MAX_INPUT_CHARS = 1_048_576
const MAX_RECORDS = 2_000
const MAX_LOGICAL_RECORDS = 10_000
const MAX_COLUMNS = 16
const MAX_LABEL_CHARS = 200
// The exporter may add one reversible apostrophe before a 200-character label.
const MAX_ENCODED_FIELD_CHARS = MAX_LABEL_CHARS + 1
const MAX_QUANTITY = 2_000

const DIM_PAIR = /^(\d+(?:[.,]\d+)?)\s*[x×*]\s*(\d+(?:[.,]\d+)?)$/i
const NUMBER = /^\d+(?:[.,]\d+)?$/
const NUMERIC_LIKE = /^(?:[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?|[+-]?(?:Infinity|NaN)|0[xbo][0-9a-f]+)$/i
const QTY_MARK = /^[x×*](\d+)$/i
const UNIT = /^(?:mm|мм)$/i
const STRICT_DECIMAL = /^\d+(?:[.,]\d+)?$/
const STRICT_POSITIVE_INTEGER = /^[1-9]\d*$/
const EXPORTED_HEADER = ['label', 'width', 'height', 'quantity', 'rotation'] as const

type Delimiter = ',' | ';' | '\t'
type WalkStatus = 'complete' | 'stopped' | 'limit'

interface TokenizedRecord {
  kind: 'ok'
  cells: string[]
}

interface InvalidRecord {
  kind: 'invalid'
}

interface LimitExceeded {
  kind: 'limit'
}

type TokenizeResult = TokenizedRecord | InvalidRecord | LimitExceeded
type RowResult = { kind: 'row'; row: ParsedRow } | InvalidRecord | LimitExceeded
type SchemaMode = 'freeform' | 'exported' | 'invalid'

function limitResult(): ParseResult {
  // Bounds failures reject the document as one deterministic skipped import.
  return { rows: [], skipped: 1 }
}

function decimal(s: string): number {
  const normalized = s.replace(',', '.')
  return normalized ? Number(normalized) : Number.NaN
}

function needsFormulaEscape(value: string): boolean {
  let index = 0
  while (value[index] === ' ' || value[index] === "'") index++
  const lead = value[index]
  return lead === '=' || lead === '+' || lead === '-' || lead === '@'
    || lead === '\t' || lead === '\r' || lead === '\n'
}

function restoreFormulaEscape(value: string): string {
  return value.startsWith("'") && needsFormulaEscape(value.slice(1))
    ? value.slice(1)
    : value
}

function hasAtMostScalars(value: string, maximum: number): boolean {
  let count = 0
  for (const _scalar of value) {
    count++
    if (count > maximum) return false
  }
  return true
}

function joinedLabelWithinLimit(parts: readonly string[]): boolean {
  let count = 0
  for (let index = 0; index < parts.length; index++) {
    if (index > 0 && ++count > MAX_LABEL_CHARS) return false
    for (const _scalar of parts[index]) {
      count++
      if (count > MAX_LABEL_CHARS) return false
    }
  }
  return true
}

/** Walk logical records without slicing or retaining their contents. */
function walkRecords(
  text: string,
  visit: (start: number, end: number, malformed: boolean) => boolean,
): WalkStatus {
  let start = text.charCodeAt(0) === 0xfeff ? 1 : 0
  let inQuotes = false
  let atFieldStart = true
  let recordCount = 0

  function deliver(end: number, malformed: boolean): WalkStatus | null {
    recordCount++
    if (recordCount > MAX_LOGICAL_RECORDS) return 'limit'
    return visit(start, end, malformed) ? null : 'stopped'
  }

  for (let index = start; index < text.length; index++) {
    const char = text[index]
    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') index++
        else inQuotes = false
      }
      continue
    }

    if (char === '"' && atFieldStart) {
      inQuotes = true
      atFieldStart = false
    } else if (char === ',' || char === ';' || char === '\t') {
      atFieldStart = true
    } else if (char === '\r' || char === '\n') {
      const status = deliver(index, false)
      if (status) return status
      if (char === '\r' && text[index + 1] === '\n') index++
      start = index + 1
      atFieldStart = true
    } else {
      atFieldStart = false
    }
  }

  if (start < text.length) {
    const status = deliver(text.length, inQuotes)
    if (status) return status
  }
  return 'complete'
}

function delimiterInRecord(text: string, start: number, end: number): Delimiter | null {
  let hasTab = false
  let hasSemicolon = false
  let hasComma = false
  let inQuotes = false
  let atFieldStart = true

  for (let index = start; index < end; index++) {
    const char = text[index]
    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') index++
        else inQuotes = false
      }
      continue
    }
    if (char === '"' && atFieldStart) {
      inQuotes = true
      atFieldStart = false
    } else if (char === '\t') {
      hasTab = true
      atFieldStart = true
    } else if (char === ';') {
      hasSemicolon = true
      atFieldStart = true
    } else if (char === ',') {
      hasComma = true
      atFieldStart = true
    } else {
      atFieldStart = false
    }
  }

  if (hasTab) return '\t'
  if (hasSemicolon) return ';'
  return hasComma ? ',' : null
}

function detectDelimiter(text: string): { delimiter: Delimiter | null; limit: boolean } {
  let delimiter: Delimiter | null = null
  const status = walkRecords(text, (start, end) => {
    delimiter = delimiterInRecord(text, start, end)
    return delimiter == null
  })
  return { delimiter, limit: status === 'limit' }
}

function tokenizeDelimited(text: string, start: number, end: number, delimiter: Delimiter): TokenizeResult {
  const cells: string[] = []
  let field = ''
  let fieldScalarCount = 0
  let previousWasHighSurrogate = false
  let inQuotes = false
  let afterQuote = false

  function append(char: string): boolean {
    const codeUnit = char.charCodeAt(0)
    const isHighSurrogate = codeUnit >= 0xd800 && codeUnit <= 0xdbff
    const isLowSurrogate = codeUnit >= 0xdc00 && codeUnit <= 0xdfff
    const completesPair = isLowSurrogate && previousWasHighSurrogate
    if (!completesPair && ++fieldScalarCount > MAX_ENCODED_FIELD_CHARS) return false
    field += char
    previousWasHighSurrogate = isHighSurrogate
    return true
  }

  function finishField(): boolean {
    if (cells.length >= MAX_COLUMNS) return false
    cells.push(field)
    field = ''
    fieldScalarCount = 0
    previousWasHighSurrogate = false
    afterQuote = false
    return true
  }

  for (let index = start; index < end; index++) {
    const char = text[index]
    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          if (!append('"')) return { kind: 'limit' }
          index++
        } else {
          inQuotes = false
          afterQuote = true
        }
      } else if (!append(char)) {
        return { kind: 'limit' }
      }
      continue
    }

    if (afterQuote) {
      if (char === delimiter) {
        if (!finishField()) return { kind: 'limit' }
      } else if (char !== ' ' && !(char === '\t' && delimiter !== '\t')) {
        return { kind: 'invalid' }
      }
      continue
    }

    if (char === '"' && field.length === 0) {
      inQuotes = true
    } else if (char === delimiter) {
      if (!finishField()) return { kind: 'limit' }
    } else if (!append(char)) {
      return { kind: 'limit' }
    }
  }

  if (inQuotes) return { kind: 'invalid' }
  if (!finishField()) return { kind: 'limit' }
  return { kind: 'ok', cells }
}

function tokenizeWhitespace(text: string, start: number, end: number): TokenizeResult {
  const cells: string[] = []
  let field = ''
  let fieldScalarCount = 0
  let previousWasHighSurrogate = false

  function finishField(): boolean {
    if (!field) return true
    if (cells.length >= MAX_COLUMNS) return false
    cells.push(field)
    field = ''
    fieldScalarCount = 0
    previousWasHighSurrogate = false
    return true
  }

  for (let index = start; index < end; index++) {
    const char = text[index]
    if (/\s/.test(char)) {
      if (!finishField()) return { kind: 'limit' }
    } else {
      const codeUnit = char.charCodeAt(0)
      const isHighSurrogate = codeUnit >= 0xd800 && codeUnit <= 0xdbff
      const isLowSurrogate = codeUnit >= 0xdc00 && codeUnit <= 0xdfff
      const completesPair = isLowSurrogate && previousWasHighSurrogate
      if (!completesPair && ++fieldScalarCount > MAX_ENCODED_FIELD_CHARS) return { kind: 'limit' }
      field += char
      previousWasHighSurrogate = isHighSurrogate
    }
  }
  if (!finishField()) return { kind: 'limit' }
  return { kind: 'ok', cells: cells.length ? cells : [''] }
}

function tokenizeRecord(
  text: string,
  start: number,
  end: number,
  delimiter: Delimiter | null,
): TokenizeResult {
  return delimiter
    ? tokenizeDelimited(text, start, end, delimiter)
    : tokenizeWhitespace(text, start, end)
}

function fieldsWithinLimit(cells: readonly string[]): boolean {
  return cells.every(cell => hasAtMostScalars(cell, MAX_LABEL_CHARS))
}

function parseFreeformCells(cells: readonly string[]): RowResult {
  if (!fieldsWithinLimit(cells)) return { kind: 'limit' }

  const labelParts: string[] = []
  const nums: number[] = []
  let quantityMark: number | null = null
  let numericStarted = false
  let numericClosed = false

  for (const rawCell of cells) {
    const cell = rawCell.trim()
    if (!cell) {
      if (numericStarted) return { kind: 'invalid' }
      continue
    }
    if (numericClosed) return { kind: 'invalid' }

    const pair = cell.match(DIM_PAIR)
    if (pair) {
      if (nums.length !== 0) return { kind: 'invalid' }
      const width = decimal(pair[1])
      const height = decimal(pair[2])
      if (!Number.isFinite(width) || !Number.isFinite(height)) return { kind: 'invalid' }
      nums.push(width, height)
      numericStarted = true
      continue
    }

    if (NUMBER.test(cell)) {
      const value = decimal(cell)
      if (!Number.isFinite(value) || nums.length >= 4) return { kind: 'invalid' }
      nums.push(value)
      numericStarted = true
      continue
    }

    const quantity = cell.match(QTY_MARK)
    if (quantity) {
      const value = Number(quantity[1])
      if (nums.length !== 2 || quantityMark != null || !Number.isFinite(value)) return { kind: 'invalid' }
      quantityMark = value
      numericStarted = true
      continue
    }

    if (UNIT.test(cell) && nums.length >= 2) {
      numericClosed = true
      continue
    }

    if (numericStarted || NUMERIC_LIKE.test(cell.replace(',', '.'))) return { kind: 'invalid' }
    labelParts.push(cell)
  }

  if (nums.length < 2 || nums.length > 4) return { kind: 'invalid' }
  const [width, height] = nums
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { kind: 'invalid' }
  }
  if (quantityMark != null && nums.length !== 2) return { kind: 'invalid' }

  const quantity = quantityMark ?? (nums.length >= 3 ? nums[2] : 1)
  if (!Number.isSafeInteger(quantity) || quantity <= 0 || quantity > MAX_QUANTITY) {
    return { kind: 'invalid' }
  }
  if (nums.length === 4 && nums[3] !== 0 && nums[3] !== 1) return { kind: 'invalid' }

  if (!joinedLabelWithinLimit(labelParts)) return { kind: 'limit' }

  const row: ParsedRow = { label: labelParts.join(' '), width, height, quantity }
  if (nums.length === 4) row.allowRotation = nums[3] === 1
  return { kind: 'row', row }
}

function parseExportedRow(cells: readonly string[]): RowResult {
  if (cells.length !== EXPORTED_HEADER.length) return { kind: 'invalid' }
  for (let index = 1; index < cells.length; index++) {
    if (!hasAtMostScalars(cells[index], MAX_LABEL_CHARS)) return { kind: 'limit' }
  }

  const label = restoreFormulaEscape(cells[0])
  if (!hasAtMostScalars(label, MAX_LABEL_CHARS)) return { kind: 'limit' }
  if (!STRICT_DECIMAL.test(cells[1]) || !STRICT_DECIMAL.test(cells[2])) return { kind: 'invalid' }
  if (!STRICT_POSITIVE_INTEGER.test(cells[3])) return { kind: 'invalid' }
  if (cells[4] !== '0' && cells[4] !== '1') return { kind: 'invalid' }

  const width = decimal(cells[1])
  const height = decimal(cells[2])
  const quantity = Number(cells[3])
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return { kind: 'invalid' }
  }
  if (!Number.isSafeInteger(quantity) || quantity > MAX_QUANTITY) return { kind: 'invalid' }

  return {
    kind: 'row',
    row: {
      label,
      width,
      height,
      quantity,
      allowRotation: cells[4] === '1',
    },
  }
}

function exportedHeaderKind(cells: readonly string[]): 'none' | 'valid' | 'invalid' {
  const normalized = cells.map(cell => cell.trim().toLowerCase())
  const recognizable = normalized[0] === EXPORTED_HEADER[0]
    && normalized[1] === EXPORTED_HEADER[1]
    && normalized[2] === EXPORTED_HEADER[2]
  if (!recognizable) return 'none'
  return cells.length === EXPORTED_HEADER.length
    && EXPORTED_HEADER.every((name, index) => normalized[index] === name)
    ? 'valid'
    : 'invalid'
}

export function parsePieceList(text: string): ParseResult {
  if (text.length > MAX_INPUT_CHARS) return limitResult()

  const detected = detectDelimiter(text)
  if (detected.limit) return limitResult()

  const rows: ParsedRow[] = []
  let skipped = 0
  let schema: SchemaMode = 'freeform'
  let schemaDelimiter: Delimiter | null = null
  let dataRecordCount = 0
  let boundsExceeded = false

  function countDataRecord(): boolean {
    dataRecordCount++
    if (dataRecordCount <= MAX_RECORDS) return true
    boundsExceeded = true
    return false
  }

  const status = walkRecords(text, (start, end, malformed) => {
    if (malformed) {
      if (!countDataRecord()) return false
      skipped++
      return true
    }

    const localDelimiter = delimiterInRecord(text, start, end)
    const recordDelimiter = schema === 'exported'
      ? schemaDelimiter
      : localDelimiter
    const tokenized = tokenizeRecord(text, start, end, recordDelimiter)
    if (tokenized.kind === 'limit') {
      boundsExceeded = true
      return false
    }
    if (tokenized.kind === 'invalid') {
      if (!countDataRecord()) return false
      skipped++
      return true
    }
    if (tokenized.cells.every(cell => !cell.trim())) return true

    const header = exportedHeaderKind(tokenized.cells)
    if (header !== 'none') {
      if (header === 'valid') {
        schema = 'exported'
        schemaDelimiter = localDelimiter ?? detected.delimiter
      } else {
        skipped++
        schema = 'invalid'
        rows.length = 0
      }
      return true
    }
    if (!countDataRecord()) return false
    if (schema === 'invalid') {
      skipped++
      return true
    }

    const parsed = schema === 'exported'
      ? parseExportedRow(tokenized.cells)
      : parseFreeformCells(tokenized.cells)
    if (parsed.kind === 'limit') {
      boundsExceeded = true
      return false
    }
    if (parsed.kind === 'invalid') skipped++
    else rows.push(parsed.row)
    return true
  })

  if (status === 'limit' || boundsExceeded) return limitResult()
  return { rows, skipped }
}
