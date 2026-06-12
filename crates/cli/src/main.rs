use std::io::{self, Read};

use serde::{Deserialize, Serialize};

use cutter_core::models::{CutPiece, UnplacedPiece};
use cutter_core::optimizer::CuttingStrategy;
use cutter_core::optimize;
use cutter_ui::render_result_svg;

/// JSON input format for the CLI.
///
/// Example:
/// ```json
/// {
///   "sheet_width": 2440,
///   "sheet_height": 1220,
///   "kerf": 3,
///   "strategy": "Auto",
///   "pieces": [
///     { "label": "Полка A", "width": 500, "height": 400, "quantity": 3 },
///     { "label": "Дно", "width": 800, "height": 600, "quantity": 2 }
///   ]
/// }
/// ```
#[derive(Deserialize)]
struct Input {
    sheet_width: f64,
    sheet_height: f64,
    #[serde(default)]
    kerf: f64,
    #[serde(default = "default_strategy")]
    strategy: CuttingStrategy,
    pieces: Vec<CutPiece>,
    /// If true, output SVG instead of JSON.
    #[serde(default)]
    svg: bool,
    #[serde(default = "default_svg_max_w")]
    svg_max_width: f64,
    #[serde(default = "default_svg_max_h")]
    svg_max_height: f64,
}

fn default_strategy() -> CuttingStrategy { CuttingStrategy::Auto }
fn default_svg_max_w() -> f64 { 800.0 }
fn default_svg_max_h() -> f64 { 600.0 }

/// JSON output format.
#[derive(Serialize)]
struct Output {
    total_sheets: usize,
    overall_efficiency: f64,
    total_used_area: f64,
    total_area: f64,
    waste_area: f64,
    strategy: CuttingStrategy,
    auto_picked_strategy: Option<CuttingStrategy>,
    unplaced_pieces: Vec<UnplacedPiece>,
    sheets: Vec<SheetOutput>,
}

#[derive(Serialize)]
struct SheetOutput {
    index: usize,
    width: f64,
    height: f64,
    efficiency: f64,
    used_area: f64,
    placed_pieces: Vec<PlacedPieceOutput>,
}

#[derive(Serialize)]
struct PlacedPieceOutput {
    label: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    is_rotated: bool,
}

fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .with_writer(std::io::stderr)
        .init();

    let mut input_str = String::new();
    if let Err(e) = io::stdin().read_to_string(&mut input_str) {
        eprintln!("error: failed to read stdin: {e}");
        std::process::exit(1);
    }

    let input: Input = match serde_json::from_str(&input_str) {
        Ok(v) => v,
        Err(e) => {
            eprintln!("error: invalid JSON input: {e}");
            std::process::exit(1);
        }
    };

    let result = optimize(
        input.sheet_width,
        input.sheet_height,
        &input.pieces,
        input.kerf,
        input.strategy,
    );

    if input.svg {
        let svg = render_result_svg(&result, input.svg_max_width, input.svg_max_height);
        println!("{svg}");
        return;
    }

    let output = Output {
        total_sheets: result.total_sheets(),
        overall_efficiency: result.overall_efficiency(),
        total_used_area: result.total_used_area(),
        total_area: result.total_area(),
        waste_area: result.total_area() - result.total_used_area(),
        strategy: result.strategy,
        auto_picked_strategy: result.auto_picked_strategy,
        unplaced_pieces: result.unplaced_pieces,
        sheets: result.sheets.iter().map(|s| SheetOutput {
            index: s.index,
            width: s.width,
            height: s.height,
            efficiency: s.efficiency(),
            used_area: s.used_area(),
            placed_pieces: s.placed_pieces.iter().map(|p| PlacedPieceOutput {
                label: p.label.clone(),
                x: p.x,
                y: p.y,
                width: p.width,
                height: p.height,
                is_rotated: p.is_rotated,
            }).collect(),
        }).collect(),
    };

    println!("{}", serde_json::to_string_pretty(&output).unwrap());
}
