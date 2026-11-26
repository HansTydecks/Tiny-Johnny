/** Werkzeugkasten für alle Szenen: Zufall, Leinwand-Texturen, Materialien, Instanzen. */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export { THREE };

/** Reproduzierbarer Zufall (mulberry32) – jede Szene sieht bei jedem Besuch gleich aus. */
export function rng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (a0: number, b0: number) => a0 + (b0 - a0) * next(),
    int: (a0: number, b0: number) => Math.floor(a0 + (b0 - a0 + 1) * next()),
    pick: <T,>(arr: readonly T[]): T => arr[Math.floor(next() * arr.length)],
    chance: (p: number) => next() < p,
    gauss: () => {
      const u = Math.max(1e-9, next());
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * next());
    },
  };
}
export type Rng = ReturnType<typeof rng>;

export function makeCanvas(w: number, h: number) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const g = cv.getContext('2d')!;
  return { cv, g };
}

export function canvasTex(cv: HTMLCanvasElement, aniso: number, srgb = true): THREE.CanvasTexture {
  const tx = new THREE.CanvasTexture(cv);
  tx.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tx.anisotropy = aniso;
  tx.generateMipmaps = true;
  tx.minFilter = THREE.LinearMipmapLinearFilter;
  tx.magFilter = THREE.LinearFilter;
  tx.needsUpdate = true;
  return tx;
}

/** Feines Rauschen als Rauheits-/Bumptextur (kachelbar). */
export function noiseTex(size: number, aniso: number, seed: number, lo = 90, hi = 200, blur = 0): THREE.CanvasTexture {
  const { cv, g } = makeCanvas(size, size);
  const img = g.createImageData(size, size);
  const r = rng(seed);
  for (let i = 0; i < size * size; i++) {
    const v = lo + (hi - lo) * r.next();
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  if (blur) {
    g.filter = `blur(${blur}px)`;
    g.drawImage(cv, 0, 0);
    g.filter = 'none';
  }
  const tx = canvasTex(cv, aniso, false);
  tx.wrapS = tx.wrapT = THREE.RepeatWrapping;
  return tx;
}

type StdParams = THREE.MeshStandardMaterialParameters;
type PhysParams = THREE.MeshPhysicalMaterialParameters;

export const std = (p: StdParams) => new THREE.MeshStandardMaterial(p);
export const phys = (p: PhysParams) => new THREE.MeshPhysicalMaterial(p);

/** Materialbibliothek – Farben und Werte nach echten Oberflächen. */
export const MAT = {
  copper: (o: StdParams = {}) => std({ color: 0xd88a5e, metalness: 1, roughness: 0.3, ...o }),
  gold: (o: StdParams = {}) => std({ color: 0xf2c060, metalness: 1, roughness: 0.22, ...o }),
  silver: (o: StdParams = {}) => std({ color: 0xd9dde2, metalness: 1, roughness: 0.25, ...o }),
  nickel: (o: StdParams = {}) => std({ color: 0xc9ccd0, metalness: 1, roughness: 0.3, ...o }),
  steel: (o: StdParams = {}) => std({ color: 0xa9adb3, metalness: 1, roughness: 0.38, ...o }),
  alu: (o: StdParams = {}) => std({ color: 0xb8bcc2, metalness: 1, roughness: 0.42, ...o }),
  aluDark: (o: StdParams = {}) => std({ color: 0x55595f, metalness: 0.9, roughness: 0.45, ...o }),
  tungsten: (o: StdParams = {}) => std({ color: 0x9fa4ab, metalness: 1, roughness: 0.35, ...o }),
  tin: (o: StdParams = {}) => std({ color: 0xc2c4c4, metalness: 1, roughness: 0.4, ...o }),
  plastic: (color: number, o: StdParams = {}) => std({ color, metalness: 0, roughness: 0.55, ...o }),
  epoxy: (o: StdParams = {}) => std({ color: 0x1a1b1d, metalness: 0, roughness: 0.72, ...o }),
  ceramic: (o: StdParams = {}) => std({ color: 0xb59a74, metalness: 0, roughness: 0.6, ...o }),
  ferrite: (o: StdParams = {}) => std({ color: 0x4a4c50, metalness: 0.2, roughness: 0.75, ...o }),
  substrate: (o: StdParams = {}) => std({ color: 0x2e5a3a, metalness: 0.05, roughness: 0.5, ...o }),
  /** Silizium: spiegelnd grau mit Interferenzfarben wie bei echten Wafern */
  silicon: (o: PhysParams = {}) =>
    phys({
      color: 0x7d838e,
      metalness: 0.75,
      roughness: 0.26,
      envMapIntensity: 0.5,
      iridescence: 0.55,
      iridescenceIOR: 1.6,
      iridescenceThicknessMinimum: 200,
      iridescenceThicknessMaximum: 600,
      ...o,
    }),
  glass: (o: PhysParams = {}) =>
    phys({ color: 0xbfd8ff, metalness: 0, roughness: 0.15, transmission: 0, transparent: true, opacity: 0.35, ...o }),
};

export function rbox(w: number, h: number, d: number, r: number, seg = 2): THREE.BufferGeometry {
  const rr = Math.min(r, w / 2 - 1e-6, h / 2 - 1e-6, d / 2 - 1e-6);
  return new RoundedBoxGeometry(w, h, d, seg, Math.max(rr, 1e-6));
}

export function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}

/** Quader mit Unterkante auf y0 (praktisch für alles, was auf einer Fläche liegt). */
export function boxOn(w: number, h: number, d: number, mat: THREE.Material, x: number, y0: number, z: number, r = 0) {
  const geo = r > 0 ? rbox(w, h, d, r) : new THREE.BoxGeometry(w, h, d);
  return mesh(geo, mat, x, y0 + h / 2, z);
}

export interface InstSpec {
  p: [number, number, number];
  s?: [number, number, number];
  r?: [number, number, number];
  q?: THREE.Quaternion;
  c?: THREE.ColorRepresentation;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();

export function setInst(im: THREE.InstancedMesh, i: number, it: InstSpec) {
  _p.set(it.p[0], it.p[1], it.p[2]);
  if (it.q) _q.copy(it.q);
  else if (it.r) _q.setFromEuler(_e.set(it.r[0], it.r[1], it.r[2]));
  else _q.identity();
  if (it.s) _s.set(it.s[0], it.s[1], it.s[2]);
  else _s.set(1, 1, 1);
  _m.compose(_p, _q, _s);
  im.setMatrixAt(i, _m);
  if (it.c !== undefined) im.setColorAt(i, _c.set(it.c));
}

/** Viele gleiche Teile (Kondensatoren, Atome, Leitungen …) als eine Instanz-Gruppe. */
export function inst(geo: THREE.BufferGeometry, mat: THREE.Material, items: InstSpec[]): THREE.InstancedMesh {
  const im = new THREE.InstancedMesh(geo, mat, Math.max(1, items.length));
  im.count = items.length;
  items.forEach((it, i) => setInst(im, i, it));
  im.instanceMatrix.needsUpdate = true;
  if (im.instanceColor) im.instanceColor.needsUpdate = true;
  im.frustumCulled = false;
  return im;
}

/** Weicher Kontaktschatten (radialer Verlauf) als Bodenplatte. */
let shadowCanvas: HTMLCanvasElement | null = null;
export function shadowTex(aniso: number) {
  if (!shadowCanvas) {
    const { cv, g } = makeCanvas(256, 256);
    const gr = g.createRadialGradient(128, 128, 10, 128, 128, 128);
    gr.addColorStop(0, 'rgba(0,0,0,0.85)');
    gr.addColorStop(0.45, 'rgba(0,0,0,0.5)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 256, 256);
    shadowCanvas = cv;
  }
  return canvasTex(shadowCanvas, aniso, false);
}

export function contactShadow(w: number, d: number, aniso: number, opacity = 0.6, y = 0.02): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshBasicMaterial({ map: shadowTex(aniso), transparent: true, opacity, depthWrite: false, color: 0x000000 }),
  );
  m.material.alphaMap = m.material.map;
  m.material.map = null;
  m.rotation.x = -Math.PI / 2;
  m.position.y = y;
  m.renderOrder = -1;
  return m;
}

/** Text auf eine kleine Textur schreiben (Bauteilaufdrucke, Siebdruck). */
export function textTex(
  lines: string[],
  opts: { w?: number; h?: number; color?: string; bg?: string; font?: string; aniso: number; align?: CanvasTextAlign },
): THREE.CanvasTexture {
  const w = opts.w ?? 512;
  const h = opts.h ?? 256;
  const { cv, g } = makeCanvas(w, h);
  if (opts.bg) {
    g.fillStyle = opts.bg;
    g.fillRect(0, 0, w, h);
  }
  g.fillStyle = opts.color ?? '#d8d8d8';
  g.textAlign = opts.align ?? 'center';
  g.textBaseline = 'middle';
  const fs = Math.floor(h / (lines.length + 0.8));
  g.font = opts.font ?? `600 ${fs}px "JetBrains Mono Variable", monospace`;
  lines.forEach((l, i) => g.fillText(l, opts.align === 'left' ? w * 0.06 : w / 2, (h / (lines.length + 0.2)) * (i + 0.6)));
  return canvasTex(cv, opts.aniso);
}

/** Fügt einer Standard-Material ein leichtes thermisches Zittern pro Instanz hinzu (Atome). */
export function jitterMaterial<T extends THREE.MeshStandardMaterial>(mat: T, amp: number, speed = 7): T & { userData: { time: { value: number } } } {
  const time = { value: 0 };
  mat.userData.time = time;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = time;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>\nuniform float uTime;`)
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          float fi = float(gl_InstanceID);
          vec3 jit = vec3(sin(uTime*${speed.toFixed(2)}*1.13 + fi*12.9898), sin(uTime*${speed.toFixed(2)}*0.97 + fi*78.233), sin(uTime*${speed.toFixed(2)}*1.31 + fi*37.719));
          transformed += jit * ${amp.toExponential(3)} / max(1e-6, length(instanceMatrix[0].xyz));
        #endif`,
      );
  };
  return mat as T & { userData: { time: { value: number } } };
}

/** Zylinder zwischen zwei Punkten (für Bindungen, Drähte, Beine). */
export function cylBetween(a: THREE.Vector3, b: THREE.Vector3, r: number): InstSpec {
  const d = new THREE.Vector3().subVectors(b, a);
  const len = d.length();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  const m = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
  return { p: [m.x, m.y, m.z], s: [r, len, r], q };
}

/** Material-Teilausblendung: wird vom Renderer mit der Ebenen-Deckkraft multipliziert. */
export function setFade(obj: THREE.Object3D | THREE.Material | THREE.Material[], a: number) {
  const apply = (m: THREE.Material) => (m.userData.fade = a);
  if (Array.isArray(obj)) obj.forEach(apply);
  else if ((obj as THREE.Material).isMaterial) apply(obj as THREE.Material);
  else
    (obj as THREE.Object3D).traverse((o) => {
      const mm = (o as THREE.Mesh).material;
      if (mm) (Array.isArray(mm) ? mm : [mm]).forEach(apply);
    });
}

export function group(...children: THREE.Object3D[]) {
  const g = new THREE.Group();
  children.forEach((c) => g.add(c));
  return g;
}
