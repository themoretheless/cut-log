use std::fmt::Write;

use cutter_core::models::*;

pub const PIECE_COLORS: [&str; 10] = [
    "#4A90D9", "#E67E22", "#27AE60", "#9B59B6", "#E74C3C",
    "#1ABC9C", "#F39C12", "#2980B9", "#8E44AD", "#16A085",
];

// Sheet rendering palette.
const C_BG: &str = "#f5f0e8";
const C_BORDER: &str = "#8B7355";
const C_GRAIN: &str = "#d4c9a8";
const C_WHITE: &str = "#fff";
const C_DIM: &str = "#8B7355";

// A piece must be at least this big (in SVG px) to carry a text label.
const LABEL_MIN_W: f64 = 40.0;
const LABEL_MIN_H: f64 = 22.0;

pub fn piece_color(index: usize) -> &'static str {
    PIECE_COLORS[index % PIECE_COLORS.len()]
}

pub fn truncate(s: &str, max_chars: usize) -> String {
    if max_chars == 0 {
        return String::new();
    }
    let chars: Vec<char> = s.chars().collect();
    if chars.len() <= max_chars {
        s.to_string()
    } else {
        let mut result: String = chars[..max_chars].iter().collect();
        result.push('\u{2026}');
        result
    }
}

pub fn efficiency_class(e: f64) -> &'static str {
    if e >= 80.0 { "eff-good" }
    else if e >= 55.0 { "eff-ok" }
    else { "eff-poor" }
}

macro_rules! svg_write {
    ($dst:expr, $($arg:tt)*) => {
        write!($dst, $($arg)*).unwrap()
    };
}

/// Render a single sheet as a standalone SVG string.
pub fn render_sheet_svg(sheet: &Sheet, max_w: f64, max_h: f64) -> String {
    let scale = (max_w / sheet.width).min(max_h / sheet.height);
    let svg_w = sheet.width * scale;
    let svg_h = sheet.height * scale;

    let mut svg = String::with_capacity(4096);
    svg_write!(svg,
        "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"{svg_w:.0}\" height=\"{svg_h:.0}\" viewBox=\"0 0 {svg_w:.0} {svg_h:.0}\">"
    );
    write_background(&mut svg, svg_w, svg_h);
    write_grain(&mut svg, svg_w, svg_h);
    for (i, pp) in sheet.placed_pieces.iter().enumerate() {
        write_piece(&mut svg, pp, i + 1, scale);
    }
    write_dimension_labels(&mut svg, sheet, svg_w, svg_h);
    svg.push_str("</svg>");
    svg
}

fn write_background(svg: &mut String, svg_w: f64, svg_h: f64) {
    svg_write!(svg,
        "<rect width=\"{svg_w:.0}\" height=\"{svg_h:.0}\" fill=\"{C_BG}\" stroke=\"{C_BORDER}\" stroke-width=\"2\"/>"
    );
}

fn write_grain(svg: &mut String, svg_w: f64, svg_h: f64) {
    for g in 1..10 {
        let gy = svg_h * g as f64 / 10.0;
        svg_write!(svg,
            "<line x1=\"0\" y1=\"{gy:.1}\" x2=\"{svg_w:.0}\" y2=\"{gy:.1}\" stroke=\"{C_GRAIN}\" stroke-width=\"0.5\"/>"
        );
    }
}

fn write_piece(svg: &mut String, pp: &PlacedPiece, piece_idx: usize, scale: f64) {
    let x = pp.x * scale;
    let y = pp.y * scale;
    let w = pp.width * scale;
    let h = pp.height * scale;
    let color = &pp.color;

    // Piece rect
    svg_write!(svg,
        "<rect x=\"{x:.1}\" y=\"{y:.1}\" width=\"{w:.1}\" height=\"{h:.1}\" fill=\"{color}\" fill-opacity=\"0.82\" stroke=\"{C_WHITE}\" stroke-width=\"0.1\"/>"
    );

    // Index badge
    let badge_w = if piece_idx >= 10 { 16.0 } else { 12.0 };
    let badge_h = 13.0;
    let bx = x + 3.0;
    let by = y + 3.0;
    svg_write!(svg,
        "<rect x=\"{bx:.1}\" y=\"{by:.1}\" width=\"{badge_w:.0}\" height=\"{badge_h:.0}\" rx=\"3\" fill=\"rgba(0,0,0,0.35)\"/>"
    );
    let tx = bx + badge_w / 2.0;
    let ty = by + badge_h / 2.0;
    svg_write!(svg,
        "<text x=\"{tx:.1}\" y=\"{ty:.1}\" text-anchor=\"middle\" dominant-baseline=\"middle\" font-size=\"8\" font-weight=\"700\" fill=\"{C_WHITE}\">{piece_idx}</text>"
    );

    // Rotation indicator
    if pp.is_rotated {
        let rx = x + w - 6.0;
        let ry = y + 12.0;
        svg_write!(svg,
            "<text x=\"{rx:.1}\" y=\"{ry:.1}\" font-size=\"10\" fill=\"{C_WHITE}\" opacity=\"0.9\">\u{21bb}</text>"
        );
    }

    // Label and dimensions (only when the piece is large enough)
    if w > LABEL_MIN_W && h > LABEL_MIN_H {
        let label = pp.label.trim();
        let has_label = !label.is_empty();
        let cx = x + w / 2.0;

        if has_label {
            let font_size = 13.0_f64.min(w / 6.0);
            let max_chars = (w / 7.0) as usize;
            let truncated = truncate(label, max_chars);
            let ly = y + h / 2.0 - 5.0;
            svg_write!(svg,
                "<text x=\"{cx:.1}\" y=\"{ly:.1}\" text-anchor=\"middle\" dominant-baseline=\"middle\" font-size=\"{font_size:.0}\" font-weight=\"600\" fill=\"{C_WHITE}\">{truncated}</text>"
            );
        }

        let dims = format!("{:.0}\u{00d7}{:.0}", pp.width, pp.height);
        let dims_y = if has_label { y + h / 2.0 + 9.0 } else { y + h / 2.0 };
        let font_size = 11.0_f64.min(w / 7.0);
        svg_write!(svg,
            "<text x=\"{cx:.1}\" y=\"{dims_y:.1}\" text-anchor=\"middle\" dominant-baseline=\"middle\" font-size=\"{font_size:.0}\" fill=\"{C_WHITE}\" opacity=\"0.85\">{dims}</text>"
        );
    }
}

fn write_dimension_labels(svg: &mut String, sheet: &Sheet, svg_w: f64, svg_h: f64) {
    // Bottom (width)
    let bx = svg_w / 2.0;
    let by = svg_h - 4.0;
    let sw = sheet.width;
    svg_write!(svg,
        "<text x=\"{bx:.0}\" y=\"{by:.0}\" text-anchor=\"middle\" font-size=\"11\" fill=\"{C_DIM}\">{sw:.0} мм</text>"
    );

    // Left (height), rotated
    let ly = svg_h / 2.0;
    let sh = sheet.height;
    svg_write!(svg,
        "<text x=\"4\" y=\"{ly:.0}\" text-anchor=\"middle\" dominant-baseline=\"middle\" font-size=\"11\" fill=\"{C_DIM}\" transform=\"rotate(-90,4,{ly:.0})\">{sh:.0} мм</text>"
    );
}

/// Render all sheets from a [`CuttingResult`] as one SVG document per sheet.
pub fn render_result_svg(result: &CuttingResult, max_w: f64, max_h: f64) -> String {
    let mut output = String::new();
    for sheet in &result.sheets {
        if !output.is_empty() {
            output.push('\n');
        }
        output.push_str(&render_sheet_svg(sheet, max_w, max_h));
    }
    output
}
