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

    for &(fit, sort, _) in &ALL_STRATEGIES {
        let result = run_single(sheet_width, sheet_height, pieces, kerf, fit, sort);
        debug!(
            ?fit, ?sort,
            sheets = result.total_sheets(),
            efficiency = format!("{:.1}%", result.overall_efficiency()),
            "strategy result"
        );
        if best.as_ref().map_or(true, |b| is_better(&result, b)) {
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

#[instrument(skip(pieces), fields(?heuristic, ?sort_order))]
fn run_single(
    sheet_width: f64,
    sheet_height: f64,
    pieces: &[CutPiece],
    kerf: f64,
    heuristic: FitHeuristic,
    sort_order: SortOrder,
) -> CuttingResult {
    let mut result = CuttingResult::new(compose(heuristic, sort_order));

    let mut queue: Vec<&CutPiece> = pieces
        .iter()
        .flat_map(|p| std::iter::repeat_n(p, p.quantity as usize))
        .collect();

    queue.sort_by(|a, b| {
        let key = |p: &CutPiece| match sort_order {
            SortOrder::AreaDesc => p.width * p.height,
            SortOrder::MaxSideDesc => p.width.max(p.height),
            SortOrder::PerimeterDesc => p.width + p.height,
        };
        key(b).partial_cmp(&key(a)).unwrap_or(std::cmp::Ordering::Equal)
    });

    if queue.is_empty() {
        return result;
    }

    let mut sheet_free_rects: Vec<Vec<FreeRect>> = Vec::new();

    for piece in &queue {
        if try_place_on_existing(&mut result, &mut sheet_free_rects, piece, kerf, heuristic) {
            continue;
        }

        if !fits_on_blank(piece, sheet_width, sheet_height) {
            let label = if piece.label.trim().is_empty() { "Деталь" } else { &piece.label };
            warn!(label, width = piece.width, height = piece.height, "piece too large, cannot place");
            result.unplaced_pieces.push(format!("{} ({}x{})", label, piece.width, piece.height));
            continue;
        }

        debug!(width = piece.width, height = piece.height, sheet = result.sheets.len(), "opening new sheet");
        open_new_sheet_and_place(
            &mut result,
            &mut sheet_free_rects,
            piece,
            sheet_width,
            sheet_height,
            kerf,
            heuristic,
        );
    }

    result
}

fn try_place_on_existing(
    result: &mut CuttingResult,
    sheet_free_rects: &mut [Vec<FreeRect>],
    piece: &CutPiece,
    kerf: f64,
    heuristic: FitHeuristic,
) -> bool {
    for si in 0..sheet_free_rects.len() {
        if let Some((fit_idx, rotated)) = find_best_fit(&sheet_free_rects[si], piece, kerf, heuristic) {
            let fit = sheet_free_rects[si][fit_idx];
            place_piece(&mut result.sheets[si], &mut sheet_free_rects[si], fit_idx, fit, piece, rotated, kerf);
            return true;
        }
    }
    false
}

fn fits_on_blank(piece: &CutPiece, sheet_width: f64, sheet_height: f64) -> bool {
    (piece.width <= sheet_width && piece.height <= sheet_height)
        || (piece.allow_rotation && piece.height <= sheet_width && piece.width <= sheet_height)
}

fn open_new_sheet_and_place(
    result: &mut CuttingResult,
    sheet_free_rects: &mut Vec<Vec<FreeRect>>,
    piece: &CutPiece,
    sheet_width: f64,
    sheet_height: f64,
    kerf: f64,
    heuristic: FitHeuristic,
) {
    let free_rects = vec![FreeRect { x: 0.0, y: 0.0, w: sheet_width, h: sheet_height }];
    sheet_free_rects.push(free_rects);

    let sheet = Sheet {
        index: result.sheets.len(),
        width: sheet_width,
        height: sheet_height,
        placed_pieces: Vec::new(),
    };
    result.sheets.push(sheet);

    let si = sheet_free_rects.len() - 1;
    if let Some((fit_idx, rotated)) = find_best_fit(&sheet_free_rects[si], piece, kerf, heuristic) {
        let fit = sheet_free_rects[si][fit_idx];
        place_piece(&mut result.sheets[si], &mut sheet_free_rects[si], fit_idx, fit, piece, rotated, kerf);
    } else {
        result.unplaced_pieces.push(format!("{} ({}x{})", piece.label, piece.width, piece.height));
    }
}

fn place_piece(
    sheet: &mut Sheet,
    free_rects: &mut Vec<FreeRect>,
    fit_idx: usize,
    fit: FreeRect,
    piece: &CutPiece,
    rotated: bool,
    kerf: f64,
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

    split_free_rect(free_rects, fit_idx, pw + kerf, ph + kerf);
}

fn find_best_fit(
    free_rects: &[FreeRect],
    piece: &CutPiece,
    kerf: f64,
    heuristic: FitHeuristic,
) -> Option<(usize, bool)> {
    let mut best_idx: Option<usize> = None;
    let mut best_rotated = false;
    let mut best_score = f64::MAX;

    for (i, fr) in free_rects.iter().enumerate() {
        if piece.width + kerf <= fr.w && piece.height + kerf <= fr.h {
            let score = calc_score(fr, piece.width, piece.height, heuristic);
            if score < best_score {
                best_score = score;
                best_idx = Some(i);
                best_rotated = false;
            }
        }

        if piece.allow_rotation && piece.height + kerf <= fr.w && piece.width + kerf <= fr.h {
            let score = calc_score(fr, piece.height, piece.width, heuristic);
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

fn split_free_rect(free_rects: &mut Vec<FreeRect>, idx: usize, pw: f64, ph: f64) {
    let used = free_rects.remove(idx);

    let right_w = used.w - pw;
    let bottom_h = used.h - ph;

    if right_w < bottom_h {
        if right_w > 0.0 {
            free_rects.push(FreeRect { x: used.x + pw, y: used.y, w: right_w, h: ph });
        }
        if bottom_h > 0.0 {
            free_rects.push(FreeRect { x: used.x, y: used.y + ph, w: used.w, h: bottom_h });
        }
    } else {
        if bottom_h > 0.0 {
            free_rects.push(FreeRect { x: used.x, y: used.y + ph, w: pw, h: bottom_h });
        }
        if right_w > 0.0 {
            free_rects.push(FreeRect { x: used.x + pw, y: used.y, w: right_w, h: used.h });
        }
    }
}
