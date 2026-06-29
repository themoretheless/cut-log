# CutLog plan

Master roadmap and idea backlog. Companion docs:

- [ARCHITECTURE.md](ARCHITECTURE.md) - target architecture, dependency rules, the phased refactor.
- [recommendation.md](recommendation.md) - the issue audit (problems), phase checklist, and Fixed log.
- [README.md](README.md) - project overview and build.

## Roadmap (priority order)

1. Finish the high-severity audit fixes (see recommendation.md). Done so far: #2, #3, #4, #7, #12, #14, #18, #40, #51, #52. Remaining high: #5 (deep watcher per keystroke) and the accessibility set (#9, #10, #11, #26-#29).
2. Work the medium/low audit tail plus the third-wave additions (#74-#83 in recommendation.md).
3. Execute refactor phases 0-6 in ARCHITECTURE.md (decompose Home.vue into composables, etc.).
4. Pull from the idea backlog below by value-to-effort, starting with the top picks.

## Top picks (best value-to-effort)

- Add ESLint for code quality
- Add security audit (npm & cargo)
- Add test coverage reporting
- Quantity overflow protection in WASM packer
- Locale-aware number formatting with Intl.NumberFormat
- Round-trip CSV import/export test suite
- Validate imported pieces before adding
- Add visual focus indicators for all interactive elements
- Expose NumberField input id for label association
- Validate sheet dimensions before optimize()
- Export/import named projects as JSON files
- Add tab visibility guard to three.js render loops
- Named-parameter interpolation helper for l10n
- Add Rust clippy linting to CI
- Pre-initialize WASM module on app mount

## Idea / suggestion backlog (167 items)

From a 12-domain survey, deduped. Each item is tagged with value (1-5) and effort (S/M/L). This is a backlog of options, not a commitment; problems to fix live in recommendation.md.

### CI, Tooling and Code Quality (15)

- **Add ESLint for code quality** (v4, M) - ESLint with vue/typescript/recommended rules to catch type/import/naming issues in CI before type-check.
- **Add test coverage reporting** (v4, M) - vitest coverage output (html/lcov) to catch untested code paths; publish as CI artifact or comment on PRs.
- **Add security audit (npm & cargo)** (v4, S) - npm audit + cargo audit in CI to flag known vulnerabilities and keep deps safe.
- **Add vitest configuration file** (v3, S) - Explicit vitest.config.ts with coverage thresholds, reporters, pool, and UI toggles for local dev.
- **Add Rust clippy linting to build.yml** (v3, S) - Run cargo clippy on all crates before tests to catch dead code, inefficient patterns, and style issues.
- **Add Prettier for formatting** (v3, M) - Enforce consistent code style (semicolons, quotes, line length) with pre-commit hook and CI check.
- **Add pre-commit hook framework** (v3, M) - Use pre-commit or husky to run lint/format/test locally before push, preventing CI rework.
- **Add test categorization (unit vs integration)** (v3, M) - Separate test scripts for fast unit tests (lib/*.test.ts) vs slower integration/render tests.
- **Add build artifact size reporting** (v3, M) - CI comment on PRs showing frontend WASM/JS/CSS bundle size deltas to catch regressions.
- **Add smoke test on deployed GitHub Pages** (v3, M) - After deploy, fetch published index.html and verify basic resources load and version is correct.
- **Add Rust formatting check (rustfmt)** (v2, S) - cargo fmt --check to enforce consistent Rust code style and catch it early in CI.
- **Add Node.js version pinning in package.json** (v2, S) - Set engines field to enforce Node 22+ across devs and CI, matching build.yml.
- **Separate Rust test runs per crate** (v2, S) - Run cargo test -p per crate separately to identify which fails faster.
- **Add dependency update policy** (v2, S) - Document frequency, exclusions, and breaking-change thresholds for Renovate/Dependabot.
- **Generate CHANGELOG from commit messages** (v2, M) - Use conventional commits + automatic changelog generation on release to track features/fixes.

### WASM Optimizer Robustness (8)

- **Quantity overflow protection** (v4, M) - Clamp total expanded piece count before repeat_n; if qty * piece_count exceeds threshold (e.g. 100k), warn and cap, preventing WASM thread hang on malicious/accidental u32 max values.
- **Validate sheet dimensions before optimize()** (v3, S) - Assert sheet_width > 0 && sheet_height > 0 and kerf >= 0 at the optimizer entry point; propagate early validation to WASM to catch malformed input before allocation.
- **Epsilon-aware fit comparisons** (v3, M) - Replace bare f64 comparisons in fits_on_blank and find_best_fit with a consistent EPSILON (e.g. 1e-9) to handle accumulated rounding errors in sheet/piece dimensions.
- **NaN and Inf guards on piece dimensions** (v2, S) - In build_queue sort key calculation, guard width/height with is_finite() before arithmetic; return a stable fallback order for any NaN/Inf piece to avoid silent sort corruption.
- **Negative dimension guard in might_fit and fits_on_blank** (v2, S) - After kerf is added (pw = piece.width + kerf), guard against pw < 0 or ph < 0 due to bad float arithmetic; clamp to piece.width if overflow suspected.
- **Compose strategy panics replaced with Option** (v2, M) - Change compose() to return Option<CuttingStrategy> instead of panic on unknown fit/sort pairs; test ALL_STRATEGIES exhaustiveness with a compile-time check or property test.
- **Strategy auto-replay for validation** (v2, S) - In Auto mode, once best is picked, re-run it once more with logging to confirm reproducibility (catching non-deterministic sort bugs or unsafe state mutations).
- **Split free rect algorithm documentation** (v1, S) - Add a diagram or detailed comment in split_free_rect explaining the right-first vs bottom-first heuristic choice and why it prevents excessive fragmentation.

### Optimizer Algorithm and Strategy (12)

- **MaxRects fallback packing strategy** (v4, L) - Implement MaxRects shelf-based guillotine as an optional 10th strategy alongside the current 9, improving efficiency on certain piece distributions without the exhaustive Auto mode cost.
- **Implement progress and cancellation for WASM optimizer** (v3, M) - Add an AbortSignal-based cancel mechanism and progress callback to let users interrupt long optimization runs.
- **Grain-aware rotation scoring** (v3, M) - Extend CutPiece with a grain_direction field (0-3) and add a grain-penalizing term to calc_score; pieces cut along grain cost less waste or get priority.
- **Benchmark regression detection in CI** (v3, M) - Hook the bench.rs example into CI; compute a moving average of median time and efficiency; alert on 10%+ regression to catch algorithm creep.
- **Kerf interaction test matrix** (v3, M) - Add a parametrized test covering kerf values (0, 1, 3, 10, 100) across all 9 strategies on a fixed piece set; assert no unplaced pieces and monotonic efficiency drop.
- **Unplaced piece analysis per strategy** (v2, M) - When Auto runs, log the unplaced set per strategy attempt; detect systematic patterns to guide user UX or hints.
- **Caching intermediate queue for repeated runs** (v2, M) - Cache the three queues (AreaDesc, MaxSideDesc, PerimeterDesc) across strategy trials in Auto mode within a single session to reduce allocation churn.
- **Test round-trip of JSON serde for edge cases** (v2, M) - Add crate tests that serialize/deserialize OptimizeOutput with extreme values (0 width, huge kerf, 1M pieces) to catch silent JSON truncation or precision loss.
- **Instrumentation for free-rect fragmentation metrics** (v2, M) - Track max and average free-rect depth per sheet in tracing spans; expose in logs/telemetry to correlate with efficiency drops.
- **Add WASM-specific end-to-end test suite** (v4, L) - Serialize real home state to WASM, parse output, verify schema/correctness.
- **Rotation constraint propagation hints** (v1, S) - Detect and log when all pieces are rotation-locked and sheet is portrait/landscape-only; suggest pre-filtering by aspect ratio to guide frontend UX.
- **Show raw WASM output summary in developer mode** (v1, M) - Optional debug panel displaying exact Rust packer output (placement order, packing efficiency, strategy trace) for advanced troubleshooting.

### Internationalization and Formatting (15)

- **Locale-aware number formatting with Intl.NumberFormat** (v4, M) - Replace hardcoded toFixed()/toLocaleString() throughout UI and exports with Intl.NumberFormat using app language (ru-RU/en-US) for costs, areas, dimensions, including cached reusable formatters.
- **Named-parameter interpolation helper** (v4, M) - Create a pure interpolate(template, params) supporting {key} syntax to replace fragile positional {0}/{1} chaining.
- **Locale-aware date/time formatting** (v3, M) - Create formatSnapshotDate and formatOperationDate in l10n store using Intl.DateTimeFormat instead of browser locale's toLocaleString().
- **Translate l10n parity test for placeholder counts** (v3, S) - Extend l10n.parity.test.ts to assert {0}..{3} placeholders match count and order across ru/en translations.
- **Print/export documents inherit app locale** (v3, M) - Pass lang to buildPrintHtml and buildLayoutSvg so exported PDFs/SVGs/HTML render in the active language, not browser default.
- **Currency formatting via Intl.NumberFormat** (v3, M) - Create formatCurrency(amount, lang) applying locale-specific decimal/thousand separators and currency symbol placement.
- **Add German and French translations** (v3, L) - Extend l10n store with de and fr object literals, add lang toggle for 4 languages, test parity across all.
- **Percentage formatting respects locale** (v2, S) - Create formatPercent(value, lang) for locale-specific decimal precision and symbol placement for efficiency/yield %.
- **Decimal separator awareness for import/export** (v2, S) - Document and test parsePieceList handles dot (en) and comma (ru/fr); generalize to export format.
- **Numeric locale collation for piece search** (v2, S) - Enhance pieceEditor's localeCompare with numeric: true for natural sort (1, 2, 10 vs 1, 10, 2).
- **Symbol-agnostic multiply/separator characters** (v2, M) - Store separator symbols (x, dot, dash) in l10n store keyed by language, avoid hardcoding in templates.
- **Unit abbreviations in l10n (m2, mm, pcs)** (v2, M) - Move hardcoded m2, mm, pcs into l10n keys so locales define domain-specific unit conventions.
- **Time zone and ISO 8601 in snapshots/operations** (v2, M) - Store createdAt with timezone offset or UTC; format display timestamps as ISO 8601 for reproducibility, localize for UI only.
- **Validate and document CSV import format stability** (v2, S) - Document CSV columns are English and ISO-8601 dates so re-import round-trips across locales; add migration note if format changes.
- **RTL-aware CSS and layout structure** (v1, L) - Prepare for Arabic/Hebrew with lang attribute on html, logical CSS properties (margin-inline, text-align), and RTL direction in l10n.

### Accessibility (14)

- **Add visual focus indicators for all interactive elements** (v4, M) - Ensure all buttons, links, inputs have clear focus-visible indicators consistent with accent color, especially for keyboard-only users.
- **Expose NumberField input element id for form label association** (v4, M) - NumberField should expose an id prop bound to the internal input so form-row labels can use for/id, fixing a11y issue #9.
- **Add accessible names to 3D canvas containers** (v3, S) - BoxBuilder's piece3d-container and box3d-container have no aria-label; add descriptive labels plus a shortcut-hints region explaining mouse/touch/keyboard controls.
- **Implement skip-to-content links** (v3, S) - Add hidden skip links keyboard users can press at page load to jump past navigation to main content (Home list / BoxBuilder 3D).
- **Add real button semantics for gallery navigation** (v3, S) - Gallery thumbs in BoxBuilder use click handlers on divs; use proper button elements with aria-current for the active thumbnail.
- **Enhance empty-state messaging and recovery actions** (v3, S) - Expand empty-state hints with keyboard-friendly primary actions, e.g. 'Add pieces [Enter] or paste a list [Ctrl+V]'; test on small screens.
- **Add sr-only helpers for dynamic status updates** (v3, M) - Create a screen-reader-only announcement utility (e.g. 'piece added', 'layout calculated') for all non-visual feedback.
- **Implement context-sensitive help tooltips** (v3, M) - Add details-based help bubbles or aria-describedby hints for complex fields (kerf width, strategy, transform presets) on both pages.
- **Provide inline error recovery cues** (v3, M) - When validation fails (piece too large), show inline 'Suggest maximum size' button or auto-clamp with notification, not just an error message.
- **Add automatic focus management on modal/dialog open** (v3, M) - When command palette or import modal opens, trap focus and return it to the trigger on close; add aria-label and aria-describedby.
- **Implement accessible tabs for multi-section forms** (v3, L) - Group related Home.vue settings (sheet params, piece form, operations) with a tab interface for better mobile/keyboard navigation.
- **Enhance contrast in disabled button states** (v2, S) - Ensure disabled buttons have a border or distinct background change so they are distinguishable, especially in light theme.
- **Aria labels for numbers and placeholders** (v2, M) - Add aria-label to cost/area inputs with spoken unit context (e.g. 'Price per sheet in rubles') for screen readers.
- **Provide onboarding tooltips for first-time users** (v2, M) - Detect first visit via localStorage and show contextual hints ('Add pieces here', 'Click Calculate', 'Share'); dismiss on first action.

### Performance and Rendering (15)

- **Add tab visibility guard to render loops** (v3, S) - Pause all three.js requestAnimationFrame loops when tab is hidden (visibilitychange) to save GPU/CPU/battery.
- **Lazy-load three.js renderers via Web Worker for 3D** (v4, L) - Move 3D scene init and frame loop to a Web Worker to free main thread and prevent jank during box parameter changes.
- **Virtual scroll large piece lists** (v3, M) - When piece count exceeds ~100, render only visible rows in the piece editor list to maintain 60 FPS during interactions.
- **Pre-initialize WASM module on app mount** (v2, S) - Start WASM init on app mount (not first calculate) so the first optimize call avoids the critical async path.
- **Bundle analysis and code-split routes** (v2, S) - Visualize bundle size (vite-plugin-visualizer), code-split Home and BoxBuilder chunks to reduce initial JS.
- **Use Intl.NumberFormat caching for locale-aware formatting** (v2, S) - Create reusable Intl formatters instead of calling toLocaleString on every render to reduce GC pressure.
- **Debounce piece list re-renders during rapid edits** (v2, M) - Coalesce multiple piece mutations (edits, adds, reorders) into single computed updates to reduce Vue render cycles.
- **Memoize expensive geometry calculations in BoxModel** (v2, M) - Cache allPieces(), computeLayout(), galPieces when parameters unchanged to avoid recalculating on each render.
- **Batch canvas texture updates in label cache** (v2, M) - Track when label materials are no longer visible and clear them from cache to prevent unbounded texture memory growth.
- **Request idle callback for post-interaction work** (v2, M) - Defer non-critical updates (snapshot serialization, operation log writes) to requestIdleCallback to not block user input.
- **Add performance metrics and memory observability** (v2, M) - Log renderer.info.memory, piece count, layout complexity to a non-blocking analytics endpoint for profiling.
- **Reusable SVG export template with streaming writes** (v1, S) - Build large SVGs via streaming builder instead of concatenation to reduce intermediate allocations.
- **Refactor pieceMatchesQuery for large filter sets** (v1, S) - Pre-compile search query regex once, cache case-normalized piece strings to speed repeated filtering.
- **Add requestIdleCallback shim for Safari** (v1, S) - Polyfill requestIdleCallback via setTimeout fallback for older Safari versions that lack it.
- **Optimiser progress indicator for long-running calculations** (v3, M) - Show a spinner or progress bar during calculate() for large piece lists so users know the optimizer is working.

### Import, Export and Data Exchange (19)

- **Round-trip CSV import/export test suite** (v4, M) - Integration tests verifying CSV export -> parse -> import preserves all piece properties (dims, qty, label, rotation flag).
- **Imported pieces validation before adding** (v4, M) - Call validateNewPiece on each imported row to filter/warn on oversized or invalid pieces before adding to list.
- **Named project export (JSON file with metadata)** (v4, M) - Export full project as JSON with name, date, cost, kerf metadata, downloadable and re-importable across devices for versioning, archiving, and migration.
- **SVG/DXF color export validation** (v3, S) - Validate all piece colors against hex regex before exporting to SVG/DXF to catch synthetic pieces with malformed colors.
- **SVG export explicit units metadata** (v3, S) - Add viewBox and explicit unit declaration (mm) to SVG header for reliable CAD tool import at correct size.
- **DXF export units header test** (v3, M) - Test buildLayoutDxf emits valid HEADER with INSUNITS and TABLES section for CAM tool compatibility.
- **Import error per-line feedback** (v3, M) - Show which lines failed to parse and why so user can fix and retry without re-entering all data.
- **Import with duplicate detection** (v3, M) - Preview imported pieces before adding, highlight exact/near-duplicates (within 10mm) for user review.
- **Drag-and-drop import from the piece list (file or text)** (v3, M) - Accept file drops or paste-drops of CSV/text directly onto the piece list to import without opening the modal.
- **Export 3D model formats beyond SVG (GLB/GLTF)** (v4, L) - Support GLB/GLTF export from assembly and piece gallery for 3D CAM preview.
- **Export as DWG for laser cutter drivers** (v4, L) - Generate CAD-native DWG with layer per piece type for direct drive import.
- **Copy to clipboard from export dialogs** (v2, S) - Add Copy-to-clipboard button for CSV/SVG/DXF export so users don't need to download and open files separately.
- **Cut list copy-to-clipboard (JSON)** (v2, S) - JSON export of parts list with dimensions for pasting into external tools.
- **CSV import auto-detect headers** (v2, S) - Detect and skip CSV headers by checking for keyword row (label/width/height/quantity) in first line.
- **TSV/Excel paste native format support** (v2, S) - Document and test that tab-separated and Excel copy-paste roundtrip correctly.
- **Quantity saturation warning on import** (v2, S) - Warn if imported quantity is clamped (0->1) or very large (>100) to catch data entry mistakes.
- **Clipboard import (paste share link or hash)** (v2, M) - Let users paste a full share URL or just the base64 hash into the import dialog to open a shared project.
- **SVG export with cutting-machine-friendly metadata** (v2, M) - Add optional <metadata>/<desc> elements with piece labels, quantities, and strategy for machine CAM ingestion.
- **Export a BOM CSV with localized headers** (v2, L) - Extend CSV export with a final BOM (assembled pieces, hardware count, finish quantities) per snapshot.

### Projects, Snapshots and Persistence (16)

- **Named projects (non-snapshot workflow)** (v4, L) - Persistent open/create/new project flow with dedicated UI instead of relying on snapshots for project management.
- **Debounced deep-watch split** (v3, M) - Replace the deep watcher (issue #5) with granular handlers to avoid keystroke-level history/save spam.
- **History persistence to IndexedDB** (v3, M) - Store undo/redo stack in IndexedDB with a cap (e.g. last 50 snapshots) to allow deep undo across sessions.
- **Project templates (presets with pieces + sheet params)** (v3, M) - Save sheet + piece presets as reusable templates (e.g. Shelving Kit, Drawer Config) for faster starts.
- **Piece library persistence** (v3, M) - Save frequently-used piece specs (label, width, height, allowRotation) in a personal library for reuse across projects.
- **Cloud sync optional module** (v3, L) - Design an optional composable (useProjectSync) so users can plug in their own backend (Firebase, Supabase) without touching core logic.
- **Project rename and metadata UI** (v2, S) - Add in-place rename for snapshots and an optional description field for richer context.
- **Auto-backup frequency tuning** (v2, S) - Let users configure automatic snapshot frequency (before each major op, or hourly) rather than every import/delete.
- **Snapshot tags or categories** (v2, S) - Tag snapshots (final, archive, client-v2) to organize and filter a growing list.
- **localStorage quota warnings** (v2, S) - Detect and warn when approaching quota (issue #15); offer to archive old snapshots or auto-cleanup stale ones.
- **Copy/restore snapshot as a new project** (v2, S) - Fork a snapshot into a new named project without losing the original, so users compare/switch versions without losing current work.
- **Sheet preset management UI** (v2, S) - Let users add/remove/reorder custom sheet presets in localStorage, not just the hardcoded list.
- **Clean up colorIdx state sync** (v2, S) - Issue #20 (colorIdx desync on undo): derive color from piece count or store in state rather than module-level mutable.
- **Snapshot diff viewer UI** (v2, M) - Surface the hover comparison as a rich modal showing added/removed/changed pieces with visual thumbnails.
- **Lazy-load project snapshots on demand** (v1, M) - For large snapshot lists, paginate or virtualize and fetch snapshots on scroll to keep the component light.
- **Restore from hash versioning** (v1, S) - Track when a shared link was generated; warn if restoring an old snapshot that may not reflect current work.

### Sharing and Collaboration (2)

- **Share link compression option** (v2, L) - Offer a shorter share URL by compressing state with gzip before base64url, for large projects with many pieces.
- **Partial share links (pieces only / settings only)** (v2, L) - Add optional query params (#p=...&mode=pieces-only) to share just the cut list without sheet/kerf for collaboration.

### Cost, Materials and Estimation (15)

- **Material library with preset costs** (v4, M) - Pre-built material types (plywood 18mm, MDF, chipboard, acrylic) with standard pricing by grade, selectable via dropdown to auto-fill price and kerf.
- **Multiple stock sizes per project** (v4, L) - Allow switching between 2-3 sheet sizes in a single layout to mix standard sheets with offcuts and reduce waste/cost.
- **Piece-level material tagging** (v3, M) - Tag each piece with material type (wood, grain direction, requires edge banding) so cost splits by material and exports show banding specs.
- **Cost breakdown per sheet** (v3, S) - Show per-sheet cost and waste% instead of just totals so users identify high-waste sheets worth re-packing.
- **Bulk discount calculator** (v2, S) - Add a volume-discount field (e.g. 10+ sheets = 5% off) and show discounted totals in cost summary.
- **Cost variance alerts** (v2, S) - Flag if waste cost exceeds a user-configurable threshold (default 30%) with a toast suggestion.
- **Export with material grouping** (v2, S) - In CSV and print HTML, group pieces by material type so the workshop sees 'Plywood 18mm:...' then 'MDF 12mm:...'.
- **Kerf impact simulator** (v2, S) - After layout, show 'Reducing kerf 3mm to 2mm saves X sheets / Y cost' with interactive recalculation.
- **Weight estimation from material density** (v2, M) - Store material density in the library; auto-compute total project weight for logistics planning.
- **Grain direction visualization** (v2, M) - Overlay a wood grain texture or arrow on sheet preview; pieces can inherit or override direction.
- **Edge banding requirements spec** (v2, M) - Mark pieces needing edge banding; add a CSV column and highlight those edges in SVG export.
- **Project cost history archive** (v2, M) - Save completed projects with date, materials, actual waste %, cost for accuracy prediction on future jobs.
- **Offcut tracking and reuse** (v2, L) - After optimization, list remaining offcut dimensions and suggest using them for smaller pieces in future jobs.
- **Supplier lead-time info** (v1, M) - When selecting a material, show typical supplier, lead time, and stock status for availability constraints.
- **Cost-per-meter-line metric** (v1, S) - For laser-cut parts, show total cut length and cost per meter to compare cutting efficiency across designs.

### Results Visualization and Reporting (13)

- **Printable cut sequence/cutting order guide** (v4, M) - Add a sequential cutting order visualization with board position, piece dimensions, and relative angle on export SVG/print HTML.
- **Sheet utilization heat map** (v3, M) - Render a color-coded utilization map on each sheet showing waste areas distinctly from placed pieces.
- **Dimensions on sheet edges with tick marks** (v2, M) - Add tick marks and dimension callouts along left/bottom edges of each sheet to match production cut drawings.
- **Piece legend with swatches in the sheet rendering** (v2, M) - Add a small legend box on each sheet SVG showing color-to-label mapping for faster physical identification.
- **Grouped parts table by material/color in print HTML** (v2, M) - Group the print parts list by label with subtotals and highlight the most common/largest pieces at the top.
- **Efficiency threshold warnings on individual sheets** (v2, M) - Flag sheets below a user-configurable efficiency threshold (default 65%) with a warning or repack recommendation.
- **Piece count badge with total rotations displayed** (v2, S) - Show piece count and how many are rotated (e.g. '12 pieces / 3 rotated') in the sheet card header.
- **Readiness score breakdown tooltip/modal** (v2, S) - Show a detailed breakdown of each readiness-score penalty (what deduction, why, how to fix) instead of magic numbers.
- **Summary info card at gallery bottom** (v2, S) - Show piece count, total area used, average sheet utilization.
- **3D assembly render as PNG/PDF snapshot** (v2, M) - Add a 'Download as image' button for the 3D box assembly view for a quick reference visual.
- **Cut sheet nesting diagram (orthogonal projection)** (v2, L) - Add an optional top-down flat layout view of how all sheets stack in production with cross-sheet reference numbering.
- **Calculate result summary in palette commands** (v2, S) - Show the last calculation result as a command-palette summary line (e.g. '3 sheets, 82.5% efficiency').
- **Label text size auto-fit and clipping indicator** (v1, S) - When piece labels are truncated on small pieces, render a subtle indicator so users know the full label exists in data.

### Piece Editor and List UX (11)

- **Live preview of bulk transforms before apply (dry-run)** (v4, L) - Show a before/after diff of the first few pieces when using allowance/round/swap so users can Cancel before committing.
- **Drag-friendly visible-only reordering in filtered lists** (v4, M) - When a filter is active, indicate hidden pieces and constrain drag-drop to visible pieces to avoid silent reorders.
- **Debounce piece filter/sort UI updates during bulk operations** (v3, M) - Batch updates and throttle recalc so the visible piece list does not flicker during bulk transforms.
- **Keyboard shortcuts for inline piece editing (Tab navigation)** (v3, M) - Tab/Shift+Tab to move focus between piece-row fields without losing edit state for full keyboard navigability.
- **Add responsive breakpoint for piece editor row layout** (v2, M) - On screens <600px, implement a dedicated mobile card view with stacked fields instead of poorly wrapping inline edit.
- **Mute Ctrl+K when typing in search/filter inputs** (v2, S) - Add an isEditableTarget guard so the command palette does not open while typing in pieceQuery or commandQuery.
- **Sort indicator on each sort mode button** (v2, S) - Show an up/down arrow or highlight on area/name/qty sort buttons to indicate the active sort.
- **Piece selection survives filter toggle** (v2, S) - Keep the same piece selected when toggling a quick filter on/off if it re-appears in the list.
- **Copy piece ID to clipboard for export reference** (v2, S) - Add a context menu or inline button to copy a piece's ID/number to cross-reference exported SVG/DXF labels.
- **Undo on cancelled/failed calculate** (v2, M) - If calculate() fails, let the user undo the triggering operation so undo history stays consistent with optimizer state.
- **Double-click to select all text in label field** (v1, S) - Label inputs should select-all on double-click to speed bulk renaming.

### Box Builder and 3D (12)

- **Add parameter validation UI hints** (v3, M) - Show red outline or tooltip when thickness >= width/2 or height/2, or tab count exceeds available space.
- **Parametric panel thickness by piece type** (v3, L) - Allow different thickness for sides vs top/bottom vs shelves and recompute geometry.
- **Bevel angle slider** (v3, M) - Let bevel range -45 to +45 degrees with live visual feedback in assembly.
- **Add joint preview overlay** (v3, M) - Show tab/slot fit zones highlighted in cutting layout and gallery view.
- **3D model touch support on tablets** (v2, M) - Enable two-finger pinch-zoom and touch rotation in assembly and gallery views.
- **Dimension unit toggle (mm/cm/inch)** (v3, M) - Add a unit selector; store preference and convert all display, input, and export.
- **Explode animation on mount** (v2, S) - Auto-play a gentle explode/collapse sequence on first view to guide the eye.
- **Dimension preset buttons** (v2, S) - Quick-load buttons for standard box sizes (US Letter, A4, common shipping boxes).
- **Keyboard shortcuts for parameter adjustment** (v2, S) - Ctrl+Up/Down to tweak the focused field by 1 step increment.
- **Improve keyboard shortcut discoverability** (v1, S) - Highlight the hotkey bar at top on first visit (D and R keys already work).
- **Swipe/pinch zoom on sheet SVG results (mobile)** (v2, M) - Allow two-finger pinch-zoom on result sheets so users inspect details on small touch screens.
- **Autocomplete sheet preset selection based on kerf** (v2, M) - When the user edits kerf, highlight matching presets to speed up material/tool profile matching.

---

Generated from a multi-agent survey; treat as a living backlog. Add or prune as the product evolves.
