/**
 * SSD: NAND-Gehäuse mit 8 gestapelten Chips und Golddrähten (mm), danach ein aufgeschnittener
 * 3D-NAND-Block mit 232 Schichten und senkrechten Kanallöchern (nm).
 */
import type { Built, BuildCtx, Frame, LabelDef } from '../types';
import { smoothstep, t } from '../zoom';
import { THREE, MAT, boxOn, canvasTex, inst, makeCanvas, phys, rng, setFade, std, type InstSpec } from './kit';
import { drawDie, NAND_DIE } from './dieshot';
import { frontMaterial } from './chip';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const PKG = { w: 18, d: 14, t: 1.2, sub: 0.25 };
export const STACK_N = 8;
export const DIE_STEP = 0.06;
export const DIE_SHIFT = 0.28;
const DIE_T = 0.04;
/** Oberseite des obersten Chips (lokal, mm) */
export const TOP_DIE_Y = -PKG.t + PKG.sub + STACK_N * DIE_STEP;

export function buildNandPkg(ctx: BuildCtx): Built {
  const root = new THREE.Group();
  const anims: ((f: Frame) => void)[] = [];
  const W = NAND_DIE.w;
  const D = NAND_DIE.h;
  // Substrat mit Kontaktfingern
  root.add(boxOn(PKG.w, PKG.sub, PKG.d, MAT.substrate({ color: 0x24432f }), 0, -PKG.t, 0, 0.1));
  const fingers: InstSpec[] = [];
  for (let i = 0; i < 30; i++) fingers.push({ p: [-W / 2 + 0.6 + i * ((W - 1.2) / 29), -PKG.t + PKG.sub + 0.005, D / 2 + 1.25], s: [0.18, 0.01, 0.5] });
  root.add(inst(new THREE.BoxGeometry(1, 1, 1), MAT.gold(), fingers));
  // Chipstapel (Treppe, damit jeder Chip seine Anschlüsse frei hat)
  const { cv, g } = makeCanvas(2048, Math.round((2048 * D) / W));
  drawDie(g, NAND_DIE, 0, 0, W, D, cv.width, cv.height);
  const front = frontMaterial(canvasTex(cv, ctx.aniso));
  const side = MAT.silicon({ iridescence: 0, roughness: 0.4 });
  const daf = std({ color: 0x2b2f33, roughness: 0.7 });
  const wires: THREE.BufferGeometry[] = [];
  for (let i = 0; i < STACK_N; i++) {
    const y0 = -PKG.t + PKG.sub + i * DIE_STEP;
    const shift = (STACK_N - 1 - i) * DIE_SHIFT;
    root.add(boxOn(W, DIE_STEP - DIE_T, D, daf, 0, y0, shift));
    const die = new THREE.Mesh(new THREE.BoxGeometry(W, DIE_T, D), [side, side, i === STACK_N - 1 ? front : side, side, side, side]);
    die.position.set(0, y0 + DIE_STEP - DIE_T / 2, shift);
    root.add(die);
    for (let k = 0; k < 30; k++) {
      const x = -W / 2 + 0.5 + k * 0.34 + 0.08;
      const a = new THREE.Vector3(x, y0 + DIE_STEP, shift + D / 2 - 0.24);
      const b = new THREE.Vector3(-W / 2 + 0.6 + k * ((W - 1.2) / 29), -PKG.t + PKG.sub + 0.01, D / 2 + 1.15);
      const c = new THREE.Vector3((a.x + b.x) / 2, a.y + 0.25, (a.z + b.z) / 2 - 0.1);
      wires.push(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, c, b), 16, 0.012, 5));
    }
  }
  root.add(new THREE.Mesh(mergeGeometries(wires), MAT.gold({ roughness: 0.18 })));
  // Vergussmasse – wird beim Hineinzoomen durchsichtig
  const mold = phys({ color: 0x15161a, roughness: 0.6, transparent: true, opacity: 1, transmission: 0 });
  const moldMesh = boxOn(PKG.w, PKG.t - PKG.sub, PKG.d, mold, 0, -PKG.t + PKG.sub, 0, 0.15);
  root.add(moldMesh);
  anims.push((f) => {
    const k = smoothstep(-1.65, -2.1, f.z);
    setFade(moldMesh, 1 - 0.93 * k);
    moldMesh.visible = k < 0.999 || true;
  });
  const labels: LabelDef[] = [
    { pos: [0, 0.2, -4], text: t('8 Speicherchips übereinander', '8 memory chips stacked'), size: DIE_STEP * 8e-3, zMax: -1.9, zMin: -2.7 },
    { pos: [-W / 2 + 2, -0.2, D / 2 + 1.6], text: t('Golddrähte', 'Gold bond wires'), size: 25e-6, zMax: -2.0, zMin: -2.9 },
    { pos: [0, TOP_DIE_Y + 0.05, 0], text: t('NAND-Flash-Chip', 'NAND flash chip'), size: W * 1e-3, zMax: -1.8, zMin: -2.5 },
  ];
  const pickPlane = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshBasicMaterial({ visible: false }));
  pickPlane.rotation.x = -Math.PI / 2;
  pickPlane.position.y = TOP_DIE_Y;
  root.add(pickPlane);
  return { root, labels, pick: [pickPlane], update: (f) => anims.forEach((a) => a(f)) };
}

// ───────────────────────────── 3D-NAND-Block (nm)
export const LAYERS = 232;
const T_W = 24;
const T_O = 20.8;
export const PITCH = T_W + T_O;
export const STACK_H = LAYERS * PITCH;
const HOLE = 150;
const HR = 50;
const SHELLS: [number, number, string][] = [
  [0, 20, '#c9d6e6'], // Kernoxid
  [20, 28, '#6f7d96'], // Polysilizium-Kanal
  [28, 33, '#dfe8f2'], // Tunneloxid
  [33, 41, '#d6a64a'], // Siliziumnitrid (Ladungsfalle)
  [41, 50, '#e8eef5'], // Sperroxid
];

export function buildNandStack(ctx: BuildCtx): Built {
  const root = new THREE.Group();
  const anims: ((f: Frame) => void)[] = [];
  const r = rng(232);
  const XW = 6000;
  const ZD = 6000;
  const top = STACK_H / 2;
  // Schichten: Wolfram-Wortleitungen und Oxid abwechselnd
  const wl: InstSpec[] = [];
  const ox: InstSpec[] = [];
  for (let i = 0; i < LAYERS; i++) {
    const y = top - i * PITCH;
    ox.push({ p: [0, y - T_O / 2, -ZD / 2], s: [2 * XW, T_O, ZD] });
    wl.push({ p: [0, y - T_O - T_W / 2, -ZD / 2], s: [2 * XW, T_W, ZD] });
  }
  const box = new THREE.BoxGeometry(1, 1, 1);
  root.add(inst(box, MAT.tungsten({ color: 0x7d8590, roughness: 0.42 }), wl));
  root.add(inst(box, std({ color: 0xcfe0f0, roughness: 0.55 }), ox));
  // Schnittfläche der Kanallöcher (vorne)
  const { cv, g } = makeCanvas(256, 4);
  for (let px = 0; px < 256; px++) {
    const rr = Math.abs((px / 255) * 2 - 1) * HR;
    const sh = SHELLS.find((s) => rr >= s[0] && rr <= s[1]) ?? SHELLS[SHELLS.length - 1];
    g.fillStyle = sh[2];
    g.fillRect(px, 0, 1, 4);
  }
  const stripTex = canvasTex(cv, ctx.aniso);
  stripTex.magFilter = THREE.NearestFilter;
  const strips: InstSpec[] = [];
  const nFront = Math.floor(XW / HOLE);
  for (let k = -nFront; k <= nFront; k++) strips.push({ p: [k * HOLE, 0, 0.6], s: [2 * HR, STACK_H, 1] });
  root.add(inst(new THREE.PlaneGeometry(1, 1), std({ map: stripTex, roughness: 0.5 }), strips));
  // Oberseite: Löcher von oben
  const tc = makeCanvas(1024, 1024);
  tc.g.fillStyle = '#cfe0f0';
  tc.g.fillRect(0, 0, 1024, 1024);
  const per = 1024 / 8; // 8 Löcher pro Kachel
  for (let j = 0; j < 9; j++)
    for (let i = 0; i < 9; i++) {
      const x = i * per + (j % 2 ? per / 2 : 0);
      const y = j * per * 0.87;
      for (let s = SHELLS.length - 1; s >= 0; s--) {
        tc.g.fillStyle = SHELLS[s][2];
        tc.g.beginPath();
        tc.g.arc(x, y, (SHELLS[s][1] / HOLE) * per, 0, Math.PI * 2);
        tc.g.fill();
      }
    }
  const topTex = canvasTex(tc.cv, ctx.aniso);
  topTex.wrapS = topTex.wrapT = THREE.RepeatWrapping;
  topTex.repeat.set((2 * XW) / (8 * HOLE), ZD / (8 * HOLE * 0.87));
  const topPlane = new THREE.Mesh(new THREE.PlaneGeometry(2 * XW, ZD), std({ map: topTex, roughness: 0.5 }));
  topPlane.rotation.x = -Math.PI / 2;
  topPlane.position.set(0, top + 0.5, -ZD / 2);
  root.add(topPlane);
  // Schlitze (gemeinsame Source-Leitung)
  for (const z of [-1350, -2700, -4050]) root.add(boxOn(2 * XW, STACK_H + 2, 60, MAT.tungsten({ color: 0x5f6670 }), 0, -top, z));
  // Gefangene Elektronen in der Nitrid-Schicht
  const eItems: InstSpec[] = [];
  for (let k = -16; k <= 16; k++)
    for (let l = -40; l <= 40; l++) {
      if (!r.chance(0.55)) continue;
      const y = -l * PITCH - T_O - T_W / 2 + (top % PITCH) * 0;
      for (const side of [-1, 1]) eItems.push({ p: [k * HOLE + side * 37, y + r.range(-6, 6), 1.5], s: [1, 1, 1] });
    }
  const el = inst(new THREE.SphereGeometry(3.2, 8, 6), new THREE.MeshBasicMaterial({ color: 0x8fdcff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), eItems);
  root.add(el);
  anims.push((f) => {
    (el.material as THREE.MeshBasicMaterial).opacity = (0.75 + 0.25 * Math.sin(f.t * 2.5)) * smoothstep(-5.6, -6.2, f.z);
  });
  const labels: LabelDef[] = [
    { pos: [0, top + 40, -600], text: t('232 Schichten · ≈ 10 µm hoch', '232 layers · ≈ 10 µm tall'), size: STACK_H * 1e-9, zMax: -4.6, zMin: -5.4 },
    { pos: [0, 300, 2], text: t('Kanalloch', 'Channel hole'), size: 100e-9, zMax: -5.5, zMin: -6.6 },
    { pos: [37, -T_O - T_W / 2, 3], text: t('Speicherzelle: Kanal × Wortleitung', 'Memory cell: channel × word line'), zMax: -6.2, zMin: -7.0 },
    { pos: [300, -T_O - T_W / 2 - PITCH * 2, 2], text: t('Wortleitung (Wolfram)', 'Word line (tungsten)'), size: T_W * 1e-9, zMax: -6.3, zMin: -7.1 },
    { pos: [-37, -T_O - T_W / 2 + PITCH * 3, 3], text: t('Gefangene Elektronen = gespeicherte Daten', 'Trapped electrons = stored data'), zMax: -6.1, zMin: -7.2 },
    { pos: [-2400, top + 20, -2700], text: t('Schlitz (Source-Leitung)', 'Slit (source line)'), zMax: -4.6, zMin: -5.3 },
  ];
  const pickPlane = new THREE.Mesh(new THREE.PlaneGeometry(2 * XW, STACK_H * 1.2), new THREE.MeshBasicMaterial({ visible: false }));
  pickPlane.position.z = 1;
  root.add(pickPlane);
  return { root, labels, pick: [pickPlane], update: (f) => anims.forEach((a) => a(f)) };
}
