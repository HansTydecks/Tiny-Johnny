/**
 * Atome (Einheit: nm). Kristallgitter (Diamant, Kochsalz, Fluorit, hexagonal dichteste Packung)
 * und amorphe Schichten, als Kugel-Stab-Modell. Die Atome zittern leicht – Wärmebewegung.
 */
import { THREE, inst, jitterMaterial, phys, rng, type InstSpec } from './kit';

export type El = 'Si' | 'O' | 'Hf' | 'Ti' | 'N' | 'Zr' | 'Co' | 'Pt' | 'Cr' | 'W' | 'Cu' | 'H';
/** Darstellungsradien (nm) – etwa 60 % der kovalenten Radien, damit die Bindungen sichtbar bleiben */
export const RADIUS: Record<El, number> = { Si: 0.075, O: 0.052, Hf: 0.1, Ti: 0.085, N: 0.05, Zr: 0.095, Co: 0.085, Pt: 0.095, Cr: 0.085, W: 0.09, Cu: 0.08, H: 0.035 };
/** Farben nach der üblichen CPK-Konvention */
export const COLOR: Record<El, number> = { Si: 0xd9a77a, O: 0xff3d3d, Hf: 0x4dc2ff, Ti: 0xbfc2c7, N: 0x3a5cff, Zr: 0x7fe0d6, Co: 0xf07fa0, Pt: 0xd8d8e6, Cr: 0x8a99c7, W: 0x2194d6, Cu: 0xc88033, H: 0xf5f5f5 };

export interface Atom {
  p: THREE.Vector3;
  el: El;
}

export type Box3 = { x: [number, number]; y: [number, number]; z: [number, number] };
const inBox = (p: THREE.Vector3, b: Box3) => p.x >= b.x[0] && p.x <= b.x[1] && p.y >= b.y[0] && p.y <= b.y[1] && p.z >= b.z[0] && p.z <= b.z[1];

function fillLattice(a: number, basis: [number, number, number, El][], box: Box3, keep?: (p: THREE.Vector3) => boolean): Atom[] {
  const out: Atom[] = [];
  const i0 = Math.floor(box.x[0] / a) - 1;
  const i1 = Math.ceil(box.x[1] / a) + 1;
  const j0 = Math.floor(box.y[0] / a) - 1;
  const j1 = Math.ceil(box.y[1] / a) + 1;
  const k0 = Math.floor(box.z[0] / a) - 1;
  const k1 = Math.ceil(box.z[1] / a) + 1;
  for (let i = i0; i <= i1; i++)
    for (let j = j0; j <= j1; j++)
      for (let k = k0; k <= k1; k++)
        for (const [bx, by, bz, el] of basis) {
          const p = new THREE.Vector3((i + bx) * a, (j + by) * a, (k + bz) * a);
          if (inBox(p, box) && (!keep || keep(p))) out.push({ p, el });
        }
  return out;
}

const FCC: [number, number, number][] = [
  [0, 0, 0],
  [0, 0.5, 0.5],
  [0.5, 0, 0.5],
  [0.5, 0.5, 0],
];

/** Silizium: Diamantgitter, a = 0,543 nm */
export function diamond(box: Box3, el: El = 'Si', a = 0.5431, keep?: (p: THREE.Vector3) => boolean): Atom[] {
  const basis: [number, number, number, El][] = [];
  for (const f of FCC) {
    basis.push([f[0], f[1], f[2], el], [f[0] + 0.25, f[1] + 0.25, f[2] + 0.25, el]);
  }
  return fillLattice(a, basis, box, keep);
}

/** Kubisch raumzentriert (Wolfram: a = 0,3165 nm) */
export function bcc(box: Box3, el: El, a: number): Atom[] {
  return fillLattice(a, [[0, 0, 0, el], [0.5, 0.5, 0.5, el]], box);
}

/** Kochsalzgitter (TiN: a = 0,424 nm) */
export function rocksalt(box: Box3, a: El, b: El, lat: number): Atom[] {
  const basis: [number, number, number, El][] = [];
  for (const f of FCC) basis.push([f[0], f[1], f[2], a], [f[0] + 0.5, f[1], f[2], b]);
  return fillLattice(lat, basis, box);
}

/** Fluoritgitter (ZrO₂: a ≈ 0,51 nm) */
export function fluorite(box: Box3, cat: El, an: El, lat: number): Atom[] {
  const basis: [number, number, number, El][] = [];
  for (const f of FCC) basis.push([f[0], f[1], f[2], cat]);
  for (const x of [0.25, 0.75]) for (const y of [0.25, 0.75]) for (const z of [0.25, 0.75]) basis.push([x, y, z, an]);
  return fillLattice(lat, basis, box);
}

/** Hexagonal dichteste Packung (Kobalt: a = 0,2507 nm, c = 0,4069 nm), c-Achse = y */
export function hcp(box: Box3, pick: (p: THREE.Vector3) => El, a = 0.2507, c = 0.4069, keep?: (p: THREE.Vector3) => boolean): Atom[] {
  const out: Atom[] = [];
  const h = (a * Math.sqrt(3)) / 2;
  for (let j = Math.floor(box.y[0] / (c / 2)) - 1; j <= Math.ceil(box.y[1] / (c / 2)) + 1; j++) {
    const y = (j * c) / 2;
    const B = ((j % 2) + 2) % 2 === 1;
    for (let k = Math.floor(box.z[0] / h) - 1; k <= Math.ceil(box.z[1] / h) + 1; k++)
      for (let i = Math.floor(box.x[0] / a) - 1; i <= Math.ceil(box.x[1] / a) + 1; i++) {
        const x = i * a + (((k % 2) + 2) % 2) * (a / 2) + (B ? a / 2 : 0);
        const z = k * h + (B ? h / 3 : 0);
        const p = new THREE.Vector3(x, y, z);
        if (inBox(p, box) && (!keep || keep(p))) out.push({ p, el: pick(p) });
      }
  }
  return out;
}

/** Amorphe Schicht: verzitterter Raster mit Elementen nach Anteil (z. B. HfO₂: Hf 1, O 2). */
export function amorphous(box: Box3, mix: [El, number][], spacing: number, seed: number, keep?: (p: THREE.Vector3) => boolean): Atom[] {
  const r = rng(seed);
  const out: Atom[] = [];
  const total = mix.reduce((s, m) => s + m[1], 0);
  for (let x = box.x[0] + spacing / 2; x < box.x[1]; x += spacing)
    for (let y = box.y[0] + spacing / 2; y < box.y[1]; y += spacing)
      for (let z = box.z[0] + spacing / 2; z < box.z[1]; z += spacing) {
        const p = new THREE.Vector3(x + r.range(-0.35, 0.35) * spacing, y + r.range(-0.35, 0.35) * spacing, z + r.range(-0.35, 0.35) * spacing);
        if (keep && !keep(p)) continue;
        let q = r.next() * total;
        let el = mix[0][0];
        for (const [e, w] of mix) {
          q -= w;
          if (q <= 0) {
            el = e;
            break;
          }
        }
        out.push({ p, el });
      }
  return out;
}

/** Atome als Instanzen zeichnen, mit Bindungen zwischen nahen Nachbarn. */
export function renderAtoms(atoms: Atom[], opts: { bonds?: { a: El; b: El; max: number }[]; jitter?: number; scale?: number; detail?: number } = {}): THREE.Group {
  const g = new THREE.Group();
  const byEl = new Map<El, InstSpec[]>();
  const sc = opts.scale ?? 1;
  for (const a of atoms) {
    const rr = RADIUS[a.el] * sc;
    if (!byEl.has(a.el)) byEl.set(a.el, []);
    byEl.get(a.el)!.push({ p: [a.p.x, a.p.y, a.p.z], s: [rr, rr, rr] });
  }
  const geo = new THREE.IcosahedronGeometry(1, opts.detail ?? 1);
  for (const [el, items] of byEl) {
    const mat = jitterMaterial(phys({ color: COLOR[el], roughness: 0.32, metalness: el === 'Co' || el === 'Pt' || el === 'W' || el === 'Ti' ? 0.35 : 0, clearcoat: 0.35, clearcoatRoughness: 0.3 }), opts.jitter ?? 0.006);
    g.add(inst(geo, mat, items));
  }
  if (opts.bonds?.length) {
    // räumliches Gitter für die Nachbarsuche
    const maxD = Math.max(...opts.bonds.map((b) => b.max));
    const cell = maxD;
    const grid = new Map<string, number[]>();
    const key = (x: number, y: number, z: number) => `${Math.floor(x / cell)},${Math.floor(y / cell)},${Math.floor(z / cell)}`;
    atoms.forEach((a, i) => {
      const k = key(a.p.x, a.p.y, a.p.z);
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k)!.push(i);
    });
    const bonds: InstSpec[] = [];
    const up = new THREE.Vector3(0, 1, 0);
    const d = new THREE.Vector3();
    atoms.forEach((a, i) => {
      const cx = Math.floor(a.p.x / cell);
      const cy = Math.floor(a.p.y / cell);
      const cz = Math.floor(a.p.z / cell);
      for (let dx = -1; dx <= 1; dx++)
        for (let dy = -1; dy <= 1; dy++)
          for (let dz = -1; dz <= 1; dz++) {
            const list = grid.get(`${cx + dx},${cy + dy},${cz + dz}`);
            if (!list) continue;
            for (const j of list) {
              if (j <= i) continue;
              const b = atoms[j];
              const rule = opts.bonds!.find((r) => (r.a === a.el && r.b === b.el) || (r.a === b.el && r.b === a.el));
              if (!rule) continue;
              const len = a.p.distanceTo(b.p);
              if (len > rule.max) continue;
              d.subVectors(b.p, a.p).normalize();
              const q = new THREE.Quaternion().setFromUnitVectors(up, d);
              const m = a.p.clone().add(b.p).multiplyScalar(0.5);
              bonds.push({ p: [m.x, m.y, m.z], q, s: [0.022 * sc, len, 0.022 * sc] });
            }
          }
    });
    g.add(inst(new THREE.CylinderGeometry(1, 1, 1, 6, 1, true), phys({ color: 0xcfd6e0, roughness: 0.4, clearcoat: 0.3 }), bonds));
  }
  return g;
}

/** Zeit für das Zittern weitergeben */
export function tickAtoms(g: THREE.Object3D, t: number, reduced: boolean) {
  g.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.Material | undefined;
    if (m && m.userData.time) m.userData.time.value = reduced ? 0 : t;
  });
}

/** Leuchtende Ladungsträger (Elektronen) */
export function electrons(n: number, color = 0x7fd4ff, size = 0.05): THREE.InstancedMesh {
  const m = new THREE.InstancedMesh(new THREE.SphereGeometry(size, 12, 10), new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), n);
  m.frustumCulled = false;
  const z = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < n; i++) m.setMatrixAt(i, z);
  return m;
}

/** Weicher Leuchthof um Elektronen */
export function glowSprite(color = 0x7fd4ff): THREE.SpriteMaterial {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const g = cv.getContext('2d')!;
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.3, 'rgba(255,255,255,0.45)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  const tx = new THREE.CanvasTexture(cv);
  return new THREE.SpriteMaterial({ map: tx, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
}
