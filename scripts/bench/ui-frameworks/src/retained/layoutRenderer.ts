import type { PlacedPiece, Sheet } from '@cutlog/services/types'
import { efficiencyClass, truncate } from '@cutlog/helpers/svg'
import {
  badgeWidth,
  grainLines,
  pieceAccessibleName,
  sheetScale,
} from '@cutlog/lib/sheetPresentation'
import {
  htmlElement,
  setAttributeCached,
  setAttributes,
  setText,
  svgElement,
} from './cachedDom'

interface PieceView {
  readonly key: string
  readonly structure: number
  readonly nodes: SVGElement[]
  readonly hitTarget: SVGRectElement
  readonly badge: SVGRectElement
  readonly badgeText: SVGTextElement
  readonly rotatedText: SVGTextElement | null
  readonly labelText: SVGTextElement | null
  readonly dimensionsText: SVGTextElement | null
  sourceId: string
}

interface SheetView {
  readonly article: HTMLElement
  readonly heading: HTMLSpanElement
  readonly efficiency: HTMLSpanElement
  readonly svgWrap: HTMLDivElement
  readonly svg: SVGSVGElement
  readonly title: SVGTitleElement
  readonly background: SVGRectElement
  readonly grainLines: SVGLineElement[]
  readonly pieceAnchor: Comment
  readonly pieces: Map<string, PieceView>
  readonly widthText: SVGTextElement
  readonly heightText: SVGTextElement
  readonly footer: HTMLSpanElement
  activePieces: PieceView[]
  activePieceKeys: string[]
}

function pieceKey(piece: PlacedPiece, position: number): string {
  return `${piece.source.id}-${position}`
}

function pieceStructure(piece: PlacedPiece, scale: number): number {
  const showDescription = piece.width * scale > 40 && piece.height * scale > 22
  return (piece.isRotated ? 1 : 0)
    | (showDescription ? 2 : 0)
    | (showDescription && Boolean(piece.source.label?.trim()) ? 4 : 0)
}

function pieceIndex(
  indexes: Readonly<Record<string, number>>,
  sourceId: string,
): number {
  return indexes[sourceId] ?? 0
}

function appendText(parent: Element, value: string, className?: string): HTMLSpanElement {
  const element = htmlElement('span', className)
  setText(element, value)
  parent.append(element)
  return element
}

function appendSvgText(
  attributes: Readonly<Record<string, string | number | boolean>>,
  value: string,
): SVGTextElement {
  const element = svgElement('text', attributes)
  setText(element, value)
  return element
}

function createPieceView(
  key: string,
  piece: PlacedPiece,
  scale: number,
  index: number,
): PieceView {
  const hitTarget = svgElement('rect', {
    'data-benchmark-piece': '',
    role: 'button',
    tabindex: '0',
    style: 'cursor:pointer',
  })
  const badge = svgElement('rect', {
    height: '13',
    rx: '3',
    fill: 'rgba(0,0,0,0.35)',
    'pointer-events': 'none',
  })
  const badgeText = appendSvgText({
    'text-anchor': 'middle',
    'dominant-baseline': 'middle',
    'font-size': '8',
    'font-weight': '700',
    fill: '#fff',
    'pointer-events': 'none',
  }, String(index))

  const rotatedText = piece.isRotated
    ? appendSvgText({
      'font-size': '10',
      fill: '#fff',
      opacity: '0.9',
      'pointer-events': 'none',
    }, '↻')
    : null

  const showDescription = piece.width * scale > 40 && piece.height * scale > 22
  const label = piece.source.label?.trim() ?? ''
  const labelText = showDescription && label
    ? appendSvgText({
      'text-anchor': 'middle',
      'dominant-baseline': 'middle',
      'font-weight': '600',
      fill: '#fff',
      'pointer-events': 'none',
    }, truncate(label, Math.floor(piece.width * scale / 7)))
    : null
  const dimensionsText = showDescription
    ? appendSvgText({
      'text-anchor': 'middle',
      'dominant-baseline': 'middle',
      fill: '#fff',
      opacity: '0.85',
      'pointer-events': 'none',
    }, `${piece.width.toFixed(0)}×${piece.height.toFixed(0)}`)
    : null

  return {
    key,
    structure: pieceStructure(piece, scale),
    nodes: [hitTarget, badge, badgeText, rotatedText, labelText, dimensionsText]
      .filter((node): node is SVGRectElement | SVGTextElement => node !== null),
    hitTarget,
    badge,
    badgeText,
    rotatedText,
    labelText,
    dimensionsText,
    sourceId: piece.source.id,
  }
}

function updatePieceGeometry(
  view: PieceView,
  piece: PlacedPiece,
  scale: number,
  index: number,
): void {
  const x = piece.x * scale
  const y = piece.y * scale
  const width = piece.width * scale
  const height = piece.height * scale
  const badgeSize = badgeWidth(index)

  setAttributeCached(view.hitTarget, 'x', x.toFixed(1))
  setAttributeCached(view.hitTarget, 'y', y.toFixed(1))
  setAttributeCached(view.hitTarget, 'width', width.toFixed(1))
  setAttributeCached(view.hitTarget, 'height', height.toFixed(1))
  setAttributeCached(view.hitTarget, 'fill', piece.source.color)
  setAttributeCached(view.hitTarget, 'aria-label', pieceAccessibleName(piece, index))
  setAttributeCached(view.badge, 'x', (x + 3).toFixed(1))
  setAttributeCached(view.badge, 'y', (y + 3).toFixed(1))
  setAttributeCached(view.badge, 'width', badgeSize)
  setAttributeCached(view.badgeText, 'x', (x + 3 + badgeSize / 2).toFixed(1))
  setAttributeCached(view.badgeText, 'y', (y + 9.5).toFixed(1))
  setText(view.badgeText, String(index))

  if (view.rotatedText) {
    setAttributeCached(view.rotatedText, 'x', (x + width - 6).toFixed(1))
    setAttributeCached(view.rotatedText, 'y', (y + 12).toFixed(1))
  }
  if (view.labelText) {
    const label = piece.source.label?.trim() ?? ''
    setAttributeCached(view.labelText, 'x', (x + width / 2).toFixed(1))
    setAttributeCached(view.labelText, 'y', (y + height / 2 - 5).toFixed(1))
    setAttributeCached(view.labelText, 'font-size', Math.min(13, width / 6).toFixed(0))
    setText(view.labelText, truncate(label, Math.floor(width / 7)))
  }
  if (view.dimensionsText) {
    setAttributeCached(view.dimensionsText, 'x', (x + width / 2).toFixed(1))
    setAttributeCached(
      view.dimensionsText,
      'y',
      (y + height / 2 + (piece.source.label?.trim() ? 9 : 0)).toFixed(1),
    )
    setAttributeCached(view.dimensionsText, 'font-size', Math.min(11, width / 7).toFixed(0))
    setText(view.dimensionsText, `${piece.width.toFixed(0)}×${piece.height.toFixed(0)}`)
  }
  view.sourceId = piece.source.id
}

function updatePieceSelection(view: PieceView, selectedPieceId: string | null): void {
  const isSelected = view.sourceId === selectedPieceId
  setAttributeCached(
    view.hitTarget,
    'fill-opacity',
    selectedPieceId === null ? 0.82 : (isSelected ? 0.95 : 0.2),
  )
  setAttributeCached(view.hitTarget, 'stroke', isSelected ? '#4a90d9' : '#fff')
  setAttributeCached(view.hitTarget, 'stroke-width', isSelected ? 2 : 0.1)
  setAttributeCached(view.hitTarget, 'aria-pressed', isSelected)
}

function createSheetView(sheet: Sheet): SheetView {
  const article = htmlElement('article', 'sheet-card')
  const header = htmlElement('header', 'sheet-header')
  const heading = appendText(header, '')
  const efficiency = appendText(header, '')
  article.append(header)

  const svgWrap = htmlElement('div', 'sheet-svg-wrap')
  const svg = svgElement('svg', {
    role: 'group',
    style: 'display:block;margin:auto;max-width:100%;height:auto',
  })
  const title = svgElement('title')
  const background = svgElement('rect', {
    fill: '#f5f0e8',
    stroke: '#8B7355',
    'stroke-width': '2',
  })
  svg.append(title, background)

  const lines = Array.from({ length: 9 }, () => svgElement('line', {
    x1: '0',
    stroke: '#d4c9a8',
    'stroke-width': '0.5',
  }))
  svg.append(...lines)

  const pieceAnchor = document.createComment('retained-piece-anchor')
  svg.append(pieceAnchor)

  const widthText = appendSvgText({
    'text-anchor': 'middle',
    'font-size': '11',
    fill: '#8B7355',
  }, '')
  const heightText = appendSvgText({
    x: '4',
    'text-anchor': 'middle',
    'dominant-baseline': 'middle',
    'font-size': '11',
    fill: '#8B7355',
  }, '')
  svg.append(widthText, heightText)
  svgWrap.append(svg)
  article.append(svgWrap)

  const footerElement = htmlElement('footer', 'sheet-footer')
  const footer = appendText(footerElement, '')
  article.append(footerElement)
  return {
    article,
    heading,
    efficiency,
    svgWrap,
    svg,
    title,
    background,
    grainLines: lines,
    pieceAnchor,
    pieces: new Map(),
    widthText,
    heightText,
    footer,
    activePieces: [],
    activePieceKeys: [],
  }
}

interface SheetUpdate {
  readonly pieces: PieceView[]
  readonly structureChanged: boolean
}

function updateSheet(
  view: SheetView,
  sheet: Sheet,
  indexes: Readonly<Record<string, number>>,
  selectedPieceId: string | null,
  refreshSelection: boolean,
): SheetUpdate {
  const scale = sheetScale(sheet)
  const svgWidth = sheet.width * scale
  const svgHeight = sheet.height * scale
  const titleId = `sheet-title-${sheet.index}`

  setText(view.heading, `Sheet ${sheet.index + 1}`)
  const efficiencyClassName = `efficiency-badge ${efficiencyClass(sheet.efficiency)}`
  if (view.efficiency.className !== efficiencyClassName) {
    view.efficiency.className = efficiencyClassName
  }
  setText(view.efficiency, `${sheet.efficiency.toFixed(1)}%`)
  const svgWrapId = `sheet-svg-${sheet.index}`
  if (view.svgWrap.id !== svgWrapId) view.svgWrap.id = svgWrapId
  setAttributes(view.svg, {
    width: svgWidth.toFixed(0),
    height: svgHeight.toFixed(0),
    viewBox: `0 0 ${svgWidth.toFixed(0)} ${svgHeight.toFixed(0)}`,
    'aria-labelledby': titleId,
  })
  setAttributeCached(view.title, 'id', titleId)
  setText(view.title, `Sheet ${sheet.index + 1}, ${sheet.efficiency.toFixed(1)}%`)
  setAttributes(view.background, {
    width: svgWidth.toFixed(0),
    height: svgHeight.toFixed(0),
  })

  const linePositions = grainLines(svgHeight)
  for (let index = 0; index < view.grainLines.length; index += 1) {
    const position = linePositions[index]!
    setAttributes(view.grainLines[index]!, {
      y1: position.toFixed(1),
      x2: svgWidth.toFixed(0),
      y2: position.toFixed(1),
    })
  }

  const hasStablePieces = sheet.placedPieces.length === view.activePieces.length
    && sheet.placedPieces.every((piece, position) => {
      const pieceView = view.activePieces[position]!
      return pieceView.sourceId === piece.source.id
        && pieceView.structure === pieceStructure(piece, scale)
    })
  if (hasStablePieces) {
    for (let position = 0; position < sheet.placedPieces.length; position += 1) {
      const piece = sheet.placedPieces[position]!
      const pieceView = view.activePieces[position]!
      updatePieceGeometry(pieceView, piece, scale, pieceIndex(indexes, piece.source.id))
      if (refreshSelection) updatePieceSelection(pieceView, selectedPieceId)
    }
    updateSheetLabels(view, sheet, svgWidth, svgHeight)
    return { pieces: view.activePieces, structureChanged: false }
  }

  const activePieceViews: PieceView[] = []
  const nextKeys: string[] = []
  const addedNodes = document.createDocumentFragment()
  let nodesReplaced = false
  for (let position = 0; position < sheet.placedPieces.length; position += 1) {
    const piece = sheet.placedPieces[position]!
    const key = pieceKey(piece, position)
    const index = pieceIndex(indexes, piece.source.id)
    let pieceView = view.pieces.get(key)
    if (pieceView && pieceView.structure !== pieceStructure(piece, scale)) {
      for (const node of pieceView.nodes) node.remove()
      pieceView = undefined
      nodesReplaced = true
    }
    if (!pieceView) {
      pieceView = createPieceView(key, piece, scale, index)
      view.pieces.set(key, pieceView)
    }
    if (pieceView.hitTarget.parentNode !== view.svg) {
      for (const node of pieceView.nodes) addedNodes.append(node)
      updatePieceSelection(pieceView, selectedPieceId)
    } else if (refreshSelection) {
      updatePieceSelection(pieceView, selectedPieceId)
    }
    updatePieceGeometry(pieceView, piece, scale, index)
    activePieceViews.push(pieceView)
    nextKeys.push(key)
  }
  if (addedNodes.hasChildNodes()) view.svg.insertBefore(addedNodes, view.pieceAnchor)

  const activeKeysChanged = nodesReplaced
    || nextKeys.length !== view.activePieceKeys.length
    || nextKeys.some((key, index) => key !== view.activePieceKeys[index])
  if (activeKeysChanged) {
    const active = new Set(nextKeys)
    for (const [key, pieceView] of view.pieces) {
      if (active.has(key)) continue
      for (const node of pieceView.nodes) node.remove()
    }
    if (view.activePieceKeys.length > 0) {
      const orderedNodes = document.createDocumentFragment()
      for (const pieceView of activePieceViews) orderedNodes.append(...pieceView.nodes)
      view.svg.insertBefore(orderedNodes, view.pieceAnchor)
    }
    view.activePieceKeys = nextKeys
  }

  view.activePieces = activePieceViews
  updateSheetLabels(view, sheet, svgWidth, svgHeight)
  return { pieces: activePieceViews, structureChanged: true }
}

function updateSheetLabels(
  view: SheetView,
  sheet: Sheet,
  svgWidth: number,
  svgHeight: number,
): void {
  setAttributes(view.widthText, {
    x: (svgWidth / 2).toFixed(0),
    y: (svgHeight - 4).toFixed(0),
  })
  setText(view.widthText, `${sheet.width.toFixed(0)} mm`)
  setAttributes(view.heightText, {
    y: (svgHeight / 2).toFixed(0),
    transform: `rotate(-90,4,${(svgHeight / 2).toFixed(0)})`,
  })
  setText(view.heightText, `${sheet.height.toFixed(0)} mm`)
  setText(
    view.footer,
    `${sheet.placedPieces.length} pcs · waste ${(sheet.totalArea - sheet.usedArea).toFixed(0)} mm²`,
  )
}

export class RetainedLayoutRenderer {
  readonly #main = htmlElement('main', 'benchmark-grid')
  readonly #sheets = new Map<number, SheetView>()
  readonly #pieceByElement = new WeakMap<Element, PieceView>()
  readonly #onClick = (event: Event): void => this.#handleActivation(event)
  readonly #onKeydown = (event: KeyboardEvent): void => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    if (!this.#pieceByElement.has(event.target as Element)) return
    event.preventDefault()
    this.#handleActivation(event)
  }
  #activePieces: PieceView[] = []
  #activeSheetIndexes: number[] = []
  #piecesBySourceId = new Map<string, PieceView[]>()
  #selectedPieceId: string | null = null

  constructor(
    target: HTMLElement,
    sheets: readonly Sheet[],
    indexes: Readonly<Record<string, number>>,
  ) {
    this.#main.addEventListener('click', this.#onClick)
    this.#main.addEventListener('keydown', this.#onKeydown)
    this.updateGeometry(sheets, indexes)
    target.append(this.#main)
  }

  updateGeometry(
    sheets: readonly Sheet[],
    indexes: Readonly<Record<string, number>>,
  ): void {
    const nextSheetIndexes = sheets.map(sheet => sheet.index)
    const sheetStructureChanged = nextSheetIndexes.length !== this.#activeSheetIndexes.length
      || nextSheetIndexes.some((index, position) => index !== this.#activeSheetIndexes[position])
    let pieceStructureChanged = false
    for (let sheetPosition = 0; sheetPosition < sheets.length; sheetPosition += 1) {
      const sheet = sheets[sheetPosition]!
      let view = this.#sheets.get(sheet.index)
      let refreshSelection = false
      if (!view) {
        view = createSheetView(sheet)
        this.#sheets.set(sheet.index, view)
        this.#main.append(view.article)
      } else {
        refreshSelection = view.article.parentNode !== this.#main
      }
      const update = updateSheet(
        view,
        sheet,
        indexes,
        this.#selectedPieceId,
        refreshSelection,
      )
      pieceStructureChanged ||= update.structureChanged
      if (sheetStructureChanged) {
        const currentAtPosition = this.#main.children.item(sheetPosition)
        if (currentAtPosition !== view.article) {
          this.#main.insertBefore(view.article, currentAtPosition)
        }
      }
    }
    if (sheetStructureChanged) {
      const activeSheetIndexes = new Set(nextSheetIndexes)
      for (const [index, view] of this.#sheets) {
        if (!activeSheetIndexes.has(index)) view.article.remove()
      }
    }

    if (sheetStructureChanged || pieceStructureChanged) {
      this.#activeSheetIndexes = nextSheetIndexes
      this.#activePieces = sheets.flatMap(sheet => this.#sheets.get(sheet.index)!.activePieces)
      this.#piecesBySourceId = new Map()
      for (const view of this.#activePieces) {
        this.#pieceByElement.set(view.hitTarget, view)
        const matching = this.#piecesBySourceId.get(view.sourceId)
        if (matching) matching.push(view)
        else this.#piecesBySourceId.set(view.sourceId, [view])
      }
    }
  }

  updateSelection(selectedPieceId: string | null): void {
    if (selectedPieceId === this.#selectedPieceId) return
    const previous = this.#selectedPieceId
    this.#selectedPieceId = selectedPieceId

    if (previous === null || selectedPieceId === null) {
      for (const view of this.#activePieces) updatePieceSelection(view, selectedPieceId)
      return
    }
    for (const view of this.#piecesBySourceId.get(previous) ?? []) {
      updatePieceSelection(view, selectedPieceId)
    }
    for (const view of this.#piecesBySourceId.get(selectedPieceId) ?? []) {
      updatePieceSelection(view, selectedPieceId)
    }
  }

  destroy(): void {
    this.#main.removeEventListener('click', this.#onClick)
    this.#main.removeEventListener('keydown', this.#onKeydown)
    this.#main.remove()
    this.#sheets.clear()
    this.#activePieces = []
    this.#piecesBySourceId.clear()
  }

  #handleActivation(event: Event): void {
    const target = event.target
    if (!(target instanceof Element)) return
    const view = this.#pieceByElement.get(target)
    if (view) this.updateSelection(view.sourceId)
  }
}
