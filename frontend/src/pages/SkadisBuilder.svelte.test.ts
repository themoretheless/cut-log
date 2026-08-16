// @vitest-environment happy-dom
/**
 * Interaction tests for the SKADIS preview viewport. happy-dom gives SVG
 * elements no layout, so getScreenCTM is stubbed with a plain scale: the
 * assertions below are about the pan and zoom bookkeeping, which is where the
 * bugs were, not about pixel geometry.
 */
import { render, fireEvent } from '@testing-library/svelte'
import { tick } from 'svelte'
import { beforeEach, describe, expect, it } from 'vitest'
import SkadisBuilder from './SkadisBuilder.svelte'

function stubLayout(svg: SVGSVGElement, scale = 1) {
  Object.defineProperty(svg, 'clientWidth', { value: 600, configurable: true })
  Object.defineProperty(svg, 'clientHeight', { value: 400, configurable: true })
  const matrix = new DOMMatrix([scale, 0, 0, scale, 0, 0])
  svg.getScreenCTM = () => matrix
  svg.setPointerCapture = () => undefined
  svg.releasePointerCapture = () => undefined
}

async function settle() {
  for (let i = 0; i < 6; i++) {
    await Promise.resolve()
    await tick()
  }
}

function viewBoxOf(svg: SVGSVGElement) {
  const [x, y, w, h] = (svg.getAttribute('viewBox') ?? '').split(' ').map(Number)
  return { x, y, w, h }
}

let container: HTMLElement
let svg: SVGSVGElement
let preview: HTMLElement

beforeEach(async () => {
  const rendered = render(SkadisBuilder)
  container = rendered.container
  await settle()
  svg = container.querySelector('.board-preview svg') as SVGSVGElement
  preview = container.querySelector('.board-preview') as HTMLElement
  stubLayout(svg)
})

function zoomLevel() {
  return container.querySelector('.zoom-level')?.textContent ?? ''
}

async function zoomIn(times = 1) {
  const plus = container.querySelectorAll('.zoom-controls button')[1] as HTMLButtonElement
  for (let i = 0; i < times; i++) {
    await fireEvent.click(plus)
    await settle()
  }
}

describe('preview panning', () => {
  it('cannot drag the board out of the visible window', async () => {
    await zoomIn(2)
    for (let i = 0; i < 40; i++) {
      await fireEvent.pointerDown(svg, { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 300, clientY: 200 })
      await fireEvent.pointerMove(svg, { pointerId: 1, pointerType: 'mouse', clientX: 0, clientY: 0 })
      await fireEvent.pointerUp(svg, { pointerId: 1, pointerType: 'mouse', clientX: 0, clientY: 0 })
    }
    await settle()
    const dragged = viewBoxOf(svg)

    // Fitting afterwards yields the box the window must have stayed inside;
    // reading it now keeps the check honest even though the fitted size
    // depends on a pane measurement that lands asynchronously.
    const fit = container.querySelectorAll('.zoom-controls button')[2] as HTMLButtonElement
    await fireEvent.click(fit)
    await settle()
    const fitted = viewBoxOf(svg)

    expect(dragged.w).toBeLessThan(fitted.w)
    expect(dragged.x).toBeGreaterThanOrEqual(fitted.x - 1e-6)
    expect(dragged.y).toBeGreaterThanOrEqual(fitted.y - 1e-6)
    expect(dragged.x + dragged.w).toBeLessThanOrEqual(fitted.x + fitted.w + 1e-6)
    expect(dragged.y + dragged.h).toBeLessThanOrEqual(fitted.y + fitted.h + 1e-6)
  })
})

describe('preview keyboard', () => {
  it('leaves arrow keys to the page while the view is fitted', async () => {
    expect(zoomLevel()).toBe('100%')
    const event = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true })
    const notSwallowed = preview.dispatchEvent(event)
    await settle()

    expect(notSwallowed).toBe(true)
    expect(event.defaultPrevented).toBe(false)
  })

  it('takes the arrow keys once there is something to pan', async () => {
    await zoomIn(2)
    const before = viewBoxOf(svg)
    const event = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true })
    preview.dispatchEvent(event)
    await settle()

    expect(event.defaultPrevented).toBe(true)
    expect(viewBoxOf(svg).y).toBeGreaterThan(before.y)
  })
})

describe('preview pinch', () => {
  it('does not jump when a third finger lifts', async () => {
    const touch = (type: string, id: number, x: number, y: number) =>
      fireEvent[type as 'pointerDown'](svg, { pointerId: id, pointerType: 'touch', clientX: x, clientY: y })

    // Zoom in first: at the minimum a shrinking pinch is clamped away and the
    // jump this guards against would be invisible.
    await zoomIn(3)
    await touch('pointerDown', 1, 200, 200)
    await touch('pointerDown', 2, 400, 200)
    await touch('pointerDown', 3, 420, 200)
    await settle()
    const beforeLift = zoomLevel()

    // Lifting the first finger leaves the pair 2 and 3, only 20 apart, while
    // the recorded distance still belongs to the pair 1 and 2, 200 apart.
    await touch('pointerUp', 1, 200, 200)
    await settle()
    await touch('pointerMove', 2, 400, 200)
    await touch('pointerMove', 3, 421, 200)
    await settle()

    const after = Number(zoomLevel().replace('%', ''))
    const before = Number(beforeLift.replace('%', ''))
    expect(Number.isFinite(after)).toBe(true)
    // Zoom is multiplicative, so judge the ratio: spreading the remaining pair
    // by a twentieth may scale the view by about that, never by a third.
    expect(after / before).toBeGreaterThan(0.9)
    expect(after / before).toBeLessThan(1.15)
  })
})
