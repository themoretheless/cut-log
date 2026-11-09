<script lang="ts">
  interface Row {
    key: number
    text: string
  }
  interface Props {
    rows: readonly Row[]
  }
  const { rows }: Props = $props()
</script>

<div class="bench-list">
  {#each rows as row (row.key)}
    <div class="bench-row">{row.text}</div>
  {/each}
</div>

<style>
  .bench-list { width: 720px; padding: 8px; background: #1b1b1b; }
  .bench-row { height: 18px; margin-bottom: 2px; color: #e6e6e6; font-size: 12px; line-height: 18px; }
</style>
