use serde::{Deserialize, Serialize};
use tracing::{debug, info, instrument, warn};

use crate::models::*;

// ── Enums ─────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum FitHeuristic {
    BestArea,
    BestShortSide,
    BestLongSide,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SortOrder {
    AreaDesc,
    MaxSideDesc,
    PerimeterDesc,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[repr(u8)]
pub enum CuttingStrategy {
    Auto = 0,
    BestAreaAreaDesc = 1,
    BestAreaMaxSideDesc = 2,
    BestAreaPerimeterDesc = 3,
    BestShortSideAreaDesc = 4,
    BestShortSideMaxSideDesc = 5,
    BestShortSidePerimeterDesc = 6,
    BestLongSideAreaDesc = 7,
    BestLongSideMaxSideDesc = 8,
    BestLongSidePerimeterDesc = 9,
}

impl TryFrom<u8> for CuttingStrategy {
    type Error = u8;

    fn try_from(v: u8) -> Result<Self, Self::Error> {
        match v {
            0 => Ok(Self::Auto),
            1 => Ok(Self::BestAreaAreaDesc),
            2 => Ok(Self::BestAreaMaxSideDesc),
            3 => Ok(Self::BestAreaPerimeterDesc),
            4 => Ok(Self::BestShortSideAreaDesc),
            5 => Ok(Self::BestShortSideMaxSideDesc),
            6 => Ok(Self::BestShortSidePerimeterDesc),
            7 => Ok(Self::BestLongSideAreaDesc),
            8 => Ok(Self::BestLongSideMaxSideDesc),
            9 => Ok(Self::BestLongSidePerimeterDesc),
            _ => Err(v),
        }
    }
}

impl From<CuttingStrategy> for u8 {
    fn from(s: CuttingStrategy) -> u8 {
        s as u8
    }
}

// ── Strategy helpers ──────────────────────────────────────────────────────────

const ALL_STRATEGIES: [(FitHeuristic, SortOrder, CuttingStrategy); 9] = [
    (FitHeuristic::BestArea, SortOrder::AreaDesc, CuttingStrategy::BestAreaAreaDesc),
    (FitHeuristic::BestArea, SortOrder::MaxSideDesc, CuttingStrategy::BestAreaMaxSideDesc),
    (FitHeuristic::BestArea, SortOrder::PerimeterDesc, CuttingStrategy::BestAreaPerimeterDesc),
    (FitHeuristic::BestShortSide, SortOrder::AreaDesc, CuttingStrategy::BestShortSideAreaDesc),
    (FitHeuristic::BestShortSide, SortOrder::MaxSideDesc, CuttingStrategy::BestShortSideMaxSideDesc),
    (FitHeuristic::BestShortSide, SortOrder::PerimeterDesc, CuttingStrategy::BestShortSidePerimeterDesc),
    (FitHeuristic::BestLongSide, SortOrder::AreaDesc, CuttingStrategy::BestLongSideAreaDesc),
    (FitHeuristic::BestLongSide, SortOrder::MaxSideDesc, CuttingStrategy::BestLongSideMaxSideDesc),
    (FitHeuristic::BestLongSide, SortOrder::PerimeterDesc, CuttingStrategy::BestLongSidePerimeterDesc),
];

fn decompose(s: CuttingStrategy) -> (FitHeuristic, SortOrder) {
    ALL_STRATEGIES.iter()
        .find(|(_, _, cs)| *cs == s)
        .map(|&(fit, sort, _)| (fit, sort))
        .unwrap_or((FitHeuristic::BestArea, SortOrder::AreaDesc))
}

fn compose(fit: FitHeuristic, sort: SortOrder) -> CuttingStrategy {
    ALL_STRATEGIES.iter()
        .find(|(f, s, _)| *f == fit && *s == sort)
        .map(|&(_, _, cs)| cs)
        .expect("invalid fit/sort combination")
}

// ── FreeRect ──────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Copy)]
struct FreeRect {
    x: f64,
    y: f64,
    w: f64,
    h: f64,
}

// Free rects of one sheet plus an upper bound on their dimensions, so whole
// sheets can be skipped without scanning every rect.
#[derive(Debug, Clone, Default)]
struct SheetSpace {
    free: Vec<FreeRect>,
    max_w: f64,
    max_h: f64,
}

impl SheetSpace {
    fn new(rect: FreeRect) -> Self {
        Self { free: vec![rect], max_w: rect.w, max_h: rect.h }
    }

    fn refresh_bounds(&mut self) {
        self.max_w = 0.0;
        self.max_h = 0.0;
        for fr in &self.free {
            if fr.w > self.max_w { self.max_w = fr.w; }
            if fr.h > self.max_h { self.max_h = fr.h; }
        }
    }

    // Necessary (not sufficient) condition for the piece to fit somewhere on
    // this sheet; false means no free rect can hold it in any orientation.
    fn might_fit(&self, piece: &CutPiece, kerf: f64) -> bool {
        let pw = piece.width + kerf;
        let ph = piece.height + kerf;
        (pw <= self.max_w && ph <= self.max_h)
            || (piece.allow_rotation && ph <= self.max_w && pw <= self.max_h)
    }
}

// Constants threaded through the packing of a single strategy run.
#[derive(Debug, Clone, Copy)]
struct PackCtx {
    sheet_w: f64,
    sheet_h: f64,
    kerf: f64,
    heuristic: FitHeuristic,
    min_dim: f64,
}

// ── Optimizer ─────────────────────────────────────────────────────────────────

#[instrument(skip(pieces), fields(pieces_count = pieces.len()))]
pub fn optimize(
    sheet_width: f64,
    sheet_height: f64,
    pieces: &[CutPiece],
    kerf: f64,
    strategy: CuttingStrategy,
) -> CuttingResult {
    info!(sheet_width, sheet_height, kerf, ?strategy, pieces = pieces.len(), "starting optimization");

    if pieces.is_empty() {
        debug!("no pieces, returning empty result");
        return CuttingResult::new(strategy);
    }

    let result = if strategy == CuttingStrategy::Auto {
        run_auto(sheet_width, sheet_height, pieces, kerf)
    } else {
        let (fit, sort) = decompose(strategy);
        run_single(sheet_width, sheet_height, pieces, kerf, fit, sort)
    };

    info!(
        sheets = result.total_sheets(),
        efficiency = format!("{:.1}%", result.overall_efficiency()),
        unplaced = result.unplaced_pieces.len(),
        ?result.strategy,
        "optimization complete"
    );
    result
}

#[instrument(skip(pieces))]
fn run_auto(
    sheet_width: f64,
    sheet_height: f64,
    pieces: &[CutPiece],
    kerf: f64,
) -> CuttingResult {
    debug!("trying all 9 strategies");
    let mut best: Option<CuttingResult> = None;
    let mut best_strategy = CuttingStrategy::Auto;

    // Only the sort order shapes the queue, so the three queues are built
    // once and shared by the nine fit/sort combinations.
    let queues = [
        build_queue(pieces, SortOrder::AreaDesc),
        build_queue(pieces, SortOrder::MaxSideDesc),
        build_queue(pieces, SortOrder::PerimeterDesc),
    ];
    let queue_for = |sort: SortOrder| match sort {
        SortOrder::AreaDesc => &queues[0],
        SortOrder::MaxSideDesc => &queues[1],
        SortOrder::PerimeterDesc => &queues[2],
    };

    for &(fit, sort, _) in &ALL_STRATEGIES {
        let result = run_packed(sheet_width, sheet_height, queue_for(sort), kerf, fit, sort);
        debug!(
            ?fit, ?sort,
            sheets = result.total_sheets(),
            efficiency = format!("{:.1}%", result.overall_efficiency()),
            "strategy result"
        );
        if best.as_ref().is_none_or(|b| is_better(&result, b)) {
            best_strategy = result.strategy;
            best = Some(result);
        }
    }

    info!(?best_strategy, "auto picked best strategy");
    let mut best = best.unwrap();
    best.auto_picked_strategy = Some(best_strategy);
    best.strategy = CuttingStrategy::Auto;
    best
}

fn is_better(candidate: &CuttingResult, current: &CuttingResult) -> bool {
    if candidate.unplaced_pieces.len() != current.unplaced_pieces.len() {
        return candidate.unplaced_pieces.len() < current.unplaced_pieces.len();
    }
    if candidate.total_sheets() != current.total_sheets() {
        return candidate.total_sheets() < current.total_sheets();
    }
    candidate.overall_efficiency() > current.overall_efficiency()
}

fn build_queue(pieces: &[CutPiece], sort_order: SortOrder) -> Vec<&CutPiece> {
    let mut queue: Vec<(f64, &CutPiece)> = pieces
        .iter()
        .flat_map(|p| std::iter::repeat_n(p, p.quantity as usize))
        .map(|p| {
            let key = match sort_order {
                SortOrder::AreaDesc => p.width * p.height,
                SortOrder::MaxSideDesc => p.width.max(p.height),
                SortOrder::PerimeterDesc => p.width + p.height,
            };
            (key, p)
        })
        .collect();

    queue.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
    queue.into_iter().map(|(_, p)| p).collect()
}

#[instrument(skip(pieces), fields(?heuristic, ?sort_order))]
fn run_single(
    sheet_width: f64,
    sheet_height: f64,
    pieces: &[CutPiece],
    kerf: f64,
    heuristic: FitHeuristic,
    sort_order: SortOrder,
) -> CuttingResult {
    let queue = build_queue(pieces, sort_order);
    run_packed(sheet_width, sheet_height, &queue, kerf, heuristic, sort_order)
}

fn run_packed(
    sheet_width: f64,
    sheet_height: f64,
    queue: &[&CutPiece],
    kerf: f64,
    heuristic: FitHeuristic,
    sort_order: SortOrder,
) -> CuttingResult {
    let mut result = CuttingResult::new(compose(heuristic, sort_order));

    if queue.is_empty() {
        return result;
    }

    // Free rects narrower than the smallest piece dimension can never hold
    // anything; dropping them keeps every scan list short.
    let min_dim = queue
        .iter()
        .map(|p| p.width.min(p.height) + kerf)
        .fold(f64::MAX, f64::min);

    let ctx = PackCtx {
        sheet_w: sheet_width,
        sheet_h: sheet_height,
        kerf,
        heuristic,
        min_dim,
    };
    let mut sheet_free_rects: Vec<SheetSpace> = Vec::new();

    for &piece in queue {
        if try_place_on_existing(&mut result, &mut sheet_free_rects, piece, &ctx) {
            continue;
        }

        if !fits_on_blank(piece, &ctx) {
            warn!(label = %piece.label, width = piece.width, height = piece.height, "piece too large, cannot place");
            result.unplaced_pieces.push(unplaced(piece));
            continue;
        }

        debug!(width = piece.width, height = piece.height, sheet = result.sheets.len(), "opening new sheet");
        open_new_sheet_and_place(&mut result, &mut sheet_free_rects, piece, &ctx);
    }

    result
}

fn unplaced(piece: &CutPiece) -> UnplacedPiece {
    UnplacedPiece { label: piece.label.clone(), width: piece.width, height: piece.height }
}

fn try_place_on_existing(
    result: &mut CuttingResult,
    sheet_free_rects: &mut [SheetSpace],
    piece: &CutPiece,
    ctx: &PackCtx,
) -> bool {
    for (si, space) in sheet_free_rects.iter_mut().enumerate() {
        if !space.might_fit(piece, ctx.kerf) {
            continue;
        }
        if let Some((fit_idx, rotated)) = find_best_fit(&space.free, piece, ctx) {
            let fit = space.free[fit_idx];
            place_piece(&mut result.sheets[si], space, fit_idx, fit, piece, rotated, ctx);
            return true;
        }
    }
    false
}

fn fits_on_blank(piece: &CutPiece, ctx: &PackCtx) -> bool {
    (piece.width <= ctx.sheet_w && piece.height <= ctx.sheet_h)
        || (piece.allow_rotation && piece.height <= ctx.sheet_w && piece.width <= ctx.sheet_h)
}

fn open_new_sheet_and_place(
    result: &mut CuttingResult,
    sheet_free_rects: &mut Vec<SheetSpace>,
    piece: &CutPiece,
    ctx: &PackCtx,
) {
    sheet_free_rects.push(SheetSpace::new(FreeRect { x: 0.0, y: 0.0, w: ctx.sheet_w, h: ctx.sheet_h }));

    let sheet = Sheet {
        index: result.sheets.len(),
        width: ctx.sheet_w,
        height: ctx.sheet_h,
        placed_pieces: Vec::new(),
    };
    result.sheets.push(sheet);

    let si = sheet_free_rects.len() - 1;
    if let Some((fit_idx, rotated)) = find_best_fit(&sheet_free_rects[si].free, piece, ctx) {
        let fit = sheet_free_rects[si].free[fit_idx];
        place_piece(&mut result.sheets[si], &mut sheet_free_rects[si], fit_idx, fit, piece, rotated, ctx);
    } else {
        result.unplaced_pieces.push(unplaced(piece));
    }
}

fn place_piece(
    sheet: &mut Sheet,
    space: &mut SheetSpace,
    fit_idx: usize,
    fit: FreeRect,
    piece: &CutPiece,
    rotated: bool,
    ctx: &PackCtx,
) {
    let (pw, ph) = if rotated {
        (piece.height, piece.width)
    } else {
        (piece.width, piece.height)
    };

    sheet.placed_pieces.push(PlacedPiece {
        source_id: piece.id,
        label: piece.label.clone(),
        color: piece.color.clone(),
        x: fit.x,
        y: fit.y,
        width: pw,
        height: ph,
        is_rotated: rotated,
    });

    split_free_rect(&mut space.free, fit_idx, pw + ctx.kerf, ph + ctx.kerf, ctx.min_dim);
    space.refresh_bounds();
}

fn find_best_fit(
    free_rects: &[FreeRect],
    piece: &CutPiece,
    ctx: &PackCtx,
) -> Option<(usize, bool)> {
    let mut best_idx: Option<usize> = None;
    let mut best_rotated = false;
    let mut best_score = f64::MAX;

    let pw = piece.width + ctx.kerf;
    let ph = piece.height + ctx.kerf;

    for (i, fr) in free_rects.iter().enumerate() {
        if pw <= fr.w && ph <= fr.h {
            let score = calc_score(fr, piece.width, piece.height, ctx.heuristic);
            if score < best_score {
                best_score = score;
                best_idx = Some(i);
                best_rotated = false;
            }
        }

        if piece.allow_rotation && ph <= fr.w && pw <= fr.h {
            let score = calc_score(fr, piece.height, piece.width, ctx.heuristic);
            if score < best_score {
                best_score = score;
                best_idx = Some(i);
                best_rotated = true;
            }
        }
    }

    best_idx.map(|idx| (idx, best_rotated))
}

fn calc_score(fr: &FreeRect, pw: f64, ph: f64, heuristic: FitHeuristic) -> f64 {
    match heuristic {
        FitHeuristic::BestArea => fr.w * fr.h - pw * ph,
        FitHeuristic::BestShortSide => (fr.w - pw).min(fr.h - ph),
        FitHeuristic::BestLongSide => (fr.w - pw).max(fr.h - ph),
    }
}

fn split_free_rect(free_rects: &mut Vec<FreeRect>, idx: usize, pw: f64, ph: f64, min_dim: f64) {
    let used = free_rects.remove(idx);

    let right_w = used.w - pw;
    let bottom_h = used.h - ph;

    // A rect with either side below min_dim can never hold any piece, so it
    // is dropped instead of polluting future scans.
    let mut push = |r: FreeRect| {
        if r.w >= min_dim && r.h >= min_dim {
            free_rects.push(r);
        }
    };

    if right_w < bottom_h {
        if right_w > 0.0 {
            push(FreeRect { x: used.x + pw, y: used.y, w: right_w, h: ph });
        }
        if bottom_h > 0.0 {
            push(FreeRect { x: used.x, y: used.y + ph, w: used.w, h: bottom_h });
        }
    } else {
        if bottom_h > 0.0 {
            push(FreeRect { x: used.x, y: used.y + ph, w: pw, h: bottom_h });
        }
        if right_w > 0.0 {
            push(FreeRect { x: used.x + pw, y: used.y, w: right_w, h: used.h });
        }
    }
}
