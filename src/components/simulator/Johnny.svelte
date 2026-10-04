<script lang="ts">
  import { onDestroy, onMount, tick, untrack } from 'svelte';
  import { ALL_FEATURES, ALL_PARTS, type Example, type Feature, type Part, type Sim } from '../../lib/johnny/sim.svelte';
  import { MICRO_BY_CODE, MICRO_BY_KEY } from '../../lib/johnny/microcode';
  import { disassembleValue, formatAddr, pad } from '../../lib/johnny/assembler';
  import { addrOf, opcodeOf, type MicroEvent, type Register } from '../../lib/johnny/engine';
  import { WIRE_OF, effectLabel, tokenLabel, type WireId } from '../../lib/johnny/flow';
  import { FlowPlayer } from '../../lib/johnny/flow.svelte';
  import MicroButton from './MicroButton.svelte';
  import RamTable from './RamTable.svelte';
  import RamEditor from './RamEditor.svelte';
  import MicrocodePanel from './MicrocodePanel.svelte';
  import Toolbar from './Toolbar.svelte';
  import Wire from './Wire.svelte';
  import Bus from './Bus.svelte';

  interface Props {
    sim: Sim;
    show?: Part[];
    micro?: 'alle' | string[];
    features?: Feature[];
    labels?: Record<string, string>;
    examples?: Example[];
    share?: boolean;
    ramHeight?: number;
    /** Bauteile oder Leitungen, auf die eine Tutorial-Mission gerade zeigt */
    focus?: string[];
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
    focus = [],
  }: Props = $props();

  const parts = $derived(new Set(show));
  const feats = $derived(new Set(features));
  const focused = $derived(new Set(focus));
  const allowed = (k: string) => micro === 'alle' || micro.includes(k);
  const filt = (list: string[]) => list.filter(allowed);

  // ------------------------------------------------------------------ Datenfluss

  const player = new FlowPlayer(untrack(() => sim));
  let reduceMotion = false;
  let lastPulse = untrack(() => sim.pulse);

  onMount(() => {
    reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  });
  onDestroy(() => player.destroy());

  $effect(() => {
    const p = sim.pulse;
    untrack(() => {
      if (p === lastPulse) return;
      lastPulse = p;
      const turbo = sim.running && sim.turbo;
      player.play(sim.events, { animate: !reduceMotion && !turbo, quiet: turbo, runSpeed: sim.running ? sim.speed : undefined });
    });
  });
  $effect(() => {
    void sim.version;
    untrack(() => player.check());
  });

  /** Angezeigter Zustand – während der Wiedergabe ein Zwischenstand */
  const v = $derived(player.view);
  const active = $derived(player.active);

  function token(w: WireId) {
    const e = active;
    if (!e || WIRE_OF[e.key] !== w) return null;
    return { label: tokenLabel(e, v), dur: player.dur, key: player.seq };
  }
  const flash = (w: WireId) => (!player.animated && player.arrived.some((e) => WIRE_OF[e.key] === w) ? player.arrival : 0);
  const hit = (r: Register) => (player.arrived.some((e) => e.target === r) ? player.arrival : 0);
  const sending = (r: Register) => active?.source === r || (r === 'ram' && active?.key === 'ram->db');
  function fx(r: Register): string {
    const e: MicroEvent | undefined = player.arrived.findLast((x) => x.target === r);
    return e ? effectLabel(e) : '';
  }
  function firing(k: string) {
    if (active?.key === k) return player.seq;
    if (!player.animated && player.arrived.some((e) => e.key === k)) return player.arrival;
    return 0;
  }

  // Was als Nächstes passiert (nur wenn nichts läuft)
  const nextKey = $derived(
    parts.has('mc') && sim.controlUnit && !sim.running && !player.playing ? MICRO_BY_CODE[sim.s.microcode[sim.s.mc]]?.key : undefined,
  );
  const nextWire = $derived(nextKey ? WIRE_OF[nextKey] : null);

  const ramRead = $derived(
    active?.key === 'ram->db' ? active.addr : !player.animated ? player.arrived.findLast((e) => e.key === 'ram->db')?.addr : undefined,
  );
  const ramWrite = $derived(player.arrived.findLast((e) => e.key === 'db->ram')?.addr);

  // Mikroprogramm: Rezept des Befehls, auf den der Mikroprogrammzähler zeigt
  const mcSlot = $derived(Math.floor(v.mc / 10));
  const recipe = $derived.by(() => {
    const ops = v.microcode.slice(mcSlot * 10, mcSlot * 10 + 10);
    let last = ops.length - 1;
    while (last >= 0 && ops[last] === 0) last--;
    return ops.slice(0, last + 1).map((code, i) => ({ addr: mcSlot * 10 + i, info: MICRO_BY_CODE[code] }));
  });
  const insCmd = $derived(disassembleValue(v.ins, v.names));

  // ------------------------------------------------------------------ Aufbau des Schaltbilds

  const hasRam = $derived(parts.has('ram'));
  const hasAb = $derived(parts.has('ab'));
  const hasDb = $derived(parts.has('db'));
  const hasAcc = $derived(parts.has('acc'));
  const hasIns = $derived(parts.has('ins'));
  const hasPc = $derived(hasIns && parts.has('pc'));
  const hasMc = $derived(hasIns && parts.has('mc'));
  const hasCpu = $derived(hasAcc || hasIns);
  const schematic = $derived(hasRam && (hasAb || hasDb || hasCpu));

  type Col = 'ram' | 'gap' | 'lane' | 'op' | 'adr' | 'jmp' | 'pc' | 'flag' | 'alu' | 'end';
  type Row = 'abus' | 'up' | 'r3' | 'r4' | 'r5' | 'fill' | 'r6' | 'dbus' | 'a1';

  function colsFor(aluBelow: boolean): [Col, string][] {
    const c: [Col, string][] = [['ram', 'minmax(236px, 1.8fr)']];
    if (hasCpu) c.push(['gap', '22px']);
    if (hasIns) c.push(['lane', 'minmax(46px, auto)'], ['op', 'minmax(62px, 0.45fr)'], ['adr', 'minmax(80px, 0.55fr)']);
    if (hasPc) c.push(['jmp', 'minmax(58px, 0.45fr)'], ['pc', 'minmax(124px, 0.65fr)']);
    if (hasAcc && !aluBelow) {
      if (hasIns) c.push(['flag', 'minmax(30px, 0.35fr)']);
      c.push(['alu', 'minmax(148px, 1fr)']);
    }
    if (hasCpu) c.push(['end', '16px']);
    return c;
  }
  const minPx = (c: [Col, string][]) => c.reduce((sum, [n, s]) => sum + (n === 'ram' ? 270 : Number(/(\d+)px/.exec(s)?.[1] ?? 0)), 0);

  /** Breite des Simulators – ist sie zu klein, rückt das Rechenwerk unter den Datenbus */
  let width = $state(0);
  let scrollerW = $state(0);
  let scroller: HTMLDivElement | undefined = $state();
  let overflow = $state(false);
  $effect(() => {
    void cols;
    const w = scrollerW;
    tick().then(() => (overflow = w > 0 && !!scroller && scroller.scrollWidth > w + 4));
  });
  const aluBelow = $derived(hasAcc && hasIns && hasDb && width > 0 && width < minPx(colsFor(false)));

  const cols = $derived(colsFor(aluBelow));
  const rows = $derived.by(() => {
    const r: [Row, string][] = [];
    if (hasAb) r.push(['abus', 'auto'], ['up', 'minmax(84px, auto)']);
    r.push(['r3', 'auto'], ['r4', 'auto'], ['r5', 'auto'], ['fill', '1fr']);
    if (hasDb) r.push(['r6', 'minmax(96px, auto)'], ['dbus', 'auto']);
    if (aluBelow) r.push(['a1', 'auto']);
    return r;
  });
  const gridStyle = $derived(
    `grid-template-columns:${cols.map(([, s]) => s).join(' ')};grid-template-rows:${rows.map(([, s]) => s).join(' ')}`,
  );
  const ci = (c: Col) => cols.findIndex(([n]) => n === c) + 1;
  const ri = (r: Row) => rows.findIndex(([n]) => n === r) + 1;
  function at(c1: Col, c2: Col, r1: Row, r2: Row = r1) {
    return `grid-column:${ci(c1)}/${ci(c2) + 1};grid-row:${ri(r1)}/${ri(r2) + 1}`;
  }
  const cuEnd = $derived<Col>(hasPc ? 'pc' : 'adr');
  const lastCol = $derived<Col>(hasCpu ? 'end' : 'ram');
  const top = $derived<Row>(hasAb ? 'up' : 'r3');
  const bottom = $derived<Row>(hasDb ? 'r6' : 'fill');

  // Knöpfe
  const accOps = ['acc:=0', 'acc++', 'acc--'];
  const pcOps = ['pc++', '=0:pc++'];
  const mcOps = ['mc:=0', 'stopp'];

  const showToolbar = $derived(
    ['microStep', 'macroStep', 'run', 'reset', 'clearRam', 'files', 'controlToggle', 'bonsai'].some((f) => feats.has(f as Feature)) ||
      examples.length > 0,
  );
</script>

{#snippet mb(k: string)}
  {#if allowed(k)}<MicroButton {sim} {k} next={nextKey === k} firing={firing(k)} />{/if}
{/snippet}

{#snippet fxBadge(r: Register)}
  {#key player.arrival}
    {#if fx(r)}<span class="fx" aria-hidden="true">{fx(r)}</span>{/if}
  {/key}
{/snippet}

{#snippet accCard(style: string)}
  <div class="reg acc c-alu" class:focus={focused.has('acc')} class:sending={sending('acc')} {style} title="Im Akkumulator steht das Zwischenergebnis des Rechenwerks.">
    <span class="tag">acc</span>
    <span class="reg-head">Akkumulator</span>
    {#key hit('acc')}
      <span class="val big" class:pulse={hit('acc') > 0}>{pad(v.acc, 5)}</span>
    {/key}
    <span class="zero" class:on={v.acc === 0} title="Leuchtet, wenn der Akkumulator 0 ist"><span class="lamp"></span><span class="mono">=0?</span></span>
    {@render fxBadge('acc')}
  </div>
{/snippet}

{#snippet aluWires(inDir: 'up' | 'down')}
  <Wire dir={inDir} tone="dbus" token={token('db->acc')} flash={flash('db->acc')} next={nextWire === 'db->acc'} focus={focused.has('db->acc')} hint="Datenbus → Rechenwerk: übernehmen, addieren oder subtrahieren">
    {@render mb('db->acc')}
    {@render mb('plus')}
    {@render mb('minus')}
  </Wire>
  <Wire dir={inDir === 'up' ? 'down' : 'up'} tone="dbus" token={token('acc->db')} flash={flash('acc->db')} next={nextWire === 'acc->db'} focus={focused.has('acc->db')} hint="Akkumulator → Datenbus">
    {@render mb('acc->db')}
  </Wire>
{/snippet}

{#snippet ramPanel()}
  <section class="panel ram-panel c-mem" class:focus={focused.has('ram')} class:sending={sending('ram')} aria-label="Speicher">
    <header>
      <h3><span class="swatch"></span>Speicher <span class="abbr">RAM</span></h3>
      <span class="muted tiny">1000 Zellen · 000–999</span>
    </header>
    <RamTable
      {sim}
      view={v}
      {labels}
      height={ramHeight}
      showPc={hasPc}
      showAb={hasAb}
      selectable={feats.has('ramEdit')}
      read={ramRead}
      write={ramWrite}
      hitKey={player.seq + player.arrival}
    />
    {#if feats.has('ramEdit')}
      <RamEditor {sim} asm={feats.has('asm')} />
    {/if}
  </section>
{/snippet}

<div class="johnny" class:running={sim.running} bind:clientWidth={width}>
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

  {#if !schematic}
    {#if hasRam}<div class="solo">{@render ramPanel()}</div>{/if}
  {:else}
    {#if overflow}
      <p class="scroll-hint" aria-hidden="true">↔ Das Schaltbild ist breiter als der Bildschirm – seitlich wischen.</p>
    {/if}
    <div class="scroller" bind:clientWidth={scrollerW} bind:this={scroller}>
      <div class="board" class:cpu={hasCpu} style={gridStyle}>
        <!-- Hintergründe: Prozessor mit Steuerwerk und Rechenwerk -->
        {#if hasCpu && !aluBelow}
          <div class="frame" style={at(hasIns ? 'lane' : 'alu', hasAcc ? 'alu' : cuEnd, top, bottom)} aria-hidden="true">
            <span class="legend">Prozessor <span class="abbr">CPU</span></span>
          </div>
        {/if}
        {#if hasIns}
          <div class="region c-cu" class:focus={focused.has('cu')} style={at('lane', cuEnd, top, bottom)}>
            <span class="region-name">Steuerwerk <span class="abbr">CU</span></span>
          </div>
        {/if}
        {#if hasAcc}
          <div class="region c-alu" class:below={aluBelow} class:focus={focused.has('alu')} style={aluBelow ? at('lane', cuEnd, 'a1') : at('alu', 'alu', top, bottom)}>
            <span class="region-name">Rechenwerk <span class="abbr">ALU</span></span>
          </div>
        {/if}

        <!-- Busse -->
        {#if hasAb}
          <Bus
            kind="ab"
            value={formatAddr(v.ab)}
            hit={hit('ab')}
            focus={focused.has('ab')}
            input={feats.has('abInput')}
            onset={(x) => sim.setAb(x)}
            style="{at('ram', hasIns ? cuEnd : 'ram', 'abus')};{hasIns ? 'margin-right:-10px' : ''}"
          />
          <Wire
            dir="down"
            tone="abus"
            caption="wählt die Zelle {formatAddr(v.ab)}"
            hint="Die Adresse auf dem Adressbus wählt eine Speicherzelle aus – immer, ohne eigenen Mikrobefehl."
            focus={focused.has('ab->ram')}
            flash={hit('ab')}
            style={at('ram', 'ram', 'up')}
          />
        {/if}
        {#if hasDb}
          <Bus
            kind="db"
            value={pad(v.db, 5)}
            hit={hit('db')}
            focus={focused.has('db')}
            input={feats.has('dbInput')}
            onset={(x) => sim.setDb(x)}
            style={at('ram', lastCol, 'dbus')}
          />
        {/if}

        <!-- Speicher -->
        <div class="cell" style={at('ram', 'ram', 'r3', 'fill')}>
          {@render ramPanel()}
        </div>
        {#if hasDb}
          <div class="pair" style={at('ram', 'ram', 'r6')}>
            <Wire dir="up" tone="dbus" token={token('db->ram')} flash={flash('db->ram')} next={nextWire === 'db->ram'} focus={focused.has('db->ram')} hint="Schreiben: Datenbus → Speicher">
              {@render mb('db->ram')}
            </Wire>
            <Wire dir="down" tone="dbus" token={token('ram->db')} flash={flash('ram->db')} next={nextWire === 'ram->db'} focus={focused.has('ram->db')} hint="Lesen: Speicher → Datenbus">
              {@render mb('ram->db')}
            </Wire>
          </div>
        {/if}

        <!-- Steuerwerk -->
        {#if hasIns}
          {#if hasDb}
            <Wire
              dir="elbow"
              tone="dbus"
              token={token('db->ins')}
              flash={flash('db->ins')}
              next={nextWire === 'db->ins'}
              focus={focused.has('db->ins')}
              hint="Datenbus → Befehlsregister"
              style="{at('lane', 'lane', 'r3', 'r6')};--y:calc(var(--reg-h) / 2)"
            >
              {@render mb('db->ins')}
            </Wire>
          {/if}
          {#if hasAb}
            <Wire dir="up" tone="abus" token={token('ins->ab')} flash={flash('ins->ab')} next={nextWire === 'ins->ab'} focus={focused.has('ins->ab')} hint="Adressteil des Befehls → Adressbus" style={at('adr', 'adr', 'up')}>
              {@render mb('ins->ab')}
            </Wire>
          {/if}
          <div class="reg ins c-cu" class:focus={focused.has('ins')} class:sending={sending('ins')} style={at('op', 'adr', 'r3')} title="Das Befehlsregister enthält den Befehl, der gerade ausgeführt wird – zerlegt in Opcode und Adresse.">
            <span class="tag">ins</span>
            <span class="reg-head">Befehlsregister</span>
            {#key hit('ins')}
              <span class="part op" class:pulse={hit('ins') > 0}><small>Opcode</small>{pad(opcodeOf(v.ins), 2)}</span>
              <span class="part adr" class:pulse={hit('ins') > 0}><small>Adresse</small>{formatAddr(addrOf(v.ins))}</span>
            {/key}
            <span class="cmd">{insCmd ? `${insCmd.mnemonic} ${formatAddr(insCmd.operand)}` : v.ins === 0 ? 'kein Befehl' : '?'}</span>
          </div>
          {#if hasMc}
            <Wire dir="down" tone="cu" token={token('ins->mc')} flash={flash('ins->mc')} next={nextWire === 'ins->mc'} focus={focused.has('ins->mc')} hint="Opcode × 10 → Mikroprogrammzähler" style={at('op', 'op', 'r4')}>
              {@render mb('ins->mc')}
            </Wire>
            <div class="reg mc c-cu" class:focus={focused.has('mc') || focused.has('microcode')} style={at('op', cuEnd, 'r5')}>
              {#if sim.controlUnit}
                <span class="tag">mc</span>
                <span class="reg-head">Mikroprogrammzähler</span>
                <div class="mc-row">
                  {#key hit('mc')}
                    <span class="val" class:pulse={hit('mc') > 0}>{formatAddr(v.mc)}</span>
                  {/key}
                  <span class="mc-info">{v.names[mcSlot] || `Platz ${pad(mcSlot, 2)}`} · Schritt {v.mc % 10}</span>
                  {@render fxBadge('mc')}
                </div>
                {#if parts.has('microcode') && recipe.length}
                  <ol class="recipe" aria-label="Mikroprogramm des aktuellen Befehls">
                    {#each recipe as r (r.addr)}
                      <li class:now={r.addr === v.mc}>
                        <span class="ra">{formatAddr(r.addr)}</span>
                        <span class="rk">{r.info?.label ?? '—'}</span>
                        {#if r.addr === v.mc}<span class="here">◂ mc</span>{/if}
                      </li>
                    {/each}
                  </ol>
                {/if}
                {#if filt(mcOps).length}
                  <div class="ops-row">{#each filt(mcOps) as k (k)}{@render mb(k)}{/each}</div>
                {/if}
                {#if nextKey}
                  <span class="next-hint">als Nächstes: <b class="mono">{MICRO_BY_KEY[nextKey]?.label}</b></span>
                {/if}
              {:else}
                <div class="cu-off">
                  <b>Mikroprogramm ausgeblendet</b>
                  <span class="muted">Du bist jetzt selbst das Steuerwerk: Klicke die Mikrobefehle in der richtigen Reihenfolge an – auch das Holen des Befehls.</span>
                  <button class="btn small" type="button" onclick={() => (sim.controlUnit = true)}>Einblenden</button>
                </div>
              {/if}
            </div>
          {/if}

          {#if hasPc}
            <Wire dir="right" tone="cu" token={token('ins->pc')} flash={flash('ins->pc')} next={nextWire === 'ins->pc'} focus={focused.has('ins->pc')} hint="Adressteil → Programmzähler (Sprung)" style="{at('jmp', 'jmp', 'r3')};height:var(--reg-h)">
              {@render mb('ins->pc')}
            </Wire>
            {#if hasAb}
              <Wire dir="up" tone="abus" token={token('pc->ab')} flash={flash('pc->ab')} next={nextWire === 'pc->ab'} focus={focused.has('pc->ab')} hint="Programmzähler → Adressbus" style={at('pc', 'pc', 'up')}>
                {@render mb('pc->ab')}
              </Wire>
            {/if}
            <div class="reg pc c-cu" class:focus={focused.has('pc')} class:sending={sending('pc')} style={at('pc', 'pc', 'r3')} title="Der Programmzähler enthält die Adresse des nächsten Befehls.">
              <span class="tag">pc</span>
              <span class="reg-head">Programmzähler</span>
              {#key hit('pc')}
                <span class="val" class:pulse={hit('pc') > 0}>{formatAddr(v.pc)}</span>
              {/key}
              {@render fxBadge('pc')}
            </div>
            {#if filt(pcOps).length}
              <div class="ops-col" style={at('pc', 'pc', 'r4')}>{#each filt(pcOps) as k (k)}{@render mb(k)}{/each}</div>
            {/if}
            {#if hasAcc && !aluBelow}
              <Wire dir="left" tone="sig" token={token('flag')} flash={flash('flag')} next={nextWire === 'flag'} focus={focused.has('flag')} hint="Signal „Akku ist 0“ für =0:pc++" style="{at('flag', 'flag', 'r4')};align-self:end;height:38px;margin-left:-10px" />
            {/if}
          {/if}
        {/if}

        <!-- Rechenwerk -->
        {#if hasAcc && !aluBelow}
          {#if filt(accOps).length}
            <div class="ops-row alu-ops" style={at('alu', 'alu', 'r3')}>{#each filt(accOps) as k (k)}{@render mb(k)}{/each}</div>
          {/if}
          {@render accCard(at('alu', 'alu', 'r4'))}
          {#if hasDb}
            <div class="pair alu-pair" style={at('alu', 'alu', 'r5', 'r6')}>{@render aluWires('up')}</div>
          {/if}
        {:else if hasAcc}
          <div class="alu-below" style={at('lane', cuEnd, 'a1')}>
            <div class="pair alu-pair">{@render aluWires('down')}</div>
            <div class="alu-body">
              {@render accCard('')}
              {#if filt(accOps).length}
                <div class="ops-row">{#each filt(accOps) as k (k)}{@render mb(k)}{/each}</div>
              {/if}
            </div>
          </div>
        {/if}
      </div>
    </div>
  {/if}

  {#if hasMc && parts.has('microcode') && sim.controlUnit}
    <details class="panel mc-panel c-cu" open>
      <summary>Mikrocode <span class="muted">– die „Rezepte“ aller Befehle</span></summary>
      <MicrocodePanel {sim} record={feats.has('record')} />
    </details>
  {/if}

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
    --reg-h: 86px;
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
    font-weight: 700;
    color: var(--c);
    background: var(--c-soft);
    border-radius: 6px;
    padding: 0 6px;
  }
  .tiny {
    font-size: 0.75rem;
  }
  .solo {
    max-width: 640px;
  }

  /* ---------------------------------------------------------------- Schaltbild */
  .scroll-hint {
    margin: 0;
    font-size: 0.78rem;
    color: var(--text-3);
  }
  .scroller {
    overflow-x: auto;
    overscroll-behavior-x: contain;
    padding: 2px 2px 6px;
  }
  .board {
    display: grid;
    min-width: 0;
    position: relative;
  }
  .board:not(.cpu) {
    max-width: 680px;
  }
  .board > * {
    min-width: 0;
  }
  .cell {
    display: flex;
    flex-direction: column;
  }
  .ram-panel {
    display: flex;
    flex-direction: column;
    flex: 1;
    container-type: inline-size;
    transition: box-shadow 0.2s;
  }
  @container (max-width: 300px) {
    .ram-panel header .tiny {
      display: none;
    }
  }
  .pair {
    display: flex;
    justify-content: space-evenly;
    align-items: stretch;
    gap: 12px;
  }
  .pair > :global(*) {
    flex: 1;
    max-width: 150px;
  }

  .frame {
    position: relative;
    margin: 8px -14px 6px;
    border: 1.5px dashed var(--border-strong);
    border-radius: 20px;
    pointer-events: none;
  }
  .legend {
    position: absolute;
    top: -0.75em;
    right: 18px;
    padding: 0 8px;
    background: var(--bg);
    font-size: 0.72rem;
    font-weight: 750;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-3);
    display: flex;
    align-items: center;
    gap: 6px;
    --c: var(--text-3);
    --c-soft: var(--surface-2);
  }
  .region {
    margin: 22px -10px 16px;
    border-radius: 16px;
    background: color-mix(in srgb, var(--c) 6%, var(--surface));
    border: 1px solid color-mix(in srgb, var(--c) 22%, var(--border));
    position: relative;
  }
  .region-name {
    position: absolute;
    top: 8px;
    left: 12px;
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.72rem;
    font-weight: 750;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: color-mix(in srgb, var(--c) 70%, var(--text-2));
    white-space: nowrap;
  }

  /* Register-Karten */
  .reg {
    position: relative;
    z-index: 3;
    align-self: start;
    background: var(--surface);
    border: 1.5px solid color-mix(in srgb, var(--c) 45%, var(--border));
    border-radius: 12px;
    padding: 7px 10px 8px;
    box-shadow: var(--shadow-s);
    transition: box-shadow 0.2s;
  }
  .reg-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 6px;
    font-size: 0.72rem;
    font-weight: 650;
    color: var(--text-2);
    white-space: nowrap;
    min-width: 0;
  }
  .reg .reg-head {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .tag {
    position: absolute;
    top: -9px;
    right: 10px;
    padding: 0 6px;
    border-radius: 6px;
    font-family: var(--font-mono);
    font-size: 0.68rem;
    font-weight: 750;
    line-height: 1.45;
    color: var(--c);
    background: var(--c-soft);
    border: 1px solid color-mix(in srgb, var(--c) 40%, var(--border));
  }
  .mc-row .val {
    margin-top: 0;
  }
  .val {
    display: inline-block;
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
    font-weight: 750;
    font-size: 1.3rem;
    line-height: 1.3;
    padding: 1px 10px;
    margin-top: 4px;
    border-radius: 9px;
    background: var(--surface-2);
    border: 1.5px solid color-mix(in srgb, var(--c) 40%, var(--border));
  }
  .val.big {
    font-size: 1.55rem;
  }
  .pulse {
    animation: pulse 0.9s ease-out;
  }
  @keyframes pulse {
    0% {
      background: color-mix(in srgb, var(--c) 40%, var(--surface));
      box-shadow: 0 0 0 5px color-mix(in srgb, var(--c) 25%, transparent);
    }
  }
  .sending {
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--dbus) 35%, transparent), var(--shadow-s);
  }
  .reg.sending {
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--c) 35%, transparent), var(--shadow-s);
  }
  .focus:not(.region) {
    animation: spot 1.6s ease-in-out infinite;
  }
  .region.focus {
    border-color: var(--accent);
    animation: spot 1.6s ease-in-out infinite;
  }
  @keyframes spot {
    50% {
      box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 45%, transparent);
    }
  }
  .fx {
    position: absolute;
    right: 8px;
    top: -10px;
    z-index: 5;
    padding: 1px 8px;
    border-radius: 999px;
    background: var(--c);
    color: var(--surface);
    font-family: var(--font-mono);
    font-size: 0.78rem;
    font-weight: 750;
    pointer-events: none;
    animation: rise 1.1s ease-out forwards;
  }
  @keyframes rise {
    0% {
      opacity: 0;
      transform: translateY(6px) scale(0.9);
    }
    15% {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
    75% {
      opacity: 1;
    }
    100% {
      opacity: 0;
      transform: translateY(-8px);
    }
  }

  /* Befehlsregister: Opcode und Adresse liegen genau über/unter ihren Leitungen */
  .ins {
    display: grid;
    grid-template-columns: subgrid;
    grid-template-rows: auto 1fr auto;
    height: var(--reg-h);
    column-gap: 0;
    align-items: center;
  }
  .ins .reg-head {
    grid-column: 1 / -1;
  }
  .part {
    justify-self: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
    font-weight: 750;
    font-size: 1.15rem;
    line-height: 1.2;
    padding: 0 8px 2px;
    border-radius: 8px;
    background: var(--surface-2);
    border: 1.5px solid color-mix(in srgb, var(--cu) 60%, var(--border));
  }
  .part.adr {
    border-color: color-mix(in srgb, var(--abus) 60%, var(--border));
  }
  .part small {
    font-family: var(--font-sans);
    font-size: 0.55rem;
    font-weight: 750;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-3);
  }
  .cmd {
    grid-column: 1 / -1;
    text-align: center;
    font-family: var(--font-mono);
    font-size: 0.8rem;
    font-weight: 700;
    color: var(--mem);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .pc {
    height: var(--reg-h);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: flex-start;
    margin-right: 10px;
  }
  .ops-col {
    position: relative;
    z-index: 3;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    justify-content: flex-end;
    gap: 6px;
    padding: 12px 10px 4px 0;
  }
  .ops-row {
    position: relative;
    z-index: 3;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .alu-ops {
    align-self: end;
    padding: 34px 0 10px;
  }

  /* Mikroprogrammzähler mit dem Rezept des aktuellen Befehls */
  .mc {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-right: 10px;
  }
  .mc .tag {
    right: auto;
    left: 10px;
  }
  .mc-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .mc-row .val {
    margin-top: 0;
  }
  .mc-info {
    font-size: 0.78rem;
    font-weight: 650;
    color: var(--text-2);
  }
  .recipe {
    list-style: none;
    margin: 0;
    padding: 4px;
    border-radius: 9px;
    background: var(--surface-2);
    border: 1px solid var(--border);
    font-family: var(--font-mono);
    font-size: 0.78rem;
  }
  .recipe li {
    display: flex;
    gap: 8px;
    align-items: center;
    padding: 1px 6px;
    border-radius: 6px;
  }
  .recipe .ra {
    color: var(--text-3);
    font-size: 0.7rem;
  }
  .recipe .rk {
    font-weight: 650;
  }
  .recipe li.now {
    background: var(--cu);
    color: var(--surface);
  }
  .recipe li.now .ra {
    color: inherit;
    opacity: 0.8;
  }
  .here {
    margin-left: auto;
    font-size: 0.68rem;
    font-weight: 750;
  }
  .next-hint {
    font-size: 0.74rem;
    color: var(--text-3);
  }
  .next-hint b {
    color: var(--cu);
  }
  .cu-off {
    display: flex;
    flex-direction: column;
    gap: 6px;
    align-items: flex-start;
    font-size: 0.85rem;
  }

  /* Rechenwerk */
  .acc {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    align-self: end;
    margin-right: 10px;
  }
  .alu-below {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding-bottom: 26px;
  }
  .alu-below .alu-pair {
    width: min(240px, 100%);
  }
  .alu-below .alu-pair > :global(*) {
    max-width: none;
  }
  .alu-body {
    position: relative;
    z-index: 3;
    display: flex;
    align-items: flex-end;
    gap: 14px;
    flex-wrap: wrap;
    justify-content: center;
  }
  .alu-body .acc {
    margin: 0;
    width: min(240px, 100%);
  }
  .alu-body {
    width: 100%;
  }
  .alu-body .ops-row {
    position: absolute;
    left: calc(50% + 132px);
    bottom: 0;
    flex-direction: column;
    align-items: flex-start;
  }
  .region.below {
    margin: 16px -10px 0;
  }
  .region.below .region-name {
    left: auto;
    right: 12px;
  }
  .alu-below .alu-pair {
    min-height: 76px;
  }
  .zero {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 2px 7px;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--text-3);
    font-size: 0.75rem;
    white-space: nowrap;
    margin-top: 5px;
  }
  .lamp {
    width: 10px;
    height: 10px;
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
    box-shadow: 0 0 8px color-mix(in srgb, var(--ok) 60%, transparent);
  }

  /* Mikrocode-Tabelle und Protokoll */
  .mc-panel summary,
  .log summary {
    cursor: pointer;
    font-weight: 650;
    font-size: 0.9rem;
  }
  .mc-panel[open] summary {
    margin-bottom: 10px;
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
</style>
