<script lang="ts">
  /** Bildschirm: Pixel, Subpixel, Farbtiefe und Bildspeicher (Framebuffer). */
  const PALETTE: [number, number, number][] = [
    [240, 244, 250], // 0 Hintergrund
    [79, 70, 229], // 1 Indigo
    [255, 255, 255], // 2 Weiß
    [245, 165, 36], // 3 Orange
    [30, 41, 59], // 4 Dunkel
  ];
  const ART = [
    '0000000000000000',
    '0001111111111000',
    '0011111111111100',
    '0111111111111110',
    '0111111122111110',
    '0111111122111110',
    '0111111122111110',
    '0111111122111110',
    '0111111122111110',
    '0112211122111110',
    '0112221222111110',
    '0111222221111110',
    '0011122211111100',
    '0001111111111000',
    '0000033333300000',
    '0000000000000000',
  ].map((r) => r.split('').map(Number));

  let zoom = $state(1);
  let sel = $state<{ x: number; y: number }>({ x: 8, y: 4 });

  const color = $derived(PALETTE[ART[sel.y][sel.x]]);
  const bin8 = (n: number) => n.toString(2).padStart(8, '0');

  // Bildspeicher-Rechner
  const RES = [
    { name: 'HD (1280 × 720)', w: 1280, h: 720 },
    { name: 'Full HD (1920 × 1080)', w: 1920, h: 1080 },
    { name: 'WQHD (2560 × 1440)', w: 2560, h: 1440 },
    { name: '4K (3840 × 2160)', w: 3840, h: 2160 },
  ];
  let res = $state(1);
  let depth = $state(24);
  let hz = $state(60);
  const pixels = $derived(RES[res].w * RES[res].h);
  const bytesFrame = $derived((pixels * depth) / 8);
  const mbFrame = $derived(bytesFrame / 1024 / 1024);
  const gbitSec = $derived((pixels * depth * hz) / 1e9);
  const fmt = (n: number, d = 1) => n.toLocaleString('de-DE', { maximumFractionDigits: d, minimumFractionDigits: d });
</script>

<div class="screen">
  <div class="view">
    <div class="zoombar" role="group" aria-label="Vergrößerung">
      {#each ['Bild', 'Pixel', 'Subpixel'] as label, i}
        <button type="button" class:on={zoom === i + 1} onclick={() => (zoom = i + 1)}>{label}</button>
      {/each}
    </div>
    <div class="canvas z{zoom}" role="grid" aria-label="Vergrößertes Bild aus 16 × 16 Pixeln">
      {#each ART as row, y}
        {#each row as c, x}
          {@const [r, g, b] = PALETTE[c]}
          <button
            type="button"
            class="pixel"
            class:sel={zoom > 1 && sel.x === x && sel.y === y}
            style={`--r:${r};--g:${g};--b:${b}`}
            onclick={() => (sel = { x, y })}
            aria-label={`Pixel ${x}, ${y}`}
            tabindex={zoom > 1 ? 0 : -1}
          >
            {#if zoom === 3}<span class="sr" style={`opacity:${r / 255}`}></span><span class="sg" style={`opacity:${g / 255}`}></span><span class="sb" style={`opacity:${b / 255}`}></span>{/if}
          </button>
        {/each}
      {/each}
    </div>
  </div>

  <div class="side">
    <h4>Ausgewähltes Pixel ({sel.x} | {sel.y})</h4>
    <div class="swatch" style={`background: rgb(${color.join(',')})`}></div>
    <table class="rgb">
      <tbody>
        <tr><th class="r">Rot</th><td class="mono">{color[0]}</td><td class="mono bits">{bin8(color[0])}</td></tr>
        <tr><th class="g">Grün</th><td class="mono">{color[1]}</td><td class="mono bits">{bin8(color[1])}</td></tr>
        <tr><th class="b">Blau</th><td class="mono">{color[2]}</td><td class="mono bits">{bin8(color[2])}</td></tr>
      </tbody>
    </table>
    <p class="muted small">
      Jedes Pixel besteht aus drei <b>Subpixeln</b> (Rot, Grün, Blau). Mit je 8 Bit (0–255) pro Farbe ergeben sich
      2²⁴ ≈ 16,7 Millionen Farben.
    </p>

    <h4>Wie viel Speicher braucht ein Bild?</h4>
    <div class="calc">
      <label>Auflösung
        <select class="input" bind:value={res}>
          {#each RES as r, i}<option value={i}>{r.name}</option>{/each}
        </select>
      </label>
      <label>Farbtiefe
        <select class="input" bind:value={depth}>
          <option value={8}>8 Bit (256 Farben)</option>
          <option value={24}>24 Bit (True Color)</option>
          <option value={30}>30 Bit (HDR)</option>
        </select>
      </label>
      <label>Bildwiederholrate
        <select class="input" bind:value={hz}>
          <option value={60}>60 Hz</option>
          <option value={120}>120 Hz</option>
          <option value={144}>144 Hz</option>
        </select>
      </label>
    </div>
    <div class="result">
      <div><span class="big mono">{pixels.toLocaleString('de-DE')}</span><span>Pixel</span></div>
      <div><span class="big mono">{fmt(mbFrame)} MB</span><span>pro Bild im Grafikspeicher</span></div>
      <div><span class="big mono">{fmt(gbitSec, 2)} Gbit/s</span><span>müssen zum Monitor</span></div>
    </div>
  </div>
</div>

<style>
  .screen {
    margin: 1.6em 0;
    padding: 16px;
    border: 1px solid var(--border);
    border-radius: 16px;
    background: var(--surface);
    box-shadow: var(--shadow-s);
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 22px;
  }
  .zoombar {
    display: inline-flex;
    padding: 3px;
    border-radius: 10px;
    background: var(--surface-2);
    border: 1px solid var(--border);
    margin-bottom: 10px;
  }
  .zoombar button {
    border: 0;
    background: transparent;
    padding: 6px 12px;
    border-radius: 8px;
    font-weight: 600;
    font-size: 0.85rem;
    cursor: pointer;
    color: var(--text-2);
  }
  .zoombar button.on {
    background: var(--surface);
    color: var(--text);
    box-shadow: var(--shadow-s);
  }
  .canvas {
    display: grid;
    grid-template-columns: repeat(16, 1fr);
    aspect-ratio: 1;
    width: 100%;
    max-width: 420px;
    border-radius: 10px;
    overflow: hidden;
    border: 1px solid var(--border-strong);
    background: #111;
    transition: gap 0.2s;
  }
  .canvas.z1 {
    width: 96px;
    border-radius: 4px;
  }
  .canvas.z2 {
    gap: 1px;
  }
  .canvas.z3 {
    gap: 2px;
  }
  .pixel {
    border: 0;
    padding: 0;
    background: rgb(var(--r) var(--g) var(--b));
    cursor: pointer;
    position: relative;
    display: flex;
    min-width: 0;
  }
  .z1 .pixel {
    cursor: default;
  }
  .z3 .pixel {
    background: #0a0a0a;
    gap: 1px;
    padding: 1px;
  }
  .pixel span {
    flex: 1;
    border-radius: 1px;
  }
  .sr {
    background: #ff2a2a;
  }
  .sg {
    background: #2aff4a;
  }
  .sb {
    background: #3a5bff;
  }
  .pixel.sel {
    outline: 2px solid var(--io);
    outline-offset: -1px;
    z-index: 1;
  }
  h4 {
    margin: 0 0 8px;
    font-size: 0.95rem;
  }
  .side h4:not(:first-child) {
    margin-top: 18px;
  }
  .swatch {
    height: 22px;
    border-radius: 6px;
    border: 1px solid var(--border-strong);
    margin-bottom: 6px;
  }
  .rgb th,
  .rgb td {
    padding: 3px 8px;
    background: none;
    font-size: 0.88rem;
  }
  .rgb .r {
    color: #e0245e;
  }
  .rgb .g {
    color: var(--dbus);
  }
  .rgb .b {
    color: var(--mem);
  }
  .bits {
    color: var(--text-3);
  }
  .small {
    font-size: 0.83rem;
    margin: 8px 0 0;
  }
  .calc {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .calc label {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 0.78rem;
    color: var(--text-3);
    font-weight: 600;
  }
  .calc label:first-child {
    grid-column: 1 / -1;
  }
  .calc .input {
    min-height: 34px;
    padding: 2px 8px;
    font-size: 0.88rem;
  }
  .result {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
    margin-top: 10px;
  }
  .result div {
    display: flex;
    flex-direction: column;
    padding: 8px 10px;
    border-radius: 10px;
    background: var(--io-soft);
    font-size: 0.75rem;
    color: var(--text-2);
  }
  .big {
    font-size: 1rem;
    font-weight: 750;
    color: var(--text);
  }
  @media (max-width: 760px) {
    .screen {
      grid-template-columns: 1fr;
    }
    .result {
      grid-template-columns: 1fr;
    }
  }
</style>
