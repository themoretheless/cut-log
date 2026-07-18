/**
 * Reactive model for the box builder page: parameters, derived dimensions,
 * piece list, cutting layout, stats and gallery entries. Pure reactive state
 * over src/box/geometry.ts — no Three.js, no DOM — so it is unit-testable.
 * Display strings are prepared by the page and injected as reactive data, so
 * this model never reaches into translation state or uses labels as identity.
 */
import { ref, computed, toValue, watch, type MaybeRefOrGetter } from 'vue'
import * as G from '@/box/geometry'
import { boxParamLimits, clampBoxParams } from '@/box/constraints'
import { SHELF_COLORS, SHELF_EDGE_COLORS, colorAt } from '@/lib/palette'

export interface BoxLabels {
  sideShort: string
  topShort: string
  bottomShort: string
  backShort: string
  shelfShort: string
  sideWall: string
  topBottomWall: string
  backWall: string
  shelf: string
}

export interface PieceInfo { id: string; w: number; h: number; label: string; color: string }
export interface LayoutPiece { sourceId: string; x: number; y: number; w: number; h: number; label: string; color: string }
export interface GalPiece {
  id: string; title: string; count: number; pw: number; ph: number
  d: string; s: number; color: string; xOff: number
}

export function useBoxModel(labelSource: MaybeRefOrGetter<BoxLabels>) {
  const labels = () => toValue(labelSource)
  // ── Parameters ────────────────────────────────────────────────────────────
  const W = ref(300)
  const H = ref(400)
  const D = ref(200)
  const T = ref(6)
  const Kerf = ref(0.1)
  const TabH = ref(30)
  const NTab = ref(1)
  const NShelves = ref(0)
  const Bevel = ref(0)

  const SheetW = ref(1220)
  const SheetH = ref(2440)
  const CutGap = ref(5)

  // Gallery selection, shared by the thumbnails, the piece ring and the
  // assembly view (the selected piece is highlighted there).
  const galIdx = ref(0)

  function rawParams(): G.BoxParams {
    return { w: W.value, h: H.value, d: D.value, t: T.value, kerf: Kerf.value, tabH: TabH.value, nTab: NTab.value, nShelves: NShelves.value, bevel: Bevel.value }
  }

  const paramLimits = computed(() => boxParamLimits(clampBoxParams(rawParams())))

  watch([W, H, D, T, Kerf, TabH, NTab, NShelves, Bevel], () => {
    const safe = clampBoxParams(rawParams())
    W.value = safe.w
    H.value = safe.h
    D.value = safe.d
    T.value = safe.t
    Kerf.value = safe.kerf
    TabH.value = safe.tabH
    NTab.value = safe.nTab
    NShelves.value = safe.nShelves
    Bevel.value = safe.bevel
  }, { flush: 'sync' })

  // ── Derived dimensions ────────────────────────────────────────────────────
  const TF = computed(() => T.value + Kerf.value)
  const Wi = computed(() => W.value - 2 * T.value)
  const Hi = computed(() => H.value - 2 * T.value)
  const SideOW = computed(() => D.value)
  const SideOff = computed(() => 0)
  const TopD = computed(() => D.value - Math.max(Bevel.value, 0))
  const BotD = computed(() => D.value - Math.max(-Bevel.value, 0))

  // ── Geometry (thin wrappers over the pure module src/box/geometry.ts) ─────
  function bp(): G.BoxParams {
    return clampBoxParams(rawParams())
  }
  const tabPositions = (L: number) => G.tabPositions(bp(), L)
  const shelfSlotYs = () => G.shelfSlotYs(bp())
  const shelfOffsetAt = (sy: number) => G.shelfOffsetAt(bp(), sy)
  const shelfDepthAt = (sy: number) => G.shelfDepthAt(bp(), sy)

  const pathSide = () => G.pathSide(bp())
  const pathTopBottom = (depth?: number, depthOff = 0) => G.pathTopBottom(bp(), depth, depthOff)
  const pathBack = () => G.pathBack(bp())
  const pathShelf = (depth?: number, depthOff = 0) => G.pathShelf(bp(), depth, depthOff)

  const sidePts3D = (x0: number) => G.sidePts3D(bp(), x0)
  const horizPts3D = (z0: number, depth?: number, yOff = 0) => G.horizPts3D(bp(), z0, depth, yOff)
  const backPts3D = (y0: number) => G.backPts3D(bp(), y0)
  const shelfPts3D = (z0: number, depth?: number, yOff = 0) => G.shelfPts3D(bp(), z0, depth, yOff)
  const sideHoles3D = (x0: number) => G.sideHoles3D(bp(), x0)
  const backHoles3D = (y0: number) => G.backHoles3D(bp(), y0)

  function shelfColor(i: number) { return colorAt(SHELF_COLORS, i) }
  function shelfEdgeColor(i: number) { return colorAt(SHELF_EDGE_COLORS, i) }

  // ── Piece data lookup by stable structural id ─────────────────────────────
  function pieceData(sourceId: string): { ow: number; oh: number; path: string; xOff: number } {
    if (sourceId.startsWith('side-')) return { ow: SideOW.value, oh: H.value, path: pathSide(), xOff: SideOff.value }
    if (sourceId === 'top') return { ow: W.value, oh: TopD.value, path: pathTopBottom(TopD.value, Math.max(Bevel.value, 0)), xOff: 0 }
    if (sourceId === 'bottom') return { ow: W.value, oh: BotD.value, path: pathTopBottom(BotD.value, Math.max(-Bevel.value, 0)), xOff: 0 }
    if (sourceId === 'back') return { ow: W.value, oh: H.value, path: pathBack(), xOff: 0 }
    const shIdx = Number.parseInt(sourceId.replace('shelf-', ''), 10)
    const sys = shelfSlotYs()
    const sy = shIdx >= 0 && shIdx < sys.length ? sys[shIdx] : 0
    const sd = shelfDepthAt(sy)
    const sOff = shelfOffsetAt(sy)
    return { ow: W.value, oh: sd, path: pathShelf(sd, sOff), xOff: 0 }
  }

  // ── Cutting layout (shelf-based FFD with rotation) ────────────────────────
  function allPieces(): PieceInfo[] {
    const text = labels()
    const list: PieceInfo[] = [
      { id: 'side-1', w: SideOW.value, h: H.value, label: `${text.sideShort}1`, color: 'var(--accent)' },
      { id: 'side-2', w: SideOW.value, h: H.value, label: `${text.sideShort}2`, color: 'var(--accent)' },
      { id: 'top', w: W.value, h: TopD.value, label: text.topShort, color: '#27ae60' },
      { id: 'bottom', w: W.value, h: BotD.value, label: text.bottomShort, color: Bevel.value !== 0 ? '#1abc9c' : '#27ae60' },
      { id: 'back', w: W.value, h: H.value, label: text.backShort, color: '#a855f7' },
    ]
    const sys = shelfSlotYs()
    for (let i = 0; i < sys.length; i++) {
      const sd = shelfDepthAt(sys[i])
      list.push({ id: `shelf-${i}`, w: W.value, h: sd, label: `${text.shelfShort}${i + 1}`, color: Bevel.value !== 0 ? shelfColor(i) : '#e67e22' })
    }
    list.sort((a, b) => b.w * b.h - a.w * a.h)
    return list
  }

  function computeLayout(): LayoutPiece[][] {
    return G.computeLayout(allPieces(), SheetW.value, SheetH.value, CutGap.value)
      .map(sheet => sheet.map(s => ({ sourceId: s.piece.id, x: s.x, y: s.y, w: s.w, h: s.h, label: s.piece.label, color: s.piece.color })))
  }

  const cuttingSheets = computed(() => computeLayout())
  const cuttingPieces = computed(() => allPieces())

  const cutStats = computed(() => {
    const sheets = cuttingSheets.value
    const all = cuttingPieces.value
    const totalPieceArea = all.reduce((s, p) => s + p.w * p.h, 0)
    const totalSheetArea = sheets.length * SheetW.value * SheetH.value
    const util = totalSheetArea > 0 ? (totalPieceArea / totalSheetArea * 100) : 0
    return {
      sheets: sheets.length,
      pieceArea: (totalPieceArea / 1e6).toFixed(4),
      sheetArea: (totalSheetArea / 1e6).toFixed(4),
      util: util.toFixed(1),
    }
  })

  const cutScale = computed(() => Math.min(480 / SheetW.value, 480 / SheetH.value))

  const tooBigPieces = computed(() => {
    const all = cuttingPieces.value
    const g = CutGap.value
    const sw = SheetW.value
    const sh = SheetH.value
    return all.filter(p =>
      (p.w > sw - 2 * g || p.h > sh - 2 * g) &&
      (p.h > sw - 2 * g || p.w > sh - 2 * g)
    )
  })

  // ── Gallery entries ───────────────────────────────────────────────────────
  const galPieces = computed<GalPiece[]>(() => {
    const bv = Bevel.value
    const text = labels()
    // Paths and thumb scales are computed eagerly so re-renders reuse them.
    const thumb = (pw: number, ph: number) => G.svgScale(pw, ph) * 0.22
    const list: GalPiece[] = [
      { id: 'side', title: text.sideWall, count: 2, pw: SideOW.value, ph: H.value, d: pathSide(), s: thumb(SideOW.value, H.value), color: 'var(--accent)', xOff: SideOff.value },
    ]
    if (bv === 0) {
      list.push({ id: 'tb', title: text.topBottomWall, count: 2, pw: W.value, ph: D.value, d: pathTopBottom(), s: thumb(W.value, D.value), color: '#27ae60', xOff: 0 })
    } else {
      const topOff = Math.max(bv, 0), botOff = Math.max(-bv, 0)
      list.push({ id: 'top', title: text.topShort, count: 1, pw: W.value, ph: TopD.value, d: pathTopBottom(TopD.value, topOff), s: thumb(W.value, TopD.value), color: '#27ae60', xOff: 0 })
      list.push({ id: 'bot', title: text.bottomShort, count: 1, pw: W.value, ph: BotD.value, d: pathTopBottom(BotD.value, botOff), s: thumb(W.value, BotD.value), color: '#1abc9c', xOff: 0 })
    }
    list.push({ id: 'back', title: text.backWall, count: 1, pw: W.value, ph: H.value, d: pathBack(), s: thumb(W.value, H.value), color: '#a855f7', xOff: 0 })
    const sys = shelfSlotYs()
    if (bv === 0 && sys.length > 0) {
      list.push({ id: 'shelf', title: text.shelf, count: sys.length, pw: W.value, ph: D.value, d: pathShelf(), s: thumb(W.value, D.value), color: '#e67e22', xOff: 0 })
    } else {
      for (let i = 0; i < sys.length; i++) {
        const sd = shelfDepthAt(sys[i])
        const sOff = shelfOffsetAt(sys[i])
        list.push({ id: `shelf${i}`, title: `${text.shelfShort}${i + 1}`, count: 1, pw: W.value, ph: sd, d: pathShelf(sd, sOff), s: thumb(W.value, sd), color: shelfColor(i), xOff: 0 })
      }
    }
    return list
  })

  // Keep the selected gallery index in range: galPieces shrinks when the bevel
  // toggles or the shelf count drops, and a stale galIdx would otherwise crash
  // the gallery template (galPieces[galIdx].title on an out-of-range index).
  watch(() => galPieces.value.length, (len) => {
    if (galIdx.value > len - 1) galIdx.value = Math.max(0, len - 1)
  })

  // pieceData rebuilds the full SVG path, so the cut-sheet template reads it
  // through this cache (one entry per stable source) instead of per render.
  const pieceDataById = computed(() => {
    const m = new Map<string, ReturnType<typeof pieceData>>()
    for (const p of cuttingPieces.value) {
      m.set(p.id, pieceData(p.id))
    }
    return m
  })

  function getCutSheetTransform(p: LayoutPiece): string {
    const pd = pieceDataById.value.get(p.sourceId) ?? pieceData(p.sourceId)
    const rotated = Math.abs(p.w - pd.oh) < 1 && Math.abs(p.h - pd.ow) < 1
    const bvOff = pd.xOff
    return rotated
      ? `translate(${(p.x + bvOff).toFixed(2)},${(p.y + pd.ow).toFixed(2)}) rotate(90)`
      : `translate(${(p.x + bvOff).toFixed(2)},${p.y.toFixed(2)})`
  }

  function getCutSheetPath(p: LayoutPiece): string {
    return (pieceDataById.value.get(p.sourceId) ?? pieceData(p.sourceId)).path
  }

  return {
    // parameters
    W, H, D, T, Kerf, TabH, NTab, NShelves, Bevel, SheetW, SheetH, CutGap, galIdx, paramLimits,
    // derived dimensions
    TF, Wi, Hi, SideOW, SideOff, TopD, BotD,
    // geometry wrappers
    tabPositions, shelfSlotYs, shelfOffsetAt, shelfDepthAt,
    pathSide, pathTopBottom, pathBack, pathShelf,
    sidePts3D, horizPts3D, backPts3D, shelfPts3D, sideHoles3D, backHoles3D,
    shelfColor, shelfEdgeColor,
    // pieces / layout / stats
    pieceData, allPieces, cuttingSheets, cuttingPieces, cutStats, cutScale, tooBigPieces,
    // gallery
    galPieces,
    // cut-sheet rendering helpers
    getCutSheetTransform, getCutSheetPath,
  }
}

export type BoxModel = ReturnType<typeof useBoxModel>
