/**
 * Prozedurale „Die-Shots“: Chip-Grundrisse aus Blöcken (Logik, SRAM, PHY …), deren Feinstruktur
 * in Millimeter-Koordinaten festgelegt ist. Jeder Ausschnitt kann in jeder Auflösung gezeichnet werden
 * und sieht trotzdem gleich aus – so passt der Kern-Ausschnitt nahtlos auf den ganzen Chip.
 */
import { rng } from './kit';

export type BlockType = 'logic' | 'sram' | 'phy' | 'route' | 'eu' | 'pad' | 'analog' | 'array' | 'seal';
export interface Block {
  x: number;
  y: number;
  w: number;
  h: number;
  type: BlockType;
  hue: number;
  sat?: number;
  lum?: number;
  seed: number;
  /** Ausrichtung der Struktur (SRAM-Zeilen, Standardzellen-Reihen) */
  vertical?: boolean;
  name?: string;
}
export interface Die {
  w: number;
  h: number;
  blocks: Block[];
  base: string;
}

let seedC = 1;
const B = (x: number, y: number, w: number, h: number, type: BlockType, hue: number, extra: Partial<Block> = {}): Block => ({ x, y, w, h, type, hue, seed: seedC++ * 7919, ...extra });

function hsl(h: number, s: number, l: number, a = 1) {
  return `hsla(${h.toFixed(1)},${(s * 100).toFixed(1)}%,${(l * 100).toFixed(1)}%,${a})`;
}

/** Ein Prozessorkern (Leistungskern) mit Unterblöcken – Koordinaten relativ zur Kern-Ecke. */
function pCore(x: number, y: number, w: number, h: number, flip: boolean, name: string): Block[] {
  const fy = (yy: number, hh: number) => (flip ? y + h - yy - hh : y + yy);
  const bl: Block[] = [];
  // L2-Cache (nahe am Ring)
  bl.push(B(x + 0.05, fy(h * 0.62, h * 0.36), w - 0.1, h * 0.36, 'sram', 262, { name: `${name}:l2` }));
  // Rechenwerke, Steuerung, L1
  bl.push(B(x + 0.05, fy(0.05, h * 0.3), w * 0.55, h * 0.3, 'logic', 38, { name: `${name}:exec` }));
  bl.push(B(x + w * 0.62, fy(0.05, h * 0.3), w * 0.33, h * 0.14, 'sram', 280, { name: `${name}:l1d` }));
  bl.push(B(x + w * 0.62, fy(0.05 + h * 0.16, h * 0.14), w * 0.33, h * 0.14, 'sram', 270, { name: `${name}:l1i` }));
  bl.push(B(x + 0.05, fy(h * 0.36, h * 0.24), w * 0.42, h * 0.24, 'logic', 28, { name: `${name}:fpu`, vertical: true }));
  bl.push(B(x + w * 0.49, fy(h * 0.36, h * 0.24), w * 0.46, h * 0.24, 'logic', 48, { name: `${name}:ooo` }));
  return bl;
}

function makeCpuDie(): Die {
  seedC = 11;
  const W = 23.8;
  const H = 10.8;
  const bl: Block[] = [];
  bl.push(B(0, 0, W, H, 'seal', 220));
  bl.push(B(0.35, 0.35, 1.9, H - 0.7, 'phy', 140, { name: 'mem' }));
  const cw = 2.25;
  const ch = 4.15;
  for (let i = 0; i < 4; i++) {
    bl.push(...pCore(2.45 + i * (cw + 0.08), 0.35, cw, ch, false, `p${i}`));
    bl.push(...pCore(2.45 + i * (cw + 0.08), H - 0.35 - ch, cw, ch, true, `p${i + 4}`));
  }
  const ex = 2.45 + 4 * (cw + 0.08);
  for (let i = 0; i < 2; i++) {
    for (const top of [true, false]) {
      const y0 = top ? 0.35 : H - 0.35 - ch;
      bl.push(B(ex + i * 2.08, y0 + (top ? 0 : ch * 0.55), 2.0, ch * 0.45, 'sram', 250, { name: 'ecl2' }));
      for (let k = 0; k < 4; k++) bl.push(B(ex + i * 2.08 + (k % 2) * 1.0, y0 + (top ? ch * 0.48 : 0) + Math.floor(k / 2) * (ch * 0.26), 0.98, ch * 0.25, 'logic', 52, { name: 'ecore' }));
    }
  }
  // Ring und L3
  const ringY = 0.35 + ch + 0.05;
  const ringH = H - 0.7 - 2 * ch - 0.1;
  for (let i = 0; i < 12; i++) bl.push(B(2.45 + i * 1.1, ringY, 1.06, ringH, 'sram', 205, { name: 'l3' }));
  bl.push(B(2.4, ringY + ringH / 2 - 0.06, ex + 4.2 - 2.4, 0.12, 'route', 0));
  // Grafik
  const gx = ex + 4.25;
  const gw = 5.4;
  for (let i = 0; i < 4; i++) for (let j = 0; j < 6; j++) bl.push(B(gx + i * (gw / 4), 0.4 + j * ((H - 0.8) / 6), gw / 4 - 0.05, (H - 0.8) / 6 - 0.05, 'eu', 170 + (j % 2) * 10, { name: 'gpu' }));
  bl.push(B(gx + gw + 0.1, 0.35, W - gx - gw - 0.45, H * 0.45, 'logic', 20, { name: 'disp' }));
  bl.push(B(gx + gw + 0.1, 0.4 + H * 0.45, W - gx - gw - 0.45, H * 0.53 - 0.75, 'analog', 120, { name: 'io' }));
  return { w: W, h: H, blocks: bl, base: '#2a2338' };
}

function makeGpuDie(): Die {
  seedC = 300;
  const W = 24.6;
  const H = 24.8;
  const bl: Block[] = [];
  bl.push(B(0, 0, W, H, 'seal', 220));
  // Speicher-PHYs am Rand
  for (let i = 0; i < 6; i++) {
    bl.push(B(0.35, 1 + i * 3.8, 1.6, 3.6, 'phy', 140, { name: 'gphy' }));
    bl.push(B(W - 1.95, 1 + i * 3.8, 1.6, 3.6, 'phy', 140, { name: 'gphy' }));
  }
  const gx0 = 2.1;
  const gw = (W - 4.2) / 6;
  const gh = 9.6;
  for (let i = 0; i < 6; i++) {
    for (const top of [true, false]) {
      const y0 = top ? 0.4 : H - 0.4 - gh;
      // GPC: 6 TPC × 2 SM
      for (let s = 0; s < 12; s++) {
        const cx = gx0 + i * gw + (s % 2) * (gw / 2) + 0.04;
        const cy = y0 + Math.floor(s / 2) * (gh / 6) + 0.04;
        const sm = { x: cx, y: cy, w: gw / 2 - 0.08, h: gh / 6 - 0.08 };
        bl.push(...smBlocks(sm.x, sm.y, sm.w, sm.h, `sm${i}${top ? 't' : 'b'}${s}`));
      }
    }
  }
  // L2-Cache in der Mitte
  for (let i = 0; i < 12; i++) bl.push(B(gx0 + i * ((W - 4.2) / 12), 10.15, (W - 4.2) / 12 - 0.06, H - 20.3, 'sram', 210, { name: 'gl2' }));
  bl.push(B(gx0, H / 2 - 0.12, W - 4.2, 0.24, 'route', 0));
  return { w: W, h: H, blocks: bl, base: '#25213a' };
}

/** Streaming-Multiprozessor: Registerdateien, Rechenkerne, Tensor-Kerne, L1/Shared Memory. */
function smBlocks(x: number, y: number, w: number, h: number, name: string): Block[] {
  const bl: Block[] = [];
  const pw = w / 4;
  for (let p = 0; p < 4; p++) {
    bl.push(B(x + p * pw + 0.01, y + 0.01, pw - 0.02, h * 0.32, 'sram', 268, { name: `${name}:rf` }));
    bl.push(B(x + p * pw + 0.01, y + h * 0.34, pw - 0.02, h * 0.22, 'logic', 34, { name: `${name}:alu`, vertical: true }));
    bl.push(B(x + p * pw + 0.01, y + h * 0.57, pw - 0.02, h * 0.14, 'logic', 330, { name: `${name}:tensor` }));
  }
  bl.push(B(x + 0.01, y + h * 0.73, w * 0.7, h * 0.26, 'sram', 248, { name: `${name}:l1` }));
  bl.push(B(x + w * 0.72, y + h * 0.73, w * 0.27, h * 0.26, 'logic', 58, { name: `${name}:tex` }));
  return bl;
}

function makeDramDie(): Die {
  seedC = 600;
  const W = 10.2;
  const H = 6.6;
  const bl: Block[] = [];
  bl.push(B(0, 0, W, H, 'seal', 220));
  const spineH = 0.8;
  const qh = (H - 0.7 - spineH) / 2;
  for (let q = 0; q < 2; q++) {
    const y0 = 0.35 + q * (qh + spineH);
    for (let i = 0; i < 8; i++)
      for (let j = 0; j < 2; j++) {
        const bw = (W - 0.7) / 8;
        const bh = qh / 2;
        bl.push(B(0.35 + i * bw + 0.03, y0 + j * bh + 0.03, bw - 0.06, bh - 0.06, 'array', 196 + ((i + j) % 2) * 6, { name: 'bank' }));
      }
  }
  bl.push(B(0.35, 0.35 + qh + 0.05, W - 0.7, spineH - 0.1, 'logic', 40, { name: 'periph' }));
  for (let i = 0; i < 24; i++) bl.push(B(0.6 + i * ((W - 1.2) / 23) - 0.06, H / 2 - 0.06, 0.12, 0.12, 'pad', 45, { name: 'pad' }));
  return { w: W, h: H, blocks: bl, base: '#1f2a36' };
}

function makeNandDie(): Die {
  seedC = 900;
  const W = 11;
  const H = 7.4;
  const bl: Block[] = [];
  bl.push(B(0, 0, W, H, 'seal', 220));
  const pw = (W - 0.9) / 4;
  for (let i = 0; i < 4; i++) {
    bl.push(B(0.35 + i * (pw + 0.07), 0.35, pw, H - 1.9, 'array', 168, { name: 'plane' }));
    bl.push(B(0.35 + i * (pw + 0.07), H - 1.5, pw, 0.45, 'logic', 40, { name: 'pagebuf' }));
  }
  bl.push(B(0.35, H - 1.0, W - 0.7, 0.65, 'analog', 120, { name: 'periph' }));
  for (let i = 0; i < 30; i++) bl.push(B(0.5 + i * 0.34, H - 0.32, 0.16, 0.16, 'pad', 45));
  return { w: W, h: H, blocks: bl, base: '#1d2a2a' };
}

/** Chipsatz (PCH): Rand voller Schnittstellen (PCIe, USB, SATA, Netzwerk, Audio), innen Steuerlogik und Puffer. */
function makePchDie(): Die {
  seedC = 1200;
  const W = 9;
  const H = 7.5;
  const bl: Block[] = [];
  bl.push(B(0, 0, W, H, 'seal', 220));
  bl.push(B(0.35, 0.35, 1.0, H - 0.7, 'phy', 140, { name: 'pcie' }));
  for (let i = 0; i < 10; i++) bl.push(B(1.5 + i * 0.71, 0.35, 0.66, 0.75, 'phy', 160 + (i % 2) * 8, { name: 'usbphy' }));
  bl.push(B(1.5, H - 1.1, 2.95, 0.75, 'phy', 128, { name: 'sata' }));
  bl.push(B(4.55, H - 1.1, 1.95, 0.75, 'analog', 100, { name: 'lan' }));
  bl.push(B(6.6, H - 1.1, 2.05, 0.75, 'analog', 80, { name: 'audio' }));
  bl.push(B(W - 1.1, 1.25, 0.75, H - 2.5, 'phy', 140, { name: 'dmi' }));
  bl.push(B(1.5, 1.25, 2.8, 2.45, 'logic', 36, { name: 'usb' }));
  bl.push(B(4.4, 1.25, 3.35, 1.75, 'logic', 50, { name: 'sactl' }));
  bl.push(B(4.4, 3.1, 1.6, 1.6, 'logic', 22, { name: 'me' }));
  bl.push(B(6.1, 3.1, 1.65, 1.6, 'sram', 262, { name: 'mesram' }));
  bl.push(B(1.5, 3.8, 2.8, 2.45, 'sram', 240, { name: 'buf' }));
  bl.push(B(4.4, 4.8, 3.35, 1.45, 'logic', 42, { name: 'periph' }));
  return { w: W, h: H, blocks: bl, base: '#262236' };
}

export const CPU_DIE = makeCpuDie();
export const PCH_DIE = makePchDie();
export const GPU_DIE = makeGpuDie();
export const DRAM_DIE = makeDramDie();
export const NAND_DIE = makeNandDie();

export function findBlock(d: Die, name: string): Block {
  const b = d.blocks.find((x) => x.name === name);
  if (!b) throw new Error(`Block ${name} fehlt`);
  return b;
}

const hash = (a: number, b: number, c: number) => (((a * 73856093) ^ (b * 19349663) ^ (c * 83492791)) >>> 0) % 2147483647;

/**
 * Zeichnet den Ausschnitt [x0,x1] × [y0,y1] (mm) eines Chips in eine Leinwand w × h.
 */
export function drawDie(g: CanvasRenderingContext2D, die: Die, x0: number, y0: number, x1: number, y1: number, w: number, h: number) {
  const s = w / (x1 - x0);
  const X = (x: number) => (x - x0) * s;
  const Y = (y: number) => (y - y0) * s;
  g.fillStyle = die.base;
  g.fillRect(0, 0, w, h);
  for (const b of die.blocks) {
    if (b.x > x1 || b.x + b.w < x0 || b.y > y1 || b.y + b.h < y0) continue;
    const bx0 = Math.max(b.x, x0);
    const by0 = Math.max(b.y, y0);
    const bx1 = Math.min(b.x + b.w, x1);
    const by1 = Math.min(b.y + b.h, y1);
    g.save();
    g.beginPath();
    g.rect(X(bx0), Y(by0), (bx1 - bx0) * s, (by1 - by0) * s);
    g.clip();
    drawBlock(g, b, bx0, by0, bx1, by1, s, X, Y);
    g.restore();
  }
  // Interferenz-Schimmer über dem ganzen Chip
  const grd = g.createLinearGradient(X(0), Y(0), X(die.w), Y(die.h));
  grd.addColorStop(0, 'rgba(255,120,200,0.06)');
  grd.addColorStop(0.35, 'rgba(120,200,255,0.05)');
  grd.addColorStop(0.7, 'rgba(255,220,120,0.06)');
  grd.addColorStop(1, 'rgba(140,255,170,0.05)');
  g.fillStyle = grd;
  g.fillRect(0, 0, w, h);
}

function drawBlock(
  g: CanvasRenderingContext2D,
  b: Block,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  s: number,
  X: (x: number) => number,
  Y: (y: number) => number,
) {
  const sat = b.sat ?? 0.24;
  const lum = b.lum ?? 0.4;
  const rx = X(b.x);
  const ry = Y(b.y);
  const rw = b.w * s;
  const rh = b.h * s;
  switch (b.type) {
    case 'seal': {
      g.fillStyle = hsl(220, 0.08, 0.3);
      g.fillRect(rx, ry, rw, rh);
      g.fillStyle = hsl(240, 0.15, 0.2);
      const m = 0.12 * s;
      g.fillRect(rx + m, ry + m, rw - 2 * m, rh - 2 * m);
      // Bondpads/Bumps am Rand
      const pitch = 0.15;
      if (pitch * s > 3) {
        g.fillStyle = hsl(40, 0.25, 0.55);
        for (let x = Math.ceil(x0 / pitch) * pitch; x < x1; x += pitch) {
          g.fillRect(X(x), ry + 0.03 * s, 0.07 * s, 0.07 * s);
          g.fillRect(X(x), ry + rh - 0.1 * s, 0.07 * s, 0.07 * s);
        }
      }
      return;
    }
    case 'route':
      g.fillStyle = hsl(230, 0.2, 0.14);
      g.fillRect(rx, ry, rw, rh);
      if (0.01 * s > 1.2) {
        g.fillStyle = hsl(30, 0.3, 0.45, 0.6);
        for (let y = b.y; y < b.y + b.h; y += 0.012) g.fillRect(X(x0), Y(y), (x1 - x0) * s, Math.max(0.8, 0.004 * s));
      }
      return;
    case 'pad':
      g.fillStyle = hsl(44, 0.55, 0.62);
      g.fillRect(rx, ry, rw, rh);
      g.strokeStyle = hsl(40, 0.4, 0.35);
      g.lineWidth = Math.max(1, 0.01 * s);
      g.strokeRect(rx, ry, rw, rh);
      return;
  }
  // Grundfarbe
  g.fillStyle = hsl(b.hue, sat, lum);
  g.fillRect(rx, ry, rw, rh);

  if (b.type === 'sram' || b.type === 'array') {
    // Unterfelder mit Dekoder-Streifen, darin Zellzeilen
    const sub = b.type === 'array' ? 0.09 : 0.06;
    const nx = Math.max(1, Math.round(b.w / sub));
    const ny = Math.max(1, Math.round(b.h / (sub * 1.6)));
    const sw = b.w / nx;
    const sh = b.h / ny;
    for (let i = 0; i < nx; i++) {
      const cx = b.x + i * sw;
      if (cx > x1 || cx + sw < x0) continue;
      for (let j = 0; j < ny; j++) {
        const cy = b.y + j * sh;
        if (cy > y1 || cy + sh < y0) continue;
        const r = rng(hash(b.seed, i, j));
        g.fillStyle = hsl(b.hue + r.range(-6, 6), sat + 0.05, lum + r.range(-0.03, 0.05));
        g.fillRect(X(cx + sw * 0.06), Y(cy + sh * 0.06), sw * 0.82 * s, sh * 0.8 * s);
        // Dekoder (Logik) als dunkle Streifen
        g.fillStyle = hsl(b.hue + 30, 0.25, lum - 0.16);
        g.fillRect(X(cx + sw * 0.88), Y(cy), sw * 0.12 * s, sh * s);
        // Zellzeilen
        const row = b.type === 'array' ? 0.0008 : 0.0012;
        const fine = 0.000092;
        if (b.type === 'array' && fine * s > 1.4) {
          g.fillStyle = hsl(b.hue + 40, 0.45, lum + 0.2, 0.35);
          const xa = Math.max(cx, x0);
          const xb = Math.min(cx + sw * 0.88, x1);
          for (let x = Math.ceil(xa / fine) * fine; x < xb; x += fine) g.fillRect(X(x), Y(Math.max(cy, y0)), Math.max(0.6, fine * 0.35 * s), (Math.min(cy + sh, y1) - Math.max(cy, y0)) * s);
        }
        const ps = row * s;
        if (ps > 1.6) {
          g.fillStyle = hsl(b.hue + 20, 0.4, lum + 0.12, 0.5);
          const ya = Math.max(cy, y0);
          const yb = Math.min(cy + sh * 0.86, y1);
          for (let y = Math.ceil(ya / row) * row; y < yb; y += row * 2) g.fillRect(X(cx + sw * 0.06), Y(y), sw * 0.82 * s, ps);
        } else if (sh * s > 6) {
          g.fillStyle = hsl(b.hue + 20, 0.4, lum + 0.12, 0.25);
          g.fillRect(X(cx + sw * 0.06), Y(cy + sh * 0.06), sw * 0.82 * s, sh * 0.8 * s);
        }
      }
    }
    return;
  }

  if (b.type === 'phy' || b.type === 'analog') {
    const n = Math.round(b.h / 0.22);
    for (let j = 0; j < n; j++) {
      const cy = b.y + (j * b.h) / n;
      if (cy > y1 || cy + b.h / n < y0) continue;
      const r = rng(hash(b.seed, 0, j));
      g.fillStyle = hsl(b.hue + r.range(-15, 15), 0.3, lum + r.range(-0.08, 0.06));
      g.fillRect(rx + rw * 0.05, Y(cy + 0.02), rw * 0.9, (b.h / n - 0.04) * s);
      if (0.02 * s > 2) {
        g.fillStyle = hsl(40, 0.4, 0.55, 0.7);
        for (let k = 0; k < 6; k++) g.fillRect(rx + rw * (0.1 + k * 0.14), Y(cy + 0.05), rw * 0.08, (b.h / n - 0.1) * s);
      }
    }
    return;
  }

  if (b.type === 'eu') {
    const n = 4;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        const r = rng(hash(b.seed, i, j));
        g.fillStyle = hsl(b.hue + r.range(-10, 10), 0.3, lum + r.range(-0.06, 0.08));
        g.fillRect(rx + (rw / n) * (i + 0.06), ry + (rh / n) * (j + 0.06), (rw / n) * 0.88, (rh / n) * 0.88);
      }
    drawLogicNoise(g, b, x0, y0, x1, y1, s, X, Y, 0.35);
    return;
  }

  // Logik
  drawLogicNoise(g, b, x0, y0, x1, y1, s, X, Y, 1);
}

/** Standardzellen-Rauschen in drei Größenordnungen (Makroblöcke, Zellgruppen, Zellen). */
function drawLogicNoise(
  g: CanvasRenderingContext2D,
  b: Block,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  s: number,
  X: (x: number) => number,
  Y: (y: number) => number,
  amount: number,
) {
  const sat = b.sat ?? 0.32;
  const lum = b.lum ?? 0.42;
  const levels = [
    { c: 0.25, a: 0.5, n: 3 },
    { c: 0.05, a: 0.35, n: 4 },
    { c: 0.01, a: 0.3, n: 4 },
    { c: 0.002, a: 0.25, n: 3 },
  ];
  for (const lv of levels) {
    if (lv.c * s < 3) {
      continue;
    }
    const i0 = Math.floor(Math.max(b.x, x0) / lv.c);
    const i1 = Math.ceil(Math.min(b.x + b.w, x1) / lv.c);
    const j0 = Math.floor(Math.max(b.y, y0) / lv.c);
    const j1 = Math.ceil(Math.min(b.y + b.h, y1) / lv.c);
    if ((i1 - i0) * (j1 - j0) > 120000) continue;
    for (let i = i0; i < i1; i++)
      for (let j = j0; j < j1; j++) {
        const r = rng(hash(b.seed + lv.c * 1e4, i, j));
        for (let k = 0; k < lv.n; k++) {
          if (!r.chance(0.7 * amount)) continue;
          const w = lv.c * r.range(0.2, 1.1);
          const h = b.vertical ? lv.c * r.range(0.6, 1.4) : lv.c * r.range(0.12, 0.4);
          const x = i * lv.c + r.range(0, lv.c - w * 0.5);
          const y = j * lv.c + r.range(0, lv.c - h * 0.5);
          g.fillStyle = hsl(b.hue + r.range(-22, 22), sat + r.range(-0.1, 0.12), lum + r.range(-0.12, 0.12), lv.a);
          g.fillRect(X(x), Y(y), w * s, h * s);
        }
      }
  }
  // Reihenstruktur (Standardzellen sind in Reihen gleicher Höhe angeordnet)
  const rowH = 0.0003;
  if (rowH * s > 2) {
    g.fillStyle = 'rgba(0,0,0,0.18)';
    for (let y = Math.ceil(y0 / rowH) * rowH; y < y1; y += rowH) g.fillRect(X(x0), Y(y), (x1 - x0) * s, Math.max(0.7, rowH * 0.08 * s));
  }
}
