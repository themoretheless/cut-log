# Svelte, Svet and Forma on the same list

One machine, one browser, the same content in all three: 300 rows of
`Piece N  W x H  1`, alternating with the 111 rows that match `Piece 1`.
Medians of 12 runs after three warm-up runs.

Every list is keyed by the same stable piece id. An earlier run keyed the
Svelte list by index while Svet keyed by id, which gave Svelte more text to
rewrite on every transition and overstated the gap by roughly a factor of two.

| | Svelte 5 | svet-engine | Forma |
|---|---|---|---|
| 300 rows, commit | 3.2 ms | 0.7 ms | 24 ms |
| 300 rows, forced layout | 0.7 ms | 0.7 ms | n/a |
| 300 rows, total | **3.8 ms** | **1.3 ms** | **~26 ms** |
| 111 rows, total | 3.3 ms | 0.5 ms | ~13 ms |

Svelte and svet-engine both write to the DOM, so their numbers stop where the
browser's own raster begins. Forma draws the pixels itself, so its number
covers more work and the three columns are not interchangeable.

## Forma: where its 26 ms go

| Phase | 300 rows |
|---|---|
| Markup generation | 0.2 ms |
| `load_component`, parse and layout | ~8 ms |
| First geometry request after the change | 14.6 ms |
| The same geometry requested again | 0.5 ms |
| Upload and submit, 3.4 MB | ~2 ms |

Two causes, both measured rather than inferred.

**Glyphs are tessellated per instance.** With the text removed the same 300
controls build their geometry in 0.2 ms; with 22 characters per row it is
16 ms and 754 792 floats of edge data. 300 identical rows cost the same as 300
distinct ones (15.7 ms against 14.4 ms), so nothing is reused between rows that
draw the same glyphs. The scene holds 6600 glyphs drawn from about 40 distinct
shapes.

**A browser cannot update a scene in place.** `set_binding_value`,
`set_binding_text` and `set_binding_disabled` live in the `impl Runtime` block
that carries no `#[wasm_bindgen]`, so the generated bindings expose only `load`,
`load_component` and `load_ui_files_json`. Every change re-parses and re-lays
out the whole scene, which is what makes the two costs above recur.

## Svet was not part of the Forma measurement

`vector-ui/Cargo.toml` on the release branch depends on tokenizer, serde_json,
wasm-bindgen and ttf-parser, with the gpu crates behind optional native
features. It does not depend on svet-wasm; that dependency exists only on
`main`, where it is used by `binding.rs` and `native_document_graph.rs`, the
reactive binding graph rather than text or raster. Switching the dependency to
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
