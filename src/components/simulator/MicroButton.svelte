<script lang="ts">
  import { MICRO_BY_KEY } from '../../lib/johnny/microcode';
  import type { Sim } from '../../lib/johnny/sim.svelte';

  interface Props {
    sim: Sim;
    k: string;
    showNext?: boolean;
    disabled?: boolean;
  }
  let { sim, k, showNext = true, disabled = false }: Props = $props();

  const info = $derived(MICRO_BY_KEY[k]);
  const tone = $derived(
    ['ram->db', 'db->ram', 'db->acc', 'acc->db', 'plus', 'minus', 'db->ins'].includes(k)
      ? 'dbus'
      : ['ins->ab', 'pc->ab'].includes(k)
        ? 'abus'
        : ['acc:=0', 'acc++', 'acc--'].includes(k)
          ? 'alu'
          : k === 'stopp'
            ? 'err'
            : 'cu',
  );
  const hit = $derived(sim.events.some((e) => e.key === k));
  const isNext = $derived(showNext && sim.controlUnit && sim.s.microcode[sim.s.mc] === info.code && !sim.running);
</script>

<button
  type="button"
  class="mb tone-{tone}"
  class:next={isNext}
  class:recording={!!sim.recording}
  {disabled}
  title={`${info.de}: ${info.info}`}
  aria-label={`${info.label} – ${info.de}`}
  onclick={() => sim.exec(k)}
>
  {#key sim.pulse}
    <span class="flash" class:on={hit} aria-hidden="true"></span>
  {/key}
  <span class="k">{info.label}</span>
  <span class="d">{info.de}</span>
  {#if isNext}<span class="badge" title="als Nächstes dran"></span>{/if}
</button>

<style>
  .mb {
    --tc: var(--cu);
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    gap: 1px;
    min-height: 46px;
    padding: 6px 10px 6px 12px;
    border-radius: 10px;
    border: 1px solid var(--border-strong);
    background: var(--surface);
    cursor: pointer;
    text-align: left;
    overflow: hidden;
    transition: border-color 0.15s, background 0.15s, transform 0.05s;
    -webkit-tap-highlight-color: transparent;
    min-width: 0;
  }
  .mb::before {
    content: '';
    position: absolute;
    left: 0;
    top: 6px;
    bottom: 6px;
    width: 3px;
    border-radius: 0 3px 3px 0;
    background: var(--tc);
  }
  .mb:hover {
    border-color: var(--tc);
    background: color-mix(in srgb, var(--tc) 6%, var(--surface));
  }
  .mb:active {
    transform: translateY(1px);
  }
  .mb:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .tone-dbus { --tc: var(--dbus); }
  .tone-abus { --tc: var(--abus); }
  .tone-alu { --tc: var(--alu); }
  .tone-cu { --tc: var(--cu); }
  .tone-err { --tc: var(--err); }
  .k {
    font-family: var(--font-mono);
    font-weight: 700;
    font-size: 0.9rem;
    color: var(--text);
    white-space: nowrap;
  }
  .d {
    font-size: 0.72rem;
    color: var(--text-3);
    line-height: 1.2;
    max-width: 100%;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .next {
    border-style: dashed;
    border-color: var(--cu);
    border-width: 1.5px;
    background: color-mix(in srgb, var(--cu) 5%, var(--surface));
  }
  .badge {
    position: absolute;
    right: 7px;
    top: 7px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--cu);
    animation: breathe 1.6s ease-in-out infinite;
  }
  @keyframes breathe {
    50% {
      transform: scale(0.6);
      opacity: 0.5;
    }
  }
  .flash {
    position: absolute;
    inset: 0;
    pointer-events: none;
    opacity: 0;
  }
  .flash.on {
    animation: flash 0.9s ease-out;
    background: color-mix(in srgb, var(--tc) 28%, transparent);
  }
  @keyframes flash {
    0% { opacity: 1; }
    100% { opacity: 0; }
  }
</style>
