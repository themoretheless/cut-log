# Svelte, Svet and Forma on the same list

Both libraries come from the release branch of the forma repository at
`600a0dd`: the Forma crate through Cargo, svet-engine built from
`packages/svet` on that commit (`frontend-svet/vendor/SVET_REVISION`). All
three were re-measured in one session on freshly loaded pages.

One machine, one browser, the same content in all three: 300 rows of
`Piece N  W x H  1`, alternating with the 111 rows that match `Piece 1`.
Medians of 12 runs after three warm-up runs.

Every list is keyed by the same stable piece id. An earlier run keyed the
Svelte list by index while Svet keyed by id, which gave Svelte more text to
rewrite on every transition and overstated the gap by roughly a factor of two.

| | Svelte 5 | svet-engine |
|---|---|---|
| 300 rows, commit | 2.2 ms | 0.4 ms |
| 300 rows, forced layout | 0.4 ms | 0.3 ms |
| 300 rows, total | **2.7 ms** | **0.7 ms** |
| 111 rows, total | 1.6 ms | 0.2 ms |

Dropping to 111 rows is where they diverge most: removing 189 keyed rows costs
svet-engine 0.2 ms against Svelte's 1.6 ms.

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
| `load_component`, parse and layout | 4.4 ms | 3.8 ms |
| First geometry request after the change | 8.5 ms | 3.3 ms |
| The same geometry requested again | 0.5 ms | 0.5 ms |
| Upload and submit, 3.4 MB | 1.3 ms | 0.6 ms |
| CPU total | **14.2 ms** | **7.7 ms** |
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

## Release `600a0dd` embeds 18 MB of fonts

The Forma wasm grew from 1.3 MB on `2fe6a7b` to 20 MB on `600a0dd`. Its data
section is 18.3 MB: `crates/forma/src/text.rs` pulls the CJK fallback
`NotoSansSC.ttf` (17.8 MB) and an emoji font in with `include_bytes!`, with no
feature to leave them out, so every browser build ships them whether or not it
draws a single CJK glyph.

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
