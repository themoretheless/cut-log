# Top 100 repository benchmark

Snapshot date: 2026-07-18. This is a relevance benchmark for CutLog, not a
claim that star count alone measures engineering quality. The catalog uses five
cohorts of 20 repositories so a niche cutting solver is compared with its real
peers instead of being displaced by unrelated globally popular projects.

Repositories were discovered with GitHub repository/topic search, sorted by
stars inside each cohort, deduplicated, and verified through the GitHub API.
Stars are a point-in-time signal. For the implementation decisions below, source
files from the leading editors were inspected as well as their README files.

## 1. Cutting, nesting, and packing (20)

| # | Repository | Stars |
|---:|---|---:|
| 1 | [tamasmeszaros/libnest2d](https://github.com/tamasmeszaros/libnest2d) | 431 |
| 2 | [JeroenGar/sparrow](https://github.com/JeroenGar/sparrow) | 305 |
| 3 | [fontanf/packingsolver](https://github.com/fontanf/packingsolver) | 251 |
| 4 | [bozokopic/opcut](https://github.com/bozokopic/opcut) | 183 |
| 5 | [JeroenGar/jagua-rs](https://github.com/JeroenGar/jagua-rs) | 177 |
| 6 | [deepnest-next/deepnest](https://github.com/deepnest-next/deepnest) | 173 |
| 7 | [emadehsan/csp](https://github.com/emadehsan/csp) | 155 |
| 8 | [kallaballa/libnfporb](https://github.com/kallaballa/libnfporb) | 130 |
| 9 | [fel88/DeepNestPort](https://github.com/fel88/DeepNestPort) | 130 |
| 10 | [VovaStelmashchuk/nest2d](https://github.com/VovaStelmashchuk/nest2d) | 82 |
| 11 | [DanielLiamAnderson/Packaide](https://github.com/DanielLiamAnderson/Packaide) | 66 |
| 12 | [fabiofdsantos/2d-cutting-stock-problem](https://github.com/fabiofdsantos/2d-cutting-stock-problem) | 65 |
| 13 | [petrasvestartas/OpenNest](https://github.com/petrasvestartas/OpenNest) | 47 |
| 14 | [Ultimaker/pynest2d](https://github.com/Ultimaker/pynest2d) | 41 |
| 15 | [nico-schluter/FuseNest](https://github.com/nico-schluter/FuseNest) | 36 |
| 16 | [AlexanderMorozovDesign/Linear_Cutting](https://github.com/AlexanderMorozovDesign/Linear_Cutting) | 34 |
| 17 | [lryan599/2DNesting](https://github.com/lryan599/2DNesting) | 32 |
| 18 | [MasumBhuiyan/2D-Irregular-Cutting-Stock-Algorithm](https://github.com/MasumBhuiyan/2D-Irregular-Cutting-Stock-Algorithm) | 28 |
| 19 | [gcalero/CuttingOptimizer](https://github.com/gcalero/CuttingOptimizer) | 13 |
| 20 | [Waterboy1602/nestasm](https://github.com/Waterboy1602/nestasm) | 10 |

Strong recurring ideas: explicit solver strategies, deterministic fixtures,
separate geometry kernels, progress/cancellation for expensive searches, and
measurement against known benchmark instances. CutLog already has the right
Rust/WASM split, but still needs placement invariants, benchmark fixtures, and
cooperative progress (`CL-026` to `CL-049`, `CL-059`, `CL-060`).

## 2. Editors, diagramming, and CAD (20)

| # | Repository | Stars |
|---:|---|---:|
| 21 | [microsoft/vscode](https://github.com/microsoft/vscode) | 187,622 |
| 22 | [excalidraw/excalidraw](https://github.com/excalidraw/excalidraw) | 127,742 |
| 23 | [jgraph/drawio-desktop](https://github.com/jgraph/drawio-desktop) | 62,155 |
| 24 | [penpot/penpot](https://github.com/penpot/penpot) | 56,732 |
| 25 | [tldraw/tldraw](https://github.com/tldraw/tldraw) | 48,880 |
| 26 | [drawdb-io/drawdb](https://github.com/drawdb-io/drawdb) | 38,116 |
| 27 | [FreeCAD/FreeCAD](https://github.com/FreeCAD/FreeCAD) | 32,193 |
| 28 | [fabricjs/fabric.js](https://github.com/fabricjs/fabric.js) | 31,326 |
| 29 | [paperjs/paper.js](https://github.com/paperjs/paper.js) | 15,061 |
| 30 | [konvajs/konva](https://github.com/konvajs/konva) | 14,625 |
| 31 | [openscad/openscad](https://github.com/openscad/openscad) | 9,760 |
| 32 | [ikuaitu/vue-fabric-editor](https://github.com/ikuaitu/vue-fabric-editor) | 7,914 |
| 33 | [LibreCAD/LibreCAD](https://github.com/LibreCAD/LibreCAD) | 6,116 |
| 34 | [Hufe921/canvas-editor](https://github.com/Hufe921/canvas-editor) | 4,999 |
| 35 | [xiangechen/chili3d](https://github.com/xiangechen/chili3d) | 4,686 |
| 36 | [solvespace/solvespace](https://github.com/solvespace/solvespace) | 4,045 |
| 37 | [awslabs/diagram-maker](https://github.com/awslabs/diagram-maker) | 2,418 |
| 38 | [bpmn-io/diagram-js](https://github.com/bpmn-io/diagram-js) | 1,906 |
| 39 | [camunda/camunda-modeler](https://github.com/camunda/camunda-modeler) | 1,691 |
| 40 | [F-star/suika](https://github.com/F-star/suika) | 966 |

Strong recurring ideas: command registries, stable object IDs, explicit editor
stores, transactional history, derived selection models, focus management, and
serializers that do not own UI effects. This batch adopts the smallest useful
versions of those patterns without importing an editor framework.

## 3. Local-first and offline products (20)

| # | Repository | Stars |
|---:|---|---:|
| 41 | [AppFlowy-IO/AppFlowy](https://github.com/AppFlowy-IO/AppFlowy) | 73,961 |
| 42 | [toeverything/AFFiNE](https://github.com/toeverything/AFFiNE) | 70,545 |
| 43 | [usememos/memos](https://github.com/usememos/memos) | 61,620 |
| 44 | [laurent22/joplin](https://github.com/laurent22/joplin) | 55,624 |
| 45 | [siyuan-note/siyuan](https://github.com/siyuan-note/siyuan) | 45,199 |
| 46 | [logseq/logseq](https://github.com/logseq/logseq) | 43,941 |
| 47 | [TriliumNext/Trilium](https://github.com/TriliumNext/Trilium) | 36,908 |
| 48 | [actualbudget/actual](https://github.com/actualbudget/actual) | 27,587 |
| 49 | [pubkey/rxdb](https://github.com/pubkey/rxdb) | 23,273 |
| 50 | [yjs/yjs](https://github.com/yjs/yjs) | 22,198 |
| 51 | [super-productivity/super-productivity](https://github.com/super-productivity/super-productivity) | 20,683 |
| 52 | [streetwriters/notesnook](https://github.com/streetwriters/notesnook) | 14,289 |
| 53 | [anyproto/anytype-ts](https://github.com/anyproto/anytype-ts) | 8,441 |
| 54 | [massCodeIO/massCode](https://github.com/massCodeIO/massCode) | 6,920 |
| 55 | [standardnotes/app](https://github.com/standardnotes/app) | 6,547 |
| 56 | [automerge/automerge](https://github.com/automerge/automerge) | 6,427 |
| 57 | [toeverything/blocksuite](https://github.com/toeverything/blocksuite) | 5,927 |
| 58 | [loro-dev/loro](https://github.com/loro-dev/loro) | 5,890 |
| 59 | [silverbulletmd/silverbullet](https://github.com/silverbulletmd/silverbullet) | 5,660 |
| 60 | [tagspaces/tagspaces](https://github.com/tagspaces/tagspaces) | 5,208 |

Strong recurring ideas: versioned documents, migration chains, recovery copies,
preview-before-import, atomic writes, multiple named projects, and explicit sync
conflict handling. CutLog should add schema migration and recovery before it
adds cloud sync or CRDT complexity (`CL-128` to `CL-144`).

## 4. WebAssembly, Workers, and browser compute (20)

| # | Repository | Stars |
|---:|---|---:|
| 61 | [emscripten-core/emscripten](https://github.com/emscripten-core/emscripten) | 27,508 |
| 62 | [GoogleChromeLabs/squoosh](https://github.com/GoogleChromeLabs/squoosh) | 25,494 |
| 63 | [wasmerio/wasmer](https://github.com/wasmerio/wasmer) | 20,901 |
| 64 | [bytecodealliance/wasmtime](https://github.com/bytecodealliance/wasmtime) | 18,362 |
| 65 | [AssemblyScript/assemblyscript](https://github.com/AssemblyScript/assemblyscript) | 17,956 |
| 66 | [ffmpegwasm/ffmpeg.wasm](https://github.com/ffmpegwasm/ffmpeg.wasm) | 17,679 |
| 67 | [pyodide/pyodide](https://github.com/pyodide/pyodide) | 14,743 |
| 68 | [sql-js/sql.js](https://github.com/sql-js/sql.js) | 13,643 |
| 69 | [GoogleChromeLabs/comlink](https://github.com/GoogleChromeLabs/comlink) | 12,748 |
| 70 | [WasmEdge/WasmEdge](https://github.com/WasmEdge/WasmEdge) | 10,722 |
| 71 | [wasm-bindgen/wasm-bindgen](https://github.com/wasm-bindgen/wasm-bindgen) | 9,094 |
| 72 | [WebAssembly/wabt](https://github.com/WebAssembly/wabt) | 8,068 |
| 73 | [wasm-bindgen/wasm-pack](https://github.com/wasm-bindgen/wasm-pack) | 7,241 |
| 74 | [jupyterlite/jupyterlite](https://github.com/jupyterlite/jupyterlite) | 4,846 |
| 75 | [duckdb/duckdb-wasm](https://github.com/duckdb/duckdb-wasm) | 2,075 |
| 76 | [r-wasm/webr](https://github.com/r-wasm/webr) | 1,081 |
| 77 | [ThatOpen/engine_web-ifc](https://github.com/ThatOpen/engine_web-ifc) | 991 |
| 78 | [sebastianwessel/quickjs](https://github.com/sebastianwessel/quickjs) | 922 |
| 79 | [jamsinclair/jSquash](https://github.com/jamsinclair/jSquash) | 695 |
| 80 | [RReverser/serde-wasm-bindgen](https://github.com/RReverser/serde-wasm-bindgen) | 614 |

Strong recurring ideas: protocol versioning, typed message envelopes, warm
initialization, stage timing, cancellation, transferables, and graceful feature
detection. CutLog correctly owns and terminates one Worker per run today; the
next gain is a discriminated protocol and measured progress, not a dependency
swap (`CL-057` to `CL-074`).

## 5. Vue and TypeScript architecture (20)

| # | Repository | Stars |
|---:|---|---:|
| 81 | [vitejs/vite](https://github.com/vitejs/vite) | 81,969 |
| 82 | [vuejs/core](https://github.com/vuejs/core) | 53,964 |
| 83 | [vuetifyjs/vuetify](https://github.com/vuetifyjs/vuetify) | 41,012 |
| 84 | [NervJS/taro](https://github.com/NervJS/taro) | 37,592 |
| 85 | [element-plus/element-plus](https://github.com/element-plus/element-plus) | 27,610 |
| 86 | [vueuse/vueuse](https://github.com/vueuse/vueuse) | 22,309 |
| 87 | [vueComponent/ant-design-vue](https://github.com/vueComponent/ant-design-vue) | 21,589 |
| 88 | [tusen-ai/naive-ui](https://github.com/tusen-ai/naive-ui) | 18,440 |
| 89 | [vitest-dev/vitest](https://github.com/vitest-dev/vitest) | 16,853 |
| 90 | [vuejs/pinia](https://github.com/vuejs/pinia) | 14,665 |
| 91 | [primefaces/primevue](https://github.com/primefaces/primevue) | 14,480 |
| 92 | [doocs/md](https://github.com/doocs/md) | 13,038 |
| 93 | [logaretm/vee-validate](https://github.com/logaretm/vee-validate) | 11,263 |
| 94 | [bcakmakoglu/vue-flow](https://github.com/bcakmakoglu/vue-flow) | 6,726 |
| 95 | [formkit/formkit](https://github.com/formkit/formkit) | 4,739 |
| 96 | [vuejs/router](https://github.com/vuejs/router) | 4,659 |
| 97 | [unplugin/unplugin-vue-components](https://github.com/unplugin/unplugin-vue-components) | 4,293 |
| 98 | [unplugin/unplugin-auto-import](https://github.com/unplugin/unplugin-auto-import) | 3,791 |
| 99 | [intlify/vue-i18n](https://github.com/intlify/vue-i18n) | 2,703 |
| 100 | [dromara/yft-design](https://github.com/dromara/yft-design) | 1,588 |

Strong recurring ideas: small composables with configurable effect boundaries,
typed contracts, co-located tests, reactive derived state, and page components
that compose rather than own policy. CutLog does not need a global store yet;
the project owner introduced in this batch supplies the missing boundary while
remaining plain Vue.

## Source-verified patterns adopted

| Pattern | Source signal | CutLog implementation | Catalog |
|---|---|---|---|
| Declarative command registry separated from palette UI | VS Code `CommandsRegistry`; BlockSuite command manager | `useCommandPalette` owns search, enabled navigation, focus, and execution errors | `CL-111` |
| Derived feature model behind a narrow interface | VueUse composables; editor manager boundaries | `useCosting` owns costing inputs and result-derived summary | `CL-112` |
| Stable-ID selection reconciled against live document data | Excalidraw selection helpers; tldraw record IDs | `useResultSelection` owns selected piece, placements, inspector stats, and stale-ID cleanup | `CL-113` |
| Preview first, commit once | Actual Budget import preview/import split | `usePieceImport` parses, validates geometry and total capacity, then commits one batch | `CL-114` |
| One document owner with snapshot operations | tldraw editor store; local-first document stores | `useProjectState` owns refs and detached `read`, `apply`, and `reset` operations | `CL-115` |
| Named mutation effects instead of watcher feedback | tldraw transactions; BlockSuite command execution | `useProjectActions` declares layout invalidation, persistence, and history per semantic action | `CL-116`, `CL-118` |
| Opaque identity across every adapter | Excalidraw element IDs; tldraw record IDs | Source IDs remain strings through storage, Worker, WASM, Rust placement, and unplaced results | `CL-117` |
| Display text supplied at the presentation edge | Vue I18n composition patterns | `BoxBuilder.vue` prepares reactive labels; geometry uses structural piece IDs | `CL-119` |
| Executable dependency direction | unplugin and large editor monorepo boundary checks | A TypeScript-aware boundary script runs before frontend tests and builds | `CL-120` |

No implementation code was copied from the benchmarked repositories. The
patterns were reduced to CutLog-sized interfaces and covered by local tests.

## Next ten benchmark-derived candidates

The canonical acceptance-oriented descriptions are `CL-501` to `CL-510` in
[`recommendation.md`](../recommendation.md). Their external editor signals are:

| Catalog | Recurring editor pattern | CutLog direction |
|---|---|---|
| `CL-501` | Categorized, adaptive command launchers | Command groups and local frecency |
| `CL-502` | Stable multi-selection plus property inspectors | Non-adjacent piece bulk editing |
| `CL-503` | Saved dock/panel arrangements | Resizable compact and focus layouts |
| `CL-504` | Navigable diagnostics panels | Severity, piece links, and issue filters |
| `CL-505` | Expression-aware numeric fields | Bounded arithmetic and unit preview |
| `CL-506` | User keymaps with conflict handling | Platform-aware shortcut customization |
| `CL-507` | Repeatable commands and macros | Previewed recipes as one undo step |
| `CL-508` | Named workspace views | Saved query, sort, filters, and inspector state |
| `CL-509` | Visual document comparison | Layout scrubber or ghost overlay |
| `CL-510` | Journaling recovery models | Local named-action replay after a crash |
