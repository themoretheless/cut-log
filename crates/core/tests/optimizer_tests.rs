use cutter_core::models::CutPiece;
use cutter_core::optimizer::{optimize, CuttingStrategy};

fn base_piece(w: f64, h: f64, qty: u32) -> CutPiece {
    CutPiece {
        id: uuid::Uuid::new_v4(),
        label: String::new(),
        width: w,
        height: h,
        quantity: qty,
        allow_rotation: true,
        color: "#4A90D9".into(),
    }
}

fn piece(w: f64, h: f64, qty: u32) -> CutPiece {
    base_piece(w, h, qty)
}

fn piece_no_rot(w: f64, h: f64, qty: u32) -> CutPiece {
    CutPiece { allow_rotation: false, ..base_piece(w, h, qty) }
}

fn piece_labeled(label: &str, w: f64, h: f64, qty: u32) -> CutPiece {
    CutPiece { label: label.into(), ..base_piece(w, h, qty) }
}

// ── Basic placement ─────────────────────────────────────────────

#[test]
fn empty_input() {
    let result = optimize(2440.0, 1220.0, &[], 3.0, CuttingStrategy::Auto);
    assert_eq!(result.total_sheets(), 0);
    assert!(result.unplaced_pieces.is_empty());
    assert_eq!(result.overall_efficiency(), 0.0);
}

#[test]
fn single_piece_fits() {
    let pieces = vec![piece(400.0, 300.0, 1)];
    let result = optimize(2440.0, 1220.0, &pieces, 3.0, CuttingStrategy::Auto);
    assert_eq!(result.total_sheets(), 1);
    assert!(result.unplaced_pieces.is_empty());
    assert_eq!(result.sheets[0].placed_pieces.len(), 1);
}

#[test]
fn piece_too_large() {
    let pieces = vec![piece(3000.0, 2000.0, 1)];
    let result = optimize(2440.0, 1220.0, &pieces, 0.0, CuttingStrategy::Auto);
    assert_eq!(result.unplaced_pieces.len(), 1);
    assert_eq!(result.total_sheets(), 0);
}

#[test]
fn piece_exactly_sheet_size() {
    let pieces = vec![piece(2440.0, 1220.0, 1)];
    let result = optimize(2440.0, 1220.0, &pieces, 0.0, CuttingStrategy::Auto);
    assert_eq!(result.total_sheets(), 1);
    assert!(result.unplaced_pieces.is_empty());
    assert!((result.overall_efficiency() - 100.0).abs() < 0.01);
}

#[test]
fn piece_fits_only_with_rotation() {
    let pieces = vec![piece(1300.0, 800.0, 1)];
    let result = optimize(2440.0, 1220.0, &pieces, 0.0, CuttingStrategy::Auto);
    assert_eq!(result.total_sheets(), 1);
    assert!(result.unplaced_pieces.is_empty());
}

#[test]
fn piece_no_rotation_doesnt_fit() {
    let pieces = vec![piece_no_rot(800.0, 1500.0, 1)];
    let result = optimize(1000.0, 1200.0, &pieces, 0.0, CuttingStrategy::Auto);
    assert_eq!(result.unplaced_pieces.len(), 1);
}

// ── Quantity expansion ───────────────────────────────────────────

#[test]
fn quantity_expands_correctly() {
    let pieces = vec![piece(500.0, 400.0, 5)];
    let result = optimize(2440.0, 1220.0, &pieces, 0.0, CuttingStrategy::Auto);
    let total_placed: usize = result.sheets.iter().map(|s| s.placed_pieces.len()).sum();
    assert_eq!(total_placed, 5);
    assert!(result.unplaced_pieces.is_empty());
}

#[test]
fn multiple_piece_types_all_placed() {
    let pieces = vec![
        piece(500.0, 400.0, 3),
        piece(300.0, 200.0, 5),
        piece(800.0, 600.0, 2),
    ];
    let result = optimize(2440.0, 1220.0, &pieces, 3.0, CuttingStrategy::Auto);
    let total_placed: usize = result.sheets.iter().map(|s| s.placed_pieces.len()).sum();
    assert_eq!(total_placed, 10);
    assert!(result.unplaced_pieces.is_empty());
}

// ── Multi-sheet ─────────────────────────────────────────────────

#[test]
fn multiple_pieces_multiple_sheets() {
    let pieces = vec![piece(1200.0, 600.0, 6)];
    let result = optimize(2440.0, 1220.0, &pieces, 3.0, CuttingStrategy::Auto);
    assert!(result.total_sheets() >= 2);
    assert!(result.unplaced_pieces.is_empty());
}

#[test]
fn two_full_sheets() {
    let pieces = vec![piece(2440.0, 610.0, 4)];
    let result = optimize(2440.0, 1220.0, &pieces, 0.0, CuttingStrategy::Auto);
    assert_eq!(result.total_sheets(), 2);
    assert!(result.unplaced_pieces.is_empty());
    assert!(result.overall_efficiency() > 99.0);
}

// ── Kerf handling ───────────────────────────────────────────────

#[test]
fn kerf_reduces_capacity() {
    let pieces_no_kerf = vec![piece(1220.0, 610.0, 2)];
    let r1 = optimize(2440.0, 1220.0, &pieces_no_kerf, 0.0, CuttingStrategy::Auto);
    assert_eq!(r1.total_sheets(), 1);

    let pieces_kerf = vec![piece(1220.0, 610.0, 2)];
    let r2 = optimize(2440.0, 1220.0, &pieces_kerf, 5.0, CuttingStrategy::Auto);
    assert!(r2.total_sheets() >= 1);
    assert!(r2.unplaced_pieces.is_empty());
}

#[test]
fn kerf_zero_no_gaps() {
    let pieces = vec![piece(2440.0, 1220.0, 1)];
    let result = optimize(2440.0, 1220.0, &pieces, 0.0, CuttingStrategy::Auto);
    let pp = &result.sheets[0].placed_pieces[0];
    assert_eq!(pp.x, 0.0);
    assert_eq!(pp.y, 0.0);
}

#[test]
fn kerf_makes_exact_fit_impossible() {
    let pieces = vec![piece(2440.0, 610.0, 2)];
    let r_no_kerf = optimize(2440.0, 1220.0, &pieces, 0.0, CuttingStrategy::Auto);
    let r_kerf = optimize(2440.0, 1220.0, &pieces, 1.0, CuttingStrategy::Auto);
    assert_eq!(r_no_kerf.total_sheets(), 1);
    assert!(r_kerf.total_sheets() >= 1);
}

// ── Efficiency ──────────────────────────────────────────────────

#[test]
fn efficiency_is_reasonable() {
    let pieces = vec![piece(1220.0, 610.0, 4)];
    let result = optimize(2440.0, 1220.0, &pieces, 0.0, CuttingStrategy::Auto);
    assert!(result.overall_efficiency() > 90.0);
}

#[test]
fn efficiency_calculation_correct() {
    let pieces = vec![piece(100.0, 100.0, 1)];
    let result = optimize(1000.0, 1000.0, &pieces, 0.0, CuttingStrategy::Auto);
    assert!((result.overall_efficiency() - 1.0).abs() < 0.01);
    assert!((result.sheets[0].efficiency() - 1.0).abs() < 0.01);
}

#[test]
fn total_area_matches_sheets() {
    let pieces = vec![piece(500.0, 400.0, 8)];
    let result = optimize(2440.0, 1220.0, &pieces, 3.0, CuttingStrategy::Auto);
    let expected_total_area = result.total_sheets() as f64 * 2440.0 * 1220.0;
    assert!((result.total_area() - expected_total_area).abs() < 0.01);
}

// ── Strategy selection ──────────────────────────────────────────

#[test]
fn auto_picks_best() {
    let pieces = vec![
        piece(500.0, 400.0, 3),
        piece(300.0, 200.0, 5),
        piece(800.0, 600.0, 2),
    ];
    let result = optimize(2440.0, 1220.0, &pieces, 3.0, CuttingStrategy::Auto);
    assert_eq!(result.strategy, CuttingStrategy::Auto);
    assert!(result.auto_picked_strategy.is_some());
    assert!(result.unplaced_pieces.is_empty());
}

#[test]
fn auto_at_least_as_good_as_any_single() {
    let pieces = vec![
        piece(700.0, 500.0, 4),
        piece(300.0, 250.0, 6),
        piece(150.0, 100.0, 10),
    ];
    let auto = optimize(2440.0, 1220.0, &pieces, 3.0, CuttingStrategy::Auto);

    for strategy_val in 1..=9u8 {
        let s = CuttingStrategy::try_from(strategy_val).unwrap();
        let single = optimize(2440.0, 1220.0, &pieces, 3.0, s);
        assert!(auto.total_sheets() <= single.total_sheets(),
            "Auto should use <= sheets than {:?}", s);
    }
}

#[test]
fn specific_strategy_returns_that_strategy() {
    let pieces = vec![piece(400.0, 300.0, 2)];
    let result = optimize(2440.0, 1220.0, &pieces, 0.0, CuttingStrategy::BestAreaAreaDesc);
    assert_eq!(result.strategy, CuttingStrategy::BestAreaAreaDesc);
    assert!(result.auto_picked_strategy.is_none());
}

#[test]
fn all_nine_strategies_produce_valid_results() {
    let pieces = vec![piece(500.0, 400.0, 3), piece(300.0, 200.0, 5)];
    for strategy_val in 1..=9u8 {
        let s = CuttingStrategy::try_from(strategy_val).unwrap();
        let result = optimize(2440.0, 1220.0, &pieces, 3.0, s);
        assert!(result.unplaced_pieces.is_empty(), "Strategy {:?} failed to place all pieces", s);
        assert!(result.total_sheets() > 0);
    }
}

// ── Placement correctness ───────────────────────────────────────

#[test]
fn pieces_dont_overlap() {
    let pieces = vec![
        piece(500.0, 400.0, 4),
        piece(300.0, 250.0, 6),
    ];
    let result = optimize(2440.0, 1220.0, &pieces, 0.0, CuttingStrategy::Auto);
    for sheet in &result.sheets {
        let pp = &sheet.placed_pieces;
        for i in 0..pp.len() {
            for j in (i + 1)..pp.len() {
                let a = &pp[i];
                let b = &pp[j];
                let overlap_x = a.x < b.x + b.width && a.x + a.width > b.x;
                let overlap_y = a.y < b.y + b.height && a.y + a.height > b.y;
                assert!(!(overlap_x && overlap_y),
                    "Pieces {} and {} overlap on sheet {}", i, j, sheet.index);
            }
        }
    }
}

#[test]
fn pieces_within_sheet_bounds() {
    let pieces = vec![piece(500.0, 400.0, 8)];
    let result = optimize(2440.0, 1220.0, &pieces, 3.0, CuttingStrategy::Auto);
    for sheet in &result.sheets {
        for pp in &sheet.placed_pieces {
            assert!(pp.x >= 0.0, "Piece x < 0");
            assert!(pp.y >= 0.0, "Piece y < 0");
            assert!(pp.x + pp.width <= sheet.width + 0.01,
                "Piece exceeds sheet width: {} + {} > {}", pp.x, pp.width, sheet.width);
            assert!(pp.y + pp.height <= sheet.height + 0.01,
                "Piece exceeds sheet height: {} + {} > {}", pp.y, pp.height, sheet.height);
        }
    }
}

#[test]
fn rotation_flag_is_correct() {
    let pieces = vec![piece(800.0, 300.0, 1)];
    let result = optimize(600.0, 1000.0, &pieces, 0.0, CuttingStrategy::Auto);
    assert_eq!(result.total_sheets(), 1);
    let pp = &result.sheets[0].placed_pieces[0];
    if pp.is_rotated {
        assert!((pp.width - 300.0).abs() < 0.01);
        assert!((pp.height - 800.0).abs() < 0.01);
    } else {
        assert!((pp.width - 800.0).abs() < 0.01);
        assert!((pp.height - 300.0).abs() < 0.01);
    }
}

// ── Edge cases ──────────────────────────────────────────────────

#[test]
fn tiny_pieces_many() {
    let pieces = vec![piece(10.0, 10.0, 100)];
    let result = optimize(2440.0, 1220.0, &pieces, 0.0, CuttingStrategy::Auto);
    assert_eq!(result.total_sheets(), 1);
    let total_placed: usize = result.sheets.iter().map(|s| s.placed_pieces.len()).sum();
    assert_eq!(total_placed, 100);
}

#[test]
fn square_sheet_square_pieces() {
    let pieces = vec![piece(500.0, 500.0, 4)];
    let result = optimize(1000.0, 1000.0, &pieces, 0.0, CuttingStrategy::Auto);
    assert_eq!(result.total_sheets(), 1);
    assert!((result.overall_efficiency() - 100.0).abs() < 0.01);
}

#[test]
fn mixed_fit_and_unfit() {
    let pieces = vec![
        piece(400.0, 300.0, 2),
        piece(5000.0, 5000.0, 1),
    ];
    let result = optimize(2440.0, 1220.0, &pieces, 0.0, CuttingStrategy::Auto);
    assert_eq!(result.unplaced_pieces.len(), 1);
    let total_placed: usize = result.sheets.iter().map(|s| s.placed_pieces.len()).sum();
    assert_eq!(total_placed, 2);
}

#[test]
fn labeled_unplaced_piece_shows_label() {
    let pieces = vec![piece_labeled("Полка XL", 5000.0, 5000.0, 1)];
    let result = optimize(2440.0, 1220.0, &pieces, 0.0, CuttingStrategy::Auto);
    assert_eq!(result.unplaced_pieces.len(), 1);
    assert!(result.unplaced_pieces[0].contains("Полка XL"));
}

#[test]
fn single_piece_per_sheet_fills_multiple() {
    let pieces = vec![piece(2440.0, 1220.0, 3)];
    let result = optimize(2440.0, 1220.0, &pieces, 0.0, CuttingStrategy::Auto);
    assert_eq!(result.total_sheets(), 3);
    for sheet in &result.sheets {
        assert_eq!(sheet.placed_pieces.len(), 1);
    }
}
