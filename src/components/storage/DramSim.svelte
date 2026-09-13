<script lang="ts">
  /**
   * Elektronischer Speicher: DRAM (Kondensator verliert Ladung → Refresh) im Vergleich zu Flash (nicht flüchtig).
   * Die Zeit läuft in Zeitlupe: 1 Sekunde echt = 100 ms simuliert.
   */
  import { onMount } from 'svelte';

  const TAU = 92; // ms: nach ~64 ms ist die Hälfte der Ladung weg
  const THRESH = 0.5;

  let written = $state(0b10110010);
  let charge = $state<number[]>(Array.from({ length: 8 }, (_, i) => ((0b10110010 >> (7 - i)) & 1 ? 1 : 0)));
  let flash = $state<number[]>(Array.from({ length: 8 }, (_, i) => ((0b01101001 >> (7 - i)) & 1)));
  let refreshOn = $state(true);
  let interval = $state(50);
  let simTime = $state(0);
  let sinceRefresh = $state(0);
  let refreshes = $state(0);
  let power = $state(true);
  let running = $state(true);
  let flashFlash = $state(false);

  const readBits = $derived(charge.map((c): number => (c >= THRESH ? 1 : 0)));
  const readValue = $derived(readBits.reduce((a, b) => a * 2 + b, 0));
  const errors = $derived(readValue !== written);

  function writeValue(v: number) {
    written = v & 255;
    charge = Array.from({ length: 8 }, (_, i) => ((written >> (7 - i)) & 1 ? 1 : 0));
    sinceRefresh = 0;
  }

  onMount(() => {
    let last = performance.now();
    let raf = 0;
    const loop = (t: number) => {
      const realDt = Math.min(64, t - last);
      last = t;
      if (running && power) {
        const dt = realDt / 10; // Zeitlupe ×10
        simTime += dt;
        sinceRefresh += dt;
        charge = charge.map((c) => c * Math.exp(-dt / TAU));
        if (refreshOn && sinceRefresh >= interval) {
          // Refresh: lesen und neu schreiben
          charge = charge.map((c) => (c >= THRESH ? 1 : 0));
          sinceRefresh = 0;
          refreshes++;
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  });

  function powerOff() {
    power = false;
    charge = charge.map(() => 0);
  }
  function powerOn() {
    power = true;
    sinceRefresh = 0;
  }
  function toggleBit(i: number) {
    writeValue(written ^ (1 << (7 - i)));
  }
  function flashToggle(i: number) {
    if (!power) return;
    flash[i] = flash[i] ? 0 : 1;
    flashFlash = true;
    setTimeout(() => (flashFlash = false), 500);
  }
</script>

<div class="dram">
  <div class="panel-d">
    <header>
      <h4>DRAM – Arbeitsspeicher</h4>
      <span class="chip">flüchtig</span>
    </header>
    <p class="muted small">Jedes Bit ist ein winziger <b>Kondensator</b> mit einem Transistor als Schalter. Geladen = 1, ungeladen = 0. Tippe ein Bit an, um es neu zu schreiben.</p>

    <div class="cells">
      {#each charge as c, i}
        <button type="button" class="cap" onclick={() => toggleBit(i)} aria-label={`Bit ${7 - i}: Ladung ${Math.round(c * 100)} %`}>
          <span class="tank"><span class="fill" class:low={c < THRESH && readBits[i] !== ((written >> (7 - i)) & 1)} style={`height:${c * 100}%`}></span><span class="thresh"></span></span>
          <span class="bitw mono">{(written >> (7 - i)) & 1}</span>
          <span class="bitr mono" class:bad={readBits[i] !== ((written >> (7 - i)) & 1)}>{readBits[i]}</span>
        </button>
      {/each}
      <div class="legend">
        <span>Ladung</span>
        <span>geschrieben</span>
        <span>gelesen</span>
      </div>
    </div>

    <div class="status" class:bad={errors}>
      Geschrieben <code>{written}</code> · Gelesen <code>{readValue}</code>
      {#if errors}<b>→ Daten beschädigt!</b>{:else}<span>✓</span>{/if}
    </div>

    <div class="ctrl">
      <label class="switch"><input type="checkbox" bind:checked={refreshOn} /> Refresh</label>
      <label class="range">
        Intervall <b>{interval} ms</b>
        <input type="range" min="10" max="150" step="10" bind:value={interval} disabled={!refreshOn} />
      </label>
      <button class="btn small" type="button" onclick={() => writeValue(written)}>Neu schreiben</button>
    </div>
    <div class="timebar">
      <span class="muted">Zeit: <b class="mono">{Math.round(simTime)} ms</b> (Zeitlupe ×10) · Refreshs: <b class="mono">{refreshes}</b></span>
      <span class="tbar"><span style={`width:${Math.min(100, (sinceRefresh / interval) * 100)}%`}></span></span>
    </div>
  </div>

  <div class="panel-f">
    <header>
      <h4>Flash – SSD, USB-Stick</h4>
      <span class="chip">nicht flüchtig</span>
    </header>
    <p class="muted small">Elektronen werden in einem isolierten <b>Floating Gate</b> eingesperrt. Sie bleiben dort jahrelang – auch ohne Strom.</p>
    <div class="fcells" class:writing={flashFlash}>
      {#each flash as b, i}
        <button type="button" class="fg" class:on={b === 1} onclick={() => flashToggle(i)} aria-label={`Flash-Bit ${7 - i}: ${b}`}>
          <span class="gate">{#if b}{#each Array(4) as _}<i></i>{/each}{/if}</span>
          <span class="mono">{b}</span>
        </button>
      {/each}
    </div>
    <p class="muted small">Schreiben dauert länger und nutzt die Zellen ab (einige tausend Schreibzyklen je Zelle).</p>

    <div class="power">
      {#if power}
        <button class="btn" type="button" onclick={powerOff}>Strom ausschalten</button>
      {:else}
        <button class="btn primary" type="button" onclick={powerOn}>Strom einschalten</button>
        <p class="small"><b>Strom aus:</b> Die DRAM-Kondensatoren sind sofort leer – der Flash-Speicher behält seine Bits.</p>
      {/if}
    </div>
  </div>
</div>

<style>
  .dram {
    margin: 1.6em 0;
    display: grid;
    grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr);
    gap: 14px;
  }
  .panel-d,
  .panel-f {
    padding: 16px;
    border: 1px solid var(--border);
    border-radius: 16px;
    background: var(--surface);
    box-shadow: var(--shadow-s);
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }
  h4 {
    margin: 0;
  }
  .small {
    font-size: 0.84rem;
    margin: 6px 0 10px;
  }
  .cells {
    display: grid;
    grid-template-columns: repeat(8, minmax(0, 1fr)) auto;
    gap: 6px;
    align-items: end;
  }
  .cap {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    border: 0;
    background: none;
    padding: 0;
    cursor: pointer;
  }
  .tank {
    position: relative;
    width: 100%;
    max-width: 36px;
    height: 80px;
    border-radius: 6px;
    border: 2px solid var(--border-strong);
    background: var(--surface-2);
    overflow: hidden;
    display: block;
  }
  .fill {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(to top, var(--mem), color-mix(in srgb, var(--mem) 60%, white));
  }
  .fill.low {
    background: var(--err);
  }
  .thresh {
    position: absolute;
    left: -2px;
    right: -2px;
    top: 50%;
    border-top: 2px dashed var(--text-3);
  }
  .bitw,
  .bitr {
    font-size: 0.85rem;
    font-weight: 700;
  }
  .bitw {
    color: var(--text-3);
  }
  .bitr.bad {
    color: var(--err);
  }
  .legend {
    display: flex;
    flex-direction: column;
    gap: 3px;
    font-size: 0.65rem;
    color: var(--text-3);
    padding-left: 4px;
  }
  .legend span:first-child {
    height: 80px;
    display: flex;
    align-items: center;
  }
  .status {
    margin: 10px 0;
    padding: 8px 12px;
    border-radius: 10px;
    background: var(--ok-soft);
    font-size: 0.9rem;
  }
  .status.bad {
    background: var(--err-soft);
  }
  .ctrl {
    display: flex;
    gap: 14px;
    align-items: center;
    flex-wrap: wrap;
  }
  .switch {
    display: flex;
    gap: 6px;
    align-items: center;
    font-weight: 650;
  }
  .range {
    display: flex;
    flex-direction: column;
    font-size: 0.8rem;
    gap: 2px;
  }
  .range input,
  .switch input {
    accent-color: var(--mem);
  }
  .timebar {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-top: 10px;
    font-size: 0.8rem;
  }
  .tbar {
    height: 6px;
    border-radius: 3px;
    background: var(--surface-3);
    overflow: hidden;
  }
  .tbar span {
    display: block;
    height: 100%;
    background: var(--mem);
  }
  .fcells {
    display: grid;
    grid-template-columns: repeat(8, 1fr);
    gap: 6px;
    transition: filter 0.3s;
  }
  .fcells.writing {
    filter: drop-shadow(0 0 6px var(--abus));
  }
  .fg {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    border: 0;
    background: none;
    padding: 0;
    cursor: pointer;
    font-weight: 700;
  }
  .gate {
    width: 100%;
    max-width: 34px;
    height: 44px;
    border-radius: 6px;
    border: 3px double var(--border-strong);
    background: var(--surface-2);
    display: flex;
    flex-wrap: wrap;
    align-content: center;
    justify-content: center;
    gap: 3px;
    padding: 3px;
  }
  .fg.on .gate {
    border-color: var(--abus);
  }
  .gate i {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--abus);
  }
  .power {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--border);
  }
  .power p {
    margin: 8px 0 0;
  }
  @media (max-width: 860px) {
    .dram {
      grid-template-columns: 1fr;
    }
  }
</style>
