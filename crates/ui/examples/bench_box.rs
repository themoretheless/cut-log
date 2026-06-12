//! Native Rust timing of box model assembly (no JS bridge), to isolate compute
//! cost from the wasm/JSON marshaling overhead measured in scripts/bench.
//!
//! Run: cargo run -p cutter-ui --example bench_box --release

use std::time::Instant;

use cutter_core::box_builder::{all_box_pieces, compute_layout, gallery_pieces, piece_path, BoxParams};
use cutter_ui::box3d::{assembly_scene, gallery_panel};

const CASES: &[(&str, BoxParams, f64, f64, f64)] = &[
    ("basic",       BoxParams { w: 300.0, h: 400.0, d: 200.0, t: 6.0, kerf: 0.1, tab_h: 30.0, n_tab: 1, n_shelves: 0, bevel: 0.0 },  1220.0, 2440.0, 5.0),
    ("shelves2",    BoxParams { w: 300.0, h: 400.0, d: 200.0, t: 6.0, kerf: 0.1, tab_h: 30.0, n_tab: 1, n_shelves: 2, bevel: 0.0 },  1220.0, 2440.0, 5.0),
    ("bevel+shelf", BoxParams { w: 350.0, h: 500.0, d: 250.0, t: 6.0, kerf: 0.1, tab_h: 30.0, n_tab: 2, n_shelves: 2, bevel: 30.0 }, 1220.0, 2440.0, 5.0),
    ("heavy",       BoxParams { w: 800.0, h: 1200.0, d: 600.0, t: 10.0, kerf: 0.3, tab_h: 40.0, n_tab: 4, n_shelves: 5, bevel: 0.0 }, 1220.0, 2440.0, 6.0),
];

const N: u32 = 20000;

// Compute only: build all paths, 3D geometry and layout, no serialization.
fn compute_only(p: &BoxParams, sw: f64, sh: f64, gap: f64) -> usize {
    let gallery = gallery_pieces(p);
    let mut sink = 0usize;
    for g in &gallery {
        sink += g.path.len() + gallery_panel(p, &g.id).map(|pp| pp.c.len()).unwrap_or(0);
    }
    let scene = assembly_scene(p);
    sink += scene.panels.iter().map(|p| p.c.len()).sum::<usize>();
    let pieces = all_box_pieces(p);
    let layout = compute_layout(&pieces, sw, sh, gap);
    for sheet in &layout {
        for lp in sheet { sink += piece_path(p, &lp.id).map(|s| s.len()).unwrap_or(0); }
    }
    sink
}

// Full: compute + serde_json serialize (what crossing to JS requires).
fn build_model(p: &BoxParams, sw: f64, sh: f64, gap: f64) -> usize {
    let gallery = gallery_pieces(p);
    let mut sink = 0usize;
    for g in &gallery { sink += gallery_panel(p, &g.id).map(|pp| pp.c.len()).unwrap_or(0); }
    let scene = assembly_scene(p);
    let model_json = serde_json::to_string(&(&gallery, &scene)).unwrap();
    let pieces = all_box_pieces(p);
    let layout = compute_layout(&pieces, sw, sh, gap);
    let layout_json = serde_json::to_string(&layout).unwrap();
    sink + model_json.len() + layout_json.len()
}

fn bench(label: &str, f: impl Fn(&BoxParams, f64, f64, f64) -> usize) {
    println!("\n{label}");
    println!("{:<13} {:>12} {:>14}", "case", "µs/op", "ops/sec");
    println!("{}", "-".repeat(42));
    for (name, p, sw, sh, gap) in CASES {
        let mut acc = 0usize;
        for _ in 0..2000 { acc += f(p, *sw, *sh, *gap); }
        let t0 = Instant::now();
        for _ in 0..N { acc += f(p, *sw, *sh, *gap); }
        let us = t0.elapsed().as_nanos() as f64 / N as f64 / 1000.0;
        println!("{:<13} {:>12.2} {:>14.0}", name, us, 1e6 / us);
        std::hint::black_box(acc);
    }
}

fn main() {
    println!("Native Rust box geometry, N={N}");
    bench("compute only (no serialization):", compute_only);
    bench("compute + serde_json serialize (JS-bridge payload):", build_model);
}
