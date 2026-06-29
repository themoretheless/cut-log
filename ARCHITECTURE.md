# CutLog architecture and refactoring plan

This document describes how CutLog is structured today, what a from-scratch
design would look like, and an incremental, behavior-preserving plan to get
there. It was produced from a review by ten independent architecture critics
(one per lens) plus a synthesis pass, with a deliberate bias against
over-engineering for a niche, static, single-developer app.

The focus is modularity, code decomposition, and loose coupling.

For the operational checklist (status, order, next action), see
[recommendation.md](recommendation.md). This file is the rationale; that file is
the to-do. recommendation.md also carries a ranked audit of concrete issues
(bugs, security, accessibility, i18n, performance) in three waves; the phases
below cover the structural ones, the rest are standalone fixes. The master
roadmap and the idea/suggestion backlog are in [plan.md](plan.md).

Status as of version 0.1.38: 0 of 6 phases done. The plan is written but not yet
executed. PR #65 (editor UX iteration) since grew `Home.vue` from ~958 to ~1907
lines, so the decomposition below is more needed, not less.

## 1. Where we are

CutLog already has a sound three-tier shape: pure, tested `lib/*` modules, a
thin `services/` wasm adapter, and Vue pages on top. The debt is concentrated,
not systemic:

- `frontend/src/pages/Home.vue` is a ~1907-line god component. Its orchestration
  (localStorage persistence, snapshot undo/redo, share links, named project
  snapshots, bulk import, CSV/SVG/DXF/print export, drag-reorder, selection,
  piece search/sort/bulk-edit, keyboard shortcuts, costing, and the inline sheet
  SVG) lives in the component, so almost none of it is unit-tested. PR #65 added
  two good pure libs (`lib/pieceEditor.ts`, `lib/projectSnapshots.ts`) but wired
  both into the page, which is why the page keeps growing.
- `frontend/src/box/useBoxModel.ts` entangles three reasons-to-change: pure
  geometry wrappers (good), i18n label matching (`label === t('box.top_short')`
  at lines 81-82, which silently breaks if a translation changes), and hardcoded
  color palettes.
- The three.js scenes (`box/three/useAssemblyScene.ts`, `usePieceGallery.ts`)
  call `renderer.dispose()` but never traverse the scene graph, so per-mesh
  geometry and materials leak on every box-parameter rebuild, even though
  `panelMesh.ts` already exports a `disposeObj()`.
- Smaller duplication: color palettes split across `helpers/svg.ts` and
  `useBoxModel.ts`; `downloadFile` (Home.vue) and `downloadSvg` (BoxBuilder.vue)
  are the same blob/anchor/revoke helper; the on-screen sheet SVG and
  `lib/exportLayout.ts` independently implement scaling, badges, and labels.
- `jspdf` and `svg2pdf.js` are declared in `package.json` but never imported.

What is already good and should be preserved: the pure-lib + co-located-test
pattern (now `homeState`, `shareLink`, `parsePieceList`, `history`,
`costSummary`, `piecesCsv`, `pieceOps`, `pieceEditor`, `projectSnapshots`,
`exportLayout`, `validatePiece`), the wasm adapter boundary, the box geometry as
a single source of truth feeding both renderers, and the l10n key-parity guard.

Note on a non-issue: the on-screen sheet SVG renders labels with Vue `{{ }}`
interpolation, which sets escaped text content, so there is no injection or
broken-preview bug there. The export SVG, built as a raw string, already calls
`escapeXml`. Extracting the sheet SVG (Phase 1) is justified by modularity and
de-duplication, not by a safety fix.

## 2. The ten-critic review

Each critic designed its concern as if from scratch, then judged the real code.

| # | Lens | Core finding |
|---|------|--------------|
| 1 | SRP / god-components | `Home.vue` mixes ~15+ concerns; the box scenes conflate lifecycle, animation, geometry, and interaction. |
| 2 | Coupling and dependency direction | `useBoxModel` couples geometry + i18n + color; persistence and i18n leak across layers; box piece identity depends on translated strings. |
| 3 | Cohesion and module boundaries | `Home.vue` groups things that change for different reasons; boundaries should be drawn by reason-to-change (persistence, history, share, import, export, selection, drag, keyboard, piece-edit). |
| 4 | Layering | The pure-lib to composable to component stack is sound; the violations are page-local (inline SVG, orchestration in the page). |
| 5 | Testability and seams | The pure libs are tested; the orchestration script in `Home.vue` is not. Extract composables at clear seams so most of it becomes testable without a DOM. |
| 6 | State and data flow | No single owner for project state; refs, watchers, history, and persistence interleave, with several entry points all calling `applyState`. |
| 7 | DRY and reuse | Duplicated palettes, download helpers, SVG scaling, and badge/label rendering between the on-screen and export SVG. |
| 8 | Abstraction quality | Some primitive obsession (bare param refs, raw SVG coordinates); a few leaky abstractions (color cycling spread across files). |
| 9 | Naming and file organization | The technical-layer folders work at this size; `lib/` is a mild grab-bag and `helpers/svg.ts` mixes unrelated constants. |
| 10 | Bundle and code-splitting | Route-level lazy loading and deferred wasm already exist; the real wins are removing dead deps and isolating the three.js layer, not more splitting. |

## 3. Target architecture

### 3.1 Layers

| Layer | Responsibility | Rules |
|-------|----------------|-------|
| Pure logic (`lib/`, `box/geometry.ts`, `helpers/`) | Framework-free TypeScript: serialization, validation, parsing, history, snapshots, piece-edit ops, cost, export serializers, geometry math, palettes, SVG view-model builders. Deterministic. | May import other `lib/` and types only. Never imports `vue`, components, composables, services, or stores. Ships with a co-located `*.test.ts`; geometry keeps golden snapshots. |
| Services (`services/`) | Wrap the Rust/wasm optimizer (`rustService.ts` loads it, `optimizer.ts` adapts JS to/from wasm JSON). | May import `lib`/types and the wasm module. No Vue. Components and composables depend on it, never the reverse. |
| Composables (`composables/`, `box/`, `box/three/`) | Vue-reactive glue: wrap pure `lib` functions as refs/computed and own effects (watchers, timers, listeners, localStorage, clipboard, WebGL lifecycle). | May import `lib/`, `services/`, `stores/l10n`, and `vue`. `t()` is injected as a parameter into composables that should stay testable. Leaf composables do not import the page-level aggregator. |
| Pages and components (`pages/`, `components/`) | Presentation only: bind composable refs to the template, render SVG via a sub-component, dispatch events. | May import composables, components, stores, `lib` types. No persistence, history, export-serialization, or geometry logic inline. Pages do not import each other. |

### 3.2 Dependency rules

1. Dependencies point inward only: `pages -> composables -> services/lib -> types`. Nothing in `lib/` or `services/` may import `vue`, a component, a composable, or a store.
2. `lib/` modules take locale strings as parameters and never call `t()` or import `stores/l10n`. The l10n function is injected into composables as an argument.
3. Box geometry (`box/geometry.ts`) stays free of three.js, colors, and i18n. three.js lives only under `box/three/`. Colors live only in `lib/palette.ts`. Box piece identity is a `PieceId` enum, not a translated label.
4. Pages contain no persistence, history, export-serialization, drag-reorder, or SVG-generation logic inline. Those live in composables (effectful) or `lib` (pure).
5. Two pages never import each other. Shared behavior goes through a composable (`useToast`, `useKeyboardShortcuts`, `downloadFile`) or a `lib` module.
6. Every new `lib/` module ships with a co-located vitest in the same PR. Composables extracted from `Home.vue` must have their underlying pure logic covered by `lib` tests before the extraction PR, since the Vue wiring itself stays untested.

### 3.3 Modules to introduce

| Path | Responsibility | Depends on |
|------|----------------|------------|
| `lib/downloadFile.ts` | Generic `downloadFile(name, content, mime)` blob/anchor/revoke helper. | none |
| `lib/palette.ts` | Single home for `PIECE_COLORS`, `SHELF_COLORS`, `SHELF_EDGE_COLORS` plus indexed accessors. | none |
| `lib/sheetSvg.ts` | Pure builder of the on-screen sheet view-model / SVG from a `Sheet` (scale, grain lines, rects, badges, labels) with shared `escapeXml`. | `services/types`, `lib/palette` |
| `components/SheetCard.vue` | Render one sheet from a `CuttingResult` using `sheetSvg` + selection state. | `lib/sheetSvg`, `vue` |
| `composables/useToast.ts` | Shared toast: message ref + `showToast(msg, ms?)` with timer cleanup. | `vue` |
| `composables/useKeyboardShortcuts.ts` | Register a key-to-action map on keydown, skip inputs, clean up on unmount. | `vue` |
| `composables/useHomeProject.ts` | Own persistent project state (sheet params, kerf, pieces, price, currency) as refs; `currentState()`/`applyState()`; debounced save/load + share-link load. | `lib/homeState`, `lib/shareLink`, `vue` |
| `composables/useHomeHistory.ts` | Reactive undo/redo over `lib/history`: snapshot coalescing, restoring guard, `doUndo`/`doRedo` via callbacks. | `lib/history`, `lib/homeState`, `vue` |
| `composables/useProjectSnapshots.ts` | Reactive wrapper over `lib/projectSnapshots` (named saved projects): list, save, load, delete, persisted to localStorage. | `lib/projectSnapshots`, `vue` |
| `composables/usePieceList.ts` | Piece CRUD + color allocation + search/sort/bulk-edit via `lib/pieceEditor`: add, import, remove, duplicate, clear, reorder, sort, query. Owns `colorIdx`. | `lib/pieceOps`, `lib/pieceEditor`, `lib/parsePieceList`, `lib/palette`, `services/types`, `vue` |
| `box/usePieceCatalog.ts` | Build box piece specs keyed by a `PieceId` enum, then map id to label via injected `t` and id to color via `lib/palette` at the edge. | `box/geometry`, `lib/palette`, `vue` |
| `box/three/useThreeScene.ts` | Shared three.js lifecycle: scene/camera/renderer/controls, resize, render loop, and a `dispose()` that traverses the graph via `panelMesh.disposeObj`. | `three`, `box/three/panelMesh` |

## 4. Phased refactoring plan

Each phase is a safe, independently shippable PR that preserves behavior, fits
the version-bump CI gate, and is verified before merge. Status and ordering are
tracked in [recommendation.md](recommendation.md).

### Phase 0 - Free wins, zero behavior change
- Goal: remove dead weight and de-duplicate trivially.
- Steps: remove `jspdf` and `svg2pdf.js` from `package.json` (no `src` imports);
  add `lib/downloadFile.ts` (+ test) and replace the inline `downloadFile`
  (Home.vue) and `downloadSvg` (BoxBuilder.vue) with it.
- Risk: very low (pure deletions and a like-for-like swap).
- Verified by: vitest incl. the new test, build, one SVG-export smoke per page.

### Phase 1 - Consolidate palette and extract the sheet SVG
- Goal: one color source and a tested sheet-SVG builder behind a component.
- Steps: add `lib/palette.ts` (+ tests) and route existing usages through it; add
  `lib/sheetSvg.ts` (+ tests, including a label with `<` and `&`); introduce
  `components/SheetCard.vue` and replace the inline SVG block in `Home.vue`.
- Risk: medium (the inline SVG is visually load-bearing; a view-model regression
  is visible).
- Verified by: `sheetSvg` tests; side-by-side visual parity for a sample layout;
  selection highlight still toggles.

### Phase 2 - Extract shared UI composables
- Goal: move toast and keyboard handling out of both pages.
- Steps: add `composables/useToast.ts`; add `composables/useKeyboardShortcuts.ts`
  taking a key-to-action map with an input-field guard and unmount cleanup; rewire
  both pages to declare maps instead of if-else chains.
- Risk: low-medium (the input-field guard and ctrl/meta combos must be preserved
  exactly so typing is not hijacked).
- Verified by: a dispatch + input-skip unit test; manual shortcut pass on both pages.

### Phase 3 - Extract Home persistence, history, and snapshots composables
- Goal: make the most fragile, untested orchestration testable and isolated.
- Steps: confirm `lib/homeState`, `lib/history`, and `lib/projectSnapshots` cover
  the relied-on semantics; add `composables/useHomeProject.ts`,
  `composables/useHomeHistory.ts`, and `composables/useProjectSnapshots.ts`
  (wrapping the already-pure `projectSnapshots` from #65); rewire `Home.vue`,
  keeping the single watcher that calls save + record.
- Risk: high (undo/redo timing depends on the restoring guard and `nextTick`).
- Verified by: a focused history test (record, undo, redo, restore does not
  self-record); manual edit/undo/redo/reload/open-share-link/save-named-project
  sequence.

### Phase 4 - Extract the piece-list composable
- Goal: centralize piece CRUD, color allocation, import, duplicate, reorder, and
  the #65 search/sort/bulk-edit operations.
- Steps: move those into `composables/usePieceList.ts`, delegating to
  `lib/pieceOps`, `lib/pieceEditor`, `lib/parsePieceList`, `lib/palette`; keep
  drag-state refs in the page as UI transients, but the mutations call the
  composable.
- Risk: medium (color cycling, duplicate-after-source order, reorder index math).
- Verified by: existing `pieceOps`/`pieceEditor` tests; manual
  add/import/duplicate/sort/search/drag checks.

### Phase 5 - Decouple box geometry from i18n and color
- Goal: remove label matching and hardcoded palettes from `useBoxModel`.
- Steps: add `box/usePieceCatalog.ts` with a `PieceId` enum and id-keyed specs;
  refactor `allPieces`/`galPieces`/`pieceData` to consume the catalog by id;
  leave `geometry.ts` untouched.
- Risk: medium (the id mapping must reproduce the exact same pieces, order, and
  rotation detection).
- Verified by: geometry golden snapshots unchanged; a catalog test asserting
  locale-independent ids; manual RU/EN render parity and SVG download.

### Phase 6 - Optional: share a three.js base and fix disposal
- Goal: stop the WebGL leak and reduce scene duplication, only if usage justifies it.
- Steps: make both scenes' `dispose()` traverse the graph via
  `panelMesh.disposeObj` (small, high-value, can ship alone); only then, if still
  worth it, extract `box/three/useThreeScene.ts` for the shared boilerplate.
- Risk: medium for the extraction, low for the disposal fix alone.
- Verified by: `renderer.info.memory.geometries/textures` stay flat across repeated
  param changes and navigation; visual parity of explode and gallery.

## 5. Biggest wins

1. Extracting `Home.vue` persistence + undo/redo + snapshots into composables (Phase 3): the highest risk-reduction per line moved, turning the most fragile untested code into isolated, testable units. Most urgent now that #65 doubled the page.
2. A tested `lib/sheetSvg.ts` behind `SheetCard.vue` (Phase 1): removes the largest template block from the page.
3. Decoupling box geometry from i18n matching (Phase 5): eliminates a latent bug where changing a translation silently breaks piece matching.
4. `lib/palette.ts` + `lib/downloadFile.ts` (Phases 0-1): kill duplicated arrays and wrappers at near-zero risk.
5. Fixing three.js disposal (Phase 6): a small change that stops a real WebGL leak.

## 6. Non-goals (deliberately avoided over-engineering)

For a niche, static, single-developer app, the following were proposed by
individual critics and explicitly rejected by the synthesis:

- No `ProjectState`/`ProjectModel` class or a `domain/` layer. Plain refs plus
  `currentState()`/`applyState()` backed by the existing `lib/homeState` are enough.
- No command-based undo. Snapshots are simple and fast at this data size.
- No Pinia or a heavier i18n library. The hand-rolled bilingual dictionary with a
  parity test is adequate; renaming `stores/l10n.ts` to `i18n.ts` is optional churn.
- No reorganization into `features/cutting-optimizer` / `features/box-builder`
  folders, and no renaming of `Home.vue`/`BoxBuilder.vue`. Folder churn just
  creates diff noise.
- No speculative split of the three.js scenes into
  `useThreeScene` + `useAnimation` + `useInteraction`. Fix the disposal leak first;
  extract a shared base only when a concrete second consumer appears.
- No lazy/dynamic imports for export/share/import modules. The bundle is small and
  these are pure TS; deferring them adds async complexity for negligible gain.
- No global toast plugin, keyboard-shortcut registry UI, or generic reactive
  `BoxParams` wrapper. A plain `useToast` and a plain key-to-action map cover both pages.
- No attempt to unit-test Vue component wiring. Push logic down into `lib` and
  composables that can be tested directly; leave the thin template layer to manual
  smoke checks.

---

Generated from a ten-lens architecture review (SRP, coupling, cohesion, layering,
testability, state/data-flow, DRY, abstraction, naming, bundle) and a synthesis
pass. Treat this as a living document: update it, and the status in
[recommendation.md](recommendation.md), as phases land.
