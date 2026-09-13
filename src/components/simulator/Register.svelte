<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    label: string;
    abbr: string;
    value: string;
    tone: 'mem' | 'abus' | 'dbus' | 'alu' | 'cu';
    active?: boolean;
    pulse?: number;
    size?: 'l' | 'm' | 's';
    hint?: string;
    children?: Snippet;
  }
  let { label, abbr, value, tone, active = false, pulse = 0, size = 'm', hint, children }: Props = $props();
</script>

<div class="reg c-{tone} size-{size}" title={hint}>
  <div class="head">
    <span class="label">{label}</span>
    <span class="abbr">{abbr}</span>
  </div>
  <div class="val-wrap">
    {#key pulse}
      <span class="val" class:active>{value}</span>
    {/key}
    {@render children?.()}
  </div>
</div>

<style>
  .reg {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }
  .head {
    display: flex;
    align-items: baseline;
    gap: 8px;
    justify-content: space-between;
  }
  .label {
    font-size: 0.78rem;
    font-weight: 650;
    color: var(--text-2);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .abbr {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    font-weight: 700;
    color: var(--c);
    background: var(--c-soft);
    padding: 0 6px;
    border-radius: 6px;
  }
  .val-wrap {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .val {
    display: inline-block;
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
    font-weight: 700;
    letter-spacing: 0.02em;
    color: var(--text);
    background: var(--surface-2);
    border: 1.5px solid color-mix(in srgb, var(--c) 45%, var(--border));
    border-radius: 10px;
    padding: 4px 12px;
    line-height: 1.3;
    min-width: 0;
  }
  .size-l .val {
    font-size: 1.7rem;
    padding: 6px 16px;
  }
  .size-m .val {
    font-size: 1.25rem;
  }
  .size-s .val {
    font-size: 1rem;
  }
  .val.active {
    animation: pulse 1s ease-out;
  }
  @keyframes pulse {
    0% {
      background: color-mix(in srgb, var(--c) 40%, var(--surface));
      box-shadow: 0 0 0 5px color-mix(in srgb, var(--c) 25%, transparent);
    }
    100% {
      background: var(--surface-2);
      box-shadow: 0 0 0 0 transparent;
    }
  }
</style>
