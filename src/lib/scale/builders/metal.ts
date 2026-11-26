/**
 * Die Verdrahtung über den Transistoren: 12–17 Kupferlagen, oben dick und grob, unten fein.
 * Gezeigt wie im Rasterelektronenmikroskop, nachdem das Isoliermaterial weggeätzt wurde.
 * Einheit: µm. Beim Hineinzoomen werden die oberen Lagen nacheinander „abgehoben“.
 */
import type { Built, BuildCtx, Frame, LabelDef } from '../types';
import { smoothstep, t } from '../zoom';
import { THREE, MAT, inst, noiseTex, rng, setFade, std, type InstSpec } from './kit';
import { ecoli, pollen, redBloodCell } from './life';

export interface Layer {
  w: number;
  p: number;
  t: number;
  gap: number;
}
export const METAL_LAYERS: Layer[] = [
  { w: 9, p: 36, t: 3.4, gap: 1.6 },
  { w: 3.6, p: 12, t: 1.8, gap: 1.0 },
  { w: 1.3, p: 4.2, t: 0.9, gap: 0.55 },
  { w: 0.48, p: 1.4, t: 0.42, gap: 0.3 },
  { w: 0.18, p: 0.52, t: 0.2, gap: 0.14 },
  { w: 0.07, p: 0.2, t: 0.09, gap: 0.07 },
];
/** Oberkanten der Lagen (y, µm); Lage 0 oben bei y = 0 */
export const LAYER_TOP: number[] = (() => {
  const out: number[] = [];
  let y = 0;
  for (const l of METAL_LAYERS) {
    out.push(y);
    y -= l.t + l.gap;
  }
  out.push(y);
  return out;
})();
export const METAL_BOTTOM = LAYER_TOP[LAYER_TOP.length - 1];

export function buildMetal(ctx: BuildCtx, seed: number, extraLabels: LabelDef[] = [], withLife = true): Built {
  const root = new THREE.Group();
  const anims: ((f: Frame) => void)[] = [];
  const r = rng(seed);
  const N = 44;
  const layers: THREE.Group[] = [];
  const zs: number[] = [];
  METAL_LAYERS.forEach((L, li) => {
    const grp = new THREE.Group();
    const ext = L.p * N;
    const yTop = LAYER_TOP[li];
    const alongX = li % 2 === 0;
    const items: InstSpec[] = [];
    for (let i = 0; i < N; i++) {
      const o = (i - N / 2 + 0.5) * L.p;
      // Leitungen sind an Schnitten unterbrochen; die oberen Lagen (Stromversorgung) laufen durch
      let pos = -ext / 2;
      while (pos < ext / 2) {
        const seg = li < 2 ? ext : r.range(3, 18) * L.p;
        const end = Math.min(ext / 2, pos + seg);
        const len = end - pos - (li < 2 ? 0 : L.p * 0.6);
        if (len > L.w) {
          const c = pos + len / 2;
          items.push(alongX ? { p: [c, yTop - L.t / 2, o], s: [len, L.t, L.w] } : { p: [o, yTop - L.t / 2, c], s: [L.w, L.t, len] });
        }
        pos = end;
      }
    }
    const cu = MAT.copper({ roughness: 0.28 + li * 0.02, roughnessMap: noiseTex(128, ctx.aniso, 50 + li, 110, 170) });
    grp.add(inst(new THREE.BoxGeometry(1, 1, 1), cu, items));
    // Durchkontaktierungen zur nächsten Lage
    if (li < METAL_LAYERS.length - 1) {
      const nx = METAL_LAYERS[li + 1];
      const vias: InstSpec[] = [];
      const yB = yTop - L.t;
      for (let k = 0; k < 520; k++) {
        const a = (r.int(0, N - 1) - N / 2 + 0.5) * L.p;
        const b = (r.int(0, Math.floor((L.p * N) / nx.p) - 1) - (L.p * N) / nx.p / 2 + 0.5) * nx.p;
        const vw = Math.min(L.w, nx.w) * 0.85;
        vias.push({ p: alongX ? [b, yB - L.gap / 2, a] : [a, yB - L.gap / 2, b], s: [vw, L.gap, vw] });
      }
      grp.add(inst(new THREE.BoxGeometry(1, 1, 1), cu, vias));
    }
    root.add(grp);
    layers.push(grp);
    zs.push(Math.log10(L.p * 1.25e-6));
  });
  // Silizium ganz unten (Transistorebene, von hier aus noch nicht aufgelöst)
  const base = new THREE.Mesh(
    new THREE.PlaneGeometry(METAL_LAYERS[2].p * N, METAL_LAYERS[2].p * N),
    std({ color: 0x2b3140, roughness: 0.55, metalness: 0.3, roughnessMap: noiseTex(256, ctx.aniso, 77, 80, 200) }),
  );
  base.rotation.x = -Math.PI / 2;
  base.position.y = METAL_BOTTOM - 0.05;
  root.add(base);

  const labels: LabelDef[] = [
    { pos: [0, 0.5, METAL_LAYERS[0].p * 0.5], text: t('Oberste Kupferlage: Stromversorgung', 'Top copper layer: power grid'), size: METAL_LAYERS[0].w * 1e-6, zMax: -3.45, zMin: -4.3 },
    { pos: [METAL_LAYERS[1].p * 0.5, LAYER_TOP[1], 0], text: t('Leiterbahn', 'Interconnect'), size: METAL_LAYERS[1].w * 1e-6, zMax: -4.3, zMin: -4.85 },
    { pos: [0, LAYER_TOP[2], METAL_LAYERS[2].p * 0.5], text: t('Leiterbahn', 'Interconnect'), size: METAL_LAYERS[2].w * 1e-6, zMax: -4.85, zMin: -5.3 },
    { pos: [METAL_LAYERS[3].p * 0.5, LAYER_TOP[3], 0], text: t('Leiterbahn', 'Interconnect'), size: METAL_LAYERS[3].w * 1e-6, zMax: -5.3, zMin: -5.8 },
    ...extraLabels,
  ];

  if (withLife) {
    const pl = pollen(1e-6);
    pl.obj.position.set(48, 0, -30);
    root.add(pl.obj);
    const rbc = redBloodCell(1e-6);
    rbc.obj.position.set(9, LAYER_TOP[1] + 1.0, 7);
    root.add(rbc.obj);
    const ec = ecoli(1e-6);
    ec.obj.position.set(-2.2, LAYER_TOP[3], 1.6);
    root.add(ec.obj);
    labels.push(
      { pos: [48, 32, -30], text: t('Pollenkorn (Sonnenblume)', 'Pollen grain (sunflower)'), size: 30e-6, zMax: -3.55, zMin: -4.6, kind: 'life' },
      { pos: [9, LAYER_TOP[1] + 3.5, 7], text: t('Rotes Blutkörperchen', 'Red blood cell'), size: 7.8e-6, zMax: -4.25, zMin: -5.1, kind: 'life' },
      { pos: [-2.2, LAYER_TOP[3] + 0.9, 1.6], text: t('Bakterium (E. coli)', 'Bacterium (E. coli)'), size: 2e-6, zMax: -4.85, zMin: -5.75, kind: 'life' },
    );
    anims.push((f) => {
      pl.update?.(f.t, f.dt);
      rbc.update?.(f.t, f.dt);
      if (!f.reduced) ec.update?.(f.t, f.dt);
      setFade(pl.obj, layerAlpha(0, f.z));
      setFade(rbc.obj, layerAlpha(1, f.z));
      setFade(ec.obj, layerAlpha(3, f.z));
    });
  }

  function layerAlpha(i: number, z: number) {
    return smoothstep(zs[i] - 0.3, zs[i] + 0.05, z);
  }
  anims.push((f) => {
    layers.forEach((g, i) => {
      const a = layerAlpha(i, f.z);
      setFade(g, a);
      g.position.y = (1 - a) * METAL_LAYERS[i].p * 0.25;
      g.visible = a > 0.01;
    });
    setFade(base, layerAlpha(3, f.z));
  });

  const pickPlane = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), new THREE.MeshBasicMaterial({ visible: false }));
  pickPlane.rotation.x = -Math.PI / 2;
  root.add(pickPlane);
  return { root, labels, pick: [pickPlane], update: (f) => anims.forEach((a) => a(f)) };
}
