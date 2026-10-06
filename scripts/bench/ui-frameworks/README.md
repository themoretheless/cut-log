# CutLog UI benchmark: Vue 3, Svelte 5, and retained DOM

This is an isolated, reproducible UI experiment. It does **not** claim that the
whole CutLog application has been ported to Svelte or to a handwritten renderer.

The checked-in local findings are in [results/RESULTS.md](results/RESULTS.md).

The suite compares three equivalent production entries in one Chromium process:

- Vue 3 templates and compiler-informed Virtual DOM;
- Svelte 5 compiled templates and fine-grained effects, without a Virtual DOM;
- a specialized retained-DOM control written in TypeScript.

The retained control stores real SVG nodes by the same keys as the framework
variants, caches the last serialized attribute values, delegates piece events,
and pools temporarily detached SKÅDIS slot nodes. It does not build a virtual
tree or create one reactive effect per binding. It is an optimized lower bound,
not a third general-purpose framework: reconciliation, lifecycle, accessibility,
and cache bounds are application code's responsibility.

The workloads are:

- `layout-normal`: 6 sheets and 240 placed pieces;
- `layout-stress-2000`: the product limit of 2,000 placed pieces;
- `skadis-large-svg`: the shared `skadisSlots` geometry with 5,222 initial SVG
  slots.

All variants render the same semantic DOM, use the same pure CutLog TypeScript
modules and CSS, and are built together by one Vite configuration. Before any
timing is accepted, the runner compares a canonical DOM fingerprint after mount,
after every prepared baseline, and after every measured transition. Large
immutable fixtures use `shallowRef` in Vue and Svelte 5 `$state.raw`, so neither
framework pays for deep proxies that the product data flow does not need.

## What is measured

- cold mount through DOM flush and forced browser layout;
- selection from no selection, switching A → B, and clearing selection;
- replacement of all placement coordinates;
- SKÅDIS pitch and board-size changes;
- production JS + CSS bytes (raw, gzip, and Brotli).

Every update sample has a deterministic baseline prepared outside the timer.
The timed interval includes state/geometry work, DOM patching, style, and forced
layout. `skadisSlots(settings)` runs inside every measured implementation update;
the retained variant does not cache a precomputed geometry answer.

Update measurements are steady-state after warm-up. The retained SKÅDIS entry
therefore reuses its pool of real slot nodes when a board expands again. Cold
node creation remains visible in the separate mount metric.

The benchmark intentionally excludes the optimizer Worker, WASM loading, Rust
packing time, persistence, router, Three.js, and full-application cold-start
metrics. Those paths are either framework-independent or require a complete
product port to compare honestly.

## Run

Node 22 or newer and a Chromium-family browser are required.

```bash
cd scripts/bench/ui-frameworks
npm ci
npm run check
npm run bench
```

The runner looks for Edge, Chrome, or Chromium in standard locations. Override
that choice when needed:

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/path/to/chrome npm run bench
```

Useful runner options:

```bash
node scripts/run.mjs --rounds=6 --samples=20 --warmups=5 --output=results/local.json
```

Six rounds cover all six implementation orders, so each entry occupies every
position twice. Use a multiple of six for publication runs. The report contains
median, p95, median absolute deviation (MAD), all raw samples, browser and
machine identity, canonical correctness fingerprints, and bundle asset lists.
Re-run on an otherwise idle machine; absolute timings should not be compared
across different hardware or browsers.

## Interpreting the result

Svelte already avoids a Virtual DOM and caches DOM nodes and prior attribute
values. Its cost in this workload is the fan-out through thousands of item and
template effects when an immutable array snapshot is replaced. The retained
control instead routes a domain operation directly to cached nodes: geometry
visits the stable records, while A → B selection visits only the two affected
piece records.

That specialization can be used for one heavy SVG subtree inside the existing
Vue application. It is not evidence that the product should replace Vue, and it
does not eliminate the browser cost of thousands of necessary SVG mutations,
style calculation, and layout.
