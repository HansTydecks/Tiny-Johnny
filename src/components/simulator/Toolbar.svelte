<script lang="ts">
  import type { Example, Feature, Sim } from '../../lib/johnny/sim.svelte';
  import { mcFromFile, mcToFile, ramFromFile, ramFromShare, ramToFile, ramToShare } from '../../lib/johnny/fileio';
  import { microprogramFor } from '../../lib/johnny/microcode';

  interface Props {
    sim: Sim;
    features: Set<Feature>;
    examples?: Example[];
    share?: boolean;
  }
  let { sim, features, examples = [], share = false }: Props = $props();

  const has = (f: Feature) => features.has(f);
  const anyMenu = $derived(has('clearRam') || has('files') || has('bonsai') || has('controlToggle') || share);
  let ramInput: HTMLInputElement | undefined = $state();
  let mcInput: HTMLInputElement | undefined = $state();
  let menu: HTMLDetailsElement | undefined = $state();
  let exMenu: HTMLDetailsElement | undefined = $state();
  let toast = $state('');

  function flash(msg: string) {
    toast = msg;
    setTimeout(() => (toast = ''), 2600);
  }

  function download(text: string, name: string) {
    const blob = new Blob([text], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 0);
  }

  async function readFile(input: HTMLInputElement | undefined): Promise<string | null> {
    const file = input?.files?.[0];
    if (!file) return null;
    const text = await file.text();
    input!.value = '';
    return text;
  }

  function close() {
    if (menu) menu.open = false;
    if (exMenu) exMenu.open = false;
  }

  function onWindowClick(e: MouseEvent) {
    for (const d of [menu, exMenu]) if (d?.open && !d.contains(e.target as Node)) d.open = false;
  }

  async function copyShare() {
    const url = new URL(location.href);
    url.hash = `p=${ramToShare(sim.s.ram)}${sim.s.mode === 'bonsai' ? '&m=bonsai' : ''}`;
    try {
      await navigator.clipboard.writeText(url.toString());
      flash('Link kopiert – wer ihn öffnet, sieht dein Programm.');
    } catch {
      prompt('Diesen Link kopieren:', url.toString());
    }
    close();
  }

  function loadExample(ex: Example) {
    sim.reset();
    if (sim.s.mode !== ex.modus) sim.setMode(ex.modus);
    sim.loadRam(ramFromShare(ex.code));
    sim.info(`Beispiel geladen: ${ex.titel}`);
    flash(`„${ex.titel}“ geladen`);
    close();
  }
</script>

<svelte:window onclick={onWindowClick} />

<div class="toolbar">
  <div class="group">
    {#if has('microStep')}
      <button class="btn" type="button" onclick={() => sim.microStep()} disabled={!sim.controlUnit} title="Einen einzelnen Mikrobefehl aus dem Mikrocode ausführen">
        <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M6 4l7 6-7 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" /></svg>
        Mikroschritt
      </button>
    {/if}
    {#if has('macroStep')}
      <button class="btn" type="button" onclick={() => sim.macroStep()} disabled={!sim.controlUnit} title="Einen ganzen Befehl (FETCH + Ausführung) abarbeiten">
        <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M3 4l6 6-6 6M10 4l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" /></svg>
        Makroschritt
      </button>
    {/if}
    {#if has('run')}
      <button class="btn primary run" type="button" onclick={() => sim.toggleRun()} disabled={!sim.controlUnit}>
        {#if sim.running}
          <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M6 4v12M14 4v12" stroke="currentColor" stroke-width="3" stroke-linecap="round" /></svg>
          Pause
        {:else}
          <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M6 3.5v13l10-6.5z" fill="currentColor" /></svg>
          Ausführen
        {/if}
      </button>
    {/if}
    {#if has('reset')}
      <button class="btn" type="button" onclick={() => sim.reset()} title="Alle Register auf 0 setzen (der Speicher bleibt erhalten)">
        <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M4 10a6 6 0 1 0 2-4.5M4 3v3.5h3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
        Reset
      </button>
    {/if}
  </div>

  {#if has('run')}
    <div class="speed" title="Geschwindigkeit beim Ausführen">
      <span class="muted small">langsam</span>
      <input
        type="range"
        min="0"
        max="1450"
        step="50"
        value={1500 - sim.speed}
        oninput={(e) => (sim.speed = 1500 - Number((e.currentTarget as HTMLInputElement).value))}
        disabled={sim.turbo}
        aria-label="Geschwindigkeit"
      />
      <span class="muted small">schnell</span>
      <label class="turbo"><input type="checkbox" bind:checked={sim.turbo} /> Turbo</label>
    </div>
  {/if}

  <div class="group right">
    {#if sim.controlUnit && (has('macroStep') || has('run') || has('microStep'))}
      <span class="counter" title="Takte = ausgeführte Mikrobefehle, Befehle = ausgeführte Makrobefehle">
        <b>{sim.ticks}</b> Takte · <b>{sim.macros}</b> Befehle
      </span>
    {/if}
    {#if examples.length}
      <details class="menu" bind:this={exMenu}>
        <summary class="btn">Beispiele</summary>
        <div class="dropdown wide-dd">
          {#each examples as ex}
            <button type="button" class="item" onclick={() => loadExample(ex)}>
              <b>{ex.titel}</b>{#if ex.modus === 'bonsai'} <span class="chip">Bonsai</span>{/if}
              <span>{ex.beschreibung}</span>
            </button>
          {/each}
        </div>
      </details>
    {/if}
    {#if anyMenu}
      <details class="menu" bind:this={menu}>
        <summary class="btn" aria-label="Weitere Funktionen">
          <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><circle cx="4" cy="10" r="1.8" fill="currentColor" /><circle cx="10" cy="10" r="1.8" fill="currentColor" /><circle cx="16" cy="10" r="1.8" fill="currentColor" /></svg>
          Mehr
        </summary>
        <div class="dropdown">
          {#if has('controlToggle')}
            <label class="item check">
              <input type="checkbox" bind:checked={sim.controlUnit} />
              <span><b>Mikroprogramm-Steuerung</b><span>Ausgeschaltet bist du selbst das Steuerwerk und klickst alle Mikrobefehle an.</span></span>
            </label>
          {/if}
          {#if has('bonsai')}
            <button type="button" class="item" onclick={() => { if (confirm('Der Mikrocode wird ersetzt. Weiter?')) sim.setMode(sim.s.mode === 'bonsai' ? 'normal' : 'bonsai'); close(); }}>
              <b>{sim.s.mode === 'bonsai' ? 'Normaler Befehlssatz' : 'Bonsai-Modus'}</b>
              <span>{sim.s.mode === 'bonsai' ? 'Zurück zu TAKE, ADD, SUB, SAVE …' : 'Nur INC, DEC, JMP, TST und HLT – wie der Bonsai-Computer.'}</span>
            </button>
          {/if}
          {#if has('clearRam')}
            <button type="button" class="item" onclick={() => { if (confirm('Alle 1000 Speicherzellen auf 0 setzen?')) { sim.clearRam(); sim.info('Speicher gelöscht.'); } close(); }}>
              <b>Speicher löschen</b><span>Alle Zellen auf 00.000 setzen.</span>
            </button>
          {/if}
          {#if has('files')}
            <hr />
            <button type="button" class="item" onclick={() => { download(ramToFile(sim.s.ram), 'programm.ram'); close(); }}>
              <b>Speicher speichern (.ram)</b><span>Kann auch im Original-Johnny geöffnet werden.</span>
            </button>
            <button type="button" class="item" onclick={() => ramInput?.click()}>
              <b>Speicher laden (.ram)</b><span>Datei aus Tiny Johnny oder dem Original.</span>
            </button>
            <button type="button" class="item" onclick={() => { download(mcToFile(sim.s.microcode, sim.s.names), 'mikrocode.mc'); close(); }}>
              <b>Mikrocode speichern (.mc)</b><span>Mit deinen eigenen Befehlen.</span>
            </button>
            <button type="button" class="item" onclick={() => mcInput?.click()}>
              <b>Mikrocode laden (.mc)</b><span>Eigene Befehlssätze einlesen.</span>
            </button>
            <button type="button" class="item" onclick={() => { const mp = microprogramFor(sim.s.mode); sim.loadMicroprogram(mp.microcode, mp.names); sim.info('Mikrocode zurückgesetzt.'); close(); }}>
              <b>Mikrocode zurücksetzen</b><span>Eigene Befehle werden entfernt.</span>
            </button>
          {/if}
          {#if share}
            <hr />
            <button type="button" class="item" onclick={copyShare}>
              <b>Link zum Programm kopieren</b><span>Zum Teilen mit Mitschüler:innen oder der Lehrkraft.</span>
            </button>
          {/if}
        </div>
      </details>
    {/if}
  </div>
  <input
    class="sr-only"
    type="file"
    accept=".ram,.txt"
    bind:this={ramInput}
    onchange={async () => {
      const t = await readFile(ramInput);
      if (t !== null) {
        sim.reset();
        sim.loadRam(ramFromFile(t));
        flash('Speicher geladen');
      }
      close();
    }}
  />
  <input
    class="sr-only"
    type="file"
    accept=".mc,.txt"
    bind:this={mcInput}
    onchange={async () => {
      const t = await readFile(mcInput);
      if (t !== null) {
        const mc = mcFromFile(t);
        sim.loadMicroprogram(mc.microcode, mc.names);
        flash('Mikrocode geladen');
      }
      close();
    }}
  />
  {#if toast}<div class="toast" role="status">{toast}</div>{/if}
</div>

<style>
  .toolbar {
    position: relative;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px 16px;
    padding: 10px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 14px;
    box-shadow: var(--shadow-s);
  }
  .group {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }
  .group.right {
    margin-left: auto;
  }
  .run {
    min-width: 128px;
  }
  .speed {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .speed input[type='range'] {
    width: 110px;
    accent-color: var(--accent);
  }
  .small {
    font-size: 0.75rem;
  }
  .turbo {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-2);
    cursor: pointer;
  }
  .turbo input {
    accent-color: var(--accent);
  }
  .counter {
    font-size: 0.8rem;
    color: var(--text-3);
    white-space: nowrap;
  }
  .counter b {
    color: var(--text);
    font-family: var(--font-mono);
  }
  .menu {
    position: relative;
  }
  .menu summary {
    list-style: none;
  }
  .menu summary::-webkit-details-marker {
    display: none;
  }
  .dropdown {
    position: absolute;
    right: 0;
    top: calc(100% + 6px);
    z-index: 30;
    width: 300px;
    max-height: 70vh;
    overflow-y: auto;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    box-shadow: var(--shadow-l);
    padding: 6px;
  }
  .wide-dd {
    width: 360px;
  }
  .dropdown hr {
    margin: 6px 4px;
  }
  .item {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 1px;
    width: 100%;
    text-align: left;
    padding: 8px 10px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    cursor: pointer;
    font-size: 0.9rem;
  }
  .item:hover {
    background: var(--surface-2);
  }
  .item > span,
  .item span span {
    font-size: 0.78rem;
    color: var(--text-3);
    display: block;
  }
  .item.check {
    flex-direction: row;
    gap: 10px;
  }
  .item.check input {
    margin-top: 4px;
    accent-color: var(--accent);
  }
  .toast {
    position: absolute;
    right: 12px;
    top: calc(100% + 8px);
    z-index: 40;
    background: var(--text);
    color: var(--bg);
    padding: 8px 14px;
    border-radius: 10px;
    font-size: 0.85rem;
    box-shadow: var(--shadow-l);
  }
  @media (max-width: 640px) {
    .toolbar .btn {
      padding: 6px 10px;
      font-size: 0.88rem;
    }
    .group.right {
      margin-left: 0;
    }
    .dropdown {
      right: auto;
      left: 0;
      width: min(300px, calc(100vw - 48px));
    }
  }
</style>
