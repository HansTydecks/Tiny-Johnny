<script lang="ts">
  type Part = 'eingabe' | 'ausgabe' | 'speicher' | 'steuerwerk' | 'rechenwerk' | 'bus' | 'cpu';

  interface Props {
    links?: Partial<Record<Part, string>>;
    kompakt?: boolean;
  }
  let { links = {}, kompakt = false }: Props = $props();

  const INFO: Record<Part, { titel: string; kurz: string; evas?: string; text: string; farbe: string }> = {
    eingabe: {
      titel: 'Eingabewerk',
      kurz: 'Eingabeeinheit',
      evas: 'E',
      farbe: 'io',
      text: 'Nimmt Daten von außen auf und wandelt sie in Signale um, die der Rechner verarbeiten kann – z. B. von Tastatur, Maus, Mikrofon oder Sensoren. Ein- und Ausgabegeräte ermöglichen die Interaktion mit dem Benutzer.',
    },
    ausgabe: {
      titel: 'Ausgabewerk',
      kurz: 'Ausgabeeinheit',
      evas: 'A',
      farbe: 'io',
      text: 'Gibt die Ergebnisse der Verarbeitung nach außen – z. B. auf dem Bildschirm, über Lautsprecher oder einen Drucker.',
    },
    speicher: {
      titel: 'Speicherwerk',
      kurz: 'Speichereinheit (RAM)',
      evas: 'S',
      farbe: 'mem',
      text: 'Im Speicher befinden sich Programme und Daten – gemeinsam! Er ist durchnummeriert: Jede Speicherstelle hat eine Adresse, z. B. steht an Speicherstelle 305 das Datenelement 11011011.',
    },
    steuerwerk: {
      titel: 'Steuerwerk',
      kurz: 'Leitwerk, Control Unit (CU)',
      farbe: 'cu',
      text: 'Holt Programmbefehle bzw. Daten aus dem Speicher und stellt sie dem Rechenwerk bereit. Es benutzt den Befehlszähler, der die Nummer der Speicherstelle enthält, unter der der nächste Befehl zu finden ist.',
    },
    rechenwerk: {
      titel: 'Rechenwerk',
      kurz: 'Arithmetic Logic Unit (ALU)',
      farbe: 'alu',
      text: 'Führt Rechen- und Logikoperationen aus – z. B. „Addiere den Inhalt von Speicherstelle X und Y und speichere das Ergebnis in Speicherstelle Z“.',
    },
    bus: {
      titel: 'Bus-System',
      kurz: 'Daten-, Adress- und Steuerbus',
      farbe: 'dbus',
      text: 'Verbindet alle Komponenten miteinander. Über den Bus werden Daten transportiert. Weil es nur einen gemeinsamen Verbindungsweg gibt, muss der Rest „schweigen“, wenn einer „redet“ – der Von-Neumann-Flaschenhals.',
    },
    cpu: {
      titel: 'CPU (Prozessor)',
      kurz: 'Verarbeitungseinheit',
      evas: 'V',
      farbe: 'cu',
      text: 'Steuerwerk und Rechenwerk bilden zusammen den Prozessor – die wichtigste Komponente für die Datenverarbeitung. Moderne CPUs führen mehrere Milliarden Befehle pro Sekunde aus.',
    },
  };

  let active = $state<Part>('cpu');
  let hover = $state<Part | null>(null);
  let evas = $state(false);
  let tourStep = $state(-1);
  let timer = $state<ReturnType<typeof setInterval> | undefined>(undefined);

  const TOUR: { parts: Part[]; bus?: 'ab' | 'db' | 'sb' | 'all'; text: string }[] = [
    { parts: ['eingabe'], text: '1 · Du drückst die Taste „7“. Das Eingabewerk erzeugt daraus einen Code.' },
    { parts: ['eingabe', 'bus'], bus: 'db', text: '2 · Der Code wandert über den Bus …' },
    { parts: ['speicher'], bus: 'ab', text: '3 · … und wird an einer Adresse im Speicher abgelegt.' },
    { parts: ['steuerwerk', 'speicher'], bus: 'all', text: '4 · Das Steuerwerk holt den nächsten Befehl des Programms aus dem Speicher: „Addiere 3 dazu“.' },
    { parts: ['rechenwerk'], bus: 'db', text: '5 · Das Rechenwerk holt die Daten und rechnet 7 + 3 = 10.' },
    { parts: ['speicher', 'bus'], bus: 'db', text: '6 · Das Ergebnis wird im Speicher abgelegt.' },
    { parts: ['ausgabe', 'bus'], bus: 'db', text: '7 · Das Ausgabewerk zeigt die 10 auf dem Bildschirm an.' },
  ];

  function playTour() {
    if (timer) {
      clearInterval(timer);
      timer = undefined;
      tourStep = -1;
      return;
    }
    tourStep = 0;
    timer = setInterval(() => {
      if (tourStep >= TOUR.length - 1) {
        clearInterval(timer);
        timer = undefined;
        setTimeout(() => (tourStep = -1), 2200);
        return;
      }
      tourStep++;
    }, 2200);
  }

  const lit = (p: Part) =>
    tourStep >= 0 ? TOUR[tourStep].parts.includes(p) || (p === 'cpu' && TOUR[tourStep].parts.some((x) => x === 'steuerwerk' || x === 'rechenwerk')) : (hover ?? active) === p || ((hover ?? active) === 'cpu' && (p === 'steuerwerk' || p === 'rechenwerk'));
  const busLit = (b: 'ab' | 'db' | 'sb') =>
    tourStep >= 0 ? TOUR[tourStep].bus === b || TOUR[tourStep].bus === 'all' : (hover ?? active) === 'bus';

  const shown = $derived(hover ?? active);
  const info = $derived(INFO[shown]);

  function select(p: Part, e?: Event) {
    e?.stopPropagation();
    active = p;
  }
  const keys = (p: Part) => (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      select(p);
    }
  };
</script>

<div class="arch" class:kompakt>
  <div class="bar">
    <div class="seg" role="group" aria-label="Ansicht">
      <button type="button" class:on={!evas} onclick={() => (evas = false)}>Von-Neumann</button>
      <button type="button" class:on={evas} onclick={() => (evas = true)}>EVAS-Prinzip</button>
    </div>
    <button class="btn small" type="button" onclick={playTour}>{timer ? '■ Stopp' : '▶ Datenfluss abspielen'}</button>
  </div>

  <div class="layout">
    <svg viewBox="0 0 900 500" role="img" aria-label="Von-Neumann-Architektur: CPU mit Steuerwerk und Rechenwerk, Bus, Eingabewerk, Speicherwerk und Ausgabewerk">
      <defs>
        <marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0 0L10 5L0 10z" fill="var(--text-3)" />
        </marker>
      </defs>

      <!-- CPU -->
      <g
        class="part c-cu"
        class:lit={lit('cpu')}
        role="button"
        tabindex="0"
        aria-label="CPU"
        onclick={(e) => select('cpu', e)}
        onkeydown={keys('cpu')}
        onmouseenter={() => (hover = 'cpu')}
        onmouseleave={() => (hover = null)}
      >
        <rect x="200" y="14" width="500" height="206" rx="22" class="cpu-box" />
        <text x="450" y="44" class="t-title" text-anchor="middle">CPU · Prozessor</text>
        {#if evas}<g class="evas"><circle cx="672" cy="42" r="18" /><text x="672" y="48" text-anchor="middle">V</text></g>{/if}
      </g>
      <g
        class="part c-cu"
        class:lit={lit('steuerwerk')}
        role="button"
        tabindex="0"
        aria-label="Steuerwerk"
        onclick={(e) => select('steuerwerk', e)}
        onkeydown={keys('steuerwerk')}
        onmouseenter={() => (hover = 'steuerwerk')}
        onmouseleave={() => (hover = null)}
      >
        <rect x="228" y="64" width="200" height="130" rx="14" />
        <text x="328" y="118" text-anchor="middle" class="t-name">Steuerwerk</text>
        <text x="328" y="142" text-anchor="middle" class="t-sub">Control Unit · CU</text>
      </g>
      <g
        class="part c-alu"
        class:lit={lit('rechenwerk')}
        role="button"
        tabindex="0"
        aria-label="Rechenwerk"
        onclick={(e) => select('rechenwerk', e)}
        onkeydown={keys('rechenwerk')}
        onmouseenter={() => (hover = 'rechenwerk')}
        onmouseleave={() => (hover = null)}
      >
        <rect x="472" y="64" width="200" height="130" rx="14" />
        <text x="572" y="118" text-anchor="middle" class="t-name">Rechenwerk</text>
        <text x="572" y="142" text-anchor="middle" class="t-sub">Arithmetic Logic Unit · ALU</text>
      </g>
      <path d="M430 110 H470" stroke="var(--text-3)" stroke-width="2" marker-end="url(#arr)" marker-start="url(#arr)" />

      <!-- Bus -->
      <g
        class="part busgroup"
        class:lit={lit('bus')}
        role="button"
        tabindex="0"
        aria-label="Bus-System"
        onclick={(e) => select('bus', e)}
        onkeydown={keys('bus')}
        onmouseenter={() => (hover = 'bus')}
        onmouseleave={() => (hover = null)}
      >
        <rect x="24" y="250" width="852" height="76" rx="14" class="bus-bg" />
        <line x1="44" x2="856" y1="268" y2="268" class="line ab" class:on={busLit('ab')} />
        <line x1="44" x2="856" y1="288" y2="288" class="line db" class:on={busLit('db')} />
        <line x1="44" x2="856" y1="308" y2="308" class="line sb" class:on={busLit('sb')} />
        <text x="866" y="272" class="t-bus ab-t" text-anchor="end">Adressbus</text>
        <text x="866" y="292" class="t-bus db-t" text-anchor="end">Datenbus</text>
        <text x="866" y="312" class="t-bus sb-t" text-anchor="end">Steuerbus</text>
        <text x="40" y="244" class="t-sub">BUS</text>
        <!-- Verbindungen -->
        {#each [150, 450, 750] as x}
          <line x1={x} x2={x} y1="326" y2="370" class="conn" />
        {/each}
        <line x1="450" x2="450" y1="220" y2="250" class="conn" />
      </g>

      <!-- Eingabe, Speicher, Ausgabe -->
      {#each [{ p: 'eingabe', x: 40, name: 'Eingabewerk', sub: 'Tastatur, Maus …', c: 'io', l: 'E' }, { p: 'speicher', x: 340, name: 'Speicherwerk', sub: 'Programme + Daten', c: 'mem', l: 'S' }, { p: 'ausgabe', x: 640, name: 'Ausgabewerk', sub: 'Bildschirm …', c: 'io', l: 'A' }] as b (b.p)}
        <g
          class="part c-{b.c}"
          class:lit={lit(b.p as Part)}
          role="button"
          tabindex="0"
          aria-label={b.name}
          onclick={(e) => select(b.p as Part, e)}
          onkeydown={keys(b.p as Part)}
          onmouseenter={() => (hover = b.p as Part)}
          onmouseleave={() => (hover = null)}
        >
          <rect x={b.x} y="370" width="220" height="110" rx="16" />
          <text x={b.x + 110} y="418" text-anchor="middle" class="t-name">{b.name}</text>
          <text x={b.x + 110} y="444" text-anchor="middle" class="t-sub">{b.sub}</text>
          {#if evas}<g class="evas"><circle cx={b.x + 196} cy="394" r="18" /><text x={b.x + 196} y="400" text-anchor="middle">{b.l}</text></g>{/if}
        </g>
      {/each}
    </svg>

    <div class="info c-{info.farbe}" aria-live="polite">
      {#if tourStep >= 0}
        <span class="info-kicker">Datenfluss</span>
        <p class="tour-text">{TOUR[tourStep].text}</p>
        <div class="dots">{#each TOUR as _, i}<span class:on={i <= tourStep}></span>{/each}</div>
      {:else}
        <span class="info-kicker">{evas && info.evas ? `EVAS: ${info.evas}` : 'Komponente'}</span>
        <h3>{info.titel}</h3>
        <span class="info-sub">{info.kurz}</span>
        <p>{info.text}</p>
        {#if links[shown]}<a class="more" href={links[shown]}>Mehr dazu →</a>{/if}
        <p class="muted hint">Tippe auf ein Bauteil im Bild.</p>
      {/if}
    </div>
  </div>
</div>

<style>
  .arch {
    container-type: inline-size;
    margin: 1.8em 0;
    padding: 16px;
    border: 1px solid var(--border);
    border-radius: 18px;
    background: var(--surface);
    box-shadow: var(--shadow);
  }
  .bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    margin-bottom: 10px;
  }
  .seg {
    display: inline-flex;
    padding: 3px;
    border-radius: 10px;
    background: var(--surface-2);
    border: 1px solid var(--border);
  }
  .seg button {
    border: 0;
    background: transparent;
    padding: 6px 12px;
    border-radius: 8px;
    font-weight: 600;
    font-size: 0.88rem;
    cursor: pointer;
    color: var(--text-2);
  }
  .seg button.on {
    background: var(--surface);
    color: var(--text);
    box-shadow: var(--shadow-s);
  }
  .layout {
    display: grid;
    grid-template-columns: minmax(0, 1.7fr) minmax(240px, 1fr);
    gap: 18px;
    align-items: center;
  }
  svg {
    width: 100%;
    height: auto;
    display: block;
    overflow: visible;
  }
  .part {
    cursor: pointer;
    outline: none;
  }
  .part rect {
    fill: var(--c-soft);
    stroke: color-mix(in srgb, var(--c) 55%, var(--border));
    stroke-width: 2;
    transition: fill 0.2s, stroke 0.2s, stroke-width 0.2s;
  }
  .part .cpu-box {
    fill: color-mix(in srgb, var(--cu-soft) 35%, var(--surface));
    stroke-dasharray: 6 5;
  }
  .part.lit > rect {
    stroke: var(--c);
    stroke-width: 3.5;
    fill: color-mix(in srgb, var(--c) 22%, var(--surface));
  }
  .part:focus-visible > rect {
    stroke: var(--accent);
    stroke-width: 4;
  }
  .t-title {
    font-weight: 750;
    font-size: 20px;
    fill: var(--text);
  }
  .t-name {
    font-weight: 700;
    font-size: 21px;
    fill: var(--text);
  }
  .t-sub {
    font-size: 14px;
    fill: var(--text-2);
    font-weight: 500;
  }
  .bus-bg {
    fill: var(--surface-2) !important;
    stroke: var(--border) !important;
  }
  .busgroup.lit .bus-bg {
    stroke: var(--dbus) !important;
    stroke-width: 3 !important;
  }
  .line {
    stroke-width: 6;
    stroke-linecap: round;
    opacity: 0.55;
    transition: opacity 0.2s, stroke-width 0.2s;
  }
  .line.on {
    opacity: 1;
    stroke-width: 9;
    stroke-dasharray: 18 10;
    animation: flow 0.8s linear infinite;
  }
  @keyframes flow {
    to {
      stroke-dashoffset: -28;
    }
  }
  .ab {
    stroke: var(--abus);
  }
  .db {
    stroke: var(--dbus);
  }
  .sb {
    stroke: var(--sbus);
  }
  .t-bus {
    font-size: 12px;
    font-weight: 700;
    paint-order: stroke;
    stroke: var(--surface-2);
    stroke-width: 4px;
  }
  .ab-t {
    fill: var(--abus);
  }
  .db-t {
    fill: var(--dbus);
  }
  .sb-t {
    fill: var(--sbus);
  }
  .conn {
    stroke: var(--border-strong);
    stroke-width: 6;
  }
  .evas circle {
    fill: var(--text);
  }
  .evas text {
    fill: var(--bg);
    font-weight: 800;
    font-size: 18px;
  }
  .info {
    align-self: stretch;
    padding: 16px 18px;
    border-radius: 14px;
    background: var(--c-soft);
    border-left: 4px solid var(--c);
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-height: 220px;
  }
  .info-kicker {
    font-size: 0.7rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--c);
  }
  .info h3 {
    margin: 0;
    font-size: 1.25rem;
  }
  .info-sub {
    font-size: 0.85rem;
    color: var(--text-2);
    font-weight: 600;
  }
  .info p {
    margin: 8px 0 0;
    font-size: 0.95rem;
  }
  .hint {
    font-size: 0.8rem !important;
    margin-top: auto !important;
    padding-top: 10px;
  }
  .more {
    font-weight: 650;
    margin-top: 6px;
  }
  .tour-text {
    font-size: 1.05rem !important;
    font-weight: 600;
  }
  .dots {
    display: flex;
    gap: 5px;
    margin-top: auto;
  }
  .dots span {
    width: 22px;
    height: 5px;
    border-radius: 3px;
    background: var(--surface-3);
  }
  .dots span.on {
    background: var(--c);
  }
  @container (max-width: 900px) {
    .layout {
      grid-template-columns: 1fr;
    }
    .info {
      min-height: 0;
    }
  }
</style>
