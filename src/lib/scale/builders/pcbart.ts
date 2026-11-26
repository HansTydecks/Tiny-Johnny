/**
 * Leiterbahnen, Durchkontaktierungen und Bestückungsdruck der Platine als Vektordaten.
 * Dieselben Daten werden für die ganze Platine (grob) und für jeden Zoom-Ausschnitt (fein) gezeichnet –
 * dadurch passen alle Stufen beim Hineinzoomen exakt aufeinander.
 */
import { BOARD, CPU, DIMM, M2, PCIE1_Z } from './layout';
import { rng } from './kit';

export interface Trace {
  pts: [number, number][];
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
export const VIAS: [number, number, number][] = [];
export const POURS: [number, number][][] = [];
export const SILK: Silk[] = [];

const HW = BOARD.w / 2;
const HD = BOARD.d / 2;

function route(r: ReturnType<typeof rng>, x: number, z: number, steps: number, w: number, bias: [number, number]) {
  const pts: [number, number][] = [[x, z]];
  let dir = r.int(0, 7);
  for (let i = 0; i < steps; i++) {
    if (r.chance(0.35)) dir = (dir + (r.chance(0.5) ? 1 : 7)) % 8;
    // Richtung leicht zum Ziel lenken
    const ang = (dir * Math.PI) / 4;
    let dx = Math.cos(ang);
    let dz = Math.sin(ang);
    if (bias[0] * dx + bias[1] * dz < -0.3) {
      dir = (dir + 4) % 8;
      dx = -dx;
      dz = -dz;
    }
    const len = r.range(4, 16);
    x = Math.max(-HW + 3, Math.min(HW - 3, x + dx * len));
    z = Math.max(-HD + 3, Math.min(HD - 3, z + dz * len));
    pts.push([x, z]);
  }
  TRACES.push({ pts, w });
  VIAS.push([pts[0][0], pts[0][1], 0.35], [x, z, 0.35]);
}

/** Bündel paralleler Leitungen mit Mäandern (Längenausgleich wie bei echten Speicherleitungen). */
function bundle(x0: number, z0: number, x1: number, z1: number, n: number, pitch: number, w: number, meander: boolean, dirZ = false) {
  for (let i = 0; i < n; i++) {
    const o = (i - (n - 1) / 2) * pitch;
    const pts: [number, number][] = [];
    if (!dirZ) {
      const za = z0 + o;
      const zb = z1 + o;
      const xm = (x0 + x1) / 2 + (i % 2 ? 1 : -1) * 0.3;
      pts.push([x0, za], [xm - Math.abs(zb - za) / 2, za]);
      if (meander && i % 3 === 0) {
        const mx = xm - Math.abs(zb - za) / 2 + 0.6;
        for (let k = 0; k < 4; k++) {
          const px = mx + k * 1.2;
          pts.push([px, za], [px, za + pitch * 0.42], [px + 0.6, za + pitch * 0.42], [px + 0.6, za]);
        }
      }
      pts.push([xm + Math.abs(zb - za) / 2, zb], [x1, zb]);
    } else {
      const xa = x0 + o;
      const xb = x1 + o;
      const zm = (z0 + z1) / 2;
      pts.push([xa, z0], [xa, zm - Math.abs(xb - xa) / 2]);
      if (meander && i % 3 === 1) {
        const mz = zm - Math.abs(xb - xa) / 2 + 0.6;
        for (let k = 0; k < 3; k++) {
          const pz = mz + k * 1.2;
          pts.push([xa, pz], [xa + pitch * 0.42, pz], [xa + pitch * 0.42, pz + 0.6], [xa, pz + 0.6]);
        }
      }
      pts.push([xb, zm + Math.abs(xb - xa) / 2], [xb, z1]);
    }
    TRACES.push({ pts, w });
    VIAS.push([pts[pts.length - 1][0], pts[pts.length - 1][1], 0.3]);
  }
}

(function generate() {
  const r = rng(1702);
  const sockR = CPU.x + CPU.pkgW / 2 + 9;
  // CPU → RAM (zwei Kanäle)
  bundle(sockR, -98, DIMM.slotsX[0] - 4, -100, 22, 0.55, 0.11, true);
  bundle(sockR, -40, DIMM.slotsX[0] - 4, -30, 22, 0.55, 0.11, true);
  // CPU → PCIe x16 (Differenzpaare, senkrecht)
  bundle(CPU.x - 12, CPU.z + CPU.pkgD / 2 + 8, -70, PCIE1_Z - 4, 16, 0.5, 0.1, true, true);
  // CPU → M.2
  bundle(CPU.x + 8, CPU.z + CPU.pkgD / 2 + 8, M2.x0 + M2.len - 6, M2.z - M2.w / 2 - 2, 8, 0.5, 0.1, false, true);
  // Chipsatz → SATA, untere Steckplätze, Audio
  bundle(70, 92, 108, 126, 14, 0.6, 0.12, true);
  bundle(40, 60, 70, 88, 12, 0.6, 0.12, false, true);
  bundle(-30, 110, 40, 100, 10, 0.6, 0.12, false);
  // freie Signalleitungen überall
  for (let i = 0; i < 140; i++) {
    const x = r.range(-HW + 8, HW - 8);
    const z = r.range(-HD + 8, HD - 8);
    route(r, x, z, r.int(3, 9), r.pick([0.12, 0.15, 0.2, 0.25]), [r.range(-1, 1), r.range(-1, 1)]);
  }
  // breite Stromleitungen bei den Spannungswandlern
  for (let i = 0; i < 6; i++) TRACES.push({ pts: [[-104, -128 + i * 16], [-84, -128 + i * 16], [-78, -122 + i * 16]], w: 2.2 });
  // Kupferflächen
  POURS.push(
    [[-120, -150], [-50, -150], [-50, -120], [-88, -120], [-88, -10], [-120, -10]],
    [[60, 40], [118, 40], [118, 70], [60, 70]],
    [[-120, 90], [-60, 90], [-60, 150], [-120, 150]],
  );
  // Durchkontaktierungs-Felder unter dem Sockel (Fan-out)
  for (let i = -8; i <= 8; i++)
    for (let j = -10; j <= 10; j++) if ((i + j) % 2 === 0 && Math.abs(i) > 5) VIAS.push([CPU.x + i * 2.6, CPU.z + j * 2.4, 0.3]);
  for (let i = 0; i < 260; i++) VIAS.push([r.range(-HW + 5, HW - 5), r.range(-HD + 5, HD - 5), 0.3]);

  // Bestückungsdruck
  const T = (s: string, x: number, z: number, size = 2.2, rot = 0) => SILK.push({ kind: 'text', s, x, z, size, rot });
  const R = (x: number, z: number, w: number, d: number) => SILK.push({ kind: 'rect', x, z, w, d });
  T('TINY JOHNNY  TJ-Z1 ATX', 10, 142, 4.2);
  T('REV 1.02', 86, 142, 2.4);
  T('CPU1', CPU.x - 24, CPU.z + 26, 2.6);
  T('LGA1851', CPU.x + 14, CPU.z + 26, 2.0);
  DIMM.slotsX.forEach((x, i) => T(`DDR5_${'AB'[i >> 1]}${(i % 2) + 1}`, x, 14, 1.8, -Math.PI / 2));
  T('M2_1', M2.x0 + 6, M2.z + 14, 2.2);
  T('PCIEX16_1', -100, PCIE1_Z + 7, 2.2);
  T('PCIEX1_1', -100, 52 + 6, 2.0);
  T('PCIEX16_2', -100, 92 + 7, 2.0);
  T('CPU_FAN', 30, -146, 1.8);
  T('EPS_12V', -95, -137, 1.8);
  T('ATX_PWR', 108, -96, 1.8, -Math.PI / 2);
  T('SATA6G_1-4', 104, 112, 1.8);
  T('BAT', 40, 112, 1.8);
  T('CLR_CMOS', 60, 136, 1.4);
  T('BIOS', -10, 128, 1.6);
  T('AUDIO', -108, 85, 2.0);
  T('USB3_E1', 104, 26, 1.6);
  T('F_PANEL', 80, 150, 1.6);
  T('SYS_FAN1', -118, 70, 1.4, -Math.PI / 2);
  T('Designed for learning', -70, 148, 1.8);
  R(CPU.x, CPU.z, 54, 62);
  R(M2.x0 + M2.len / 2, M2.z, M2.len + 4, M2.w + 3);
  R(40, 125, 22, 22);
  R(-10, 124, 8, 6);
  // Bauteil-Bezeichner verstreut (R123, C45 …)
  for (let i = 0; i < 120; i++) {
    const s = `${r.pick(['R', 'C', 'C', 'L', 'Q', 'U', 'D'])}${r.int(1, 999)}`;
    T(s, r.range(-HW + 10, HW - 10), r.range(-HD + 10, HD - 10), 0.9, r.chance(0.3) ? -Math.PI / 2 : 0);
  }
  for (let i = 0; i < 40; i++) SILK.push({ kind: 'dot', x: r.range(-HW + 10, HW - 10), z: r.range(-HD + 10, HD - 10), size: 0.35 });
  // Trennlinie Audiobereich
  SILK.push({ kind: 'line', x: -60, z: 88, x2: -60, z2: 150 });
  SILK.push({ kind: 'line', x: -120, z: 88, x2: -60, z2: 88 });
})();

export type PcbMode = 'color' | 'rough';

/**
 * Zeichnet den Ausschnitt [x0,x1] × [z0,z1] (mm) der Platine in eine Leinwand der Größe w × h.
 * `micro` fügt bei starker Vergrößerung Kupferkörnung, Glasfasergewebe und Lötstoppfarben-Struktur hinzu.
 */
export function drawPcb(g: CanvasRenderingContext2D, x0: number, z0: number, x1: number, z1: number, w: number, h: number, mode: PcbMode, micro = 0) {
  const sx = w / (x1 - x0);
  const sz = h / (z1 - z0);
  const X = (x: number) => (x - x0) * sx;
  const Z = (z: number) => (z - z0) * sz;
  const col = mode === 'color';
  g.fillStyle = col ? '#15171b' : '#a8a8a8';
  g.fillRect(0, 0, w, h);

  if (micro > 0 && col) {
    // Glasfasergewebe (FR-4) schimmert durch die Lötstoppfarbe
    const pitchMm = 0.5; // Garnabstand ~ 0,5 mm
    g.save();
    g.globalAlpha = 0.11 * Math.min(1, micro);
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
    // einzelne Glasfasern (~7 µm) bei sehr starker Vergrößerung
    if (micro > 1.5) {
      g.globalAlpha = 0.09;
      g.strokeStyle = '#59616b';
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
  g.fillStyle = col ? '#1b1e23' : '#9a9a9a';
  for (const p of POURS) {
    g.beginPath();
    p.forEach(([x, z], i) => (i ? g.lineTo(X(x), Z(z)) : g.moveTo(X(x), Z(z))));
    g.closePath();
    g.fill();
  }

  // Leiterbahnen
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (const tr of TRACES) {
    const lw = tr.w * sx;
    if (lw < 0.25 && !micro) {
      g.globalAlpha = Math.max(0.15, lw * 3);
    }
    g.strokeStyle = col ? '#272c34' : '#707070';
    g.lineWidth = Math.max(0.6, lw);
    g.beginPath();
    tr.pts.forEach(([x, z], i) => (i ? g.lineTo(X(x), Z(z)) : g.moveTo(X(x), Z(z))));
    g.stroke();
    if (col && lw > 3) {
      // Lichtkante auf dicken Bahnen (die Lötstoppfarbe wölbt sich über dem Kupfer)
      g.strokeStyle = '#30363f';
      g.lineWidth = lw * 0.45;
      g.stroke();
    }
    g.globalAlpha = 1;
  }

  // Durchkontaktierungen
  for (const [x, z, r] of VIAS) {
    const rr = r * sx;
    if (rr < 0.4) continue;
    g.fillStyle = col ? '#2b3038' : '#666';
    g.beginPath();
    g.arc(X(x), Z(z), rr, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = col ? '#0c0d10' : '#b0b0b0';
    g.beginPath();
    g.arc(X(x), Z(z), rr * 0.45, 0, Math.PI * 2);
    g.fill();
  }

  // Bestückungsdruck
  g.fillStyle = col ? '#dfe2e6' : '#d0d0d0';
  g.strokeStyle = g.fillStyle;
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
    // Lötstoppfarbe: feine Pigment-Körnung und winzige Bläschen
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

export const BOARD_HW = HW;
export const BOARD_HD = HD;
