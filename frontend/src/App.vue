<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useL10n } from './stores/l10n'

const { lang, t, toggleLang } = useL10n()
const pkgVersion = __PKG_VERSION__
const appVersion = import.meta.env.VITE_APP_VERSION || `v${pkgVersion}`
const appSha = import.meta.env.VITE_APP_SHA || ''
const isDark = ref(true)
const trackRef = ref<HTMLElement | null>(null)
let starsInterval: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  const saved = localStorage.getItem('theme')
  isDark.value = saved !== 'light'
  applyTheme()
  if (isDark.value) startStars()
})

onUnmounted(() => stopStars())

function applyTheme() {
  document.documentElement.setAttribute('data-theme', isDark.value ? '' : 'light')
  localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
}

function toggleTheme() {
  isDark.value = !isDark.value
  applyTheme()
  if (isDark.value) startStars()
  else stopStars()
}

function startStars() {
  stopStars()
  spawnStars()
  starsInterval = setInterval(spawnStars, 2500)
}

function stopStars() {
  if (starsInterval) { clearInterval(starsInterval); starsInterval = null }
  if (trackRef.value) {
    trackRef.value.querySelectorAll('.toggle-star-rand').forEach(el => el.remove())
  }
}

function spawnStars() {
  const track = trackRef.value
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
</script>

<template>
  <nav class="page-nav">
    <div class="page-nav-links">
      <router-link to="/" class="page-nav-link" active-class="active" exact-active-class="active">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
          <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
        </svg>
        {{ t('nav.cutting') }}
      </router-link>
      <router-link to="/box" class="page-nav-link" active-class="active">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
        </svg>
        {{ t('nav.box') }}
      </router-link>
      <router-link to="/scad" class="page-nav-link" active-class="active">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
        </svg>
        {{ t('nav.scad') }}
      </router-link>
    </div>
    <div class="top-controls">
      <button class="lang-toggle" @click="toggleLang" title="RU / EN">
        {{ lang === 'ru' ? 'RU' : 'EN' }}
      </button>
      <span class="theme-toggle-label">{{ t('theme') }}</span>
      <button
        class="theme-toggle"
        :class="isDark ? 'is-dark' : 'is-light'"
        @click="toggleTheme"
        title="Toggle theme"
      >
        <span class="toggle-track" ref="trackRef">
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

  <router-view />

  <footer class="app-footer">
    <span class="version-badge" :title="appSha">{{ appVersion }}</span>
  </footer>
</template>
