<script lang="ts">
  /**
   * Optische Maus: Ein winziger Kamerasensor fotografiert die Unterlage sehr oft pro Sekunde.
   * Aus der Verschiebung des Musters zwischen zwei Bildern berechnet der Chip die Bewegung.
   */
  import { onMount } from 'svelte';

  const W = 160;
  const H = 100;
  const WIN = 9; // Sensorfenster in Texturpixeln

  // Zufällige, aber feste Oberflächenstruktur (Mauspad)
  function makeTexture(): number[] {
    let seed = 42;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const raw = Array.from({ length: W * H }, () => rnd());
    const out = new Array(W * H).fill(0);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        let s = 0;
        let n = 0;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            const yy = y + dy;
            if (xx >= 0 && yy >= 0 && xx < W && yy < H) {
              s += raw[yy * W + xx];
              n++;
            }
          }
        out[y * W + x] = s / n;
      }
    return out;
  }
  const tex = makeTexture();

  let canvas: HTMLCanvasElement | undefined = $state();
  let pos = $state({ x: 80, y: 50 });
  let prev = $state({ x: 80, y: 50 });
  let dpi = $state(1600);
  let total = $state({ x: 0, y: 0 });
  let frames = $state(0);

  onMount(() => {
    const ctx = canvas!.getContext('2d')!;
    const img = ctx.createImageData(W, H);
    for (let i = 0; i < W * H; i++) {
      const v = 120 + tex[i] * 110;
      img.data[i * 4] = v;
      img.data[i * 4 + 1] = v * 0.97;
      img.data[i * 4 + 2] = v * 0.92;
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  });

  function move(e: PointerEvent) {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = Math.round(((e.clientX - r.left) / r.width) * W);
    const y = Math.round(((e.clientY - r.top) / r.height) * H);
    const nx = Math.max(WIN, Math.min(W - WIN - 1, x));
    const ny = Math.max(WIN, Math.min(H - WIN - 1, y));
    if (nx === pos.x && ny === pos.y) return;
    prev = pos;
    pos = { x: nx, y: ny };
    frames++;
    total = { x: total.x + (nx - prev.x), y: total.y + (ny - prev.y) };
  }

  const frame = (p: { x: number; y: number }) => {
    const cells: number[] = [];
    const h = Math.floor(WIN / 2);
    for (let dy = -h; dy <= h; dy++) for (let dx = -h; dx <= h; dx++) cells.push(tex[(p.y + dy) * W + (p.x + dx)]);
    return cells;
  };
  // 1 Texturpixel ≈ 0,1 mm auf dem Mauspad
  const MM = 0.1;
  const dx = $derived(pos.x - prev.x);
  const dy = $derived(pos.y - prev.y);
  const counts = (px: number) => Math.round(((px * MM) / 25.4) * dpi);
</script>

<div class="mouse">
  <div class="pad-wrap">
    <p class="muted hint">Bewege den Zeiger (oder den Finger) über das Mauspad.</p>
    <div class="pad" role="img" aria-label="Mauspad mit Oberflächenstruktur" onpointermove={move} onpointerdown={move}>
      <canvas bind:this={canvas} width={W} height={H}></canvas>
      <div class="lens" style={`left:${(pos.x / W) * 100}%; top:${(pos.y / H) * 100}%; width:${(WIN / W) * 100}%; height:${(WIN / H) * 100}%`}></div>
    </div>
  </div>

  <div class="sensor">
    <div class="frames">
      <figure>
        <figcaption>vorheriges Bild</figcaption>
        <div class="px">{#each frame(prev) as v}<span style={`--v:${v}`}></span>{/each}</div>
      </figure>
      <span class="vs" aria-hidden="true">→</span>
      <figure>
        <figcaption>aktuelles Bild</figcaption>
        <div class="px">{#each frame(pos) as v}<span style={`--v:${v}`}></span>{/each}</div>
      </figure>
    </div>
    <dl>
      <dt>Muster verschoben um</dt>
      <dd class="mono">Δx = {dx} · Δy = {dy} Pixel</dd>
      <dt>Bewegung (Summe)</dt>
      <dd class="mono">{(total.x * MM).toFixed(1)} mm · {(total.y * MM).toFixed(1)} mm</dd>
      <dt>An den Computer gemeldet</dt>
      <dd class="mono">{counts(total.x)} · {counts(total.y)} Counts</dd>
    </dl>
    <label class="dpi">
      <span>Auflösung: <b>{dpi} DPI</b> <span class="muted">(Counts pro Zoll)</span></span>
      <input type="range" min="400" max="3200" step="400" bind:value={dpi} />
    </label>
    <p class="note">
      Echte Sensoren machen <b>mehrere tausend Bilder pro Sekunde</b> mit etwa 20 × 20 Pixeln und vergleichen sie per Bildverarbeitung.
      Je höher die DPI, desto weiter bewegt sich der Zeiger bei gleicher Handbewegung.
    </p>
  </div>
</div>

<style>
  .mouse {
    margin: 1.6em 0;
    padding: 16px;
    border: 1px solid var(--border);
    border-radius: 16px;
    background: var(--surface);
    box-shadow: var(--shadow-s);
    display: grid;
    grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
    gap: 20px;
  }
  .hint {
    margin: 0 0 8px;
    font-size: 0.85rem;
  }
  .pad {
    position: relative;
    border-radius: 12px;
    overflow: hidden;
    touch-action: none;
    cursor: crosshair;
    border: 1px solid var(--border-strong);
  }
  canvas {
    display: block;
    width: 100%;
    height: auto;
    image-rendering: pixelated;
  }
  .lens {
    position: absolute;
    transform: translate(-50%, -50%);
    border: 2px solid var(--io);
    border-radius: 3px;
    box-shadow: 0 0 0 9999px rgb(0 0 0 / 0.08), 0 0 12px var(--io);
    pointer-events: none;
  }
  .frames {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  figure {
    margin: 0;
  }
  figcaption {
    font-size: 0.72rem;
    color: var(--text-3);
    margin-bottom: 4px;
  }
  .px {
    display: grid;
    grid-template-columns: repeat(9, 1fr);
    width: 120px;
    aspect-ratio: 1;
    border-radius: 6px;
    overflow: hidden;
    border: 1px solid var(--border-strong);
  }
  .px span {
    background: hsl(30 8% calc(18% + var(--v) * 70%));
  }
  .vs {
    color: var(--text-3);
    font-size: 1.3rem;
    margin-top: 16px;
  }
  dl {
    margin: 12px 0;
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 4px 12px;
    font-size: 0.88rem;
  }
  dt {
    color: var(--text-3);
  }
  dd {
    margin: 0;
    font-weight: 650;
  }
  .dpi {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 0.88rem;
  }
  .dpi input {
    accent-color: var(--io);
  }
  .note {
    font-size: 0.85rem;
    color: var(--text-2);
    margin: 10px 0 0;
  }
  @media (max-width: 760px) {
    .mouse {
      grid-template-columns: 1fr;
    }
  }
</style>
