# CutLog on Forma/Svet

Browser host for the Forma UI library, used to measure it against the Svelte
frontend on the same machine and the same content.

Forma is linked as a crate from the release branch of the library repository:

```toml
forma = { git = "https://github.com/themoretheless/forma.git", branch = "release" }
```

`crates/forma-ui` generates the scene markup, re-exports a `Runtime` so the
linker keeps the engine, and ships Forma's WGSL, which its build script copies
out of the revision Cargo resolved. The browser build of Forma is compiled
without the native `gpu` feature, so the shader is not reachable through its
API, and a hand-copied file would drift from the pinned revision.

## Build and run

```sh
cargo build -p cutter-forma-ui --release --target wasm32-unknown-unknown
wasm-bindgen target/wasm32-unknown-unknown/release/cutter_forma_ui.wasm \
  --target web --out-dir frontend-forma/wasm
python3 -m http.server 5174 --directory frontend-forma
```

`window.__forma.render(count, filter)` loads a scene of that many rows, paints
it and returns the phase timings.

The engine draws every control itself: `painter.js` only uploads the arrays
Forma emits and runs Forma's own shader, so no geometry is built in JavaScript.
