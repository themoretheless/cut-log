use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::optimizer::CuttingStrategy;

// ── CutPiece ──────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CutPiece {
    #[serde(default = "Uuid::new_v4")]
    pub id: Uuid,
    #[serde(default)]
    pub label: String,
    pub width: f64,
    pub height: f64,
    #[serde(default = "one")]
    pub quantity: u32,
    #[serde(default = "yes")]
    pub allow_rotation: bool,
    #[serde(default = "default_color")]
    pub color: String,
}

fn one() -> u32 { 1 }
fn yes() -> bool { true }
fn default_color() -> String { "#4A90D9".into() }

// ── PlacedPiece ───────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlacedPiece {
    pub source_id: Uuid,
    pub label: String,
    pub color: String,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub is_rotated: bool,
}

// ── Sheet ─────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Sheet {
    pub index: usize,
    pub width: f64,
    pub height: f64,
    pub placed_pieces: Vec<PlacedPiece>,
}

impl Sheet {
    pub fn used_area(&self) -> f64 {
        self.placed_pieces.iter().map(|p| p.width * p.height).sum()
    }

    pub fn total_area(&self) -> f64 {
        self.width * self.height
    }

    pub fn efficiency(&self) -> f64 {
        let total = self.total_area();
        if total > 0.0 { self.used_area() / total * 100.0 } else { 0.0 }
    }
}

// ── CuttingResult ─────────────────────────────────────────────────────────────

/// A piece that could not be placed. Carries only data; how it is presented
/// (label fallback, formatting, localization) is the caller's concern.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UnplacedPiece {
    pub label: String,
    pub width: f64,
    pub height: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CuttingResult {
    pub sheets: Vec<Sheet>,
    pub unplaced_pieces: Vec<UnplacedPiece>,
    pub strategy: CuttingStrategy,
    pub auto_picked_strategy: Option<CuttingStrategy>,
}

impl CuttingResult {
    pub fn new(strategy: CuttingStrategy) -> Self {
        Self {
            sheets: Vec::new(),
            unplaced_pieces: Vec::new(),
            strategy,
            auto_picked_strategy: None,
        }
    }

    pub fn total_sheets(&self) -> usize {
        self.sheets.len()
    }

    pub fn total_used_area(&self) -> f64 {
        self.sheets.iter().map(|s| s.used_area()).sum()
    }

    pub fn total_area(&self) -> f64 {
        self.sheets.iter().map(|s| s.total_area()).sum()
    }

    pub fn overall_efficiency(&self) -> f64 {
        let total = self.total_area();
        if total > 0.0 { self.total_used_area() / total * 100.0 } else { 0.0 }
    }
}
