# CutLog

CutLog is a local-first browser workspace for flat-sheet fabrication:

- **Cutting Optimizer** packs rectangular parts onto stock sheets with kerf,
  optional rotation, and multiple guillotine heuristics.
- **Box Builder** creates a parametric finger-joint box, previews the assembly
  and individual panels in 3D, and exports laser-ready SVG paths.
- **SKADIS Board** generates a parametric pegboard compatible with the IKEA
  SKADIS accessory grid and exports it as SVG or DXF.

The interface is available in English and Russian. Geometry, optimization, and
project storage stay in the browser; no project data is uploaded.

[Русская версия README](README.ru.md)

> **License:** there is no `LICENSE` file yet. The repository is therefore not
> offered for reuse under an open-source license.

## What is included

### Cutting Optimizer

- Rust/WASM guillotine packing with kerf and per-part rotation.
- Nine explicit strategies (three fit heuristics by three sort orders) plus
  **Auto**, which chooses the fewest sheets and then the best efficiency.
- A cancellable module Worker keeps calculation off the UI thread.
- Quantity protection: at most 1,000 copies of one piece and 2,000 expanded
  pieces in one run, enforced before WASM and again in Rust.
- Sheet presets, import, duplicate/filter/sort/bulk edit, drag and keyboard
  reorder, undo/redo, snapshots, share links, costing, and SVG/DXF/CSV/print
  output.
- Accessible result-sheet SVGs with keyboard-selectable pieces.

### Box Builder

- Finger-joint geometry from width, height, depth, thickness, kerf, tab size,
  shelf count, and front/back bevel.
- One constraint model clamps interdependent values before geometry runs.
- Live Three.js assembly and piece gallery with owned GPU cleanup and a
  hidden-tab rendering pause.
- Per-piece and full-layout SVG export.

### SKADIS Board

- Parametric slot grid from board size, slot size, pitch, edge margin, and the
  row and column stagger, with a check against the standard SKADIS geometry.
- A drawing-style preview with edge margins and pitch measured to the slot
  centrelines, and a zoomable, pannable viewport whose annotation keeps a
  constant on-screen size.
- A 3x3 tiling view that shows the assembled size and the slot spacing across
  the joint between neighbouring boards, flagging a board size that breaks the
  pattern.
- A snap that shrinks the board to the nearest size whose holes stay evenly
  spaced both inside the board and across the joint.
- Millimetre SVG and DXF output for laser and CNC.

## Start here

To understand the project in small pieces, do not begin with the large page
components:

1. Read `frontend/src/services/types.ts` for the data vocabulary.
2. Read `frontend/src/lib/optimizerLimits.ts` and `validatePiece.ts` beside
   their tests for the trust boundary.
3. Follow `services/optimizer.ts` -> `optimizerWorker.ts` ->
   `optimizer.worker.ts` -> `rustService.ts` for one calculation.
4. Read `crates/core/src/models.rs` and `optimizer.rs`; the WASM and CLI crates
   are thin adapters.
5. Read `useProjectState.svelte.ts`, then the focused Home composables for commands,
   costing, selection, import, history, snapshots, piece-list actions,
   shortcuts, and exports; open `pages/Home.svelte` only to see composition.
6. For the box, follow `box/constraints.ts` -> `geometry.ts` ->
   `useBoxModel.svelte.ts` -> `box/three/*` -> `pages/BoxBuilder.svelte`.

[ARCHITECTURE.md](ARCHITECTURE.md) expands this into layer rules, SOLID/DRY
ownership, diagrams, the seven completed iterations, and the next small
refactoring slices.

## Architecture at a glance

```text
pages/components -> composables -> services -> Worker/WASM -> Rust core
        |                |              |
        +----------------+------------> pure TypeScript/types
```

```text
frontend/src/
  lib/             pure validation, state, history, piece ops, exports, display math
  services/        optimizer adaptation, Worker ownership, lazy WASM loading
  composables/     runes-owned editor state and effects with narrow interfaces
  components/      reusable presentation controls and SheetCard
  box/             pure constraints/geometry, reactive model, owned Three.js scenes
  pages/           product composition and remaining cross-feature orchestration
crates/
  core/            pure Rust optimizer and models
  wasm/            wasm-bindgen error/data adapter
  cli/             stdin/stdout adapter
  ui/              Rust SVG renderer
```

Pure modules do not import Svelte or browser effects. Pages depend inward on
composables, services, pure modules, and contracts. Shared policy has one owner:
quantity limits, palette, sheet display math, box constraints, geometry, and
downloads are not reimplemented in pages.

## 510-item review

The v0.1.54 review tracks **510 unique, ID-addressable items**. The original
20 groups contain 25 findings each; the latest editor benchmark follow-up adds
10 independently ranked ideas:

| IDs | Area | IDs | Area |
|---|---|---|---|
| CL-001..025 | Runtime safety | CL-251..275 | Accessibility |
| CL-026..050 | Optimizer correctness | CL-276..300 | Visual design |
| CL-051..075 | WASM and Workers | CL-301..325 | Responsive/mobile |
| CL-076..100 | Rust and CLI | CL-326..350 | Internationalization |
| CL-101..125 | Home architecture | CL-351..375 | Testing |
| CL-126..150 | Persistence/history | CL-376..400 | CI/release |
| CL-151..175 | Piece editor/import | CL-401..425 | Performance |
| CL-176..200 | Export/CAD/print | CL-426..450 | Security/privacy |
| CL-201..225 | Box geometry | CL-451..475 | Product workflows |
| CL-226..250 | Three.js lifecycle | CL-476..500 | Documentation |
| CL-501..510 | Editor-inspired next ideas | | |

The canonical checklist, priorities, effort sizes, and 112 items delivered so
far are in [recommendation.md](recommendation.md). The catalog is
not copied here or into architecture; that duplication would immediately make
status unreliable. `plan.md` remains historical brainstorming.

The [top-100 repository benchmark](docs/top-100-repository-benchmark.md)
records five relevance cohorts, the source-verified editor patterns adopted in
v0.1.52 through v0.1.54, and ten newly ranked candidates for later batches.

## Build and run

Prerequisites: Rust with `wasm32-unknown-unknown`, `wasm-pack`, `wasm-opt`, and
Node 22+.

```bash
# Build and optimize WebAssembly
cd crates/wasm
wasm-pack build --target web --release
wasm-opt -Oz --enable-bulk-memory pkg/cutter_wasm_bg.wasm -o pkg/cutter_wasm_bg.wasm

# Copy generated assets to the frontend
cd ../..
cp -r crates/wasm/pkg/* frontend/wasm/
cp crates/wasm/pkg/cutter_wasm_bg.wasm frontend/public/

# Install and start Vite
cd frontend
npm ci
npm run dev
```

`npm run build` writes the static site to `frontend/dist`.

## CLI

The CLI reads one JSON request from stdin and writes JSON, or SVG when
`"svg": true` is present. Invalid or excessive input prints an error and exits
nonzero.

```bash
echo '{
  "sheet_width": 2440, "sheet_height": 1220, "kerf": 3, "strategy": "Auto",
  "pieces": [
    { "label": "Shelf", "width": 500, "height": 400, "quantity": 3 },
    { "label": "Side",  "width": 800, "height": 600, "quantity": 2 }
  ]
}' | cargo run -p cutter-cli
```

## Verification

### Rust API migration to 0.2

App release v0.1.56 moves all Rust workspace crates to v0.2.0. In
`cutter-core`, use `try_optimize(...)` and handle its typed
`OptimizationError`; the infallible `optimize(...)` wrapper is deprecated and
panics on invalid input instead of fabricating a partial result. In
`cutter-ui`, `render_sheet_svg(...)` and `render_result_svg(...)` now return
`Result<String, RenderSvgError>`, so callers must propagate or handle rendering
failures. The WASM API rejects unsupported strategy values and inputs above
4 MiB with structured `{ kind, code, message }` errors.

```bash
cargo test --workspace
cd frontend
npm test -- --typecheck.enabled
npm run check
npm run build
```

GitHub Actions also rebuilds WASM, runs Rust and frontend checks, verifies the
release version, and publishes the static bundle to GitHub Pages.
