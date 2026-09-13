<script lang="ts">
  /**
   * Optischer Speicher: Ein Laser tastet Pits (Vertiefungen) und Lands (Flächen) ab.
   * Ein Übergang zwischen Pit und Land bedeutet 1, gleichbleibende Fläche bedeutet 0.
   */
  import { onMount } from 'svelte';

  const MEDIA = {
    cd: { name: 'CD', nm: 780, color: '#c2410c', label: 'Infrarot', cell: 26, spur: '1,6 µm', kap: '700 MB' },
    dvd: { name: 'DVD', nm: 650, color: '#e11d48', label: 'Rot', cell: 17, spur: '0,74 µm', kap: '4,7 GB' },
    bd: { name: 'Blu-ray', nm: 405, color: '#7c3aed', label: 'Blau-Violett', cell: 10, spur: '0,32 µm', kap: '25 GB' },
  } as const;
  type Medium = keyof typeof MEDIA;

  const BITS = '1001000100100001001000100010000100100010010001000010010010001000100001001'.split('').map(Number);
  // Oberfläche: Jeder 1-Bit-Übergang wechselt zwischen Land (0) und Pit (1)
  const SURFACE: number[] = [];
  {
    let level = 0;
    for (const b of BITS) {
      if (b) level = 1 - level;
      SURFACE.push(level);
    }
  }

  let medium = $state<Medium>('cd');
  let playing = $state(true);
  let offset = $state(0); // in Zellen
  const m = $derived(MEDIA[medium]);
  const W = 560;
  const LASER_X = 170;

  onMount(() => {
    let last = performance.now();
    let raf = 0;
    const loop = (t: number) => {
      const dt = Math.min(60, t - last);
      last = t;
      if (playing) offset = (offset + dt / 380) % BITS.length;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  });

  const visibleCells = $derived(Math.ceil(W / m.cell) + 2);
  const current = $derived(Math.floor(offset + LASER_X / m.cell) % BITS.length);
  const readSoFar = $derived(Array.from({ length: 16 }, (_, i) => BITS[(current - 15 + i + BITS.length) % BITS.length]));
  const signal = $derived(Array.from({ length: 40 }, (_, i) => SURFACE[(current - 39 + i + BITS.length) % BITS.length]));
</script>

<div class="opt">
  <div class="bar">
    <div class="seg" role="group" aria-label="Medium">
      {#each Object.entries(MEDIA) as [key, med]}
        <button type="button" class:on={medium === key} onclick={() => (medium = key as Medium)}>{med.name}</button>
      {/each}
    </div>
    <button class="btn small" type="button" onclick={() => (playing = !playing)}>{playing ? '❚❚ Pause' : '▶ Weiter'}</button>
  </div>

  <svg viewBox={`0 0 ${W} 160`} role="img" aria-label="Querschnitt einer Datenspur: Aluminiumschicht mit Pits und Lands, darunter Kunststoff und Laser">
    <defs>
      <linearGradient id="beam" x1="0" x2="0" y1="1" y2="0">
        <stop offset="0" stop-color={m.color} stop-opacity="0.15" />
        <stop offset="1" stop-color={m.color} stop-opacity="0.95" />
      </linearGradient>
    </defs>
    <!-- Schutzlack oben, Kunststoffträger unten -->
    <rect x="0" y="20" width={W} height="12" class="lack" />
    <rect x="0" y="32" width={W} height="72" class="poly" />
    <g transform={`translate(${-((offset % 1) * m.cell)} 0)`}>
      {#each Array(visibleCells) as _, i}
        {@const idx = (Math.floor(offset) + i) % BITS.length}
        <!-- Vom Laser aus gesehen ist ein Pit eine Erhebung der Aluminiumschicht -->
        <rect x={i * m.cell} y="32" width={m.cell + 0.5} height={SURFACE[idx] ? 42 : 28} class="alu" />
      {/each}
    </g>
    <text x="8" y="14" class="lbl">Schutzlack · Aluminium mit Pits und Lands · Kunststoff</text>
    <text x={W - 8} y="96" class="lbl" text-anchor="end">Kunststoffträger</text>
    <!-- Laser -->
    <polygon points={`${LASER_X - 14},136 ${LASER_X + 14},136 ${LASER_X + 3},62 ${LASER_X - 3},62`} fill="url(#beam)" />
    <rect x={LASER_X - 22} y="134" width="44" height="14" rx="4" class="diode" />
    <text x={LASER_X + 32} y="146" class="lbl">Laser {m.nm} nm ({m.label}) · Fotodiode misst die Reflexion</text>
  </svg>

  <div class="signal" aria-label="Reflexionssignal">
    <span class="sig-l muted">Reflexion</span>
    <div class="wave">
      {#each signal as s, i}
        <span class:low={s === 1} class:edge={i > 0 && signal[i - 1] !== s}></span>
      {/each}
    </div>
  </div>
  <div class="decoded">
    <span class="muted">gelesene Bits</span>
    <span class="bits mono">{#each readSoFar as b, i}<span class:one={b === 1} class:now={i === readSoFar.length - 1}>{b}</span>{/each}</span>
  </div>

  <div class="facts">
    <div><span>Wellenlänge</span><b>{m.nm} nm</b></div>
    <div><span>Spurabstand</span><b>{m.spur}</b></div>
    <div><span>Kapazität</span><b>{m.kap}</b></div>
  </div>
  <p class="muted small">
    Auf einem <b>Land</b> wird der Laser stark reflektiert, im <b>Pit</b> schwächer. Nicht die Vertiefung selbst ist die 1,
    sondern jeder <b>Übergang</b>. Je kürzer die Wellenlänge, desto kleiner der Laserpunkt – und desto dichter lassen sich
    die Daten packen.
  </p>
</div>

<style>
  .opt {
    margin: 1.6em 0;
    padding: 16px;
    border: 1px solid var(--border);
    border-radius: 16px;
    background: var(--surface);
    box-shadow: var(--shadow-s);
  }
  .bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
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
  svg {
    width: 100%;
    height: auto;
    display: block;
    border-radius: 10px;
    background: var(--surface-2);
  }
  .poly {
    fill: color-mix(in srgb, var(--mem) 12%, var(--surface));
  }
  .lack {
    fill: var(--surface-3);
  }
  .alu {
    fill: #aab4c2;
    stroke: #8d98a8;
    stroke-width: 0.5;
  }
  .diode {
    fill: var(--text-2);
  }
  .lbl {
    font-size: 11px;
    fill: var(--text-2);
    font-weight: 600;
  }
  .signal,
  .decoded {
    display: grid;
    grid-template-columns: 90px 1fr;
    align-items: center;
    gap: 8px;
    margin-top: 8px;
    font-size: 0.8rem;
  }
  .wave {
    display: grid;
    grid-template-columns: repeat(40, 1fr);
    height: 34px;
    align-items: end;
  }
  .wave span {
    height: 100%;
    background: color-mix(in srgb, var(--ok) 55%, transparent);
    border-top: 2px solid var(--ok);
  }
  .wave span.low {
    height: 35%;
  }
  .wave span.edge {
    box-shadow: inset 2px 0 0 var(--err);
  }
  .bits {
    display: flex;
    gap: 2px;
    flex-wrap: wrap;
  }
  .bits span {
    width: 18px;
    text-align: center;
    border-radius: 4px;
    background: var(--surface-2);
  }
  .bits span.one {
    background: var(--err-soft);
    color: var(--err);
    font-weight: 800;
  }
  .bits span.now {
    outline: 2px solid var(--accent);
  }
  .facts {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    margin: 12px 0 8px;
  }
  .facts div {
    display: flex;
    flex-direction: column;
    padding: 8px 12px;
    border-radius: 10px;
    background: var(--surface-2);
    font-size: 0.78rem;
    color: var(--text-3);
  }
  .facts b {
    font-size: 1rem;
    color: var(--text);
  }
  .small {
    font-size: 0.85rem;
    margin: 0;
  }
</style>
