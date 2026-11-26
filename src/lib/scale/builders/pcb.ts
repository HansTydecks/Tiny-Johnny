/**
 * „Überall hineinzoomen“: Wer auf eine freie Stelle der Platine zoomt, sieht dieselben Leiterbahnen
 * immer feiner – bis zum Glasfasergewebe unter dem Lötstopplack.
 */
import type { Built, BuildCtx, LabelDef } from '../types';
import { t } from '../zoom';
import { THREE, canvasTex, makeCanvas, std, noiseTex } from './kit';
import { drawPcb } from './pcbart';
import { particle, pollen } from './life';

/** Ausschnitt der Platine um (ax, az), Größe `size` mm, Einheit der Ebene: `unit` (mm = 1, µm = 1000) */
export function buildPcbPatch(ctx: BuildCtx, size: number, unitPerMm: number, micro: number, lift: number, withLife: boolean): Built {
  const [ax, , az] = ctx.anchor;
  const W = 4096;
  const { cv, g } = makeCanvas(W, W);
  drawPcb(g, ax - size / 2, az - size / 2, ax + size / 2, az + size / 2, W, W, 'color', micro);
  const rc = makeCanvas(1024, 1024);
  drawPcb(rc.g, ax - size / 2, az - size / 2, ax + size / 2, az + size / 2, 1024, 1024, 'rough', micro);
  const mat = std({
    map: canvasTex(cv, ctx.aniso),
    roughnessMap: canvasTex(rc.cv, ctx.aniso, false),
    bumpMap: canvasTex(rc.cv, ctx.aniso, false),
    bumpScale: micro ? 6 : 0.02,
    roughness: 1,
    metalness: 0.15,
  });
  if (micro) {
    mat.normalMap = null;
    mat.roughnessMap = noiseTex(512, ctx.aniso, 14, 100, 180, 1);
    mat.roughnessMap.repeat.set(8, 8);
  }
  const root = new THREE.Group();
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(size * unitPerMm, size * unitPerMm), mat);
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = lift;
  root.add(plane);
  const labels: LabelDef[] = [];
  if (withLife) {
    const p = pollen(1e-6);
    p.obj.position.set(120, lift, -90);
    const d = particle(1e-6, 40e-6, 0x8b7e70, 12);
    d.obj.position.set(-160, lift, 60);
    const d2 = particle(1e-6, 12e-6, 0x9a8f80, 13);
    d2.obj.position.set(30, lift, 130);
    root.add(p.obj, d.obj, d2.obj);
    labels.push(
      { pos: [120, 35, -90], text: t('Pollenkorn', 'Pollen grain'), size: 30e-6, zMax: -3.3, zMin: -4.4, kind: 'life' },
      { pos: [-160, 40, 60], text: t('Staubkorn', 'Dust particle'), size: 40e-6, zMax: -3.0, zMin: -4.2, kind: 'life' },
      { pos: [0, 2, -400], text: t('Glasfasergewebe (FR-4) unter dem Lötstopplack', 'Glass-fibre weave (FR-4) under the solder mask'), zMax: -2.9, zMin: -3.8 },
    );
  } else {
    labels.push({ pos: [0, 0.02, 0], text: t('Leiterbahn aus Kupfer · 0,1 mm breit', 'Copper trace · 0.1 mm wide'), zMax: -2.1, zMin: -2.9 });
  }
  return { root, labels, pick: [plane] };
}
