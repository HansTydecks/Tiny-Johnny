<script lang="ts">
  /**
   * Cache mit Verdrängungsstrategien: ältester Eintrag (FIFO), am längsten nicht benutzt (LRU),
   * am seltensten benutzt (LFU), zufällig.
   */
  type Strategy = 'fifo' | 'lru' | 'lfu' | 'random';
  const STRATS: { key: Strategy; name: string; kurz: string }[] = [
    { key: 'fifo', name: 'Ältester Eintrag', kurz: 'FIFO' },
    { key: 'lru', name: 'Am längsten nicht benutzt', kurz: 'LRU' },
    { key: 'lfu', name: 'Am seltensten benutzt', kurz: 'LFU' },
    { key: 'random', name: 'Zufällig', kurz: 'Zufall' },
  ];
  const T_CACHE = 1;
  const T_RAM = 100;

  interface Entry {
    key: string;
    loaded: number;
    lastUsed: number;
    uses: number;
  }
  interface StepResult {
    req: string;
    hit: boolean;
    evicted?: string;
    cache: string[];
  }

  function simulate(seq: string[], size: number, strat: Strategy): StepResult[] {
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const cache: (Entry | null)[] = new Array(size).fill(null);
    const out: StepResult[] = [];
    seq.forEach((req, time) => {
      const found = cache.find((e) => e?.key === req);
      let evicted: string | undefined;
      if (found) {
        found.lastUsed = time;
        found.uses++;
      } else {
        let slot = cache.findIndex((e) => e === null);
        if (slot < 0) {
          const entries = cache as Entry[];
          if (strat === 'fifo') slot = entries.indexOf(entries.reduce((a, b) => (b.loaded < a.loaded ? b : a)));
          else if (strat === 'lru') slot = entries.indexOf(entries.reduce((a, b) => (b.lastUsed < a.lastUsed ? b : a)));
          else if (strat === 'lfu') slot = entries.indexOf(entries.reduce((a, b) => (b.uses < a.uses || (b.uses === a.uses && b.lastUsed < a.lastUsed) ? b : a)));
          else slot = Math.floor(rnd() * size);
          evicted = entries[slot].key;
        }
        cache[slot] = { key: req, loaded: time, lastUsed: time, uses: 1 };
      }
      out.push({ req, hit: !!found, evicted, cache: cache.map((e) => e?.key ?? '') });
    });
    return out;
  }

  let seqText = $state('A B C A B D A B E A B C D A B');
  let size = $state(3);
  let strat = $state<Strategy>('lru');
  let pos = $state(0);

  const seq = $derived(seqText.toUpperCase().split(/[\s,;]+/).filter(Boolean).slice(0, 30));
  const results = $derived(simulate(seq, size, strat));
  const shown = $derived(results.slice(0, pos));
  const hits = $derived(shown.filter((r) => r.hit).length);
  const misses = $derived(shown.length - hits);
  const time = $derived(hits * T_CACHE + misses * (T_CACHE + T_RAM));
  const compare = $derived(STRATS.map((s) => ({ ...s, hits: simulate(seq, size, s.key).filter((r) => r.hit).length })));
  const current = $derived(shown[shown.length - 1]);

  $effect(() => {
    void seqText;
    void size;
    void strat;
    pos = 0;
  });
</script>

<div class="cache">
  <div class="controls">
    <label class="seq">
      <span>Zugriffe der CPU (Speicherblöcke)</span>
      <input class="input mono" bind:value={seqText} />
    </label>
    <label>
      <span>Cache-Plätze</span>
      <select class="input" bind:value={size}>
        {#each [2, 3, 4] as n}<option value={n}>{n}</option>{/each}
      </select>
    </label>
    <label>
      <span>Verdrängungsstrategie</span>
      <select class="input" bind:value={strat}>
        {#each STRATS as s}<option value={s.key}>{s.name} ({s.kurz})</option>{/each}
      </select>
    </label>
  </div>

  <div class="timeline" aria-label="Zugriffsfolge">
    {#each seq as r, i}
      <span class="req mono" class:done={i < pos} class:hit={i < pos && results[i].hit} class:miss={i < pos && !results[i].hit} class:now={i === pos - 1}>{r}</span>
    {/each}
  </div>

  <div class="stage">
    <div class="box cpu">CPU<br /><small>will: <b class="mono">{current?.req ?? '–'}</b></small></div>
    <div class="box cachebox">
      <span class="box-t">Cache (schnell, klein)</span>
      <div class="slots">
        {#each Array(size) as _, i}
          {@const key = current?.cache[i] ?? ''}
          <span class="slot mono" class:fresh={current && !current.hit && key === current.req} class:used={current?.hit && key === current.req}>{key || '·'}</span>
        {/each}
      </div>
    </div>
    <div class="box ram">Arbeitsspeicher<br /><small>(groß, langsamer)</small></div>
  </div>

  <p class="msg" aria-live="polite">
    {#if !current}
      Drücke „Nächster Zugriff“.
    {:else if current.hit}
      <b class="hit-t">Treffer!</b> Block {current.req} liegt im Cache → nur {T_CACHE} ns.
    {:else}
      <b class="miss-t">Cache-Fehlzugriff.</b> Block {current.req} muss aus dem RAM nachgeladen werden (≈ {T_RAM} ns).
      {#if current.evicted}Dafür wird <b>{current.evicted}</b> verdrängt.{/if}
    {/if}
  </p>

  <div class="actions">
    <button class="btn primary small" type="button" onclick={() => pos < seq.length && pos++} disabled={pos >= seq.length}>Nächster Zugriff</button>
    <button class="btn small" type="button" onclick={() => (pos = seq.length)}>Alle</button>
    <button class="btn small ghost" type="button" onclick={() => (pos = 0)}>Zurücksetzen</button>
    <span class="stats">
      Treffer <b>{hits}</b> · Fehlzugriffe <b>{misses}</b> · Zeit <b class="mono">{time} ns</b>
    </span>
  </div>

  {#if pos >= seq.length && seq.length}
    <div class="compare">
      <b>Vergleich aller Strategien</b> ({seq.length} Zugriffe, {size} Plätze)
      {#each compare as c}
        <div class="bar-row">
          <span>{c.name}</span>
          <span class="bar"><span style={`width:${(c.hits / seq.length) * 100}%`}></span></span>
          <span class="mono">{c.hits} Treffer</span>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .cache {
    margin: 1.6em 0;
    padding: 16px;
    border: 1px solid var(--border);
    border-radius: 16px;
    background: var(--surface);
    box-shadow: var(--shadow-s);
  }
  .controls {
    display: grid;
    grid-template-columns: 2fr 0.7fr 1.4fr;
    gap: 10px;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 3px;
    font-size: 0.75rem;
    font-weight: 650;
    color: var(--text-3);
  }
  .input {
    min-height: 36px;
    padding: 4px 10px;
    font-size: 0.9rem;
  }
  .timeline {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin: 14px 0;
  }
  .req {
    width: 30px;
    height: 30px;
    display: grid;
    place-items: center;
    border-radius: 8px;
    background: var(--surface-2);
    border: 1px solid var(--border);
    font-weight: 700;
  }
  .req.hit {
    background: var(--ok-soft);
    border-color: var(--ok);
  }
  .req.miss {
    background: var(--err-soft);
    border-color: var(--err);
  }
  .req.now {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }
  .stage {
    display: grid;
    grid-template-columns: 1fr 2fr 1.2fr;
    gap: 10px;
    align-items: stretch;
  }
  .box {
    padding: 10px;
    border-radius: 12px;
    font-weight: 700;
    text-align: center;
    font-size: 0.9rem;
  }
  .box small {
    font-weight: 500;
    color: var(--text-2);
  }
  .cpu {
    background: var(--cu-soft);
    color: var(--cu);
  }
  .ram {
    background: var(--mem-soft);
    color: var(--mem);
  }
  .cachebox {
    background: var(--alu-soft);
  }
  .box-t {
    display: block;
    font-size: 0.78rem;
    color: var(--alu);
    margin-bottom: 6px;
  }
  .slots {
    display: flex;
    gap: 6px;
    justify-content: center;
  }
  .slot {
    width: 44px;
    height: 44px;
    display: grid;
    place-items: center;
    border-radius: 10px;
    background: var(--surface);
    border: 2px solid var(--border-strong);
    font-size: 1.1rem;
    color: var(--text);
  }
  .slot.fresh {
    border-color: var(--err);
    animation: pop 0.4s ease-out;
  }
  .slot.used {
    border-color: var(--ok);
    background: var(--ok-soft);
  }
  @keyframes pop {
    from {
      transform: scale(0.7);
    }
  }
  .msg {
    margin: 12px 0;
    min-height: 1.5em;
  }
  .hit-t {
    color: var(--ok);
  }
  .miss-t {
    color: var(--err);
  }
  .actions {
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
  }
  .stats {
    margin-left: auto;
    font-size: 0.88rem;
  }
  .compare {
    margin-top: 14px;
    padding: 12px;
    border-radius: 12px;
    background: var(--surface-2);
    font-size: 0.88rem;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .bar-row {
    display: grid;
    grid-template-columns: 190px 1fr 90px;
    gap: 10px;
    align-items: center;
  }
  .bar {
    height: 10px;
    border-radius: 5px;
    background: var(--surface-3);
    overflow: hidden;
  }
  .bar span {
    display: block;
    height: 100%;
    background: var(--alu);
  }
  @media (max-width: 700px) {
    .controls,
    .stage {
      grid-template-columns: 1fr;
    }
    .bar-row {
      grid-template-columns: 1fr 70px;
    }
    .bar {
      grid-column: 1 / -1;
      grid-row: 2;
    }
    .stats {
      margin-left: 0;
    }
  }
</style>
