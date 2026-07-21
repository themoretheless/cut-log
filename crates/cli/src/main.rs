use std::io::{self, Read, Write};

use serde::{Deserialize, Serialize};

use cutter_core::models::{CutPiece, UnplacedPiece};
use cutter_core::optimizer::CuttingStrategy;
use cutter_core::try_optimize;
use cutter_ui::render_result_svg;

const MAX_STDIN_BYTES: usize = 1024 * 1024;

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

fn default_strategy() -> CuttingStrategy {
    CuttingStrategy::Auto
}
fn default_svg_max_w() -> f64 {
    800.0
}
fn default_svg_max_h() -> f64 {
    600.0
}

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

    if let Err(error) = run(io::stdin(), io::stdout()) {
        eprintln!("error: {error}");
        std::process::exit(1);
    }
}

fn run<R: Read, W: Write>(reader: R, mut writer: W) -> Result<(), String> {
    let input_str = read_limited_input(reader)?;

    let input: Input =
        serde_json::from_str(&input_str).map_err(|error| format!("invalid JSON input: {error}"))?;

    let result = match try_optimize(
        input.sheet_width,
        input.sheet_height,
        &input.pieces,
        input.kerf,
        input.strategy,
    ) {
        Ok(result) => result,
        Err(error) => return Err(error.to_string()),
    };

    if input.svg {
        let svg = render_result_svg(&result, input.svg_max_width, input.svg_max_height)
            .map_err(|error| format!("failed to render SVG: {error}"))?;
        writeln!(writer, "{svg}").map_err(|error| format!("failed to write output: {error}"))?;
        return Ok(());
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
        sheets: result
            .sheets
            .iter()
            .map(|s| SheetOutput {
                index: s.index,
                width: s.width,
                height: s.height,
                efficiency: s.efficiency(),
                used_area: s.used_area(),
                placed_pieces: s
                    .placed_pieces
                    .iter()
                    .map(|p| PlacedPieceOutput {
                        label: p.label.clone(),
                        x: p.x,
                        y: p.y,
                        width: p.width,
                        height: p.height,
                        is_rotated: p.is_rotated,
                    })
                    .collect(),
            })
            .collect(),
    };

    serde_json::to_writer_pretty(&mut writer, &output)
        .map_err(|error| format!("failed to serialize output: {error}"))?;
    writeln!(writer).map_err(|error| format!("failed to write output: {error}"))?;
    Ok(())
}

fn read_limited_input<R: Read>(reader: R) -> Result<String, String> {
    let mut bytes = Vec::with_capacity(MAX_STDIN_BYTES + 1);
    reader
        .take((MAX_STDIN_BYTES + 1) as u64)
        .read_to_end(&mut bytes)
        .map_err(|error| format!("failed to read stdin: {error}"))?;

    if bytes.len() > MAX_STDIN_BYTES {
        return Err(format!(
            "stdin exceeds the {MAX_STDIN_BYTES}-byte input limit"
        ));
    }

    String::from_utf8(bytes).map_err(|_| "stdin is not valid UTF-8".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Cursor;

    #[test]
    fn stdin_cap_rejects_more_than_one_mib_before_json_parsing() {
        let input = vec![b' '; MAX_STDIN_BYTES + 1];
        let mut output = Vec::new();
        let error = run(Cursor::new(input), &mut output).unwrap_err();

        assert_eq!(
            error,
            format!("stdin exceeds the {MAX_STDIN_BYTES}-byte input limit")
        );
        assert!(output.is_empty());
    }

    #[test]
    fn stdin_cap_accepts_exactly_one_mib() {
        let input = vec![b'a'; MAX_STDIN_BYTES];
        let text = read_limited_input(Cursor::new(input)).unwrap();

        assert_eq!(text.len(), MAX_STDIN_BYTES);
    }

    #[test]
    fn invalid_svg_limits_fail_without_writing_stdout() {
        let input = br#"{
            "sheet_width": 100,
            "sheet_height": 100,
            "pieces": [],
            "svg": true,
            "svg_max_width": 0.5,
            "svg_max_height": 100
        }"#;
        let mut output = Vec::new();
        let error = run(&input[..], &mut output).unwrap_err();

        assert!(error.contains("max_w must be finite and at least 1"));
        assert!(output.is_empty());
    }

    #[test]
    fn excessive_svg_axis_fails_without_writing_stdout() {
        let input = br#"{
            "sheet_width": 100,
            "sheet_height": 100,
            "pieces": [],
            "svg": true,
            "svg_max_width": 1e308,
            "svg_max_height": 100
        }"#;
        let mut output = Vec::new();
        let error = run(&input[..], &mut output).unwrap_err();

        assert!(error.contains("exceeds the maximum SVG axis 16384"));
        assert!(output.is_empty());
    }

    #[test]
    fn unreadably_dense_multi_sheet_svg_fails_without_writing_stdout() {
        let input = br##"{
            "sheet_width": 100,
            "sheet_height": 100,
            "pieces": [{
                "id": "piece-1",
                "label": "panel",
                "width": 90,
                "height": 90,
                "quantity": 250,
                "allow_rotation": true,
                "color": "#4A90D9"
            }],
            "svg": true,
            "svg_max_width": 320,
            "svg_max_height": 600
        }"##;
        let mut output = Vec::new();
        let error = run(&input[..], &mut output).unwrap_err();

        assert!(error.contains("SVG layout is too dense"));
        assert!(output.is_empty());
    }

    #[test]
    fn svg_output_is_single_root_and_escapes_untrusted_piece_fields() {
        let input = br##"{
            "sheet_width": 1000,
            "sheet_height": 1000,
            "pieces": [{
                "id": "piece-1",
                "label": "</text><script>alert(1)</script>&",
                "width": 900,
                "height": 900,
                "quantity": 2,
                "allow_rotation": true,
                "color": "#fff\" onload=\"alert(2)"
            }],
            "svg": true,
            "svg_max_width": 200,
            "svg_max_height": 200
        }"##;
        let mut output = Vec::new();
        run(&input[..], &mut output).unwrap();
        let svg = String::from_utf8(output).unwrap();

        assert_eq!(svg.matches("<svg ").count(), 1);
        assert_eq!(svg.matches("</svg>").count(), 1);
        assert_eq!(svg.matches("<g data-sheet-index=").count(), 2);
        assert!(!svg.contains("<script"));
        assert!(!svg.contains("onload="));
        assert!(svg.contains("&lt;/text&gt;&lt;script&gt;alert(1)&lt;/script&gt;&amp;"));
        assert!(svg.contains("fill=\"#4A90D9\""));
    }
}
