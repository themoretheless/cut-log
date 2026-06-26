# CutLog recommendations: what to do next

The operational checklist for the refactoring described in
[ARCHITECTURE.md](ARCHITECTURE.md). That document is the rationale (why, target
model, dependency rules); this one is the ordered to-do with status. Keep the two
in sync: the phase names and order here are the same spine.

Baseline: version 0.1.38 (after PR #65, which grew `Home.vue` to ~1907 lines).
Progress so far: 0 of 6 phases done.

## How to work this list

- One phase per pull request. Each phase is behavior-preserving and shippable on
  its own; do not batch phases.
- Follow the repo flow: branch, implement, `npx vue-tsc --noEmit`, `npx vitest run`,
  `npm run build`, bump `version.json`, open a PR, let the single `build` check
  pass, squash-merge, then sync `main`.
- Pure logic goes in `lib/*` with a co-located `*.test.ts` in the same PR. The
  Vue wiring (composables, components) is verified by build, type-check, the lib
  tests it leans on, and a short manual smoke check, since the wiring itself is
  not unit-tested.
- Respect the dependency rules in ARCHITECTURE.md section 3.2 (dependencies point
  inward only; no `vue` import inside `lib/`).

## Status

| # | Phase | What lands | Risk | Status |
|---|-------|-----------|------|--------|
| 0 | Free wins | drop `jspdf`/`svg2pdf`; `lib/downloadFile.ts` (+test); use it in both pages | very low | TODO |
| 1 | Palette + sheet SVG | `lib/palette.ts`, `lib/sheetSvg.ts` (+tests), `components/SheetCard.vue` replaces inline SVG | medium | TODO |
| 2 | Shared UI composables | `composables/useToast.ts`, `composables/useKeyboardShortcuts.ts` | low-medium | TODO |
| 3 | Persistence + history + snapshots | `useHomeProject`, `useHomeHistory`, `useProjectSnapshots` (wrap #65 `projectSnapshots.ts`) | high | TODO |
| 4 | Piece list | `usePieceList` (wrap `pieceOps` + #65 `pieceEditor.ts`) | medium | TODO |
| 5 | De-i18n box geometry | `box/usePieceCatalog.ts` with a `PieceId` enum; refactor `useBoxModel` | medium | TODO |
| 6 | three.js disposal (+ optional base) | dispose-traverse fix; optional `box/three/useThreeScene.ts` | low / medium | TODO |

Recommended order: 0, then 1, then 3 (highest value, do before 4), then 2, 4, 5,
and 6 last (6 is optional, but the disposal fix alone is cheap and worth doing
any time).

## Next action: Phase 0

1. Remove `"jspdf"` and `"svg2pdf.js"` from `frontend/package.json` dependencies
   (confirmed unused: no `import` of either anywhere in `frontend/src`). Run
   `npm install` so the lockfile updates.
2. Create `frontend/src/lib/downloadFile.ts` exporting
   `downloadFile(name: string, content: string, mime: string): void` (the
   blob/object-URL/anchor/click/revoke sequence), with a small test that asserts
   the anchor `download` name and that the object URL is revoked.
3. Replace the inline copy in `Home.vue` (around the export functions) and the
   `downloadSvg` in `BoxBuilder.vue` with calls to the shared helper.
4. Bump `version.json`, run the full gate, ship.

Definition of done: `vue-tsc` clean; `vitest` green including the new test;
`vite build` clean; no `jspdf`/`svg2pdf` in `package.json`; one SVG export still
downloads correctly on each page.

## Verification per later phase

- Phase 1: `sheetSvg` unit tests (including a label with `<` and `&`); visual
  parity of `SheetCard` against the old inline SVG for a sample layout; selection
  highlight still toggles.
- Phase 2: a dispatch + input-field-skip unit test for `useKeyboardShortcuts`;
  manual pass of every shortcut on both pages (Enter adds only outside inputs,
  Ctrl+Enter calculates, Ctrl+Z/Y undo/redo, Ctrl+D duplicates, Esc clears,
  arrows navigate the gallery).
- Phase 3: a focused test that record -> undo -> redo -> restore does not
  self-record; manual edit/undo/redo, reload from localStorage, open a share
  link (hash stripped), save and reload a named project.
- Phase 4: existing `pieceOps`/`pieceEditor` tests stay green; manual
  add/import/duplicate/sort/search/drag-reorder checks.
- Phase 5: geometry golden snapshots unchanged; a catalog test that ids are
  locale-independent; manual RU and EN parity of box pieces, gallery, cut sheet,
  and SVG download.
- Phase 6: `renderer.info.memory.geometries`/`textures` stay flat across repeated
  box-param changes and navigate-away-and-back; visual parity of explode and ring.

## Known doc and code corrections folded in

- The earlier plan claimed Phase 1 fixes an on-screen XML-escape bug. That was a
  false positive: the inline sheet SVG uses Vue `{{ }}` interpolation, which sets
  escaped text content, and the export path already calls `escapeXml`. Phase 1 is
  justified by modularity and de-duplication only. (Corrected in ARCHITECTURE.md.)
- Line counts were refreshed for the post-#65 code (`Home.vue` ~1907 lines).

## Open doc gaps (small, optional)

- `README.ru.md` does not yet carry the Layering section or links to these two
  docs; the English `README.md` does. Sync it when convenient.
