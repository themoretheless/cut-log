<script setup lang="ts">
import { onErrorCaptured, ref } from 'vue'
import { useL10n } from '@/stores/l10n'

const error = ref<Error | null>(null)
const retryKey = ref(0)
const { t } = useL10n()

onErrorCaptured((caught, _instance, info) => {
  error.value = caught instanceof Error ? caught : new Error(String(caught))
  console.error('Route render failed', caught, info)
  return false
})

function retry() {
  retryKey.value++
  error.value = null
}

function reload() {
  location.reload()
}
</script>

<template>
  <slot v-if="!error" :retry-key="retryKey" />
  <main v-else class="route-error" role="alert">
    <div class="route-error-mark" aria-hidden="true">!</div>
    <div class="route-error-copy">
      <h1>{{ t('route_error.title') }}</h1>
      <p>{{ t('route_error.text') }}</p>
      <span>{{ t('route_error.preserved') }}</span>
    </div>
    <div class="route-error-actions">
      <button class="btn btn-primary" type="button" @click="retry">{{ t('route_error.retry') }}</button>
      <button class="btn btn-ghost" type="button" @click="reload">{{ t('route_error.reload') }}</button>
    </div>
  </main>
</template>

<style scoped>
.route-error {
  width: min(760px, calc(100% - 32px));
  min-height: 220px;
  margin: 56px auto;
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) auto;
  align-items: start;
  gap: 18px;
  padding: 28px;
  border: 1px solid var(--border);
  border-left: 3px solid var(--eff-poor-tx);
  background: var(--surface);
}
.route-error-mark {
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  border: 1px solid var(--eff-poor-tx);
  color: var(--eff-poor-tx);
  font-size: 22px;
  font-weight: 700;
}
.route-error-copy h1 {
  margin: 0 0 8px;
  font-size: 20px;
}
.route-error-copy p {
  margin: 0 0 12px;
  color: var(--text);
}
.route-error-copy span {
  color: var(--muted);
  font-size: 12px;
}
.route-error-actions {
  display: flex;
  gap: 8px;
}
@media (max-width: 680px) {
  .route-error {
    grid-template-columns: 40px minmax(0, 1fr);
    margin: 28px auto;
    padding: 20px;
  }
  .route-error-actions {
    grid-column: 1 / -1;
    padding-left: 58px;
    flex-wrap: wrap;
  }
}
</style>
