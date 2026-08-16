<script lang="ts">
  import { navigate, routeHref } from '@/router.svelte'
  import { useL10n } from '@/stores/l10n.svelte'

  const l10n = useL10n()
  const t = l10n.t

  function goHome(event: MouseEvent) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
    event.preventDefault()
    navigate('/')
  }
</script>

<div class="app-container">
  <div class="empty-state" style="min-height: 60vh">
    <div class="empty-icon">404</div>
    <p>{t('notfound.title')}</p>
    <p style="color: var(--muted); font-size: 0.85rem">{t('notfound.text')}</p>
    <a href={routeHref('/')} class="btn btn-primary" style="margin-top: 16px" onclick={goHome}>
      {t('nav.cutting')}
    </a>
  </div>
</div>
