<script setup lang="ts">
import { useL10n } from '@/stores/l10n'
const { t } = useL10n()
</script>

<template>
  <div class="app-container">
    <div class="empty-state" style="min-height: 60vh">
      <div class="empty-icon">404</div>
      <p>{{ t('notfound.title') }}</p>
      <p style="color: var(--muted); font-size: 0.85rem">{{ t('notfound.text') }}</p>
      <router-link to="/" class="btn btn-primary" style="margin-top: 16px">
        {{ t('nav.cutting') }}
      </router-link>
    </div>
  </div>
</template>
