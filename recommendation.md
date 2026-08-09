# CutLog improvement catalog

This is the canonical backlog for CutLog. It contains **520 distinct,
actionable observations**: defects, design debt, improvements, product ideas,
and work completed through v0.1.54. `ARCHITECTURE.md` explains the module
boundaries; `README.md` gives the short reading path. Keeping the detailed list
here avoids copying hundreds of lines across three documents and follows DRY.

Legend: `Bug`, `Debt`, `Improve`, `Idea`, or `Done`; priority `P0` (protect data
or correctness) through `P3` (optional); effort `S`, `M`, or `L`. Checked items
landed through the current v0.1.54 change set. Unchecked items are candidates, not
promises; take them in small, independently testable slices.

## Current focus

1. Preserve malformed storage, version persisted records, add migrations, and
   prepare larger-project storage visibility (`CL-128` to `CL-132`).
2. Add optimizer progress, cooperative cancellation, and protocol tests
   (`CL-059`, `CL-060`, `CL-070`).
3. Version persisted/share state and add migrations before the schema grows
   (`CL-129` to `CL-131`).
4. Make SVG/DXF units and production metadata explicit (`CL-181` to `CL-187`).
5. Add placement invariants and benchmark fixtures (`CL-026` to `CL-039`).

## 1. Runtime safety and trust boundaries (CL-001..CL-025)

- [x] **CL-001 · Done · P0 · S** — Cap the quantity of one piece before expansion so a typo cannot allocate an unbounded queue.
- [x] **CL-002 · Done · P0 · S** — Cap total expanded quantity before JavaScript crosses into WASM.
- [x] **CL-003 · Done · P0 · M** — Add a fallible Rust optimizer entry point that returns a typed capacity error.
- [x] **CL-004 · Done · P0 · S** — Make the CLI print optimizer failures and exit nonzero instead of continuing silently.
- [x] **CL-005 · Done · P0 · S** — Convert Rust optimizer errors into JavaScript errors at the WASM boundary.
- [x] **CL-006 · Done · P0 · S** — Apply the same quantity budget to current, shared, and persisted project state.
- [ ] **CL-007 · Bug · P0 · S** — Reject `NaN`, infinity, and non-numeric dimensions at every import and deserialization boundary.
- [ ] **CL-008 · Improve · P1 · S** — Define a documented maximum physical dimension instead of accepting arbitrarily large millimeter values.
- [ ] **CL-009 · Improve · P1 · S** — Centralize kerf bounds and reject values larger than the selected stock dimensions.
- [ ] **CL-010 · Bug · P0 · S** — Enforce integer quantities after every transform, not only while parsing the initial form.
- [ ] **CL-011 · Debt · P1 · M** — Add an explicit schema version to local state, snapshots, and share links.
- [ ] **CL-012 · Improve · P1 · S** — Limit generated export size and warn before creating a browser-freezing SVG or DXF.
- [ ] **CL-013 · Improve · P1 · S** — Limit import rows separately from expanded quantity so malformed files fail early.
- [ ] **CL-014 · Bug · P1 · S** — Reject unknown optimization strategy values instead of silently selecting a default.
- [ ] **CL-015 · Improve · P2 · M** — Parse decimal separators deliberately so locale-formatted numbers cannot change meaning.
- [ ] **CL-016 · Bug · P1 · S** — Quarantine corrupted localStorage records and preserve the last known valid state.
- [ ] **CL-017 · Debt · P1 · M** — Give validation failures stable error codes rather than coupling UI behavior to messages.
- [ ] **CL-018 · Bug · P1 · S** — Remove the legacy infallible optimizer fallback once all callers handle `Result` explicitly.
- [ ] **CL-019 · Improve · P1 · M** — Fuzz project-state decoding with malformed JSON, extreme numbers, and missing fields.
- [ ] **CL-020 · Improve · P2 · M** — Set a memory budget for result sheets and stop before result serialization becomes excessive.
- [x] **CL-021 · Done · P1 · S** — Prevent a cancelled run or later input edit from clearing or replacing a newer valid result.
- [ ] **CL-022 · Improve · P3 · S** — Normalize negative zero in dimensions and exported coordinates.
- [ ] **CL-023 · Improve · P2 · S** — Bound labels by Unicode code points and export bytes, not JavaScript UTF-16 length alone.
- [x] **CL-024 · Done · P0 · S** — JSON-round-trip Worker payloads so Vue proxies never reach structured clone.
- [ ] **CL-025 · Debt · P1 · S** — Publish all runtime limits in one user-facing and developer-facing table.

## 2. Optimizer correctness and algorithms (CL-026..CL-050)

- [ ] **CL-026 · Improve · P0 · M** — Add golden layouts for exact-fit, one-pixel-gap, and unavoidable-overflow cases.
- [ ] **CL-027 · Bug · P0 · S** — Verify that an exact stock-sized part fits when kerf is zero and fails predictably otherwise.
- [ ] **CL-028 · Bug · P0 · M** — Test kerf accounting between adjacent pieces and at stock boundaries independently.
- [ ] **CL-029 · Bug · P0 · M** — Assert that rotation never changes labels, quantities, or reported source dimensions.
- [ ] **CL-030 · Improve · P1 · M** — Guarantee deterministic output for identical input, strategy, and optimizer version.
- [ ] **CL-031 · Bug · P0 · M** — Add a post-layout invariant that no two placed rectangles overlap.
- [ ] **CL-032 · Bug · P0 · M** — Add a post-layout invariant that every rectangle remains inside its sheet.
- [ ] **CL-033 · Improve · P1 · S** — Cross-check used area, waste area, and efficiency so their totals cannot diverge.
- [ ] **CL-034 · Improve · P2 · M** — Build a benchmark matrix comparing all strategies on representative workshop jobs.
- [x] **CL-035 · Done · P1 · S** — Stop using duplicate labels as identity when reconciling optimized pieces with source rows.
- [ ] **CL-036 · Bug · P1 · M** — Cover floating-point dimensions near comparison thresholds and normalize epsilon handling.
- [ ] **CL-037 · Improve · P1 · S** — Define and test the supported semantics of zero kerf instead of relying on incidental math.
- [ ] **CL-038 · Improve · P1 · S** — Return a specific “part exceeds stock” reason for every rejected orientation.
- [ ] **CL-039 · Improve · P1 · L** — Add property-based tests for random layouts and validate all placement invariants.
- [ ] **CL-040 · Improve · P2 · L** — Compare small jobs against an exact solver to measure heuristic quality.
- [ ] **CL-041 · Bug · P1 · M** — Derive leftovers from occupied geometry and test that no usable area is double-counted.
- [ ] **CL-042 · Improve · P2 · S** — Stabilize tie-breaking so source-order changes do not create surprising layouts.
- [ ] **CL-043 · Improve · P1 · M** — Add cooperative cancellation checkpoints inside long Rust search loops.
- [ ] **CL-044 · Idea · P2 · L** — Emit meaningful progress phases rather than an indeterminate spinner for long runs.
- [ ] **CL-045 · Idea · P2 · L** — Support multiple stock sizes in one optimization while keeping material groups isolated.
- [ ] **CL-046 · Idea · P2 · L** — Accept saved offcuts as bounded stock inputs and report which offcuts were consumed.
- [ ] **CL-047 · Idea · P2 · L** — Model grain direction as an orientation constraint separate from rotation permission.
- [ ] **CL-048 · Improve · P2 · L** — Validate that a proposed layout admits a practical guillotine cutting sequence when requested.
- [ ] **CL-049 · Improve · P1 · M** — Fail CI when optimizer runtime or allocations regress beyond an agreed benchmark threshold.
- [ ] **CL-050 · Improve · P1 · M** — Explain every unplaced part with dimensions, attempted orientations, and the limiting constraint.

## 3. WASM, Workers, and concurrency (CL-051..CL-075)

- [x] **CL-051 · Done · P0 · M** — Run optimization in a dedicated Worker so the editor remains responsive.
- [x] **CL-052 · Done · P0 · S** — Give each run an owned Worker and terminate it on completion, cancellation, or failure.
- [x] **CL-053 · Done · P0 · S** — Strip reactive proxies before `postMessage` to avoid `DataCloneError` in real browsers.
- [x] **CL-054 · Done · P0 · S** — Cancel stale work when a newer calculation starts or the page unmounts.
- [x] **CL-055 · Done · P0 · S** — Catch synchronous `postMessage` failures and reject while cleaning up the Worker.
- [x] **CL-056 · Done · P1 · S** — Surface Worker and optimizer failures as a visible localized error toast.
- [ ] **CL-057 · Improve · P2 · M** — Reuse a warm Worker only after measuring whether startup dominates typical calculations.
- [ ] **CL-058 · Improve · P2 · M** — Cache WASM initialization inside the Worker and expose initialization state.
- [ ] **CL-059 · Improve · P1 · M** — Define progress messages with phase, completed work, and optional total work.
- [ ] **CL-060 · Improve · P1 · L** — Connect UI cancellation to cooperative Rust cancellation rather than termination alone.
- [ ] **CL-061 · Debt · P1 · S** — Add request IDs to every Worker message so late messages can be proven stale.
- [ ] **CL-062 · Debt · P1 · S** — Define the Worker protocol as a discriminated union shared by both endpoints.
- [ ] **CL-063 · Improve · P1 · S** — Add a configurable timeout with a clear recovery path for pathological runs.
- [ ] **CL-064 · Improve · P1 · M** — Retry initialization once after a Worker crash, then preserve the user’s inputs.
- [ ] **CL-065 · Improve · P2 · S** — Add a build-time guard preventing browser-only APIs from leaking into Worker modules.
- [ ] **CL-066 · Improve · P3 · M** — Chunk very large input payloads only if serialization profiling shows a bottleneck.
- [ ] **CL-067 · Improve · P3 · M** — Evaluate transferable typed arrays for geometry-heavy protocols instead of JSON objects.
- [ ] **CL-068 · Debt · P2 · S** — Handshake Worker and UI protocol versions before starting optimization.
- [ ] **CL-069 · Improve · P1 · M** — Serialize structured Rust error codes and details instead of flattening them to text.
- [x] **CL-070 · Done · P1 · M** — Unit-test success, construction/runtime failure, cancellation, plain snapshots, and cleanup with a fake Worker.
- [ ] **CL-071 · Improve · P2 · M** — Provide a documented fallback or compatibility message when module Workers are unavailable.
- [ ] **CL-072 · Debt · P3 · S** — Document cross-origin and MIME requirements for deployed WASM and Worker assets.
- [ ] **CL-073 · Improve · P1 · M** — Test the production Content Security Policy against WASM and module Worker loading.
- [ ] **CL-074 · Improve · P2 · M** — Measure Worker startup, WASM initialization, serialization, and optimizer time separately.
- [ ] **CL-075 · Bug · P1 · S** — Assert that route changes leave no live optimizer Worker behind.

## 4. Rust core, models, and CLI (CL-076..CL-100)

- [x] **CL-076 · Done · P0 · M** — Keep excessive expansion from panicking or allocating through the Rust core API.
- [x] **CL-077 · Done · P0 · S** — Represent optimizer capacity failures with a typed Rust error.
- [x] **CL-078 · Done · P0 · S** — Return a failing CLI exit code when optimization cannot run.
- [x] **CL-079 · Done · P0 · S** — Preserve Rust error context when crossing the WASM boundary.
- [x] **CL-080 · Done · P0 · S** — Use one Rust expansion limit for core, CLI, and WASM paths.
- [ ] **CL-081 · Debt · P1 · M** — Introduce stable input/output schema structs instead of treating serialized JSON as an implicit contract.
- [ ] **CL-082 · Improve · P1 · M** — Add `serde` defaults and explicit rejection rules for every optional or unknown field.
- [ ] **CL-083 · Improve · P1 · S** — Validate model invariants at construction so invalid pieces cannot reach optimizer internals.
- [ ] **CL-084 · Bug · P1 · S** — Audit integer conversions between JavaScript numbers, Rust integers, and exported values for truncation.
- [ ] **CL-085 · Improve · P2 · M** — Separate placement generation from result statistics to test both independently.
- [ ] **CL-086 · Debt · P2 · M** — Replace string strategy dispatch with an enum serialized by an explicit wire name.
- [ ] **CL-087 · Improve · P1 · M** — Add snapshot tests for CLI JSON output and human-readable diagnostics.
- [ ] **CL-088 · Improve · P2 · S** — Add `--version` output sourced from the same release version as the web app.
- [ ] **CL-089 · Idea · P3 · M** — Add `--format json` for machine-readable CLI errors and result metadata.
- [ ] **CL-090 · Improve · P2 · S** — Support reading input from stdin so the CLI composes with workshop scripts.
- [ ] **CL-091 · Improve · P2 · S** — Make output-file overwrite behavior explicit and safe.
- [ ] **CL-092 · Improve · P1 · M** — Add end-to-end CLI tests for valid input, invalid schema, excessive quantity, and write failure.
- [ ] **CL-093 · Debt · P2 · M** — Keep feature flags minimal and document which crates are browser-only or native-only.
- [ ] **CL-094 · Improve · P2 · S** — Run Clippy with warnings denied for workspace code in CI.
- [ ] **CL-095 · Improve · P2 · S** — Run `cargo audit` or an equivalent advisory check on a schedule.
- [ ] **CL-096 · Improve · P3 · M** — Record optimizer benchmark baselines with criterion and representative fixtures.
- [ ] **CL-097 · Debt · P2 · S** — Document coordinate units and numeric precision in public Rust types.
- [ ] **CL-098 · Bug · P1 · M** — Test serialization round trips for non-ASCII labels and extreme legal dimensions.
- [ ] **CL-099 · Improve · P2 · S** — Add rustdoc examples for the fallible optimizer API.
- [ ] **CL-100 · Improve · P2 · S** — Add a complete CLI example to README with input, command, output, and failure behavior.

## 5. Home editor architecture and state (CL-101..CL-125)

- [x] **CL-101 · Done · P1 · M** — Extract each result sheet into an accessible `SheetCard` component.
- [x] **CL-102 · Done · P1 · S** — Consolidate piece and shelf colors in a tested palette module.
- [x] **CL-103 · Done · P1 · M** — Move sheet scaling, grain lines, labels, and badges into pure presentation helpers.
- [x] **CL-104 · Done · P1 · S** — Extract toast timing and tone into a reusable composable with cleanup.
- [x] **CL-105 · Done · P1 · M** — Extract debounced Home persistence and surface storage failures.
- [x] **CL-106 · Done · P1 · L** — Extract undo/redo orchestration into `useHomeHistory` with restore-loop tests.
- [x] **CL-107 · Done · P1 · M** — Extract named project snapshots into a persistence-focused composable.
- [x] **CL-108 · Done · P1 · L** — Extract piece CRUD, color allocation, filtering, sorting, and bulk edits into `usePieceList`.
- [x] **CL-109 · Done · P2 · M** — Replace the page-level keydown chain with a tested shortcut composable.
- [x] **CL-110 · Done · P2 · M** — Move export orchestration out of `Home.vue` while keeping serializers pure.
- [x] **CL-111 · Done · P2 · M** — Extract command-palette state and command execution from the page.
- [x] **CL-112 · Done · P2 · M** — Move cost inputs and summary derivation behind a small `useCosting` interface.
- [x] **CL-113 · Done · P2 · S** — Isolate result selection and selected-piece reconciliation from rendering.
- [x] **CL-114 · Done · P2 · M** — Put import preview, validation, and commit into one transactional boundary.
- [x] **CL-115 · Done · P1 · L** — Establish one owner for project state with explicit `read`, `apply`, and `reset` operations.
- [x] **CL-116 · Done · P1 · M** — Replace the broad deep watcher with intentional event-based history and persistence triggers.
- [x] **CL-117 · Done · P1 · M** — Give every source piece a stable ID that survives duplicate labels, sorting, and optimization.
- [x] **CL-118 · Done · P2 · L** — Express complex multi-field edits as named actions so state transitions are traceable.
- [x] **CL-119 · Done · P1 · S** — Keep translation access out of pure modules by passing display strings at the component edge.
- [x] **CL-120 · Done · P2 · M** — Add dependency-boundary lint rules for `lib`, `services`, composables, and pages.
- [x] **CL-121 · Done · P2 · M** — Add a route-level error boundary that preserves the current project after a render failure.
- [x] **CL-122 · Done · P2 · L** — Reduce `Home.vue` below 800 lines through cohesive extractions, not line-shuffling wrappers.
- [x] **CL-123 · Done · P2 · M** — Add focused component tests for SheetCard selection, labels, and keyboard behavior.
- [x] **CL-124 · Done · P2 · M** — Model optimization as idle/running/success/error/cancelled states instead of related booleans.
- [x] **CL-125 · Done · P1 · S** — Require page actions to declare side effects rather than hiding persistence in unrelated watchers.

## 6. Persistence, history, and recovery (CL-126..CL-150)

- [x] **CL-126 · Done · P1 · M** — Debounce local project writes behind a dedicated storage composable.
- [x] **CL-127 · Done · P1 · S** — Report quota and write failures instead of pretending the project was saved.
- [ ] **CL-128 · Bug · P0 · M** — Keep a recoverable copy of malformed persisted data before resetting to defaults.
- [ ] **CL-129 · Debt · P1 · M** — Version every persisted record and share-link payload.
- [ ] **CL-130 · Improve · P1 · M** — Add sequential, tested migrations from every supported state version.
- [ ] **CL-131 · Improve · P1 · M** — Move large projects and snapshot collections from localStorage to IndexedDB.
- [ ] **CL-132 · Improve · P2 · S** — Show storage usage and the estimated size of the current project.
- [ ] **CL-133 · Improve · P1 · S** — Cap snapshot count and prune by an explicit oldest-first policy.
- [x] **CL-134 · Done · P1 · M** — Coalesce rapid field edits into one undo step without merging separate user actions.
- [ ] **CL-135 · Improve · P2 · M** — Store a compact operation description alongside each history snapshot.
- [ ] **CL-136 · Bug · P0 · M** — Test that restoring history never records another history entry recursively.
- [ ] **CL-137 · Improve · P1 · M** — Write critical persisted records atomically with a temporary key and verified swap.
- [ ] **CL-138 · Idea · P2 · L** — Add a first-class project list with create, rename, duplicate, archive, and delete.
- [ ] **CL-139 · Idea · P2 · M** — Show a semantic snapshot diff for added, removed, and changed parts.
- [ ] **CL-140 · Improve · P2 · S** — Create automatic recovery points before destructive bulk actions.
- [ ] **CL-141 · Improve · P1 · M** — Support a versioned project JSON export/import for device-independent backup.
- [ ] **CL-142 · Improve · P2 · L** — Compress large share links and warn before URLs exceed practical limits.
- [ ] **CL-143 · Improve · P2 · S** — Offer “restore as copy” so opening old work cannot overwrite the current project accidentally.
- [ ] **CL-144 · Improve · P2 · M** — Detect concurrent edits from another tab and ask which version to keep.
- [ ] **CL-145 · Improve · P3 · M** — Add optional encrypted project export for commercially sensitive cut lists.
- [ ] **CL-146 · Bug · P1 · S** — Derive the next palette color from state so undo and restore cannot desynchronize it.
- [ ] **CL-147 · Improve · P2 · M** — Preserve undo history across route navigation during the same session.
- [ ] **CL-148 · Improve · P1 · S** — Distinguish “saved”, “saving”, “save failed”, and “storage unavailable” in UI state.
- [ ] **CL-149 · Improve · P2 · S** — Add a one-click recovery action when persisted state fails validation.
- [ ] **CL-150 · Improve · P1 · M** — Test reload, share restore, snapshot restore, and undo together as one browser workflow.

## 7. Piece editor and import (CL-151..CL-175)

- [x] **CL-151 · Done · P1 · M** — Introduce stable piece IDs independent of labels and array positions.
- [ ] **CL-152 · Bug · P0 · M** — Validate every imported row before mutating the current project.
- [ ] **CL-153 · Improve · P1 · M** — Report import failures by line, field, rejected value, and recovery hint.
- [ ] **CL-154 · Bug · P1 · M** — Parse quoted CSV fields containing delimiters, newlines, and escaped quotes correctly.
- [ ] **CL-155 · Improve · P2 · S** — Treat tab-separated spreadsheet paste as a documented import format.
- [ ] **CL-156 · Improve · P2 · S** — Detect common localized and English header rows without importing them as parts.
- [ ] **CL-157 · Improve · P2 · M** — Detect exact and near-duplicate parts before committing an import.
- [ ] **CL-158 · Idea · P2 · M** — Preview imported rows with accept/reject controls and a total quantity budget.
- [ ] **CL-159 · Improve · P1 · S** — Stop parsing after the import row limit and explain how many rows were ignored.
- [ ] **CL-160 · Idea · P3 · L** — Detect source units from headers and require confirmation before converting inches or centimeters.
- [ ] **CL-161 · Improve · P2 · S** — Normalize surrounding whitespace while preserving intentional internal label spacing.
- [ ] **CL-162 · Bug · P1 · S** — Reject empty labels only when identity or exports truly require one; keep the rule consistent.
- [x] **CL-163 · Done · P1 · S** — Add keyboard-accessible move-up and move-down controls to each piece row.
- [x] **CL-164 · Done · P1 · S** — Route keyboard reordering through the same lock-aware ordering logic as drag and drop.
- [x] **CL-165 · Done · P1 · S** — Give piece quantity inputs specific accessible names and enforce the shared maximum.
- [x] **CL-166 · Done · P1 · S** — Keep button and drag reordering behavior aligned in browser smoke tests.
- [ ] **CL-167 · Improve · P1 · M** — Design a compact mobile piece row instead of relying on uncontrolled wrapping.
- [ ] **CL-168 · Improve · P2 · L** — Virtualize the piece list after profiling a realistic large project.
- [ ] **CL-169 · Idea · P2 · M** — Show a dry-run diff before applying bulk allowances, swaps, or rounding.
- [ ] **CL-170 · Bug · P2 · M** — Preserve selection predictably when filtering, sorting, and clearing filters.
- [ ] **CL-171 · Improve · P3 · S** — Avoid adjacent indistinguishable colors while keeping palette assignment deterministic.
- [ ] **CL-172 · Improve · P1 · M** — Check piece colors and selection outlines against contrast requirements.
- [ ] **CL-173 · Idea · P3 · S** — Copy a stable piece reference from the row for workshop cross-referencing.
- [ ] **CL-174 · Idea · P2 · L** — Add a reusable personal parts library with search and material defaults.
- [ ] **CL-175 · Improve · P1 · M** — Treat each import as one reversible transaction in history.

## 8. Export, CAD, and printing (CL-176..CL-200)

- [ ] **CL-176 · Bug · P0 · M** — Round-trip CSV export through the importer and assert every supported field survives.
- [ ] **CL-177 · Bug · P1 · M** — Validate generated CSV quoting for commas, semicolons, quotes, and multiline labels.
- [ ] **CL-178 · Improve · P1 · S** — Include a format version and units in machine-readable exports.
- [ ] **CL-179 · Bug · P1 · S** — Validate color strings before inserting them into raw SVG output.
- [ ] **CL-180 · Improve · P1 · M** — Share one tested piece label and badge model between on-screen and exported layouts.
- [ ] **CL-181 · Bug · P0 · S** — Declare millimeter units explicitly in exported SVG width and height.
- [ ] **CL-182 · Bug · P0 · M** — Emit and test the DXF `$INSUNITS` header for millimeters.
- [ ] **CL-183 · Improve · P1 · M** — Validate exported DXF with at least one independent parser in CI.
- [ ] **CL-184 · Improve · P2 · M** — Add optional cut-order numbers and a legend to production drawings.
- [ ] **CL-185 · Improve · P2 · M** — Include grain direction and rotation state in SVG, DXF, and print output.
- [ ] **CL-186 · Idea · P2 · M** — Export a bill of materials grouped by material, thickness, and edge treatment.
- [ ] **CL-187 · Improve · P1 · S** — Add project name, timestamp, optimizer version, and strategy to export metadata.
- [ ] **CL-188 · Improve · P2 · S** — Offer copy-to-clipboard alongside download for textual exports.
- [ ] **CL-189 · Bug · P1 · M** — Test print pagination so a sheet diagram or parts row is never clipped across pages.
- [ ] **CL-190 · Improve · P1 · M** — Add print styles for monochrome output without losing piece identity.
- [ ] **CL-191 · Improve · P2 · S** — Auto-fit labels within tiny parts and expose the full label in a legend.
- [ ] **CL-192 · Idea · P3 · L** — Add a GLB export of the assembled box with real dimensions and material names.
- [ ] **CL-193 · Idea · P3 · L** — Evaluate a CNC-specific toolpath export only after defining machine and safety constraints.
- [ ] **CL-194 · Improve · P1 · M** — Reject exports that exceed safe browser memory and suggest splitting the project.
- [ ] **CL-195 · Bug · P1 · S** — Use locale-independent decimal punctuation in machine-readable CAD formats.
- [ ] **CL-196 · Improve · P2 · S** — Sanitize file names while retaining meaningful project identifiers.
- [ ] **CL-197 · Improve · P1 · M** — Test non-ASCII project and piece names in every export format.
- [ ] **CL-198 · Idea · P3 · M** — Provide an export preset system for common workshop software.
- [ ] **CL-199 · Improve · P2 · M** — Add an export preview with file type, units, dimensions, and estimated size.
- [ ] **CL-200 · Debt · P2 · S** — Keep download mechanics in one helper and serializers free of DOM side effects.

## 9. Box geometry and constraints (CL-201..CL-225)

- [x] **CL-201 · Done · P0 · M** — Centralize interdependent box parameter constraints in a pure tested module.
- [x] **CL-202 · Done · P0 · S** — Clamp width, height, depth, thickness, kerf, tabs, shelves, and bevel synchronously.
- [x] **CL-203 · Done · P1 · S** — Feed dynamic geometric maxima into NumberField instead of displaying impossible ranges.
- [x] **CL-204 · Done · P0 · M** — Cover coupled limits and extreme values with model and pure constraint tests.
- [ ] **CL-205 · Bug · P0 · M** — Validate every generated polygon for self-intersection before rendering or export.
- [x] **CL-206 · Done · P0 · M** — Enforce positive spacing between tabs instead of allowing zero-gap degenerate contours.
- [ ] **CL-207 · Improve · P1 · M** — Return explicit constraint reasons so the UI can explain each clamp.
- [ ] **CL-208 · Improve · P1 · S** — Show the legal range beside a focused parameter when its maximum is dynamic.
- [ ] **CL-209 · Bug · P1 · M** — Test shelf spacing at zero, one, and maximum shelf counts.
- [ ] **CL-210 · Bug · P1 · M** — Verify bevel geometry at both limits and around zero with golden fixtures.
- [ ] **CL-211 · Improve · P2 · M** — Separate requested parameters from effective clamped parameters for transparent feedback.
- [ ] **CL-212 · Improve · P1 · M** — Add dimensional invariants shared by SVG and Three.js outputs.
- [ ] **CL-213 · Bug · P1 · M** — Test that SVG panel dimensions agree with generated 3D geometry within tolerance.
- [ ] **CL-214 · Debt · P1 · M** — Identify box pieces with locale-independent IDs rather than translated labels.
- [ ] **CL-215 · Debt · P2 · M** — Extract a piece catalog that maps IDs to geometry, colors, and edge labels at the boundary.
- [ ] **CL-216 · Idea · P2 · L** — Support per-panel thickness only with a constraint model for every affected joint.
- [ ] **CL-217 · Idea · P3 · M** — Add presets for common box sizes as data, not hardcoded buttons.
- [ ] **CL-218 · Improve · P2 · S** — Allow reset to defaults and reset one field without rebuilding unrelated state.
- [ ] **CL-219 · Improve · P2 · M** — Persist box parameters with the same versioned storage policy as cut projects.
- [ ] **CL-220 · Bug · P1 · M** — Test decimal dimensions and kerf values for cumulative rounding drift.
- [ ] **CL-221 · Improve · P2 · M** — Add a fit-tolerance parameter distinct from physical tool kerf.
- [ ] **CL-222 · Idea · P2 · L** — Preview joint clearance and flag likely press-fit or loose-fit combinations.
- [ ] **CL-223 · Improve · P1 · M** — Export a dimensioned panel list alongside the box SVG.
- [ ] **CL-224 · Improve · P2 · S** — Make invalid pasted values resolve consistently with typed and stepped values.
- [ ] **CL-225 · Improve · P1 · M** — Add property tests generating legal parameter sets and checking geometric invariants.

## 10. Three.js rendering and lifecycle (CL-226..CL-250)

- [x] **CL-226 · Done · P0 · S** — Dispose mesh textures as well as materials and geometries during scene teardown.
- [x] **CL-227 · Done · P0 · S** — Traverse every assembly and gallery group before replacing or destroying it.
- [x] **CL-228 · Done · P1 · S** — Dispose controls, renderers, and renderer render lists on unmount.
- [x] **CL-229 · Done · P0 · S** — Dispose cached label textures when their scene lifecycle ends.
- [x] **CL-230 · Done · P1 · S** — Skip animation rendering while the document is hidden to reduce GPU and battery use.
- [x] **CL-231 · Done · P1 · M** — Verify desktop and mobile canvases contain rendered pixels instead of a blank WebGL surface.
- [ ] **CL-232 · Improve · P1 · M** — Assert renderer memory returns to a stable baseline after repeated parameter rebuilds.
- [ ] **CL-233 · Bug · P1 · M** — Handle WebGL context loss with a visible retry action and state restoration.
- [ ] **CL-234 · Improve · P2 · M** — Cap device pixel ratio for predictable GPU cost on high-density displays.
- [ ] **CL-235 · Improve · P2 · S** — Pause rendering when the canvas is offscreen, not only when the tab is hidden.
- [ ] **CL-236 · Improve · P2 · M** — Render only on demand when neither controls nor animation are changing.
- [ ] **CL-237 · Bug · P1 · M** — Keep camera framing valid for extreme legal box aspect ratios.
- [ ] **CL-238 · Improve · P2 · M** — Add deterministic visual fixtures for camera, lighting, and exploded positions.
- [ ] **CL-239 · Improve · P2 · S** — Respect reduced-motion preferences in explode and rotation animations.
- [ ] **CL-240 · Improve · P1 · M** — Add keyboard equivalents for essential rotate, zoom, and reset-camera controls.
- [ ] **CL-241 · Improve · P2 · M** — Verify pinch zoom and orbit gestures on touch devices without page-scroll traps.
- [ ] **CL-242 · Improve · P2 · M** — Reuse immutable geometry only where ownership and disposal remain explicit.
- [ ] **CL-243 · Debt · P2 · M** — Extract shared scene lifecycle after measuring remaining duplication between both views.
- [ ] **CL-244 · Improve · P1 · S** — Show a useful static fallback when WebGL initialization fails.
- [ ] **CL-245 · Improve · P2 · S** — Add an explicit reset-view icon with a localized tooltip.
- [ ] **CL-246 · Improve · P3 · M** — Add screenshot export with transparent and workshop-white background options.
- [ ] **CL-247 · Improve · P2 · M** — Instrument frame time and memory in development without shipping telemetry by default.
- [ ] **CL-248 · Bug · P1 · M** — Test rapid route switching and parameter edits for orphaned animation frames.
- [ ] **CL-249 · Improve · P3 · L** — Evaluate OffscreenCanvas only after profiling proves main-thread rendering is limiting.
- [ ] **CL-250 · Debt · P2 · S** — Document scene ownership rules for geometries, materials, textures, controls, and loops.

## 11. Accessibility and keyboard use (CL-251..CL-275)

- [x] **CL-251 · Done · P0 · S** — Expose NumberField IDs so visible labels can target the real input.
- [x] **CL-252 · Done · P0 · S** — Give increment and decrement controls localized names containing the field context.
- [x] **CL-253 · Done · P1 · S** — Disable steppers at effective minimum and maximum values.
- [x] **CL-254 · Done · P0 · M** — Associate major Home and Box form labels with their inputs.
- [x] **CL-255 · Done · P1 · S** — Replace the clickable color swatch container with a real button.
- [x] **CL-256 · Done · P0 · S** — Add accessible names to icon-only editor actions.
- [x] **CL-257 · Done · P0 · S** — Make list reordering possible without drag and drop.
- [x] **CL-258 · Done · P0 · S** — Give each sheet SVG a descriptive title and role.
- [x] **CL-259 · Done · P1 · M** — Make rendered piece rectangles keyboard-selectable with spoken piece names.
- [x] **CL-260 · Done · P0 · M** — Give the command palette proper combobox and listbox relationships.
- [x] **CL-261 · Done · P0 · M** — Support Arrow Up, Arrow Down, Home, End, and Enter in command results.
- [x] **CL-262 · Done · P1 · S** — Keep `aria-activedescendant` synchronized with the active command.
- [x] **CL-263 · Done · P0 · S** — Render Box gallery thumbnails as buttons with pressed state.
- [x] **CL-264 · Done · P0 · S** — Add accessible names to both 3D view containers.
- [x] **CL-265 · Done · P0 · S** — Add a localized title and label to the box cutting SVG.
- [ ] **CL-266 · Bug · P0 · M** — Trap focus inside the command palette and restore it to the trigger on close.
- [ ] **CL-267 · Improve · P1 · S** — Add a skip link from navigation to the active editor’s main heading.
- [ ] **CL-268 · Improve · P1 · M** — Announce optimization start, completion, failure, and cancellation through a polite live region.
- [ ] **CL-269 · Improve · P1 · M** — Announce row add, duplicate, delete, and reorder operations with useful context.
- [ ] **CL-270 · Bug · P1 · M** — Audit tab order after filters and conditional controls hide or reveal content.
- [ ] **CL-271 · Improve · P1 · S** — Ensure every validation error is programmatically linked to its input.
- [ ] **CL-272 · Improve · P2 · M** — Provide text alternatives for color and grain indicators.
- [ ] **CL-273 · Bug · P0 · M** — Test the full editor with VoiceOver or NVDA and document blocking issues.
- [ ] **CL-274 · Improve · P1 · M** — Meet 44 by 44 CSS pixel touch targets for primary mobile actions.
- [ ] **CL-275 · Improve · P2 · S** — Avoid conveying selected, invalid, or locked state by color alone.

## 12. Visual and interaction design (CL-276..CL-300)

- [x] **CL-276 · Done · P1 · S** — Normalize tool and repeated-item cards to a restrained maximum 8px radius.
- [x] **CL-277 · Done · P0 · S** — Strengthen `focus-visible` treatment across buttons, inputs, links, and interactive SVG pieces.
- [x] **CL-278 · Done · P1 · S** — Give NumberField a stable minimum height so focus and validation cannot shift layout.
- [x] **CL-279 · Done · P1 · S** — Make disabled controls visually distinct while retaining readable contrast.
- [x] **CL-280 · Done · P1 · S** — Add a clear active strip and scroll tracking to command results.
- [x] **CL-281 · Done · P1 · S** — Integrate reorder icons into each piece row without resizing adjacent inputs.
- [x] **CL-282 · Done · P0 · S** — Distinguish error toasts visually from successful and neutral feedback.
- [ ] **CL-283 · Improve · P1 · M** — Establish a compact spacing scale and remove one-off gaps from editor CSS.
- [ ] **CL-284 · Improve · P1 · M** — Make section hierarchy scannable without wrapping every section in a floating card.
- [ ] **CL-285 · Improve · P2 · M** — Reduce competing accent colors while preserving categorical piece colors.
- [ ] **CL-286 · Improve · P1 · M** — Create consistent empty, loading, success, error, and disabled states for both editors.
- [ ] **CL-287 · Improve · P2 · S** — Use familiar icons for repeated actions and reserve text buttons for clear commands.
- [ ] **CL-288 · Improve · P1 · S** — Add tooltips to unfamiliar icon actions without duplicating obvious visible labels.
- [ ] **CL-289 · Improve · P2 · M** — Keep numeric units adjacent to values and aligned across related fields.
- [ ] **CL-290 · Improve · P1 · M** — Design a persistent result summary that remains visible while comparing sheets.
- [ ] **CL-291 · Idea · P2 · M** — Add a compact before/after utilization comparison when changing strategy.
- [ ] **CL-292 · Improve · P2 · S** — Show active sort and filter state directly on their controls.
- [ ] **CL-293 · Improve · P1 · M** — Replace ambiguous destructive icons with confirmation and reversible feedback.
- [ ] **CL-294 · Improve · P2 · S** — Align command names, toolbar labels, and toast verbs to one terminology set.
- [ ] **CL-295 · Improve · P1 · M** — Keep dense operational content left-aligned and reserve centered text for true empty states.
- [ ] **CL-296 · Improve · P2 · M** — Add a high-contrast print-friendly piece palette independent of the screen theme.
- [ ] **CL-297 · Improve · P2 · S** — Prevent long labels, currency codes, and translated commands from clipping controls.
- [ ] **CL-298 · Idea · P3 · M** — Offer a compact-density preference for users managing many pieces.
- [ ] **CL-299 · Improve · P2 · M** — Verify light and dark themes with the same semantic states and contrast targets.
- [ ] **CL-300 · Improve · P1 · S** — Maintain a small visual-regression fixture page for core controls and states.

## 13. Responsive and mobile behavior (CL-301..CL-325)

- [x] **CL-301 · Done · P0 · M** — Verify the 390px editor viewport has no document-level horizontal overflow.
- [x] **CL-302 · Done · P0 · M** — Verify both Box canvases render with stable, nonzero mobile dimensions.
- [ ] **CL-303 · Bug · P0 · M** — Test every modal at 320px width with zoomed text and an on-screen keyboard.
- [ ] **CL-304 · Improve · P1 · M** — Switch piece rows to an intentional mobile grid below their content breakpoint.
- [ ] **CL-305 · Improve · P1 · S** — Keep primary calculate and add-piece actions reachable without covering content.
- [ ] **CL-306 · Bug · P1 · M** — Prevent NumberField controls from forcing labels or units outside narrow containers.
- [ ] **CL-307 · Improve · P2 · M** — Make result sheets pan and zoom without hijacking vertical page scrolling.
- [ ] **CL-308 · Improve · P1 · M** — Collapse secondary export actions into a menu on narrow screens.
- [ ] **CL-309 · Improve · P1 · M** — Keep the command palette within safe-area insets and visible keyboard space.
- [ ] **CL-310 · Improve · P2 · S** — Use logical padding that respects notches and browser bottom bars.
- [ ] **CL-311 · Bug · P1 · M** — Test landscape phones where height, rather than width, constrains dialogs and 3D views.
- [ ] **CL-312 · Improve · P2 · S** — Avoid hover-only affordances for selection, labels, and action discovery.
- [ ] **CL-313 · Improve · P1 · M** — Ensure all touch targets remain separate when translated text wraps.
- [ ] **CL-314 · Improve · P2 · M** — Preserve user scroll position when optimization results replace existing sheets.
- [ ] **CL-315 · Improve · P2 · M** — Keep focused inputs visible while the mobile keyboard changes viewport height.
- [ ] **CL-316 · Improve · P1 · S** — Set stable aspect ratios for previews so loading cannot cause layout shifts.
- [ ] **CL-317 · Bug · P1 · M** — Test iOS Safari download, share, clipboard, Worker, and WebGL paths explicitly.
- [ ] **CL-318 · Bug · P1 · M** — Test Android Chrome pointer gestures for drag reorder and orbit controls.
- [ ] **CL-319 · Improve · P2 · S** — Make the navigation collapse state keyboard-operable and persistently understandable.
- [ ] **CL-320 · Improve · P2 · M** — Offer a compact sheet list before rendering every full preview on small devices.
- [ ] **CL-321 · Improve · P2 · S** — Avoid fixed viewport heights that conflict with browser chrome and safe areas.
- [ ] **CL-322 · Improve · P3 · M** — Add installable PWA behavior only after offline assets and update semantics are defined.
- [ ] **CL-323 · Improve · P2 · M** — Test 200% browser zoom at desktop and tablet widths for reflow compliance.
- [ ] **CL-324 · Improve · P1 · S** — Ensure long unbroken imported labels wrap or truncate without widening the page.
- [ ] **CL-325 · Improve · P2 · M** — Create a responsive screenshot matrix for Home and Box at agreed breakpoints.

## 14. Internationalization and formatting (CL-326..CL-350)

- [x] **CL-326 · Done · P0 · S** — Add localized value, increase, decrease, and reorder names for assistive technology.
- [x] **CL-327 · Done · P0 · S** — Localize command failure and storage failure feedback.
- [x] **CL-328 · Done · P0 · S** — Localize 3D assembly, gallery, and cutting-layout accessible names.
- [x] **CL-329 · Done · P1 · S** — Keep RU and EN dictionaries in key parity after new controls are added.
- [x] **CL-330 · Done · P1 · S** — Trim surrounding whitespace from the free-form currency value.
- [x] **CL-331 · Done · P1 · M** — Replace label-based domain decisions with stable IDs before translations evolve.
- [ ] **CL-332 · Improve · P1 · M** — Format display numbers through cached locale-aware formatters.
- [ ] **CL-333 · Bug · P1 · M** — Keep machine exports locale-independent while UI values remain localized.
- [ ] **CL-334 · Improve · P2 · M** — Add plural forms for sheets, pieces, warnings, and selected items.
- [ ] **CL-335 · Improve · P2 · S** — Use named interpolation placeholders instead of sentence fragments assembled in components.
- [ ] **CL-336 · Improve · P2 · S** — Set the document `lang` whenever the application language changes.
- [ ] **CL-337 · Improve · P3 · L** — Prepare layouts with logical CSS properties before adding a right-to-left locale.
- [ ] **CL-338 · Improve · P1 · M** — Test every locale for missing keys, empty values, and placeholder parity.
- [ ] **CL-339 · Bug · P1 · S** — Normalize currency codes for display without silently altering user-defined symbols.
- [ ] **CL-340 · Improve · P2 · M** — Localize dates in snapshot UI while preserving ISO timestamps in stored data.
- [ ] **CL-341 · Improve · P2 · S** — Keep decimal precision rules consistent across inputs, summaries, and exports.
- [ ] **CL-342 · Improve · P2 · M** — Audit text expansion with pseudo-localized strings at 30–50% extra length.
- [ ] **CL-343 · Debt · P2 · M** — Group translation keys by feature and remove keys whose names encode visual placement.
- [ ] **CL-344 · Improve · P2 · S** — Translate validation reasons centrally instead of storing localized errors in domain state.
- [ ] **CL-345 · Idea · P3 · M** — Add locale-aware measurement-unit display while preserving millimeters internally.
- [ ] **CL-346 · Improve · P2 · S** — Document which import and export columns are stable English identifiers.
- [ ] **CL-347 · Bug · P1 · M** — Test Unicode combining marks, emoji, Cyrillic, and CJK labels in SVG and canvas text.
- [ ] **CL-348 · Improve · P3 · S** — Let users override locale without coupling it to browser language permanently.
- [ ] **CL-349 · Improve · P2 · S** — Avoid abbreviations that become ambiguous or untranslatable in compact controls.
- [ ] **CL-350 · Debt · P2 · S** — Add a contributor checklist for translation keys, aria strings, and export stability.

## 15. Testing and quality engineering (CL-351..CL-375)

- [x] **CL-351 · Done · P0 · M** — Add tests for frontend per-piece and total quantity limits.
- [x] **CL-352 · Done · P0 · M** — Add a Rust regression test for excessive expanded quantity.
- [x] **CL-353 · Done · P1 · S** — Test shared palette order and indexed color access.
- [x] **CL-354 · Done · P1 · M** — Test sheet scaling, grain lines, long badge values, and accessible piece names.
- [x] **CL-355 · Done · P1 · M** — Test toast tone, replacement, expiry, and cleanup behavior.
- [x] **CL-356 · Done · P0 · M** — Test debounced storage load/save and surfaced storage errors.
- [x] **CL-357 · Done · P0 · M** — Test pure box constraints and model-level clamping.
- [x] **CL-358 · Done · P0 · S** — Test Three.js material and texture disposal ownership.
- [x] **CL-359 · Done · P0 · M** — Smoke-test Worker optimization, keyboard commands, reorder, and box limits in a browser.
- [x] **CL-360 · Done · P0 · M** — Check real canvas pixels at desktop and mobile sizes to catch blank 3D output.
- [x] **CL-361 · Done · P0 · M** — Add direct optimizer Worker client tests rather than relying only on browser smoke.
- [ ] **CL-362 · Improve · P1 · M** — Add SheetCard component tests for mouse, keyboard, and selected state.
- [ ] **CL-363 · Improve · P1 · L** — Add Playwright workflows for create, optimize, share, reload, undo, export, and box build.
- [ ] **CL-364 · Improve · P1 · M** — Add accessibility checks with axe for both routes and every modal.
- [ ] **CL-365 · Improve · P1 · M** — Add visual snapshots for representative sheets and box parameter sets.
- [ ] **CL-366 · Improve · P0 · L** — Add property tests for placement and box geometry invariants.
- [ ] **CL-367 · Improve · P1 · M** — Test storage migration and recovery against fixture data from older versions.
- [ ] **CL-368 · Improve · P2 · M** — Track flaky tests explicitly and fail builds that silently retry without reporting.
- [ ] **CL-369 · Improve · P2 · S** — Require every fixed defect to include a regression test at the lowest practical layer.
- [ ] **CL-370 · Improve · P2 · M** — Split fast unit, browser smoke, and extended benchmark suites by purpose.
- [ ] **CL-371 · Improve · P1 · M** — Test production-built assets, base path, Worker URL, and WASM MIME behavior.
- [ ] **CL-372 · Improve · P2 · S** — Seed all randomized tests and print the seed on failure.
- [ ] **CL-373 · Improve · P2 · M** — Measure branch coverage around validation, cancellation, and storage errors.
- [ ] **CL-374 · Improve · P2 · S** — Add a pre-release exploratory checklist for keyboard, touch, print, and export.
- [ ] **CL-375 · Debt · P2 · S** — Keep test fixtures small, named by behavior, and free from duplicated opaque snapshots.

## 16. CI, build, and release engineering (CL-376..CL-400)

- [ ] **CL-376 · Improve · P0 · S** — Run frontend type-checking as a named required CI step.
- [ ] **CL-377 · Improve · P0 · S** — Run the full Rust workspace tests in pull requests, not only frontend build checks.
- [ ] **CL-378 · Improve · P1 · S** — Run Clippy with warnings denied on changed Rust code.
- [ ] **CL-379 · Improve · P1 · S** — Check Rust and frontend formatting without rewriting files in CI.
- [ ] **CL-380 · Improve · P1 · S** — Add dependency vulnerability scans with a documented triage policy.
- [ ] **CL-381 · Improve · P1 · S** — Use locked dependency installation and fail when lockfiles drift.
- [ ] **CL-382 · Bug · P1 · M** — Keep `version.json`, package metadata, CLI version, and release tag synchronized.
- [ ] **CL-383 · Improve · P2 · S** — Validate that every release pull request bumps the version exactly once.
- [ ] **CL-384 · Improve · P2 · M** — Generate a concise changelog from merged work while keeping human-curated highlights.
- [ ] **CL-385 · Improve · P2 · S** — Include migration, risk, and rollback notes in every release description.
- [ ] **CL-386 · Improve · P2 · M** — Retain production build artifacts long enough to reproduce deployed failures.
- [ ] **CL-387 · Improve · P0 · M** — Smoke-test the deployed base path, Worker, WASM, routes, and assets after publish.
- [ ] **CL-388 · Idea · P2 · M** — Publish pull-request previews for visual and browser review before merge.
- [ ] **CL-389 · Improve · P1 · S** — Protect `main` with required checks and prevent accidental force pushes.
- [ ] **CL-390 · Improve · P2 · S** — Cache Rust, npm, and WASM build outputs with keys tied to lockfiles and toolchains.
- [ ] **CL-391 · Improve · P2 · S** — Automate dependency update pull requests in small, reviewable groups.
- [ ] **CL-392 · Debt · P1 · S** — Pin the WASM toolchain and document its upgrade procedure.
- [ ] **CL-393 · Debt · P1 · S** — Declare supported Node, npm, and Rust versions in repository metadata.
- [ ] **CL-394 · Improve · P2 · M** — Retain private source maps for debugging without exposing them unintentionally.
- [ ] **CL-395 · Improve · P1 · S** — Set initial and route chunk budgets and explain justified exceptions.
- [ ] **CL-396 · Debt · P2 · M** — Reduce or deliberately isolate the oversized BoxBuilder chunk reported by Vite.
- [ ] **CL-397 · Bug · P1 · S** — Add an explicit repository license or state clearly that no license is granted.
- [ ] **CL-398 · Improve · P3 · M** — Produce a software bill of materials for tagged releases.
- [ ] **CL-399 · Improve · P3 · M** — Sign release tags or attest build provenance when distribution expands.
- [ ] **CL-400 · Improve · P1 · M** — Document and rehearse rollback to the previous known-good static deployment.

## 17. Performance and observability (CL-401..CL-425)

- [x] **CL-401 · Done · P0 · M** — Remove optimizer computation from the UI thread through a module Worker.
- [x] **CL-402 · Done · P1 · S** — Pause Three.js rendering while the page is hidden.
- [ ] **CL-403 · Improve · P1 · M** — Define realistic performance budgets for first load, first optimize, and interaction latency.
- [ ] **CL-404 · Improve · P2 · M** — Preload WASM during idle time only when network and device conditions make it beneficial.
- [ ] **CL-405 · Improve · P2 · M** — Cache locale number formatters used repeatedly during rendering.
- [ ] **CL-406 · Improve · P1 · M** — Profile deep watchers and computed invalidation during rapid piece edits.
- [ ] **CL-407 · Improve · P2 · L** — Virtualize result sheets only after projects large enough to need it are measured.
- [ ] **CL-408 · Improve · P2 · M** — Memoize box geometry by normalized parameter tuple with bounded cache ownership.
- [ ] **CL-409 · Improve · P1 · M** — Track WebGL geometries, textures, programs, and active loops in development diagnostics.
- [ ] **CL-410 · Improve · P2 · M** — Split serialization time from optimizer time in performance measurements.
- [ ] **CL-411 · Improve · P1 · M** — Add User Timing marks around WASM load, optimization, rendering, and export.
- [ ] **CL-412 · Improve · P2 · S** — Batch result-state updates so one optimizer completion produces one coherent render.
- [ ] **CL-413 · Improve · P2 · M** — Avoid rebuilding unchanged sheet SVG view models after unrelated UI changes.
- [ ] **CL-414 · Improve · P2 · M** — Measure label texture cache hit rate and enforce a bounded lifecycle.
- [ ] **CL-415 · Improve · P1 · M** — Add a long-task observer in development to identify interactions exceeding 50ms.
- [ ] **CL-416 · Improve · P2 · S** — Defer noncritical snapshot serialization without delaying visible save state incorrectly.
- [ ] **CL-417 · Improve · P2 · M** — Measure memory before and after repeated optimize, route, and box rebuild cycles.
- [ ] **CL-418 · Improve · P2 · S** — Avoid allocating duplicate expanded piece arrays across JavaScript and Rust where practical.
- [ ] **CL-419 · Improve · P2 · M** — Analyze production bundles on release and store size history.
- [ ] **CL-420 · Improve · P3 · M** — Add opt-in local performance diagnostics export without collecting user projects.
- [ ] **CL-421 · Debt · P2 · S** — Define which metrics are stable enough to compare across versions.
- [ ] **CL-422 · Improve · P2 · M** — Keep observability failures isolated so metrics can never break optimization.
- [ ] **CL-423 · Improve · P3 · M** — Evaluate incremental result rendering only if users need partial layouts.
- [ ] **CL-424 · Improve · P1 · M** — Add regression fixtures for slow devices using CPU throttling in browser tests.
- [ ] **CL-425 · Improve · P2 · S** — Publish measured performance findings before introducing caching or concurrency complexity.

## 18. Security and privacy (CL-426..CL-450)

- [ ] **CL-426 · Improve · P0 · M** — Define a production Content Security Policy covering scripts, Workers, WASM, styles, and blobs.
- [ ] **CL-427 · Improve · P1 · S** — Audit every raw SVG/HTML string interpolation and keep escaping at the serializer boundary.
- [ ] **CL-428 · Bug · P0 · M** — Sanitize imported project objects against prototype pollution and unexpected nested values.
- [ ] **CL-429 · Improve · P1 · S** — Treat share-link state as untrusted input and run the full validator after decoding.
- [ ] **CL-430 · Improve · P1 · M** — Limit decompression and decoding work before compressed share links are introduced.
- [ ] **CL-431 · Improve · P1 · S** — Validate URL schemes before opening any future project or help link from imported data.
- [ ] **CL-432 · Improve · P1 · M** — Review third-party dependencies for maintenance, permissions, and browser supply-chain risk.
- [ ] **CL-433 · Improve · P2 · S** — Remove unused dependencies promptly to reduce update and attack surface.
- [ ] **CL-434 · Improve · P1 · S** — Prevent source maps and debug fixtures from exposing real project data in production.
- [ ] **CL-435 · Improve · P1 · S** — Keep clipboard writes user-initiated and report permission failures clearly.
- [ ] **CL-436 · Improve · P2 · M** — Add a privacy statement explaining local storage, share links, and whether telemetry exists.
- [ ] **CL-437 · Improve · P1 · S** — Never include project contents in remote error reporting without explicit consent.
- [ ] **CL-438 · Improve · P2 · M** — Add “clear local data” with an exact preview and confirmation.
- [ ] **CL-439 · Improve · P2 · S** — Avoid storing sensitive project names in URL query parameters.
- [ ] **CL-440 · Improve · P1 · M** — Verify static hosting headers prevent MIME sniffing and unsafe framing.
- [ ] **CL-441 · Improve · P2 · S** — Add `rel="noopener noreferrer"` to external links opened in a new context.
- [ ] **CL-442 · Improve · P1 · M** — Fuzz CSV, JSON, hash, SVG label, and numeric parsers for denial-of-service inputs.
- [ ] **CL-443 · Improve · P1 · M** — Set practical label and project-name lengths before DOM or export rendering.
- [ ] **CL-444 · Improve · P2 · S** — Keep security-sensitive limits duplicated across language boundaries only with parity tests.
- [ ] **CL-445 · Improve · P2 · M** — Document responsible disclosure and supported-version policy.
- [ ] **CL-446 · Improve · P1 · M** — Audit Worker error messages so stack traces are not shown to end users.
- [ ] **CL-447 · Improve · P2 · M** — Provide integrity or provenance guarantees for deployed static assets when feasible.
- [ ] **CL-448 · Improve · P2 · S** — Review generated download names and MIME types for browser interpretation hazards.
- [ ] **CL-449 · Improve · P1 · M** — Add security checks to the release checklist rather than relying on ad hoc audits.
- [ ] **CL-450 · Debt · P2 · S** — Record the local-first trust model and every boundary where external data enters.

## 19. Product and workshop workflows (CL-451..CL-475)

- [ ] **CL-451 · Idea · P2 · L** — Track reusable offcuts and offer them as stock in future projects.
- [ ] **CL-452 · Idea · P2 · L** — Support multiple materials and stock sizes in one named project.
- [ ] **CL-453 · Idea · P2 · M** — Add a material library with thickness, density, price, kerf, and grain defaults.
- [ ] **CL-454 · Idea · P2 · M** — Mark edges requiring banding and include totals in production output.
- [ ] **CL-455 · Idea · P3 · M** — Estimate project weight from material density and used area.
- [ ] **CL-456 · Idea · P2 · M** — Compare waste cost by sheet and highlight unusually inefficient layouts.
- [ ] **CL-457 · Idea · P3 · M** — Model supplier quantity discounts separately from optimizer geometry.
- [ ] **CL-458 · Idea · P2 · M** — Save reusable project templates with parts, stock, material, and strategy.
- [ ] **CL-459 · Idea · P3 · L** — Add optional sync behind a separate adapter without coupling core logic to a vendor.
- [ ] **CL-460 · Idea · P2 · M** — Generate a printable cut sequence with sheet and piece references.
- [ ] **CL-461 · Idea · P2 · M** — Display rotated-piece count and utilization per result sheet.
- [ ] **CL-462 · Idea · P2 · M** — Explain readiness or quality scores with every contributing rule.
- [ ] **CL-463 · Idea · P3 · M** — Compare two optimizer strategies side by side on the same project.
- [ ] **CL-464 · Idea · P2 · S** — Add sheet presets that users can create, reorder, and share.
- [ ] **CL-465 · Idea · P3 · M** — Simulate how alternate kerf values affect sheet count and waste.
- [ ] **CL-466 · Idea · P2 · M** — Add project tags and search for users with many saved jobs.
- [ ] **CL-467 · Idea · P3 · M** — Archive actual material usage and cost after production for estimate calibration.
- [ ] **CL-468 · Idea · P2 · M** — Add a workshop mode with large labels and only the next cutting step.
- [ ] **CL-469 · Idea · P3 · M** — Export a QR code that opens a read-only project view on a shop-floor device.
- [ ] **CL-470 · Idea · P2 · M** — Allow comments or notes on pieces without overloading the identity label.
- [ ] **CL-471 · Idea · P3 · L** — Support hardware and assembly notes as a separate bill-of-materials domain.
- [ ] **CL-472 · Idea · P2 · M** — Add a deliberate “new project” flow that protects unsaved changes.
- [ ] **CL-473 · Idea · P3 · M** — Show an optimization history so users can return to a prior strategy result.
- [ ] **CL-474 · Idea · P2 · S** — Provide a compact result summary suitable for copying into an estimate or message.
- [ ] **CL-475 · Idea · P3 · L** — Design plugin-like import/export adapters only after two real external integrations exist.

## 20. Documentation, onboarding, and maintenance (CL-476..CL-500)

- [x] **CL-476 · Done · P1 · M** — Maintain one canonical improvement catalog with stable IDs and synchronized summary counts.
- [x] **CL-477 · Done · P1 · M** — Document a small-step architecture reading order and dependency direction.
- [x] **CL-478 · Done · P1 · S** — Add a concise README route from setup to core modules, tests, and deeper documents.
- [x] **CL-479 · Done · P1 · S** — Record which SOLID/DRY extractions landed and which remain.
- [ ] **CL-480 · Improve · P1 · S** — Keep README commands executable from a clean checkout and test them periodically.
- [ ] **CL-481 · Improve · P2 · M** — Add a contributor guide covering scope, tests, versioning, PRs, and review expectations.
- [ ] **CL-482 · Improve · P2 · M** — Write an architecture decision record for the Rust/WASM optimizer boundary.
- [ ] **CL-483 · Improve · P2 · S** — Document Worker ownership, cancellation, and error propagation with a sequence diagram.
- [ ] **CL-484 · Improve · P1 · S** — Document project-state fields, defaults, limits, and migration policy.
- [ ] **CL-485 · Improve · P2 · S** — Add examples for every supported import and export format.
- [ ] **CL-486 · Improve · P2 · M** — Keep screenshots current across RU/EN, desktop/mobile, and both routes.
- [ ] **CL-487 · Improve · P2 · S** — Add module headers only where ownership or invariants are not obvious from code.
- [ ] **CL-488 · Improve · P1 · S** — Define “done” as implementation, tests, docs, browser smoke, and rollback awareness.
- [ ] **CL-489 · Improve · P2 · M** — Add a troubleshooting guide for Worker, WASM, WebGL, storage, and download failures.
- [ ] **CL-490 · Improve · P2 · S** — Document browser support and explicitly tested mobile platforms.
- [ ] **CL-491 · Improve · P2 · S** — Keep public terminology consistent: piece, sheet, stock, kerf, project, and snapshot.
- [ ] **CL-492 · Improve · P1 · S** — Link catalog IDs from pull requests and commits when an item is addressed.
- [ ] **CL-493 · Improve · P2 · S** — Close or rewrite stale recommendations instead of leaving contradictory status text.
- [ ] **CL-494 · Improve · P2 · M** — Add a generated module dependency graph as a review aid, not as architecture authority.
- [ ] **CL-495 · Improve · P1 · S** — Keep examples free of personal, customer, or commercially sensitive data.
- [ ] **CL-496 · Improve · P2 · S** — Record non-goals so future refactors do not introduce speculative infrastructure.
- [ ] **CL-497 · Improve · P2 · M** — Add a release runbook from branch creation through merge, tag, deployment, and verification.
- [ ] **CL-498 · Improve · P2 · S** — Archive obsolete plans or label them historical to prevent competing backlogs.
- [ ] **CL-499 · Improve · P1 · S** — Review architecture docs whenever a dependency direction or state owner changes.
- [ ] **CL-500 · Improve · P1 · S** — Re-rank this catalog after each release using evidence, user impact, and measured risk.

## 21. Editor-inspired next ideas (CL-501..CL-510)

- [ ] **CL-501 · Idea · P2 · M** — Rank command-palette results by category, recency, and local frequency while keeping deterministic keyboard navigation.
- [ ] **CL-502 · Idea · P1 · L** — Add stable-ID multi-selection with a shared inspector for safe bulk edits across non-adjacent pieces.
- [ ] **CL-503 · Idea · P2 · L** — Offer resizable editor panes and compact/focus workspace layouts, persisted locally per device.
- [ ] **CL-504 · Improve · P1 · M** — Build a diagnostics panel with severity, source-piece navigation, and one-click filters for every readiness issue.
- [ ] **CL-505 · Idea · P2 · M** — Let numeric fields evaluate bounded arithmetic and unit expressions with a resolved-value preview before commit.
- [ ] **CL-506 · Idea · P2 · M** — Add a customizable shortcut map with conflict detection, platform-aware modifiers, and one-click reset.
- [ ] **CL-507 · Idea · P3 · L** — Record repeatable action recipes that preview their affected pieces and commit as one undoable transaction.
- [ ] **CL-508 · Idea · P2 · M** — Save named editor views containing query, diagnostics filter, sort mode, and visible inspector state.
- [ ] **CL-509 · Idea · P2 · L** — Compare two layouts with a scrubber or ghost overlay while preserving selected-piece highlighting.
- [ ] **CL-510 · Improve · P1 · L** — Add a compact append-only local recovery journal that can replay named actions after an abrupt tab or browser crash.

## 22. Multi-role architecture review findings (CL-511..CL-520)

Findings from the 2026-08-05 multi-agent review of the editor refactor
(PRs #81-#86) that were confirmed against the code but are too large for a
single slice. Small confirmed fixes landed with this change set.

- [ ] **CL-511 · Debt · P1 · L** — Split `PieceEditorPanel` (23 props, 6 v-models, 30 emits relayed one-to-one from `Home.vue`) into cohesive children (readiness/preflight header, filter toolbar, bulk-transform strip, selected-piece inspector, piece list) and move panel-local UI state (transform/round steps, drag indexes) down into the panel.
- [ ] **CL-512 · Bug · P0 · M** — Add a persisted-state migration ladder (v1 -> v2 -> current) for `home_state`, `project_snapshots`, and `operation_log`; stash unparseable blobs under a recovery key instead of discarding them (extends CL-128..CL-132: today any version bump silently wipes user data).
- [ ] **CL-513 · Debt · P1 · M** — Make optimization results reference pieces by `source_id` only and join to live pieces at render time, so metadata edits stay live and geometry edits can mark the result "stale" (banner) instead of destroying it.
- [ ] **CL-514 · Improve · P2 · M** — Keep one warm optimizer worker (respawn only on cancel/crash) so each calculation stops paying worker startup plus WASM compile; collapse the four serialization hops per round-trip.
- [ ] **CL-515 · Debt · P1 · M** — Replace the `false`/`null` truthiness veto in `useProjectActions.run` with an explicit `{ changed: boolean }` contract, and normalize `usePieceList` mutator return types to it.
- [ ] **CL-516 · Debt · P2 · M** — Fold the operation log and pre-destructive auto-snapshots into `PROJECT_ACTION_EFFECTS` (e.g. `log`, `autoSnapshot` flags) so the registry covers all effects instead of hand-wired call sites in `Home.vue`.
- [ ] **CL-517 · Improve · P1 · M** — Add a `Home.vue` mount test covering the highest-risk wiring: initial load order (load -> activity -> history reset), first-undo no-op, edit-invalidates-result, undo/redo round-trip, and the share-hash path.
- [ ] **CL-518 · Improve · P1 · M** — Add a contract test that runs the real built WASM through `optimize()` with a small fixture, pinning the snake_case TS<->Rust JSON contract to the binary instead of a hand-written fixture; add a minimal Playwright smoke for enter pieces -> calculate -> export.
- [ ] **CL-519 · Debt · P2 · S** — Move `selectedStrategy` and `minMachineCut` into `HomeState` (optional, back-compatible) so reload, share links, snapshots, and undo agree on what a project is.
- [ ] **CL-520 · Debt · P2 · S** — Delete or wire up unused composable surface (`actionTrail`/`lastAction` per-keystroke allocation, `useCosting.reset`, `useProjectState.reset`, `useOptimizationSession.isRunning`), and regenerate the ARCHITECTURE.md module map from the tree so it stops lagging the code.

## Working rule

Select one ID or a tightly related handful, write the failing test or invariant,
change the smallest owning module, run the relevant unit and browser checks, and
only then mark the item complete. Add a new stable ID only for a distinct finding;
rewrite or remove obsolete duplicates instead of growing competing lists.
