const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'

type AttributeValue = string | number | boolean

interface AttributeState {
  [name: string]: string
}

const attributeStates = new WeakMap<Element, AttributeState>()
const textStates = new WeakMap<Node, string>()

function stateFor(element: Element): AttributeState {
  let state = attributeStates.get(element)
  if (!state) {
    state = Object.create(null) as AttributeState
    attributeStates.set(element, state)
  }
  return state
}

export function setAttributeCached(
  element: Element,
  name: string,
  value: AttributeValue,
): void {
  const serialized = String(value)
  const state = stateFor(element)
  if (state[name] === serialized) return
  element.setAttribute(name, serialized)
  state[name] = serialized
}

export function setAttributes(
  element: Element,
  attributes: Readonly<Record<string, AttributeValue>>,
): void {
  for (const [name, value] of Object.entries(attributes)) {
    setAttributeCached(element, name, value)
  }
}

export function htmlElement<K extends keyof HTMLElementTagNameMap>(
  tagName: K,
  className?: string,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tagName)
  if (className) element.className = className
  return element
}

export function svgElement<K extends keyof SVGElementTagNameMap>(
  tagName: K,
  attributes: Readonly<Record<string, AttributeValue>> = {},
): SVGElementTagNameMap[K] {
  const element = document.createElementNS(SVG_NAMESPACE, tagName)
  setAttributes(element, attributes)
  return element
}

export function setText(element: Node, value: string): void {
  if (textStates.get(element) === value) return
  element.textContent = value
  textStates.set(element, value)
}
