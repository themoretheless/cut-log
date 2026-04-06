<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useL10n } from '../stores/l10n'
import { parseOpenSCAD, type MeshData } from '../services/openscadParser'
import { WebGPURenderer } from '../services/webgpuRenderer'

const { t } = useL10n()

const code = ref(`// OpenSCAD Viewer
// Supports: cube, sphere, cylinder,
// translate, rotate, scale, color,
// union, difference, intersection

difference() {
    cube([30, 20, 10], center = true);

    translate([0, 0, 0])
        cylinder(h = 12, r = 4, center = true, $fn = 32);

    translate([10, 5, 0])
        sphere(r = 3, $fn = 24);
}

translate([0, -20, 0])
color([0.2, 0.8, 0.4])
    union() {
        cube([40, 3, 3], center = true);
        rotate([0, 0, 45])
            cube([40, 3, 3], center = true);
    }

translate([-25, 0, 0])
color([0.9, 0.7, 0.1])
    cylinder(h = 20, r1 = 8, r2 = 2, center = true, $fn = 6);

translate([25, 10, 0])
    sphere(r = 7, $fn = 32);
`)

const canvasRef = ref<HTMLCanvasElement | null>(null)
const error = ref('')
const meshCount = ref(0)
const triangleCount = ref(0)
const gpuSupported = ref(true)
const autoRender = ref(true)

let renderer: WebGPURenderer | null = null
let renderTimeout: ReturnType<typeof setTimeout> | null = null

onMounted(async () => {
  if (!canvasRef.value) return
  renderer = new WebGPURenderer()
  const ok = await renderer.init(canvasRef.value)
  if (!ok) {
    gpuSupported.value = false
    return
  }
  doRender()
})

onUnmounted(() => {
  if (renderTimeout) clearTimeout(renderTimeout)
  renderer?.destroy()
  renderer = null
})

watch(code, () => {
  if (!autoRender.value) return
  if (renderTimeout) clearTimeout(renderTimeout)
  renderTimeout = setTimeout(doRender, 400)
})

function doRender() {
  if (!renderer) return
  error.value = ''
  try {
    const meshes = parseOpenSCAD(code.value)
    meshCount.value = meshes.length
    triangleCount.value = meshes.reduce((s, m) => s + m.indices.length / 3, 0)
    renderer.setMeshes(meshes)
  } catch (e: any) {
    error.value = e.message || String(e)
  }
}

function loadExample(name: string) {
  const examples: Record<string, string> = {
    basic: `// Basic primitives
cube([20, 15, 10]);

translate([30, 0, 0])
  sphere(r = 8, $fn = 32);

translate([0, 25, 0])
  cylinder(h = 15, r = 6, $fn = 24);

translate([30, 25, 0])
  cylinder(h = 15, r1 = 8, r2 = 3, $fn = 6);
`,
    csg: `// CSG operations
difference() {
    cube([30, 30, 30], center = true);
    sphere(r = 19, $fn = 32);
}

translate([50, 0, 0])
intersection() {
    cube([20, 20, 20], center = true);
    sphere(r = 14, $fn = 32);
}
`,
    house: `// Simple house
color([0.8, 0.7, 0.5])
difference() {
    cube([40, 30, 25]);
    translate([5, -1, 5])
        cube([12, 10, 15]);
    translate([23, -1, 5])
        cube([12, 10, 15]);
    translate([15, -1, 2])
        cube([10, 10, 20]);
}

// Roof
color([0.7, 0.2, 0.15])
translate([20, 30, 12.5])
rotate([0, 90, 0])
    cylinder(h = 42, r1 = 0, r2 = 18, $fn = 4, center = true);

// Chimney
color([0.6, 0.3, 0.2])
translate([30, 30, 0])
    cube([5, 15, 5]);
`,
    gears: `// Decorative gear pattern
$fn = 6;

for_substitute_union() {
    cylinder(h = 3, r = 15, $fn = 24);

    translate([0, 0, 3])
        cylinder(h = 2, r = 12, $fn = 6);
}

translate([35, 0, 0])
color([0.2, 0.6, 0.9]) {
    cylinder(h = 5, r = 10, $fn = 32);
    translate([0, 0, 5])
        cylinder(h = 3, r = 7, $fn = 8);
    translate([0, 0, 8])
        sphere(r = 5, $fn = 16);
}

translate([0, 35, 0])
color([0.9, 0.4, 0.2]) {
    cube([20, 20, 4], center = true);
    translate([0, 0, 4])
        cylinder(h = 8, r1 = 14, r2 = 5, $fn = 8);
}
`,
  }
  if (examples[name]) code.value = examples[name]
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Tab') {
    e.preventDefault()
    const el = e.target as HTMLTextAreaElement
    const start = el.selectionStart
    const end = el.selectionEnd
    code.value = code.value.substring(0, start) + '    ' + code.value.substring(end)
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = start + 4
    })
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault()
    doRender()
  }
}
</script>

<template>
  <div class="scad-viewer">
    <header class="scad-header">
      <h1>{{ t('scad.title') }}</h1>
      <p class="scad-subtitle">{{ t('scad.subtitle') }}</p>
    </header>

    <div v-if="!gpuSupported" class="scad-no-gpu">
      {{ t('scad.no_webgpu') }}
    </div>

    <div v-else class="scad-layout">
      <div class="scad-editor-panel">
        <div class="scad-toolbar">
          <button class="scad-btn scad-btn-primary" @click="doRender" :title="'Ctrl+Enter'">
            {{ t('scad.render') }}
          </button>
          <label class="scad-auto-label">
            <input type="checkbox" v-model="autoRender" />
            {{ t('scad.auto') }}
          </label>
          <span class="scad-spacer" />
          <span class="scad-examples-label">{{ t('scad.examples') }}:</span>
          <button class="scad-btn scad-btn-sm" @click="loadExample('basic')">{{ t('scad.ex_basic') }}</button>
          <button class="scad-btn scad-btn-sm" @click="loadExample('csg')">CSG</button>
          <button class="scad-btn scad-btn-sm" @click="loadExample('house')">{{ t('scad.ex_house') }}</button>
          <button class="scad-btn scad-btn-sm" @click="loadExample('gears')">{{ t('scad.ex_gears') }}</button>
        </div>

        <textarea
          class="scad-code"
          v-model="code"
          spellcheck="false"
          @keydown="handleKeydown"
        />

        <div v-if="error" class="scad-error">{{ error }}</div>

        <div class="scad-stats">
          {{ t('scad.meshes') }}: {{ meshCount }} &middot;
          {{ t('scad.triangles') }}: {{ triangleCount }}
        </div>
      </div>

      <div class="scad-canvas-panel">
        <canvas ref="canvasRef" class="scad-canvas" />
        <div class="scad-hint">{{ t('scad.mouse_hint') }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.scad-viewer {
  padding: 18px 24px 40px;
  max-width: 1400px;
  margin: 0 auto;
}

.scad-header {
  text-align: center;
  margin-bottom: 18px;
}

.scad-header h1 {
  font-size: 1.35rem;
  font-weight: 700;
  margin: 0 0 4px;
  color: var(--text);
}

.scad-subtitle {
  font-size: 0.85rem;
  color: var(--text-dim);
  margin: 0;
}

.scad-no-gpu {
  text-align: center;
  padding: 60px 20px;
  color: var(--danger, #e74c3c);
  font-size: 1.1rem;
  background: var(--surface);
  border-radius: 10px;
  border: 1px solid var(--border);
}

.scad-layout {
  display: flex;
  gap: 16px;
  height: calc(100vh - 200px);
  min-height: 400px;
}

.scad-editor-panel {
  flex: 0 0 420px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 300px;
}

.scad-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.scad-btn {
  padding: 6px 14px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  cursor: pointer;
  font-size: 0.82rem;
  transition: background 0.15s;
}

.scad-btn:hover {
  background: var(--hover);
}

.scad-btn-primary {
  background: var(--accent, #4a9eff);
  color: #fff;
  border-color: var(--accent, #4a9eff);
  font-weight: 600;
}

.scad-btn-primary:hover {
  opacity: 0.9;
}

.scad-btn-sm {
  padding: 3px 8px;
  font-size: 0.75rem;
}

.scad-auto-label {
  font-size: 0.78rem;
  color: var(--text-dim);
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
}

.scad-spacer {
  flex: 1;
}

.scad-examples-label {
  font-size: 0.75rem;
  color: var(--text-dim);
}

.scad-code {
  flex: 1;
  font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
  font-size: 0.82rem;
  line-height: 1.5;
  padding: 12px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  resize: none;
  tab-size: 4;
  outline: none;
}

.scad-code:focus {
  border-color: var(--accent, #4a9eff);
  box-shadow: 0 0 0 2px rgba(74, 158, 255, 0.15);
}

.scad-error {
  padding: 8px 12px;
  background: rgba(231, 76, 60, 0.1);
  border: 1px solid rgba(231, 76, 60, 0.3);
  border-radius: 6px;
  color: var(--danger, #e74c3c);
  font-size: 0.78rem;
  font-family: monospace;
  white-space: pre-wrap;
}

.scad-stats {
  font-size: 0.75rem;
  color: var(--text-dim);
  text-align: center;
}

.scad-canvas-panel {
  flex: 1;
  position: relative;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid var(--border);
  background: #1a1a1e;
}

.scad-canvas {
  width: 100%;
  height: 100%;
  display: block;
}

.scad-hint {
  position: absolute;
  bottom: 8px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.4);
  pointer-events: none;
}

@media (max-width: 900px) {
  .scad-layout {
    flex-direction: column;
    height: auto;
  }
  .scad-editor-panel {
    flex: none;
    height: 300px;
  }
  .scad-canvas-panel {
    height: 400px;
  }
}
</style>
