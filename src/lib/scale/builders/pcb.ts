/**
 * „Überall hineinzoomen“: Wer auf die Platine zoomt, sieht dieselben Leiterbahnen immer feiner.
 * In der feinsten Stufe sind die Leiterbahnen echte 3D-Streifen (35 µm Kupfer unter 20 µm Lötstopplack),
 * darunter das Glasfasergewebe.
 */
import type { Built, BuildCtx, LabelDef } from '../types';
import { t } from '../zoom';
import { THREE, MAT, canvasTex, inst, makeCanvas, phys, std, type InstSpec } from './kit';
import { drawPcb, TRACES, VIAS } from './pcbart';
import { particle, pollen } from './life';

const CU_T = 0.035; // Kupferdicke (mm)
const MASK_T = 0.02; // Lötstopplack über dem Kupfer (mm)

/** Ausschnitt der Platine um (ax, az), Größe `size` mm, Einheit der Ebene: `unitPerMm` (mm = 1, µm = 1000) */
export function buildPcbPatch(ctx: BuildCtx, size: number, unitPerMm: number, micro: number, lift: number, withLife: boolean): Built {
  const [ax, , az] = ctx.anchor;
  const x0 = ax - size / 2;
  const z0 = az - size / 2;
  const x1 = ax + size / 2;
  const z1 = az + size / 2;
  const W = 4096;
  const { cv, g } = makeCanvas(W, W);
  drawPcb(g, x0, z0, x1, z1, W, W, 'color', micro);
  const rc = makeCanvas(1024, 1024);
  drawPcb(rc.g, x0, z0, x1, z1, 1024, 1024, 'rough', micro);
  const hc = makeCanvas(2048, 2048);
  drawPcb(hc.g, x0, z0, x1, z1, 2048, 2048, 'height', micro);
  const mat = std({
    map: canvasTex(cv, ctx.aniso),
    roughnessMap: canvasTex(rc.cv, ctx.aniso, false),
    bumpMap: canvasTex(hc.cv, ctx.aniso, false),
    bumpScale: micro ? 4 : 0.04,
    roughness: 1,
    metalness: 0.1,
  });
  const root = new THREE.Group();
  const U = unitPerMm;
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(size * U, size * U), mat);
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = lift;
  root.add(plane);
  const labels: LabelDef[] = [];

  if (micro) {
    // Leiterbahnen als 3D-Streifen
    const cu: InstSpec[] = [];
    const mask: InstSpec[] = [];
    const pad = 0.2;
    const inside = (x: number, z: number) => x > x0 - pad && x < x1 + pad && z > z0 - pad && z < z1 + pad;
    for (const tr of TRACES) {
      for (let i = 0; i < tr.pts.length - 1; i++) {
        const [xa, za] = tr.pts[i];
        const [xb, zb] = tr.pts[i + 1];
        if (!inside(xa, za) && !inside(xb, zb) && !inside((xa + xb) / 2, (za + zb) / 2)) continue;
        const len = Math.hypot(xb - xa, zb - za);
        const ang = Math.atan2(zb - za, xb - xa);
        const cx = ((xa + xb) / 2 - ax) * U;
        const cz = ((za + zb) / 2 - az) * U;
        cu.push({ p: [cx, lift + (CU_T * U) / 2, cz], s: [(len + tr.w) * U, CU_T * U, tr.w * U], r: [0, -ang, 0] });
        mask.push({ p: [cx, lift + ((CU_T + MASK_T) * U) / 2, cz], s: [(len + tr.w + 0.03) * U, (CU_T + MASK_T) * U, (tr.w + 0.03) * U], r: [0, -ang, 0] });
      }
    }
    const box = new THREE.BoxGeometry(1, 1, 1);
    root.add(inst(box, MAT.copper({ roughness: 0.45, color: 0xc8794c }), cu));
    root.add(inst(box, phys({ color: 0x14181c, roughness: 0.25, clearcoat: 0.8, transparent: true, opacity: 0.62, depthWrite: false }), mask));
    // Durchkontaktierungen: Kupferring mit Bohrung
    const rings: InstSpec[] = [];
    const holes: InstSpec[] = [];
    for (const [x, z, r] of VIAS) {
      if (!inside(x, z)) continue;
      rings.push({ p: [(x - ax) * U, lift + (CU_T * U) / 2, (z - az) * U], s: [r * U, CU_T * U, r * U] });
      holes.push({ p: [(x - ax) * U, lift + CU_T * U + 0.5, (z - az) * U], s: [r * 0.48 * U, 1, r * 0.48 * U] });
    }
    root.add(inst(new THREE.CylinderGeometry(1, 1, 1, 40), MAT.copper({ roughness: 0.4, color: 0xc8794c }), rings));
    root.add(inst(new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x050506 }), holes));
    labels.push(
      { pos: [0, 2, -400], text: t('Glasfasergewebe (FR-4) unter dem Lötstopplack', 'Glass-fibre weave (FR-4) under the solder mask'), zMax: -2.9, zMin: -3.8 },
      { pos: [0, CU_T * U + 25, 0], text: t('Kupfer 35 µm dick, darüber 20 µm Lack', 'Copper 35 µm thick, 20 µm of mask on top'), zMax: -3.4, zMin: -4.5 },
    );
  } else {
    labels.push({ pos: [0, 0.02, 0], text: t('Leiterbahn aus Kupfer · 0,1 mm breit', 'Copper trace · 0.1 mm wide'), zMax: -2.0, zMin: -2.9 });
  }
  if (withLife) {
    const p = pollen(1e-6);
    p.obj.position.set(160, lift, -120);
    const d = particle(1e-6, 40e-6, 0x8b7e70, 12);
    d.obj.position.set(-190, lift, 80);
    const d2 = particle(1e-6, 12e-6, 0x9a8f80, 13);
    d2.obj.position.set(40, lift, 150);
    root.add(p.obj, d.obj, d2.obj);
    labels.push(
      { pos: [160, 95, -120], text: t('Pollenkorn', 'Pollen grain'), size: 30e-6, zMax: -3.3, zMin: -4.4, kind: 'life' },
      { pos: [-190, 100, 80], text: t('Staubkorn', 'Dust particle'), size: 40e-6, zMax: -3.0, zMin: -4.2, kind: 'life' },
    );
  }
  return { root, labels, pick: [plane] };
}
