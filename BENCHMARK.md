# Svelte, Svet and Forma on the same list

Both libraries come from the release branch of the forma repository at
`89bc748`, release 0.3.5: the Forma crate through Cargo, which also brings
svet-wasm 0.3.5, and svet-engine 0.3.5 built from `packages/svet` on that
commit (`frontend-svet/vendor/SVET_REVISION`). All
three were re-measured in one session on freshly loaded pages.

One machine, one browser, the same content in all three: 300 rows of
`Piece N  W x H  1`, alternating with the 111 rows that match `Piece 1`.
Medians of 12 runs after three warm-up runs.

Every list is keyed by the same stable piece id. An earlier run keyed the
Svelte list by index while Svet keyed by id, which gave Svelte more text to
rewrite on every transition and overstated the gap by roughly a factor of two.

| | Svelte 5 | svet-engine |
|---|---|---|
| 300 rows, commit | 3.6 ms | 0.5 ms |
| 300 rows, forced layout | 0.5 ms | 0.4 ms |
| 300 rows, total | **4.1 ms** | **1.0 ms** |
| 111 rows, total | 2.1 ms | 0.3 ms |

Dropping to 111 rows is where they diverge most: removing 189 keyed rows costs
svet-engine 0.3 ms against Svelte's 2.1 ms.

Both write to the DOM and both stop where the browser's own raster begins, so
these two columns are directly comparable.

Forma is deliberately not a third column here. It is a canvas renderer with no
step that corresponds to a DOM commit, every change reloads the whole scene
rather than reconciling a keyed list, and its timings include rasterising the
pixels, which the two columns above exclude. Its phases are listed separately
below.

## Forma, measured by phase

One change of a 300 row scene, medians of 8 on a freshly loaded page:

| Phase | 300 rows | 111 rows |
|---|---|---|
| Markup generation | 0.2 ms | 0.2 ms |
| `load_component`, parse and layout | 4.5 ms | 3.9 ms |
| First geometry request after the change | 8.5 ms | 3.3 ms |
| The same geometry requested again | 0.5 ms | 0.5 ms |
| Upload and submit, 3.4 MB | 1.3 ms | 0.5 ms |
| CPU total | **14.3 ms** | **7.7 ms** |
| Until the GPU reports the frame done | 3.6 ms | 3.6 ms |

The parse and layout figure needs a fresh page. On a tab that has been running
measurements for a while it drifts to 29 ms and beyond for the same scene,
which looks like allocation churn in the harness rather than a property of the
engine: the geometry figure stays put across the same runs.

Two causes, both measured rather than inferred.

**Glyphs are tessellated per instance.** With the text removed the same 300
controls build their geometry in 0.2 ms; with 22 characters per row it is
11 to 16 ms across runs and 754 792 floats of edge data. 300 identical rows cost the same as 300
distinct ones (15.7 ms against 14.4 ms), so nothing is reused between rows that
draw the same glyphs. The scene holds 6600 glyphs drawn from about 40 distinct
shapes.

**A browser cannot update a scene in place.** `set_binding_value`,
`set_binding_text` and `set_binding_disabled` live in the `impl Runtime` block
that carries no `#[wasm_bindgen]`, so the generated bindings expose only `load`,
`load_component` and `load_ui_files_json`. Every change re-parses and re-lays
out the whole scene, which is what makes the two costs above recur.

## Releases since `600a0dd` embed 18 MB of fonts

The Forma wasm grew from 1.3 MB on `2fe6a7b` to 20 MB on `600a0dd`, and stays there on 0.3.5. Its data
section is 18.3 MB: `crates/forma/src/text.rs` pulls the CJK fallback
`NotoSansSC.ttf` (17.8 MB) and an emoji font in with `include_bytes!`, with no
feature to leave them out, so every browser build ships them whether or not it
draws a single CJK glyph.

## Before svet and across svet releases

"Before svet" is the Svelte 5 frontend this branch started from. Every svet
release that ships `build:package` (forma-v0.3.0 through v0.3.6; forma-v0.2.0
has no package build) was built from its tag and loaded into a fresh iframe
through `frontend-svet/?v=<tag>`. Medians of total ms (build + commit +
layout), three fresh pages each, warmup 3; the 300-row cases take 12
iterations, the 5000-row cases 10. Spread between pages was within 0.1 ms for
300 rows and about 2 ms for 5000.

| Build | 300 rows | filter to 111 | create 5000 | filter to 1111 | clear 5000 |
|---|---:|---:|---:|---:|---:|
| Svelte 5 (before svet) | 5.2 | 3.4 | 119.2 | 8.7 | 0.8 |
| svet forma-v0.3.0 (`32adc5d`) | 1.4 | 0.3 | 45.3 | 5.8 | 1.2 |
| svet v0.3.1 (`8e56a23`) | 1.3 | 0.3 | 46.0 | 5.5 | 1.3 |
| svet v0.3.2 (`0b9efd4`) | 1.3 | 0.3 | 44.7 | 6.2 | 1.3 |
| svet v0.3.3 (`43727ef`) | 1.3 | 0.3 | 45.0 | 6.0 | 1.3 |
| svet v0.3.4 (`2f15cb6`) | 1.3 | 0.3 | 45.3 | 5.7 | 1.3 |
| svet v0.3.5 (`ee6ca83`) | 1.3 | 0.3 | 45.8 | 6.3 | 1.3 |
| svet v0.3.6 (`a01d576`) | 1.3 | 0.3 | 46.7 | 5.7 | 1.4 |

Svet is 2.6x faster than Svelte creating 5000 rows and 4-10x faster on the
small transitions; only clearing is slower, by half a millisecond. Between
svet releases nothing moves beyond the page-to-page noise: the list path
(signal, `<For>`, WASM LIS) has not changed in speed from 0.3.0 to 0.3.6.

## Where svet loses, and the fix

The list cases above only create, filter and clear. `ops.js` adds the
js-framework-benchmark style operations, applied identically by both
harnesses (`__svetBench.op` / `__svelteBench.op`), with rows that bind their
text reactively through `current()` so updates reach the DOM. Medians over
three fresh pages, 2 warmup and 8 measured passes, ms:

| Operation | Svelte 5 | svet v0.3.6 | svet `b327856` |
|---|---:|---:|---:|
| create 1k | 6.6 | 5.6 | 5.0 |
| update every 10th | 2.1 | 1.2 | 1.1 |
| swap two rows | 1.6 | 0.4 | 0.3 |
| remove one | 1.5 | 0.3 | 0.3 |
| append 1k to 1k | 12.1 | 6.0 | 5.2 |
| replace 1k | 10.5 | 11.5 | 9.4 |
| clear 2k | 0.6 | 1.6 | 0.9 |
| create 10k | 241.1 | 85.3 | 68.8 |
| clear 10k | 7.0 | 33.6 | 9.4 |

Svet lost on every operation that removes rows. With static row text, clear
10k took 6.8 ms, as fast as Svelte, so the cost sat in what each row owns:
`insertChild` built a content root, a disposer cell and a publish step for
every run of `() => current().text`, each row was a public `createRoot` with
its own disposer closure and WeakMap entry, and every teardown step
re-entered `untrack`. Profiles came from the JS Self-Profiling API on a page
served with `Document-Policy: js-profiling`.

Branch `claude/svet-for-bulk-clear` in forma (`c562698`, `b327856`):

- reactive children that resolve to text and register no cleanups run in the
  effect's own scope and patch one text node; the first DOM result or owned
  run moves into the general path, so transactional replacement still holds;
- `For` rows own a detached scope held only by their record, disposed
  directly in their core, instead of a public root;
- row item and index signals are disposed and written through their state,
  without defining `dispose` and `set` on every handle;
- a `For` whose rows fill their parent disposes them inside one untrack frame
  and removes them with one `textContent` write;
- `untrack` and `runUntrackedInCore` return early when nothing observes, and
  leaf owner scopes skip the traversal stack.

All 1525 svet tests pass, including three new ones in
`tests/for-bulk-clear.test.ts`. Svet now wins or ties every operation except
clear, where it is 1.3-1.5x Svelte instead of 4.8x. About a quarter of what
remains is the DOM write itself; the rest is disposing each row's effect and
item signal, which are separate nodes in the WASM graph, so closing the gap
further means changing how rows map onto that graph rather than trimming JS.

## Svet in the older Forma measurement

On `2fe6a7b`, the release this section describes, `vector-ui/Cargo.toml` depended on tokenizer, serde_json,
wasm-bindgen and ttf-parser, with the gpu crates behind optional native
features. It does not depend on svet-wasm; that dependency exists only on
`main`, where it is used by `binding.rs` and `native_document_graph.rs`, the
reactive binding graph rather than text or raster. Release `600a0dd` now
links svet-wasm into the Forma crate as well. Switching the dependency to
`main` would therefore leave the 16 ms of tessellation untouched, and the graph
it accelerates is reached through the binding setters that the browser build
does not export.

The `svet-engine` column above is the TypeScript and WASM framework in
`packages/svet`, which is a different product from the Rust library and the
only one of the two that competes with Svelte directly.

## Reproducing

```sh
npm ci --prefix frontend && npm run dev --prefix frontend   # /cut-log/bench.html
python3 -m http.server 5175 --directory frontend-svet       # svet-engine, see its README
python3 -m http.server 5174 --directory frontend-forma      # Forma, see its README
```

Each page exposes a `render(count, filter)` helper on `window` that returns the
phase timings for one transition.
