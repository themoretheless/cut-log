import { describe, it, expect } from 'vitest'
import { buildLayoutSvg, buildLayoutDxf, partsList } from './exportLayout'
import type { CuttingResult, CutPiece } from '@/services/types'

function piece(id: string, label: string, w: number, h: number, color = '#abc123'): CutPiece {
  return { id, label, width: w, height: h, quantity: 1, allowRotation: true, color }
}

const result: CuttingResult = {
  sheets: [
    {
      index: 0, width: 2440, height: 1220, usedArea: 0, totalArea: 0, efficiency: 0,
      placedPieces: [
        { source: piece('a', 'Side', 400, 300), x: 0, y: 0, width: 400, height: 300, isRotated: false },
        { source: piece('a', 'Side', 400, 300), x: 410, y: 0, width: 300, height: 400, isRotated: true },
      ],
    },
    {
      index: 1, width: 2440, height: 1220, usedArea: 0, totalArea: 0, efficiency: 0,
      placedPieces: [
        { source: piece('b', 'Back', 800, 600), x: 0, y: 0, width: 800, height: 600, isRotated: false },
      ],
    },
  ],
  unplacedPieces: [], strategy: 0 as any, totalSheets: 2, totalUsedArea: 0, totalArea: 0, overallEfficiency: 0,
}

const empty: CuttingResult = { ...result, sheets: [] }

describe('partsList', () => {
  it('aggregates placements by label+size with quantities', () => {
    const parts = partsList(result)
    expect(parts).toContainEqual({ label: 'Side', w: 400, h: 300, qty: 2 })
    expect(parts).toContainEqual({ label: 'Back', w: 800, h: 600, qty: 1 })
    expect(parts).toHaveLength(2)
  })
})

describe('buildLayoutSvg', () => {
  it('is empty for a result with no sheets', () => {
    expect(buildLayoutSvg(empty)).toBe('')
  })
  it('emits one group per sheet, sized in mm, with a rect per piece + boundary', () => {
    const svg = buildLayoutSvg(result)
    expect(svg.startsWith('<?xml')).toBe(true)
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"')
    expect((svg.match(/<g transform/g) || []).length).toBe(2)
    // 2 sheet boundaries + 3 pieces = 5 rects
    expect((svg.match(/<rect /g) || []).length).toBe(5)
    expect(svg).toContain('width="2440mm"')
    // piece color is carried through
    expect(svg).toContain('fill="#abc123"')
  })
  it('escapes the piece color so a tampered value cannot break out of the fill attribute', () => {
    const r: CuttingResult = { ...result, sheets: [{ ...result.sheets[0], placedPieces: [
      { source: piece('x', 'P', 100, 100, 'red"/><script>x</script>'), x: 0, y: 0, width: 100, height: 100, isRotated: false },
    ] }] }
    const svg = buildLayoutSvg(r)
    expect(svg).not.toContain('<script>')
    expect(svg).toContain('&lt;script&gt;')
  })
  it('escapes labels', () => {
    const r: CuttingResult = { ...result, sheets: [{ ...result.sheets[0], placedPieces: [
      { source: piece('x', 'A & <B>', 100, 100), x: 0, y: 0, width: 100, height: 100, isRotated: false },
    ] }] }
    const svg = buildLayoutSvg(r)
    expect(svg).toContain('A &amp; &lt;B&gt;')
    expect(svg).not.toContain('A & <B>')
  })
})

describe('buildLayoutDxf', () => {
  it('is empty for no sheets', () => {
    expect(buildLayoutDxf(empty)).toBe('')
  })
  it('is a well-formed entities-only DXF with one closed LWPOLYLINE per rect', () => {
    const dxf = buildLayoutDxf(result)
    expect(dxf.startsWith('0\nSECTION\n2\nENTITIES\n')).toBe(true)
    expect(dxf.trimEnd().endsWith('EOF')).toBe(true)
    // 2 boundaries + 3 pieces = 5 polylines, each closed (70/1) with 4 vertices (90/4)
    expect((dxf.match(/LWPOLYLINE/g) || []).length).toBe(5)
    expect((dxf.match(/\n90\n4\n/g) || []).length).toBe(5)
  })
})
