//! Validates the Rust 3D box geometry against golden fixtures captured from the
//! original TypeScript implementation (scripts/golden.json), including bevel.

use cutter_core::box_builder::BoxParams;
use cutter_ui::box3d::{
    back_holes_3d, back_pts_3d, horiz_pts_3d, shelf_pts_3d, side_holes_3d, side_pts_3d, Pt3,
};
use serde_json::Value;

fn golden() -> Value {
    let path = concat!(env!("CARGO_MANIFEST_DIR"), "/../../scripts/golden.json");
    let raw = std::fs::read_to_string(path).expect("scripts/golden.json missing");
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

fn check_pts(actual: &[Pt3], expected: &Value, ctx: &str) {
    let exp = expected.as_array().unwrap();
    assert_eq!(actual.len(), exp.len(), "{ctx}: point count {} != {}", actual.len(), exp.len());
    for (i, (a, e)) in actual.iter().zip(exp).enumerate() {
        let e = e.as_array().unwrap();
        for k in 0..3 {
            let ev = e[k].as_f64().unwrap();
            assert!((a[k] - ev).abs() < 1e-6, "{ctx}[{i}][{k}]: {} != {ev}", a[k]);
        }
    }
}

fn check_holes(actual: &[Vec<Pt3>], expected: &Value, ctx: &str) {
    let exp = expected.as_array().unwrap();
    assert_eq!(actual.len(), exp.len(), "{ctx}: hole count {} != {}", actual.len(), exp.len());
    for (i, (a, e)) in actual.iter().zip(exp).enumerate() {
        check_pts(a, e, &format!("{ctx}[{i}]"));
    }
}

#[test]
fn box3d_matches_golden() {
    let g = golden();
    for (name, case) in g.as_object().unwrap() {
        let p = params(&case["params"]);
        let top_off = p.bevel.max(0.0);
        let bot_off = (-p.bevel).max(0.0);

        check_pts(&side_pts_3d(&p, 0.0), &case["sidePts3D_0"], &format!("{name} sidePts3D_0"));
        check_pts(&side_pts_3d(&p, p.w), &case["sidePts3D_w"], &format!("{name} sidePts3D_w"));
        check_pts(&horiz_pts_3d(&p, p.h, p.top_d(), top_off), &case["horizPts3D_top"], &format!("{name} horizPts3D_top"));
        check_pts(&horiz_pts_3d(&p, 0.0, p.bot_d(), bot_off), &case["horizPts3D_bot"], &format!("{name} horizPts3D_bot"));
        check_pts(&back_pts_3d(&p, p.d), &case["backPts3D"], &format!("{name} backPts3D"));

        let shelf_each = case["shelfPts3D_each"].as_array().unwrap();
        let ys = p.shelf_slot_ys();
        assert_eq!(ys.len(), shelf_each.len(), "{name} shelf count");
        for (i, &sy) in ys.iter().enumerate() {
            let pts = shelf_pts_3d(&p, sy, p.shelf_depth_at(sy), p.shelf_offset_at(sy));
            check_pts(&pts, &shelf_each[i], &format!("{name} shelfPts3D_each[{i}]"));
        }

        check_holes(&side_holes_3d(&p, 0.0), &case["sideHoles3D_0"], &format!("{name} sideHoles3D_0"));
        check_holes(&side_holes_3d(&p, p.w), &case["sideHoles3D_w"], &format!("{name} sideHoles3D_w"));
        check_holes(&back_holes_3d(&p, p.d), &case["backHoles3D"], &format!("{name} backHoles3D"));
    }
}
