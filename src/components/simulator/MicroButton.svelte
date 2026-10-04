<script lang="ts">
  import { MICRO_BY_KEY } from '../../lib/johnny/microcode';
  import type { Sim } from '../../lib/johnny/sim.svelte';

  interface Props {
    sim: Sim;
    k: string;
    /** Ist als Nächstes dran (laut Mikroprogrammzähler) */
    next?: boolean;
    /** Zähler – jede Änderung > 0 lässt den Knopf aufblinken (der Mikrobefehl wird gerade ausgeführt) */
    firing?: number;
    disabled?: boolean;
  }
  let { sim, k, next = false, firing = 0, disabled = false }: Props = $props();

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
</script>

<button
  type="button"
  class="mb tone-{tone}"
  class:next
  class:recording={!!sim.recording}
  {disabled}
  title={`${info.label}: ${info.de}. ${info.info}`}
  aria-label={`${info.label} – ${info.de}`}
  onclick={() => sim.exec(k)}
>
  {#key firing}
    <span class="flash" class:on={firing > 0} aria-hidden="true"></span>
  {/key}
  <span class="k">{info.label}</span>
  {#if next}<span class="badge" title="als Nächstes dran"></span>{/if}
</button>

<style>
  .mb {
    --tc: var(--cu);
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 30px;
    padding: 3px 10px;
    border-radius: 9px;
    border: 1.5px solid color-mix(in srgb, var(--tc) 55%, var(--border-strong));
    background: var(--surface);
    box-shadow: var(--shadow-s);
    cursor: pointer;
    overflow: hidden;
    transition: border-color 0.15s, background 0.15s, transform 0.05s;
    -webkit-tap-highlight-color: transparent;
    white-space: nowrap;
  }
  .mb:hover {
    border-color: var(--tc);
    background: color-mix(in srgb, var(--tc) 10%, var(--surface));
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
    position: relative;
    font-family: var(--font-mono);
    font-weight: 700;
    font-size: 0.82rem;
    color: var(--text);
  }
  .recording {
    border-style: dotted;
  }
  .next {
    border-style: dashed;
    border-color: var(--cu);
    border-width: 2px;
    background: color-mix(in srgb, var(--cu) 8%, var(--surface));
    padding-right: 18px;
  }
  .badge {
    position: absolute;
    right: 6px;
    top: 50%;
    width: 7px;
    height: 7px;
    margin-top: -3.5px;
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
    animation: flash 0.8s ease-out;
    background: color-mix(in srgb, var(--tc) 35%, transparent);
  }
  @keyframes flash {
    0% { opacity: 1; }
    100% { opacity: 0; }
  }
</style>
