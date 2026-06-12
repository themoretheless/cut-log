//! Validates the Rust box geometry against golden fixtures captured from the
//! original TypeScript implementation (scripts/golden.json), including bevel.

use cutter_core::box_builder::{
    all_box_pieces, compute_layout, path_back, path_bottom, path_shelf, path_side, path_top,
    BoxParams,
};
use serde_json::Value;

fn golden() -> Value {
    let path = concat!(env!("CARGO_MANIFEST_DIR"), "/../../scripts/golden.json");
    let raw = std::fs::read_to_string(path).expect("scripts/golden.json missing — run `node scripts/golden.mjs > scripts/golden.json`");
    serde_json::from_str(&raw).unwrap()
}

fn params(p: &Value) -> BoxParams {
    BoxParams {
        w: p["W"].as_f64().unwrap(),
        h: p["H"].as_f64().unwrap(),
        d: p["D"].as_f64().unwrap(),
        t: p["T"].as_f64().unwrap(),
        kerf: p["Kerf"].as_f64().unwrap(),
        tab_h: p["TabH"].as_f64().unwrap(),
        n_tab: p["NTab"].as_u64().unwrap() as usize,
        n_shelves: p["NShelves"].as_u64().unwrap() as usize,
        bevel: p["Bevel"].as_f64().unwrap(),
    }
}

fn approx(a: f64, b: f64, ctx: &str) {
    assert!((a - b).abs() < 1e-6, "{ctx}: {a} != {b}");
}

fn approx_vec(a: &[f64], b: &[Value], ctx: &str) {
    assert_eq!(a.len(), b.len(), "{ctx}: length {} != {}", a.len(), b.len());
    for (i, (x, y)) in a.iter().zip(b).enumerate() {
        approx(*x, y.as_f64().unwrap(), &format!("{ctx}[{i}]"));
    }
}

#[test]
fn box_geometry_matches_golden() {
    let g = golden();
    for (name, case) in g.as_object().unwrap() {
        let p = params(&case["params"]);

        assert_eq!(path_side(&p), case["pathSide"].as_str().unwrap(), "{name} pathSide");
        assert_eq!(path_top(&p), case["pathTop"].as_str().unwrap(), "{name} pathTop");
        assert_eq!(path_bottom(&p), case["pathBottom"].as_str().unwrap(), "{name} pathBottom");
        assert_eq!(path_back(&p), case["pathBack"].as_str().unwrap(), "{name} pathBack");

        approx_vec(&p.shelf_slot_ys(), case["shelfSlotYs"].as_array().unwrap(), &format!("{name} shelfSlotYs"));
        let depths: Vec<f64> = p.shelf_slot_ys().iter().map(|&sy| p.shelf_depth_at(sy)).collect();
        approx_vec(&depths, case["shelfDepths"].as_array().unwrap(), &format!("{name} shelfDepths"));

        // per-shelf paths (depth/offset vary along the bevel)
        let each = case["pathShelf_each"].as_array().unwrap();
        let shelf_paths: Vec<String> = p.shelf_slot_ys().iter()
            .map(|&sy| path_shelf(&p, p.shelf_depth_at(sy), p.shelf_offset_at(sy)))
            .collect();
        assert_eq!(shelf_paths.len(), each.len(), "{name} shelf path count");
        for (i, (rp, gv)) in shelf_paths.iter().zip(each).enumerate() {
            assert_eq!(rp, gv.as_str().unwrap(), "{name} pathShelf_each[{i}]");
        }

        // piece dimensions and ordering (labels/colors are frontend concerns)
        let pieces = all_box_pieces(&p);
        let golden_pieces = case["allPieces"].as_array().unwrap();
        assert_eq!(pieces.len(), golden_pieces.len(), "{name} piece count");
        for (i, (rp, gpiece)) in pieces.iter().zip(golden_pieces).enumerate() {
            approx(rp.w, gpiece["w"].as_f64().unwrap(), &format!("{name} piece[{i}].w"));
            approx(rp.h, gpiece["h"].as_f64().unwrap(), &format!("{name} piece[{i}].h"));
        }

        // cutting layout positions
        let sheet_w = case["params"]["SheetW"].as_f64().unwrap();
        let sheet_h = case["params"]["SheetH"].as_f64().unwrap();
        let layout = compute_layout(&pieces, sheet_w, sheet_h, case["params"]["CutGap"].as_f64().unwrap());
        let golden_layout = case["computeLayout"].as_array().unwrap();
        assert_eq!(layout.len(), golden_layout.len(), "{name} sheet count");
        for (si, (sheet, gsheet)) in layout.iter().zip(golden_layout).enumerate() {
            let gsheet = gsheet.as_array().unwrap();
            assert_eq!(sheet.len(), gsheet.len(), "{name} sheet[{si}] piece count");
            for (pi, (lp, glp)) in sheet.iter().zip(gsheet).enumerate() {
                approx(lp.x, glp["x"].as_f64().unwrap(), &format!("{name} layout[{si}][{pi}].x"));
                approx(lp.y, glp["y"].as_f64().unwrap(), &format!("{name} layout[{si}][{pi}].y"));
                approx(lp.w, glp["w"].as_f64().unwrap(), &format!("{name} layout[{si}][{pi}].w"));
                approx(lp.h, glp["h"].as_f64().unwrap(), &format!("{name} layout[{si}][{pi}].h"));
            }
        }
    }
}
