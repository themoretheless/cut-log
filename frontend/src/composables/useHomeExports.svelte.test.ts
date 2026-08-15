// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { CuttingStrategy, type CutPiece, type CuttingResult } from '@/services/types'
import { useHomeExports } from './useHomeExports.svelte'

const piece: CutPiece = {
  id: 'piece-1',
  label: 'Shelf',
  width: 400,
  height: 300,
  quantity: 1,
  allowRotation: true,
  color: '#abc123',
}

const result: CuttingResult = {
  sheets: [{
    index: 0,
    width: 2440,
    height: 1220,
    placedPieces: [{ source: piece, x: 0, y: 0, width: 400, height: 300, isRotated: false }],
    usedArea: 120000,
    totalArea: 2976800,
    efficiency: 4,
  }],
  unplacedPieces: [],
  strategy: CuttingStrategy.Auto,
  totalSheets: 1,
  totalUsedArea: 120000,
  totalArea: 2976800,
  overallEfficiency: 4,
}

describe('useHomeExports', () => {
  it('does nothing when the required project data is absent', () => {
    const download = vi.fn()
    const channel = useHomeExports({
      pieces: () => [],
      result: () => null,
      translate: key => key,
      download,
      openWindow: () => null,
    })
    expect(channel.exportPiecesCsv()).toBe(false)
    expect(channel.exportSvg()).toBe(false)
    expect(channel.exportDxf()).toBe(false)
    expect(channel.printLayout()).toBe(false)
    expect(download).not.toHaveBeenCalled()
  })

  it('downloads current CSV, SVG, and DXF data with stable file contracts', () => {
    const download = vi.fn()
    const holder = $state({ result: result as CuttingResult | null })
    const channel = useHomeExports({
      pieces: () => [piece],
      result: () => holder.result,
      translate: key => key,
      download,
    })
    channel.exportPiecesCsv()
    channel.exportSvg()
    channel.exportDxf()
    expect(download.mock.calls.map(call => [call[0], call[2]])).toEqual([
      ['cutlog-parts.csv', 'text/csv;charset=utf-8'],
      ['cutlog-layout.svg', 'image/svg+xml'],
      ['cutlog-layout.dxf', 'application/dxf'],
    ])
  })

  it('writes and closes a localized print document', () => {
    const write = vi.fn()
    const close = vi.fn()
    const channel = useHomeExports({
      pieces: () => [piece],
      result: () => result,
      translate: key => ({ 'app.title': 'CutLog', 'export.layout': 'Layout', name: 'Name', 'export.size': 'Size', quantity: 'Qty' })[key] ?? key,
      openWindow: () => ({ document: { write, close } }),
    })
    expect(channel.printLayout()).toBe(true)
    expect(write).toHaveBeenCalledWith(expect.stringContaining('CutLog'))
    expect(close).toHaveBeenCalledOnce()
  })
})
