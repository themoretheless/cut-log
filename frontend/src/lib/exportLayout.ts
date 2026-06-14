/**
 * Export a cutting-optimizer result to machine/print formats. Produces a clean,
 * cut-oriented output (sheet outlines + piece outlines + labels), not the
 * decorative on-screen preview. Pure functions over the result model so the
 * serializers are unit-testable; the component handles the actual download.
 */
import type { CuttingResult } from '@/services/types'

const GAP = 40 // mm of empty space between stacked sheets in the combined output

function n(v: number): string {
  return (Math.round(v * 1000) / 1000).toString()
}

function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, c => (
    c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '&' ? '&amp;' : c === '"' ? '&quot;' : '&#39;'
  ))
}

/** Aggregate placements back into a parts list (one row per source piece). */
export function partsList(result: CuttingResult): { label: string; w: number; h: number; qty: number }[] {
  const byKey = new Map<string, { label: string; w: number; h: number; qty: number }>()
  for (const sheet of result.sheets) {
    for (const pp of sheet.placedPieces) {
      const w = Math.round(pp.source.width)
      const h = Math.round(pp.source.height)
      const label = pp.source.label?.trim() || '—'
      const key = `${label}|${w}x${h}`
      const row = byKey.get(key)
      if (row) row.qty++
      else byKey.set(key, { label, w, h, qty: 1 })
    }
  }
  return [...byKey.values()]
}

/** All sheets stacked vertically into one cut-ready SVG (mm units). */
export function buildLayoutSvg(result: CuttingResult): string {
  const sheets = result.sheets
  if (!sheets.length) return ''
  const maxW = Math.max(...sheets.map(s => s.width))
  const totalH = sheets.reduce((h, s) => h + s.height, 0) + GAP * (sheets.length - 1)

  let body = ''
  let oy = 0
  for (const s of sheets) {
    body += `\n  <g transform="translate(0,${n(oy)})">`
    body += `\n    <rect x="0" y="0" width="${n(s.width)}" height="${n(s.height)}" fill="none" stroke="#888888" stroke-width="1"/>`
    for (const pp of s.placedPieces) {
      body += `\n    <rect x="${n(pp.x)}" y="${n(pp.y)}" width="${n(pp.width)}" height="${n(pp.height)}" fill="${pp.source.color}" fill-opacity="0.18" stroke="#cc2222" stroke-width="0.5"/>`
      const cx = pp.x + pp.width / 2
      const cy = pp.y + pp.height / 2
      const name = pp.source.label?.trim() ? `${pp.source.label.trim()} ` : ''
      const text = `${name}${Math.round(pp.width)}×${Math.round(pp.height)}`
      const fs = Math.max(8, Math.min(pp.width, pp.height) / 8)
      body += `\n    <text x="${n(cx)}" y="${n(cy)}" font-family="sans-serif" font-size="${n(fs)}" fill="#333333" text-anchor="middle" dominant-baseline="middle">${escapeXml(text)}</text>`
    }
    body += `\n  </g>`
    oy += s.height + GAP
  }

  return `<?xml version="1.0" encoding="utf-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="${n(maxW)}mm" height="${n(totalH)}mm" ` +
    `viewBox="0 0 ${n(maxW)} ${n(totalH)}">${body}\n</svg>\n`
}

/**
 * All sheets stacked into one DXF (entities-only, LWPOLYLINE per rectangle),
 * Y-up to match CAD convention. Each sheet boundary and each placed piece is a
 * closed polyline. Widely importable (LightBurn, Fusion, Illustrator).
 */
export function buildLayoutDxf(result: CuttingResult): string {
  const sheets = result.sheets
  if (!sheets.length) return ''
  const totalH = sheets.reduce((h, s) => h + s.height, 0) + GAP * (sheets.length - 1)

  const polys: string[] = []
  // closed rectangle from a top-left (svg) origin, flipped to Y-up
  const rect = (x: number, y: number, w: number, h: number) => {
    const yb = totalH - (y + h)
    const yt = totalH - y
    polys.push(
      '0\nLWPOLYLINE\n8\n0\n90\n4\n70\n1\n' +
      `10\n${n(x)}\n20\n${n(yb)}\n` +
      `10\n${n(x + w)}\n20\n${n(yb)}\n` +
      `10\n${n(x + w)}\n20\n${n(yt)}\n` +
      `10\n${n(x)}\n20\n${n(yt)}\n`
    )
  }

  let oy = 0
  for (const s of sheets) {
    rect(0, oy, s.width, s.height)
    for (const pp of s.placedPieces) rect(pp.x, oy + pp.y, pp.width, pp.height)
    oy += s.height + GAP
  }

  return `0\nSECTION\n2\nENTITIES\n${polys.join('')}0\nENDSEC\n0\nEOF\n`
}

/** A printable HTML document: a parts table (title block) plus the layout SVG. */
export function buildPrintHtml(result: CuttingResult, opts: { title: string; layoutTitle: string; cols: [string, string, string] }): string {
  const rows = partsList(result)
    .map(r => `<tr><td>${escapeXml(r.label)}</td><td>${r.w}×${r.h} mm</td><td>${r.qty}</td></tr>`)
    .join('')
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeXml(opts.title)}</title>` +
    `<style>body{font-family:sans-serif;margin:24px;color:#111}h1{font-size:18px}h2{font-size:14px}` +
    `table{border-collapse:collapse;margin:12px 0}td,th{border:1px solid #999;padding:4px 10px;text-align:left;font-size:13px}` +
    `svg{max-width:100%;height:auto;border:1px solid #ccc}</style></head>` +
    `<body><h1>${escapeXml(opts.title)}</h1>` +
    `<table><thead><tr><th>${opts.cols.map(escapeXml).join('</th><th>')}</th></tr></thead><tbody>${rows}</tbody></table>` +
    `<h2>${escapeXml(opts.layoutTitle)}</h2>${buildLayoutSvg(result)}` +
    `<script>window.onload=function(){window.print()}<\/script></body></html>`
}
