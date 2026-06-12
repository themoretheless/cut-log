//! Parametric finger-joint box: the single source of truth for box geometry.
//!
//! Produces SVG cut paths, the piece list and the cutting layout. The 3D
//! assembly view (`cutter_ui::box3d`) consumes the same [`BoxParams`] and
//! shared helpers (`tab_positions`, shelf math, bevel offsets) so the SVG and
//! 3D representations can never drift. Presentation (localized labels, colors)
//! lives in the frontend; this module only emits semantic ids and geometry.

use std::fmt::Write;

/// All user-facing box parameters. Derived quantities are exposed as methods so
/// every consumer computes them identically.
#[derive(Debug, Clone, Copy, serde::Serialize, serde::Deserialize)]
pub struct BoxParams {
    pub w: f64,
    pub h: f64,
    pub d: f64,
    pub t: f64,
    pub kerf: f64,
    pub tab_h: f64,
    pub n_tab: usize,
    pub n_shelves: usize,
    pub bevel: f64,
}

impl BoxParams {
    /// Slot width = material thickness plus kerf.
    pub fn tf(&self) -> f64 { self.t + self.kerf }
    /// Inner width between side walls.
    pub fn wi(&self) -> f64 { self.w - 2.0 * self.t }
    /// Inner height between top and bottom.
    pub fn hi(&self) -> f64 { self.h - 2.0 * self.t }
    /// Depth of the top panel (reduced by a positive bevel).
    pub fn top_d(&self) -> f64 { self.d - self.bevel.max(0.0) }
    /// Depth of the bottom panel (reduced by a negative bevel).
    pub fn bot_d(&self) -> f64 { self.d - (-self.bevel).max(0.0) }

    /// Top edge Y of each shelf slot on the side wall.
    pub fn shelf_slot_ys(&self) -> Vec<f64> {
        shelf_slot_ys(self.n_shelves, self.hi(), self.tf(), self.t)
    }

    /// Front-edge inset of a shelf at height `sy`, interpolated along the bevel.
    pub fn shelf_offset_at(&self, sy: f64) -> f64 {
        let frac = sy / self.h;
        let c_top = self.bevel.max(0.0);
        let c_bot = (-self.bevel).max(0.0);
        c_bot + (c_top - c_bot) * frac
    }

    /// Usable depth of a shelf at height `sy`.
    pub fn shelf_depth_at(&self, sy: f64) -> f64 {
        self.d - self.shelf_offset_at(sy)
    }

    /// Tab positions of a full edge of length `full_len`, restricted to the
    /// window `[offset, offset + len]` and shifted to local coordinates.
    pub fn depth_tabs(&self, full_len: f64, offset: f64, len: f64) -> Vec<f64> {
        let th = self.tab_h;
        tab_positions(full_len, self.n_tab, self.tab_h)
            .into_iter()
            .filter(|&x| x >= offset && x + th <= offset + len)
            .map(|x| x - offset)
            .collect()
    }
}

/// Evenly distributes `n_tab` tabs/slots of width `tab_h` along an edge of length `len`.
pub fn tab_positions(len: f64, n_tab: usize, tab_h: f64) -> Vec<f64> {
    let gap = (len - n_tab as f64 * tab_h) / (n_tab as f64 + 1.0);
    (0..n_tab).map(|i| gap + i as f64 * (gap + tab_h)).collect()
}

/// Y-coordinates of the top edge of each shelf slot on the side wall.
pub fn shelf_slot_ys(n_shelves: usize, hi: f64, tf: f64, t: f64) -> Vec<f64> {
    if n_shelves == 0 { return Vec::new(); }
    let gap = (hi - n_shelves as f64 * tf) / (n_shelves as f64 + 1.0);
    (0..n_shelves).map(|i| t + gap + i as f64 * (gap + tf)).collect()
}

/// Formats a coordinate with two decimals (matches the frontend's `toFixed(2)`).
#[inline]
fn f(v: f64) -> String { format!("{v:.2}") }

// ── SVG path builders ─────────────────────────────────────────────────────
// String formatting mirrors the frontend exactly: f()-formatted coordinates use
// two decimals, literal `0` endpoints stay bare. Golden fixtures enforce this.

/// Side wall outline (with bevel clipping and shelf slots).
pub fn path_side(p: &BoxParams) -> String {
    let (pw, ph, tf, th) = (p.d, p.h, p.tf(), p.tab_h);
    let clip_top = p.bevel.max(0.0);
    let clip_bot = (-p.bevel).max(0.0);
    let mut d = String::with_capacity(1024);
    write!(d, "M{},0", f(clip_top)).unwrap();
    for x in tab_positions(p.d, p.n_tab, p.tab_h) {
        if x < clip_top { continue; }
        write!(d, " L{},0 L{},{} L{},{} L{},0", f(x), f(x), f(tf), f(x + th), f(tf), f(x + th)).unwrap();
    }
    write!(d, " L{},0", f(pw)).unwrap();
    for y in tab_positions(p.h, p.n_tab, p.tab_h) {
        write!(d, " L{},{} L{},{} L{},{} L{},{}", f(pw), f(y), f(pw - tf), f(y), f(pw - tf), f(y + th), f(pw), f(y + th)).unwrap();
    }
    write!(d, " L{},{}", f(pw), f(ph)).unwrap();
    for x in tab_positions(p.d, p.n_tab, p.tab_h).into_iter().rev() {
        if x < clip_bot { continue; }
        write!(d, " L{},{} L{},{} L{},{} L{},{}", f(x + th), f(ph), f(x + th), f(ph - tf), f(x), f(ph - tf), f(x), f(ph)).unwrap();
    }
    write!(d, " L{},{} Z", f(clip_bot), f(ph)).unwrap();
    for sy in p.shelf_slot_ys() {
        let s_off = p.shelf_offset_at(sy);
        for x in tab_positions(p.d, p.n_tab, p.tab_h) {
            if x < s_off || x + th > pw { continue; }
            write!(d, " M{},{} L{},{} L{},{} L{},{} Z", f(x), f(sy), f(x + th), f(sy), f(x + th), f(sy + tf), f(x), f(sy + tf)).unwrap();
        }
    }
    d
}

/// Horizontal panel (top/bottom) outline. `depth`/`depth_off` carry the bevel.
pub fn path_top_bottom(p: &BoxParams, depth: f64, depth_off: f64) -> String {
    let (ph, pw, tf, th, t, wi) = (depth, p.w, p.tf(), p.tab_h, p.t, p.wi());
    let side_tabs = p.depth_tabs(p.d, depth_off, ph);
    let mut d = String::with_capacity(1024);
    write!(d, "M{},0 L{},0", f(t), f(pw - t)).unwrap();
    for y in &side_tabs {
        let y = *y;
        write!(d, " L{},{} L{},{} L{},{} L{},{}", f(pw - t), f(y), f(pw), f(y), f(pw), f(y + th), f(pw - t), f(y + th)).unwrap();
    }
    write!(d, " L{},{}", f(pw - t), f(ph)).unwrap();
    for x in tab_positions(wi, p.n_tab, p.tab_h).into_iter().rev() {
        let rx = t + x;
        write!(d, " L{},{} L{},{} L{},{} L{},{}", f(rx + th), f(ph), f(rx + th), f(ph - tf), f(rx), f(ph - tf), f(rx), f(ph)).unwrap();
    }
    write!(d, " L{},{}", f(t), f(ph)).unwrap();
    for y in side_tabs.iter().rev() {
        let y = *y;
        write!(d, " L{},{} L0,{} L0,{} L{},{}", f(t), f(y + th), f(y + th), f(y), f(t), f(y)).unwrap();
    }
    write!(d, " L{},0 Z", f(t)).unwrap();
    d
}

/// Convenience: top panel path.
pub fn path_top(p: &BoxParams) -> String { path_top_bottom(p, p.top_d(), p.bevel.max(0.0)) }
/// Convenience: bottom panel path.
pub fn path_bottom(p: &BoxParams) -> String { path_top_bottom(p, p.bot_d(), (-p.bevel).max(0.0)) }

/// Back wall outline (with shelf slots). Unaffected by bevel.
pub fn path_back(p: &BoxParams) -> String {
    let (pw, ph, tf, th, t, wi, hi) = (p.w, p.h, p.tf(), p.tab_h, p.t, p.wi(), p.hi());
    let mut d = String::with_capacity(1024);
    write!(d, "M{},{}", f(t), f(t)).unwrap();
    for x in tab_positions(wi, p.n_tab, p.tab_h) {
        let rx = t + x;
        write!(d, " L{},{} L{},0 L{},0 L{},{}", f(rx), f(t), f(rx), f(rx + th), f(rx + th), f(t)).unwrap();
    }
    write!(d, " L{},{}", f(pw - t), f(t)).unwrap();
    for y in tab_positions(hi, p.n_tab, p.tab_h) {
        let ry = t + y;
        write!(d, " L{},{} L{},{} L{},{} L{},{}", f(pw - t), f(ry), f(pw), f(ry), f(pw), f(ry + th), f(pw - t), f(ry + th)).unwrap();
    }
    write!(d, " L{},{}", f(pw - t), f(ph - t)).unwrap();
    for x in tab_positions(wi, p.n_tab, p.tab_h).into_iter().rev() {
        let rx = t + x;
        write!(d, " L{},{} L{},{} L{},{} L{},{}", f(rx + th), f(ph - t), f(rx + th), f(ph), f(rx), f(ph), f(rx), f(ph - t)).unwrap();
    }
    write!(d, " L{},{}", f(t), f(ph - t)).unwrap();
    for y in tab_positions(hi, p.n_tab, p.tab_h).into_iter().rev() {
        let ry = t + y;
        write!(d, " L{},{} L0,{} L0,{} L{},{}", f(t), f(ry + th), f(ry + th), f(ry), f(t), f(ry)).unwrap();
    }
    d.push_str(" Z");
    for sy in p.shelf_slot_ys() {
        for x in tab_positions(wi, p.n_tab, p.tab_h) {
            let rx = t + x;
            write!(d, " M{},{} L{},{} L{},{} L{},{} Z", f(rx), f(sy), f(rx + th), f(sy), f(rx + th), f(sy + tf), f(rx), f(sy + tf)).unwrap();
        }
    }
    d
}

/// Shelf outline of usable `depth`, inset by `depth_off` along the bevel.
pub fn path_shelf(p: &BoxParams, depth: f64, depth_off: f64) -> String {
    let (ph, pw, th, t, wi) = (depth, p.w, p.tab_h, p.t, p.wi());
    let side_tabs = p.depth_tabs(p.d, depth_off, ph);
    let mut d = String::with_capacity(1024);
    write!(d, "M{},0 L{},0", f(t), f(pw - t)).unwrap();
    for y in &side_tabs {
        let y = *y;
        write!(d, " L{},{} L{},{} L{},{} L{},{}", f(pw - t), f(y), f(pw), f(y), f(pw), f(y + th), f(pw - t), f(y + th)).unwrap();
    }
    write!(d, " L{},{}", f(pw - t), f(ph - t)).unwrap();
    for x in tab_positions(wi, p.n_tab, p.tab_h).into_iter().rev() {
        let rx = t + x;
        write!(d, " L{},{} L{},{} L{},{} L{},{}", f(rx + th), f(ph - t), f(rx + th), f(ph), f(rx), f(ph), f(rx), f(ph - t)).unwrap();
    }
    write!(d, " L{},{}", f(t), f(ph - t)).unwrap();
    for y in side_tabs.iter().rev() {
        let y = *y;
        write!(d, " L{},{} L0,{} L0,{} L{},{}", f(t), f(y + th), f(y + th), f(y), f(t), f(y)).unwrap();
    }
    write!(d, " L{},0 Z", f(t)).unwrap();
    d
}

// ── Piece list ─────────────────────────────────────────────────────────────

/// A physical box panel, identified semantically (the frontend supplies the
/// localized label and color).
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct BoxPiece {
    pub id: String,
    pub w: f64,
    pub h: f64,
    pub label: String,
    pub color: String,
}

/// Every physical panel, sorted by descending area for First-Fit-Decreasing.
/// `label`/`color` are left empty; presentation is the frontend's concern.
pub fn all_box_pieces(p: &BoxParams) -> Vec<BoxPiece> {
    let mut list = vec![
        BoxPiece { id: "side1".into(), w: p.d, h: p.h, label: String::new(), color: String::new() },
        BoxPiece { id: "side2".into(), w: p.d, h: p.h, label: String::new(), color: String::new() },
        BoxPiece { id: "top".into(), w: p.w, h: p.top_d(), label: String::new(), color: String::new() },
        BoxPiece { id: "bot".into(), w: p.w, h: p.bot_d(), label: String::new(), color: String::new() },
        BoxPiece { id: "back".into(), w: p.w, h: p.h, label: String::new(), color: String::new() },
    ];
    let ys = p.shelf_slot_ys();
    for (i, &sy) in ys.iter().enumerate() {
        list.push(BoxPiece { id: format!("shelf{i}"), w: p.w, h: p.shelf_depth_at(sy), label: String::new(), color: String::new() });
    }
    list.sort_by(|a, b| (b.w * b.h).partial_cmp(&(a.w * a.h)).unwrap());
    list
}

/// SVG cut path for a physical piece id (`side1`/`side2`/`top`/`bot`/`back`/`shelf{i}`).
pub fn piece_path(p: &BoxParams, id: &str) -> Option<String> {
    let path = match id {
        "side1" | "side2" | "side" => path_side(p),
        "top" => path_top(p),
        "bot" => path_bottom(p),
        "tb" => path_top_bottom(p, p.d, 0.0),
        "back" => path_back(p),
        _ if id.starts_with("shelf") && id.len() > 5 => {
            let i: usize = id[5..].parse().ok()?;
            let sy = *p.shelf_slot_ys().get(i)?;
            path_shelf(p, p.shelf_depth_at(sy), p.shelf_offset_at(sy))
        }
        "shelf" => path_shelf(p, p.d, 0.0),
        _ => return None,
    };
    Some(path)
}

// ── Cutting layout (shelf-based First Fit Decreasing) ─────────────────────

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct LayoutPiece {
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
    pub id: String,
    pub label: String,
    pub color: String,
}

pub fn compute_layout(pieces: &[BoxPiece], sheet_w: f64, sheet_h: f64, gap: f64) -> Vec<Vec<LayoutPiece>> {
    let mut todo: Vec<&BoxPiece> = pieces.iter().collect();
    let mut result: Vec<Vec<LayoutPiece>> = Vec::new();

    while !todo.is_empty() {
        let mut sheet_pieces: Vec<LayoutPiece> = Vec::new();
        let mut shelves: Vec<(f64, f64, f64)> = vec![(gap, 0.0, gap)]; // (y, max_h, next_x)
        let mut remaining: Vec<&BoxPiece> = Vec::new();

        for p in &todo {
            let mut placed = false;
            let orientations: Vec<(f64, f64)> = if (p.w - p.h).abs() < 0.01 {
                vec![(p.w, p.h)]
            } else {
                vec![(p.w, p.h), (p.h, p.w)]
            };

            for &(fw, fh) in &orientations {
                if placed { break; }
                if fw > sheet_w - 2.0 * gap || fh > sheet_h - 2.0 * gap { continue; }

                for shelf in &mut shelves {
                    if placed { break; }
                    let (sy, sh, nx) = *shelf;
                    if nx + fw + gap <= sheet_w && sy + fh + gap <= sheet_h {
                        sheet_pieces.push(LayoutPiece {
                            x: nx, y: sy, w: fw, h: fh,
                            id: p.id.clone(), label: p.label.clone(), color: p.color.clone(),
                        });
                        *shelf = (sy, sh.max(fh), nx + fw + gap);
                        placed = true;
                    }
                }

                if !placed {
                    let last = *shelves.last().unwrap();
                    if last.1 == 0.0 { continue; }
                    let new_y = last.0 + last.1 + gap;
                    if new_y + fh + gap <= sheet_h && gap + fw + gap <= sheet_w {
                        shelves.push((new_y, fh, gap + fw + gap));
                        sheet_pieces.push(LayoutPiece {
                            x: gap, y: new_y, w: fw, h: fh,
                            id: p.id.clone(), label: p.label.clone(), color: p.color.clone(),
                        });
                        placed = true;
                    }
                }
            }

            if !placed { remaining.push(p); }
        }

        if sheet_pieces.is_empty() { break; }
        result.push(sheet_pieces);
        todo = remaining;
    }

    result
}

// ── Gallery grouping (parts list + thumbnails) ─────────────────────────────

/// A grouped entry for the parts gallery: identical panels are collapsed into
/// one entry with a `count`. The id drives both the SVG thumbnail (this module)
/// and the isolated 3D view (`cutter_ui::box3d`), so the two never diverge.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct GalleryPiece {
    pub id: String,
    pub count: usize,
    pub w: f64,
    pub h: f64,
    pub path: String,
}

/// The gallery grouping: sides (×2), top/bottom (grouped when flat, split when
/// beveled), back, and shelves (grouped when flat, per-shelf when beveled).
pub fn gallery_pieces(p: &BoxParams) -> Vec<GalleryPiece> {
    let mut list = vec![
        GalleryPiece { id: "side".into(), count: 2, w: p.d, h: p.h, path: path_side(p) },
    ];
    if p.bevel == 0.0 {
        list.push(GalleryPiece { id: "tb".into(), count: 2, w: p.w, h: p.d, path: path_top_bottom(p, p.d, 0.0) });
    } else {
        list.push(GalleryPiece { id: "top".into(), count: 1, w: p.w, h: p.top_d(), path: path_top(p) });
        list.push(GalleryPiece { id: "bot".into(), count: 1, w: p.w, h: p.bot_d(), path: path_bottom(p) });
    }
    list.push(GalleryPiece { id: "back".into(), count: 1, w: p.w, h: p.h, path: path_back(p) });
    let ys = p.shelf_slot_ys();
    if p.bevel == 0.0 && !ys.is_empty() {
        list.push(GalleryPiece { id: "shelf".into(), count: ys.len(), w: p.w, h: p.d, path: path_shelf(p, p.d, 0.0) });
    } else {
        for (i, &sy) in ys.iter().enumerate() {
            let sd = p.shelf_depth_at(sy);
            list.push(GalleryPiece { id: format!("shelf{i}"), count: 1, w: p.w, h: sd, path: path_shelf(p, sd, p.shelf_offset_at(sy)) });
        }
    }
    list
}

/// Wrap a path into a standalone SVG for export.
pub fn wrap_cut_svg(path: &str, pw: f64, ph: f64, x_off: f64) -> String {
    format!(
        "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n\
         <svg xmlns=\"http://www.w3.org/2000/svg\" width=\"{pw:.2}mm\" height=\"{ph:.2}mm\" viewBox=\"{:.2} 0 {pw:.2} {ph:.2}\">\n\
         <path d=\"{path}\" fill=\"none\" stroke=\"#ff0000\" stroke-width=\"0.01\" stroke-linejoin=\"miter\"/>\n\
         </svg>",
        -x_off
    )
}
