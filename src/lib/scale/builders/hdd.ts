/**
 * Festplatte im Detail: der Schreib-/Lesekopf (Slider) über der Platte (µm), die Datenspuren mit
 * magnetisierten Bits (nm) und die einzelnen Magnetkörner (nm).
 */
import type { Built, BuildCtx, Frame, LabelDef } from '../types';
import { t } from '../zoom';
import { THREE, MAT, boxOn, canvasTex, inst, makeCanvas, noiseTex, phys, rng, std, type InstSpec } from './kit';
import { hair, particle } from './life';

const FLY_UM = 0.003;

/** Bit-Muster: Spur i, Position z (nm) → Magnetisierung ±1. Gleiches Muster für Spuren- und Kornansicht. */
export function bitAt(track: number, zNm: number): number {
  const cell = Math.floor(zNm / 14);
  const h = Math.sin(track * 91.7 + cell * 12.9898) * 43758.5453;
  const v = h - Math.floor(h);
  // Übergänge nur an manchen Zellgrenzen → Bits unterschiedlicher Länge
  const run = Math.floor(cell / (1 + Math.floor(v * 3)));
  const h2 = Math.sin(track * 7.3 + run * 3.7) * 9631.123;
  return h2 - Math.floor(h2) > 0.5 ? 1 : -1;
}
export const TRACK_PITCH = 70;

export function buildHddSurface(ctx: BuildCtx): Built {
  const root = new THREE.Group();
  const anims: ((f: Frame) => void)[] = [];
  // Platte: hochglanzpoliert
  const plat = new THREE.Mesh(
    new THREE.PlaneGeometry(9000, 9000),
    phys({ color: 0xa9aeb6, metalness: 1, roughness: 0.09, envMapIntensity: 0.35, anisotropy: 0.8, roughnessMap: noiseTex(512, ctx.aniso, 61, 110, 140, 0), iridescence: 0.15 }),
  );
  plat.rotation.x = -Math.PI / 2;
  root.add(plat);
  // Slider (AlTiC) mit Aluminiumoxid-Hinterkante, in der der Kopf sitzt
  const altic = std({ color: 0x3b3e44, metalness: 0.35, roughness: 0.32 });
  const alumina = phys({ color: 0xe9ecef, roughness: 0.35, transmission: 0.2, transparent: true, opacity: 0.85 });
  root.add(boxOn(700, 230, 850, altic, 0, FLY_UM, -12 - 425, 6));
  root.add(boxOn(700, 230, 37, alumina, 0, FLY_UM, 6.5, 3));
  // Spulen und Abschirmungen im Oxid
  const coil = MAT.copper({ roughness: 0.3 });
  for (let i = 0; i < 5; i++) {
    const tr = new THREE.Mesh(new THREE.TorusGeometry(18 + i * 7, 1.6, 8, 48), coil);
    tr.rotation.x = 0;
    tr.position.set(0, 60, 12);
    root.add(tr);
  }
  const nife = MAT.nickel({ roughness: 0.25 });
  root.add(boxOn(90, 40, 2, nife, 0, FLY_UM, -1.5), boxOn(90, 40, 2, nife, 0, FLY_UM, 1.5), boxOn(40, 90, 3, nife, 0, FLY_UM, 8));
  // Anschlusspads und Drähte
  const pads: InstSpec[] = [];
  for (let i = 0; i < 6; i++) pads.push({ p: [-250 + i * 100, 170, 25.2], s: [55, 55, 1] });
  root.add(inst(new THREE.BoxGeometry(1, 1, 1), MAT.gold(), pads));
  // Aufhängung (Edelstahl-Federblech) oben drauf
  root.add(boxOn(900, 22, 1300, MAT.steel({ color: 0xd2d5da, roughness: 0.2 }), -120, 232, -350, 4));
  const traces: InstSpec[] = [];
  for (let i = 0; i < 6; i++) traces.push({ p: [-250 + i * 100, 256, -200], s: [30, 4, 800] });
  root.add(inst(new THREE.BoxGeometry(1, 1, 1), MAT.copper({ color: 0xc98a28 }), traces));
  // Größenvergleiche
  const h = hair(1e-6, 4e-3, ctx.aniso);
  h.obj.position.set(-900, 0, 0);
  h.obj.rotation.y = Math.PI / 2 + 0.2;
  root.add(h.obj);
  const dust = particle(1e-6, 18e-6, 0x8b7a66, 4);
  dust.obj.position.set(220, 0, 260);
  root.add(dust.obj);
  const labels: LabelDef[] = [
    { pos: [0, 240, -425], text: t('Schreib-/Lesekopf (Slider)', 'Read/write head (slider)'), size: 0.85e-3, zMax: -2.1, zMin: -3.2 },
    { pos: [-900, 80, 0], text: t('Menschliches Haar', 'Human hair'), size: 70e-6, zMax: -2.2, zMin: -3.6, kind: 'life' },
    { pos: [220, 26, 260], text: t('Staubkorn', 'Dust particle'), size: 18e-6, zMax: -3.1, zMin: -4.4, kind: 'life' },
    { pos: [0, 70, 26], text: t('Hier sitzt der Lesesensor', 'The read sensor sits here'), zMax: -3.2, zMin: -4.4 },
    { pos: [0, 0, 60], text: t('Der Kopf fliegt nur 3 nm über der Platte', 'The head flies only 3 nm above the platter'), zMax: -2.6, zMin: -4.0 },
  ];
  const pick = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), new THREE.MeshBasicMaterial({ visible: false }));
  pick.rotation.x = -Math.PI / 2;
  root.add(pick);
  return { root, labels, pick: [pick], update: (f) => anims.forEach((a) => a(f)) };
}

export function buildHddTracks(ctx: BuildCtx): Built {
  const root = new THREE.Group();
  const anims: ((f: Frame) => void)[] = [];
  // Spurtextur: 30 µm breit, 7 nm pro Pixel
  const W = 4096;
  const H = 1024;
  const nmPx = 30000 / W;
  const { cv, g } = makeCanvas(W, H);
  const img = g.createImageData(W, H);
  const r = rng(5);
  for (let px = 0; px < W; px++) {
    const xNm = px * nmPx - 15000;
    const tr = Math.floor((xNm + TRACK_PITCH / 2) / TRACK_PITCH);
    const inTrack = Math.abs(xNm - tr * TRACK_PITCH) < TRACK_PITCH * 0.42;
    for (let py = 0; py < H; py++) {
      const zNm = py * nmPx;
      const b = bitAt(tr, zNm);
      const n = 0.85 + r.next() * 0.3;
      const i = (py * W + px) * 4;
      if (!inTrack) {
        img.data[i] = 70 * n;
        img.data[i + 1] = 66 * n;
        img.data[i + 2] = 78 * n;
      } else if (b > 0) {
        img.data[i] = 214 * n;
        img.data[i + 1] = 92 * n;
        img.data[i + 2] = 62 * n;
      } else {
        img.data[i] = 62 * n;
        img.data[i + 1] = 112 * n;
        img.data[i + 2] = 214 * n;
      }
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const tex = canvasTex(cv, ctx.aniso);
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 30000 / (H * nmPx));
  const plat = new THREE.Mesh(new THREE.PlaneGeometry(30000, 30000), std({ map: tex, roughness: 0.32, metalness: 0.45 }));
  plat.rotation.x = -Math.PI / 2;
  root.add(plat);
  // Kopf: Unterseite 3 nm über der Platte, Lesesensor zwischen zwei Abschirmungen
  const alumina = phys({ color: 0xe9ecef, roughness: 0.35, transparent: true, opacity: 0.55 });
  root.add(boxOn(16000, 3000, 12400, alumina, 0, 3, -12000 / 2 + 400 - 200, 20));
  const nife = MAT.nickel({ roughness: 0.22 });
  root.add(boxOn(3000, 1500, 1985, nife, 0, 3, -15 - 1985 / 2), boxOn(3000, 1500, 1985, nife, 0, 3, 15 + 1985 / 2));
  const layers = [0x8e44ad, 0x2e86de, 0xf5f6fa, 0x2e86de, 0xe1b12c];
  layers.forEach((c, i) => root.add(boxOn(32, 40, 30 / layers.length, std({ color: c, metalness: 0.6, roughness: 0.3 }), 0, 3, -15 + (i + 0.5) * (30 / layers.length))));
  root.add(boxOn(40, 120, 200, std({ color: 0xb8bcc4, metalness: 1, roughness: 0.2 }), 0, 3, -4400));
  // Ein Rauchteilchen in der Luft hinter dem Kopf
  const smoke = particle(1e-9, 250e-9, 0x3c3a38, 8, true);
  smoke.obj.position.set(700, 300, 900);
  root.add(smoke.obj);
  anims.push((f) => {
    if (!f.reduced) tex.offset.y -= f.dt * 0.012;
    smoke.obj.position.y = 300 + Math.sin(f.t * 0.7) * 30;
  });
  const labels: LabelDef[] = [
    { pos: [0, 0, 120], text: t('Datenspuren · 70 nm Abstand', 'Data tracks · 70 nm pitch'), zMax: -4.6, zMin: -6.0 },
    { pos: [0, 3, 0], text: t('Lesesensor · 30 nm breit', 'Read sensor · 30 nm wide'), zMax: -5.9, zMin: -6.8 },
    { pos: [140, 1.5, 60], text: t('Luftspalt: 3 nm', 'Air gap: 3 nm'), size: 3e-9, zMax: -6.4, zMin: -7.2 },
    { pos: [-140, 0, 300], text: t('Ein Bit ≈ 15 × 70 nm (Falschfarben: ↑ rot, ↓ blau)', 'One bit ≈ 15 × 70 nm (false color: ↑ red, ↓ blue)'), zMax: -5.8, zMin: -6.7 },
    { pos: [700, 450, 900], text: t('Rauchteilchen', 'Smoke particle'), size: 250e-9, zMax: -5.3, zMin: -6.5, kind: 'life' },
  ];
  const pick = new THREE.Mesh(new THREE.PlaneGeometry(30000, 30000), new THREE.MeshBasicMaterial({ visible: false }));
  pick.rotation.x = -Math.PI / 2;
  root.add(pick);
  return { root, labels, pick: [pick], update: (f) => anims.forEach((a) => a(f)) };
}

export const GRAIN_TOP = -3;

export function buildHddGrains(_ctx: BuildCtx): Built {
  const root = new THREE.Group();
  const anims: ((f: Frame) => void)[] = [];
  const r = rng(808);
  const P = 8;
  const ext = 220;
  const grains: InstSpec[] = [];
  const arrows: { x: number; z: number; up: number; ph: number }[] = [];
  for (let j = Math.floor(-ext / (P * 0.866)); j <= Math.ceil(ext / (P * 0.866)); j++)
    for (let i = Math.floor(-ext / P); i <= Math.ceil(ext / P); i++) {
      const center = i === 0 && j === 0;
      const x = i * P + (((j % 2) + 2) % 2) * (P / 2) + (center ? 0 : r.range(-1.2, 1.2));
      const z = j * P * 0.866 + (center ? 0 : r.range(-1.2, 1.2));
      const tr = Math.floor((x + 35) / 70);
      const up = bitAt(tr, z + 5000);
      const rad = center ? 3.4 : r.range(2.8, 3.8);
      const c = up > 0 ? new THREE.Color(0xd65c3e) : new THREE.Color(0x3e70d6);
      c.offsetHSL(0, 0, r.range(-0.06, 0.06));
      grains.push({ p: [x, GRAIN_TOP - 6, z], s: [rad, 12, rad], r: [0, r.range(0, 1), 0], c });
      arrows.push({ x, z, up, ph: r.range(0, 6.28) });
    }
  root.add(inst(new THREE.CylinderGeometry(1, 1, 1, 6), std({ color: 0xffffff, roughness: 0.4, metalness: 0.5 }), grains));
  // Zwischenraum (Oxid) und Schutzschicht aus Kohlenstoff
  const fill = new THREE.Mesh(new THREE.BoxGeometry(2 * ext, 11, 2 * ext), std({ color: 0x2a2d33, roughness: 0.8 }));
  fill.position.y = GRAIN_TOP - 6.6;
  root.add(fill);
  const dlc = new THREE.Mesh(new THREE.BoxGeometry(2 * ext, 2.4, 2 * ext), phys({ color: 0x1b1c20, roughness: 0.2, transparent: true, opacity: 0.18 }));
  dlc.position.y = GRAIN_TOP + 1.25;
  root.add(dlc);
  // Magnetisierungspfeile
  const cone = new THREE.ConeGeometry(1.1, 3.4, 12);
  const am = new THREE.InstancedMesh(cone, new THREE.MeshStandardMaterial({ color: 0xfff2d0, emissive: 0xffb340, emissiveIntensity: 0.35, roughness: 0.4 }), arrows.length);
  am.frustumCulled = false;
  root.add(am);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3(1, 1, 1);
  anims.push((f) => {
    arrows.forEach((a, i) => {
      const wob = f.reduced ? 0 : 0.12 * Math.sin(f.t * 1.7 + a.ph);
      e.set(a.up > 0 ? wob : Math.PI + wob, 0, wob * 0.7);
      q.setFromEuler(e);
      p.set(a.x, GRAIN_TOP + 2.2, a.z);
      m4.compose(p, q, s);
      am.setMatrixAt(i, m4);
    });
    am.instanceMatrix.needsUpdate = true;
  });
  const labels: LabelDef[] = [
    { pos: [0, GRAIN_TOP + 4, 0], text: t('Magnetkorn aus Kobalt-Platin', 'Magnetic grain of cobalt-platinum'), size: 8e-9, zMax: -6.9, zMin: -7.9 },
    { pos: [40, GRAIN_TOP + 4, -40], text: t('Ein Bit = 10–20 Körner mit gleicher Richtung', 'One bit = 10–20 grains pointing the same way'), zMax: -6.6, zMin: -7.5 },
    { pos: [-60, GRAIN_TOP + 3, 60], text: t('Schutzschicht aus Kohlenstoff (2,5 nm)', 'Carbon overcoat (2.5 nm)'), zMax: -7.1, zMin: -7.9 },
  ];
  const pick = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshBasicMaterial({ visible: false }));
  pick.rotation.x = -Math.PI / 2;
  pick.position.y = GRAIN_TOP;
  root.add(pick);
  return { root, labels, pick: [pick], update: (f) => anims.forEach((a) => a(f)) };
}
