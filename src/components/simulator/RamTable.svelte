<script lang="ts">
  import { disassembleValue, formatAddr, formatValue } from '../../lib/johnny/assembler';
  import { opcodeOf, type JohnnyState } from '../../lib/johnny/engine';
  import type { Sim } from '../../lib/johnny/sim.svelte';

  interface Props {
    sim: Sim;
    /** Angezeigter Zustand (während der Wiedergabe eines Makroschritts ein Zwischenzustand) */
    view?: JohnnyState;
    labels?: Record<string, string>;
    /** Mindesthöhe; die Tabelle wächst mit dem Platz, den sie bekommt */
    height?: number;
    showPc?: boolean;
    showAb?: boolean;
    selectable?: boolean;
    /** Gerade gelesene / beschriebene Zelle und ein Zähler, der das Aufleuchten neu startet */
    read?: number;
    write?: number;
    hitKey?: number;
  }
  let {
    sim,
    view,
    labels = {},
    height = 420,
    showPc = true,
    showAb = true,
    selectable = true,
    read,
    write,
    hitKey = 0,
  }: Props = $props();

  const st = $derived(view ?? sim.s);
  const ROW = 34;
  const TOTAL = 1000;
  let scrollTop = $state(0);
  let measured = $state(0);
  let viewport: HTMLDivElement | undefined = $state();
  const vh = $derived(measured || height);

  const start = $derived(Math.max(0, Math.floor(scrollTop / ROW) - 8));
  const end = $derived(Math.min(TOTAL, Math.ceil((scrollTop + vh) / ROW) + 8));
  const rows = $derived(Array.from({ length: Math.max(0, end - start) }, (_, i) => start + i));

  const labelMap = $derived(Object.fromEntries(Object.entries(labels).map(([k, v]) => [Number(k), v])));

  function ensureVisible(addr: number | undefined) {
    if (addr === undefined || !viewport) return;
    const top = addr * ROW;
    const pad = ROW * 1.5;
    if (top < viewport.scrollTop + pad) viewport.scrollTop = Math.max(0, top - pad);
    else if (top + ROW > viewport.scrollTop + vh - pad) viewport.scrollTop = top + ROW - vh + pad;
  }

  $effect(() => {
    void hitKey;
    const target = sim.running && write === undefined && read === undefined ? st.pc : (write ?? read ?? (showPc ? st.pc : undefined));
    ensureVisible(target);
  });
  $effect(() => {
    ensureVisible(sim.selected);
  });

  function onKey(e: KeyboardEvent) {
    if (!selectable) return;
    if (e.key === 'ArrowDown') {
      sim.select(sim.selected + 1);
      e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      sim.select(sim.selected - 1);
      e.preventDefault();
    }
  }
</script>

<div class="ram">
  <div class="thead" aria-hidden="true">
    <span></span><span><span class="long">Adresse</span><span class="short">Adr.</span></span><span>Inhalt</span><span>Bedeutung</span>
  </div>
  <div
    class="viewport"
    bind:this={viewport}
    style="min-height:{height}px"
    bind:clientHeight={measured}
    onscroll={(e) => (scrollTop = (e.currentTarget as HTMLDivElement).scrollTop)}
    role="grid"
    aria-label="Speicher mit 1000 Zellen"
    aria-rowcount={TOTAL}
    tabindex="0"
    onkeydown={onKey}
  >
    <div class="inner" style="height:{TOTAL * ROW}px">
      {#each rows as i (i)}
        {@const v = st.ram[i]}
        {@const d = disassembleValue(v, st.names)}
        {@const isPc = showPc && st.pc === i}
        {@const isAb = showAb && st.ab === i}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div
          class="row"
          class:pc={isPc}
          class:ab={isAb}
          class:sel={selectable && sim.selected === i}
          class:labeled={labelMap[i] !== undefined}
          class:empty={v === 0}
          style="top:{i * ROW}px"
          role="row"
          aria-rowindex={i + 1}
          tabindex="-1"
          onclick={() => selectable && sim.select(i)}
        >
          {#key hitKey}
            <span class="hit" class:read={read === i} class:write={write === i}></span>
          {/key}
          <span class="mark" role="gridcell">
            {#if isPc}<span class="pc-tag" title="Programmzähler zeigt hierhin">pc</span>{/if}
            {#if isAb}<span class="ab-tag" title="Adressbus zeigt hierhin">ab</span>{/if}
          </span>
          <span class="addr" role="gridcell">{formatAddr(i)}</span>
          <span class="val" role="gridcell">{formatValue(v)}</span>
          <span class="asm" role="gridcell">
            {#if d}
              <b>{d.mnemonic}</b> <span class="op">{formatAddr(d.operand)}</span>
            {:else if v !== 0 && opcodeOf(v) === 0}
              <span class="num">= {v}</span>
            {:else if v !== 0}
              <span class="num unknown" title="Für diesen Opcode gibt es keinen Befehl">? {v}</span>
            {/if}
            {#if labelMap[i] !== undefined}<span class="lbl">{labelMap[i]}</span>{/if}
          </span>
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  .ram {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    border: 1px solid var(--border);
    border-radius: 12px;
    overflow: hidden;
    background: var(--surface);
  }
  .thead,
  .row {
    display: grid;
    grid-template-columns: 58px 62px 78px minmax(0, 1fr);
    align-items: center;
    column-gap: 6px;
  }
  .thead {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-3);
    padding: 7px 10px 7px 0;
    background: var(--surface-2);
    border-bottom: 1px solid var(--border);
  }
  .viewport {
    flex: 1 1 0;
    overflow-y: auto;
    position: relative;
    overscroll-behavior: contain;
    outline: none;
  }
  .viewport:focus-visible {
    box-shadow: inset var(--ring);
  }
  .inner {
    position: relative;
  }
  .row {
    position: absolute;
    left: 0;
    right: 0;
    height: 34px;
    padding-right: 10px;
    border-bottom: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
    font-size: 0.88rem;
    cursor: pointer;
  }
  .row:hover {
    background: var(--surface-2);
  }
  .row.labeled {
    background: color-mix(in srgb, var(--mem) 5%, transparent);
  }
  .row.ab {
    background: color-mix(in srgb, var(--abus) 14%, transparent);
  }
  .row.sel {
    box-shadow: inset 0 0 0 2px var(--accent);
    border-radius: 6px;
  }
  .row.pc .addr {
    color: var(--cu);
    font-weight: 800;
  }
  .row.empty .val {
    color: var(--text-3);
  }
  .mark {
    display: flex;
    gap: 3px;
    justify-content: flex-end;
    padding-left: 4px;
  }
  .pc-tag,
  .ab-tag {
    font-size: 0.64rem;
    font-weight: 800;
    padding: 1px 5px;
    border-radius: 5px;
    line-height: 1.3;
  }
  .pc-tag {
    background: var(--cu);
    color: var(--surface);
  }
  .ab-tag {
    background: var(--abus);
    color: var(--surface);
  }
  .addr {
    color: var(--text-3);
  }
  .val {
    font-weight: 600;
  }
  .asm {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
  }
  .asm b {
    color: var(--mem);
    font-weight: 700;
  }
  .op {
    color: var(--text-2);
  }
  .num {
    color: var(--text-3);
  }
  .unknown {
    color: var(--warn);
  }
  .lbl {
    margin-left: auto;
    font-family: var(--font-sans);
    font-size: 0.72rem;
    font-weight: 650;
    color: var(--mem);
    background: var(--mem-soft);
    border-radius: 6px;
    padding: 1px 7px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .hit {
    position: absolute;
    inset: 0;
    pointer-events: none;
    opacity: 0;
  }
  .hit.read {
    background: color-mix(in srgb, var(--dbus) 30%, transparent);
    animation: hit 1.1s ease-out forwards;
  }
  .hit.write {
    background: color-mix(in srgb, var(--mem) 35%, transparent);
    animation: hit 1.1s ease-out forwards;
  }
  .short {
    display: none;
  }
  /* Schmale Speicherspalte im Schaltbild */
  @container (max-width: 310px) {
    .thead,
    .row {
      grid-template-columns: 46px 36px 64px minmax(0, 1fr);
      column-gap: 5px;
    }
    .row {
      font-size: 0.82rem;
    }
    .thead {
      font-size: 0.62rem;
    }
    .long {
      display: none;
    }
    .short {
      display: inline;
    }
  }

  @keyframes hit {
    0% { opacity: 1; }
    100% { opacity: 0; }
  }
</style>
