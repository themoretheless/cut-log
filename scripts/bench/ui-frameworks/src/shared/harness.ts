export interface DomSignature {
  elements: number
  svgs: number
  interactivePieces: number
  textLength: number
  firstPieceLabel: string | null
  lastPieceLabel: string | null
  fingerprint: string
}

export interface FrameworkBenchmark {
  readonly framework: 'vue' | 'svelte' | 'retained'
  readonly workload: 'layout' | 'skadis'
  readonly operations: readonly string[]
  mount(): Promise<number>
  prepare(operation: string): Promise<void>
  run(operation: string): Promise<number>
  destroy(): Promise<void>
  signature(): DomSignature
}

declare global {
  interface Window {
    __frameworkBenchmark?: FrameworkBenchmark
  }
}

export function forceLayout(target: HTMLElement): void {
  // Reading layout after the framework tick makes every sample include DOM
  // patching and the browser's style/layout work, not only state assignment.
  void target.getBoundingClientRect().height
}

export function domSignature(target: HTMLElement): DomSignature {
  const pieces = Array.from(target.querySelectorAll('[data-benchmark-piece]'))
  const normalizedText = (target.textContent ?? '').replace(/\s+/g, '')
  return {
    elements: target.querySelectorAll('*').length,
    svgs: target.querySelectorAll('svg').length,
    interactivePieces: pieces.length,
    textLength: normalizedText.length,
    firstPieceLabel: pieces[0]?.getAttribute('aria-label') ?? null,
    lastPieceLabel: pieces[pieces.length - 1]?.getAttribute('aria-label') ?? null,
    fingerprint: domFingerprint(target, normalizedText),
  }
}

function domFingerprint(target: HTMLElement, normalizedText: string): string {
  let first = 0x811c9dc5
  let second = 0x9e3779b9
  const write = (value: string): void => {
    for (let index = 0; index < value.length; index += 1) {
      const code = value.charCodeAt(index)
      first = Math.imul(first ^ code, 0x01000193) >>> 0
      second = Math.imul(second ^ code, 0x85ebca6b) >>> 0
    }
  }

  const visit = (element: Element): void => {
    write(`<${element.namespaceURI ?? ''}|${element.localName}`)
    const attributes = Array.from(element.attributes)
      .filter(attribute => attribute.name !== 'data-v-app'
        && !(element instanceof HTMLInputElement && attribute.name === 'value'))
      .map(attribute => {
        if (attribute.name !== 'style') return [attribute.name, attribute.value] as const
        const declaration = (element as HTMLElement | SVGElement).style
        const normalized = Array.from(declaration)
          .sort()
          .map(name => `${name}:${declaration.getPropertyValue(name).trim()}${declaration.getPropertyPriority(name) ? '!important' : ''}`)
          .join(';')
        return [attribute.name, normalized] as const
      })
      .sort(([left], [right]) => left.localeCompare(right))
    for (const [name, value] of attributes) write(`|${name}=${value}`)
    if (element instanceof HTMLInputElement) write(`|.value=${element.value}`)
    write('>')
    for (const child of element.children) visit(child)
    write(`</${element.localName}>`)
  }
  visit(target)
  write(`|text=${normalizedText}`)
  return `${first.toString(16).padStart(8, '0')}${second.toString(16).padStart(8, '0')}`
}

export async function measuredUpdate(
  target: HTMLElement,
  update: () => void,
  flush: () => Promise<unknown>,
): Promise<number> {
  const started = performance.now()
  update()
  await flush()
  forceLayout(target)
  return performance.now() - started
}
