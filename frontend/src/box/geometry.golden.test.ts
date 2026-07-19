import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import * as G from './geometry'

// Golden fixtures captured from the original BoxBuilder.vue geometry (incl.
// bevel). Asserts the extracted module reproduces it exactly.
const goldenPath = fileURLToPath(new URL('../../../scripts/golden.json', import.meta.url))
const golden: Record<string, any> = JSON.parse(readFileSync(goldenPath, 'utf8'))

function params(c: any): G.BoxParams {
  return { w: c.W, h: c.H, d: c.D, t: c.T, kerf: c.Kerf, tabH: c.TabH, nTab: c.NTab, nShelves: c.NShelves, bevel: c.Bevel, backInset: c.BackInset ?? 0 }
}

const EPS = 1e-9
function expectPts(actual: G.Pt3[], expected: number[][], ctx: string) {
  expect(actual.length, `${ctx} length`).toBe(expected.length)
  for (let i = 0; i < actual.length; i++)
    for (let k = 0; k < 3; k++)
      expect(Math.abs(actual[i][k] - expected[i][k]), `${ctx}[${i}][${k}]`).toBeLessThan(EPS)
}
function expectHoles(actual: G.Pt3[][], expected: number[][][], ctx: string) {
  expect(actual.length, `${ctx} count`).toBe(expected.length)
  actual.forEach((h, i) => expectPts(h, expected[i], `${ctx}[${i}]`))
}

describe('box geometry matches golden fixtures', () => {
  for (const [name, c] of Object.entries(golden)) {
    it(name, () => {
      const p = params(c.params)
      const topOff = Math.max(p.bevel, 0), botOff = Math.max(-p.bevel, 0)

      // SVG paths (exact string match)
      expect(G.pathSide(p)).toBe(c.pathSide)
      expect(G.pathTopBottom(p, G.topD(p), topOff)).toBe(c.pathTop)
      expect(G.pathTopBottom(p, G.botD(p), botOff)).toBe(c.pathBottom)
      expect(G.pathBack(p)).toBe(c.pathBack)

      const ys = G.shelfSlotYs(p)
      ys.forEach((sy, i) =>
        expect(G.pathShelf(p, G.shelfDepthAt(p, sy), G.shelfOffsetAt(p, sy))).toBe(c.pathShelf_each[i]))

      // shelf math
      expect(ys.length).toBe(c.shelfSlotYs.length)
      ys.forEach((v, i) => expect(Math.abs(v - c.shelfSlotYs[i])).toBeLessThan(EPS))

      // 3D geometry
      expectPts(G.sidePts3D(p, 0), c.sidePts3D_0, `${name} sidePts3D_0`)
      expectPts(G.sidePts3D(p, p.w), c.sidePts3D_w, `${name} sidePts3D_w`)
      expectPts(G.horizPts3D(p, p.h, G.topD(p), topOff), c.horizPts3D_top, `${name} horizPts3D_top`)
      expectPts(G.horizPts3D(p, 0, G.botD(p), botOff), c.horizPts3D_bot, `${name} horizPts3D_bot`)
      expectPts(G.backPts3D(p, p.d), c.backPts3D, `${name} backPts3D`)
      ys.forEach((sy, i) =>
        expectPts(G.shelfPts3D(p, sy, G.shelfDepthAt(p, sy), G.shelfOffsetAt(p, sy)), c.shelfPts3D_each[i], `${name} shelf3D[${i}]`))
      expectHoles(G.sideHoles3D(p, 0), c.sideHoles3D_0, `${name} sideHoles_0`)
      expectHoles(G.sideHoles3D(p, p.w), c.sideHoles3D_w, `${name} sideHoles_w`)
      expectHoles(G.backHoles3D(p, p.d), c.backHoles3D, `${name} backHoles`)

      // cutting layout (positions only; feed golden's sorted piece sizes)
      const pieces = c.allPieces.map((q: any) => ({ w: q.w, h: q.h }))
      const layout = G.computeLayout(pieces, c.params.SheetW, c.params.SheetH, c.params.CutGap)
      const flat = layout.flat()
      const gflat = c.computeLayout.flat()
      expect(flat.length).toBe(gflat.length)
      flat.forEach((lp, i) => {
        expect(Math.abs(lp.x - gflat[i].x)).toBeLessThan(EPS)
        expect(Math.abs(lp.y - gflat[i].y)).toBeLessThan(EPS)
        expect(Math.abs(lp.w - gflat[i].w)).toBeLessThan(EPS)
        expect(Math.abs(lp.h - gflat[i].h)).toBeLessThan(EPS)
      })
    })
  }
})
