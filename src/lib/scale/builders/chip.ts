/** Chip-Ebenen: das nackte Die (mit Umdreh-Animation) und vergrößerte Ausschnitte als Textur. */
import type { Built, BuildCtx, Frame, LabelDef } from '../types';
import { smoothstep } from '../zoom';
import { THREE, MAT, boxOn, canvasTex, inst, makeCanvas, phys, rng, setFade, type InstSpec } from './kit';
import { drawDie, type Die } from './dieshot';

export interface DieLevelOpts {
  die: Die;
  /** Dicke des Dies in mm */
  thick: number;
  texW: number;
  /** Träger unter dem Die (mm) */
  substrate?: { w: number; d: number; t: number; color: number; caps?: number };
  /** Umdrehen (Flip-Chip): Bereich in z, in dem sich das Die herumdreht */
  flip?: [number, number];
  /** Drahtbonds vom Pad-Streifen zum Träger (DRAM) */
  bonds?: { y: number; n: number };
  labels: LabelDef[];
  extra?(root: THREE.Group, anims: ((f: Frame) => void)[], ctx: BuildCtx): void;
}

export function frontMaterial(tex: THREE.Texture) {
  return phys({
    map: tex,
    metalness: 0.45,
    roughness: 0.3,
    iridescence: 0.5,
    iridescenceIOR: 1.45,
    iridescenceThicknessMinimum: 220,
    iridescenceThicknessMaximum: 520,
    clearcoat: 0.25,
    clearcoatRoughness: 0.3,
    bumpMap: tex,
    bumpScale: 0.002,
  });
}

/** Das ganze Die (Einheit: mm). Ursprung = Mitte der Oberseite. Textur-x → lokal x, Textur-y → lokal z. */
export function buildDieLevel(ctx: BuildCtx, o: DieLevelOpts): Built {
  const root = new THREE.Group();
  const anims: ((f: Frame) => void)[] = [];
  const d = o.die;
  const H = Math.round((o.texW * d.h) / d.w);
  const { cv, g } = makeCanvas(o.texW, H);
  drawDie(g, d, 0, 0, d.w, d.h, o.texW, H);
  const tex = canvasTex(cv, ctx.aniso);
  const front = frontMaterial(tex);
  const back = MAT.silicon({ iridescence: 0.2, roughness: 0.32, envMapIntensity: 0.55 });
  const side = MAT.silicon({ iridescence: 0, roughness: 0.5, metalness: 0.5 });
  // Box-Flächen: +x, −x, +y (Vorderseite), −y (Rückseite), +z, −z
  const slab = new THREE.Mesh(new THREE.BoxGeometry(d.w, o.thick, d.h), [side, side, front, back, side, side]);
  // Textur liegt auf +y; BoxGeometry-UV der +y-Fläche: u entlang x, v entlang −z → passt zu Leinwand oben = −z
  const pivot = new THREE.Group();
  pivot.position.y = -o.thick / 2;
  slab.position.y = 0;
  pivot.add(slab);
  root.add(pivot);
  if (o.substrate) {
    const s = o.substrate;
    root.add(boxOn(s.w, s.t, s.d, MAT.substrate({ color: s.color }), 0, -o.thick - 0.08 - s.t, 0, 0.2));
    // Lot-Schicht (Underfill) unter dem Die
    root.add(boxOn(d.w + 0.6, 0.08, d.h + 0.6, MAT.epoxy({ color: 0x2c2a26, roughness: 0.4 }), 0, -o.thick - 0.08, 0, 0.05));
    if (s.caps) {
      const caps: InstSpec[] = [];
      const r = rng(31);
      for (let i = 0; i < s.caps; i++) {
        let x = 0;
        let z = 0;
        do {
          x = r.range(-s.w / 2 + 1, s.w / 2 - 1);
          z = r.range(-s.d / 2 + 1, s.d / 2 - 1);
        } while (Math.abs(x) < d.w / 2 + 0.8 && Math.abs(z) < d.h / 2 + 0.8);
        caps.push({ p: [x, -o.thick - 0.08 + 0.25, z], s: r.chance(0.5) ? [1, 0.5, 0.5] : [0.5, 0.5, 1] });
      }
      root.add(inst(new THREE.BoxGeometry(1, 1, 1), MAT.ceramic({ roughness: 0.45 }), caps));
    }
  }
  if (o.bonds) {
    const gold = MAT.gold({ roughness: 0.2 });
    const geos: THREE.BufferGeometry[] = [];
    for (let i = 0; i < o.bonds.n; i++) {
      const x = -d.w / 2 + 0.6 + i * ((d.w - 1.2) / (o.bonds.n - 1));
      const z0 = o.bonds.y - d.h / 2;
      for (const sgn of [-1, 1]) {
        const a = new THREE.Vector3(x, 0.01, z0 + sgn * 0.05);
        const b = new THREE.Vector3(x + sgn * 0.1, -o.thick - 0.1, z0 + sgn * (d.h / 2 + 1.0));
        const c = new THREE.Vector3(x, 0.45, z0 + sgn * 0.6);
        geos.push(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a, c, b), 24, 0.0125, 6));
      }
    }
    for (const gg of geos) root.add(new THREE.Mesh(gg, gold));
  }
  if (o.flip) {
    const [z0, z1] = o.flip;
    anims.push((f) => {
      const k = smoothstep(z0, z1, f.z);
      pivot.rotation.x = Math.PI * (1 - k);
      pivot.position.y = -o.thick / 2 + Math.sin(Math.PI * k) * d.h * 0.18;
    });
  }
  o.extra?.(root, anims, ctx);
  const pickPlane = new THREE.Mesh(new THREE.PlaneGeometry(d.w * 3, d.h * 3), new THREE.MeshBasicMaterial({ visible: false }));
  pickPlane.rotation.x = -Math.PI / 2;
  root.add(pickPlane);
  return {
    root,
    labels: o.labels,
    pick: [pickPlane],
    update: (f) => anims.forEach((a) => a(f)),
  };
}

export interface TexLevelOpts {
  die: Die;
  /** Mittelpunkt (Ursprung der Ebene) in Chip-Koordinaten, mm */
  cx: number;
  cy: number;
  /** Ausschnittgröße in mm */
  size: number;
  texW: number;
  labels: LabelDef[];
  /** Einheit der Ebene relativ zu mm (µm → 1000) */
  scale: number;
  extra?(root: THREE.Group, anims: ((f: Frame) => void)[], ctx: BuildCtx): void;
  relief?: number;
}

/** Vergrößerter Ausschnitt eines Chips, neu gezeichnet in hoher Auflösung. */
export function buildTexLevel(ctx: BuildCtx, o: TexLevelOpts): Built {
  const root = new THREE.Group();
  const anims: ((f: Frame) => void)[] = [];
  const half = o.size / 2;
  const x0 = Math.max(0, o.cx - half);
  const x1 = Math.min(o.die.w, o.cx + half);
  const y0 = Math.max(0, o.cy - half);
  const y1 = Math.min(o.die.h, o.cy + half);
  const W = o.texW;
  const H = Math.round((W * (y1 - y0)) / (x1 - x0));
  const { cv, g } = makeCanvas(W, H);
  drawDie(g, o.die, x0, y0, x1, y1, W, H);
  const tex = canvasTex(cv, ctx.aniso);
  const mat = frontMaterial(tex);
  mat.bumpScale = o.relief ?? 0.4;
  const plane = new THREE.Mesh(new THREE.PlaneGeometry((x1 - x0) * o.scale, (y1 - y0) * o.scale), mat);
  plane.rotation.x = -Math.PI / 2;
  plane.position.set(((x0 + x1) / 2 - o.cx) * o.scale, 0, ((y0 + y1) / 2 - o.cy) * o.scale);
  root.add(plane);
  o.extra?.(root, anims, ctx);
  return { root, labels: o.labels, pick: [plane], update: (f) => anims.forEach((a) => a(f)) };
}

export { setFade };
