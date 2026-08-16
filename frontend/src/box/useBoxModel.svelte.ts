/**
 * Reactive model for the box builder page: parameters, derived dimensions,
 * piece list, cutting layout, stats and gallery entries. Pure reactive state
 * over src/box/geometry.ts - no Three.js, no DOM - so it is unit-testable.
 * Display strings are prepared by the page and injected as reactive data, so
 * this model never reaches into translation state or uses labels as identity.
 *
 * Svelte 5 runes port of the Vue composable: parameters live in a $state
 * container and are exposed through getters/setters on the returned object,
 * so callers read `model.W` and assign `model.W = 300` (bindable). Clamping
 * that Vue did in a sync watch happens inside the setters instead.
 */
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

export function useBoxModel(labelSource: BoxLabels | (() => BoxLabels)) {
  const labels = typeof labelSource === 'function' ? labelSource : () => labelSource

  // ── Parameters ────────────────────────────────────────────────────────────
  const p = $state({
    W: 300,
    H: 400,
    D: 200,
    T: 6,
    Kerf: 0.1,
    TabH: 30,
    NTab: 1,
    NShelves: 0,
    Bevel: 0,
    BackInset: 0,
    SheetW: 1220,
    SheetH: 2440,
    CutGap: 5,
    // Gallery selection, shared by the thumbnails, the piece ring and the
    // assembly view (the selected piece is highlighted there).
    galIdx: 0,
  })

  function rawParams(): G.BoxParams {
    return { w: p.W, h: p.H, d: p.D, t: p.T, kerf: p.Kerf, tabH: p.TabH, nTab: p.NTab, nShelves: p.NShelves, bevel: p.Bevel, backInset: p.BackInset }
  }

  // Interdependent box parameters are clamped together on every write
  // (the Vue version did this in a flush:'sync' watch).
  function clampAll() {
    const safe = clampBoxParams(rawParams())
    p.W = safe.w
    p.H = safe.h
    p.D = safe.d
    p.T = safe.t
    p.Kerf = safe.kerf
    p.TabH = safe.tabH
    p.NTab = safe.nTab
    p.NShelves = safe.nShelves
    p.Bevel = safe.bevel
    p.BackInset = safe.backInset
  }

  const paramLimits = $derived(boxParamLimits(clampBoxParams(rawParams())))
  const backInsetStep = $derived.by(() => {
    const min = paramLimits.minBackInset
    return min > 0 && p.BackInset <= min ? min : 1
  })

  // ── Derived dimensions ────────────────────────────────────────────────────
  const TF = $derived(p.T + p.Kerf)
  const Wi = $derived(p.W - 2 * p.T)
  const Hi = $derived(p.H - 2 * p.T)
  const SideOW = $derived(p.D)
  const SideOff = $derived(0)
  const TopD = $derived(p.D - Math.max(p.Bevel, 0))
  const BotD = $derived(p.D - Math.max(-p.Bevel, 0))
  const BackD = $derived(p.D - p.BackInset)

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
  const horizHoles3D = (z0: number, depth?: number, yOff = 0) => G.horizHoles3D(bp(), z0, depth, yOff)

  function shelfColor(i: number) { return colorAt(SHELF_COLORS, i) }
  function shelfEdgeColor(i: number) { return colorAt(SHELF_EDGE_COLORS, i) }

  // ── Piece data lookup by stable structural id ─────────────────────────────
  function pieceData(sourceId: string): { ow: number; oh: number; path: string; xOff: number } {
    if (sourceId.startsWith('side-')) return { ow: SideOW, oh: p.H, path: pathSide(), xOff: SideOff }
    if (sourceId === 'top') return { ow: p.W, oh: TopD, path: pathTopBottom(TopD, Math.max(p.Bevel, 0)), xOff: 0 }
    if (sourceId === 'bottom') return { ow: p.W, oh: BotD, path: pathTopBottom(BotD, Math.max(-p.Bevel, 0)), xOff: 0 }
    if (sourceId === 'back') return { ow: p.W, oh: p.H, path: pathBack(), xOff: 0 }
    const shIdx = Number.parseInt(sourceId.replace('shelf-', ''), 10)
    const sys = shelfSlotYs()
    const sy = shIdx >= 0 && shIdx < sys.length ? sys[shIdx] : 0
    const sd = shelfDepthAt(sy)
    const sOff = shelfOffsetAt(sy)
    return { ow: p.W, oh: sd, path: pathShelf(sd, sOff), xOff: 0 }
  }

  // ── Cutting layout (shelf-based FFD with rotation) ────────────────────────
  function allPieces(): PieceInfo[] {
    const text = labels()
    const list: PieceInfo[] = [
      { id: 'side-1', w: SideOW, h: p.H, label: `${text.sideShort}1`, color: 'var(--accent)' },
      { id: 'side-2', w: SideOW, h: p.H, label: `${text.sideShort}2`, color: 'var(--accent)' },
      { id: 'top', w: p.W, h: TopD, label: text.topShort, color: '#27ae60' },
      { id: 'bottom', w: p.W, h: BotD, label: text.bottomShort, color: p.Bevel !== 0 ? '#1abc9c' : '#27ae60' },
      { id: 'back', w: p.W, h: p.H, label: text.backShort, color: '#a855f7' },
    ]
    const sys = shelfSlotYs()
    for (let i = 0; i < sys.length; i++) {
      const sd = shelfDepthAt(sys[i])
      list.push({ id: `shelf-${i}`, w: p.W, h: sd, label: `${text.shelfShort}${i + 1}`, color: p.Bevel !== 0 ? shelfColor(i) : '#e67e22' })
    }
    list.sort((a, b) => b.w * b.h - a.w * a.h)
    return list
  }

  function computeLayout(): LayoutPiece[][] {
    return G.computeLayout(allPieces(), p.SheetW, p.SheetH, p.CutGap)
      .map(sheet => sheet.map(s => ({ sourceId: s.piece.id, x: s.x, y: s.y, w: s.w, h: s.h, label: s.piece.label, color: s.piece.color })))
  }

  const cuttingSheets = $derived(computeLayout())
  const cuttingPieces = $derived(allPieces())

  const cutStats = $derived.by(() => {
    const sheets = cuttingSheets
    const all = cuttingPieces
    const totalPieceArea = all.reduce((s, pc) => s + pc.w * pc.h, 0)
    const totalSheetArea = sheets.length * p.SheetW * p.SheetH
    const util = totalSheetArea > 0 ? (totalPieceArea / totalSheetArea * 100) : 0
    return {
      sheets: sheets.length,
      pieceArea: (totalPieceArea / 1e6).toFixed(4),
      sheetArea: (totalSheetArea / 1e6).toFixed(4),
      util: util.toFixed(1),
    }
  })

  const cutScale = $derived(Math.min(480 / p.SheetW, 480 / p.SheetH))

  const tooBigPieces = $derived.by(() => {
    const all = cuttingPieces
    const g = p.CutGap
    const sw = p.SheetW
    const sh = p.SheetH
    return all.filter(pc =>
      (pc.w > sw - 2 * g || pc.h > sh - 2 * g) &&
      (pc.h > sw - 2 * g || pc.w > sh - 2 * g)
    )
  })

  // ── Gallery entries ───────────────────────────────────────────────────────
  const galPieces = $derived.by<GalPiece[]>(() => {
    const bv = p.Bevel
    const text = labels()
    // Paths and thumb scales are computed eagerly so re-renders reuse them.
    const thumb = (pw: number, ph: number) => G.svgScale(pw, ph) * 0.22
    const list: GalPiece[] = [
      { id: 'side', title: text.sideWall, count: 2, pw: SideOW, ph: p.H, d: pathSide(), s: thumb(SideOW, p.H), color: 'var(--accent)', xOff: SideOff },
    ]
    if (bv === 0) {
      list.push({ id: 'tb', title: text.topBottomWall, count: 2, pw: p.W, ph: p.D, d: pathTopBottom(), s: thumb(p.W, p.D), color: '#27ae60', xOff: 0 })
    } else {
      const topOff = Math.max(bv, 0), botOff = Math.max(-bv, 0)
      list.push({ id: 'top', title: text.topShort, count: 1, pw: p.W, ph: TopD, d: pathTopBottom(TopD, topOff), s: thumb(p.W, TopD), color: '#27ae60', xOff: 0 })
      list.push({ id: 'bot', title: text.bottomShort, count: 1, pw: p.W, ph: BotD, d: pathTopBottom(BotD, botOff), s: thumb(p.W, BotD), color: '#1abc9c', xOff: 0 })
    }
    list.push({ id: 'back', title: text.backWall, count: 1, pw: p.W, ph: p.H, d: pathBack(), s: thumb(p.W, p.H), color: '#a855f7', xOff: 0 })
    const sys = shelfSlotYs()
    if (bv === 0 && sys.length > 0) {
      list.push({ id: 'shelf', title: text.shelf, count: sys.length, pw: p.W, ph: BackD, d: pathShelf(), s: thumb(p.W, BackD), color: '#e67e22', xOff: 0 })
    } else {
      for (let i = 0; i < sys.length; i++) {
        const sd = shelfDepthAt(sys[i])
        const sOff = shelfOffsetAt(sys[i])
        list.push({ id: `shelf${i}`, title: `${text.shelfShort}${i + 1}`, count: 1, pw: p.W, ph: sd, d: pathShelf(sd, sOff), s: thumb(p.W, sd), color: shelfColor(i), xOff: 0 })
      }
    }
    return list
  })

  // pieceData rebuilds the full SVG path, so the cut-sheet template reads it
  // through this cache (one entry per stable source) instead of per render.
  const pieceDataById = $derived.by(() => {
    const m = new Map<string, ReturnType<typeof pieceData>>()
    for (const pc of cuttingPieces) {
      m.set(pc.id, pieceData(pc.id))
    }
    return m
  })

  function getCutSheetTransform(lp: LayoutPiece): string {
    const pd = pieceDataById.get(lp.sourceId) ?? pieceData(lp.sourceId)
    const rotated = Math.abs(lp.w - pd.oh) < 1 && Math.abs(lp.h - pd.ow) < 1
    const bvOff = pd.xOff
    return rotated
      ? `translate(${(lp.x + bvOff).toFixed(2)},${(lp.y + pd.ow).toFixed(2)}) rotate(90)`
      : `translate(${(lp.x + bvOff).toFixed(2)},${lp.y.toFixed(2)})`
  }

  function getCutSheetPath(lp: LayoutPiece): string {
    return (pieceDataById.get(lp.sourceId) ?? pieceData(lp.sourceId)).path
  }

  return {
    // parameters (bindable getter/setter pairs)
    get W() { return p.W },
    set W(v: number) { p.W = v; clampAll() },
    get H() { return p.H },
    set H(v: number) { p.H = v; clampAll() },
    get D() { return p.D },
    set D(v: number) { p.D = v; clampAll() },
    get T() { return p.T },
    set T(v: number) { p.T = v; clampAll() },
    get Kerf() { return p.Kerf },
    set Kerf(v: number) { p.Kerf = v; clampAll() },
    get TabH() { return p.TabH },
    set TabH(v: number) { p.TabH = v; clampAll() },
    get NTab() { return p.NTab },
    set NTab(v: number) { p.NTab = v; clampAll() },
    get NShelves() { return p.NShelves },
    set NShelves(v: number) { p.NShelves = v; clampAll() },
    get Bevel() { return p.Bevel },
    set Bevel(v: number) { p.Bevel = v; clampAll() },
    get BackInset() { return p.BackInset },
    set BackInset(v: number) { p.BackInset = v; clampAll() },
    get SheetW() { return p.SheetW },
    set SheetW(v: number) { p.SheetW = v },
    get SheetH() { return p.SheetH },
    set SheetH(v: number) { p.SheetH = v },
    get CutGap() { return p.CutGap },
    set CutGap(v: number) { p.CutGap = v },
    // The selection as chosen. Reading it must not depend on galPieces:
    // watchers of the selection would then also fire on every parameter
    // change, rebuilding both Three.js scenes a second time.
    get galIdx() { return p.galIdx },
    set galIdx(v: number) { p.galIdx = v },
    // The selection to render with. galPieces shrinks when the bevel toggles
    // or the shelf count drops, and a stale index would otherwise index past
    // the end of the gallery.
    get activeGalIdx() { return Math.max(0, Math.min(p.galIdx, galPieces.length - 1)) },
    get paramLimits() { return paramLimits },
    get backInsetStep() { return backInsetStep },
    // derived dimensions
    get TF() { return TF },
    get Wi() { return Wi },
    get Hi() { return Hi },
    get SideOW() { return SideOW },
    get SideOff() { return SideOff },
    get TopD() { return TopD },
    get BotD() { return BotD },
    get BackD() { return BackD },
    // geometry wrappers
    tabPositions, shelfSlotYs, shelfOffsetAt, shelfDepthAt,
    pathSide, pathTopBottom, pathBack, pathShelf,
    sidePts3D, horizPts3D, backPts3D, shelfPts3D, sideHoles3D, backHoles3D, horizHoles3D,
    shelfColor, shelfEdgeColor,
    // pieces / layout / stats
    pieceData, allPieces,
    get cuttingSheets() { return cuttingSheets },
    get cuttingPieces() { return cuttingPieces },
    get cutStats() { return cutStats },
    get cutScale() { return cutScale },
    get tooBigPieces() { return tooBigPieces },
    // gallery
    get galPieces() { return galPieces },
    // cut-sheet rendering helpers
    getCutSheetTransform, getCutSheetPath,
  }
}

export type BoxModel = ReturnType<typeof useBoxModel>
