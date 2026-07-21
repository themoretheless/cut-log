use std::fmt::{self, Write};

use cutter_core::models::*;

pub const PIECE_COLORS: [&str; 10] = [
    "#4A90D9", "#E67E22", "#27AE60", "#9B59B6", "#E74C3C", "#1ABC9C", "#F39C12", "#2980B9",
    "#8E44AD", "#16A085",
];

// Sheet rendering palette.
const C_BG: &str = "#f5f0e8";
const C_BORDER: &str = "#8B7355";
const C_GRAIN: &str = "#d4c9a8";
const C_WHITE: &str = "#fff";
const C_DIM: &str = "#8B7355";

// Natural SVG units. The gap is scaled together with every sheet.
const SHEET_GAP: f64 = 24.0;
const LABEL_MIN_W: f64 = 40.0;
const LABEL_MIN_H: f64 = 22.0;
const EMPTY_SVG_SIZE: f64 = 1.0;
// Relative tolerance for harmless floating-point noise at sheet boundaries.
const PIECE_BOUNDS_EPSILON: f64 = 1e-9;

/// Maximum width or height accepted for an SVG canvas.
pub const MAX_SVG_AXIS: f64 = 16_384.0;
/// Maximum pixel area accepted for an SVG canvas.
pub const MAX_SVG_AREA: f64 = 8192.0 * 8192.0;
/// Every rendered sheet must remain at least this large on both axes.
pub const MIN_SCALED_SHEET_DIMENSION: f64 = 16.0;

#[non_exhaustive]
#[derive(Debug, Clone, PartialEq)]
pub enum RenderSvgError {
    InvalidLimit {
        field: &'static str,
        value: f64,
    },
    CanvasAxisTooLarge {
        context: &'static str,
        axis: &'static str,
        value: f64,
        maximum: f64,
    },
    CanvasAreaTooLarge {
        context: &'static str,
        width: f64,
        height: f64,
        area: f64,
        maximum: f64,
    },
    InvalidSheetGeometry {
        sheet_index: usize,
        field: &'static str,
        value: f64,
    },
    InvalidPieceGeometry {
        sheet_index: usize,
        piece_index: usize,
        field: &'static str,
        value: f64,
    },
    PieceOutsideSheet {
        sheet_index: usize,
        piece_index: usize,
        right: f64,
        bottom: f64,
        sheet_width: f64,
        sheet_height: f64,
    },
    LayoutTooDense {
        sheet_index: usize,
        scaled_width: f64,
        scaled_height: f64,
        minimum: f64,
    },
    InvalidDerivedGeometry {
        field: &'static str,
        value: f64,
    },
}

impl fmt::Display for RenderSvgError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidLimit { field, value } => {
                write!(f, "{field} must be finite and at least 1, got {value:?}")
            }
            Self::CanvasAxisTooLarge {
                context,
                axis,
                value,
                maximum,
            } => write!(
                f,
                "{context} {axis} {value:?} exceeds the maximum SVG axis {maximum}"
            ),
            Self::CanvasAreaTooLarge {
                context,
                width,
                height,
                area,
                maximum,
            } => write!(
                f,
                "{context} {width:?}x{height:?} has area {area:?}, exceeding the maximum SVG area {maximum}"
            ),
            Self::InvalidSheetGeometry {
                sheet_index,
                field,
                value,
            } => write!(
                f,
                "sheet {sheet_index} has invalid {field}; expected a finite positive value, got {value:?}"
            ),
            Self::InvalidPieceGeometry {
                sheet_index,
                piece_index,
                field,
                value,
            } => write!(
                f,
                "piece {piece_index} on sheet {sheet_index} has invalid {field}, got {value:?}"
            ),
            Self::PieceOutsideSheet {
                sheet_index,
                piece_index,
                right,
                bottom,
                sheet_width,
                sheet_height,
            } => write!(
                f,
                "piece {piece_index} on sheet {sheet_index} ends at ({right:?}, {bottom:?}) outside {sheet_width:?}x{sheet_height:?}"
            ),
            Self::LayoutTooDense {
                sheet_index,
                scaled_width,
                scaled_height,
                minimum,
            } => write!(
                f,
                "SVG layout is too dense: sheet {sheet_index} would render at {scaled_width:?}x{scaled_height:?}, below the {minimum}px minimum"
            ),
            Self::InvalidDerivedGeometry { field, value } => write!(
                f,
                "SVG layout produced invalid {field}; expected a finite positive value, got {value:?}"
            ),
        }
    }
}

impl std::error::Error for RenderSvgError {}

pub fn piece_color(index: usize) -> &'static str {
    PIECE_COLORS[index % PIECE_COLORS.len()]
}

pub fn truncate(s: &str, max_chars: usize) -> String {
    if max_chars == 0 {
        return String::new();
    }

    let capacity = s.len().min(max_chars.saturating_mul(4));
    let mut result = String::with_capacity(capacity);
    let mut chars = s.chars();
    for _ in 0..max_chars {
        match chars.next() {
            Some(ch) => result.push(ch),
            None => return result,
        }
    }
    if chars.next().is_some() {
        result.push('\u{2026}');
    }
    result
}

pub fn efficiency_class(e: f64) -> &'static str {
    if e >= 80.0 {
        "eff-good"
    } else if e >= 55.0 {
        "eff-ok"
    } else {
        "eff-poor"
    }
}

macro_rules! svg_write {
    ($dst:expr, $($arg:tt)*) => {
        write!($dst, $($arg)*).expect("writing to String cannot fail")
    };
}

/// Render a single sheet as a standalone, bounded SVG document.
pub fn render_sheet_svg(sheet: &Sheet, max_w: f64, max_h: f64) -> Result<String, RenderSvgError> {
    validate_limits(max_w, max_h)?;
    validate_sheet(sheet)?;

    let scale = calculate_scale(sheet.width, sheet.height, max_w, max_h)?;
    validate_scaled_sheet(sheet, scale)?;
    let svg_w = bounded_dimension("canvas width", sheet.width, scale, max_w)?;
    let svg_h = bounded_dimension("canvas height", sheet.height, scale, max_h)?;
    validate_canvas_budget("derived canvas", svg_w, svg_h)?;

    let mut svg = String::with_capacity(4096);
    write_svg_root_start(&mut svg, svg_w, svg_h);
    svg_write!(svg, "<g transform=\"scale({scale})\">");
    write_sheet_contents(&mut svg, sheet);
    svg.push_str("</g></svg>");
    Ok(svg)
}

/// Render all sheets as one bounded SVG document with a shared scale.
pub fn render_result_svg(
    result: &CuttingResult,
    max_w: f64,
    max_h: f64,
) -> Result<String, RenderSvgError> {
    validate_limits(max_w, max_h)?;
    for sheet in &result.sheets {
        validate_sheet(sheet)?;
    }

    if result.sheets.is_empty() {
        validate_canvas_budget("derived canvas", EMPTY_SVG_SIZE, EMPTY_SVG_SIZE)?;
        let mut svg = String::new();
        write_svg_root_start(&mut svg, EMPTY_SVG_SIZE, EMPTY_SVG_SIZE);
        svg.push_str("</svg>");
        return Ok(svg);
    }

    let natural_w = result
        .sheets
        .iter()
        .map(|sheet| sheet.width)
        .fold(0.0_f64, f64::max);
    let sheet_heights = checked_sum(
        "combined sheet height",
        result.sheets.iter().map(|sheet| sheet.height),
    )?;
    let natural_gap = SHEET_GAP * result.sheets.len().saturating_sub(1) as f64;
    validate_non_negative_derived("combined sheet gap", natural_gap)?;
    let natural_h = checked_add("combined canvas height", sheet_heights, natural_gap)?;

    let scale = calculate_scale(natural_w, natural_h, max_w, max_h)?;
    let svg_w = bounded_dimension("canvas width", natural_w, scale, max_w)?;
    let svg_h = bounded_dimension("canvas height", natural_h, scale, max_h)?;
    validate_canvas_budget("derived canvas", svg_w, svg_h)?;
    for sheet in &result.sheets {
        validate_scaled_sheet(sheet, scale)?;
    }

    let capacity = result.sheets.len().saturating_mul(1024).min(1024 * 1024);
    let mut output = String::with_capacity(capacity);
    write_svg_root_start(&mut output, svg_w, svg_h);

    let mut natural_y = 0.0;
    for (position, sheet) in result.sheets.iter().enumerate() {
        let sheet_w = positive_product("scaled sheet width", sheet.width, scale)?;
        let x = ((svg_w - sheet_w) / 2.0).max(0.0);
        let y = non_negative_product("sheet offset", natural_y, scale)?;
        svg_write!(
            output,
            "<g data-sheet-index=\"{}\" transform=\"translate({x} {y}) scale({scale})\">",
            sheet.index
        );
        write_sheet_contents(&mut output, sheet);
        output.push_str("</g>");
        natural_y = checked_add("sheet offset", natural_y, sheet.height)?;
        if position + 1 < result.sheets.len() {
            natural_y = checked_add("sheet offset", natural_y, SHEET_GAP)?;
        }
    }
    output.push_str("</svg>");
    Ok(output)
}

fn validate_limits(max_w: f64, max_h: f64) -> Result<(), RenderSvgError> {
    validate_limit("max_w", max_w)?;
    validate_limit("max_h", max_h)?;
    validate_canvas_budget("requested canvas", max_w, max_h)
}

fn validate_limit(field: &'static str, value: f64) -> Result<(), RenderSvgError> {
    if value.is_finite() && value >= 1.0 {
        Ok(())
    } else {
        Err(RenderSvgError::InvalidLimit { field, value })
    }
}

fn validate_canvas_budget(
    context: &'static str,
    width: f64,
    height: f64,
) -> Result<(), RenderSvgError> {
    for (axis, value) in [("width", width), ("height", height)] {
        if !value.is_finite() || value <= 0.0 {
            return Err(RenderSvgError::InvalidDerivedGeometry {
                field: "canvas axis",
                value,
            });
        }
        if value > MAX_SVG_AXIS {
            return Err(RenderSvgError::CanvasAxisTooLarge {
                context,
                axis,
                value,
                maximum: MAX_SVG_AXIS,
            });
        }
    }

    let area = width * height;
    if !area.is_finite() || area > MAX_SVG_AREA {
        return Err(RenderSvgError::CanvasAreaTooLarge {
            context,
            width,
            height,
            area,
            maximum: MAX_SVG_AREA,
        });
    }
    Ok(())
}

fn validate_sheet(sheet: &Sheet) -> Result<(), RenderSvgError> {
    validate_sheet_dimension(sheet.index, "width", sheet.width)?;
    validate_sheet_dimension(sheet.index, "height", sheet.height)?;

    for (piece_index, piece) in sheet.placed_pieces.iter().enumerate() {
        validate_piece_non_negative(sheet.index, piece_index, "x", piece.x)?;
        validate_piece_non_negative(sheet.index, piece_index, "y", piece.y)?;
        validate_piece_positive(sheet.index, piece_index, "width", piece.width)?;
        validate_piece_positive(sheet.index, piece_index, "height", piece.height)?;
        let right = piece.x + piece.width;
        let bottom = piece.y + piece.height;
        validate_piece_derived(sheet.index, piece_index, "right edge", right)?;
        validate_piece_derived(sheet.index, piece_index, "bottom edge", bottom)?;

        let width_epsilon = sheet.width.max(1.0) * PIECE_BOUNDS_EPSILON;
        let height_epsilon = sheet.height.max(1.0) * PIECE_BOUNDS_EPSILON;
        let outside_width = right > sheet.width && right - sheet.width > width_epsilon;
        let outside_height = bottom > sheet.height && bottom - sheet.height > height_epsilon;
        if outside_width || outside_height {
            return Err(RenderSvgError::PieceOutsideSheet {
                sheet_index: sheet.index,
                piece_index,
                right,
                bottom,
                sheet_width: sheet.width,
                sheet_height: sheet.height,
            });
        }
    }
    Ok(())
}

fn validate_sheet_dimension(
    sheet_index: usize,
    field: &'static str,
    value: f64,
) -> Result<(), RenderSvgError> {
    if value.is_finite() && value > 0.0 {
        Ok(())
    } else {
        Err(RenderSvgError::InvalidSheetGeometry {
            sheet_index,
            field,
            value,
        })
    }
}

fn validate_piece_non_negative(
    sheet_index: usize,
    piece_index: usize,
    field: &'static str,
    value: f64,
) -> Result<(), RenderSvgError> {
    if value.is_finite() && value >= 0.0 {
        Ok(())
    } else {
        Err(RenderSvgError::InvalidPieceGeometry {
            sheet_index,
            piece_index,
            field,
            value,
        })
    }
}

fn validate_piece_positive(
    sheet_index: usize,
    piece_index: usize,
    field: &'static str,
    value: f64,
) -> Result<(), RenderSvgError> {
    if value.is_finite() && value > 0.0 {
        Ok(())
    } else {
        Err(RenderSvgError::InvalidPieceGeometry {
            sheet_index,
            piece_index,
            field,
            value,
        })
    }
}

fn validate_piece_derived(
    sheet_index: usize,
    piece_index: usize,
    field: &'static str,
    value: f64,
) -> Result<(), RenderSvgError> {
    if value.is_finite() && value > 0.0 {
        Ok(())
    } else {
        Err(RenderSvgError::InvalidPieceGeometry {
            sheet_index,
            piece_index,
            field,
            value,
        })
    }
}

fn calculate_scale(
    natural_w: f64,
    natural_h: f64,
    max_w: f64,
    max_h: f64,
) -> Result<f64, RenderSvgError> {
    let scale = (max_w / natural_w).min(max_h / natural_h);
    validate_positive_derived("scale", scale)?;
    Ok(scale)
}

fn validate_scaled_sheet(sheet: &Sheet, scale: f64) -> Result<(), RenderSvgError> {
    let scaled_width = positive_product("scaled sheet width", sheet.width, scale)?;
    let scaled_height = positive_product("scaled sheet height", sheet.height, scale)?;
    if scaled_width < MIN_SCALED_SHEET_DIMENSION || scaled_height < MIN_SCALED_SHEET_DIMENSION {
        return Err(RenderSvgError::LayoutTooDense {
            sheet_index: sheet.index,
            scaled_width,
            scaled_height,
            minimum: MIN_SCALED_SHEET_DIMENSION,
        });
    }
    for piece in &sheet.placed_pieces {
        non_negative_product("scaled piece x", piece.x, scale)?;
        non_negative_product("scaled piece y", piece.y, scale)?;
        positive_product("scaled piece width", piece.width, scale)?;
        positive_product("scaled piece height", piece.height, scale)?;
    }
    Ok(())
}

fn bounded_dimension(
    field: &'static str,
    natural: f64,
    scale: f64,
    limit: f64,
) -> Result<f64, RenderSvgError> {
    let value = positive_product(field, natural, scale)?;
    Ok(value.min(limit))
}

fn positive_product(field: &'static str, left: f64, right: f64) -> Result<f64, RenderSvgError> {
    let value = left * right;
    validate_positive_derived(field, value)?;
    Ok(value)
}

fn non_negative_product(field: &'static str, left: f64, right: f64) -> Result<f64, RenderSvgError> {
    let value = left * right;
    validate_non_negative_derived(field, value)?;
    Ok(normalize_zero(value))
}

fn validate_positive_derived(field: &'static str, value: f64) -> Result<(), RenderSvgError> {
    if value.is_finite() && value > 0.0 {
        Ok(())
    } else {
        Err(RenderSvgError::InvalidDerivedGeometry { field, value })
    }
}

fn validate_non_negative_derived(field: &'static str, value: f64) -> Result<(), RenderSvgError> {
    if value.is_finite() && value >= 0.0 {
        Ok(())
    } else {
        Err(RenderSvgError::InvalidDerivedGeometry { field, value })
    }
}

fn checked_add(field: &'static str, left: f64, right: f64) -> Result<f64, RenderSvgError> {
    let value = left + right;
    validate_positive_derived(field, value)?;
    Ok(value)
}

fn checked_sum(
    field: &'static str,
    values: impl Iterator<Item = f64>,
) -> Result<f64, RenderSvgError> {
    let mut sum = 0.0;
    for value in values {
        sum += value;
        validate_positive_derived(field, sum)?;
    }
    Ok(sum)
}

fn normalize_zero(value: f64) -> f64 {
    if value == 0.0 {
        0.0
    } else {
        value
    }
}

fn write_svg_root_start(svg: &mut String, width: f64, height: f64) {
    svg_write!(
        svg,
        "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"{width}\" height=\"{height}\" viewBox=\"0 0 {width} {height}\">"
    );
}

fn write_sheet_contents(svg: &mut String, sheet: &Sheet) {
    write_background(svg, sheet.width, sheet.height);
    write_grain(svg, sheet.width, sheet.height);
    for (i, piece) in sheet.placed_pieces.iter().enumerate() {
        write_piece(svg, piece, i + 1);
    }
    write_dimension_labels(svg, sheet);
}

fn write_background(svg: &mut String, width: f64, height: f64) {
    svg_write!(
        svg,
        "<rect width=\"{width}\" height=\"{height}\" fill=\"{C_BG}\" stroke=\"{C_BORDER}\" stroke-width=\"2\"/>"
    );
}

fn write_grain(svg: &mut String, width: f64, height: f64) {
    for grain in 1..10 {
        let y = height * (grain as f64 / 10.0);
        svg_write!(
            svg,
            "<line x1=\"0\" y1=\"{y}\" x2=\"{width}\" y2=\"{y}\" stroke=\"{C_GRAIN}\" stroke-width=\"0.5\"/>"
        );
    }
}

fn write_piece(svg: &mut String, piece: &PlacedPiece, piece_index: usize) {
    let color = safe_piece_color(&piece.color, piece_index);
    svg_write!(
        svg,
        "<rect x=\"{}\" y=\"{}\" width=\"{}\" height=\"{}\" fill=\"{color}\" fill-opacity=\"0.82\" stroke=\"{C_WHITE}\" stroke-width=\"0.1\"/>",
        normalize_zero(piece.x),
        normalize_zero(piece.y),
        piece.width,
        piece.height
    );

    if piece.width >= 18.0 && piece.height >= 18.0 {
        let badge_w = if piece_index >= 10 { 16.0 } else { 12.0 };
        let badge_h = 13.0;
        let badge_x = piece.x + 3.0;
        let badge_y = piece.y + 3.0;
        svg_write!(
            svg,
            "<rect x=\"{badge_x}\" y=\"{badge_y}\" width=\"{badge_w}\" height=\"{badge_h}\" rx=\"3\" fill=\"rgba(0,0,0,0.35)\"/>"
        );
        let text_x = badge_x + badge_w / 2.0;
        let text_y = badge_y + badge_h / 2.0;
        svg_write!(
            svg,
            "<text x=\"{text_x}\" y=\"{text_y}\" text-anchor=\"middle\" dominant-baseline=\"middle\" font-size=\"8\" font-weight=\"700\" fill=\"{C_WHITE}\">{piece_index}</text>"
        );
    }

    if piece.is_rotated && piece.width >= 12.0 && piece.height >= 12.0 {
        let x = piece.x + piece.width - 6.0;
        let y = piece.y + 12.0;
        svg_write!(
            svg,
            "<text x=\"{x}\" y=\"{y}\" font-size=\"10\" fill=\"{C_WHITE}\" opacity=\"0.9\">\u{21bb}</text>"
        );
    }

    if piece.width > LABEL_MIN_W && piece.height > LABEL_MIN_H {
        write_piece_label(svg, piece);
    }
}

fn write_piece_label(svg: &mut String, piece: &PlacedPiece) {
    let label = piece.label.trim();
    let has_label = !label.is_empty();
    let center_x = piece.x + piece.width / 2.0;

    if has_label {
        let font_size = 13.0_f64.min(piece.width / 6.0);
        let max_chars = (piece.width / 7.0) as usize;
        let escaped_label = escape_xml_text(&truncate(label, max_chars));
        let y = piece.y + piece.height / 2.0 - 5.0;
        svg_write!(
            svg,
            "<text x=\"{center_x}\" y=\"{y}\" text-anchor=\"middle\" dominant-baseline=\"middle\" font-size=\"{font_size}\" font-weight=\"600\" fill=\"{C_WHITE}\">{escaped_label}</text>"
        );
    }

    let dimensions = format!("{:.0}\u{00d7}{:.0}", piece.width, piece.height);
    let y = if has_label {
        piece.y + piece.height / 2.0 + 9.0
    } else {
        piece.y + piece.height / 2.0
    };
    let font_size = 11.0_f64.min(piece.width / 7.0);
    svg_write!(
        svg,
        "<text x=\"{center_x}\" y=\"{y}\" text-anchor=\"middle\" dominant-baseline=\"middle\" font-size=\"{font_size}\" fill=\"{C_WHITE}\" opacity=\"0.85\">{dimensions}</text>"
    );
}

fn safe_piece_color(color: &str, piece_index: usize) -> &str {
    let color = color.trim();
    if is_safe_hex_color(color) {
        color
    } else {
        piece_color(piece_index.saturating_sub(1))
    }
}

fn is_safe_hex_color(color: &str) -> bool {
    matches!(color.len(), 4 | 7)
        && color.starts_with('#')
        && color[1..].bytes().all(|byte| byte.is_ascii_hexdigit())
}

fn escape_xml_text(text: &str) -> String {
    let mut escaped = String::with_capacity(text.len());
    for ch in text.chars() {
        match ch {
            '&' => escaped.push_str("&amp;"),
            '<' => escaped.push_str("&lt;"),
            '>' => escaped.push_str("&gt;"),
            ch if is_xml_1_0_char(ch) => escaped.push(ch),
            _ => escaped.push('\u{fffd}'),
        }
    }
    escaped
}

fn is_xml_1_0_char(ch: char) -> bool {
    matches!(
        ch,
        '\u{9}' | '\u{a}' | '\u{d}' | '\u{20}'..='\u{d7ff}' | '\u{e000}'..='\u{fffd}' | '\u{10000}'..='\u{10ffff}'
    )
}

fn write_dimension_labels(svg: &mut String, sheet: &Sheet) {
    if sheet.width < 12.0 || sheet.height < 12.0 {
        return;
    }

    let width_x = sheet.width / 2.0;
    let width_y = sheet.height - 4.0;
    svg_write!(
        svg,
        "<text x=\"{width_x}\" y=\"{width_y}\" text-anchor=\"middle\" font-size=\"11\" fill=\"{C_DIM}\">{:.0} мм</text>",
        sheet.width
    );

    let height_y = sheet.height / 2.0;
    svg_write!(
        svg,
        "<text x=\"4\" y=\"{height_y}\" text-anchor=\"middle\" dominant-baseline=\"middle\" font-size=\"11\" fill=\"{C_DIM}\" transform=\"rotate(-90,4,{height_y})\">{:.0} мм</text>",
        sheet.height
    );
}

#[cfg(test)]
mod tests {
    use super::*;
    use cutter_core::optimizer::CuttingStrategy;

    fn sheet(index: usize, width: f64, height: f64, pieces: Vec<PlacedPiece>) -> Sheet {
        Sheet {
            index,
            width,
            height,
            placed_pieces: pieces,
        }
    }

    fn piece(label: &str, color: &str) -> PlacedPiece {
        PlacedPiece {
            source_id: "piece-1".into(),
            label: label.into(),
            color: color.into(),
            x: 10.0,
            y: 10.0,
            width: 80.0,
            height: 50.0,
            is_rotated: false,
        }
    }

    fn result_with(sheets: Vec<Sheet>) -> CuttingResult {
        let mut result = CuttingResult::new(CuttingStrategy::BestAreaAreaDesc);
        result.sheets = sheets;
        result
    }

    fn root_attribute(svg: &str, attribute: &str) -> f64 {
        let marker = format!("{attribute}=\"");
        let start = svg.find(&marker).expect("root attribute") + marker.len();
        let end = svg[start..].find('"').expect("closing quote") + start;
        svg[start..end].parse().expect("numeric root attribute")
    }

    #[test]
    fn truncate_streams_unicode_without_collecting_all_chars() {
        assert_eq!(truncate("abcdef", 3), "abc\u{2026}");
        assert_eq!(truncate("абв", 3), "абв");
        assert_eq!(truncate("abc", 0), "");
    }

    #[test]
    fn malicious_label_is_xml_escaped_and_invalid_color_uses_palette() {
        let malicious_label = "</text><script>alert('label & color')</script>";
        let malicious_color = "#fff\"/><script>alert('color')</script><rect fill=\"";
        let mut malicious_piece = piece(malicious_label, malicious_color);
        malicious_piece.width = 800.0;
        malicious_piece.height = 500.0;
        let svg = render_sheet_svg(
            &sheet(0, 1000.0, 600.0, vec![malicious_piece]),
            1000.0,
            600.0,
        )
        .unwrap();

        assert!(!svg.contains("<script"));
        assert!(!svg.contains(malicious_color));
        assert!(
            svg.contains("&lt;/text&gt;&lt;script&gt;alert('label &amp; color')&lt;/script&gt;")
        );
        assert!(svg.contains("fill=\"#4A90D9\""));
    }

    #[test]
    fn color_accepts_only_opaque_short_or_long_hex() {
        assert_eq!(safe_piece_color("#abc", 1), "#abc");
        assert_eq!(safe_piece_color("#A1b2C3", 1), "#A1b2C3");
        assert_eq!(safe_piece_color("#abcd", 1), PIECE_COLORS[0]);
        assert_eq!(safe_piece_color("#11223344", 1), PIECE_COLORS[0]);
    }

    #[test]
    fn invalid_xml_control_characters_are_replaced() {
        let svg = render_sheet_svg(
            &sheet(0, 100.0, 100.0, vec![piece("valid\0label", "#abc")]),
            100.0,
            100.0,
        )
        .unwrap();

        assert!(!svg.contains('\0'));
        assert!(svg.contains("valid\u{fffd}label"));
    }

    #[test]
    fn invalid_or_tiny_limits_are_rejected() {
        let sheet = sheet(0, 100.0, 100.0, Vec::new());
        for invalid in [-1.0, 0.0, 0.999, f64::NAN, f64::INFINITY, f64::NEG_INFINITY] {
            assert!(matches!(
                render_sheet_svg(&sheet, invalid, 100.0),
                Err(RenderSvgError::InvalidLimit { field: "max_w", .. })
            ));
            assert!(matches!(
                render_sheet_svg(&sheet, 100.0, invalid),
                Err(RenderSvgError::InvalidLimit { field: "max_h", .. })
            ));
        }
    }

    #[test]
    fn oversized_requested_canvas_is_rejected_at_axis_and_area_boundaries() {
        let sheet = sheet(0, 100.0, 100.0, Vec::new());
        assert!(matches!(
            render_sheet_svg(&sheet, 1e308, 100.0),
            Err(RenderSvgError::CanvasAxisTooLarge {
                context: "requested canvas",
                axis: "width",
                ..
            })
        ));
        assert!(matches!(
            render_sheet_svg(&sheet, MAX_SVG_AXIS, MAX_SVG_AXIS),
            Err(RenderSvgError::CanvasAreaTooLarge {
                context: "requested canvas",
                ..
            })
        ));
        assert!(render_sheet_svg(&sheet, MAX_SVG_AXIS, MAX_SVG_AREA / MAX_SVG_AXIS).is_ok());
    }

    #[test]
    fn invalid_sheet_piece_and_derived_geometry_are_rejected() {
        let invalid_sheet = sheet(7, f64::NAN, 100.0, Vec::new());
        assert!(matches!(
            render_sheet_svg(&invalid_sheet, 100.0, 100.0),
            Err(RenderSvgError::InvalidSheetGeometry {
                sheet_index: 7,
                field: "width",
                ..
            })
        ));

        let mut invalid_piece = piece("bad", "#abc");
        invalid_piece.x = -1.0;
        assert!(matches!(
            render_sheet_svg(&sheet(3, 100.0, 100.0, vec![invalid_piece]), 100.0, 100.0),
            Err(RenderSvgError::InvalidPieceGeometry {
                sheet_index: 3,
                piece_index: 0,
                field: "x",
                ..
            })
        ));

        let overflowing = result_with(vec![
            sheet(0, f64::MAX, f64::MAX, Vec::new()),
            sheet(1, f64::MAX, f64::MAX, Vec::new()),
        ]);
        assert!(matches!(
            render_result_svg(&overflowing, 100.0, 100.0),
            Err(RenderSvgError::InvalidDerivedGeometry {
                field: "combined sheet height",
                ..
            })
        ));
    }

    #[test]
    fn pieces_outside_sheet_are_rejected_with_small_rounding_tolerance() {
        let mut huge_x = piece("huge x", "#abc");
        huge_x.x = f64::MAX;
        assert!(matches!(
            render_sheet_svg(&sheet(0, 100.0, 100.0, vec![huge_x]), 100.0, 100.0),
            Err(RenderSvgError::PieceOutsideSheet {
                sheet_index: 0,
                piece_index: 0,
                ..
            })
        ));

        let mut beyond_edge = piece("outside", "#abc");
        beyond_edge.x = 99.0;
        beyond_edge.width = 10.0;
        assert!(matches!(
            render_sheet_svg(&sheet(1, 100.0, 100.0, vec![beyond_edge]), 100.0, 100.0),
            Err(RenderSvgError::PieceOutsideSheet {
                sheet_index: 1,
                piece_index: 0,
                ..
            })
        ));

        let mut rounding_noise = piece("epsilon", "#abc");
        rounding_noise.x = 20.0;
        rounding_noise.width = 80.0 + 5e-8;
        assert!(
            render_sheet_svg(&sheet(2, 100.0, 100.0, vec![rounding_noise]), 100.0, 100.0).is_ok()
        );
    }

    #[test]
    fn finite_extreme_sheet_dimensions_do_not_emit_non_finite_numbers() {
        let svg =
            render_sheet_svg(&sheet(0, f64::MAX, f64::MAX, Vec::new()), 100.0, 100.0).unwrap();

        assert!(!svg.contains("NaN"));
        assert!(!svg.contains("inf"));
    }

    #[test]
    fn result_with_multiple_sheets_is_one_bounded_svg_with_shared_scale() {
        let result = result_with(vec![
            sheet(0, 100.0, 50.0, Vec::new()),
            sheet(1, 50.0, 100.0, Vec::new()),
        ]);

        let svg = render_result_svg(&result, 40.0, 100.0).unwrap();
        let expected_scale = 0.4;

        assert_eq!(svg.matches("<svg ").count(), 1);
        assert_eq!(svg.matches("</svg>").count(), 1);
        assert_eq!(svg.matches("<g data-sheet-index=").count(), 2);
        assert_eq!(svg.matches(&format!("scale({expected_scale})")).count(), 2);
        assert!(root_attribute(&svg, "width") <= 40.0);
        assert!(root_attribute(&svg, "height") <= 100.0);
        assert!(svg.contains("data-sheet-index=\"1\" transform=\"translate(10 29.6)"));
        assert!(svg.ends_with("</svg>"));
    }

    #[test]
    fn two_hundred_fifty_sheets_are_rejected_as_unreadably_dense() {
        let sheets = (0..250)
            .map(|index| {
                let width = 100.0 + (index % 3) as f64 * 25.0;
                let height = 50.0 + (index % 5) as f64 * 10.0;
                sheet(index, width, height, Vec::new())
            })
            .collect();
        assert!(matches!(
            render_result_svg(&result_with(sheets), 320.0, 600.0),
            Err(RenderSvgError::LayoutTooDense {
                minimum: MIN_SCALED_SHEET_DIMENSION,
                ..
            })
        ));
    }

    #[test]
    fn empty_result_is_a_valid_empty_svg_document() {
        let result = CuttingResult::new(CuttingStrategy::BestAreaAreaDesc);
        let svg = render_result_svg(&result, 200.0, 100.0).unwrap();

        assert_eq!(
            svg,
            "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"1\" height=\"1\" viewBox=\"0 0 1 1\"></svg>"
        );
    }
}
