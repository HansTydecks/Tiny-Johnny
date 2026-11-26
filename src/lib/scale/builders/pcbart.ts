/**
 * Leiterbahnen, Durchkontaktierungen und Bestückungsdruck der Platine als Vektordaten.
 * Geführt wie auf echten Platinen: Busse mit 45°-Ecken, Speicherleitungen in Byte-Gruppen mit Längenausgleich
 * (Mäander), Differenzpaare für PCIe/USB/SATA, Fan-out unter Chips, Stitching-Vias am Rand.
 * Dieselben Daten werden für die ganze Platine (grob) und für jeden Zoom-Ausschnitt (fein) gezeichnet.
 */
import { BOARD, CPU, DIMM, M2, PCIE1_Z, PCH } from './layout';
import { rng } from './kit';

type P = [number, number];
export interface Trace {
  pts: P[];
  w: number;
}
export interface Silk {
  kind: 'text' | 'rect' | 'dot' | 'line';
  x: number;
  z: number;
  w?: number;
  d?: number;
  s?: string;
  size?: number;
  rot?: number;
  x2?: number;
  z2?: number;
}

export const TRACES: Trace[] = [];
/** [x, z, Restring-Radius] */
export const VIAS: [number, number, number][] = [];
export const POURS: P[][] = [];
/** vergoldete Testpunkte [x, z, r] */
export const TESTPTS: [number, number, number][] = [];
/** Vias in Kupferflächen mit Wärmefalle */
export const RELIEFS: [number, number][] = [];
export const SILK: Silk[] = [];

const HW = BOARD.w / 2;
const HD = BOARD.d / 2;
const sgn = (x: number) => (x < 0 ? -1 : 1);

/** Weg von a nach b: gerade Strecke (h = waagrecht, v = senkrecht) plus 45°-Stück. */
function bend(a: P, b: P, first: 'h' | 'v' = 'h'): P[] {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const ax = Math.abs(dx);
  const az = Math.abs(dz);
  if (ax < 1e-6 || az < 1e-6 || Math.abs(ax - az) < 1e-6) return [a, b];
  if (first === 'h') {
    // waagrecht, dann schräg – oder schräg, dann senkrecht
    return ax > az ? [a, [b[0] - sgn(dx) * az, a[1]], b] : [a, [b[0], a[1] + sgn(dz) * ax], b];
  }
  return az > ax ? [a, [a[0], b[1] - sgn(dz) * ax], b] : [a, [a[0] + sgn(dx) * az, b[1]], b];
}

/** Mehrere Wegpunkte zu einer Linie mit 45°-Ecken verbinden. */
function path(points: P[], first: 'h' | 'v' = 'h'): P[] {
  const out: P[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const seg = bend(points[i - 1], points[i], first);
    out.push(...seg.slice(1));
  }
  return dedupe(out);
}
function dedupe(pts: P[]): P[] {
  return pts.filter((p, i) => i === 0 || Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) > 1e-6);
}

/** Linie seitlich versetzen (mit Gehrung an den Ecken) – so bleiben parallele Leitungen parallel. */
function offset(pts: P[], d: number): P[] {
  const n = pts.length;
  const out: P[] = [];
  const norm = (a: P, b: P): P => {
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const l = Math.hypot(dx, dz) || 1;
    return [-dz / l, dx / l];
  };
  for (let i = 0; i < n; i++) {
    const n0 = i > 0 ? norm(pts[i - 1], pts[i]) : norm(pts[0], pts[1]);
    const n1 = i < n - 1 ? norm(pts[i], pts[i + 1]) : n0;
    let mx = n0[0] + n1[0];
    let mz = n0[1] + n1[1];
    const ml = Math.hypot(mx, mz) || 1;
    mx /= ml;
    mz /= ml;
    const cos = mx * n1[0] + mz * n1[1];
    const k = d / Math.max(0.5, cos);
    out.push([pts[i][0] + mx * k, pts[i][1] + mz * k]);
  }
  return out;
}

/** Mäander (Längenausgleich) auf dem längsten geraden Abschnitt einfügen. */
function meander(pts: P[], amp: number, pitch: number, count: number): P[] {
  let best = -1;
  let bl = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const l = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
    const axis = Math.abs(pts[i + 1][0] - pts[i][0]) < 1e-6 || Math.abs(pts[i + 1][1] - pts[i][1]) < 1e-6;
    if (axis && l > bl) {
      bl = l;
      best = i;
    }
  }
  if (best < 0 || bl < pitch * (count + 2)) return pts;
  const a = pts[best];
  const b = pts[best + 1];
  const ux = (b[0] - a[0]) / bl;
  const uz = (b[1] - a[1]) / bl;
  const nx = -uz;
  const nz = ux;
  const start = (bl - pitch * count) / 2;
  const mid: P[] = [];
  for (let k = 0; k < count; k++) {
    const s0 = start + k * pitch;
    const s1 = s0 + pitch / 2;
    const p0: P = [a[0] + ux * s0, a[1] + uz * s0];
    const p1: P = [a[0] + ux * s1, a[1] + uz * s1];
    mid.push(p0, [p0[0] + nx * amp, p0[1] + nz * amp], [p1[0] + nx * amp, p1[1] + nz * amp], p1);
  }
  return [...pts.slice(0, best + 1), ...mid, ...pts.slice(best + 1)];
}

/**
 * Bus: n Leitungen entlang einer Mittellinie. `groups` teilt in Gruppen (z. B. Byte-Gruppen) mit größerem Abstand;
 * `pairs` führt jeweils zwei Leitungen eng als Differenzpaar.
 */
function bus(center: P[], o: { n: number; pitch: number; w: number; groups?: number; gap?: number; pairs?: boolean; meander?: boolean; viaEnds?: boolean }) {
  const offs: number[] = [];
  let cur = 0;
  for (let i = 0; i < o.n; i++) {
    offs.push(cur);
    const endGroup = o.groups && (i + 1) % o.groups === 0;
    cur += o.pairs ? (i % 2 === 0 ? o.w * 2.2 : o.pitch) : endGroup ? (o.gap ?? o.pitch * 3) : o.pitch;
  }
  const mid = (offs[0] + offs[offs.length - 1]) / 2;
  offs.forEach((d, i) => {
    let pts = offset(center, d - mid);
    if (o.meander && o.groups && (i + 1) % o.groups === 0 && i < o.n - 1) pts = meander(pts, ((o.gap ?? 1) - o.w) * 0.55, o.pitch * 3.2, 5);
    TRACES.push({ pts, w: o.w });
    if (o.viaEnds !== false) {
      VIAS.push([pts[0][0], pts[0][1], o.w * 1.6 + 0.12]);
      VIAS.push([pts[pts.length - 1][0], pts[pts.length - 1][1], o.w * 1.6 + 0.12]);
    }
  });
}

/** Fan-out um einen Chip: Pad → kurze Leitung nach außen → 45° → Via. */
function fanout(cx: number, cz: number, w: number, d: number, pitch: number, len = 1.1) {
  const sides: { o: P; along: P; out: P; L: number }[] = [
    { o: [cx - w / 2, cz - d / 2], along: [1, 0], out: [0, -1], L: w },
    { o: [cx - w / 2, cz + d / 2], along: [1, 0], out: [0, 1], L: w },
    { o: [cx - w / 2, cz - d / 2], along: [0, 1], out: [-1, 0], L: d },
    { o: [cx + w / 2, cz - d / 2], along: [0, 1], out: [1, 0], L: d },
  ];
  for (const sd of sides) {
    let k = 0;
    for (let s = pitch; s < sd.L - pitch / 2; s += pitch, k++) {
      const p: P = [sd.o[0] + sd.along[0] * s, sd.o[1] + sd.along[1] * s];
      const q: P = [p[0] + sd.out[0] * len * 0.5, p[1] + sd.out[1] * len * 0.5];
      const side = k % 2 ? 1 : -1;
      const v: P = [q[0] + (sd.out[0] + sd.along[0] * side) * len * 0.5, q[1] + (sd.out[1] + sd.along[1] * side) * len * 0.5];
      TRACES.push({ pts: [p, q, v], w: 0.12 });
      VIAS.push([v[0], v[1], 0.28]);
    }
  }
}

(function generate() {
  const r = rng(1702);
  const sockR = CPU.x + 24;
  const sockB = CPU.z + 29;
  const sockL = CPU.x - 24;

  // ── Kupferflächen (Masse/Versorgung)
  POURS.push(
    [[-120, -150], [-48, -150], [-48, -122], [-82, -122], [-86, -118], [-86, -14], [-120, -14]],
    [[-46, -122], [30, -122], [34, -118], [34, -100], [-46, -100]],
    [[98, -92], [119, -92], [119, -28], [98, -28]],
    [[-120, 90], [-62, 90], [-62, 150], [-120, 150]],
    [[56, 108], [92, 108], [92, 150], [56, 150]],
  );
  for (let x = -112; x < -90; x += 4) for (let z = -140; z < -20; z += 6) RELIEFS.push([x + (z % 12 ? 2 : 0), z]);
  for (let x = -40; x < 28; x += 6) RELIEFS.push([x, -118], [x + 3, -104]);

  // ── Spannungswandler → Sockel: breite Leitungen
  for (let i = 0; i < 8; i++) {
    const x = -52 + i * 11.5;
    TRACES.push({ pts: path([[x, -106], [x, -99], [x * 0.7 - 2, -96]], 'v'), w: 2.4 });
  }
  for (let i = 0; i < 7; i++) {
    const z = -100 + i * 11.5;
    TRACES.push({ pts: path([[-69, z], [-60, z], [sockL - 1, z * 0.9 - 6]]), w: 2.4 });
  }
  TRACES.push({ pts: path([[-60, -141], [-60, -128], [-52, -120]], 'v'), w: 3.2 });
  TRACES.push({ pts: path([[106, -80], [94, -80], [80, -66], [60, -66]]), w: 2.6 });

  // ── CPU → RAM: zwei Kanäle, je 4 Byte-Gruppen à 8 Leitungen, mit Mäandern
  bus(path([[sockR, -101], [30, -101], [36, -107], [DIMM.slotsX[0] - 2, -107]]), { n: 32, pitch: 0.3, w: 0.1, groups: 8, gap: 1.4, meander: true });
  bus(path([[sockR, -54], [28, -54], [34, -48], [DIMM.slotsX[0] - 2, -48]]), { n: 32, pitch: 0.3, w: 0.1, groups: 8, gap: 1.4, meander: true });
  // Adress-/Steuerleitungen (Fly-by) zwischen den Kanälen
  bus(path([[sockR, -78], [DIMM.slotsX[0] - 2, -78]]), { n: 14, pitch: 0.35, w: 0.1 });

  // ── CPU → PCIe x16: 16 Differenzpaare
  bus(path([[CPU.x - 12, sockB + 1], [CPU.x - 12, -6], [-46, PCIE1_Z - 20], [-46, PCIE1_Z - 5]], 'v'), { n: 32, pitch: 0.75, w: 0.1, pairs: true });
  // ── CPU → M.2: 4 Paare
  bus(path([[CPU.x - 22, sockB + 1], [CPU.x - 22, sockB + 4], [M2.x0 - 4, M2.z - 12], [M2.x0 - 4, M2.z - 4]], 'v'), { n: 8, pitch: 0.7, w: 0.1, pairs: true });
  // ── CPU → Chipsatz (DMI): 8 Paare
  bus(path([[CPU.x + 18, sockB + 1], [CPU.x + 18, 26], [40, 52], [PCH.x - 16, 52], [PCH.x - 14, 60]], 'v'), { n: 16, pitch: 0.75, w: 0.1, pairs: true });

  // ── Chipsatz → Peripherie
  const px = PCH.x;
  const pz = PCH.z;
  bus(path([[px + 12, pz + 13], [px + 12, 104], [px + 20, 112], [px + 20, 117]], 'v'), { n: 8, pitch: 0.7, w: 0.1, pairs: true }); // SATA
  bus(path([[px + 12, pz - 13], [px + 12, 40], [px + 22, 30], [px + 22, 26]], 'v'), { n: 8, pitch: 0.7, w: 0.1, pairs: true }); // USB-Header
  bus(path([[px - 13, pz - 6], [40, pz - 6], [28, 56], [-68, 56], [-70, 52]]), { n: 4, pitch: 0.7, w: 0.1, pairs: true }); // PCIe x1 #1
  bus(path([[px - 8, pz + 13], [px - 8, 112], [px - 14, 118], [-58, 118], [-66, 126], [-68, 130]], 'v'), { n: 4, pitch: 0.7, w: 0.1, pairs: true }); // PCIe x1 #2
  bus(path([[px - 13, pz + 6], [66, pz + 6], [56, 98], [0, 98], [-6, 104], [-6, 120]]), { n: 6, pitch: 0.4, w: 0.1 }); // BIOS (SPI)
  bus(path([[px - 13, pz + 10], [64, pz + 10], [58, 104], [-70, 104], [-78, 110]]), { n: 6, pitch: 0.4, w: 0.12 }); // Audio
  // Lüfter-/Frontpanel-Anschlüsse
  bus(path([[30, -143], [30, -132], [20, -122], [20, -118]], 'v'), { n: 4, pitch: 0.5, w: 0.15 });
  bus(path([[79, 144], [79, 136], [px - 4, 128], [px - 4, pz + 18]], 'v'), { n: 6, pitch: 0.5, w: 0.15 });
  bus(path([[-112, 64], [-100, 64], [-92, 56], [-80, 56]]), { n: 4, pitch: 0.5, w: 0.15 });

  // ── Fan-out unter Chips
  fanout(px, pz, PCH.sub + 1, PCH.sub + 1, 1.0);
  fanout(-10, 124, 6, 5, 1.27, 0.9);
  fanout(-84, 112, 12, 12, 0.8);
  for (let i = -11; i <= 11; i++) {
    VIAS.push([CPU.x + i * 2, CPU.z - 31, 0.28], [CPU.x + i * 2, CPU.z + 31, 0.28]);
  }
  for (let j = -13; j <= 13; j++) VIAS.push([CPU.x - 26, CPU.z + j * 2, 0.28], [CPU.x + 26, CPU.z + j * 2, 0.28]);

  // ── Stitching-Vias am Rand
  for (let x = -HW + 4; x <= HW - 4; x += 5) VIAS.push([x, -HD + 2.6, 0.3], [x, HD - 2.6, 0.3]);
  for (let z = -HD + 4; z <= HD - 4; z += 5) VIAS.push([-HW + 2.6, z, 0.3], [HW - 2.6, z, 0.3]);

  // ── kurze Verbindungen bei den Kleinteilen (45°)
  for (let i = 0; i < 70; i++) {
    const a: P = [r.range(-HW + 10, HW - 10), r.range(-HD + 10, HD - 10)];
    const b: P = [a[0] + r.range(-7, 7), a[1] + r.range(-7, 7)];
    TRACES.push({ pts: path([a, b], r.chance(0.5) ? 'h' : 'v'), w: r.pick([0.12, 0.15, 0.2]) });
    VIAS.push([a[0], a[1], 0.3], [b[0], b[1], 0.3]);
  }
  // ── Testpunkte
  for (let i = 0; i < 26; i++) TESTPTS.push([r.range(-HW + 10, HW - 10), r.range(-HD + 10, HD - 10), 0.5]);

  // ── Bestückungsdruck
  const T = (s: string, x: number, z: number, size = 2.2, rot = 0) => SILK.push({ kind: 'text', s, x, z, size, rot });
  const R = (x: number, z: number, w: number, d: number) => SILK.push({ kind: 'rect', x, z, w, d });
  T('TINY JOHNNY  TJ-Z1 ATX', 10, 142, 4.2);
  T('REV 1.02', 86, 142, 2.4);
  T('CPU1', CPU.x - 24, CPU.z + 34, 2.6);
  T('LGA1851', CPU.x + 14, CPU.z + 34, 2.0);
  DIMM.slotsX.forEach((x, i) => T(`DDR5_${'AB'[i >> 1]}${(i % 2) + 1}`, x, 14, 1.8, -Math.PI / 2));
  T('M2_1', M2.x0 + 6, M2.z + 14, 2.2);
  T('PCIEX16_1', -100, PCIE1_Z + 7, 2.2);
  T('PCIEX1_1', -100, 52 + 6, 2.0);
  T('PCIEX16_2', -100, 92 + 7, 2.0);
  T('CPU_FAN', 30, -150, 1.8);
  T('EPS_12V', -60, -137, 1.8);
  T('ATX_PWR', 104, -96, 1.8, -Math.PI / 2);
  T('SATA6G_1-4', 104, 112, 1.8);
  T('PCH', PCH.x - 14, PCH.z + 21, 2.0);
  T('BAT', 40, 112, 1.8);
  T('CLR_CMOS', 60, 136, 1.4);
  T('BIOS', -10, 129, 1.6);
  T('AUDIO', -108, 85, 2.0);
  T('USB3_E1', 104, 34, 1.6);
  T('F_PANEL', 80, 150, 1.6);
  T('SYS_FAN1', -118, 70, 1.4, -Math.PI / 2);
  T('Designed for learning', -70, 148, 1.8);
  R(CPU.x, CPU.z, 54, 62);
  R(M2.x0 + M2.len / 2, M2.z, M2.len + 4, M2.w + 3);
  R(40, 125, 22, 22);
  R(-10, 124, 8, 6);
  R(PCH.x, PCH.z, 42, 38);
  for (let i = 0; i < 120; i++) {
    const s = `${r.pick(['R', 'C', 'C', 'L', 'Q', 'U', 'D'])}${r.int(1, 999)}`;
    T(s, r.range(-HW + 10, HW - 10), r.range(-HD + 10, HD - 10), 0.9, r.chance(0.3) ? -Math.PI / 2 : 0);
  }
  for (let i = 0; i < 40; i++) SILK.push({ kind: 'dot', x: r.range(-HW + 10, HW - 10), z: r.range(-HD + 10, HD - 10), size: 0.35 });
  SILK.push({ kind: 'line', x: -60, z: 88, x2: -60, z2: 150 });
  SILK.push({ kind: 'line', x: -120, z: 88, x2: -60, z2: 88 });
})();

export type PcbMode = 'color' | 'rough' | 'height';

/**
 * Zeichnet den Ausschnitt [x0,x1] × [z0,z1] (mm) der Platine in eine Leinwand der Größe w × h.
 * `micro` fügt bei starker Vergrößerung Glasfasergewebe und die Struktur des Lötstopplacks hinzu.
 */
export function drawPcb(g: CanvasRenderingContext2D, x0: number, z0: number, x1: number, z1: number, w: number, h: number, mode: PcbMode, micro = 0) {
  const sx = w / (x1 - x0);
  const sz = h / (z1 - z0);
  const X = (x: number) => (x - x0) * sx;
  const Z = (z: number) => (z - z0) * sz;
  const col = mode === 'color';
  const hgt = mode === 'height';
  const pal = {
    base: col ? '#121417' : hgt ? '#404040' : '#a8a8a8',
    pour: col ? '#171a1f' : hgt ? '#5a5a5a' : '#989898',
    trace: col ? '#22262d' : hgt ? '#b4b4b4' : '#6a6a6a',
    ridge: col ? '#2c3139' : hgt ? '#d0d0d0' : '#585858',
    via: col ? '#2a2e36' : hgt ? '#c0c0c0' : '#606060',
    drill: col ? '#060708' : hgt ? '#101010' : '#c0c0c0',
    tp: col ? '#c9a24f' : hgt ? '#606060' : '#383838',
    silk: col ? '#dfe2e6' : hgt ? '#9a9a9a' : '#d6d6d6',
  };
  g.fillStyle = pal.base;
  g.fillRect(0, 0, w, h);

  if (micro > 0 && col) {
    // Glasfasergewebe (FR-4) schimmert durch den Lack
    const pitchMm = 0.5;
    g.save();
    g.globalAlpha = 0.2 * Math.min(1, micro);
    for (let k = 0; k < 2; k++) {
      const n0 = Math.floor((k ? z0 : x0) / pitchMm) - 1;
      const n1 = Math.ceil((k ? z1 : x1) / pitchMm) + 1;
      for (let n = n0; n <= n1; n++) {
        const c = n * pitchMm;
        g.fillStyle = (n + k) % 2 ? '#3b4148' : '#2a2f35';
        if (k === 0) g.fillRect(X(c - pitchMm * 0.36), 0, pitchMm * 0.72 * sx, h);
        else g.fillRect(0, Z(c - pitchMm * 0.36), w, pitchMm * 0.72 * sz);
      }
    }
    if (micro > 1.5) {
      g.globalAlpha = 0.1;
      g.strokeStyle = '#6c7682';
      g.lineWidth = Math.max(1, 0.007 * sx * 0.6);
      const f = 0.0105;
      for (let x = Math.floor(x0 / f) * f; x < x1; x += f) {
        g.beginPath();
        g.moveTo(X(x), 0);
        g.lineTo(X(x), h);
        g.stroke();
      }
    }
    g.restore();
  }

  // Kupferflächen
  g.fillStyle = pal.pour;
  for (const p of POURS) {
    g.beginPath();
    p.forEach(([x, z], i) => (i ? g.lineTo(X(x), Z(z)) : g.moveTo(X(x), Z(z))));
    g.closePath();
    g.fill();
  }
  // Wärmefallen: Freistellung mit vier Stegen
  for (const [x, z] of RELIEFS) {
    const rr = 0.9 * sx;
    if (rr < 1.2) continue;
    g.fillStyle = pal.base;
    g.beginPath();
    g.arc(X(x), Z(z), rr, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = pal.pour;
    g.lineWidth = 0.35 * sx;
    g.beginPath();
    g.moveTo(X(x) - rr, Z(z));
    g.lineTo(X(x) + rr, Z(z));
    g.moveTo(X(x), Z(z) - rr);
    g.lineTo(X(x), Z(z) + rr);
    g.stroke();
    VIAS_DRAW(g, X(x), Z(z), 0.45 * sx, pal);
  }

  // Leiterbahnen: Kupfer unter dem Lack, mit leichtem Grat in der Mitte (wirkt erhaben)
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (const tr of TRACES) {
    const lw = tr.w * sx;
    g.globalAlpha = lw < 0.6 ? Math.max(0.25, lw * 1.4) : 1;
    g.strokeStyle = pal.trace;
    g.lineWidth = Math.max(0.6, lw);
    g.beginPath();
    tr.pts.forEach(([x, z], i) => (i ? g.lineTo(X(x), Z(z)) : g.moveTo(X(x), Z(z))));
    g.stroke();
    if (lw > 2.5) {
      g.strokeStyle = pal.ridge;
      g.lineWidth = lw * 0.4;
      g.stroke();
    }
    g.globalAlpha = 1;
  }

  // Durchkontaktierungen
  for (const [x, z, r] of VIAS) {
    const rr = r * sx;
    if (rr < 0.5) continue;
    VIAS_DRAW(g, X(x), Z(z), rr, pal);
  }
  // Testpunkte (offen, vergoldet)
  for (const [x, z, r] of TESTPTS) {
    const rr = r * sx;
    if (rr < 0.6) continue;
    g.fillStyle = pal.tp;
    g.beginPath();
    g.arc(X(x), Z(z), rr, 0, Math.PI * 2);
    g.fill();
    if (col && rr > 3) {
      g.fillStyle = '#e8cf8a';
      g.beginPath();
      g.arc(X(x) - rr * 0.25, Z(z) - rr * 0.25, rr * 0.35, 0, Math.PI * 2);
      g.fill();
    }
  }

  // Bestückungsdruck
  g.fillStyle = pal.silk;
  g.strokeStyle = pal.silk;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (const s of SILK) {
    if (s.kind === 'text') {
      const fs = (s.size ?? 2) * sz;
      if (fs < 2) continue;
      g.save();
      g.translate(X(s.x), Z(s.z));
      if (s.rot) g.rotate(s.rot);
      g.font = `700 ${fs}px "JetBrains Mono Variable", ui-monospace, monospace`;
      g.fillText(s.s!, 0, 0);
      g.restore();
    } else if (s.kind === 'rect') {
      g.lineWidth = Math.max(1, 0.15 * sx);
      g.strokeRect(X(s.x - s.w! / 2), Z(s.z - s.d! / 2), s.w! * sx, s.d! * sz);
    } else if (s.kind === 'dot') {
      g.beginPath();
      g.arc(X(s.x), Z(s.z), Math.max(1, s.size! * sx), 0, Math.PI * 2);
      g.fill();
    } else if (s.kind === 'line') {
      g.lineWidth = Math.max(1, 0.15 * sx);
      g.beginPath();
      g.moveTo(X(s.x), Z(s.z));
      g.lineTo(X(s.x2!), Z(s.z2!));
      g.stroke();
    }
  }

  if (micro > 0 && col) {
    // Lötstopplack: feine Pigment-Körnung und winzige Bläschen
    const r = rng(Math.floor(x0 * 1000) ^ Math.floor(z0 * 1000));
    g.save();
    const n = Math.floor(w * h * 0.0009);
    for (let i = 0; i < n; i++) {
      g.globalAlpha = r.range(0.03, 0.1);
      g.fillStyle = r.chance(0.5) ? '#000' : '#5a626c';
      const s = r.range(0.6, 2.2);
      g.fillRect(r.next() * w, r.next() * h, s, s);
    }
    g.restore();
  }
}

function VIAS_DRAW(g: CanvasRenderingContext2D, x: number, z: number, rr: number, pal: { via: string; drill: string }) {
  g.fillStyle = pal.via;
  g.beginPath();
  g.arc(x, z, rr, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = pal.drill;
  g.beginPath();
  g.arc(x, z, rr * 0.48, 0, Math.PI * 2);
  g.fill();
}

export const BOARD_HW = HW;
export const BOARD_HD = HD;
