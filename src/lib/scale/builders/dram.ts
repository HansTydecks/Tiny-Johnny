/**
 * DRAM-Zellen (Einheit: nm): ein „Wald“ aus Kondensator-Säulen (Ø 32 nm, 1,2 µm hoch) in Wabenanordnung,
 * gestützt von Siliziumnitrid-Brücken. Geladene Kondensatoren (Bit 1) leuchten, verlieren langsam Ladung
 * und werden beim Auffrischen (Refresh) wieder gefüllt.
 */
import type { Built, BuildCtx, Frame, LabelDef } from '../types';
import { smoothstep, t } from '../zoom';
import { THREE, MAT, inst, noiseTex, rng, setFade, std, type InstSpec } from './kit';

const A = 46;
const RAD = 16;
const HGT = 1200;

export function buildDramCells(ctx: BuildCtx): Built {
  const root = new THREE.Group();
  const anims: ((f: Frame) => void)[] = [];
  const r = rng(77);
  const ext = 1050;
  const rowH = A * 0.866;
  const pillarsBack: InstSpec[] = [];
  const pillarsFront: InstSpec[] = [];
  const caps: { x: number; z: number; bit: number; q: number }[] = [];
  const bridges: InstSpec[] = [];
  const bridgesFront: InstSpec[] = [];
  for (let j = Math.floor(-ext / rowH); j <= Math.ceil(ext / rowH); j++) {
    for (let i = Math.floor(-ext / A); i <= Math.ceil(ext / A); i++) {
      const x = i * A + (((j % 2) + 2) % 2) * (A / 2);
      const z = j * rowH;
      if (x === 0 && z === 0) {
        caps.push({ x, z, bit: 1, q: 1 });
        continue; // eigene, aufgeschnittene Säule
      }
      const front = z > -RAD && Math.abs(x) < 420 && z < 600;
      (front ? pillarsFront : pillarsBack).push({ p: [x, -HGT / 2, z] });
      caps.push({ x, z, bit: r.chance(0.5) ? 1 : 0, q: r.range(0.4, 1) });
      for (const [dx, dz] of [
        [A, 0],
        [A / 2, rowH],
        [-A / 2, rowH],
      ]) {
        for (const y of [-70]) {
          const len = Math.hypot(dx, dz);
          const it: InstSpec = { p: [x + dx / 2, y, z + dz / 2], s: [len, 28, 12], r: [0, -Math.atan2(dz, dx), 0] };
          (front || (z + dz > -RAD && Math.abs(x) < 420 && z < 600) ? bridgesFront : bridges).push(it);
        }
      }
    }
  }
  const tin = MAT.gold({ color: 0xc9a75a, roughness: 0.36, metalness: 0.9 });
  const tinFront = MAT.gold({ color: 0xc9a75a, roughness: 0.36, metalness: 0.9 });
  const pGeo = new THREE.CylinderGeometry(RAD, RAD * 0.92, HGT, 12, 1, true);
  root.add(inst(pGeo, tin, pillarsBack));
  const frontPillars = inst(pGeo, tinFront, pillarsFront);
  root.add(frontPillars);
  const sin = std({ color: 0xd8dde6, roughness: 0.65 });
  const sinFront = std({ color: 0xd8dde6, roughness: 0.65 });
  root.add(inst(new THREE.BoxGeometry(1, 1, 1), sin, bridges));
  const frontBridges = inst(new THREE.BoxGeometry(1, 1, 1), sinFront, bridgesFront);
  root.add(frontBridges);
  // Ladungsanzeige auf den Säulen
  const capGeo = new THREE.CircleGeometry(RAD * 0.85, 18);
  capGeo.rotateX(-Math.PI / 2);
  const capMesh = new THREE.InstancedMesh(capGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), caps.length);
  const m4 = new THREE.Matrix4();
  caps.forEach((c, i) => capMesh.setMatrixAt(i, m4.makeTranslation(c.x, 1, c.z)));
  capMesh.frustumCulled = false;
  root.add(capMesh);
  // Boden: Silizium, Bitleitungen, vergrabene Wortleitungen
  const base = new THREE.Mesh(new THREE.BoxGeometry(2 * ext + 200, 60, 2 * ext + 200), std({ color: 0x39414f, roughness: 0.6, roughnessMap: noiseTex(256, ctx.aniso, 3, 80, 200) }));
  base.position.y = -HGT - 90;
  root.add(base);
  const bl: InstSpec[] = [];
  for (let j = Math.floor(-ext / rowH); j <= Math.ceil(ext / rowH); j += 1) bl.push({ p: [0, -HGT - 30, j * rowH + rowH / 2], s: [2 * ext, 30, 14] });
  root.add(inst(new THREE.BoxGeometry(1, 1, 1), MAT.tungsten(), bl));

  // Aufgeschnittene Säule im Mittelpunkt: TiN | ZrO₂ | TiN
  const cut = new THREE.Group();
  const layer = (x0: number, x1: number, color: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, HGT, 1), std({ color, roughness: 0.45, metalness: color === 0xc9a75a ? 0.9 : 0.05 }));
    m.position.set((x0 + x1) / 2, -HGT / 2, 0.5);
    cut.add(m);
  };
  layer(-19, -16, 0xc9a75a);
  layer(-16, -11, 0x5fc7bd);
  layer(-11, 11, 0xc9a75a);
  layer(11, 16, 0x5fc7bd);
  layer(16, 19, 0xc9a75a);
  const half = new THREE.Mesh(new THREE.CylinderGeometry(19, 19, HGT, 32, 1, false, Math.PI / 2, Math.PI), tin);
  half.position.y = -HGT / 2;
  cut.add(half);
  root.add(cut);
  // Elektronen in der Mittelsäule (gespeicherte Ladung)
  const eN = 160;
  const el = new THREE.InstancedMesh(new THREE.SphereGeometry(1.6, 8, 6), new THREE.MeshBasicMaterial({ color: 0x8fdcff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), eN);
  el.frustumCulled = false;
  const ep = Array.from({ length: eN }, () => [r.chance(0.5) ? r.range(-11, -9.5) : r.range(9.5, 11), r.range(-HGT * 0.9, -20), r.range(0, 3)]);
  root.add(el);

  let refresh = 0;
  const col = new THREE.Color();
  anims.push((f) => {
    refresh += f.dt;
    const sweep = ((refresh % 5) / 5) * (2 * ext + 400) - ext - 200; // Auffrisch-Welle läuft über das Feld
    caps.forEach((c, i) => {
      if (c.bit) {
        c.q *= Math.exp(-f.dt * 0.12);
        if (Math.abs(c.x - sweep) < 40) c.q = 1;
      }
      const v = c.bit ? 0.15 + c.q * 0.55 : 0.03;
      col.setRGB(0.12 * v, 0.62 * v, 1.0 * v);
      capMesh.setColorAt(i, col);
    });
    if (capMesh.instanceColor) capMesh.instanceColor.needsUpdate = true;
    for (let i = 0; i < eN; i++) {
      const e = ep[i];
      m4.makeTranslation(e[0] + Math.sin(f.t * 3 + i) * 0.4, e[1], e[2] + 0.6);
      el.setMatrixAt(i, m4);
    }
    el.instanceMatrix.needsUpdate = true;
    // Schnitt: Säulen vor der Mittelsäule werden entfernt (wie beim Ionenstrahl-Schnitt im Labor)
    const k = smoothstep(-6.2, -6.65, f.z);
    setFade(frontPillars, 1 - k);
    setFade(frontBridges, 1 - k);
    frontPillars.visible = frontBridges.visible = k < 0.99;
    setFade(el, smoothstep(-6.4, -6.9, f.z));
  });

  const labels: LabelDef[] = [
    { pos: [0, 30, 0], text: t('Kondensator: speichert 1 Bit', 'Capacitor: stores 1 bit'), size: 32e-9, zMax: -5.6, zMin: -6.6 },
    { pos: [300, 10, -300], text: t('Wabenmuster: 46 nm Abstand', 'Honeycomb: 46 nm pitch'), zMax: -5.4, zMin: -6.1 },
    { pos: [120, -70, -200], text: t('Stützgitter (Siliziumnitrid)', 'Support lattice (silicon nitride)'), zMax: -5.9, zMin: -6.6 },
    { pos: [0, -HGT / 2, 0], text: t('Säule: 1,2 µm hoch – 40× höher als breit', 'Pillar: 1.2 µm tall – 40× taller than wide'), size: 1.2e-6, zMax: -5.9, zMin: -6.6 },
    { pos: [-13.5, -150, 2], text: t('Elektrode | Isolator | Elektrode', 'Electrode | insulator | electrode'), zMax: -6.7, zMin: -7.5 },
    { pos: [10, -400, 3], text: t('Gespeicherte Elektronen', 'Stored electrons'), zMax: -6.8, zMin: -7.4 },
    { pos: [-900, 5, 300], text: t('Auffrischen: alle 64 ms neu laden', 'Refresh: recharged every 64 ms'), zMax: -5.4, zMin: -6.0 },
  ];
  const pickPlane = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), new THREE.MeshBasicMaterial({ visible: false }));
  pickPlane.rotation.x = -Math.PI / 2;
  root.add(pickPlane);
  return { root, labels, pick: [pickPlane], update: (f) => anims.forEach((a) => a(f)) };
}
