use std::fmt::Write;

/// Равномерно распределяет n_tab шипов/пазов по краю длиной len.
pub fn tab_positions(len: f64, n_tab: usize, tab_h: f64) -> Vec<f64> {
    let gap = (len - n_tab as f64 * tab_h) / (n_tab as f64 + 1.0);
    (0..n_tab).map(|i| gap + i as f64 * (gap + tab_h)).collect()
}

/// Y-координаты верхнего края пазов полок на боковой стенке.
pub fn shelf_slot_ys(n_shelves: usize, hi: f64, tf: f64, t: f64) -> Vec<f64> {
    if n_shelves == 0 { return Vec::new(); }
    let gap = (hi - n_shelves as f64 * tf) / (n_shelves as f64 + 1.0);
    (0..n_shelves).map(|i| t + gap + i as f64 * (gap + tf)).collect()
}

// ── SVG path builders ─────────────────────────────────────────────────────

pub fn path_side(d: f64, h: f64, tab_h: f64, tf: f64, n_tab: usize, shelf_ys: &[f64]) -> String {
    let mut s = String::with_capacity(1024);
    write!(s, "M0,0").unwrap();
    for x in tab_positions(d, n_tab, tab_h) {
        write!(s, " L{x:.2},0 L{x:.2},{tf:.2} L{:.2},{tf:.2} L{:.2},0", x + tab_h, x + tab_h).unwrap();
    }
    write!(s, " L{d:.2},0").unwrap();
    for y in tab_positions(h, n_tab, tab_h) {
        write!(s, " L{d:.2},{y:.2} L{:.2},{y:.2} L{:.2},{:.2} L{d:.2},{:.2}", d - tf, d - tf, y + tab_h, y + tab_h).unwrap();
    }
    write!(s, " L{d:.2},{h:.2}").unwrap();
    for x in tab_positions(d, n_tab, tab_h).into_iter().rev() {
        write!(s, " L{:.2},{h:.2} L{:.2},{:.2} L{x:.2},{:.2} L{x:.2},{h:.2}", x + tab_h, x + tab_h, h - tf, h - tf).unwrap();
    }
    write!(s, " L0,{h:.2} Z").unwrap();
    // Shelf holes
    for sy in shelf_ys {
        for x in tab_positions(d, n_tab, tab_h) {
            write!(s, " M{x:.2},{sy:.2} L{:.2},{sy:.2} L{:.2},{:.2} L{x:.2},{:.2} Z",
                x + tab_h, x + tab_h, sy + tf, sy + tf).unwrap();
        }
    }
    s
}

pub fn path_top_bottom(w: f64, d: f64, t: f64, tab_h: f64, tf: f64, n_tab: usize, wi: f64) -> String {
    let mut s = String::with_capacity(1024);
    write!(s, "M{t:.2},0 L{:.2},0", w - t).unwrap();
    for y in tab_positions(d, n_tab, tab_h) {
        write!(s, " L{:.2},{y:.2} L{w:.2},{y:.2} L{w:.2},{:.2} L{:.2},{:.2}", w - t, y + tab_h, w - t, y + tab_h).unwrap();
    }
    write!(s, " L{:.2},{d:.2}", w - t).unwrap();
    for x in tab_positions(wi, n_tab, tab_h).into_iter().rev() {
        let rx = t + x;
        write!(s, " L{:.2},{d:.2} L{:.2},{:.2} L{rx:.2},{:.2} L{rx:.2},{d:.2}", rx + tab_h, rx + tab_h, d - tf, d - tf).unwrap();
    }
    write!(s, " L{t:.2},{d:.2}").unwrap();
    for y in tab_positions(d, n_tab, tab_h).into_iter().rev() {
        write!(s, " L{t:.2},{:.2} L0,{:.2} L0,{y:.2} L{t:.2},{y:.2}", y + tab_h, y + tab_h).unwrap();
    }
    write!(s, " L{t:.2},0 Z").unwrap();
    s
}

#[allow(clippy::too_many_arguments)] // mirrors the flat scalar wasm-bindgen API
pub fn path_back(w: f64, h: f64, t: f64, tab_h: f64, tf: f64, n_tab: usize, wi: f64, hi: f64, shelf_ys: &[f64]) -> String {
    let mut s = String::with_capacity(1024);
    write!(s, "M{t:.2},{t:.2}").unwrap();
    for x in tab_positions(wi, n_tab, tab_h) {
        let rx = t + x;
        write!(s, " L{rx:.2},{t:.2} L{rx:.2},0 L{:.2},0 L{:.2},{t:.2}", rx + tab_h, rx + tab_h).unwrap();
    }
    write!(s, " L{:.2},{t:.2}", w - t).unwrap();
    for y in tab_positions(hi, n_tab, tab_h) {
        let ry = t + y;
        write!(s, " L{:.2},{ry:.2} L{w:.2},{ry:.2} L{w:.2},{:.2} L{:.2},{:.2}", w - t, ry + tab_h, w - t, ry + tab_h).unwrap();
    }
    write!(s, " L{:.2},{:.2}", w - t, h - t).unwrap();
    for x in tab_positions(wi, n_tab, tab_h).into_iter().rev() {
        let rx = t + x;
        write!(s, " L{:.2},{:.2} L{:.2},{h:.2} L{rx:.2},{h:.2} L{rx:.2},{:.2}", rx + tab_h, h - t, rx + tab_h, h - t).unwrap();
    }
    write!(s, " L{t:.2},{:.2}", h - t).unwrap();
    for y in tab_positions(hi, n_tab, tab_h).into_iter().rev() {
        let ry = t + y;
        write!(s, " L{t:.2},{:.2} L0,{:.2} L0,{ry:.2} L{t:.2},{ry:.2}", ry + tab_h, ry + tab_h).unwrap();
    }
    write!(s, " Z").unwrap();
    // Shelf holes on back
    for sy in shelf_ys {
        for x in tab_positions(wi, n_tab, tab_h) {
            let rx = t + x;
            write!(s, " M{rx:.2},{sy:.2} L{:.2},{sy:.2} L{:.2},{:.2} L{rx:.2},{:.2} Z",
                rx + tab_h, rx + tab_h, sy + tf, sy + tf).unwrap();
        }
    }
    s
}

pub fn path_shelf(w: f64, d: f64, t: f64, tab_h: f64, _tf: f64, n_tab: usize, wi: f64) -> String {
    let mut s = String::with_capacity(1024);
    write!(s, "M{t:.2},0 L{:.2},0", w - t).unwrap();
    for y in tab_positions(d, n_tab, tab_h) {
        write!(s, " L{:.2},{y:.2} L{w:.2},{y:.2} L{w:.2},{:.2} L{:.2},{:.2}", w - t, y + tab_h, w - t, y + tab_h).unwrap();
    }
    write!(s, " L{:.2},{:.2}", w - t, d - t).unwrap();
    for x in tab_positions(wi, n_tab, tab_h).into_iter().rev() {
        let rx = t + x;
        write!(s, " L{:.2},{:.2} L{:.2},{d:.2} L{rx:.2},{d:.2} L{rx:.2},{:.2}", rx + tab_h, d - t, rx + tab_h, d - t).unwrap();
    }
    write!(s, " L{t:.2},{:.2}", d - t).unwrap();
    for y in tab_positions(d, n_tab, tab_h).into_iter().rev() {
        write!(s, " L{t:.2},{:.2} L0,{:.2} L0,{y:.2} L{t:.2},{y:.2}", y + tab_h, y + tab_h).unwrap();
    }
    write!(s, " L{t:.2},0 Z").unwrap();
    s
}

// ── Cutting layout (shelf-based First Fit Decreasing) ─────────────────────

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct LayoutPiece {
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
    pub label: String,
    pub color: String,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct BoxPiece {
    pub w: f64,
    pub h: f64,
    pub label: String,
    pub color: String,
}

pub fn all_box_pieces(w: f64, h: f64, d: f64, n_shelves: usize) -> Vec<BoxPiece> {
    let mut list = vec![
        BoxPiece { w: d, h, label: "Бок.1".into(), color: "#4a90d9".into() },
        BoxPiece { w: d, h, label: "Бок.2".into(), color: "#4a90d9".into() },
        BoxPiece { w, h: d, label: "Верх".into(), color: "#27ae60".into() },
        BoxPiece { w, h: d, label: "Низ".into(), color: "#27ae60".into() },
        BoxPiece { w, h, label: "Зад.".into(), color: "#8e44ad".into() },
    ];
    for i in 1..=n_shelves {
        list.push(BoxPiece { w, h: d, label: format!("Пол.{i}"), color: "#e67e22".into() });
    }
    list.sort_by(|a, b| (b.w * b.h).partial_cmp(&(a.w * a.h)).unwrap());
    list
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
                            label: p.label.clone(), color: p.color.clone(),
                        });
                        *shelf = (sy, sh.max(fh), nx + fw + gap);
                        placed = true;
                    }
                }

                if !placed {
                    let last = shelves.last().unwrap();
                    if last.1 == 0.0 { continue; }
                    let new_y = last.0 + last.1 + gap;
                    if new_y + fh + gap <= sheet_h && gap + fw + gap <= sheet_w {
                        shelves.push((new_y, fh, gap + fw + gap));
                        sheet_pieces.push(LayoutPiece {
                            x: gap, y: new_y, w: fw, h: fh,
                            label: p.label.clone(), color: p.color.clone(),
                        });
                        placed = true;
                    }
                }
            }

            if !placed {
                remaining.push(p);
            }
        }

        if sheet_pieces.is_empty() { break; }
        result.push(sheet_pieces);
        todo = remaining;
    }

    result
}

/// Wrap a path into a standalone SVG for export.
pub fn wrap_cut_svg(path: &str, pw: f64, ph: f64) -> String {
    format!(
        "<?xml version=\"1.0\" encoding=\"utf-8\"?>\n\
         <svg xmlns=\"http://www.w3.org/2000/svg\" width=\"{pw:.2}mm\" height=\"{ph:.2}mm\" viewBox=\"0 0 {pw:.2} {ph:.2}\">\n\
         <path d=\"{path}\" fill=\"none\" stroke=\"#ff0000\" stroke-width=\"0.01\" stroke-linejoin=\"miter\"/>\n\
         </svg>"
    )
}
