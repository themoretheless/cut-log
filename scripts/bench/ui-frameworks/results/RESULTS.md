# Local result: Vue 3.5.38 vs Svelte 5.56.9 vs retained DOM

Measured on 2026-08-29 using an Apple M4 Max, Node 26.7.0, and Microsoft Edge
150.0.4078.105 (Chromium), at 1440 × 900 and DPR 1. The runner used six
balanced-order rounds, five warm-ups, and 20 measured samples per round: 120
samples for every implementation/metric pair.

The runner verified canonical semantic-DOM parity at the initial state, every
prepared baseline, and every completed operation:

- normal layout: 883 elements, 6 SVGs, 240 selectable pieces;
- stress layout: 6,721 elements, 20 SVGs, 2,000 selectable pieces;
- SKÅDIS: 5,241 elements, 1 SVG, 5,222 initial slots.

An additional browser audit confirmed that retained layout preserves all 2,000
piece nodes, 20 articles, and 20 SVGs across geometry replacement. The retained
SKÅDIS pool reuses surviving and temporarily detached slot nodes. Click, Enter,
Space, destroy, and remount behavior also passed.

## UI runtime

Values are median / p95. Timings include the implementation update, shared
geometry calculation, DOM mutation, style, and forced browser layout. Baseline
preparation happens outside the timer. A retained switch-selection median below
the browser timer's 0.1 ms resolution is written as `<0.1` rather than zero.

| workload | operation | Vue | Svelte | retained DOM |
|---|---|---:|---:|---:|
| 6 sheets / 240 pieces | mount | 3.80 / 4.20 ms | 4.50 / 6.10 ms | **3.35 / 4.00 ms** |
| 6 sheets / 240 pieces | select from none | 0.80 / 0.90 ms | 0.40 / 0.50 ms | **0.20 / 0.30 ms** |
| 6 sheets / 240 pieces | switch A → B | 0.50 / 0.60 ms | 0.20 / 0.30 ms | **<0.10 / 0.10 ms** |
| 6 sheets / 240 pieces | clear selection | 0.80 / 0.90 ms | 0.40 / 0.50 ms | **0.20 / 0.30 ms** |
| 6 sheets / 240 pieces | replace geometry | 1.70 / 1.80 ms | 2.00 / 2.50 ms | **1.20 / 1.40 ms** |
| 20 sheets / 2,000 pieces | mount | 28.00 / 30.80 ms | 36.20 / 80.90 ms | **24.75 / 28.00 ms** |
| 20 sheets / 2,000 pieces | select from none | 6.40 / 8.00 ms | 4.10 / 4.60 ms | **2.40 / 2.80 ms** |
| 20 sheets / 2,000 pieces | switch A → B | 3.70 / 4.40 ms | 1.30 / 1.60 ms | **<0.10 / 0.10 ms** |
| 20 sheets / 2,000 pieces | clear selection | 6.20 / 7.10 ms | 4.20 / 5.10 ms | **2.20 / 2.50 ms** |
| 20 sheets / 2,000 pieces | replace geometry | 15.50 / 16.90 ms | 22.50 / 25.10 ms | **12.80 / 14.50 ms** |
| 5,222 SKÅDIS slots | mount | **12.50 / 15.40 ms** | 17.70 / 20.40 ms | 13.70 / 17.20 ms |
| 5,222 → 3,602 slots | change pitch | 6.60 / 7.30 ms | 11.00 / 11.90 ms | **6.55 / 7.30 ms** |
| 5,222 → 6,797 slots | expand board | 12.60 / 13.90 ms | 17.65 / 19.80 ms | **10.80 / 11.80 ms** |

The retained control was 17.4% faster than Vue and 43.1% faster than Svelte on
the 2,000-piece geometry replacement. For SKÅDIS pitch it matched Vue within
0.05 ms; for board expansion its pooled node reuse was 14.3% faster than Vue.
Vue retained the best cold SKÅDIS mount by 1.2 ms.

A `MutationObserver` audit ruled out skipped visual work: all three variants
performed exactly 2,003 attribute mutations for selection from none and 10,520
for the stress geometry replacement. On board expansion, retained DOM performed
the same 9,923 meaningful SVG attribute mutations as Svelte, but inserted the
1,575 pooled slot nodes in one `DocumentFragment` batch instead of 1,575
separate slot insertion records.

The near-zero A → B result is a domain-indexing win, not a magical zero-cost
DOM update: the retained renderer uses its `sourceId → nodes` index and touches
only the old and new piece records. Null ↔ selected still visits every piece
because every `fill-opacity` genuinely changes.

## Production JS + CSS

These figures include every generated JS/CSS asset loaded by the standalone
entry, but not its nearly identical HTML document.

| workload | Vue raw / gzip / Brotli | Svelte raw / gzip / Brotli | retained raw / gzip / Brotli |
|---|---:|---:|---:|
| layout | 70.79 / 28.11 / 25.51 KiB | 54.82 / 21.31 / 19.12 KiB | **15.21 / 6.63 / 5.79 KiB** |
| SKÅDIS | 66.86 / 26.74 / 24.25 KiB | 50.13 / 19.68 / 17.69 KiB | **8.92 / 4.40 / 3.78 KiB** |

## Decision

Yes, CutLog can avoid both Virtual DOM traversal and Svelte's per-item reactive
fan-out for its heavy SVG subtrees. A retained-DOM renderer with cached real
nodes is faster here, especially for targeted selection and repeated structural
changes where pooled nodes can be reused.

Do not rewrite the whole product around handwritten DOM. The retained entry is
specialized code and owns reconciliation, conditional-node changes, event
lifecycle, accessibility, and cache limits. The practical architecture is to
keep Vue for application UI and use retained DOM only behind the largest SVG
component if profiling shows a user-visible problem.

The optimizer Worker, WASM/Rust packing, router, persistence, Three.js, and
full-app cold loading were intentionally not measured. The raw local report is
generated as `results/latest.json` and is intentionally git-ignored.
