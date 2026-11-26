/**
 * Die Zoom-Maschine.
 *
 * Jede Ebene (Platine, Chip, Kern, Leiterbahnen, Transistoren, Atome …) hat ihr eigenes
 * Koordinatensystem in „passenden“ Einheiten (mm, µm, nm). Kamera und Ebenen-Lagen werden in
 * doppelter Genauigkeit (JavaScript-Zahlen, Meter) gerechnet und erst kurz vor dem Zeichnen relativ zur
 * Kamera umgerechnet – geteilt durch den Kameraabstand. Deshalb sieht die GPU immer nur Zahlen um 1 herum,
 * egal ob gerade 30 cm oder 0,3 nm im Bild sind. Jede Ebene wird in einem eigenen Durchgang gezeichnet
 * (grob → fein, Tiefenpuffer dazwischen gelöscht).
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { Built, Frame, LabelDef, LevelDef, Vec3 } from './types';
import {
  clamp,
  damp,
  dampAngle,
  density,
  fadeIn,
  fovToDistance,
  formatLength,
  niceLength,
  smoothstep,
  stepZoom,
  wheelImpulse,
  type I18n,
  type Lang,
} from './zoom';

const VFOV = 38;
const Z_MAX = 0.02;
const DEG = Math.PI / 180;

export interface HudLabel {
  key: string;
  x: number;
  y: number;
  text: I18n;
  size?: number;
  kind: 'part' | 'life';
  alpha: number;
}

export interface HudState {
  z: number;
  fov: number;
  bar: { px: number; m: number };
  chain: { id: string; title: I18n }[];
  caption: I18n | null;
  captionKey: string;
  labels: HudLabel[];
  auto: string | null;
  hint: boolean;
  /** Bauteil unter dem Mauszeiger (Infokarte) */
  hover: { id: string; x: number; y: number } | null;
}

interface Mat {
  m: THREE.Material;
  base: number;
  transparent: boolean;
  shown: boolean;
}

interface Level {
  def: LevelDef;
  parent: Level | null;
  children: Level[];
  anchor: Vec3;
  pos: THREE.Vector3; // Meter, Welt
  quat: THREE.Quaternion;
  built: Built | null;
  scene: THREE.Scene | null;
  holder: THREE.Group | null;
  mats: Mat[];
  alpha: number;
  lastUsed: number;
  depth: number;
  dynReady: boolean;
}

type Auto =
  | { kind: 'dive'; path: string[] }
  | { kind: 'to'; id: string; z: number }
  | null;

const v3 = () => new THREE.Vector3();

export class ScaleEngine {
  readonly renderer: THREE.WebGLRenderer;
  private camera = new THREE.PerspectiveCamera(VFOV, 1, 0.02, 80);
  private levels = new Map<string, Level>();
  private root: Level;
  private env: THREE.Texture;
  private aniso: number;

  // Kamera (doppelt genau, Meter)
  private target = new THREE.Vector3(0.03, 0, 0.0);
  z = -0.38;
  private zVel = 0;
  private yaw = 2.7;
  private pitch = 52 * DEG;
  private frameQ = new THREE.Quaternion();
  private camPos = v3();
  private camQ = new THREE.Quaternion();
  private dist = 1;

  private chain: Level[] = [];
  private cand: Level | null = null;
  private candW = 0;
  private zoomPoint: THREE.Vector3 | null = null;
  /** Bauteil, auf das gezoomt wird: zieht unabhängig vom Abstand zu seinem Chip */
  private intent: Level | null = null;
  /** Mauszeiger zeigte auf die nackte Platine → Platinen-Zoom erlaubt */
  private pcbIntent = false;
  /** Treffpunkt auf der Platine – dort wird der Platinen-Ausschnitt verankert */
  private pcbPoint: THREE.Vector3 | null = null;
  private hoverId: string | null = null;
  private hoverObj: THREE.Object3D | null = null;
  private hoverT = 0;
  private hoverSticky = 0;
  private brackets: THREE.LineSegments | null = null;
  private tapStart: { x: number; y: number; t: number } | null = null;
  private pointer = { x: 0, y: 0, inside: false };
  private lastUser = -1e9;
  private lastDrag = -1e9;
  private viewGoal: { pitch?: number; yaw?: number } = { pitch: 52 * DEG, yaw: 2.7 };
  private viewFor = '';
  private auto: Auto = null;
  private t = 0;
  private w = 1;
  private h = 1;
  private pixelRatio = 1;
  private frameTimes: number[] = [];
  private raf = 0;
  private lastNow = 0;
  private reduced = false;
  lang: Lang = 'de';
  private touched = false;
  private bgCol = new THREE.Color(0x0b0f18);
  private raycaster = new THREE.Raycaster();

  onState: (s: HudState) => void = () => {};

  constructor(
    private canvas: HTMLCanvasElement,
    defs: LevelDef[],
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.autoClear = false;
    this.renderer.setClearColor(0x000000, 0);
    this.aniso = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    for (const d of defs) {
      this.levels.set(d.id, {
        def: d,
        parent: null,
        children: [],
        anchor: [...d.anchor] as Vec3,
        pos: v3(),
        quat: new THREE.Quaternion(),
        built: null,
        scene: null,
        holder: null,
        mats: [],
        alpha: 0,
        lastUsed: 0,
        depth: 0,
        dynReady: !d.dynamic,
      });
    }
    let root: Level | null = null;
    for (const l of this.levels.values()) {
      if (l.def.parent) {
        const p = this.levels.get(l.def.parent);
        if (!p) throw new Error(`Ebene ${l.def.id}: Eltern ${l.def.parent} fehlt`);
        l.parent = p;
        p.children.push(l);
      } else root = l;
    }
    if (!root) throw new Error('Keine Wurzelebene');
    this.root = root;
    const setDepth = (l: Level, d: number) => {
      l.depth = d;
      l.children.forEach((c) => setDepth(c, d + 1));
    };
    setDepth(root, 0);
    this.updateTransforms(root);
    this.chain = [root];
    this.bindInput();
  }

  // ───────────────────────────── Lage der Ebenen ─────────────────────────────

  private updateTransforms(l: Level) {
    if (l.parent) {
      const p = l.parent;
      const off = new THREE.Vector3(l.anchor[0], l.anchor[1], l.anchor[2]).multiplyScalar(p.def.unit).applyQuaternion(p.quat);
      l.pos.copy(p.pos).add(off);
      const r = l.def.rot ?? [0, 0, 0];
      l.quat.copy(p.quat).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(r[0], r[1], r[2])));
    } else {
      l.pos.set(0, 0, 0);
      l.quat.identity();
    }
    l.children.forEach((c) => this.updateTransforms(c));
  }

  private toLocal(l: Level, wpt: THREE.Vector3): Vec3 {
    const v = wpt.clone().sub(l.pos).applyQuaternion(l.quat.clone().invert()).divideScalar(l.def.unit);
    return [v.x, v.y, v.z];
  }

  private dist2(l: Level): number {
    return this.target.distanceTo(l.pos);
  }

  /** Wie nah ist das Blickziel an einer Ebene? 1 = eingerastet. */
  private nearW(l: Level): number {
    if (this.chain.includes(l)) return 1;
    if (!l.dynReady) return 0;
    return smoothstep(l.def.pullR, l.def.catchR * 0.5, this.dist2(l));
  }

  // ───────────────────────────── Bauen & Aufräumen ─────────────────────────────

  private ensureBuilt(l: Level) {
    if (l.built) return;
    const built = l.def.build({ aniso: this.aniso, anchor: l.anchor });
    const scene = new THREE.Scene();
    scene.environment = this.env;
    scene.environmentIntensity = 0.9;
    const hemi = new THREE.HemisphereLight(0xe6eeff, 0x1c2030, 0.55);
    const key = new THREE.DirectionalLight(0xfff1e0, 2.1);
    key.position.set(0.6, 1.4, 0.9);
    const rim = new THREE.DirectionalLight(0x9fc4ff, 0.9);
    rim.position.set(-1.2, 0.5, -0.9);
    scene.add(hemi, key, rim);
    scene.fog = new THREE.Fog(this.bgCol.getHex(), 5, 22);
    const holder = new THREE.Group();
    holder.matrixAutoUpdate = true;
    holder.add(built.root);
    scene.add(holder);
    const seen = new Set<THREE.Material>();
    const mats: Mat[] = [];
    holder.traverse((o) => {
      const mm = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
      if (!mm) return;
      for (const m of Array.isArray(mm) ? mm : [mm]) {
        if (seen.has(m)) continue;
        seen.add(m);
        if (m.userData.fade === undefined) m.userData.fade = 1;
        mats.push({ m, base: m.opacity, transparent: m.transparent, shown: m.visible });
      }
    });
    l.built = built;
    l.scene = scene;
    l.holder = holder;
    l.mats = mats;
    l.lastUsed = this.t;
  }

  private disposeLevel(l: Level) {
    if (!l.built) return;
    l.built.dispose?.();
    l.holder?.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose?.();
      const mm = m.material as THREE.Material | THREE.Material[] | undefined;
      if (mm)
        for (const mat of Array.isArray(mm) ? mm : [mm]) {
          for (const k of Object.keys(mat)) {
            const v = (mat as unknown as Record<string, unknown>)[k];
            if (v && (v as THREE.Texture).isTexture) (v as THREE.Texture).dispose();
          }
          mat.dispose();
        }
    });
    l.built = null;
    l.scene = null;
    l.holder = null;
    l.mats = [];
  }

  // ───────────────────────────── Eingabe ─────────────────────────────

  private handlers: [EventTarget, string, EventListener, AddEventListenerOptions?][] = [];
  private on<K extends string>(el: EventTarget, ev: K, fn: (e: never) => void, opt?: AddEventListenerOptions) {
    el.addEventListener(ev, fn as EventListener, opt);
    this.handlers.push([el, ev, fn as EventListener, opt]);
  }

  private pointers = new Map<number, { x: number; y: number; button: number }>();
  private pinch: { d: number; cx: number; cy: number } | null = null;

  private bindInput() {
    const c = this.canvas;
    this.on(
      c,
      'wheel',
      (e: WheelEvent) => {
        e.preventDefault();
        this.userAct();
        const r = c.getBoundingClientRect();
        this.pointer = { x: e.clientX - r.left, y: e.clientY - r.top, inside: true };
        if (e.deltaY < 0 || !this.zoomPoint) {
          this.zoomPoint = this.pickWorld(this.pointer.x, this.pointer.y);
          if (e.deltaY < 0) this.aimAt(this.pointer.x, this.pointer.y);
        }
        const dens = this.densityNow();
        this.zVel += wheelImpulse(e.deltaY, e.deltaMode, this.zVel) * (0.55 + 0.45 * dens);
        this.zVel = clamp(this.zVel, -3.2, 3.2);
      },
      { passive: false },
    );
    this.on(c, 'pointerdown', (e: PointerEvent) => {
      c.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, button: e.button });
      this.tapStart = { x: e.clientX, y: e.clientY, t: this.t };
      this.userAct();
      this.lastDrag = this.t;
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
        const r = c.getBoundingClientRect();
        this.zoomPoint = this.pickWorld(this.pinch.cx - r.left, this.pinch.cy - r.top);
        this.aimAt(this.pinch.cx - r.left, this.pinch.cy - r.top);
      }
    });
    const up = (e: PointerEvent) => {
      // kurzes Antippen (Touch) zeigt die Infokarte
      if (this.tapStart && e.pointerType !== 'mouse' && this.t - this.tapStart.t < 0.35) {
        const r = c.getBoundingClientRect();
        this.pointer = { x: e.clientX - r.left, y: e.clientY - r.top, inside: true };
        this.hoverT = -1;
        this.hoverSticky = this.t + 4;
      }
      this.tapStart = null;
      this.pointers.delete(e.pointerId);
      if (this.pointers.size < 2) this.pinch = null;
    };
    this.on(c, 'pointerup', up);
    this.on(c, 'pointercancel', up);
    this.on(c, 'pointermove', (e: PointerEvent) => {
      const r = c.getBoundingClientRect();
      this.pointer = { x: e.clientX - r.left, y: e.clientY - r.top, inside: true };
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      if (this.tapStart && Math.hypot(e.clientX - this.tapStart.x, e.clientY - this.tapStart.y) > 6) this.tapStart = null;
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      p.x = e.clientX;
      p.y = e.clientY;
      this.userAct();
      this.lastDrag = this.t;
      if (this.pointers.size === 2 && this.pinch) {
        const [a, b] = [...this.pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d > 0 && this.pinch.d > 0) {
          const dz = -Math.log10(d / this.pinch.d);
          this.applyZoomDelta(dz, true);
          this.zVel = clamp(dz / Math.max(0.016, 1 / 60), -2, 2) * 0.3;
        }
        this.pinch.d = d;
        return;
      }
      if (p.button === 2 || e.shiftKey) this.pan(dx, dy);
      else {
        this.yaw -= dx * 0.0055;
        this.pitch = clamp(this.pitch + dy * 0.0045, this.minPitch(), 89.5 * DEG);
      }
    });
    this.on(c, 'contextmenu', (e: Event) => e.preventDefault());
    this.on(c, 'pointerleave', () => {
      this.pointer.inside = false;
    });
    this.on(window, 'keydown', (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      let used = true;
      if (e.key === '+' || e.key === '=' || e.key === 'PageDown') this.keyZoom(-1);
      else if (e.key === '-' || e.key === '_' || e.key === 'PageUp') this.keyZoom(1);
      else if (e.key === 'ArrowLeft') this.yaw += 0.12;
      else if (e.key === 'ArrowRight') this.yaw -= 0.12;
      else if (e.key === 'ArrowUp') this.pitch = clamp(this.pitch + 0.08, this.minPitch(), 89.5 * DEG);
      else if (e.key === 'ArrowDown') this.pitch = clamp(this.pitch - 0.08, this.minPitch(), 89.5 * DEG);
      else if (e.key === 'Escape') this.up();
      else used = false;
      if (used) {
        e.preventDefault();
        this.userAct();
        this.lastDrag = this.t;
      }
    });
  }

  private keyZoom(dir: number) {
    this.zoomPoint = null;
    this.zVel = clamp(this.zVel + dir * 0.9, -3, 3);
  }

  private userAct() {
    this.lastUser = this.t;
    this.auto = null;
    this.touched = true;
  }

  private pan(dx: number, dy: number) {
    this.intent = null;
    const W = Math.pow(10, this.z);
    const k = W / Math.min(this.w, this.h);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camQ);
    const upv = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camQ);
    this.target.addScaledVector(right, -dx * k).addScaledVector(upv, dy * k);
  }

  /** Welches Bauteil der Platine liegt unter dem Punkt? (nur solange die Platine zu sehen ist) */
  private pickPart(px: number, py: number): { id: string; obj: THREE.Object3D; point: THREE.Vector3 } | null {
    if (!this.root.built?.pick || this.root.alpha < 0.5) return null;
    const ndc = new THREE.Vector2((px / this.w) * 2 - 1, -(py / this.h) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObjects(this.root.built.pick, true);
    for (const h of hits) {
      let o: THREE.Object3D | null = h.object;
      while (o && !o.userData.part) o = o.parent;
      if (o && (o as THREE.Mesh).visible !== false) return { id: o.userData.part as string, obj: o, point: this.camPos.clone().addScaledVector(h.point, this.dist) };
    }
    return null;
  }

  /** Beim Hineinzoomen: Zielt der Zeiger auf ein zoombares Bauteil oder auf die nackte Platine? */
  private aimAt(px: number, py: number) {
    if (this.chain.length > 1 && this.chain[1].def.dynamic === undefined) return; // schon in einem Bauteil
    const hit = this.pickPart(px, py);
    if (!hit) return;
    const zoomTo = this.partZoom?.(hit.id);
    if (zoomTo) {
      this.intent = this.levels.get(zoomTo) ?? null;
      this.pcbIntent = false;
    } else {
      this.intent = null;
      this.pcbIntent = hit.id === 'pcb';
      this.pcbPoint = this.pcbIntent ? hit.point : null;
    }
  }

  /** Wird von außen gesetzt: Bauteil-ID → Ziel-Ebene */
  partZoom: ((id: string) => string | undefined) | null = null;

  /** Welt-Punkt unter dem Mauszeiger (zuerst echte Geometrie, sonst die Ebene durch das Blickziel). */
  private pickWorld(px: number, py: number): THREE.Vector3 {
    const ndc = new THREE.Vector2((px / this.w) * 2 - 1, -(py / this.h) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const rendered = [...this.chain].reverse();
    for (const l of rendered) {
      if (!l.built?.pick || l.alpha < 0.5) continue;
      const hits = this.raycaster.intersectObjects(l.built.pick, true);
      if (hits.length) return this.camPos.clone().addScaledVector(hits[0].point, this.dist);
    }
    const dir = this.raycaster.ray.direction.clone(); // in Kameraraum = Weltrichtung (Kamera steht im Ursprung)
    const n = new THREE.Vector3(0, 1, 0).applyQuaternion(this.frameQ);
    const denom = n.dot(dir);
    const toT = this.target.clone().sub(this.camPos);
    let tt = Math.abs(denom) > 1e-4 ? n.dot(toT) / denom : toT.length();
    if (!(tt > 0) || tt > this.dist * 6) tt = toT.length();
    return this.camPos.clone().addScaledVector(dir, tt);
  }

  private minPitch(): number {
    const deep = this.chain[this.chain.length - 1];
    return (deep.def.view?.minPitch ?? 8) * DEG;
  }

  private densityNow(): number {
    const marks: number[] = [];
    const deep = this.chain[this.chain.length - 1];
    for (const l of [deep, this.cand]) if (l && l !== this.root) marks.push(l.def.zIn - 0.32);
    for (const c of deep.children) if (c.dynReady && this.dist2(c) < c.def.pullR) marks.push(c.def.zIn - 0.32);
    return density(this.z, marks);
  }

  // ───────────────────────────── Steuerung von außen ─────────────────────────────

  /** Automatischer Tauchgang bis zu den Atomen. */
  dive(leafId: string) {
    const path: string[] = [];
    let l = this.levels.get(leafId) ?? null;
    while (l) {
      path.unshift(l.def.id);
      l = l.parent;
    }
    this.auto = { kind: 'dive', path };
    this.intent = null;
    this.zVel = 0;
    this.touched = true;
  }

  flyTo(id: string) {
    const l = this.levels.get(id);
    if (!l) return;
    const z = l === this.root ? -0.38 : l.def.zIn - 0.55;
    this.auto = { kind: 'to', id, z };
    this.zVel = 0;
    this.touched = true;
  }

  up() {
    const deep = this.chain[this.chain.length - 1];
    if (deep.parent) this.flyTo(deep.parent.def.id);
    else this.flyTo(this.root.def.id);
  }

  reset() {
    this.flyTo(this.root.def.id);
  }

  setLang(l: Lang) {
    this.lang = l;
  }

  // ───────────────────────────── Bild-Schleife ─────────────────────────────

  start() {
    const loop = (now: number) => {
      this.raf = requestAnimationFrame(loop);
      const dt = this.lastNow ? Math.min(0.05, (now - this.lastNow) / 1000) : 1 / 60;
      this.lastNow = now;
      this.frame(dt);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    cancelAnimationFrame(this.raf);
  }

  resize(w: number, h: number) {
    this.w = Math.max(1, w);
    this.h = Math.max(1, h);
    this.renderer.setSize(this.w, this.h, false);
    this.camera.aspect = this.w / this.h;
    this.camera.updateProjectionMatrix();
  }

  dispose() {
    this.stop();
    for (const [el, ev, fn, opt] of this.handlers) el.removeEventListener(ev, fn, opt);
    for (const l of this.levels.values()) this.disposeLevel(l);
    this.env.dispose();
    this.renderer.dispose();
  }

  /** Für automatische Tests: direkt an eine Stelle springen. */
  debugJump(id: string, z: number) {
    const l = this.levels.get(id);
    if (!l) return;
    this.auto = null;
    this.zVel = 0;
    this.target.copy(l.pos);
    let p: Level | null = l;
    while (p) {
      if (!p.dynReady) p.dynReady = true;
      p = p.parent;
    }
    this.z = z;
    this.chainUpdate();
    for (let i = 0; i < 90; i++) this.frame(1 / 30, true);
  }

  private applyZoomDelta(dz: number, homothety: boolean) {
    const nz = clamp(this.z + dz, this.floorNow() - 0.05, Z_MAX + 0.05);
    const real = nz - this.z;
    this.z = nz;
    if (homothety && real < 0 && this.zoomPoint) {
      const k = Math.pow(10, real);
      this.target.sub(this.zoomPoint).multiplyScalar(k).add(this.zoomPoint);
    }
  }

  /** Hat die Ebene genau eine Unter-Ebene, führt der Zoom immer dorthin (zentriert wie im Film). */
  private onlyChild(l: Level): Level | null {
    return l.children.length === 1 && !l.children[0].def.dynamic ? l.children[0] : null;
  }

  private floorNow(): number {
    const deep = this.chain[this.chain.length - 1];
    let f = deep.def.floor;
    if (this.cand && this.candW > 0) f = Math.min(f, this.cand.def.zIn - 0.28);
    return f;
  }

  /** Welche Ebenen sind gerade „dran“? Von der Wurzel aus die jeweils passende Unter-Ebene. */
  private chainUpdate() {
    const prev = new Set(this.chain);
    const chain: Level[] = [this.root];
    for (;;) {
      const cur = chain[chain.length - 1];
      // dynamischen Anker (Platine überall) setzen, wenn kein anderes Kind in Reichweite ist
      const blocked = !this.pcbIntent || (this.intent && this.intent.parent === cur);
      for (const c of cur.children) {
        if (!c.def.dynamic || prev.has(c)) continue;
        if (blocked || this.z > c.def.zIn + 0.6) {
          if (c.dynReady && this.z > c.def.zIn + 0.8) c.dynReady = false;
          continue;
        }
        if (c.dynReady) continue;
        const loc = this.toLocal(cur, this.pcbPoint ?? this.target);
        const a = c.def.dynamic(loc);
        if (a) {
          if (c.built) this.disposeLevel(c);
          c.anchor = a;
          this.updateTransforms(c);
          c.dynReady = true;
        }
      }
      let best: Level | null = null;
      let bestD = Infinity;
      for (const c of cur.children) {
        if (!c.dynReady) continue;
        const d = this.dist2(c);
        const keep = prev.has(c) && this.z < c.def.zIn + 0.04 && d < c.def.catchR * 1.6;
        const enter = this.z < c.def.zIn && d < c.def.catchR;
        if ((keep || enter) && d / c.def.catchR < bestD) {
          best = c;
          bestD = d / c.def.catchR;
        }
      }
      if (!best) break;
      chain.push(best);
    }
    this.chain = chain;

    // Anziehung: das nächste Kind der tiefsten Ebene
    const deep = chain[chain.length - 1];
    let cand: Level | null = null;
    let cd = Infinity;
    const autoNext = this.auto?.kind === 'dive' ? this.levels.get(this.auto.path[chain.length] ?? '') : undefined;
    const only = this.onlyChild(deep);
    for (const c of deep.children) {
      if (!c.dynReady) continue;
      const d = this.dist2(c);
      const r = c === only ? 0 : d / c.def.pullR;
      const aimed = c === autoNext || (!autoNext && c === this.intent);
      if ((r < 1 && r < cd && !(this.intent && this.intent.parent === deep)) || aimed) {
        cand = c;
        cd = aimed ? -1 : r;
      }
    }
    this.cand = cand;
    this.candW = cand ? smoothstep(cand.def.zIn + 0.95, cand.def.zIn - 0.02, this.z) * (cd < 0 ? 1 : smoothstep(1, 0.6, cd)) : 0;
    // Absicht vergessen, wenn weit herausgezoomt wurde oder sie erreicht ist
    if (this.intent && (this.z > this.intent.def.zIn + 1.6 || chain.includes(this.intent))) {
      if (!chain.includes(this.intent) || this.z > this.intent.def.zIn + 0.3) this.intent = null;
    }
    if (this.pcbIntent && this.z > -0.9) this.pcbIntent = false;
  }

  private frame(dt: number, silent = false) {
    this.t += dt;
    const zBefore = this.z;

    // ── Autopilot
    if (this.auto) this.autopilot(dt);

    // ── Zoom-Physik
    const dens = this.densityNow();
    const friction = 5.2 * (1 + 1.3 * (1 - dens));
    const st = stepZoom(this.z, this.zVel, dt, this.floorNow(), Z_MAX, friction);
    const dz = st.z - this.z;
    this.zVel = st.vel;
    this.z = st.z;
    const deep0 = this.chain[this.chain.length - 1];
    const only = this.onlyChild(deep0);
    if (dz < 0 && !this.auto) {
      if (only) this.target.lerp(only.pos, clamp(3.2 * -dz, 0, 1));
      else if (this.zoomPoint) {
        const k = Math.pow(10, dz);
        this.target.sub(this.zoomPoint).multiplyScalar(k).add(this.zoomPoint);
      }
    }
    const zMove = this.z - zBefore;

    this.chainUpdate();

    // ── Anziehung zum nächsten Detail
    if (this.cand && this.candW > 0) {
      const auto = this.auto?.kind === 'dive';
      const k = auto ? 1 - Math.exp(-dt * 2.6) : clamp(5.5 * this.candW * Math.max(0, -zMove) + (this.candW > 0.5 ? dt * 0.35 * this.candW : 0), 0, 1);
      // Wer schon tiefer ist, als das Bauteil erscheint, wird zuverlässig hineingezogen
      const late = this.z < this.cand.def.zIn + 0.1 && Math.max(0, -zMove) > 0 ? clamp(dt * 2.5, 0, 1) : 0;
      this.target.lerp(this.cand.pos, Math.min(1, k + late));
      if (this.zoomPoint) this.zoomPoint.lerp(this.cand.pos, k);
    }
    // ── In der tiefsten Ebene bleiben
    const deep = this.chain[this.chain.length - 1];
    if (deep !== this.root) {
      const d = this.dist2(deep);
      const lim = deep.def.catchR * 0.95;
      if (d > lim) this.target.sub(deep.pos).multiplyScalar(lim / d).add(deep.pos);
    } else {
      // Platine: nicht zu weit wegschieben
      const off = this.target.clone();
      if (off.length() > 0.35) this.target.multiplyScalar(0.35 / off.length());
    }

    // ── Orientierung (für senkrechte Bauteile wie Grafikkarte und RAM)
    let fl: Level | null = deep;
    while (fl && !fl.def.frame) fl = fl.parent;
    let goalQ = fl ? fl.quat : this.root.quat;
    if (this.cand?.def.frame && this.candW > 0.2) goalQ = this.cand.quat;
    this.frameQ.slerp(goalQ, 1 - Math.exp(-dt * 2.4));

    // Lieblingsblickwinkel der Ebene
    const viewLevel = this.cand && this.candW > 0.55 && this.cand.def.view ? this.cand : deep;
    if (viewLevel.def.id !== this.viewFor) {
      this.viewFor = viewLevel.def.id;
      if (viewLevel.def.view) this.viewGoal = { pitch: (viewLevel.def.view.pitch ?? 60) * DEG, yaw: viewLevel.def.view.yaw !== undefined ? viewLevel.def.view.yaw * DEG : undefined };
      else this.viewGoal = {};
    }
    const free = this.t - this.lastDrag > 2.5;
    if (free && this.viewGoal.pitch !== undefined) this.pitch = damp(this.pitch, this.viewGoal.pitch, 1.1, dt);
    if (free && this.viewGoal.yaw !== undefined) this.yaw = dampAngle(this.yaw, this.viewGoal.yaw, 0.9, dt);
    this.pitch = clamp(this.pitch, this.minPitch(), 89.5 * DEG);
    // Drehteller in der Übersicht
    if (!this.reduced && deep === this.root && this.z > -0.9 && this.t - this.lastUser > 7 && !this.auto) this.yaw += dt * 0.045;

    // ── Kamera
    const W = Math.pow(10, this.z);
    this.dist = fovToDistance(W, VFOV, this.w / this.h);
    this.camQ
      .copy(this.frameQ)
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw))
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -this.pitch));
    this.camPos.set(0, 0, this.dist).applyQuaternion(this.camQ).add(this.target);
    this.camera.position.set(0, 0, 0);
    this.camera.quaternion.copy(this.camQ);
    this.camera.updateMatrixWorld();

    // ── Ebenen: Deckkraft, Lage, Animation
    const alphas = new Map<Level, number>();
    for (let i = 0; i < this.chain.length; i++) {
      const l = this.chain[i];
      let a = l === this.root ? 1 : fadeIn(this.z, l.def.zIn, 0.3);
      const child = this.chain[i + 1];
      if (child) a *= 1 - smoothstep(child.def.zCover, child.def.zCover - 0.3, this.z);
      alphas.set(l, a);
    }
    // Kandidat vorbauen, damit das Erscheinen nicht ruckelt
    let builtThisFrame = 0;
    if (this.cand && this.candW > 0 && !this.cand.built && !silent) {
      this.ensureBuilt(this.cand);
      builtThisFrame++;
    }

    const bg = this.background(this.z);
    this.bgCol.copy(bg);
    const nearFn = (id: string) => {
      const l = this.levels.get(id);
      return l ? this.nearW(l) : 0;
    };
    const rendered: Level[] = [];
    for (const l of this.chain) {
      const a = alphas.get(l) ?? 0;
      l.alpha = a;
      if (a < 0.002) continue;
      if (!l.built) {
        if (builtThisFrame > 0 && !silent && l !== this.root) continue;
        this.ensureBuilt(l);
        builtThisFrame++;
      }
      l.lastUsed = this.t;
      const hold = l.holder!;
      const s = l.def.unit / this.dist;
      hold.position.copy(l.pos).sub(this.camPos).divideScalar(this.dist);
      hold.quaternion.copy(l.quat);
      hold.scale.setScalar(s);
      hold.updateMatrixWorld(true);
      const camL = this.toLocal(l, this.camPos);
      const tgtL = this.toLocal(l, this.target);
      const f: Frame = { t: this.t, dt, z: this.z, alpha: a, near: nearFn, cam: camL, target: tgtL, reduced: this.reduced, lang: this.lang };
      l.built!.update?.(f);
      for (const mm of l.mats) {
        if (!mm.shown) continue;
        const op = mm.base * a * (mm.m.userData.fade ?? 1);
        mm.m.opacity = op;
        const tr = mm.transparent || op < 0.999;
        if (tr !== mm.m.transparent) mm.m.transparent = tr;
        mm.m.visible = op > 0.004;
      }
      (l.scene!.fog as THREE.Fog).color.copy(bg);
      rendered.push(l);
    }

    // ── Zeichnen
    if (!silent) {
      const r = this.renderer;
      r.clear(true, true, true);
      rendered.forEach((l, i) => {
        if (i > 0 && !l.def.shareDepth) r.clearDepth();
        r.render(l.scene!, this.camera);
      });
    }

    // ── nicht mehr gebrauchte Ebenen freigeben
    for (const l of this.levels.values()) {
      if (l.built && l !== this.root && !this.chain.includes(l) && l !== this.cand && this.t - l.lastUsed > 12) this.disposeLevel(l);
    }

    if (!silent) this.updateHover();
    this.adaptQuality(dt);
    if (!silent) this.emit(rendered);
  }

  private autopilot(dt: number) {
    const a = this.auto!;
    if (a.kind === 'to') {
      const l = this.levels.get(a.id)!;
      const goal = l === this.root ? new THREE.Vector3(0.03, 0, 0) : l.pos;
      this.target.lerp(goal, 1 - Math.exp(-dt * 2.2));
      const dzv = (a.z - this.z) * 1.8;
      this.zVel = clamp(dzv, -1.2, 1.6);
      if (l === this.root) {
        this.pitch = damp(this.pitch, 52 * DEG, 1.5, dt);
      }
      if (Math.abs(a.z - this.z) < 0.02 && this.target.distanceTo(goal) < Math.pow(10, this.z) * 0.02) this.auto = null;
      return;
    }
    // Tauchgang
    const path = a.path;
    const onPath = this.chain.every((l, i) => path[i] === l.def.id);
    if (!onPath) {
      // erst auf demselben Weg hinauszoomen, bis die abweichende Ebene verlassen ist
      this.zVel = damp(this.zVel, 1.6, 3, dt);
      return;
    }
    const next = this.levels.get(path[this.chain.length]);
    const leaf = this.levels.get(path[path.length - 1])!;
    const dens = density(this.z, [next ? next.def.zIn - 0.35 : -99, this.chain[this.chain.length - 1].def.zIn - 0.4], 0.22, 0.6);
    let goalVel = -0.68 * dens;
    if (next) {
      const d = this.dist2(next);
      // auf das nächste Bauteil zusteuern (unabhängig von der Anziehung)
      if (d > next.def.catchR * 0.3) this.target.lerp(next.pos, 1 - Math.exp(-dt * 1.6));
      if (d > next.def.catchR * 0.6 && this.z < next.def.zIn + 0.15) goalVel = 0;
    } else if (this.z <= leaf.def.floor + 0.12) {
      this.auto = null;
      return;
    }
    this.zVel = damp(this.zVel, goalVel, 2.5, dt);
  }

  private updateHover() {
    const sticky = this.t < this.hoverSticky;
    const dragging = this.pointers.size > 0;
    const allowed = this.chain.length === 1 || (this.chain[1]?.def.dynamic !== undefined && this.z > -1.9);
    if (!allowed || (!this.pointer.inside && !sticky) || (dragging && !sticky)) {
      this.setHover(null);
      return;
    }
    if (this.hoverT >= 0 && this.t - this.hoverT < 0.1) return;
    this.hoverT = this.t;
    const hit = this.pickPart(this.pointer.x, this.pointer.y);
    this.setHover(hit);
  }

  private setHover(hit: { id: string; obj: THREE.Object3D; point?: THREE.Vector3 } | null) {
    const id = hit && hit.id !== 'pcb' ? hit.id : null;
    if (id === this.hoverId && hit?.obj === this.hoverObj) {
      if (this.brackets) (this.brackets.material as THREE.LineBasicMaterial).opacity = 0.55 + 0.35 * Math.sin(this.t * 5);
      return;
    }
    this.hoverId = id;
    this.hoverObj = id ? hit!.obj : null;
    if (this.brackets) {
      this.brackets.parent?.remove(this.brackets);
      this.brackets.geometry.dispose();
      (this.brackets.material as THREE.Material).dispose();
      this.brackets = null;
    }
    if (!id || !this.root.holder) return;
    const holder = this.root.holder;
    holder.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(hit!.obj).applyMatrix4(holder.matrixWorld.clone().invert());
    if (box.isEmpty()) return;
    const pad = box.getSize(new THREE.Vector3()).multiplyScalar(0.06).addScalar(0.6);
    box.min.sub(pad);
    box.max.add(pad);
    const pts: number[] = [];
    const c = [box.min, box.max];
    const size = box.getSize(new THREE.Vector3());
    for (let i = 0; i < 8; i++) {
      const x = c[i & 1].x;
      const y = c[(i >> 1) & 1].y;
      const z = c[(i >> 2) & 1].z;
      const sx = i & 1 ? -1 : 1;
      const sy = (i >> 1) & 1 ? -1 : 1;
      const sz = (i >> 2) & 1 ? -1 : 1;
      const k = 0.22;
      pts.push(x, y, z, x + sx * size.x * k, y, z, x, y, z, x, y + sy * size.y * k, z, x, y, z, x, y, z + sz * size.z * k);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const mat = new THREE.LineBasicMaterial({ color: 0x9fd6ff, transparent: true, opacity: 0.8, depthTest: false, blending: THREE.AdditiveBlending });
    this.brackets = new THREE.LineSegments(geo, mat);
    this.brackets.renderOrder = 999;
    this.brackets.frustumCulled = false;
    holder.children[0].add(this.brackets);
  }

  private quality = 1;
  private adaptQuality(dt: number) {
    this.frameTimes.push(dt);
    if (this.frameTimes.length < 90) return;
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    this.frameTimes = [];
    const base = Math.min(window.devicePixelRatio || 1, 2);
    if (avg > 1 / 32 && this.quality > 0.55) this.quality -= 0.15;
    else if (avg < 1 / 55 && this.quality < 1) this.quality = Math.min(1, this.quality + 0.1);
    const pr = Math.max(0.75, base * this.quality);
    if (Math.abs(pr - this.pixelRatio) > 0.01) {
      this.pixelRatio = pr;
      this.renderer.setPixelRatio(pr);
      this.renderer.setSize(this.w, this.h, false);
    }
  }

  private bgStops: [number, number][] = [
    [0.1, 0x0d1220],
    [-1.6, 0x0b0f1a],
    [-3.2, 0x0b0c16],
    [-5.2, 0x090a14],
    [-7, 0x070912],
    [-9.5, 0x04050b],
  ];
  private background(z: number): THREE.Color {
    const s = this.bgStops;
    for (let i = 0; i < s.length - 1; i++) {
      if (z <= s[i][0] && z >= s[i + 1][0]) {
        const k = (s[i][0] - z) / (s[i][0] - s[i + 1][0]);
        return new THREE.Color(s[i][1]).lerp(new THREE.Color(s[i + 1][1]), k);
      }
    }
    return new THREE.Color(z > s[0][0] ? s[0][1] : s[s.length - 1][1]);
  }

  private emit(rendered: Level[]) {
    const W = Math.pow(10, this.z);
    const short = Math.min(this.w, this.h);
    const pxPerM = short / W;
    const m = niceLength((Math.min(this.w, 520) * 0.32) / pxPerM);
    const labels: HudLabel[] = [];
    const v = new THREE.Vector3();
    for (const l of rendered) {
      if (!l.built?.labels || l.alpha < 0.35) continue;
      l.built.labels.forEach((lb: LabelDef, i) => {
        if (this.z > lb.zMax + 0.15 || this.z < lb.zMin - 0.15) return;
        const p = lb.live ? lb.live() : lb.pos;
        v.set(p[0], p[1], p[2]).applyMatrix4(l.holder!.matrixWorld);
        if (v.length() > 4.5) return; // weit entfernte Teile nicht beschriften
        v.project(this.camera);
        if (v.z < -1 || v.z > 1 || Math.abs(v.x) > 0.96 || Math.abs(v.y) > 0.93) return;
        const za = smoothstep(lb.zMax + 0.15, lb.zMax - 0.05, this.z) * smoothstep(lb.zMin - 0.15, lb.zMin + 0.05, this.z);
        labels.push({
          key: `${l.def.id}:${i}`,
          x: ((v.x + 1) / 2) * this.w,
          y: ((1 - v.y) / 2) * this.h,
          text: lb.text,
          size: lb.size,
          kind: lb.kind ?? 'part',
          alpha: za * Math.min(1, l.alpha * 1.4),
        });
      });
    }
    const deep = [...this.chain].reverse().find((l) => l.alpha > 0.5) ?? this.root;
    let cap: { z: number; text: I18n } | null = null;
    for (const c of deep.def.captions) if (this.z <= c.z + 1e-9) cap = c;
    this.onState({
      z: this.z,
      fov: W,
      bar: { px: m * pxPerM, m },
      chain: this.chain.filter((l) => l.alpha > 0.3 || l === this.root).map((l) => ({ id: l.def.id, title: l.def.title })),
      caption: cap?.text ?? null,
      captionKey: `${deep.def.id}:${cap?.z ?? ''}`,
      labels,
      auto: this.auto?.kind === 'dive' ? this.auto.path[this.auto.path.length - 1] : null,
      hint: !this.touched,
      hover: this.hoverId ? { id: this.hoverId, x: this.pointer.x, y: this.pointer.y } : null,
    });
  }

  /** Für die Anzeige: „Sichtfeld 340 µm“. */
  fovText(): string {
    return formatLength(Math.pow(10, this.z), this.lang);
  }
}
