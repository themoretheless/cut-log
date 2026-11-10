# CutLog list on svet-engine

The same rows as `frontend/bench.html` and `frontend-forma`, rendered through
svet-engine's signal and `<For>`, so the three can be compared on one machine.

The engine is not published to a registry, so its built package is copied from
a checkout of the library next to this repository:

```sh
cp -R ../forma/packages/svet/dist/package frontend-svet/vendor/svet-engine
python3 -m http.server 5175 --directory frontend-svet
```

Build it first with `npm run build:package` in `packages/svet` if `dist` is
missing or stale.

`main.js` imports `reactivity.js` and `dom.js` directly rather than the package
barrel: the barrel also re-exports the JSX compiler, which pulls `@babel/parser`
and cannot resolve from a plain static server.

`window.__svetBench.render(count, filter)` applies one transition and returns
its phase timings.

The measured build comes from the release branch, whose commit is recorded in
`vendor/SVET_REVISION`:

```sh
git -C ../forma worktree add --detach /tmp/forma-release origin/release
(cd /tmp/forma-release/packages/svet && npm ci && npm run build:package)
cp -R /tmp/forma-release/packages/svet/dist/package frontend-svet/vendor/svet-engine
git -C ../forma rev-parse --short origin/release > frontend-svet/vendor/SVET_REVISION
```
