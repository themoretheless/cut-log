// @vitest-environment happy-dom
import { render } from '@testing-library/svelte'
import { tick } from 'svelte'
import { describe, expect, it, vi } from 'vitest'
import type { CutPiece, Sheet } from '@/services/types'
import SheetCard from './SheetCard.svelte'

const piece: CutPiece = {
  id: 'piece-shelf',
  label: 'Shelf A',
  width: 120,
  height: 80,
  quantity: 1,
  allowRotation: true,
  color: '#2f80ed',
}

const sheet: Sheet = {
  index: 0,
  width: 400,
  height: 300,
  placedPieces: [{
    source: piece,
    x: 10,
    y: 20,
    width: 80,
    height: 120,
    isRotated: true,
  }],
  usedArea: 9_600,
  totalArea: 120_000,
  efficiency: 8,
}

function renderCard(selectedPieceId: string | null = null) {
  const onSelect = vi.fn()
  const view = render(SheetCard, {
    props: {
      sheet,
      selectedPieceId,
      pieceIndexes: { [piece.id]: 7 },
      onSelect,
    },
  })
  return { ...view, onSelect }
}

describe('SheetCard', () => {
  it('labels the sheet and each placed piece for assistive technology', () => {
    const { container } = renderCard(piece.id)
    const svg = container.querySelector('svg[role="group"]')!
    const placedPiece = container.querySelector('rect[role="button"]')!

    expect(svg.getAttribute('aria-labelledby')).toBe('sheet-title-0')
    expect(container.querySelector('#sheet-title-0')!.textContent).toContain('8.0%')
    expect(placedPiece.getAttribute('aria-label')).toContain('Shelf A')
    expect(placedPiece.getAttribute('aria-label')).toMatch(/80.*120/)
    expect(placedPiece.getAttribute('aria-pressed')).toBe('true')
  })

  it('emits selection from pointer input', async () => {
    const { container, onSelect } = renderCard()

    container.querySelector('rect[role="button"]')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await tick()

    expect(onSelect.mock.calls).toEqual([[piece.id]])
  })

  it('supports Enter and Space selection without scrolling', async () => {
    const { container, onSelect } = renderCard()
    const placedPiece = container.querySelector('rect[role="button"]')!

    const enter = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true, bubbles: true })
    const space = new KeyboardEvent('keydown', { key: ' ', cancelable: true, bubbles: true })
    placedPiece.dispatchEvent(enter)
    placedPiece.dispatchEvent(space)
    await tick()

    expect(enter.defaultPrevented).toBe(true)
    expect(space.defaultPrevented).toBe(true)
    expect(onSelect.mock.calls).toEqual([[piece.id], [piece.id]])
  })
})
