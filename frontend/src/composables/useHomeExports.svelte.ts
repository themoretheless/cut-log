import { downloadFile } from '@/lib/downloadFile'
import { buildLayoutDxf, buildLayoutSvg, buildPrintHtml } from '@/lib/exportLayout'
import { buildPiecesCsv } from '@/lib/piecesCsv'
import type { CutPiece, CuttingResult } from '@/services/types'

interface PrintWindow {
  document: {
    write(html: string): void
    close(): void
  }
}

interface HomeExportsOptions {
  pieces: () => readonly CutPiece[]
  result: () => CuttingResult | null
  translate: (key: string) => string
  download?: typeof downloadFile
  openWindow?: () => PrintWindow | null
}

export function useHomeExports(options: HomeExportsOptions) {
  const download = options.download ?? downloadFile

  function exportPiecesCsv(): boolean {
    const pieces = options.pieces()
    if (!pieces.length) return false
    download('cutlog-parts.csv', buildPiecesCsv([...pieces]), 'text/csv;charset=utf-8')
    return true
  }

  function exportSvg(): boolean {
    const result = options.result()
    if (!result) return false
    download('cutlog-layout.svg', buildLayoutSvg(result), 'image/svg+xml')
    return true
  }

  function exportDxf(): boolean {
    const result = options.result()
    if (!result) return false
    download('cutlog-layout.dxf', buildLayoutDxf(result), 'application/dxf')
    return true
  }

  function printLayout(): boolean {
    const result = options.result()
    if (!result) return false
    const html = buildPrintHtml(result, {
      title: options.translate('app.title'),
      layoutTitle: options.translate('export.layout'),
      cols: [options.translate('name'), options.translate('export.size'), options.translate('quantity')],
    })
    const printWindow = options.openWindow ? options.openWindow() : window.open('', '_blank')
    if (!printWindow) return false
    printWindow.document.write(html)
    printWindow.document.close()
    return true
  }

  return { exportPiecesCsv, exportSvg, exportDxf, printLayout }
}
