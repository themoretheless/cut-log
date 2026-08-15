<script lang="ts">
  import { untrack } from 'svelte'
  import NumberField from '../components/NumberField.svelte'
  import { useL10n } from '../stores/l10n.svelte'
  import { wrapCutSvg } from '../box/geometry'
  import { downloadFile } from '../lib/downloadFile'
  import { useBoxModel } from '../box/useBoxModel.svelte'
  import { useAssemblyScene } from '../box/three/useAssemblyScene.svelte'
  import { usePieceGallery } from '../box/three/usePieceGallery.svelte'

  const l10n = useL10n()
  const t = (key: string) => l10n.t(key)

  const boxLabels = $derived({
    sideShort: t('box.side_short'),
    topShort: t('box.top_short'),
    bottomShort: t('box.bottom_short'),
    backShort: t('box.back_short'),
    shelfShort: t('box.shelf_short'),
    sideWall: t('box.side_wall'),
    topBottomWall: t('box.top_bottom_wall'),
    backWall: t('box.back_wall'),
    shelf: t('box.shelf'),
  })

  const model = useBoxModel(() => boxLabels)
  const assembly = useAssemblyScene(model, () => boxLabels)
  const gallery = usePieceGallery(model)

  // ── Gallery navigation ─────────────────────────────────────────────────────
  function galPrev() { model.galIdx = (model.galIdx - 1 + model.galPieces.length) % model.galPieces.length }
  function galNext() { model.galIdx = (model.galIdx + 1) % model.galPieces.length }

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  function onKeydown(e: KeyboardEvent) {
    const tag = (e.target as HTMLElement)?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
    if (e.ctrlKey || e.metaKey || e.altKey) return
    if (e.key === 'ArrowLeft') { e.preventDefault(); galPrev() }
    else if (e.key === 'ArrowRight') { e.preventDefault(); galNext() }
    else if (e.key === 'd' || e.key === 'D') { e.preventDefault(); galDlSvg() }
    else if (e.key === 'r' || e.key === 'R') { e.preventDefault(); gallery.resetView() }
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  // Scene init/teardown (Vue onMounted/onUnmounted). The first run of the
  // parameter effect below performs the initial update() calls.
  $effect(() => {
    untrack(() => {
      assembly.init('box3d-container')
      gallery.init('piece3d-container')
    })
    window.addEventListener('keydown', onKeydown)
    return () => {
      window.removeEventListener('keydown', onKeydown)
      assembly.dispose()
      gallery.dispose()
    }
  })

  // watch([W..BackInset]) -> rebuild both scenes on any parameter change.
  $effect(() => {
    void model.W; void model.H; void model.D; void model.T; void model.Kerf
    void model.TabH; void model.NTab; void model.NShelves; void model.Bevel; void model.BackInset
    untrack(() => { assembly.update(); gallery.update() })
  })

  // watch(galIdx) -> animate the ring; skip the first run (mount).
  let galIdxSeen = false
  $effect(() => {
    void model.galIdx
    if (!galIdxSeen) { galIdxSeen = true; return }
    untrack(() => { assembly.update(); gallery.update(true) })
  })

  // watch(boxLabels) -> refresh assembly labels; skip the first run (mount).
  let labelsSeen = false
  $effect(() => {
    void boxLabels
    if (!labelsSeen) { labelsSeen = true; return }
    untrack(() => assembly.update())
  })

  // ── Download helpers ───────────────────────────────────────────────────────
  function galDlSvg() {
    const p = model.galPieces[model.galIdx]
    if (!p) return
    downloadFile(`${p.id}.svg`, wrapCutSvg(p.d, p.pw, p.ph, p.xOff), 'image/svg+xml')
  }
</script>

<div class="app-container">
  <header class="app-header">
    <h1>{t('box.title')}</h1>
    <p class="subtitle">{t('box.subtitle')}</p>
  </header>

  <div class="hotkey-bar">
    <span><kbd>&larr;</kbd><kbd>&rarr;</kbd> {t('box.hotkey.nav')}</span>
    <span><kbd>D</kbd> {t('box.hotkey.download')}</span>
    <span><kbd>R</kbd> {t('box.hotkey.reset')}</span>
  </div>

  <div class="main-layout">
    <aside class="panel panel-input">
      <section class="card">
        <h2>{t('sheet_params')}</h2>
        <div class="form-row"><label for="box-width">{t('box.outer_width')}</label><NumberField id="box-width" ariaLabel={t('box.outer_width')} value={model.W} onUpdate={(v) => { model.W = v }} min={50} step={10} /></div>
        <div class="form-row"><label for="box-height">{t('box.height')}</label><NumberField id="box-height" ariaLabel={t('box.height')} value={model.H} onUpdate={(v) => { model.H = v }} min={50} step={10} /></div>
        <div class="form-row"><label for="box-depth">{t('box.depth')}</label><NumberField id="box-depth" ariaLabel={t('box.depth')} value={model.D} onUpdate={(v) => { model.D = v }} min={50} step={10} /></div>
        <div class="form-row"><label for="box-bevel">{t('box.bevel')}</label><NumberField id="box-bevel" ariaLabel={t('box.bevel')} value={model.Bevel} onUpdate={(v) => { model.Bevel = v }} min={-model.paramLimits.maxAbsBevel} max={model.paramLimits.maxAbsBevel} step={5} /></div>
        <div class="form-row"><label for="box-back-inset">{t('box.back_inset')}</label><NumberField id="box-back-inset" ariaLabel={t('box.back_inset')} value={model.BackInset} onUpdate={(v) => { model.BackInset = v }} min={0} max={model.paramLimits.maxBackInset} step={model.backInsetStep} /></div>
      </section>
      <section class="card">
        <h2>{t('box.material')}</h2>
        <div class="form-row"><label for="box-thickness">{t('box.thickness')}</label><NumberField id="box-thickness" ariaLabel={t('box.thickness')} value={model.T} onUpdate={(v) => { model.T = v }} min={1} max={model.paramLimits.maxThickness} step={0.5} /></div>
        <div class="form-row"><label for="box-kerf">{t('box.kerf')}</label><NumberField id="box-kerf" ariaLabel={t('box.kerf')} value={model.Kerf} onUpdate={(v) => { model.Kerf = v }} min={0} max={model.paramLimits.maxKerf} step={0.05} /></div>
        <div class="form-row"><label for="box-tab-size">{t('box.tab_size')}</label><NumberField id="box-tab-size" ariaLabel={t('box.tab_size')} value={model.TabH} onUpdate={(v) => { model.TabH = v }} min={1} max={model.paramLimits.maxTabSize} step={5} /></div>
        <div class="form-row"><label for="box-tab-count">{t('box.tabs_per_edge')}</label><NumberField id="box-tab-count" ariaLabel={t('box.tabs_per_edge')} value={model.NTab} onUpdate={(v) => { model.NTab = v }} min={1} max={model.paramLimits.maxTabs} step={1} /></div>
        <div class="form-row"><label for="box-shelves">{t('box.shelves')}</label><NumberField id="box-shelves" ariaLabel={t('box.shelves')} value={model.NShelves} onUpdate={(v) => { model.NShelves = v }} min={0} max={model.paramLimits.maxShelves} step={1} /></div>
      </section>
      <section class="card shelf-summary">
        <h2>{t('box.parts')}</h2>
        <div class="shelf-part-row"><span>{t('box.sides')}</span><span>2 &times; {model.SideOW.toFixed(0)}&times;{model.H.toFixed(0)} mm</span></div>
        {#if model.Bevel === 0}
          <div class="shelf-part-row"><span>{t('box.top_bottom')}</span><span>2 &times; {model.W.toFixed(0)}&times;{model.D.toFixed(0)} mm</span></div>
        {:else}
          <div class="shelf-part-row"><span>{t('box.top_short')}</span><span>1 &times; {model.W.toFixed(0)}&times;{model.TopD.toFixed(0)} mm</span></div>
          <div class="shelf-part-row"><span>{t('box.bottom_short')}</span><span>1 &times; {model.W.toFixed(0)}&times;{model.BotD.toFixed(0)} mm</span></div>
        {/if}
        <div class="shelf-part-row"><span>{t('box.back')}</span><span>1 &times; {model.W.toFixed(0)}&times;{model.H.toFixed(0)} mm</span></div>
        {#if model.NShelves > 0 && model.Bevel === 0}
          <div class="shelf-part-row"><span>{t('box.shelf')}</span><span>{model.NShelves} &times; {model.W.toFixed(0)}&times;{(model.D - model.BackInset).toFixed(0)} mm</span></div>
        {:else if model.NShelves > 0}
          {#each model.shelfSlotYs() as sy, i (i)}
            <div class="shelf-part-row"><span>{t('box.shelf_short')}{i + 1}</span><span>1 &times; {model.W.toFixed(0)}&times;{model.shelfDepthAt(sy).toFixed(0)} mm</span></div>
          {/each}
        {/if}
        <div class="shelf-part-row shelf-total"><span>{t('box.total')}</span><span>{5 + model.NShelves} {t('box.pcs')}</span></div>
      </section>
      <section class="card">
        <h2>{t('box.sheet_title')}</h2>
        <div class="form-row"><label for="box-sheet-width">{t('box.sheet_width')}</label><NumberField id="box-sheet-width" ariaLabel={t('box.sheet_width')} value={model.SheetW} onUpdate={(v) => { model.SheetW = v }} min={300} step={10} /></div>
        <div class="form-row"><label for="box-sheet-height">{t('box.sheet_height')}</label><NumberField id="box-sheet-height" ariaLabel={t('box.sheet_height')} value={model.SheetH} onUpdate={(v) => { model.SheetH = v }} min={300} step={10} /></div>
        <div class="form-row"><label for="box-sheet-gap">{t('box.gap')}</label><NumberField id="box-sheet-gap" ariaLabel={t('box.gap')} value={model.CutGap} onUpdate={(v) => { model.CutGap = v }} min={1} step={1} /></div>
      </section>
      <section class="card">
        <h2>{t('box.assembly')}</h2>
        <p style="font-size:0.82rem;color:var(--muted);line-height:1.5">
          {t('box.inner')}
          <strong>{model.Wi.toFixed(0)}&times;{model.Hi.toFixed(0)}&times;{(model.D - model.T - model.BackInset).toFixed(0)} mm</strong>
        </p>
      </section>
    </aside>

    <main class="panel panel-result">
      <!-- Pieces gallery + 3D -->
      <section class="card gallery">
        <div class="piece3d-wrap">
          <button class="piece3d-nav piece3d-prev" onclick={galPrev}>&lsaquo;</button>
          <div id="piece3d-container" role="img" aria-label={t('box.gallery_3d_label')} style="width:100%;height:350px;border-radius:8px;overflow:hidden;"></div>
          <button class="piece3d-nav piece3d-next" onclick={galNext}>&rsaquo;</button>
          <button class="piece3d-nav piece3d-reset" onclick={() => gallery.resetView()} title="Reset view">&#x21ba;</button>
        </div>
        <div class="gallery-3d-bar">
          <span class="gallery-sel-title">{model.galPieces[model.galIdx]?.title} <small>({model.galPieces[model.galIdx]?.count} {t('box.pcs')}, {model.galPieces[model.galIdx]?.pw.toFixed(0)}&times;{model.galPieces[model.galIdx]?.ph.toFixed(0)} mm)</small></span>
          <button class="btn-dl" onclick={galDlSvg}>&#x2193; SVG</button>
        </div>
        <div class="gallery-thumbs">
          {#each model.galPieces as p, i (p.id)}
            <button
              type="button"
              class={['gallery-thumb', i === model.galIdx && 'active'].filter(Boolean).join(' ')}
              aria-pressed={i === model.galIdx}
              aria-label={`${p.title}, ${p.count} ${t('box.pcs')}`}
              onclick={() => { model.galIdx = i }}
            >
              <svg
                width={p.pw * p.s + 6}
                height={p.ph * p.s + 6}
                viewBox={`-3 -3 ${p.pw * p.s + 6} ${p.ph * p.s + 6}`}
              >
                <g transform={`translate(${(p.xOff * p.s).toFixed(4)}, 0) scale(${p.s.toFixed(4)})`}>
                  <path d={p.d} fill={p.color} fill-opacity="0.4" fill-rule="evenodd" stroke="var(--laser-cut)" stroke-width={(2 / p.s).toFixed(1)} stroke-linejoin="miter" />
                </g>
              </svg>
              <span class="gallery-thumb-label">{p.title}</span>
              <span class="gallery-thumb-info">{p.count} {t('box.pcs')}</span>
            </button>
          {/each}
        </div>
      </section>

      <!-- 3D Assembly -->
      <section class="card">
        <h2>{t('box.assembly_3d')}</h2>
        <div class="iso-controls">
          <label for="box-explode">{t('box.explode')}</label>
          <input id="box-explode" type="range" min="0" max="0.5" step="0.01" bind:value={assembly.isoExplode} style="flex:1" />
        </div>
        <div id="box3d-container" role="img" aria-label={t('box.assembly_3d_label')} style="width:100%;height:450px;border-radius:8px;overflow:hidden;"></div>
      </section>

      <!-- Cutting layout -->
      <section class="card">
        <h2>{t('box.cutting_layout')}</h2>

        {#if model.tooBigPieces.length > 0}
          <div class="cut-warning">
            {t('box.too_big')} ({model.SheetW.toFixed(0)}&times;{model.SheetH.toFixed(0)} mm):
            {model.tooBigPieces.map(p => `${p.label} (${p.w.toFixed(0)}×${p.h.toFixed(0)})`).join(', ')}
          </div>
        {/if}

        <div class="cut-stats">
          {t('box.stats')
            .replace('{0}', String(model.cutStats.sheets))
            .replace('{1}', model.cutStats.pieceArea)
            .replace('{2}', model.cutStats.sheetArea)
            .replace('{3}', model.cutStats.util)}
        </div>

        <div class="cut-sheets-wrap">
          {#each model.cuttingSheets as sheetPieces, sheetIdx (sheetIdx)}
            <div class="cut-sheet">
              <div class="cut-sheet-title">
                {t('box.sheet_label')} {sheetIdx + 1} &mdash; {model.SheetW.toFixed(0)}&times;{model.SheetH.toFixed(0)} mm
              </div>
              <svg
                width={(model.SheetW * model.cutScale).toFixed(0)}
                height={(model.SheetH * model.cutScale).toFixed(0)}
                viewBox={`0 0 ${model.SheetW.toFixed(1)} ${model.SheetH.toFixed(1)}`}
                style="display:block;"
                role="img"
                aria-label={`${t('box.cut_sheet_label')} ${sheetIdx + 1}`}
              >
                <title>{t('box.cut_sheet_label')} {sheetIdx + 1}</title>
                <rect x="0" y="0" width={model.SheetW.toFixed(1)} height={model.SheetH.toFixed(1)} fill="var(--laser-sheet-bg)" stroke="var(--laser-sheet-border)" stroke-width={(1 / model.cutScale).toFixed(2)} />
                {#each sheetPieces as p, pi (pi)}
                  <g transform={model.getCutSheetTransform(p)}>
                    <path d={model.getCutSheetPath(p)} fill={p.color} fill-opacity="0.28" fill-rule="evenodd" stroke="var(--laser-cut)" stroke-width={(0.8 / model.cutScale).toFixed(2)} stroke-linejoin="miter" />
                  </g>
                  <text x={(p.x + p.w / 2).toFixed(1)} y={(p.y + p.h / 2).toFixed(1)} text-anchor="middle" dominant-baseline="middle" font-size={(9 / model.cutScale).toFixed(1)} fill="var(--muted)">
                    {p.label} {p.w.toFixed(0)}&times;{p.h.toFixed(0)}
                  </text>
                {/each}
              </svg>
            </div>
          {/each}
        </div>
      </section>
    </main>
  </div>
</div>
