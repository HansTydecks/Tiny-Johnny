<script lang="ts">
  /**
   * Magnetischer Speicher: Festplatte mit rotierender Scheibe und Schreib-/Lesekopf.
   * Zugriffszeit = Suchzeit (Kopf bewegen) + Rotationslatenz (warten, bis der Sektor vorbeikommt).
   */
  import { onMount } from 'svelte';

  const CX = 170;
  const CY = 150;
  const TRACKS = 6;
  const SECTORS = 12;
  const R0 = 42;
  const DR = 14;
  const REV_MS = 60000 / 7200; // 8,33 ms pro Umdrehung
  const SLOW = 150; // 1 ms simuliert = 150 ms echt

  const trackR = (t: number) => R0 + t * DR + DR / 2;

  let angle = $state(0); // Drehwinkel der Scheibe
  let headR = $state(trackR(0));
  let headTrack = $state(0);
  let phase = $state<'idle' | 'seek' | 'wait' | 'read'>('idle');
  let target = $state<{ t: number; s: number } | null>(null);
  let seekMs = $state(0);
  let waitMs = $state(0);
  let elapsedSeek = 0;
  let seekFrom = 0;
  let history = $state<{ t: number; s: number; seek: number; wait: number }[]>([]);

  // Sektor-Mittelwinkel in Scheibenkoordinaten; der Kopf sitzt bei Winkel 0 (rechts)
  const sectorStart = (s: number) => s * (360 / SECTORS);

  function request() {
    if (phase !== 'idle') return;
    let t: number;
    do t = Math.floor(Math.random() * TRACKS);
    while (t === headTrack && Math.random() < 0.7);
    const s = Math.floor(Math.random() * SECTORS);
    target = { t, s };
    seekMs = Math.abs(t - headTrack) === 0 ? 0 : 2 + Math.abs(t - headTrack) * 1.4;
    seekFrom = headR;
    elapsedSeek = 0;
    waitMs = 0;
    phase = 'seek';
  }

  onMount(() => {
    let last = performance.now();
    let raf = 0;
    const loop = (now: number) => {
      const dtSim = Math.min(50, now - last) / SLOW;
      last = now;
      angle = (angle + (dtSim / REV_MS) * 360) % 360;
      if (phase === 'seek' && target) {
        elapsedSeek += dtSim;
        const k = seekMs === 0 ? 1 : Math.min(1, elapsedSeek / seekMs);
        const ease = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        headR = seekFrom + (trackR(target.t) - seekFrom) * ease;
        if (k >= 1) {
          headTrack = target.t;
          phase = 'wait';
        }
      } else if (phase === 'wait' && target) {
        waitMs += dtSim;
        // Position des Sektoranfangs relativ zum Kopf (0°)
        const pos = (sectorStart(target.s) + angle) % 360;
        const width = 360 / SECTORS;
        if (pos >= 360 - width || pos < 4) {
          phase = 'read';
          history = [{ ...target, seek: seekMs, wait: waitMs }, ...history].slice(0, 4);
          setTimeout(() => {
            phase = 'idle';
          }, 900);
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  });

  const arc = (r1: number, r2: number, a1: number, a2: number) => {
    const p = (r: number, a: number) => [CX + r * Math.cos((a * Math.PI) / 180), CY + r * Math.sin((a * Math.PI) / 180)];
    const [x1, y1] = p(r2, a1);
    const [x2, y2] = p(r2, a2);
    const [x3, y3] = p(r1, a2);
    const [x4, y4] = p(r1, a1);
    return `M${x1} ${y1} A${r2} ${r2} 0 0 1 ${x2} ${y2} L${x3} ${y3} A${r1} ${r1} 0 0 0 ${x4} ${y4}Z`;
  };

  // Magnetisierung auf einer Spur (Bitfolge)
  let domains = $state([1, 1, 0, 1, 0, 0, 0, 1, 1, 0, 1, 1]);
  const last = $derived(history[0]);
</script>

<div class="hdd">
  <div class="disk">
    <svg viewBox="0 0 420 300" role="img" aria-label="Festplatte mit Scheibe, Spuren, Sektoren und Schreib-/Lesekopf">
      <circle cx={CX} cy={CY} r="136" class="platter" />
      <g transform={`rotate(${-angle} ${CX} ${CY})`}>
        {#each Array(TRACKS) as _, t}
          <circle cx={CX} cy={CY} r={trackR(t)} class="track" />
        {/each}
        {#each Array(SECTORS) as _, s}
          <line x1={CX + R0 * Math.cos((s * 30 * Math.PI) / 180)} y1={CY + R0 * Math.sin((s * 30 * Math.PI) / 180)} x2={CX + (R0 + TRACKS * DR) * Math.cos((s * 30 * Math.PI) / 180)} y2={CY + (R0 + TRACKS * DR) * Math.sin((s * 30 * Math.PI) / 180)} class="sector" />
        {/each}
        {#if target}
          <path d={arc(R0 + target.t * DR, R0 + (target.t + 1) * DR, -sectorStart(target.s) - 30, -sectorStart(target.s))} class="target" class:reading={phase === 'read'} />
        {/if}
      </g>
      <circle cx={CX} cy={CY} r="16" class="spindle" />
      <!-- Arm -->
      <line x1="395" y1="275" x2={CX + headR} y2={CY} class="arm" />
      <circle cx="395" cy="275" r="12" class="pivot" />
      <rect x={CX + headR - 7} y={CY - 5} width="14" height="10" rx="2" class="head" class:active={phase === 'read'} />
      <text x={CX + headR} y={CY - 12} text-anchor="middle" class="head-l">Kopf</text>
    </svg>
  </div>

  <div class="side">
    <button class="btn primary" type="button" onclick={request} disabled={phase !== 'idle'}>
      {phase === 'idle' ? 'Daten anfordern' : phase === 'seek' ? 'Kopf fährt …' : phase === 'wait' ? 'Warte auf Sektor …' : 'Lese …'}
    </button>
    {#if target}
      <p class="req">Gesucht: Spur <b>{target.t}</b>, Sektor <b>{target.s}</b> (orange markiert)</p>
    {/if}
    <div class="times">
      <div class:on={phase === 'seek'}><span>Suchzeit</span><b class="mono">{seekMs.toFixed(1)} ms</b></div>
      <div class:on={phase === 'wait'}><span>Rotationslatenz</span><b class="mono">{waitMs.toFixed(1)} ms</b></div>
      <div><span>Zugriffszeit</span><b class="mono">{(seekMs + waitMs).toFixed(1)} ms</b></div>
    </div>
    {#if last}
      <p class="compare">
        Zum Vergleich: Ein Zugriff auf den <b>Arbeitsspeicher</b> dauert etwa 0,00008 ms –
        rund <b>{Math.round((last.seek + last.wait) / 0.00008).toLocaleString('de-DE')}-mal</b> schneller.
      </p>
    {/if}
    <p class="muted small">7200 Umdrehungen pro Minute = eine Umdrehung in 8,3 ms. Hier läuft alles <b>150-fach verlangsamt</b>.</p>
  </div>

  <div class="magnet">
    <h4>Wie werden Bits gespeichert?</h4>
    <p class="muted small">Die Scheibe ist mit einer magnetisierbaren Schicht überzogen. Der Schreibkopf richtet winzige Bereiche in eine von zwei Richtungen aus. Tippe einen Bereich an, um ihn umzumagnetisieren.</p>
    <div class="strip">
      {#each domains as d, i}
        <button type="button" class="dom" class:n={d === 1} onclick={() => (domains[i] = d ? 0 : 1)} aria-label={`Bereich ${i}: ${d ? 'Nord' : 'Süd'}`}>
          <span class="arrow">{d ? '→' : '←'}</span>
          <span class="mono">{d}</span>
        </button>
      {/each}
    </div>
    <p class="muted small">Beim Lesen erzeugt jeder <b>Wechsel</b> der Magnetisierung einen kleinen Spannungsimpuls im Lesekopf. Ohne Strom bleibt die Magnetisierung erhalten → <b>nicht flüchtig</b>.</p>
  </div>
</div>

<style>
  .hdd {
    margin: 1.6em 0;
    padding: 16px;
    border: 1px solid var(--border);
    border-radius: 16px;
    background: var(--surface);
    box-shadow: var(--shadow-s);
    display: grid;
    grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
    gap: 18px;
  }
  svg {
    width: 100%;
    height: auto;
    display: block;
  }
  .platter {
    fill: color-mix(in srgb, var(--sbus) 25%, var(--surface-2));
    stroke: var(--border-strong);
    stroke-width: 2;
  }
  .track {
    fill: none;
    stroke: color-mix(in srgb, var(--text-3) 35%, transparent);
    stroke-width: 1;
  }
  .sector {
    stroke: color-mix(in srgb, var(--text-3) 30%, transparent);
    stroke-width: 1;
  }
  .target {
    fill: var(--abus);
    opacity: 0.85;
  }
  .target.reading {
    fill: var(--ok);
  }
  .spindle {
    fill: var(--surface);
    stroke: var(--border-strong);
    stroke-width: 3;
  }
  .arm {
    stroke: var(--text-2);
    stroke-width: 7;
    stroke-linecap: round;
  }
  .pivot {
    fill: var(--text-2);
  }
  .head {
    fill: var(--text);
  }
  .head.active {
    fill: var(--ok);
  }
  .head-l {
    font-size: 11px;
    fill: var(--text-2);
    font-weight: 700;
  }
  .side {
    display: flex;
    flex-direction: column;
    gap: 10px;
    align-items: flex-start;
  }
  .req {
    margin: 0;
    font-size: 0.9rem;
  }
  .times {
    display: grid;
    grid-template-columns: 1fr;
    gap: 6px;
    width: 100%;
  }
  .times div {
    display: flex;
    justify-content: space-between;
    padding: 6px 12px;
    border-radius: 10px;
    background: var(--surface-2);
    font-size: 0.9rem;
  }
  .times div.on {
    background: var(--abus-soft);
  }
  .times div:last-child {
    background: var(--mem-soft);
    font-weight: 700;
  }
  .compare {
    font-size: 0.88rem;
    margin: 0;
  }
  .small {
    font-size: 0.82rem;
    margin: 0;
  }
  .magnet {
    grid-column: 1 / -1;
    border-top: 1px solid var(--border);
    padding-top: 12px;
  }
  .magnet h4 {
    margin: 0 0 4px;
  }
  .strip {
    display: grid;
    grid-template-columns: repeat(12, 1fr);
    margin: 10px 0;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid var(--border-strong);
  }
  .dom {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 6px 0;
    border: 0;
    border-right: 1px solid var(--border);
    background: color-mix(in srgb, var(--io) 14%, var(--surface));
    cursor: pointer;
    font-size: 0.8rem;
  }
  .dom.n {
    background: color-mix(in srgb, var(--mem) 16%, var(--surface));
  }
  .arrow {
    font-size: 1.1rem;
    font-weight: 800;
  }
  @media (max-width: 760px) {
    .hdd {
      grid-template-columns: 1fr;
    }
  }
</style>
