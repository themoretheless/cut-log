# CutLog

Two tools for anyone cutting flat sheet stock (plywood, MDF, acrylic) on a CNC
or laser:

- **Cutting Optimizer** — pack a list of rectangular parts onto stock sheets
  with minimal waste (guillotine bin-packing, kerf-aware, optional rotation).
- **Box Builder** — design a parametric finger-joint box (5 walls, optional
  shelves and a bevel), preview it in 3D, and export laser-ready SVG cut paths.

Bilingual UI (English / Russian). Runs entirely in the browser — the geometry
and the packing run client-side, nothing is uploaded.

[Русская версия README](README.ru.md)

> **License:** none yet. Until a `LICENSE` file is added the code is "all rights
> reserved" by default — others may view it but not legally reuse it.

## Features

**Cutting Optimizer**
- Guillotine (shelf/free-rectangle) bin-packing with kerf and per-part rotation.
- 9 strategies (3 fit heuristics × 3 sort orders) plus **Auto**, which runs all
  of them and keeps the result with the fewest sheets, then best efficiency.
- Common sheet presets, drag-to-reorder parts, localStorage persistence,
  keyboard shortcuts, efficiency stats and an SVG layout per sheet.

**Box Builder**
- Finger-joint (tab-and-slot) geometry generated from width/height/depth,
  material thickness, kerf, tab size, shelf count and a front/back bevel.
- Live 3D assembly view (exploded, orbit, per-piece gallery) via three.js.
- Per-piece and full-sheet SVG export for laser cutting.

## Architecture

```
crates/
  core/   cutter-core  — cutting optimizer + data models (pure Rust, unit-tested)
  ui/     cutter-ui    — SVG result rendering + color palette
  cli/    cutter-cli   — stdin JSON -> stdout JSON/SVG
  wasm/   cutter-wasm  — wasm-bindgen surface (optimize/optimize_sync)
frontend/              — Vue 3 + TypeScript + Vite + three.js
  src/box/geometry.ts  — box geometry (paths, 3D, layout), the single source of truth
scripts/               — golden fixtures for the box geometry; benchmark notes
```

The **cutting optimizer** lives in Rust and is compiled to WebAssembly. The
**box geometry** lives in TypeScript (`src/box/geometry.ts`) — it was measured to
be the faster place for it; see [scripts/bench/BENCH.md](scripts/bench/BENCH.md).

### Layering and the refactoring plan

The intended dependency direction is strictly inward:

`pages -> composables -> services / lib -> types`

Pure logic (serialization, parsing, history, geometry, cost, export, piece-edit
ops) already lives in framework-free, unit-tested `lib/*` modules and
`box/geometry.ts`, and nothing in `lib/` or `services/` imports Vue. The
composables layer is the target home for the Vue-reactive glue; today most of
that glue still lives in the page components, chiefly `Home.vue` (~1907 lines),
which the plan decomposes into composables and a `SheetCard` component.

The full from-scratch review (ten independent critics, one per lens) and the
target model live in [ARCHITECTURE.md](ARCHITECTURE.md); the ordered,
status-tracked to-do plus a ranked audit of concrete issues (bugs, security,
accessibility, i18n, performance) are in
[recommendation.md](recommendation.md); the master roadmap and the
idea/suggestion backlog are in [plan.md](plan.md).

## Build & run

Prerequisites: Rust (with the `wasm32-unknown-unknown` target), `wasm-pack`,
`wasm-opt`, and Node 22+.

```bash
# 1. Build the WebAssembly bundle
cd crates/wasm
wasm-pack build --target web --release
wasm-opt -Oz --enable-bulk-memory pkg/cutter_wasm_bg.wasm -o pkg/cutter_wasm_bg.wasm

# 2. Copy it into the frontend
cd ../..
cp -r crates/wasm/pkg/* frontend/wasm/
cp crates/wasm/pkg/cutter_wasm_bg.wasm frontend/public/

# 3. Run the dev server
cd frontend
npm install
npm run dev
```

`npm run build` produces a static bundle in `frontend/dist`.

## CLI

The optimizer is also a standalone CLI that reads a JSON request on stdin:

```bash
echo '{
  "sheet_width": 2440, "sheet_height": 1220, "kerf": 3, "strategy": "Auto",
  "pieces": [
    { "label": "Shelf", "width": 500, "height": 400, "quantity": 3 },
    { "label": "Side",  "width": 800, "height": 600, "quantity": 2 }
  ]
}' | cargo run -p cutter-cli
```

It prints the layout as JSON, or as an SVG when the request has `"svg": true`.

## Tests

```bash
cargo test --workspace      # optimizer unit tests
cd frontend && npm test     # box geometry golden tests (vitest)
```

## Deployment

GitHub Actions builds the wasm bundle and the frontend and publishes
`frontend/dist` to GitHub Pages (`.github/workflows/`).
