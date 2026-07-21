// Deterministic benchmark for the optimizer.
// Run: cargo run --release -p cutter-core --example bench

use std::time::Instant;

use cutter_core::models::CutPiece;
use cutter_core::optimizer::{try_optimize, CuttingStrategy};

struct Lcg(u64);

impl Lcg {
    fn next(&mut self) -> u64 {
        self.0 = self
            .0
            .wrapping_mul(6364136223846793005)
            .wrapping_add(1442695040888963407);
        self.0 >> 33
    }

    fn range(&mut self, lo: u64, hi: u64) -> f64 {
        (lo + self.next() % (hi - lo)) as f64
    }
}

fn make_pieces(types: usize, max_qty: u64, seed: u64) -> Vec<CutPiece> {
    let mut rng = Lcg(seed);
    (0..types)
        .map(|i| CutPiece {
            id: uuid::Uuid::from_u128(i as u128).to_string(),
            label: format!("piece-{i}"),
            width: rng.range(100, 1200),
            height: rng.range(100, 800),
            quantity: (1 + rng.next() % max_qty) as u32,
            allow_rotation: !rng.next().is_multiple_of(4),
            color: "#4A90D9".into(),
        })
        .collect()
}

fn bench(name: &str, pieces: &[CutPiece], strategy: CuttingStrategy, iters: u32) {
    // warmup
    let result =
        try_optimize(2440.0, 1220.0, pieces, 3.0, strategy).expect("benchmark input must be valid");
    let total: u32 = pieces.iter().map(|p| p.quantity).sum();

    let mut times: Vec<f64> = Vec::with_capacity(iters as usize);
    for _ in 0..iters {
        let t = Instant::now();
        let r = try_optimize(2440.0, 1220.0, pieces, 3.0, strategy)
            .expect("benchmark input must be valid");
        times.push(t.elapsed().as_secs_f64() * 1000.0);
        assert_eq!(r.total_sheets(), result.total_sheets());
    }
    times.sort_by(|a, b| a.partial_cmp(b).unwrap());
    let median = times[times.len() / 2];
    let min = times[0];
    println!(
        "{name:<28} pieces={total:<5} sheets={:<4} eff={:>5.1}%  median={median:>9.3} ms  min={min:>9.3} ms",
        result.total_sheets(),
        result.overall_efficiency(),
    );
}

fn main() {
    let small = make_pieces(15, 5, 42);
    let medium = make_pieces(40, 20, 42);
    let large = make_pieces(80, 60, 42);

    bench("small/auto", &small, CuttingStrategy::Auto, 200);
    bench("medium/auto", &medium, CuttingStrategy::Auto, 30);
    bench("large/auto", &large, CuttingStrategy::Auto, 10);
    bench(
        "large/single",
        &large,
        CuttingStrategy::BestAreaAreaDesc,
        30,
    );
}
