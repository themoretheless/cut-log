import type { SkadisSettings, SkadisSlot } from '@cutlog/skadis/geometry'
import {
  htmlElement,
  setAttributeCached,
  setAttributes,
  setText,
  svgElement,
} from './cachedDom'

interface SlotView {
  readonly element: SVGRectElement
}

function appendLabel(
  parent: HTMLElement,
  id: string,
  label: string,
): HTMLInputElement {
  const wrapper = htmlElement('label')
  wrapper.htmlFor = id
  const caption = htmlElement('span')
  setText(caption, label)
  const input = htmlElement('input')
  input.id = id
  input.type = 'number'
  input.readOnly = true
  wrapper.append(caption, input)
  parent.append(wrapper)
  return input
}

function createSlotView(index: number): SlotView {
  return {
    element: svgElement('rect', {
      'data-benchmark-slot': index,
      class: 'board-slot',
    }),
  }
}

export class RetainedSkadisRenderer {
  readonly #main = htmlElement('main', 'skadis-benchmark')
  readonly #pitchInput: HTMLInputElement
  readonly #widthInput: HTMLInputElement
  readonly #heightInput: HTMLInputElement
  readonly #slotCount = htmlElement('p', 'slot-count')
  readonly #boardDescription = htmlElement('p')
  readonly #svg = svgElement('svg', {
    role: 'img',
    'aria-label': 'SKÅDIS board preview',
  })
  readonly #boardShadow = svgElement('rect', {
    class: 'board-shadow',
    x: '3',
    y: '5',
  })
  readonly #boardShape = svgElement('rect', {
    class: 'board-shape',
    x: '0',
    y: '0',
  })
  readonly #slotViews: SlotView[] = []
  #activeSlotCount = 0

  constructor(
    target: HTMLElement,
    settings: Readonly<SkadisSettings>,
    slots: readonly SkadisSlot[],
  ) {
    const controls = htmlElement('section', 'skadis-controls')
    const heading = htmlElement('h1')
    setText(heading, 'SKÅDIS renderer')
    controls.append(heading)
    this.#pitchInput = appendLabel(controls, 'skadis-pitch', 'Pitch (mm)')
    this.#widthInput = appendLabel(controls, 'skadis-width', 'Board width (mm)')
    this.#heightInput = appendLabel(controls, 'skadis-height', 'Board height (mm)')
    controls.append(this.#slotCount)

    const preview = htmlElement('section', 'skadis-preview')
    const previewHeading = htmlElement('h2')
    setText(previewHeading, 'Preview')
    preview.append(previewHeading, this.#boardDescription)
    this.#svg.append(this.#boardShadow, this.#boardShape)
    preview.append(this.#svg)
    this.#main.append(controls, preview)
    this.update(settings, slots)
    target.append(this.#main)
  }

  update(settings: Readonly<SkadisSettings>, slots: readonly SkadisSlot[]): void {
    const padding = Math.max(settings.width, settings.height) * 0.025
    setAttributeCached(
      this.#svg,
      'viewBox',
      [
        -padding,
        -padding,
        settings.width + padding * 2,
        settings.height + padding * 2,
      ].join(' '),
    )
    setAttributes(this.#boardShadow, {
      width: settings.width,
      height: settings.height,
      rx: settings.cornerRadius,
    })
    setAttributes(this.#boardShape, {
      width: settings.width,
      height: settings.height,
      rx: settings.cornerRadius,
    })

    const slotRadius = Math.min(settings.slotWidth, settings.slotHeight) / 2
    const addedNodes = document.createDocumentFragment()
    for (let index = 0; index < slots.length; index += 1) {
      let view = this.#slotViews[index]
      if (!view) {
        view = createSlotView(index)
        this.#slotViews.push(view)
      }
      if (index >= this.#activeSlotCount) addedNodes.append(view.element)
      const slot = slots[index]!
      setAttributeCached(view.element, 'x', slot.x - settings.slotWidth / 2)
      setAttributeCached(view.element, 'y', slot.y - settings.slotHeight / 2)
      setAttributeCached(view.element, 'width', settings.slotWidth)
      setAttributeCached(view.element, 'height', settings.slotHeight)
      setAttributeCached(view.element, 'rx', slotRadius)
    }
    if (addedNodes.hasChildNodes()) this.#svg.append(addedNodes)
    for (let index = slots.length; index < this.#activeSlotCount; index += 1) {
      this.#slotViews[index]!.element.remove()
    }
    this.#activeSlotCount = slots.length

    this.#setInputValue(this.#pitchInput, settings.pitch)
    this.#setInputValue(this.#widthInput, settings.width)
    this.#setInputValue(this.#heightInput, settings.height)
    setText(this.#slotCount, `Slots: ${slots.length}`)
    setText(this.#boardDescription, `Board: ${settings.width} × ${settings.height} mm`)
  }

  destroy(): void {
    this.#main.remove()
    this.#slotViews.length = 0
    this.#activeSlotCount = 0
  }

  #setInputValue(input: HTMLInputElement, value: number): void {
    const serialized = String(value)
    if (input.value !== serialized) input.value = serialized
  }
}
