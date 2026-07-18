// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { CutPiece, Sheet } from '@/services/types'
import SheetCard from './SheetCard.vue'

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

function mountCard(selectedPieceId: string | null = null) {
  return mount(SheetCard, {
    props: {
      sheet,
      selectedPieceId,
      pieceIndexes: { [piece.id]: 7 },
    },
  })
}

describe('SheetCard', () => {
  it('labels the sheet and each placed piece for assistive technology', () => {
    const wrapper = mountCard(piece.id)
    const svg = wrapper.get('svg[role="group"]')
    const placedPiece = wrapper.get('rect[role="button"]')

    expect(svg.attributes('aria-labelledby')).toBe('sheet-title-0')
    expect(wrapper.get('#sheet-title-0').text()).toContain('8.0%')
    expect(placedPiece.attributes('aria-label')).toContain('Shelf A')
    expect(placedPiece.attributes('aria-label')).toMatch(/80.*120/)
    expect(placedPiece.attributes('aria-pressed')).toBe('true')
  })

  it('emits selection from pointer input', async () => {
    const wrapper = mountCard()

    await wrapper.get('rect[role="button"]').trigger('click')

    expect(wrapper.emitted('select')).toEqual([[piece.id]])
  })

  it('supports Enter and Space selection without scrolling', async () => {
    const wrapper = mountCard()
    const placedPiece = wrapper.get('rect[role="button"]')

    const enter = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true })
    const space = new KeyboardEvent('keydown', { key: ' ', cancelable: true })
    placedPiece.element.dispatchEvent(enter)
    placedPiece.element.dispatchEvent(space)
    await wrapper.vm.$nextTick()

    expect(enter.defaultPrevented).toBe(true)
    expect(space.defaultPrevented).toBe(true)
    expect(wrapper.emitted('select')).toEqual([[piece.id], [piece.id]])
  })
})
