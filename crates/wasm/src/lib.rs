use serde::{Deserialize, Serialize};
use std::sync::Once;
use wasm_bindgen::prelude::*;
use wasm_bindgen_futures::future_to_promise;

use cutter_core::models::{CutPiece, Sheet, UnplacedPiece};
use cutter_core::optimizer::{self, CuttingStrategy, OptimizeError};

static INIT: Once = Once::new();
const MAX_INPUT_BYTES: usize = 4 * 1024 * 1024;

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

#[derive(Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
enum ErrorKind {
    Validation,
    Protocol,
    Internal,
}

#[derive(Debug, PartialEq, Eq, Serialize)]
struct ErrorEnvelope {
    kind: ErrorKind,
    code: &'static str,
    message: String,
}

impl ErrorEnvelope {
    fn optimizer_validation(error: OptimizeError) -> Self {
        Self {
            kind: ErrorKind::Validation,
            code: validation_error_code(&error),
            message: error.to_string(),
        }
    }

    fn validation(code: &'static str, message: impl Into<String>) -> Self {
        Self {
            kind: ErrorKind::Validation,
            code,
            message: message.into(),
        }
    }

    fn protocol(code: &'static str, message: impl Into<String>) -> Self {
        Self {
            kind: ErrorKind::Protocol,
            code,
            message: message.into(),
        }
    }

    fn internal(code: &'static str, message: impl Into<String>) -> Self {
        Self {
            kind: ErrorKind::Internal,
            code,
            message: message.into(),
        }
    }

    fn to_json(&self) -> String {
        serde_json::to_string(self).unwrap_or_else(|_| {
            r#"{"kind":"internal","code":"error_serialization_failed","message":"Optimizer failed to serialize an error"}"#.to_owned()
        })
    }

    fn to_js_value(&self) -> JsValue {
        let fallback = self.to_json();
        js_sys::JSON::parse(&fallback).unwrap_or_else(|_| JsValue::from_str(&fallback))
    }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

fn to_strategy(value: u8) -> Result<CuttingStrategy, ErrorEnvelope> {
    CuttingStrategy::try_from(value).map_err(|_| {
        ErrorEnvelope::validation(
            "invalid_strategy",
            format!("strategy {value} is not supported"),
        )
    })
}

fn from_strategy(s: CuttingStrategy) -> u8 {
    u8::from(s)
}

fn validation_error_code(error: &OptimizeError) -> &'static str {
    match error {
        OptimizeError::InvalidSheetDimension { .. } => "invalid_sheet_dimension",
        OptimizeError::InvalidPieceDimension { .. } => "invalid_piece_dimension",
        OptimizeError::InvalidKerf { .. } => "invalid_kerf",
        OptimizeError::InvalidPieceId { .. } => "invalid_piece_id",
        OptimizeError::InvalidPieceMetadata { .. } => "invalid_piece_metadata",
        OptimizeError::DuplicatePieceId { .. } => "duplicate_piece_id",
        OptimizeError::UnsafeDerivedValue { .. } => "unsafe_derived_value",
        OptimizeError::ZeroQuantity { .. } => "zero_quantity",
        OptimizeError::TooManyPieces { .. } => "too_many_pieces",
        _ => "unknown_validation",
    }
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
                source_id: p.source_id.clone(),
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

fn run_optimize(input_json: &str) -> Result<String, ErrorEnvelope> {
    if input_json.len() > MAX_INPUT_BYTES {
        return Err(ErrorEnvelope::protocol(
            "input_too_large",
            format!("Optimizer input exceeds the {MAX_INPUT_BYTES}-byte limit"),
        ));
    }

    // Surface a parse failure instead of swallowing it into an empty default:
    // a malformed payload (e.g. a NaN dimension serialized as null) must reach
    // the caller as an error, not a valid-looking zero-piece result.
    let input: OptimizeInput = serde_json::from_str(input_json).map_err(|_| {
        ErrorEnvelope::protocol(
            "invalid_input_json",
            "Optimizer input payload is not valid JSON",
        )
    })?;
    let strategy = to_strategy(input.strategy)?;

    let pieces: Vec<CutPiece> = input
        .pieces
        .into_iter()
        .map(|p| CutPiece {
            id: p.id,
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
        strategy,
    )
    .map_err(ErrorEnvelope::optimizer_validation)?;

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

    serde_json::to_string(&output).map_err(|_| {
        ErrorEnvelope::internal(
            "output_serialization_failed",
            "Optimizer failed to serialize its result",
        )
    })
}

// ── Async API (returns Promise<string>) ──────────────────────────────────────

/// Optimize cutting layout. Returns Promise<string> with JSON result.
#[wasm_bindgen]
pub fn optimize(input_json: String) -> js_sys::Promise {
    ensure_tracing();
    future_to_promise(async move {
        match run_optimize(&input_json) {
            Ok(s) => Ok(JsValue::from_str(&s)),
            Err(error) => Err(error.to_js_value()),
        }
    })
}

// ── Sync API (lightweight, no need for async) ────────────────────────────────

/// Synchronous optimize for small inputs.
#[wasm_bindgen]
pub fn optimize_sync(input_json: &str) -> Result<String, JsValue> {
    ensure_tracing();
    run_optimize(input_json).map_err(|error| error.to_js_value())
}

#[cfg(test)]
mod tests {
    use super::*;

    const VALID_PIECE: &str = r##"{
        "id":"piece-1","label":"Shelf","width":40.0,"height":30.0,
        "quantity":1,"allow_rotation":true,"color":"#336699"
    }"##;

    fn request(kerf: f64, pieces: &str) -> String {
        format!(
            r#"{{"sheet_width":100.0,"sheet_height":100.0,"kerf":{kerf},"strategy":0,"pieces":[{pieces}]}}"#
        )
    }

    fn assert_validation(input: &str, code: &str, message: &str) {
        let error = run_optimize(input).expect_err("input must fail validation");
        assert_eq!(error.kind, ErrorKind::Validation);
        assert_eq!(error.code, code);
        assert_eq!(error.message, message);

        let serialized: serde_json::Value =
            serde_json::from_str(&error.to_json()).expect("error envelope must be valid JSON");
        assert_eq!(serialized["kind"], "validation");
        assert_eq!(serialized["code"], code);
        assert_eq!(serialized["message"], message);
    }

    #[test]
    fn negative_kerf_has_stable_validation_envelope() {
        assert_validation(
            &request(-1.0, VALID_PIECE),
            "invalid_kerf",
            "kerf must be zero or greater",
        );
    }

    #[test]
    fn duplicate_piece_id_has_stable_validation_envelope() {
        assert_validation(
            &request(0.0, &format!("{VALID_PIECE},{VALID_PIECE}")),
            "duplicate_piece_id",
            "duplicate piece id 'piece-1'",
        );
    }

    #[test]
    fn invalid_piece_id_has_stable_validation_envelope() {
        let invalid = VALID_PIECE.replace("piece-1", "");
        assert_validation(
            &request(0.0, &invalid),
            "invalid_piece_id",
            "piece at index 0 id must not be empty",
        );
    }

    #[test]
    fn malformed_input_is_a_protocol_error_without_parser_details() {
        let error = run_optimize("not JSON").expect_err("payload must be rejected");
        assert_eq!(error.kind, ErrorKind::Protocol);
        assert_eq!(error.code, "invalid_input_json");
        assert_eq!(error.message, "Optimizer input payload is not valid JSON");
        assert!(!error.to_json().contains("expected"));
    }

    #[test]
    fn unknown_strategy_is_rejected_instead_of_falling_back_to_auto() {
        let input = request(0.0, VALID_PIECE).replace("\"strategy\":0", "\"strategy\":255");
        let error = run_optimize(&input).expect_err("unknown strategy must be rejected");

        assert_eq!(error.kind, ErrorKind::Validation);
        assert_eq!(error.code, "invalid_strategy");
        assert!(error.message.contains("255"));
    }

    #[test]
    fn oversized_payload_is_rejected_before_json_deserialization() {
        let input = " ".repeat(MAX_INPUT_BYTES + 1);
        let error = run_optimize(&input).expect_err("oversized payload must be rejected");

        assert_eq!(error.kind, ErrorKind::Protocol);
        assert_eq!(error.code, "input_too_large");
        assert!(error.message.contains(&MAX_INPUT_BYTES.to_string()));
    }
}
