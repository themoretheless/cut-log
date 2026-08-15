<script lang="ts">
  import type { Component } from 'svelte'
  import { routerPath, matchRoute, navigate } from './router.svelte'
  import { useL10n } from './stores/l10n.svelte'

  const l10n = useL10n()
  const t = l10n.t
  const pkgVersion = __PKG_VERSION__
  const appVersion = import.meta.env.VITE_APP_VERSION || `v${pkgVersion}`
  const appSha = import.meta.env.VITE_APP_SHA || ''

  let isDark = $state(true)
  let trackRef: HTMLElement | null = $state(null)
  let starsInterval: ReturnType<typeof setInterval> | null = null

  let routeComponent: Component | null = $state(null)
  let routeKey = $state('')
  let retryKey = $state(0)
  let routeError = $state(false)

  $effect(() => {
    const path = routerPath()
    const rk = retryKey
    const def = matchRoute(path)
    let cancelled = false
    routeError = false
    def.load().then(mod => {
      if (cancelled) return
      routeComponent = mod.default
      routeKey = `${path}:${rk}`
    }).catch(error => {
      if (cancelled) return
      console.error('Route load failed', error)
      routeError = true
    })
    return () => { cancelled = true }
  })

  $effect(() => {
    const saved = localStorage.getItem('theme')
    isDark = saved !== 'light'
    applyTheme()
    if (isDark) startStars()
    return () => stopStars()
  })

  function applyTheme() {
    document.documentElement.setAttribute('data-theme', isDark ? '' : 'light')
    localStorage.setItem('theme', isDark ? 'dark' : 'light')
  }

  function toggleTheme() {
    isDark = !isDark
    applyTheme()
    if (isDark) startStars()
    else stopStars()
  }

  function startStars() {
    stopStars()
    spawnStars()
    starsInterval = setInterval(spawnStars, 2500)
  }

  function stopStars() {
    if (starsInterval) { clearInterval(starsInterval); starsInterval = null }
    if (trackRef) {
      trackRef.querySelectorAll('.toggle-star-rand').forEach(el => el.remove())
    }
  }

  function spawnStars() {
    const track = trackRef
    if (!track) return
    const count = 2 + Math.floor(Math.random() * 3)
    for (let i = 0; i < count; i++) {
      const star = document.createElement('span')
      star.className = 'toggle-star-rand'
      star.textContent = ['✦', '✧', '·', '⋆'][Math.floor(Math.random() * 4)]
      star.style.left = `${8 + Math.random() * 56}px`
      star.style.top = `${4 + Math.random() * 26}px`
      star.style.fontSize = `${4 + Math.random() * 6}px`
      track.appendChild(star)
      setTimeout(() => star.remove(), 2200)
    }
  }

  function link(e: MouseEvent, to: string) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
    e.preventDefault()
    navigate(to)
  }

  const path = $derived(routerPath())
</script>

<nav class="page-nav">
  <div class="page-nav-links">
    <a href="/" class="page-nav-link" class:active={path === '/'} onclick={e => link(e, '/')}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
        <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
      </svg>
      {t('nav.cutting')}
    </a>
    <a href="/box" class="page-nav-link" class:active={path === '/box'} onclick={e => link(e, '/box')}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
      </svg>
      {t('nav.box')}
    </a>
    <a href="/skadis" class="page-nav-link" class:active={path === '/skadis'} onclick={e => link(e, '/skadis')}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <rect x="3" y="2" width="18" height="20" rx="2"/>
        <path d="M8 6v2M16 6v2M12 10v2M8 14v2M16 14v2"/>
      </svg>
      {t('nav.skadis')}
    </a>
  </div>
  <div class="top-controls">
    <button class="lang-toggle" onclick={l10n.toggleLang} title="RU / EN">
      {l10n.lang === 'ru' ? 'RU' : 'EN'}
    </button>
    <span class="theme-toggle-label">{t('theme')}</span>
    <button
      class="theme-toggle"
      class:is-dark={isDark}
      class:is-light={!isDark}
      onclick={toggleTheme}
      title="Toggle theme"
    >
      <span class="toggle-track" bind:this={trackRef}>
        <!-- Sun SVG -->
        <span class="toggle-icon toggle-sun">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
               stroke="#f5a623" stroke-width="2.2" stroke-linecap="round">
            <circle cx="12" cy="12" r="4" fill="#f5a623" stroke="none" class="sun-core"/>
            <g class="sun-rays">
              <line x1="12" y1="2"  x2="12" y2="5"/>
              <line x1="12" y1="19" x2="12" y2="22"/>
              <line x1="2"  y1="12" x2="5"  y2="12"/>
              <line x1="19" y1="12" x2="22" y2="12"/>
              <line x1="4.93"  y1="4.93"  x2="7.05"  y2="7.05"/>
              <line x1="16.95" y1="16.95" x2="19.07" y2="19.07"/>
              <line x1="19.07" y1="4.93"  x2="16.95" y2="7.05"/>
              <line x1="4.93"  y1="19.07" x2="7.05"  y2="16.95"/>
            </g>
          </svg>
        </span>

        <!-- Moon SVG -->
        <span class="toggle-icon toggle-moon">
          <svg width="16" height="16" viewBox="3 3 18 18" fill="#ffd700" stroke="none">
            <path d="M12 3 A6 6 0 0 1 3 12 A9 9 0 1 0 12 3 Z" class="moon-shape"/>
          </svg>
        </span>

        <span class="toggle-thumb"></span>
      </span>
    </button>
  </div>
</nav>

{#snippet routeErrorFallback(retry: () => void)}
  <main class="route-error" role="alert">
    <h2>{t('route_error.title')}</h2>
    <p>{t('route_error.text')}</p>
    <p>{t('route_error.preserved')}</p>
    <button onclick={retry}>{t('route_error.retry')}</button>
    <button onclick={() => window.location.reload()}>{t('route_error.reload')}</button>
  </main>
{/snippet}

{#if routeError}
  <!-- The route chunk never loaded, so there is nothing to render or reset. -->
  {@render routeErrorFallback(() => { retryKey += 1 })}
{:else if routeComponent}
  {#key routeKey}
    {@const RouteComponent = routeComponent}
    <!--
      Mirrors the Vue onErrorCaptured boundary: a route that throws while
      rendering is caught here instead of taking the whole app down.
    -->
    <svelte:boundary onerror={error => console.error('Route render failed', error)}>
      <RouteComponent />
      {#snippet failed(_error, reset)}
        {@render routeErrorFallback(reset)}
      {/snippet}
    </svelte:boundary>
  {/key}
{/if}

<footer class="app-footer">
  <span class="version-badge" title={appSha}>{appVersion}</span>
</footer>
