<script lang="ts">
  import { ALL_FEATURES, ALL_PARTS, type Example, type Feature, type Part, type Sim } from '../../lib/johnny/sim.svelte';
  import { MICRO_BY_CODE, MICRO_BY_KEY } from '../../lib/johnny/microcode';
  import { disassembleValue, formatAddr, pad } from '../../lib/johnny/assembler';
  import { addrOf, opcodeOf } from '../../lib/johnny/engine';
  import Register from './Register.svelte';
  import MicroButton from './MicroButton.svelte';
  import RamTable from './RamTable.svelte';
  import RamEditor from './RamEditor.svelte';
  import MicrocodePanel from './MicrocodePanel.svelte';
  import Toolbar from './Toolbar.svelte';

  interface Props {
    sim: Sim;
    show?: Part[];
    micro?: 'alle' | string[];
    features?: Feature[];
    labels?: Record<string, string>;
    examples?: Example[];
    share?: boolean;
    ramHeight?: number;
  }
  let {
    sim,
    show = ALL_PARTS,
    micro = 'alle',
    features = ALL_FEATURES,
    labels = {},
    examples = [],
    share = false,
    ramHeight = 408,
  }: Props = $props();

  const parts = $derived(new Set(show));
  const feats = $derived(new Set(features));
  const allowed = (k: string) => micro === 'alle' || micro.includes(k);
  const cuVisible = $derived(sim.controlUnit && (parts.has('ins') || parts.has('pc') || parts.has('mc')));
  const hit = (t: string) => sim.events.some((e) => e.target === t);
  const touched = (t: string) => sim.events.some((e) => e.target === t || e.source === t);

  const ramButtons = ['ram->db', 'db->ram'];
  const accButtons = ['db->acc', 'acc->db', 'plus', 'minus', 'acc:=0', 'acc++', 'acc--'];
  const insButtons = ['db->ins', 'ins->ab', 'ins->pc', 'ins->mc'];
  const pcButtons = ['pc->ab', 'pc++', '=0:pc++'];
  const mcButtons = ['mc:=0', 'stopp'];
  const filt = (list: string[]) => list.filter(allowed);

  const insCmd = $derived(disassembleValue(sim.s.ins, sim.s.names));
  const mcSlot = $derived(Math.floor(sim.s.mc / 10));
  const nextMicro = $derived(MICRO_BY_CODE[sim.s.microcode[sim.s.mc]]);

  let abText = $state('');
  let dbText = $state('');

  const showToolbar = $derived(
    ['microStep', 'macroStep', 'run', 'reset', 'clearRam', 'files', 'controlToggle', 'bonsai'].some((f) => feats.has(f as Feature)) ||
      examples.length > 0,
  );
  const hasBuses = $derived(parts.has('ab') || parts.has('db'));
  const hasCpu = $derived(parts.has('acc') || parts.has('ins') || parts.has('pc') || parts.has('mc'));
  const layout = $derived(
    parts.has('ram') && hasBuses && hasCpu ? 'full' : parts.has('ram') && hasBuses ? 'ram-bus' : parts.has('ram') ? 'ram-only' : 'cpu-only',
  );
</script>

<div class="johnny" class:running={sim.running}>
  {#if showToolbar}
    <Toolbar {sim} features={feats} {examples} {share} />
  {/if}

  {#if sim.stop}
    <div class="stop stop-{sim.stop.reason}" role="status">
      <span class="stop-icon" aria-hidden="true">{sim.stop.reason === 'halt' ? '■' : sim.stop.reason === 'error' ? '!' : '⏸'}</span>
      <span>{sim.stop.message}</span>
      <button class="btn small ghost" type="button" onclick={() => (sim.stop = null)} aria-label="Meldung schließen">×</button>
    </div>
  {/if}

  <div class="board layout-{layout}">
    {#if parts.has('ram')}
      <section class="panel c-mem ram-panel" aria-label="Speicher">
        <header>
          <h3><span class="swatch"></span>Speicher <span class="abbr">RAM</span></h3>
          <span class="muted tiny">1000 Zellen · 000–999</span>
        </header>
        <RamTable {sim} {labels} height={ramHeight} showPc={parts.has('pc')} showAb={parts.has('ab')} selectable={feats.has('ramEdit')} />
        {#if filt(ramButtons).length}
          <div class="btn-grid two">
            {#each filt(ramButtons) as k (k)}<MicroButton {sim} {k} showNext={parts.has('mc')} />{/each}
          </div>
        {/if}
        {#if feats.has('ramEdit')}
          <RamEditor {sim} asm={feats.has('asm')} />
        {/if}
      </section>
    {/if}

    {#if hasBuses}
      <section class="buses" aria-label="Busse">
        {#if parts.has('ab')}
          <div class="panel bus c-abus" class:live={touched('ab')}>
            <div class="rail" aria-hidden="true">
              {#key sim.pulse}<span class="packet" class:go={touched('ab')}></span>{/key}
            </div>
            <Register label="Adressbus" abbr="ab" value={formatAddr(sim.s.ab)} tone="abus" active={hit('ab')} pulse={sim.pulse} size="l" hint="Der Adressbus legt fest, welche Speicherzelle gemeint ist." />
            <p class="bus-hint">Welche Zelle?</p>
            {#if feats.has('abInput')}
              <form
                class="bus-input"
                onsubmit={(e) => {
                  e.preventDefault();
                  const v = parseInt(abText, 10);
                  if (Number.isFinite(v)) {
                    sim.setAb(v);
                    abText = '';
                  }
                }}
              >
                <input class="input mono" bind:value={abText} inputmode="numeric" placeholder="000–999" aria-label="Adresse von Hand auf den Adressbus legen" />
                <button class="btn small" type="submit">anlegen</button>
              </form>
            {/if}
          </div>
        {/if}
        {#if parts.has('db')}
          <div class="panel bus c-dbus" class:live={touched('db')}>
            <div class="rail" aria-hidden="true">
              {#key sim.pulse}<span class="packet" class:go={touched('db')}></span>{/key}
            </div>
            <Register label="Datenbus" abbr="db" value={pad(sim.s.db, 5)} tone="dbus" active={hit('db')} pulse={sim.pulse} size="l" hint="Über den Datenbus wandern Zahlen zwischen Speicher und CPU." />
            <p class="bus-hint">Welcher Wert?</p>
            {#if feats.has('dbInput')}
              <form
                class="bus-input"
                onsubmit={(e) => {
                  e.preventDefault();
                  const v = parseInt(dbText.replace(/[.,]/g, ''), 10);
                  if (Number.isFinite(v)) {
                    sim.setDb(v);
                    dbText = '';
                  }
                }}
              >
                <input class="input mono" bind:value={dbText} inputmode="numeric" placeholder="0–19999" aria-label="Zahl von Hand auf den Datenbus legen" />
                <button class="btn small" type="submit">anlegen</button>
              </form>
            {/if}
          </div>
        {/if}
      </section>
    {/if}

    {#if hasCpu}
      <div class="cpu">
        {#if parts.has('acc')}
          <section class="panel c-alu" aria-label="Rechenwerk">
            <header>
              <h3><span class="swatch"></span>Rechenwerk <span class="abbr">ALU</span></h3>
            </header>
            <div class="acc-row">
              <Register label="Akkumulator" abbr="acc" value={pad(sim.s.acc, 5)} tone="alu" active={hit('acc')} pulse={sim.pulse} size="l" hint="Im Akkumulator steht das Zwischenergebnis des Rechenwerks." />
              <div class="zero" class:on={sim.s.acc === 0} title="Leuchtet, wenn der Akkumulator 0 ist">
                <span class="lamp"></span><span class="mono">=0?</span>
              </div>
            </div>
            {#if filt(accButtons).length}
              <div class="btn-grid">
                {#each filt(accButtons) as k (k)}<MicroButton {sim} {k} showNext={parts.has('mc')} />{/each}
              </div>
            {/if}
          </section>
        {/if}

        {#if parts.has('ins') || parts.has('pc') || parts.has('mc')}
            <section class="panel c-cu" aria-label="Steuerwerk">
              <header>
                <h3><span class="swatch"></span>Steuerwerk <span class="abbr">CU</span></h3>
                {#if parts.has('mc') && sim.controlUnit && nextMicro && !sim.running}
                  <span class="next-hint">als Nächstes: <b class="mono">{nextMicro.label}</b></span>
                {/if}
              </header>

              {#if parts.has('ins')}
                <div class="cu-block">
                  <div class="ins">
                    <span class="reg-label">Befehlsregister <span class="abbr">ins</span></span>
                    {#key sim.pulse}
                      <div class="ins-val" class:active={hit('ins')}>
                        <span class="part op" title="Opcode: welcher Befehl">
                          <small>Opcode</small>{pad(opcodeOf(sim.s.ins), 2)}
                        </span>
                        <span class="dot">.</span>
                        <span class="part adr" title="Adressteil: mit welcher Zelle">
                          <small>Adresse</small>{formatAddr(addrOf(sim.s.ins))}
                        </span>
                      </div>
                    {/key}
                    <span class="ins-cmd">{insCmd ? `${insCmd.mnemonic} ${formatAddr(insCmd.operand)}` : sim.s.ins === 0 ? 'kein Befehl' : '?'}</span>
                  </div>
                  {#if filt(insButtons).length}
                    <div class="btn-grid">
                      {#each filt(insButtons) as k (k)}<MicroButton {sim} {k} showNext={parts.has('mc')} />{/each}
                    </div>
                  {/if}
                </div>
              {/if}

              {#if parts.has('pc')}
                <div class="cu-block">
                  <Register label="Programmzähler" abbr="pc" value={formatAddr(sim.s.pc)} tone="cu" active={hit('pc')} pulse={sim.pulse} hint="Der Programmzähler enthält die Adresse des nächsten Befehls." />
                  {#if filt(pcButtons).length}
                    <div class="btn-grid">
                      {#each filt(pcButtons) as k (k)}<MicroButton {sim} {k} showNext={parts.has('mc')} />{/each}
                    </div>
                  {/if}
                </div>
              {/if}

              {#if parts.has('mc') && !sim.controlUnit}
                <div class="cu-block cu-off">
                  <b>Mikroprogramm ausgeblendet</b>
                  <span class="muted">Du bist jetzt selbst das Steuerwerk: Klicke die Mikrobefehle in der richtigen Reihenfolge an – auch das Holen des Befehls.</span>
                  <button class="btn small" type="button" onclick={() => (sim.controlUnit = true)}>Einblenden</button>
                </div>
              {/if}

              {#if parts.has('mc') && sim.controlUnit}
                <div class="cu-block">
                  <Register label="Mikroprogrammzähler" abbr="mc" value={formatAddr(sim.s.mc)} tone="cu" active={hit('mc')} pulse={sim.pulse} hint="Zeigt auf den nächsten Mikrobefehl im Mikrocode.">
                    <span class="mc-info">
                      {sim.s.names[mcSlot] || `Platz ${pad(mcSlot, 2)}`} · Schritt {sim.s.mc % 10}
                    </span>
                  </Register>
                  {#if filt(mcButtons).length}
                    <div class="btn-grid">
                      {#each filt(mcButtons) as k (k)}<MicroButton {sim} {k} showNext={parts.has('mc')} />{/each}
                    </div>
                  {/if}
                </div>
              {/if}

              {#if parts.has('microcode') && sim.controlUnit}
                <details class="mc-details" open>
                  <summary>Mikrocode <span class="muted">– die „Rezepte“ der Befehle</span></summary>
                  <MicrocodePanel {sim} record={feats.has('record')} />
                </details>
              {/if}
            </section>
        {/if}
      </div>
    {/if}
  </div>

  {#if parts.has('log')}
    <details class="panel log">
      <summary>Protokoll <span class="muted">– was ist gerade passiert? ({sim.log.length})</span></summary>
      <ol class="log-list" reversed>
        {#each [...sim.log].reverse() as entry (entry.id)}
          <li class="log-{entry.kind}">
            {#if entry.key}<code>{MICRO_BY_KEY[entry.key]?.label}</code>{/if}
            <span>{entry.text}</span>
          </li>
        {:else}
          <li class="log-info"><span class="muted">Noch nichts passiert.</span></li>
        {/each}
      </ol>
    </details>
  {/if}
</div>

<style>
  .johnny {
    display: flex;
    flex-direction: column;
    gap: 12px;
    font-size: 0.95rem;
  }
  .board {
    display: grid;
    gap: 12px;
    align-items: start;
  }
  .layout-full {
    grid-template-columns: minmax(300px, 1.1fr) minmax(160px, 0.45fr) minmax(330px, 1.25fr);
  }
  .layout-ram-bus {
    grid-template-columns: minmax(300px, 1.3fr) minmax(180px, 0.6fr);
  }
  .layout-ram-only {
    grid-template-columns: minmax(0, 620px);
  }
  .layout-cpu-only {
    grid-template-columns: minmax(0, 1fr);
  }
  .ram-panel {
    container-type: inline-size;
  }
  .panel {
    background: var(--surface);
    border: 1px solid var(--border);
    border-top: 3px solid var(--c, var(--border));
    border-radius: 14px;
    padding: 12px;
    box-shadow: var(--shadow-s);
    min-width: 0;
  }
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 10px;
  }
  h3 {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: 0.98rem;
    letter-spacing: -0.01em;
  }
  .swatch {
    width: 10px;
    height: 10px;
    border-radius: 3px;
    background: var(--c);
  }
  .abbr {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    color: var(--c);
    background: var(--c-soft);
    border-radius: 6px;
    padding: 0 6px;
  }
  .tiny {
    font-size: 0.75rem;
  }
  .btn-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 6px;
    margin-top: 10px;
  }
  .btn-grid.two {
    grid-template-columns: 1fr 1fr;
  }

  /* Busse */
  .buses {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .bus {
    position: relative;
    overflow: hidden;
  }
  .rail {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 5px;
    background: var(--c-soft);
  }
  .packet {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 30%;
    background: var(--c);
    border-radius: 4px;
    opacity: 0;
  }
  .packet.go {
    animation: travel 0.9s ease-in-out;
  }
  @keyframes travel {
    0% { left: -30%; opacity: 1; }
    100% { left: 100%; opacity: 1; }
  }
  .bus-hint {
    margin: 6px 0 0;
    font-size: 0.75rem;
    color: var(--text-3);
  }
  .bus-input {
    display: flex;
    gap: 6px;
    margin-top: 8px;
  }
  .bus-input .input {
    min-height: 34px;
    padding: 2px 8px;
    min-width: 0;
  }

  /* Rechenwerk */
  .acc-row {
    display: flex;
    align-items: flex-end;
    gap: 14px;
    flex-wrap: wrap;
  }
  .zero {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border-radius: 10px;
    border: 1px solid var(--border);
    color: var(--text-3);
    font-size: 0.85rem;
    margin-bottom: 4px;
  }
  .lamp {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--surface-3);
    border: 1px solid var(--border-strong);
  }
  .zero.on {
    color: var(--text);
    border-color: color-mix(in srgb, var(--ok) 50%, var(--border));
  }
  .zero.on .lamp {
    background: var(--ok);
    border-color: var(--ok);
    box-shadow: 0 0 10px color-mix(in srgb, var(--ok) 60%, transparent);
  }

  /* Steuerwerk */
  .cpu {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-width: 0;
  }
  .cu-block {
    padding: 10px 0;
    border-top: 1px dashed var(--border);
  }
  .cu-block:first-of-type {
    border-top: 0;
    padding-top: 0;
  }
  .next-hint {
    font-size: 0.75rem;
    color: var(--text-3);
    white-space: nowrap;
  }
  .next-hint b {
    color: var(--cu);
  }
  .ins {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 4px 12px;
  }
  .reg-label {
    width: 100%;
    font-size: 0.78rem;
    font-weight: 650;
    color: var(--text-2);
    display: flex;
    justify-content: space-between;
  }
  .ins-val {
    display: flex;
    align-items: flex-end;
    gap: 2px;
    font-family: var(--font-mono);
    font-weight: 700;
    font-size: 1.25rem;
    border-radius: 10px;
  }
  .ins-val.active .part {
    animation: pulse 1s ease-out;
  }
  .part {
    display: flex;
    flex-direction: column;
    align-items: center;
    background: var(--surface-2);
    border: 1.5px solid color-mix(in srgb, var(--cu) 45%, var(--border));
    border-radius: 10px;
    padding: 0 10px 3px;
    line-height: 1.25;
  }
  .part small {
    font-family: var(--font-sans);
    font-size: 0.58rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-3);
  }
  .part.op {
    border-color: color-mix(in srgb, var(--cu) 70%, var(--border));
  }
  .part.adr {
    border-color: color-mix(in srgb, var(--abus) 60%, var(--border));
  }
  .dot {
    padding-bottom: 4px;
    color: var(--text-3);
  }
  .ins-cmd {
    font-family: var(--font-mono);
    font-weight: 700;
    color: var(--mem);
    padding-bottom: 6px;
  }
  @keyframes pulse {
    0% {
      background: color-mix(in srgb, var(--cu) 35%, var(--surface));
      box-shadow: 0 0 0 5px color-mix(in srgb, var(--cu) 20%, transparent);
    }
    100% {
      background: var(--surface-2);
    }
  }
  .mc-info {
    font-size: 0.8rem;
    color: var(--text-2);
    font-weight: 600;
  }
  .mc-details {
    border-top: 1px dashed var(--border);
    padding-top: 10px;
  }
  .mc-details summary,
  .log summary {
    cursor: pointer;
    font-weight: 650;
    font-size: 0.9rem;
    margin-bottom: 8px;
  }
  .cu-off {
    display: flex;
    flex-direction: column;
    gap: 6px;
    align-items: flex-start;
  }

  /* Meldungen */
  .stop {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 8px 8px 14px;
    border-radius: 12px;
    border: 1px solid var(--border);
    font-weight: 550;
  }
  .stop > span:nth-child(2) {
    flex: 1;
  }
  .stop-icon {
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    font-size: 0.8rem;
    font-weight: 800;
    color: var(--surface);
  }
  .stop-halt {
    background: var(--ok-soft);
    border-color: color-mix(in srgb, var(--ok) 35%, transparent);
  }
  .stop-halt .stop-icon {
    background: var(--ok);
  }
  .stop-stuck,
  .stop-limit {
    background: var(--warn-soft);
    border-color: color-mix(in srgb, var(--warn) 35%, transparent);
  }
  .stop-stuck .stop-icon,
  .stop-limit .stop-icon {
    background: var(--warn);
  }
  .stop-error {
    background: var(--err-soft);
    border-color: color-mix(in srgb, var(--err) 35%, transparent);
  }
  .stop-error .stop-icon {
    background: var(--err);
  }

  /* Protokoll */
  .log {
    border-top-width: 1px;
  }
  .log summary {
    margin: 0;
  }
  .log-list {
    list-style: none;
    margin: 10px 0 0;
    padding: 0;
    max-height: 240px;
    overflow-y: auto;
    font-size: 0.85rem;
  }
  .log-list li {
    display: flex;
    gap: 10px;
    padding: 4px 6px;
    border-bottom: 1px solid var(--border);
  }
  .log-list code {
    min-width: 76px;
  }
  .log-macro {
    font-weight: 650;
    background: var(--mem-soft);
  }
  .log-stop {
    background: var(--warn-soft);
  }
  .log-error {
    background: var(--err-soft);
  }

  /* Johnny passt sich an den Platz an, den er bekommt – nicht an die Fensterbreite */
  .johnny {
    container-type: inline-size;
    container-name: johnny;
  }
  @container johnny (max-width: 1120px) {
    .layout-full {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    }
    .layout-full .ram-panel {
      grid-row: span 2;
    }
    .layout-full .buses {
      flex-direction: row;
    }
    .layout-full .buses .bus {
      flex: 1;
      min-width: 0;
    }
  }
  @container johnny (max-width: 720px) {
    .board,
    .layout-full,
    .layout-ram-bus {
      grid-template-columns: minmax(0, 1fr);
    }
    .layout-full .ram-panel {
      grid-row: auto;
    }
    .buses {
      flex-direction: row;
    }
    .buses .bus {
      flex: 1;
      min-width: 0;
    }
  }
</style>
