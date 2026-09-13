<script lang="ts">
  /** n Adressleitungen → 2^n Speicherzellen */
  let n = $state(3);
  let bits = $state<boolean[]>([true, false, true, false, false, false, false, false]);

  const lines = $derived(bits.slice(0, n));
  const addr = $derived(lines.reduce((acc, b, i) => acc + (b ? 2 ** (n - 1 - i) : 0), 0));
  const cells = $derived(2 ** n);
  const toggle = (i: number) => (bits[i] = !bits[i]);
  const bin = (v: number) => v.toString(2).padStart(n, '0');
  // Beispielinhalte der Speicherzellen (8 Bit)
  const content = (a: number) => ((a * 73 + 29) % 256).toString(2).padStart(8, '0');
</script>

<div class="al">
  <div class="controls">
    <label>
      <span>Anzahl Adressleitungen: <b>{n}</b></span>
      <input type="range" min="1" max="8" bind:value={n} />
    </label>
    <div class="formula">
      2<sup>{n}</sup> = <b>{cells}</b> Speicherzellen
    </div>
  </div>

  <div class="wires" aria-label="Adressleitungen">
    <span class="cpu">CPU</span>
    <div class="bundle">
      {#each lines as b, i}
        <button type="button" class="wire" class:on={b} onclick={() => toggle(i)} aria-pressed={b} aria-label={`Leitung A${n - 1 - i}: ${b ? 'Strom (1)' : 'kein Strom (0)'}`}>
          <span class="name">A{n - 1 - i}</span>
          <span class="line"></span>
          <span class="bit mono">{b ? 1 : 0}</span>
        </button>
      {/each}
    </div>
    <span class="ram">Speicher</span>
  </div>

  <p class="addr">
    Adresse <code class="big">{bin(addr)}</code> = <b>{addr}</b>
    {#if n <= 5}<span class="muted"> · Inhalt: <code>{content(addr)}</code></span>{/if}
  </p>

  <div class="cells" class:dense={n > 5} aria-label={`${cells} Speicherzellen`}>
    {#each Array(cells) as _, a}
      <span class="cell" class:hit={a === addr} title={`Adresse ${a} (${bin(a)})`}>
        {#if n <= 4}<small class="mono">{bin(a)}</small>{/if}
      </span>
    {/each}
  </div>
  <p class="muted note">
    Tippe auf die Leitungen, um sie ein- oder auszuschalten. Jede zusätzliche Leitung <b>verdoppelt</b> die Zahl der
    ansprechbaren Zellen. Mit 8 Leitungen sind es 256, mit 32 Leitungen schon über 4 Milliarden (4 GB).
  </p>
</div>

<style>
  .al {
    margin: 1.6em 0;
    padding: 16px;
    border: 1px solid var(--border);
    border-radius: 16px;
    background: var(--surface);
    box-shadow: var(--shadow-s);
  }
  .controls {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
  }
  .controls label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 0.9rem;
    min-width: 220px;
  }
  .controls input {
    accent-color: var(--abus);
  }
  .formula {
    font-size: 1.25rem;
    padding: 6px 14px;
    border-radius: 10px;
    background: var(--abus-soft);
  }
  .wires {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 10px;
    margin: 14px 0;
  }
  .cpu,
  .ram {
    padding: 10px 12px;
    border-radius: 10px;
    font-weight: 700;
    font-size: 0.85rem;
  }
  .cpu {
    background: var(--cu-soft);
    color: var(--cu);
  }
  .ram {
    background: var(--mem-soft);
    color: var(--mem);
  }
  .bundle {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .wire {
    display: grid;
    grid-template-columns: 32px 1fr 22px;
    align-items: center;
    gap: 8px;
    border: 0;
    background: transparent;
    padding: 2px 0;
    cursor: pointer;
  }
  .name {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    color: var(--text-3);
  }
  .line {
    height: 6px;
    border-radius: 3px;
    background: var(--surface-3);
    transition: background 0.2s, box-shadow 0.2s;
  }
  .wire.on .line {
    background: var(--abus);
    box-shadow: 0 0 10px color-mix(in srgb, var(--abus) 60%, transparent);
  }
  .bit {
    font-weight: 800;
  }
  .wire.on .bit {
    color: var(--abus);
  }
  .addr {
    margin: 4px 0 10px;
  }
  .big {
    font-size: 1.05rem;
  }
  .cells {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(46px, 1fr));
    gap: 4px;
  }
  .cells.dense {
    grid-template-columns: repeat(auto-fill, minmax(14px, 1fr));
    gap: 2px;
  }
  .cell {
    aspect-ratio: 1.6;
    border-radius: 5px;
    background: var(--mem-soft);
    border: 1px solid color-mix(in srgb, var(--mem) 20%, transparent);
    display: grid;
    place-items: center;
  }
  .dense .cell {
    aspect-ratio: 1;
    border-radius: 2px;
  }
  .cell small {
    font-size: 0.66rem;
    color: var(--text-2);
  }
  .cell.hit {
    background: var(--abus);
    border-color: var(--abus);
  }
  .cell.hit small {
    color: var(--surface);
    font-weight: 700;
  }
  .note {
    font-size: 0.85rem;
    margin: 10px 0 0;
  }
</style>
