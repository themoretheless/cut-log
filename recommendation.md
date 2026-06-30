# CutLog recommendations: what to do next

The operational checklist for the refactoring described in
[ARCHITECTURE.md](ARCHITECTURE.md). That document is the rationale (why, target
model, dependency rules); this one is the ordered to-do with status. Keep the two
in sync: the phase names and order here are the same spine.

Baseline: version 0.1.38 (after PR #65, which grew `Home.vue` to ~1907 lines).
Progress so far: 0 of 6 phases done.

Two things live here: the **phased refactoring plan** (structural, below) and a
**ranked top-50 audit** of concrete issues found by a ten-reviewer pass (bugs,
security, accessibility, i18n, performance), in the
[Top 50 issues](#top-50-issues-audit) section, plus a deeper second-wave
addendum (issues 51-73) and a third wave (issues 74-83). The phases address the
structural items; many audit issues are standalone fixes that can ship
independently. The master roadmap and the idea/suggestion backlog live in
[plan.md](plan.md).

## How to work this list

- One phase per pull request. Each phase is behavior-preserving and shippable on
  its own; do not batch phases.
- Follow the repo flow: branch, implement, `npx vue-tsc --noEmit`, `npx vitest run`,
  `npm run build`, bump `version.json`, open a PR, let the single `build` check
  pass, squash-merge, then sync `main`.
- Pure logic goes in `lib/*` with a co-located `*.test.ts` in the same PR. The
  Vue wiring (composables, components) is verified by build, type-check, the lib
  tests it leans on, and a short manual smoke check, since the wiring itself is
  not unit-tested.
- Respect the dependency rules in ARCHITECTURE.md section 3.2 (dependencies point
  inward only; no `vue` import inside `lib/`).

## Status

| # | Phase | What lands | Risk | Status |
|---|-------|-----------|------|--------|
| 0 | Free wins | drop `jspdf`/`svg2pdf`; `lib/downloadFile.ts` (+test); use it in both pages | very low | TODO |
| 1 | Palette + sheet SVG | `lib/palette.ts`, `lib/sheetSvg.ts` (+tests), `components/SheetCard.vue` replaces inline SVG | medium | TODO |
| 2 | Shared UI composables | `composables/useToast.ts`, `composables/useKeyboardShortcuts.ts` | low-medium | TODO |
| 3 | Persistence + history + snapshots | `useHomeProject`, `useHomeHistory`, `useProjectSnapshots` (wrap #65 `projectSnapshots.ts`) | high | TODO |
| 4 | Piece list | `usePieceList` (wrap `pieceOps` + #65 `pieceEditor.ts`) | medium | TODO |
| 5 | De-i18n box geometry | `box/usePieceCatalog.ts` with a `PieceId` enum; refactor `useBoxModel` | medium | TODO |
| 6 | three.js disposal (+ optional base) | dispose-traverse fix; optional `box/three/useThreeScene.ts` | low / medium | TODO |

Recommended order: 0, then 1, then 3 (highest value, do before 4), then 2, 4, 5,
and 6 last (6 is optional, but the disposal fix alone is cheap and worth doing
any time).

## Next action: Phase 0

1. Remove `"jspdf"` and `"svg2pdf.js"` from `frontend/package.json` dependencies
   (confirmed unused: no `import` of either anywhere in `frontend/src`). Run
   `npm install` so the lockfile updates.
2. Create `frontend/src/lib/downloadFile.ts` exporting
   `downloadFile(name: string, content: string, mime: string): void` (the
   blob/object-URL/anchor/click/revoke sequence), with a small test that asserts
   the anchor `download` name and that the object URL is revoked.
3. Replace the inline copy in `Home.vue` (around the export functions) and the
   `downloadSvg` in `BoxBuilder.vue` with calls to the shared helper.
4. Bump `version.json`, run the full gate, ship.

Definition of done: `vue-tsc` clean; `vitest` green including the new test;
`vite build` clean; no `jspdf`/`svg2pdf` in `package.json`; one SVG export still
downloads correctly on each page.

## Verification per later phase

- Phase 1: `sheetSvg` unit tests (including a label with `<` and `&`); visual
  parity of `SheetCard` against the old inline SVG for a sample layout; selection
  highlight still toggles.
- Phase 2: a dispatch + input-field-skip unit test for `useKeyboardShortcuts`;
  manual pass of every shortcut on both pages (Enter adds only outside inputs,
  Ctrl+Enter calculates, Ctrl+Z/Y undo/redo, Ctrl+D duplicates, Esc clears,
  arrows navigate the gallery).
- Phase 3: a focused test that record -> undo -> redo -> restore does not
  self-record; manual edit/undo/redo, reload from localStorage, open a share
  link (hash stripped), save and reload a named project.
- Phase 4: existing `pieceOps`/`pieceEditor` tests stay green; manual
  add/import/duplicate/sort/search/drag-reorder checks.
- Phase 5: geometry golden snapshots unchanged; a catalog test that ids are
  locale-independent; manual RU and EN parity of box pieces, gallery, cut sheet,
  and SVG download.
- Phase 6: `renderer.info.memory.geometries`/`textures` stay flat across repeated
  box-param changes and navigate-away-and-back; visual parity of explode and ring.

## Fixed

Resolved items, removed from the active lists below (numbers are the stable audit ids):

- **#7 - CSV formula injection** (`lib/piecesCsv.ts`): formula-lead labels are neutralized with a leading quote. Shipped in #69.
- **#2 - calculate() error handling** (`Home.vue`): wrapped in try/catch, resets state and shows an error toast on failure. Shipped in #70.
- **#3 - WASM init never reset on failure** (`services/rustService.ts`): `initPromise` is cleared on error so the next call retries. Shipped in #70.
- **#4 - WASM output untyped/unguarded** (`services/optimizer.ts`): typed `RawOutput` interfaces, parse wrapped in try/catch, array-shape guard. Shipped in #70.
- **#51 - calculate() result race**: a monotonic generation id discards superseded runs. Shipped in #70.
- **#52 - unbounded piece count** (`lib/homeState.ts`): parseHomeState caps the list at 1000. Shipped in #71.
- **#18 - unbounded label length** (`lib/homeState.ts`, Home.vue): label sliced to 200 at parse, plus `maxlength` on the inputs. Shipped in #71.
- **#40 - currency control/bidi characters** (`lib/homeState.ts`): currency whitelisted to letters / currency symbols / dot. Shipped in #71.
- **#14 - drag-reorder under filter/locked** (`lib/pieceOps.ts`, Home.vue): the locked-aware reorder is now a pure, tested `reorderByDrag`. The drag handlers already bound absolute indices, so the wrong-piece risk was overstated; this pins the behavior with tests. Shipped in #72.
- **#53 - numbers not validated finite/positive** (`lib/validatePiece.ts`, Home.vue): validateNewPiece now rejects NaN/Infinity dims and quantity, and calculate() refuses non-finite/non-positive sheet dims before the WASM call. Shipped in #75.
- **#54 - validateNewPiece ignores kerf** (`lib/validatePiece.ts`): the fit check now compares width+kerf / height+kerf in both orientations. Shipped in #75.
- **#74 - imported pieces bypass validateNewPiece** (Home.vue): importPieces validates each row (kerf-aware) and skips invalid ones with a count in the toast. Shipped in #75.
- **#12 - keyboard shortcuts hijack typing** (`lib/keyboard.ts`, Home.vue): a tested `isEditableTarget` guard (incl. contentEditable) now lets inputs handle Enter and their own Ctrl+Z/Y/D natively; only Ctrl+K and Ctrl+Enter stay global. Shipped in #73.

## Top 50 issues (audit)

Ranked output of a ten-reviewer audit (correctness, security, error-handling,
performance, architecture, dead-code, duplication, testing, type-safety, a11y,
i18n), deduped from 101 raw findings (originally 14 high, 25 medium, 11 low; no
criticals). These are findings to triage; the high-severity ones were
spot-checked against the code. A `(Phase N)` tag marks issues the phases above
already address; the rest are standalone fixes. Locations are approximate and
may drift as code changes.

Item numbers are stable ids: a missing number means the item is fixed and moved
to the [Fixed](#fixed) section. Resolved so far: #2, #3, #4, #7, #12, #14, #18, #40, #51, #52, #53, #54, #74.

### High (8)

1. **three.js scenes leak GPU memory on dispose** [performance] `box/three/useAssemblyScene.ts:284-294`, `usePieceGallery.ts:309-322`. dispose() calls only `renderer.dispose()` and never traverses the groups, so geometries/materials/sprite textures stay in WebGL memory and accumulate on rebuilds. Fix: clearGroup/disposeObj every group first. (Phase 6)
5. **Deep watcher fires save + history on every keystroke** [performance] `Home.vue:1081-1084`. Deep watch on `pieces` re-runs on each character typed, writing localStorage and snapshotting per keystroke and muddying the undo stack. Fix: drop `deep`, trigger save/record from real mutation handlers. (relates to Phase 3)
6. **God component Home.vue (~1907 lines)** [architecture] `Home.vue:1-1908`. UI, persistence, history, snapshots, export, commands, sort/filter, and bulk transforms over shared mutable state; untestable. Fix: extract composables and modules. (Phases 3-5)
8. **Box piece identity matched by translated label** [correctness] `box/useBoxModel.ts:77-90`. `pieceData()` compares against `t()` labels; a translation edit, a language switch, or an old saved label falls through to wrong geometry silently. Fix: match on a stable `pieceKind` enum. (Phase 5)
9. **Dimension field labels not associated with the input** [a11y] `Home.vue` form rows, `BoxBuilder.vue:97-129`. `<label>` and NumberField are siblings with no `for`/`id`, and even nested the first labelable descendant is NumberField's "minus" button, so the number input is unlabeled. Fix: expose an `id` on NumberField's input and use `for`/`id`.
10. **No keyboard alternative to drag-drop reorder** [a11y] `Home.vue:1474-1540`. Reordering is drag-only; keyboard and AT users cannot reorder. Fix: Alt+ArrowUp/Down on focused rows with an ARIA live announce.
11. **Layout SVGs have no accessible names** [a11y] `Home.vue:1642-1763`, `BoxBuilder.vue:159-221`. Placed-piece rects/text have no `title`/`desc`/`role`. Fix: `role="img"` plus per-piece `title`/`desc`.
13. **No round-trip test for the label-based piece matching** [testing] `box/useBoxModel.ts:77-90`. Nothing feeds every `allPieces()` label back through `pieceData()`, so a label change ships broken. Fix: add that round-trip test. (Phase 5)

### Medium (24)

15. **localStorage.setItem failures swallowed** [error-handling] `Home.vue:172-176`. QuotaExceeded and private-mode errors are discarded; the user silently stops persisting. Fix: detect quota and warn.
16. **Palette command errors dropped** [error-handling] `Home.vue:904-908`. `runPaletteCommand` has no catch and the caller does not await. Fix: try/catch + error toast + await.
17. **Imported/shared quantity reaches optimizer unvalidated** [correctness] `services/optimizer.ts:20-28`. `0`/`-1`/`0.5`/`NaN` from a link or paste hit the Rust packer. Fix: `Math.max(1, Math.round(q))` before serializing.
19. **useBoxModel injects t() into geometry logic** [architecture] `box/useBoxModel.ts:23,78-109`. Couples geometry to the l10n store. Fix: pass a kind enum, localize labels in the component. (Phase 5)
20. **colorIdx is module-level mutable, not restored on undo** [correctness] `Home.vue` (several sites). The color counter desyncs after undo/redo/import. Fix: store it in state or derive color from array position.
21. **labelMatCache materials/textures never disposed** [performance] `box/three/useAssemblyScene.ts:38-62,284`. Cached SpriteMaterial + CanvasTexture grow unbounded. Fix: dispose and clear the cache in `dispose()`. (Phase 6)
22. **Dates and costs ignore the app language** [i18n] `Home.vue:623,1601-1609`. `toLocaleString`/`toFixed` use the browser locale, not RU/EN. Fix: pass `ru-RU`/`en-US` and use `Intl.NumberFormat`.
23. **CSV header hardcoded English** [i18n] `lib/piecesCsv.ts:14`. RU users get English columns. Fix: translate the header or document it as a stable machine format for re-import.
24. **BoxBuilder stats use positional {0}/{1} replace** [i18n] `BoxBuilder.vue:194-198`. Fragile if placeholder order differs between locales. Fix: named-parameter interpolation.
25. **Currency, separator, and empty-label fallback hardcoded** [i18n] `Home.vue:60`, `exportLayout.ts:28,55`. Ruble, multiply sign, and dash regardless of language. Fix: derive from `lang` and translation keys.
26. **Command palette has no arrow-key navigation** [a11y] `Home.vue:915-923`. Only Enter/Escape; can only run the first match. Fix: ArrowUp/Down highlight and run the highlighted command.
27. **Clickable spans/divs/rects instead of buttons** [a11y] `Home.vue:1492,1672-1683`, `BoxBuilder.vue:154-170`. No focus or keyboard. Fix: real `<button>` or `role="button"` + tabindex + key handlers.
28. **3D canvases have no accessible label** [a11y] `BoxBuilder.vue:145,181`. Visual-only meaning. Fix: `aria-label` plus a shortcut-hints region.
29. **Inline piece-editor fields lack labels** [a11y] `Home.vue:1493-1527`. Per-row inputs are unlabeled. Fix: an `aria-label` per field.
30. **Render loop runs while the tab is hidden** [performance] `box/three/useAssemblyScene.ts:120-140`. Burns GPU/battery offscreen. Fix: pause on `visibilitychange`.
31. **Duplicate blob-download helper in both pages** [duplication] `Home.vue:433`, `BoxBuilder.vue:64`. Maintained twice. Fix: shared `downloadFile(name, content, mime)`. (Phase 0)
32. **TrackballControls internals via `as any`** [type-safety] `usePieceGallery.ts:116-133,266-268`. Reads `_position0` etc.; a three.js rename breaks silently. Fix: one typed accessor.
33. **validPiece/validSnapshot take `any`** [type-safety] `homeState.ts:36`, `projectSnapshots.ts:25`. A typo'd property compiles. Fix: take `unknown` and narrow.
34. **t() accepts any string** [type-safety] `stores/l10n.ts`. Typo'd or removed keys render the raw key. Fix: type keys as a union.
35. **cleanText replaces non-string ids with a new UUID** [correctness] `lib/projectSnapshots.ts:35`. A numeric id loses its reference. Fix: `String(value.id)` first.
36. **Auto-backup empty-list paths untested** [error-handling] `Home.vue:387,406,696-707`. A destructive op on an already-empty list silently skips backup. Fix: test the empty/non-empty backup behavior.
37. **restoreSnapshot relies on a bypassable `restoring` flag** [correctness] `Home.vue:267,285-304`. A new `applyState` path or a pre-nextTick watcher can record the restore into undo. Fix: scope the guard in a `withHistoryGuard()` helper and test it.
38. **Bulk-transform summaries diverge under a filter change** [correctness] `Home.vue:775-825`. Reads the visible set twice; a mid-op filter change misreports counts. Fix: snapshot the target set once and test it.
39. **l10n parity test ignores placeholder counts** [testing] `stores/l10n.parity.test.ts`. A `{0}`/`{1}` mismatch between locales passes. Fix: assert matching `{N}` placeholders across locales.

### Low (10)

41. **ResizeObserver has no zero-size guard** [error-handling] `useAssemblyScene.ts:142-152`, `usePieceGallery.ts:146-155`. A 0-size container yields a NaN camera aspect. Fix: guard `w > 0 && h > 0`.
42. **validSnapshot can pass undefined state to serialize** [correctness] `projectSnapshots.ts:52-54`. An undefined `state` stringifies to invalid JSON that fails on load. Fix: reject when `state` is missing or not an object.
43. **makeLabel calls t() per loop iteration** [correctness] `useAssemblyScene.ts:265-273`. Stale shelf labels on a runtime locale change. Fix: hoist the label before the loop. (Phase 5/6)
44. **costPerPart shows float artifacts** [correctness] `lib/costSummary.ts:32`. Unrounded division. Fix: round to 2 decimals.
45. **pieceMatchesQuery toFixed(0) rounding mismatch** [correctness] `lib/pieceEditor.ts:39-40`. Search may not match the displayed value. Fix: `String(Math.round(...))`.
46. **shelfColor undefined for a negative index** [error-handling] `box/useBoxModel.ts:73-74`. `i % len` is negative for negative `i`. Fix: `((i % len) + len) % len`.
47. **Clipboard fallback shows a success toast on failure** [error-handling] `Home.vue:475-486`. Misleads the user into thinking the link was copied. Fix: distinct toasts for real copy vs address-bar fallback.
48. **Unused jspdf/svg2pdf dependencies** [dead-code] `package.json:13-14`. Roughly 200KB of footprint, never imported. Fix: remove them. (Phase 0)
49. **Color palettes scattered with no shared source** [duplication] `helpers/svg.ts`, `box/useBoxModel.ts`. No single palette to keep the two pages consistent. Fix: consolidate into `lib/palette.ts`. (Phase 1)
50. **readinessScore is opaque magic numbers, untested** [architecture] `Home.vue:535-545`. Inline `30/18/12/18/24` deductions with no constants or tests. Fix: extract a pure `scoreReadiness()` into `lib/readiness.ts` with tests.

## Second wave: additional issues (deduped vs the top 50)

A deeper second audit pass (ten reviewers over the Rust optimizer, the WASM/build
boundary, numerical edge cases, CSS, async timing, security/DoS, persistence, and
test quality). It mostly re-confirmed the top-50 criticals (omitted here), which
is a good signal those are real; below are only the genuinely new findings. With
both passes, the audit is considered complete for the current code; further
issues will surface as code changes.

### Medium (12)
55. **Optimizer expands quantity with no total-count guard (Rust OOM)** [error-handling] `crates/core/src/optimizer.rs:236`, `crates/wasm/src/lib.rs:112-116`. `repeat_n(p, quantity as usize)` on an untrusted u32 can materialize billions of entries and hang the WASM thread. Fix: clamp quantity and the total expanded count after deserialization.
56. **Export SVG fill color not hex-validated on the WASM path** [security] `lib/exportLayout.ts:51`. Synthetic pieces built from raw WASM `source_color` (optimizer.ts) bypass the `isHexColor` gate; export only `escapeXml`s it, so `url(...)`/malformed colors pass through. Fix: validate against the hex regex and fall back to a default.
57. **Snapshot fallback aliases live state** [data-integrity] `lib/projectSnapshots.ts:69`. `parseHomeState(serialize(state)) ?? input.state` returns the caller's live object by reference on parse failure, so later edits mutate the stored backup. Fix: drop the fallback (or structuredClone) so a snapshot never aliases live state.
58. **Auto-backup taken after mutation on some delete paths** [correctness] `Home.vue` clearAll/removePiece. If the backup runs after the splice, undo loses the pre-delete list. Fix: always snapshot strictly before mutating, with a test.
59. **partsList groups by rounded dimensions** [correctness] `lib/exportLayout.ts:22-36`. The key `${label}|${round(w)}x${round(h)}` merges distinct sizes that round alike, misreporting size and per-size quantity. Fix: key on unrounded dimensions, round only for display.
60. **costSummary wasteCost double-counts** [correctness] `lib/costSummary.ts:34-37`. `totalCost * (1 - usedFraction)` mixes whole-sheet pricing with area waste and will not reconcile with `totalCost - usefulCost`. Fix: define wasteCost as totalCost minus placed-area value, or drop the metric.
61. **DXF export has no HEADER/TABLES section** [correctness] `lib/exportLayout.ts:73-100`. Entities-only DXF declares no units; stricter CAM tools reject it or import at the wrong scale. Fix: emit a minimal HEADER (`$INSUNITS=4`, extents) and a TABLES layer-0 section.
62. **BoxParams has no thickness-fits-box validation** [numerical] `box/geometry.ts:25-26`. When `t >= w/2` or `t >= h/2`, `wi`/`hi` go zero/negative and produce degenerate contours and broken 3D. Fix: validate/clamp `0 < t < min(w,h)/2` before generating geometry.
63. **Negative tab/shelf gaps when counts exceed length** [numerical] `box/geometry.ts:31-37,48-57`. `gap=(L - n*tabH)/(n+1)` goes negative once the count does not fit, marching positions backward into self-intersecting paths. Fix: cap nTab/nShelves to what fits, or clamp gap and bail to empty.
64. **svgScale/sheetScale divide with no near-zero floor** [numerical] `box/geometry.ts:213-214`, `Home.vue` sheetScale. A tiny/zero dimension makes the scale explode and overflow the canvas. Fix: clamp the denominator to a small positive floor.
65. **BASE_URL wasm path has no fallback** [build] `services/rustService.ts:16`. A base/path mismatch 404s the `.wasm`, and (with the cached-rejection bug) kills the optimizer with only a console error. Fix: on init failure retry once with an origin-relative URL.
66. **Version drift across manifests** [build] `version.json` vs `crates/wasm/Cargo.toml`, `frontend/package.json`. Only `version.json` is bumped; the crate/package versions are stale. Fix: a CI check that asserts they match (or derive them).

### Low (7)

67. **sortPiecesForEditor comparator is not stable** [correctness] `lib/pieceEditor.ts:85-96`. Ties in area/quantity sorts shuffle equal-key pieces, polluting undo with no-op reorders. Fix: add a deterministic secondary key (piece id).
68. **copyShareLink fallback hijacks the address bar** [correctness] `Home.vue:475-486`. On clipboard failure it `history.replaceState`s a multi-KB hash and still toasts "copied". Fix: show a manual-copy message and do not claim success.
69. **Rust packer fit checks use bare f64 comparisons** [numerical] `crates/core/src/optimizer.rs:335-338,408-418`. Accumulated rounding can reject a piece that exactly fits. Fix: compare with a small epsilon consistently.
70. **compose() can panic via expect** [error-handling] `crates/core/src/optimizer.rs:84-89`. A future strategy added to one enum but not the table panics in WASM. Fix: return a default/Option, or assert ALL_STRATEGIES is exhaustive in a test.
71. **makeLabel renders text to a fixed 256px canvas with no bound** [correctness] `box/three/useAssemblyScene.ts:41-69`. Long localized labels overflow/clip, and the never-disposed cache can grow across a session. Fix: measure/clamp the text and bound the cache.
72. **Error toasts use role=status (polite)** [a11y] `Home.vue` toast. Failures may not be announced before the 2.2s node is removed. Fix: role=alert for error/critical toasts.
73. **CI wasm copy does not verify required files** [build] `.github/workflows/build.yml:107-111`. A wasm-pack output rename would ship a broken `frontend/wasm` with a green build. Fix: assert the expected files exist after copy and fail otherwise.

## Third wave: additional issues (deduped vs the first 73)

A 12-domain survey raised 18 candidate new issues; 8 overlapped items already listed in the earlier waves and were dropped, leaving 10 genuinely new ones. Same stable-id scheme; locations approximate.

### Medium (3)

75. **galPieces[galIdx] dereferenced without bounds guard crashes the box page** [correctness] `frontend/src/pages/BoxBuilder.vue:150 (template), and :74-76 (galDlSvg)`. galIdx (useBoxModel.ts:41) is a free ref with no clamp watcher. galPieces is a computed whose length shrinks when NShelves or Bevel change (e.g. several per-shelf entries collapse). If the user selects a high index (shelf #5) then reduces NShelves, galIdx stays stale. The template at line 150 reads galPieces[galIdx].title / .count / .pw.toFixed(0) with NO optional chaining, so an out-of-range galIdx throws during render and breaks the page. galDlSvg (line 76) has the same unguarded p.id/p.d access. The 3D scene path (useAssemblyScene.ts:193) already uses ?. and is safe, which shows the inconsistency. Fix: Clamp galIdx whenever galPieces changes: a watch(() => galPieces.value.length, n => { if (galIdx.value >= n) galIdx.value = Math.max(0, n - 1) }) in useBoxModel, or guard the template with v-if="galPieces[galIdx]".
76. **CSV round-trip loses the per-piece rotation lock** [correctness] `frontend/src/lib/piecesCsv.ts:25-38, frontend/src/lib/parsePieceList.ts:11-16,71-74, frontend/src/pages/Home.vue:371-373`. buildPiecesCsv exports rotation as column 5 (0/1), and parseLine reads cells as a flat number list where nums[2] becomes quantity and the 5th value (rotation flag) is ignored. ParsedRow has no allowRotation field, and importPieces hardcodes true at Home.vue:373. So exporting a piece with allowRotation=false and re-importing the CSV silently re-enables rotation. A full export->import round-trip changes packing behavior. Verified across all three files. Fix: Add optional allowRotation to ParsedRow; in parseLine capture the trailing 0/1 column (distinct from quantity) and map 0->false; in importPieces use r.allowRotation ?? true.
77. **WASM malformed-input fallback silently returns an empty result** [error-handling] `crates/wasm/src/lib.rs:107-110`. run_optimize does serde_json::from_str(...).unwrap_or_else(|_| default {2440x1220, pieces:[]}). Any malformed payload (including a NaN dimension, which JSON.stringify in optimizer.ts:34 serializes as null and serde cannot parse into f64) is swallowed and replaced by an empty default, so the frontend receives a valid-looking empty result instead of an error. The frontend's own shape check (optimizer.ts:56) passes because the default is well-formed, so the failure is invisible to the user. Fix: Make run_optimize return Result and have the wasm_bindgen wrappers surface Err(JsValue) on parse failure; let optimizer.ts throw so the existing calc-error toast fires. Frontend should also guard non-finite width/height/kerf before stringifying.

### Low (6)

78. **CSV export has no UTF-8 BOM, risking Cyrillic mojibake in Excel** [i18n] `frontend/src/lib/piecesCsv.ts:27-39 (output consumed by the download handler in Home.vue)`. buildPiecesCsv returns plain text with no leading BOM. Excel on Windows defaults to the system ANSI codepage when a CSV lacks a BOM, so Russian piece labels can render as mojibake on open. Verified no U+FEFF prefix is added here or at the download site. Fix: Prepend '﻿' to the CSV string before triggering the download (or add it in buildPiecesCsv).
79. **CI does not compile or test the cli and ui crates** [build/testing] `.github/workflows/build.yml:90-91`. The Rust test step runs `cargo test -p cutter-core` only. The workspace also contains crates/cli and crates/ui (Cargo.toml members). They have no tests today, but `cargo test -p cutter-core` also never COMPILES them, so a type/build error introduced in cli or ui passes CI and only breaks a local/full build. Verified members list and absence of #[test] in cli/ui. Fix: Use `cargo test --workspace` (or at least `cargo build --workspace`) so every crate is compiled in CI.
80. **Test files are excluded from type-checking and vitest does not type-check** [type-safety] `frontend/tsconfig.json:18-19; .github/workflows/build.yml:124-128`. tsconfig.json excludes src/**/*.test.ts (line 19), so the CI `vue-tsc --noEmit` step does not type-check tests. vitest runs via esbuild transpilation, which strips types without checking them. Net effect: a type error in a test (e.g. a test calling a refactored function with the wrong argument shape) is caught by NEITHER step and ships green. Verified tsconfig exclude and the two-command CI step. Fix: Add a tsconfig.test.json (or a typecheck-tests script) that includes *.test.ts with DOM/vitest libs and run it in CI alongside vue-tsc.
81. **No vitest config file; tests run on implicit defaults with no coverage gate** [tooling] `frontend/ (no vitest.config.ts; vite.config.ts has no test block)`. Verified neither frontend/vitest.config.ts nor a test section in vite.config.ts exists. Tests run with Vitest defaults: no coverage provider/reporter, no environment pinning, no thresholds. This is fine functionally but blocks adopting coverage gating and makes the test environment implicit/non-reproducible. Fix: Add a vitest.config.ts (or a test block in vite.config.ts) pinning environment, enabling a coverage provider/reporter, and optionally thresholds.
82. **badgeWidth does not size for 3-digit piece indices** [visual] `frontend/src/pages/Home.vue:1019-1020`. badgeWidth(idx) returns 12 for <10 and 16 otherwise, with no case for idx >= 100. Projects can have 100+ distinct pieces (the badge shows the 1-based source index), so the index text overflows the fixed rounded background on the result sheet. Minor cosmetic clipping. Fix: Size by digit count, e.g. return String(idx).length * 5 + 7, or add an idx >= 100 ? 20 branch.
83. **Currency input is not whitespace-trimmed on screen** [ux] `frontend/src/pages/Home.vue:1167`. The currency <input> uses a bare v-model with maxlength=3, allowing a trailing space (e.g. '$ '). homeState.ts trims on persistence, but the visible input keeps the space until a reload, so the displayed value and the stored value disagree and the field looks broken. Verified no trim modifier on the v-model. Fix: Use v-model.trim, or trim in an @input/@change handler so the displayed value matches what gets stored.

## Known doc and code corrections folded in

- The earlier plan claimed Phase 1 fixes an on-screen XML-escape bug. That was a
  false positive: the inline sheet SVG uses Vue `{{ }}` interpolation, which sets
  escaped text content, and the export path already calls `escapeXml`. Phase 1 is
  justified by modularity and de-duplication only. (Corrected in ARCHITECTURE.md.)
- Line counts were refreshed for the post-#65 code (`Home.vue` ~1907 lines).

## Open doc gaps (small, optional)

- `README.ru.md` does not yet carry the Layering section or links to these two
  docs; the English `README.md` does. Sync it when convenient.
