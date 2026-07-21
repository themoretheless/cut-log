#![allow(deprecated)]

use cutter_core::models::CutPiece;
use cutter_core::optimizer::{
    optimize, try_optimize, CuttingStrategy, DerivedCalculation, DimensionAxis, MetadataField,
    MetadataViolation, NumericViolation, OptimizationError, OptimizeError, PieceIdViolation,
    MAX_EXPANDED_PIECES, MAX_PIECE_COLOR_CHARS, MAX_PIECE_ID_BYTES, MAX_PIECE_LABEL_CHARS,
};

fn base_piece(w: f64, h: f64, qty: u32) -> CutPiece {
    CutPiece {
        id: uuid::Uuid::new_v4().to_string(),
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
    CutPiece {
        allow_rotation: false,
        ..base_piece(w, h, qty)
    }
}

fn piece_labeled(label: &str, w: f64, h: f64, qty: u32) -> CutPiece {
    CutPiece {
        label: label.into(),
        ..base_piece(w, h, qty)
    }
}

fn assert_no_empty_sheets(result: &cutter_core::models::CuttingResult) {
    assert!(
        result
            .sheets
            .iter()
            .all(|sheet| !sheet.placed_pieces.is_empty()),
        "optimizer returned an empty sheet: {:#?}",
        result.sheets
    );
}

// ── Input validation ────────────────────────────────────────────

#[test]
fn rejects_non_positive_or_non_finite_sheet_dimensions() {
    let cases = [
        (
            0.0,
            100.0,
            DimensionAxis::Width,
            NumericViolation::NotPositive,
        ),
        (
            -1.0,
            100.0,
            DimensionAxis::Width,
            NumericViolation::NotPositive,
        ),
        (
            f64::NAN,
            100.0,
            DimensionAxis::Width,
            NumericViolation::NotFinite,
        ),
        (
            f64::INFINITY,
            100.0,
            DimensionAxis::Width,
            NumericViolation::NotFinite,
        ),
        (
            100.0,
            0.0,
            DimensionAxis::Height,
            NumericViolation::NotPositive,
        ),
        (
            100.0,
            -1.0,
            DimensionAxis::Height,
            NumericViolation::NotPositive,
        ),
        (
            100.0,
            f64::NAN,
            DimensionAxis::Height,
            NumericViolation::NotFinite,
        ),
        (
            100.0,
            f64::INFINITY,
            DimensionAxis::Height,
            NumericViolation::NotFinite,
        ),
    ];

    for (sheet_width, sheet_height, axis, violation) in cases {
        let error = try_optimize(sheet_width, sheet_height, &[], 0.0, CuttingStrategy::Auto)
            .expect_err("invalid sheet dimensions must be rejected");
        assert_eq!(
            error,
            OptimizationError::InvalidSheetDimension { axis, violation }
        );
    }
}

#[test]
fn rejects_non_finite_or_negative_kerf() {
    let cases = [
        (-1.0, NumericViolation::Negative),
        (f64::NAN, NumericViolation::NotFinite),
        (f64::INFINITY, NumericViolation::NotFinite),
        (f64::NEG_INFINITY, NumericViolation::NotFinite),
    ];

    for (kerf, violation) in cases {
        let error = try_optimize(100.0, 100.0, &[], kerf, CuttingStrategy::Auto)
            .expect_err("invalid kerf must be rejected");
        assert_eq!(error, OptimizationError::InvalidKerf { violation });
    }

    try_optimize(100.0, 100.0, &[], -0.0, CuttingStrategy::Auto)
        .expect("negative zero satisfies kerf >= 0");
}

#[test]
fn rejects_non_positive_or_non_finite_piece_dimensions() {
    let cases = [
        (
            0.0,
            10.0,
            DimensionAxis::Width,
            NumericViolation::NotPositive,
        ),
        (
            -1.0,
            10.0,
            DimensionAxis::Width,
            NumericViolation::NotPositive,
        ),
        (
            f64::NAN,
            10.0,
            DimensionAxis::Width,
            NumericViolation::NotFinite,
        ),
        (
            f64::INFINITY,
            10.0,
            DimensionAxis::Width,
            NumericViolation::NotFinite,
        ),
        (
            10.0,
            0.0,
            DimensionAxis::Height,
            NumericViolation::NotPositive,
        ),
        (
            10.0,
            -1.0,
            DimensionAxis::Height,
            NumericViolation::NotPositive,
        ),
        (
            10.0,
            f64::NAN,
            DimensionAxis::Height,
            NumericViolation::NotFinite,
        ),
        (
            10.0,
            f64::INFINITY,
            DimensionAxis::Height,
            NumericViolation::NotFinite,
        ),
    ];

    for (width, height, axis, violation) in cases {
        let mut invalid_piece = piece_labeled("invalid", width, height, 1);
        invalid_piece.id = "piece-1".into();
        let error = try_optimize(100.0, 100.0, &[invalid_piece], 0.0, CuttingStrategy::Auto)
            .expect_err("invalid piece dimensions must be rejected");
        assert_eq!(
            error,
            OptimizationError::InvalidPieceDimension {
                id: "piece-1".into(),
                label: "invalid".into(),
                axis,
                violation,
            }
        );
    }
}

#[test]
fn rejects_duplicate_piece_ids() {
    let mut first = piece(10.0, 10.0, 1);
    let mut second = piece(20.0, 20.0, 1);
    first.id = "duplicate".into();
    second.id = "duplicate".into();

    let error = try_optimize(100.0, 100.0, &[first, second], 0.0, CuttingStrategy::Auto)
        .expect_err("duplicate source ids must be rejected");
    assert_eq!(
        error,
        OptimizationError::DuplicatePieceId {
            id: "duplicate".into()
        }
    );
}

#[test]
fn rejects_empty_untrimmed_and_oversized_piece_ids() {
    let cases = [
        (String::new(), PieceIdViolation::Empty),
        (" leading".into(), PieceIdViolation::NotTrimmed),
        ("trailing ".into(), PieceIdViolation::NotTrimmed),
        ("   ".into(), PieceIdViolation::NotTrimmed),
        (
            "x".repeat(MAX_PIECE_ID_BYTES + 1),
            PieceIdViolation::TooLong {
                bytes: MAX_PIECE_ID_BYTES + 1,
                max_bytes: MAX_PIECE_ID_BYTES,
            },
        ),
    ];

    for (id, violation) in cases {
        let mut invalid_piece = piece(10.0, 10.0, 1);
        invalid_piece.id = id;
        let error = try_optimize(100.0, 100.0, &[invalid_piece], 0.0, CuttingStrategy::Auto)
            .expect_err("invalid ids must be rejected");
        assert_eq!(
            error,
            OptimizationError::InvalidPieceId {
                index: 0,
                violation,
            }
        );
    }

    let mut max_length_id = piece(10.0, 10.0, 1);
    max_length_id.id = "x".repeat(MAX_PIECE_ID_BYTES);
    try_optimize(100.0, 100.0, &[max_length_id], 0.0, CuttingStrategy::Auto)
        .expect("an id exactly at the byte limit must be accepted");
}

#[test]
fn rejects_oversized_unicode_metadata_before_quantity_expansion() {
    let mut oversized_label = piece(1.0, 1.0, MAX_EXPANDED_PIECES as u32);
    oversized_label.id = "oversized-label".into();
    oversized_label.label = "界".repeat(MAX_PIECE_LABEL_CHARS + 1);
    let error = try_optimize(100.0, 100.0, &[oversized_label], 0.0, CuttingStrategy::Auto)
        .expect_err("an oversized label must be rejected before expansion");
    assert_eq!(
        error,
        OptimizationError::InvalidPieceMetadata {
            index: 0,
            field: MetadataField::Label,
            violation: MetadataViolation::TooLong {
                max_chars: MAX_PIECE_LABEL_CHARS,
            },
        }
    );

    let mut oversized_color = piece(1.0, 1.0, MAX_EXPANDED_PIECES as u32);
    oversized_color.id = "oversized-color".into();
    oversized_color.color = "界".repeat(MAX_PIECE_COLOR_CHARS + 1);
    let error = try_optimize(100.0, 100.0, &[oversized_color], 0.0, CuttingStrategy::Auto)
        .expect_err("an oversized color must be rejected before expansion");
    assert_eq!(
        error,
        OptimizationError::InvalidPieceMetadata {
            index: 0,
            field: MetadataField::Color,
            violation: MetadataViolation::TooLong {
                max_chars: MAX_PIECE_COLOR_CHARS,
            },
        }
    );
}

#[test]
fn accepts_unicode_metadata_exactly_at_the_limits() {
    let mut boundary_piece = piece(1.0, 1.0, 1);
    boundary_piece.id = "metadata-boundary".into();
    boundary_piece.label = "界".repeat(MAX_PIECE_LABEL_CHARS);
    boundary_piece.color = "界".repeat(MAX_PIECE_COLOR_CHARS);

    try_optimize(100.0, 100.0, &[boundary_piece], 0.0, CuttingStrategy::Auto)
        .expect("metadata exactly at the Unicode scalar limits must be accepted");
}

#[test]
fn rejects_non_finite_derived_magnitudes_for_every_strategy() {
    let mut normal_piece = piece(1.0, 1.0, 1);
    normal_piece.id = "unsafe-sheet-area".into();

    for strategy_value in 0..=9 {
        let strategy = CuttingStrategy::try_from(strategy_value).unwrap();
        let error = try_optimize(1e200, 1e200, &[normal_piece.clone()], 0.0, strategy)
            .expect_err("1e200 squared must be rejected before packing");
        assert_eq!(
            error,
            OptimizationError::UnsafeDerivedValue {
                calculation: DerivedCalculation::SheetArea,
                violation: NumericViolation::UnsafeMagnitude,
            },
            "strategy {strategy:?}"
        );
    }

    let error = try_optimize(1e-200, 1e-200, &[normal_piece], 0.0, CuttingStrategy::Auto)
        .expect_err("an area that underflows to zero must be rejected");
    assert_eq!(
        error,
        OptimizationError::UnsafeDerivedValue {
            calculation: DerivedCalculation::SheetArea,
            violation: NumericViolation::UnsafeMagnitude,
        }
    );
}

#[test]
fn rejects_unsafe_piece_reserve_and_piece_area() {
    let mut unsafe_reserve = piece(f64::MAX, 1e-308, 1);
    unsafe_reserve.id = "unsafe-reserve".into();
    let error = try_optimize(
        f64::MAX,
        1e-308,
        &[unsafe_reserve],
        f64::MAX,
        CuttingStrategy::Auto,
    )
    .expect_err("an overflowing reserve dimension must be rejected");
    assert_eq!(
        error,
        OptimizationError::UnsafeDerivedValue {
            calculation: DerivedCalculation::PieceReserve {
                id: "unsafe-reserve".into(),
                axis: DimensionAxis::Width,
            },
            violation: NumericViolation::UnsafeMagnitude,
        }
    );

    let mut unsafe_piece_area = piece(1e200, 1e200, 1);
    unsafe_piece_area.id = "unsafe-piece-area".into();
    let error = try_optimize(
        100.0,
        100.0,
        &[unsafe_piece_area],
        0.0,
        CuttingStrategy::Auto,
    )
    .expect_err("an overflowing piece area must be rejected");
    assert_eq!(
        error,
        OptimizationError::UnsafeDerivedValue {
            calculation: DerivedCalculation::PieceArea {
                id: "unsafe-piece-area".into(),
            },
            violation: NumericViolation::UnsafeMagnitude,
        }
    );
}

#[test]
fn accepts_large_magnitudes_when_every_derived_value_is_finite() {
    let mut large_piece = piece(5e199, 1e-100, 1);
    large_piece.id = "large-safe-piece".into();

    for strategy_value in 0..=9 {
        let strategy = CuttingStrategy::try_from(strategy_value).unwrap();
        let result = try_optimize(1e200, 1e-100, &[large_piece.clone()], 0.0, strategy)
            .expect("large but mathematically safe input must remain supported");
        assert_eq!(result.total_sheets(), 1, "strategy {strategy:?}");
        assert!(result.total_area().is_finite(), "strategy {strategy:?}");
        assert!(
            result.total_used_area().is_finite(),
            "strategy {strategy:?}"
        );
        assert!(
            result.overall_efficiency().is_finite(),
            "strategy {strategy:?}"
        );
    }
}

#[test]
fn huge_finite_sheet_with_many_tiny_pieces_is_not_over_rejected() {
    let mut tiny_pieces = piece(1.0, 1.0, MAX_EXPANDED_PIECES as u32);
    tiny_pieces.id = "tiny-on-huge-sheet".into();

    for strategy_value in 0..=9 {
        let strategy = CuttingStrategy::try_from(strategy_value).unwrap();
        let result = try_optimize(1e200, 1e108, &[tiny_pieces.clone()], 0.0, strategy)
            .expect("actual one-sheet metrics remain finite");

        assert_eq!(result.total_sheets(), 1, "strategy {strategy:?}");
        assert_eq!(
            result.sheets[0].placed_pieces.len(),
            MAX_EXPANDED_PIECES as usize,
            "strategy {strategy:?}"
        );
        assert!(result.total_area().is_finite(), "strategy {strategy:?}");
        assert!(
            result.total_used_area().is_finite(),
            "strategy {strategy:?}"
        );
        assert!(
            result.overall_efficiency().is_finite(),
            "strategy {strategy:?}"
        );
    }
}

#[test]
fn overflowing_requested_area_is_allowed_when_every_piece_is_unplaced() {
    let mut oversized = piece(1e153, 1e153, MAX_EXPANDED_PIECES as u32);
    oversized.id = "huge-unplaced".into();
    let result = try_optimize(100.0, 100.0, &[oversized], 0.0, CuttingStrategy::Auto)
        .expect("unplaced requested area must not be treated as result used area");

    assert_eq!(result.total_sheets(), 0);
    assert_eq!(result.unplaced_pieces.len(), MAX_EXPANDED_PIECES as usize);
    assert_eq!(result.total_area(), 0.0);
    assert_eq!(result.total_used_area(), 0.0);
    assert_eq!(result.overall_efficiency(), 0.0);
}

#[test]
fn rejects_an_actually_non_finite_result_after_packing() {
    let mut full_sheet = piece(1e200, 1e108, 2);
    full_sheet.id = "two-huge-sheets".into();

    for strategy in [CuttingStrategy::Auto, CuttingStrategy::BestAreaAreaDesc] {
        let error = try_optimize(1e200, 1e108, &[full_sheet.clone()], 0.0, strategy)
            .expect_err("two actual 1e308 sheets make result total area non-finite");

        assert_eq!(
            error,
            OptimizationError::UnsafeDerivedValue {
                calculation: DerivedCalculation::ResultTotalArea,
                violation: NumericViolation::UnsafeMagnitude,
            },
            "strategy {strategy:?}"
        );
    }
}

#[test]
fn max_quantity_produces_only_finite_result_metrics() {
    let mut max_quantity = piece(1.0, 1.0, MAX_EXPANDED_PIECES as u32);
    max_quantity.id = "max-quantity".into();
    let result = try_optimize(100.0, 100.0, &[max_quantity], 0.0, CuttingStrategy::Auto)
        .expect("safe input at the quantity limit must optimize");

    assert_eq!(
        result
            .sheets
            .iter()
            .map(|sheet| sheet.placed_pieces.len())
            .sum::<usize>(),
        MAX_EXPANDED_PIECES as usize
    );
    assert!(result.total_area().is_finite());
    assert!(result.total_used_area().is_finite());
    assert!(result.overall_efficiency().is_finite());
    for sheet in &result.sheets {
        assert!(sheet.total_area().is_finite());
        assert!(sheet.used_area().is_finite());
        assert!(sheet.efficiency().is_finite());
    }
}

#[test]
#[should_panic(expected = "optimizer input rejected")]
fn legacy_optimize_rejects_invalid_input_loudly() {
    let mut too_many = piece(1.0, 1.0, MAX_EXPANDED_PIECES as u32 + 1);
    too_many.id = "too-many".into();
    let _ = optimize(100.0, 100.0, &[too_many], 0.0, CuttingStrategy::Auto);
}

#[test]
fn rejects_an_excessive_expanded_quantity_without_allocating_it() {
    let pieces = vec![piece(10.0, 10.0, MAX_EXPANDED_PIECES as u32 + 1)];
    let error = try_optimize(1000.0, 1000.0, &pieces, 0.0, CuttingStrategy::Auto)
        .expect_err("quantity over the hard limit must be rejected");
    assert!(matches!(error, OptimizeError::TooManyPieces { .. }));
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
    assert_eq!(r_kerf.total_sheets(), 0);
    assert_eq!(r_kerf.unplaced_pieces.len(), 2);
    assert_no_empty_sheets(&r_kerf);
}

#[test]
fn exact_fit_with_kerf_never_creates_an_empty_sheet() {
    let mut exact_fit = piece(100.0, 100.0, 1);
    exact_fit.id = "exact-fit".into();

    for strategy_value in 0..=9 {
        let strategy = CuttingStrategy::try_from(strategy_value).unwrap();
        let result = try_optimize(100.0, 100.0, &[exact_fit.clone()], 1.0, strategy)
            .expect("valid input must return a result");
        assert_eq!(result.total_sheets(), 0, "strategy {strategy:?}");
        assert_eq!(result.unplaced_pieces.len(), 1, "strategy {strategy:?}");
        assert_eq!(result.unplaced_pieces[0].source_id, "exact-fit");
        assert_no_empty_sheets(&result);
    }
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
        assert!(
            auto.total_sheets() <= single.total_sheets(),
            "Auto should use <= sheets than {:?}",
            s
        );
    }
}

#[test]
fn specific_strategy_returns_that_strategy() {
    let pieces = vec![piece(400.0, 300.0, 2)];
    let result = optimize(
        2440.0,
        1220.0,
        &pieces,
        0.0,
        CuttingStrategy::BestAreaAreaDesc,
    );
    assert_eq!(result.strategy, CuttingStrategy::BestAreaAreaDesc);
    assert!(result.auto_picked_strategy.is_none());
}

#[test]
fn all_nine_strategies_produce_valid_results() {
    let pieces = vec![piece(500.0, 400.0, 3), piece(300.0, 200.0, 5)];
    for strategy_val in 1..=9u8 {
        let s = CuttingStrategy::try_from(strategy_val).unwrap();
        let result = optimize(2440.0, 1220.0, &pieces, 3.0, s);
        assert!(
            result.unplaced_pieces.is_empty(),
            "Strategy {:?} failed to place all pieces",
            s
        );
        assert!(result.total_sheets() > 0);
        assert_no_empty_sheets(&result);
    }
}

#[test]
fn every_strategy_preserves_the_no_empty_sheets_invariant() {
    let pieces = vec![
        piece(60.0, 60.0, 3),
        piece(40.0, 30.0, 2),
        piece(100.0, 100.0, 1),
        piece(200.0, 200.0, 1),
    ];
    let expected_count: usize = pieces.iter().map(|piece| piece.quantity as usize).sum();

    for strategy_value in 0..=9 {
        let strategy = CuttingStrategy::try_from(strategy_value).unwrap();
        let result = try_optimize(100.0, 100.0, &pieces, 1.0, strategy)
            .expect("fixture contains valid optimizer input");
        let placed_count: usize = result
            .sheets
            .iter()
            .map(|sheet| sheet.placed_pieces.len())
            .sum();

        assert_no_empty_sheets(&result);
        assert_eq!(
            placed_count + result.unplaced_pieces.len(),
            expected_count,
            "strategy {strategy:?} lost or duplicated a piece"
        );
    }
}

// ── Placement correctness ───────────────────────────────────────

#[test]
fn pieces_dont_overlap() {
    let pieces = vec![piece(500.0, 400.0, 4), piece(300.0, 250.0, 6)];
    let result = optimize(2440.0, 1220.0, &pieces, 0.0, CuttingStrategy::Auto);
    for sheet in &result.sheets {
        let pp = &sheet.placed_pieces;
        for i in 0..pp.len() {
            for j in (i + 1)..pp.len() {
                let a = &pp[i];
                let b = &pp[j];
                let overlap_x = a.x < b.x + b.width && a.x + a.width > b.x;
                let overlap_y = a.y < b.y + b.height && a.y + a.height > b.y;
                assert!(
                    !(overlap_x && overlap_y),
                    "Pieces {} and {} overlap on sheet {}",
                    i,
                    j,
                    sheet.index
                );
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
            assert!(
                pp.x + pp.width <= sheet.width + 0.01,
                "Piece exceeds sheet width: {} + {} > {}",
                pp.x,
                pp.width,
                sheet.width
            );
            assert!(
                pp.y + pp.height <= sheet.height + 0.01,
                "Piece exceeds sheet height: {} + {} > {}",
                pp.y,
                pp.height,
                sheet.height
            );
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
    let pieces = vec![piece(400.0, 300.0, 2), piece(5000.0, 5000.0, 1)];
    let result = optimize(2440.0, 1220.0, &pieces, 0.0, CuttingStrategy::Auto);
    assert_eq!(result.unplaced_pieces.len(), 1);
    let total_placed: usize = result.sheets.iter().map(|s| s.placed_pieces.len()).sum();
    assert_eq!(total_placed, 2);
}

#[test]
fn labeled_unplaced_piece_shows_label() {
    let mut oversized = piece_labeled("Полка XL", 5000.0, 5000.0, 1);
    oversized.id = "source:oversized/shelf".into();
    let pieces = vec![oversized];
    let result = optimize(2440.0, 1220.0, &pieces, 0.0, CuttingStrategy::Auto);
    assert_eq!(result.unplaced_pieces.len(), 1);
    assert_eq!(result.unplaced_pieces[0].label, "Полка XL");
    assert_eq!(
        result.unplaced_pieces[0].source_id,
        "source:oversized/shelf"
    );
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
