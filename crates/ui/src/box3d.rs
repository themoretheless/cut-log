//! 3D geometry generators for the box assembly view.
//! Produces vertices in (x, y, z) for Three.js panels, guides, and labels.

use cutter_core::box_builder::tab_positions;

pub type Pt3 = [f64; 3];

/// Side wall contour in 3D at x = x0.
pub fn side_pts_3d(x0: f64, d: f64, h: f64, tab_h: f64, tf: f64, n_tab: usize) -> Vec<Pt3> {
    let mut p = Vec::new();
    let mut a = |y: f64, z: f64| p.push([x0, y, z]);

    a(0.0, 0.0);
    for ty in tab_positions(d, n_tab, tab_h) {
        a(ty, 0.0); a(ty, tf); a(ty + tab_h, tf); a(ty + tab_h, 0.0);
    }
    a(d, 0.0);
    for tz in tab_positions(h, n_tab, tab_h) {
        a(d, tz); a(d - tf, tz); a(d - tf, tz + tab_h); a(d, tz + tab_h);
    }
    a(d, h);
    for ty in tab_positions(d, n_tab, tab_h).into_iter().rev() {
        a(ty + tab_h, h); a(ty + tab_h, h - tf); a(ty, h - tf); a(ty, h);
    }
    a(0.0, h);
    p
}

/// Horizontal wall (top/bottom) contour at z = z0.
pub fn horiz_pts_3d(z0: f64, w: f64, d: f64, t: f64, tab_h: f64, tf: f64, n_tab: usize, wi: f64) -> Vec<Pt3> {
    let mut p = Vec::new();
    let mut a = |x: f64, y: f64| p.push([x, y, z0]);

    a(t, 0.0); a(w - t, 0.0);
    for ty in tab_positions(d, n_tab, tab_h) {
        a(w - t, ty); a(w, ty); a(w, ty + tab_h); a(w - t, ty + tab_h);
    }
    a(w - t, d);
    for tx in tab_positions(wi, n_tab, tab_h).into_iter().rev() {
        let rx = t + tx;
        a(rx + tab_h, d); a(rx + tab_h, d - tf); a(rx, d - tf); a(rx, d);
    }
    a(t, d);
    for ty in tab_positions(d, n_tab, tab_h).into_iter().rev() {
        a(t, ty + tab_h); a(0.0, ty + tab_h); a(0.0, ty); a(t, ty);
    }
    p
}

/// Back wall contour at y = y0.
pub fn back_pts_3d(y0: f64, w: f64, h: f64, t: f64, tab_h: f64, _tf: f64, n_tab: usize, wi: f64, hi: f64) -> Vec<Pt3> {
    let mut p = Vec::new();
    let mut a = |x: f64, z: f64| p.push([x, y0, z]);

    a(t, t);
    for tx in tab_positions(wi, n_tab, tab_h) {
        let rx = t + tx;
        a(rx, t); a(rx, 0.0); a(rx + tab_h, 0.0); a(rx + tab_h, t);
    }
    a(w - t, t);
    for tz in tab_positions(hi, n_tab, tab_h) {
        let rz = t + tz;
        a(w - t, rz); a(w, rz); a(w, rz + tab_h); a(w - t, rz + tab_h);
    }
    a(w - t, h - t);
    for tx in tab_positions(wi, n_tab, tab_h).into_iter().rev() {
        let rx = t + tx;
        a(rx + tab_h, h - t); a(rx + tab_h, h); a(rx, h); a(rx, h - t);
    }
    a(t, h - t);
    for tz in tab_positions(hi, n_tab, tab_h).into_iter().rev() {
        let rz = t + tz;
        a(t, rz + tab_h); a(0.0, rz + tab_h); a(0.0, rz); a(t, rz);
    }
    p
}

/// Shelf contour at z = z0.
pub fn shelf_pts_3d(z0: f64, w: f64, d: f64, t: f64, tab_h: f64, _tf: f64, n_tab: usize) -> Vec<Pt3> {
    let mut p = Vec::new();
    let mut a = |x: f64, y: f64| p.push([x, y, z0]);

    a(t, 0.0); a(w - t, 0.0);
    for ty in tab_positions(d, n_tab, tab_h) {
        a(w - t, ty); a(w, ty); a(w, ty + tab_h); a(w - t, ty + tab_h);
    }
    a(w - t, d - t);
    let wi = w - 2.0 * t;
    for tx in tab_positions(wi, n_tab, tab_h).into_iter().rev() {
        let rx = t + tx;
        a(rx + tab_h, d - t); a(rx + tab_h, d); a(rx, d); a(rx, d - t);
    }
    a(t, d - t);
    for ty in tab_positions(d, n_tab, tab_h).into_iter().rev() {
        a(t, ty + tab_h); a(0.0, ty + tab_h); a(0.0, ty); a(t, ty);
    }
    p
}

/// Holes in side wall for shelf slots.
pub fn side_holes_3d(x0: f64, d: f64, tab_h: f64, tf: f64, n_tab: usize, shelf_ys: &[f64]) -> Vec<Vec<Pt3>> {
    let mut holes = Vec::new();
    for &sz in shelf_ys {
        for ty in tab_positions(d, n_tab, tab_h) {
            holes.push(vec![
                [x0, ty, sz],
                [x0, ty + tab_h, sz],
                [x0, ty + tab_h, sz + tf],
                [x0, ty, sz + tf],
            ]);
        }
    }
    holes
}

/// Holes in back wall for shelf slots.
pub fn back_holes_3d(y0: f64, t: f64, tab_h: f64, tf: f64, n_tab: usize, wi: f64, shelf_ys: &[f64]) -> Vec<Vec<Pt3>> {
    let mut holes = Vec::new();
    for &sz in shelf_ys {
        for tx in tab_positions(wi, n_tab, tab_h) {
            let rx = t + tx;
            holes.push(vec![
                [rx, y0, sz],
                [rx + tab_h, y0, sz],
                [rx + tab_h, y0, sz + tf],
                [rx, y0, sz + tf],
            ]);
        }
    }
    holes
}

/// Build the full scene JSON for Three.js box3d.update().
pub fn build_scene_json(
    w: f64, h: f64, d: f64, t: f64,
    tab_h: f64, tf: f64, n_tab: usize,
    wi: f64, hi: f64,
    shelf_ys: &[f64],
    explode: f64,
) -> String {
    let ex = w * explode;
    let ey = d * explode;
    let ez = h * explode;

    let mut json = String::with_capacity(8192);
    json.push_str("{\"panels\":[");

    // Helper to serialize pts
    fn pts_json(pts: &[Pt3]) -> String {
        let mut s = String::from("[");
        for (i, p) in pts.iter().enumerate() {
            if i > 0 { s.push(','); }
            s.push_str(&format!("[{:.2},{:.2},{:.2}]", p[0], p[1], p[2]));
        }
        s.push(']');
        s
    }
    fn holes_json(holes: &[Vec<Pt3>]) -> String {
        let mut s = String::from("[");
        for (i, hole) in holes.iter().enumerate() {
            if i > 0 { s.push(','); }
            s.push_str(&pts_json(hole));
        }
        s.push(']');
        s
    }

    // Left side
    let lh = side_holes_3d(-ex, d, tab_h, tf, n_tab, shelf_ys);
    let lpts = side_pts_3d(-ex, d, h, tab_h, tf, n_tab);
    json.push_str(&format!(
        "{{\"c\":{},\"n\":[1,0,0],\"t\":{t},\"col\":\"#2980b9\",\"ec\":\"#1a5276\"{}}}",
        pts_json(&lpts),
        if lh.is_empty() { ",\"h\":null".into() } else { format!(",\"h\":{}", holes_json(&lh)) }
    ));

    // Right side
    json.push(',');
    let rh = side_holes_3d(w + ex, d, tab_h, tf, n_tab, shelf_ys);
    let rpts = side_pts_3d(w + ex, d, h, tab_h, tf, n_tab);
    json.push_str(&format!(
        "{{\"c\":{},\"n\":[-1,0,0],\"t\":{t},\"col\":\"#2980b9\",\"ec\":\"#1a5276\"{}}}",
        pts_json(&rpts),
        if rh.is_empty() { ",\"h\":null".into() } else { format!(",\"h\":{}", holes_json(&rh)) }
    ));

    // Top
    json.push(',');
    let top_pts = horiz_pts_3d(h + ez, w, d, t, tab_h, tf, n_tab, wi);
    json.push_str(&format!(
        "{{\"c\":{},\"n\":[0,0,-1],\"t\":{t},\"col\":\"#27ae60\",\"ec\":\"#1e8449\",\"h\":null}}",
        pts_json(&top_pts)
    ));

    // Bottom
    json.push(',');
    let bot_pts = horiz_pts_3d(-ez, w, d, t, tab_h, tf, n_tab, wi);
    json.push_str(&format!(
        "{{\"c\":{},\"n\":[0,0,1],\"t\":{t},\"col\":\"#27ae60\",\"ec\":\"#1e8449\",\"h\":null}}",
        pts_json(&bot_pts)
    ));

    // Back
    json.push(',');
    let back_pts = back_pts_3d(d + ey, w, h, t, tab_h, tf, n_tab, wi, hi);
    let bh = back_holes_3d(d + ey, t, tab_h, tf, n_tab, wi, shelf_ys);
    json.push_str(&format!(
        "{{\"c\":{},\"n\":[0,-1,0],\"t\":{t},\"col\":\"#8e44ad\",\"ec\":\"#5b2c6f\"{}}}",
        pts_json(&back_pts),
        if bh.is_empty() { ",\"h\":null".into() } else { format!(",\"h\":{}", holes_json(&bh)) }
    ));

    // Shelves
    for &sz in shelf_ys {
        json.push(',');
        let sp = shelf_pts_3d(sz, w, d, t, tab_h, tf, n_tab);
        json.push_str(&format!(
            "{{\"c\":{},\"n\":[0,0,1],\"t\":{t},\"col\":\"#e67e22\",\"ec\":\"#ca6f1e\",\"h\":null}}",
            pts_json(&sp)
        ));
    }

    json.push_str("],\"guides\":[");

    // Guides
    let mut first_guide = true;
    let mut g = |x1: f64, y1: f64, z1: f64, x2: f64, y2: f64, z2: f64| {
        if !first_guide { json.push(','); }
        first_guide = false;
        json.push_str(&format!("[{x1:.2},{y1:.2},{z1:.2},{x2:.2},{y2:.2},{z2:.2}]"));
    };

    // Top/bottom guides
    for &(gx, gy) in &[(0.0, 0.0), (w, 0.0), (w, d), (0.0, d)] {
        g(gx, gy, -ez, gx, gy, 0.0);
        g(gx, gy, h + ez, gx, gy, h);
    }
    // Side guides
    for &(gy, gz) in &[(0.0, 0.0), (d, 0.0), (d, h), (0.0, h)] {
        g(-ex, gy, gz, 0.0, gy, gz);
        g(w + ex, gy, gz, w, gy, gz);
    }
    // Back guides
    for &(gx, gz) in &[(0.0, 0.0), (w, 0.0), (w, h), (0.0, h)] {
        g(gx, d + ey, gz, gx, d, gz);
    }

    json.push_str("],\"labels\":[");

    // Labels
    let sz = |pw: f64, ph: f64| format!("{pw:.0}\u{00d7}{ph:.0}");
    let labels = [
        ("Верх", sz(w, d), w / 2.0, d / 2.0, h + ez, "#a0e0a0"),
        ("Низ", sz(w, d), w / 2.0, d / 2.0, -ez, "#a0e0a0"),
        ("Бок.", sz(d, h), -ex, d / 2.0, h / 2.0, "#80c0e0"),
        ("Бок.", sz(d, h), w + ex, d / 2.0, h / 2.0, "#80c0e0"),
        ("Зад.", sz(w, h), w / 2.0, d + ey, h / 2.0, "#c0a0d0"),
    ];
    for (i, (text, sub, x, y, z, color)) in labels.iter().enumerate() {
        if i > 0 { json.push(','); }
        json.push_str(&format!(
            "{{\"text\":\"{text}\",\"sub\":\"{sub}\",\"x\":{x:.2},\"y\":{y:.2},\"z\":{z:.2},\"color\":\"{color}\"}}"
        ));
    }
    for (i, &sy) in shelf_ys.iter().enumerate() {
        json.push(',');
        json.push_str(&format!(
            "{{\"text\":\"Пол.{}\",\"sub\":\"{}\",\"x\":{:.2},\"y\":{:.2},\"z\":{sy:.2},\"color\":\"#e0c080\"}}",
            i + 1, sz(w, d), w / 2.0, d / 2.0
        ));
    }

    json.push_str("]}");
    json
}
