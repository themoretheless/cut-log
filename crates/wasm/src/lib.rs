use serde::{Deserialize, Serialize};
use std::sync::Once;
use wasm_bindgen::prelude::*;
use wasm_bindgen_futures::future_to_promise;

use cutter_core::models::{CutPiece, Sheet, UnplacedPiece};
use cutter_core::optimizer::{self, CuttingStrategy};

static INIT: Once = Once::new();

fn ensure_tracing() {
    INIT.call_once(|| {
        // Console logging per event is expensive; WARN keeps real problems
        // visible without paying console.log costs on every placement.
        let config = tracing_wasm::WASMLayerConfigBuilder::new()
            .set_max_level(tracing::Level::WARN)
            .build();
        tracing_wasm::set_as_global_default_with_config(config);
    });
}

// ── Types ────────────────────────────────────────────────────────────────────

#[derive(Deserialize)]
struct OptimizeInput {
    sheet_width: f64,
    sheet_height: f64,
    kerf: f64,
    strategy: u8,
    pieces: Vec<PieceInput>,
}

#[derive(Deserialize)]
struct PieceInput {
    id: String,
    label: String,
    width: f64,
    height: f64,
    quantity: u32,
    allow_rotation: bool,
    color: String,
}

#[derive(Serialize)]
struct OptimizeOutput {
    sheets: Vec<SheetOutput>,
    unplaced_pieces: Vec<UnplacedPiece>,
    strategy: u8,
    auto_picked_strategy: Option<u8>,
    total_sheets: usize,
    total_used_area: f64,
    total_area: f64,
    overall_efficiency: f64,
}

#[derive(Serialize)]
struct SheetOutput {
    index: usize,
    width: f64,
    height: f64,
    placed_pieces: Vec<PlacedOutput>,
    used_area: f64,
    total_area: f64,
    efficiency: f64,
}

#[derive(Serialize)]
struct PlacedOutput {
    source_id: String,
    source_label: String,
    source_color: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    is_rotated: bool,
}

// ── Helpers ──────────────────────────────────────────────────────────────────

fn to_strategy(v: u8) -> CuttingStrategy {
    CuttingStrategy::try_from(v).unwrap_or(CuttingStrategy::Auto)
}

fn from_strategy(s: CuttingStrategy) -> u8 {
    u8::from(s)
}

fn convert_sheet(s: &Sheet) -> SheetOutput {
    SheetOutput {
        index: s.index,
        width: s.width,
        height: s.height,
        used_area: s.used_area(),
        total_area: s.total_area(),
        efficiency: s.efficiency(),
        placed_pieces: s
            .placed_pieces
            .iter()
            .map(|p| PlacedOutput {
                source_id: p.source_id.to_string(),
                source_label: p.label.clone(),
                source_color: p.color.clone(),
                x: p.x,
                y: p.y,
                width: p.width,
                height: p.height,
                is_rotated: p.is_rotated,
            })
            .collect(),
    }
}

fn run_optimize(input_json: &str) -> Result<String, String> {
    // Surface a parse failure instead of swallowing it into an empty default:
    // a malformed payload (e.g. a NaN dimension serialized as null) must reach
    // the caller as an error, not a valid-looking zero-piece result.
    let input: OptimizeInput = serde_json::from_str(input_json)
        .map_err(|e| format!("invalid optimizer input JSON: {e}"))?;

    let pieces: Vec<CutPiece> = input
        .pieces
        .into_iter()
        .map(|p| CutPiece {
            id: uuid::Uuid::parse_str(&p.id).unwrap_or_else(|_| uuid::Uuid::new_v4()),
            label: p.label,
            width: p.width,
            height: p.height,
            quantity: p.quantity,
            allow_rotation: p.allow_rotation,
            color: p.color,
        })
        .collect();

    let result = optimizer::try_optimize(
        input.sheet_width,
        input.sheet_height,
        &pieces,
        input.kerf,
        to_strategy(input.strategy),
    )
    .map_err(|e| e.to_string())?;

    let total_sheets = result.total_sheets();
    let total_used_area = result.total_used_area();
    let total_area = result.total_area();
    let overall_efficiency = result.overall_efficiency();
    let strategy = from_strategy(result.strategy);
    let auto_picked_strategy = result.auto_picked_strategy.map(from_strategy);
    let sheets = result.sheets.iter().map(convert_sheet).collect();

    let output = OptimizeOutput {
        sheets,
        unplaced_pieces: result.unplaced_pieces,
        strategy,
        auto_picked_strategy,
        total_sheets,
        total_used_area,
        total_area,
        overall_efficiency,
    };

    serde_json::to_string(&output).map_err(|e| format!("failed to serialize optimizer output: {e}"))
}

// ── Async API (returns Promise<string>) ──────────────────────────────────────

/// Optimize cutting layout. Returns Promise<string> with JSON result.
#[wasm_bindgen]
pub fn optimize(input_json: String) -> js_sys::Promise {
    ensure_tracing();
    future_to_promise(async move {
        match run_optimize(&input_json) {
            Ok(s) => Ok(JsValue::from_str(&s)),
            Err(e) => Err(JsValue::from_str(&e)),
        }
    })
}

// ── Sync API (lightweight, no need for async) ────────────────────────────────

/// Synchronous optimize for small inputs.
#[wasm_bindgen]
pub fn optimize_sync(input_json: &str) -> Result<String, JsValue> {
    ensure_tracing();
    run_optimize(input_json).map_err(|e| JsValue::from_str(&e))
}
