//! 3D geometry for the box assembly view, driven by [`BoxParams`].
//!
//! Emits panel/guide/label data in **base** coordinates (no explode baked in)
//! plus per-element explode metadata `{axis, sign}`, so the frontend can animate
//! the explode smoothly and render on demand. Panels carry only a semantic `id`;
//! colors and localized labels live in the frontend.

use cutter_core::box_builder::{tab_positions, BoxParams};
use serde::Serialize;

pub type Pt3 = [f64; 3];

// ── Contour generators (bevel-aware; ported 1:1 from the frontend) ─────────

/// Side wall contour at x = x0.
pub fn side_pts_3d(p: &BoxParams, x0: f64) -> Vec<Pt3> {
    let (d, h, tf, th) = (p.d, p.h, p.tf(), p.tab_h);
    let clip_bot = (-p.bevel).max(0.0);
    let clip_top = p.bevel.max(0.0);
    let mut pts = Vec::new();
    let mut a = |y: f64, z: f64| pts.push([x0, y, z]);
    a(clip_bot, 0.0);
    for ty in tab_positions(d, p.n_tab, th) {
        if ty < clip_bot { continue; }
        a(ty, 0.0); a(ty, tf); a(ty + th, tf); a(ty + th, 0.0);
    }
    a(d, 0.0);
    for tz in tab_positions(h, p.n_tab, th) {
        a(d, tz); a(d - tf, tz); a(d - tf, tz + th); a(d, tz + th);
    }
    a(d, h);
    for ty in tab_positions(d, p.n_tab, th).into_iter().rev() {
        if ty < clip_top { continue; }
        a(ty + th, h); a(ty + th, h - tf); a(ty, h - tf); a(ty, h);
    }
    a(clip_top, h);
    pts
}

/// Horizontal panel (top/bottom) contour at z = z0, of usable `depth`, inset `y_off`.
pub fn horiz_pts_3d(p: &BoxParams, z0: f64, depth: f64, y_off: f64) -> Vec<Pt3> {
    let (w, tf, th, t, wi) = (p.w, p.tf(), p.tab_h, p.t, p.wi());
    let s_tabs = p.depth_tabs(p.d, y_off, depth);
    let mut pts = Vec::new();
    let mut a = |x: f64, y: f64| pts.push([x, y + y_off, z0]);
    a(t, 0.0); a(w - t, 0.0);
    for ty in &s_tabs { let ty = *ty; a(w - t, ty); a(w, ty); a(w, ty + th); a(w - t, ty + th); }
    a(w - t, depth);
    for tx in tab_positions(wi, p.n_tab, th).into_iter().rev() {
        let rx = t + tx;
        a(rx + th, depth); a(rx + th, depth - tf); a(rx, depth - tf); a(rx, depth);
    }
    a(t, depth);
    for ty in s_tabs.iter().rev() { let ty = *ty; a(t, ty + th); a(0.0, ty + th); a(0.0, ty); a(t, ty); }
    pts
}

/// Back wall contour at y = y0.
pub fn back_pts_3d(p: &BoxParams, y0: f64) -> Vec<Pt3> {
    let (w, h, th, t, wi, hi) = (p.w, p.h, p.tab_h, p.t, p.wi(), p.hi());
    let mut pts = Vec::new();
    let mut a = |x: f64, z: f64| pts.push([x, y0, z]);
    a(t, t);
    for tx in tab_positions(wi, p.n_tab, th) { let rx = t + tx; a(rx, t); a(rx, 0.0); a(rx + th, 0.0); a(rx + th, t); }
    a(w - t, t);
    for tz in tab_positions(hi, p.n_tab, th) { let rz = t + tz; a(w - t, rz); a(w, rz); a(w, rz + th); a(w - t, rz + th); }
    a(w - t, h - t);
    for tx in tab_positions(wi, p.n_tab, th).into_iter().rev() { let rx = t + tx; a(rx + th, h - t); a(rx + th, h); a(rx, h); a(rx, h - t); }
    a(t, h - t);
    for tz in tab_positions(hi, p.n_tab, th).into_iter().rev() { let rz = t + tz; a(t, rz + th); a(0.0, rz + th); a(0.0, rz); a(t, rz); }
    pts
}

/// Shelf contour at z = z0, of usable `depth`, inset `y_off`.
pub fn shelf_pts_3d(p: &BoxParams, z0: f64, depth: f64, y_off: f64) -> Vec<Pt3> {
    let (w, th, t, wi) = (p.w, p.tab_h, p.t, p.wi());
    let s_tabs = p.depth_tabs(p.d, y_off, depth);
    let mut pts = Vec::new();
    let mut a = |x: f64, y: f64| pts.push([x, y + y_off, z0]);
    a(t, 0.0); a(w - t, 0.0);
    for ty in &s_tabs { let ty = *ty; a(w - t, ty); a(w, ty); a(w, ty + th); a(w - t, ty + th); }
    a(w - t, depth - t);
    for tx in tab_positions(wi, p.n_tab, th).into_iter().rev() {
        let rx = t + tx;
        a(rx + th, depth - t); a(rx + th, depth); a(rx, depth); a(rx, depth - t);
    }
    a(t, depth - t);
    for ty in s_tabs.iter().rev() { let ty = *ty; a(t, ty + th); a(0.0, ty + th); a(0.0, ty); a(t, ty); }
    pts
}

/// Shelf-slot holes in the side wall at x = x0.
pub fn side_holes_3d(p: &BoxParams, x0: f64) -> Vec<Vec<Pt3>> {
    let (d, tf, th) = (p.d, p.tf(), p.tab_h);
    let mut holes = Vec::new();
    for sz in p.shelf_slot_ys() {
        let s_off = p.shelf_offset_at(sz);
        for ty in tab_positions(d, p.n_tab, th) {
            if ty < s_off || ty + th > d { continue; }
            holes.push(vec![[x0, ty, sz], [x0, ty + th, sz], [x0, ty + th, sz + tf], [x0, ty, sz + tf]]);
        }
    }
    holes
}

/// Shelf-slot holes in the back wall at y = y0.
pub fn back_holes_3d(p: &BoxParams, y0: f64) -> Vec<Vec<Pt3>> {
    let (tf, th, t, wi) = (p.tf(), p.tab_h, p.t, p.wi());
    let mut holes = Vec::new();
    for sz in p.shelf_slot_ys() {
        for tx in tab_positions(wi, p.n_tab, th) {
            let rx = t + tx;
            holes.push(vec![[rx, y0, sz], [rx + th, y0, sz], [rx + th, y0, sz + tf], [rx, y0, sz + tf]]);
        }
    }
    holes
}

// ── Scene model (base coords + explode metadata) ───────────────────────────

#[derive(Debug, Clone, Serialize)]
pub struct Panel {
    /// Semantic id: `side`, `top`, `bot`, `back`, `shelf{i}`.
    pub id: String,
    /// Outline vertices in base coordinates.
    pub c: Vec<Pt3>,
    /// Outward normal.
    pub n: [f64; 3],
    /// Material thickness (extrude depth).
    pub t: f64,
    /// Optional shelf-slot holes.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub h: Option<Vec<Vec<Pt3>>>,
    /// Explode axis (0=x,1=y,2=z) or -1 for none.
    pub axis: i32,
    /// Explode direction along the axis.
    pub sign: f64,
    /// Shelf index (for per-shelf coloring); -1 when not a shelf.
    pub shelf: i32,
}

#[derive(Debug, Clone, Serialize)]
pub struct Guide {
    pub base: Pt3,
    pub axis: i32,
    pub sign: f64,
}

#[derive(Debug, Clone, Serialize)]
pub struct Label {
    /// Semantic id the frontend localizes: `top`, `bot`, `side`, `back`, `shelf{i}`.
    pub id: String,
    /// Dimensions shown beneath the label.
    pub dw: f64,
    pub dh: f64,
    pub x: f64,
    pub y: f64,
    pub z: f64,
    pub axis: i32,
    pub sign: f64,
}

#[derive(Debug, Clone, Serialize)]
pub struct Scene {
    pub panels: Vec<Panel>,
    pub guides: Vec<Guide>,
    pub labels: Vec<Label>,
}

/// Build the assembly scene at base coordinates with explode metadata.
pub fn assembly_scene(p: &BoxParams) -> Scene {
    let (w, h, d, t) = (p.w, p.h, p.d, p.t);
    let bv = p.bevel;
    let top_off = bv.max(0.0);
    let bot_off = (-bv).max(0.0);

    let lh = side_holes_3d(p, 0.0);
    let rh = side_holes_3d(p, w);
    let bh = back_holes_3d(p, d);

    let mut panels = vec![
        Panel { id: "side".into(), c: side_pts_3d(p, 0.0), n: [1.0, 0.0, 0.0], t, h: opt(lh), axis: 0, sign: -1.0, shelf: -1 },
        Panel { id: "side".into(), c: side_pts_3d(p, w), n: [-1.0, 0.0, 0.0], t, h: opt(rh), axis: 0, sign: 1.0, shelf: -1 },
        Panel { id: "top".into(), c: horiz_pts_3d(p, h, p.top_d(), top_off), n: [0.0, 0.0, -1.0], t, h: None, axis: 2, sign: 1.0, shelf: -1 },
        Panel { id: "bot".into(), c: horiz_pts_3d(p, 0.0, p.bot_d(), bot_off), n: [0.0, 0.0, 1.0], t, h: None, axis: 2, sign: -1.0, shelf: -1 },
        Panel { id: "back".into(), c: back_pts_3d(p, d), n: [0.0, -1.0, 0.0], t, h: opt(bh), axis: 1, sign: 1.0, shelf: -1 },
    ];
    for (i, sy) in p.shelf_slot_ys().into_iter().enumerate() {
        panels.push(Panel {
            id: format!("shelf{i}"),
            c: shelf_pts_3d(p, sy, p.shelf_depth_at(sy), p.shelf_offset_at(sy)),
            n: [0.0, 0.0, 1.0], t, h: None, axis: -1, sign: 0.0, shelf: i as i32,
        });
    }

    let mut guides = Vec::new();
    let mut g = |x: f64, y: f64, z: f64, axis: i32, sign: f64| guides.push(Guide { base: [x, y, z], axis, sign });
    for &(gx, gy) in &[(0.0, 0.0), (w, 0.0), (w, d), (0.0, d)] {
        g(gx, gy, 0.0, 2, -1.0);
        g(gx, gy, h, 2, 1.0);
    }
    for &(gy, gz) in &[(0.0, 0.0), (d, 0.0), (d, h), (0.0, h)] {
        g(0.0, gy, gz, 0, -1.0);
        g(w, gy, gz, 0, 1.0);
    }
    for &(gx, gz) in &[(0.0, 0.0), (w, 0.0), (w, h), (0.0, h)] {
        g(gx, d, gz, 1, 1.0);
    }

    let labels = {
        let mut v = vec![
            Label { id: "top".into(), dw: w, dh: d, x: w / 2.0, y: d / 2.0, z: h, axis: 2, sign: 1.0 },
            Label { id: "bot".into(), dw: w, dh: d, x: w / 2.0, y: d / 2.0, z: 0.0, axis: 2, sign: -1.0 },
            Label { id: "side".into(), dw: d + bv, dh: h, x: 0.0, y: d / 2.0, z: h / 2.0, axis: 0, sign: -1.0 },
            Label { id: "side".into(), dw: d + bv, dh: h, x: w, y: d / 2.0, z: h / 2.0, axis: 0, sign: 1.0 },
            Label { id: "back".into(), dw: w, dh: h, x: w / 2.0, y: d, z: h / 2.0, axis: 1, sign: 1.0 },
        ];
        for (i, sy) in p.shelf_slot_ys().into_iter().enumerate() {
            v.push(Label { id: format!("shelf{i}"), dw: w, dh: d, x: w / 2.0, y: d / 2.0, z: sy, axis: -1, sign: 0.0 });
        }
        v
    };

    Scene { panels, guides, labels }
}

/// A single panel for the isolated gallery view, keyed by gallery id.
#[derive(Debug, Clone, Serialize)]
pub struct PiecePanel {
    pub c: Vec<Pt3>,
    pub n: [f64; 3],
    pub t: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub h: Option<Vec<Vec<Pt3>>>,
}

/// Geometry of one gallery piece (matches `box_builder::gallery_pieces` ids).
pub fn gallery_panel(p: &BoxParams, id: &str) -> Option<PiecePanel> {
    let t = p.t;
    let panel = match id {
        "side" => PiecePanel { c: side_pts_3d(p, 0.0), n: [1.0, 0.0, 0.0], t, h: opt(side_holes_3d(p, 0.0)) },
        "tb" => PiecePanel { c: horiz_pts_3d(p, 0.0, p.d, 0.0), n: [0.0, 0.0, 1.0], t, h: None },
        "top" => PiecePanel { c: horiz_pts_3d(p, 0.0, p.top_d(), p.bevel.max(0.0)), n: [0.0, 0.0, 1.0], t, h: None },
        "bot" => PiecePanel { c: horiz_pts_3d(p, 0.0, p.bot_d(), (-p.bevel).max(0.0)), n: [0.0, 0.0, 1.0], t, h: None },
        "back" => PiecePanel { c: back_pts_3d(p, 0.0), n: [0.0, -1.0, 0.0], t, h: opt(back_holes_3d(p, 0.0)) },
        "shelf" => PiecePanel { c: shelf_pts_3d(p, 0.0, p.d, 0.0), n: [0.0, 0.0, 1.0], t, h: None },
        _ if id.starts_with("shelf") => {
            let i: usize = id[5..].parse().ok()?;
            let ys = p.shelf_slot_ys();
            let sy = *ys.get(i)?;
            PiecePanel { c: shelf_pts_3d(p, 0.0, p.shelf_depth_at(sy), p.shelf_offset_at(sy)), n: [0.0, 0.0, 1.0], t, h: None }
        }
        _ => return None,
    };
    Some(panel)
}

fn opt(holes: Vec<Vec<Pt3>>) -> Option<Vec<Vec<Pt3>>> {
    if holes.is_empty() { None } else { Some(holes) }
}
