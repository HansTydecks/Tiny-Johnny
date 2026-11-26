/**
 * Größenvergleiche: Ameise, Salzkorn, Hausstaubmilbe, Haar, rotes Blutkörperchen, Bakterium, Pollen,
 * Virus, DNA, Wassermolekül, Staub- und Rauchteilchen. Alle Maße sind echte Durchschnittswerte;
 * jedes Objekt wird in den Einheiten der Ebene gebaut, in der es liegt (Parameter `u` = Meter pro Einheit).
 */
import { THREE, MAT, inst, makeCanvas, canvasTex, rng, cylBetween, phys, std, type InstSpec } from './kit';

export interface Life {
  obj: THREE.Object3D;
  update?(t: number, dt: number): void;
}

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const m = (x: number, u: number) => x / u; // Meter → Einheiten

/** Ameise (Formica), Länge ≈ 3 mm (kleine Arbeiterin). Läuft im Dreifußgang. */
export function ant(u: number): Life & { len: number } {
  const L = m(3e-3, u);
  const g = new THREE.Group();
  const chitin = phys({ color: 0x3a1a0e, roughness: 0.32, metalness: 0, clearcoat: 0.8, clearcoatRoughness: 0.25, sheen: 0.2 });
  const legMat = phys({ color: 0x2b130a, roughness: 0.4, clearcoat: 0.5 });
  const sph = new THREE.SphereGeometry(1, 28, 20);
  const seg = (sx: number, sy: number, sz: number, x: number, y: number) => {
    const s = new THREE.Mesh(sph, chitin);
    s.scale.set(sx * L, sy * L, sz * L);
    s.position.set(x * L, y * L, 0);
    g.add(s);
    return s;
  };
  seg(0.12, 0.1, 0.11, 0.38, 0.13); // Kopf
  seg(0.16, 0.085, 0.075, 0.13, 0.12); // Bruststück
  seg(0.045, 0.05, 0.04, -0.06, 0.1); // Stielchen
  seg(0.2, 0.15, 0.15, -0.28, 0.13); // Hinterleib
  const eyeM = phys({ color: 0x050505, roughness: 0.1, clearcoat: 1 });
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(sph, eyeM);
    e.scale.setScalar(0.03 * L);
    e.position.set(0.42 * L, 0.17 * L, s * 0.085 * L);
    g.add(e);
  }
  const cyl = new THREE.CylinderGeometry(1, 0.8, 1, 10);
  const legs: { root: THREE.Group; phase: number; side: number }[] = [];
  const mkLimb = (parent: THREE.Object3D, parts: [number, number, number][], r: number) => {
    let cur = parent;
    const joints: THREE.Group[] = [];
    for (const [len, rx, rz] of parts) {
      const j = new THREE.Group();
      j.rotation.set(rx, 0, rz);
      const s = new THREE.Mesh(cyl, legMat);
      s.scale.set(r * L, len * L, r * L);
      s.position.y = (len * L) / 2;
      j.add(s);
      cur.add(j);
      joints.push(j);
      const nx = new THREE.Group();
      nx.position.y = len * L;
      j.add(nx);
      cur = nx;
    }
    return joints;
  };
  const xs = [0.2, 0.12, 0.04];
  xs.forEach((x, i) => {
    for (const side of [-1, 1]) {
      const root = new THREE.Group();
      root.position.set(x * L, 0.1 * L, side * 0.05 * L);
      root.rotation.set(side * 1.25, (i - 1) * 0.55 * side, 0);
      mkLimb(root, [[0.22, 0, 0], [0.3, 0, side * 0], [0.28, side * -1.6, 0]], 0.012);
      // Beine zeigen nach außen und unten
      root.children[0].rotation.x = 0;
      g.add(root);
      legs.push({ root, phase: (i % 2 === 0 ? 0 : Math.PI) + (side > 0 ? Math.PI : 0), side });
    }
  });
  for (const side of [-1, 1]) {
    const a = new THREE.Group();
    a.position.set(0.47 * L, 0.2 * L, side * 0.05 * L);
    a.rotation.set(side * 0.7, 0, -0.5);
    mkLimb(a, [[0.25, 0, 0], [0.28, 0, -1.4]], 0.008);
    g.add(a);
  }
  // Beine nach unten auf den Boden ausrichten
  g.position.y = 0;
  return {
    obj: g,
    len: L,
    update(t) {
      for (const l of legs) {
        const p = Math.sin(t * 9 + l.phase);
        l.root.rotation.z = p * 0.35;
        l.root.rotation.x = l.side * (1.25 + Math.max(0, p) * 0.15);
      }
    },
  };
}

/** Salzkorn (NaCl), Kantenlänge ≈ 0,3 mm – leicht abgeschlagener Würfel. */
export function saltGrain(u: number, seed = 3): Life {
  const s = m(0.3e-3, u);
  const geo = new THREE.BoxGeometry(s, s * 0.92, s * 1.05, 6, 6, 6);
  const r = rng(seed);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const v = V(p.getX(i), p.getY(i), p.getZ(i));
    const k = 1 - 0.035 * r.next();
    p.setXYZ(i, v.x * k, v.y * k, v.z * k);
  }
  geo.computeVertexNormals();
  const mat = phys({ color: 0xf4f6f8, roughness: 0.18, metalness: 0, transmission: 0.55, thickness: s, ior: 1.54, clearcoat: 0.6, transparent: true, opacity: 0.96 });
  const mm = new THREE.Mesh(geo, mat);
  mm.rotation.set(0.1, 0.7, 0.05);
  mm.position.y = s * 0.46;
  return { obj: mm };
}

/** Hausstaubmilbe, Länge ≈ 0,3 mm, acht Beine. */
export function dustMite(u: number): Life {
  const L = m(0.3e-3, u);
  const g = new THREE.Group();
  const skin = phys({ color: 0xd9c2a0, roughness: 0.55, sheen: 0.6, sheenColor: 0xfff0d0, transmission: 0.1, thickness: L * 0.3 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), skin);
  body.scale.set(L * 0.5, L * 0.28, L * 0.36);
  body.position.y = L * 0.3;
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 16), skin);
  head.scale.set(L * 0.12, L * 0.1, L * 0.1);
  head.position.set(L * 0.5, L * 0.28, 0);
  g.add(head);
  // Borsten
  const hairs: InstSpec[] = [];
  const r = rng(9);
  for (let i = 0; i < 60; i++) {
    const th = r.range(0, Math.PI * 2);
    const ph = r.range(0.2, 1.4);
    const n = V(Math.cos(th) * Math.sin(ph) * 0.5, Math.cos(ph) * 0.28, Math.sin(th) * Math.sin(ph) * 0.36);
    const a = n.clone().multiplyScalar(L).add(V(0, L * 0.3, 0));
    const b = a.clone().add(n.clone().normalize().multiplyScalar(L * r.range(0.15, 0.35)));
    hairs.push(cylBetween(a, b, L * 0.006));
  }
  g.add(inst(new THREE.CylinderGeometry(1, 0.3, 1, 5), skin, hairs));
  const legs: THREE.Group[] = [];
  const cyl = new THREE.CylinderGeometry(1, 0.7, 1, 8);
  [0.32, 0.18, -0.12, -0.28].forEach((x) => {
    for (const s of [-1, 1]) {
      const leg = new THREE.Group();
      leg.position.set(x * L, L * 0.26, s * L * 0.3);
      const a = new THREE.Mesh(cyl, skin);
      a.scale.set(L * 0.03, L * 0.32, L * 0.03);
      a.position.y = L * 0.16;
      leg.add(a);
      leg.rotation.set(s * 2.1, 0, (x > 0 ? -1 : 1) * 0.5);
      g.add(leg);
      legs.push(leg);
    }
  });
  return {
    obj: g,
    update(t) {
      legs.forEach((l, i) => (l.rotation.z += Math.sin(t * 2.2 + i) * 0.002));
    },
  };
}

/** Menschliches Haar, Durchmesser ≈ 70 µm, mit Schuppenschicht (Kutikula). */
export function hair(u: number, lengthM: number, aniso: number): Life {
  const R = m(35e-6, u);
  const len = m(lengthM, u);
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 12; i++) {
    const k = i / 12 - 0.5;
    pts.push(V(k * len, R * 1.05 + Math.sin(k * 3) * R * 0.4, Math.sin(k * 2.2) * len * 0.05));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const geo = new THREE.TubeGeometry(curve, 400, R, 40, false);
  // Kutikula-Schuppen als Bump-Textur
  const { cv, g } = makeCanvas(1024, 256);
  g.fillStyle = '#808080';
  g.fillRect(0, 0, 1024, 256);
  const r = rng(77);
  for (let row = 0; row < 8; row++)
    for (let i = 0; i < 40; i++) {
      const x = i * 26 + r.range(-6, 6);
      const y = row * 32 + r.range(-5, 5);
      const grd = g.createLinearGradient(x, 0, x + 26, 0);
      grd.addColorStop(0, '#5a5a5a');
      grd.addColorStop(0.85, '#b0b0b0');
      grd.addColorStop(1, '#4a4a4a');
      g.fillStyle = grd;
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + 30, y + 16, x, y + 34);
      g.lineTo(x - 2, y);
      g.fill();
    }
  const bump = canvasTex(cv, aniso, false);
  bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
  bump.repeat.set(Math.max(1, len / (R * 9)), 1);
  const mat = phys({ color: 0x3b2416, roughness: 0.42, bumpMap: bump, bumpScale: R * 0.04, sheen: 0.4, sheenColor: 0x8a6040, clearcoat: 0.3 });
  return { obj: new THREE.Mesh(geo, mat) };
}

/** Rotes Blutkörperchen: bikonkave Scheibe, Ø ≈ 7,8 µm (Evans-Fung-Form). */
export function redBloodCell(u: number): Life {
  const R = m(3.91e-6, u);
  const prof: THREE.Vector2[] = [];
  const N = 40;
  const thick = (x: number) => Math.sqrt(Math.max(0, 1 - x * x)) * (0.81 + 7.83 * x * x - 4.39 * x ** 4) * 0.5;
  for (let i = 0; i <= N; i++) {
    const x = i / N;
    prof.push(new THREE.Vector2(x * R, (thick(x) * R) / 3.91));
  }
  for (let i = N; i >= 0; i--) {
    const x = i / N;
    prof.push(new THREE.Vector2(x * R, (-thick(x) * R) / 3.91));
  }
  const geo = new THREE.LatheGeometry(prof, 64);
  const mat = phys({ color: 0xb4141c, roughness: 0.48, sheen: 0.8, sheenColor: 0xff7a7a, clearcoat: 0.25, side: THREE.DoubleSide });
  const me = new THREE.Mesh(geo, mat);
  return {
    obj: me,
    update(t) {
      me.rotation.x = 0.25 + Math.sin(t * 0.4) * 0.05;
      me.rotation.z = Math.sin(t * 0.3) * 0.06;
    },
  };
}

/** Darmbakterium E. coli: Stäbchen 2 µm × 0,5 µm mit Geißeln, die sich wie Propeller drehen. */
export function ecoli(u: number): Life {
  const L = m(2e-6, u);
  const r0 = L * 0.25;
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(r0, L - 2 * r0, 16, 40),
    phys({ color: 0x9fbf7a, roughness: 0.45, sheen: 0.7, sheenColor: 0xe8ffd0, transmission: 0.15, thickness: r0 }),
  );
  body.rotation.z = Math.PI / 2;
  g.add(body);
  // Pili (feine Härchen)
  const pili: InstSpec[] = [];
  const rr = rng(5);
  for (let i = 0; i < 120; i++) {
    const x = rr.range(-L / 2 + r0 * 0.6, L / 2 - r0 * 0.6);
    const th = rr.range(0, Math.PI * 2);
    const a = V(x, Math.cos(th) * r0, Math.sin(th) * r0);
    const b = a.clone().add(V(rr.range(-0.1, 0.1) * L, Math.cos(th) * r0 * 0.6, Math.sin(th) * r0 * 0.6));
    pili.push(cylBetween(a, b, L * 0.004));
  }
  g.add(inst(new THREE.CylinderGeometry(1, 1, 1, 4), std({ color: 0xc8dca8, roughness: 0.6 }), pili));
  // Geißeln
  const flag: THREE.Object3D[] = [];
  const fm = std({ color: 0xd6e6c0, roughness: 0.5 });
  for (let i = 0; i < 5; i++) {
    const pts: THREE.Vector3[] = [];
    const len = L * rr.range(2.5, 3.5);
    for (let k = 0; k <= 80; k++) {
      const s = k / 80;
      const amp = r0 * 0.5 * Math.min(1, s * 5);
      pts.push(V(-s * len, Math.cos(s * 14) * amp, Math.sin(s * 14) * amp));
    }
    const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, L * 0.012, 6), fm);
    const holder = new THREE.Group();
    const th = (i / 5) * Math.PI * 2;
    holder.position.set(rr.range(-L * 0.3, -L * 0.48), Math.cos(th) * r0 * 0.7, Math.sin(th) * r0 * 0.7);
    holder.rotation.set(0, rr.range(-0.4, 0.4), rr.range(-0.3, 0.3));
    holder.add(tube);
    g.add(holder);
    flag.push(tube);
  }
  g.position.y = r0;
  return {
    obj: g,
    update(t, dt) {
      flag.forEach((f) => (f.rotation.x += dt * 9));
      body.scale.y = 1 + Math.sin(t * 2) * 0.01;
      g.rotation.y = Math.sin(t * 0.25) * 0.4;
    },
  };
}

/** Sonnenblumen-Pollen, Ø ≈ 30 µm, mit Stacheln. */
export function pollen(u: number): Life {
  const R = m(15e-6, u);
  const geo = new THREE.IcosahedronGeometry(R, 5);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const v = V(p.getX(i), p.getY(i), p.getZ(i));
    const n = v.clone().normalize();
    const bump = 1 + 0.03 * Math.sin(n.x * 21) * Math.sin(n.y * 19) * Math.sin(n.z * 23);
    p.setXYZ(i, n.x * R * bump, n.y * R * bump, n.z * R * bump);
  }
  geo.computeVertexNormals();
  const mat = phys({ color: 0xe8b23a, roughness: 0.55, sheen: 0.6, sheenColor: 0xfff2b0 });
  const g = new THREE.Group();
  g.add(new THREE.Mesh(geo, mat));
  const spikes: InstSpec[] = [];
  const N = 140;
  for (let i = 0; i < N; i++) {
    const y = 1 - (2 * (i + 0.5)) / N;
    const rad = Math.sqrt(1 - y * y);
    const th = i * 2.39996;
    const n = V(Math.cos(th) * rad, y, Math.sin(th) * rad);
    const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), n);
    const pos = n.clone().multiplyScalar(R * 1.1);
    spikes.push({ p: [pos.x, pos.y, pos.z], q, s: [R * 0.09, R * 0.22, R * 0.09] });
  }
  g.add(inst(new THREE.ConeGeometry(1, 1, 10), mat, spikes));
  g.position.y = R;
  return { obj: g, update: (t) => (g.rotation.y = t * 0.05) };
}

/** Grippevirus (Influenza), Ø ≈ 100 nm, mit Hämagglutinin- und Neuraminidase-Spikes. */
export function virus(u: number): Life {
  const R = m(50e-9, u);
  const g = new THREE.Group();
  const env = new THREE.IcosahedronGeometry(R, 5);
  const p = env.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const n = V(p.getX(i), p.getY(i), p.getZ(i)).normalize();
    const k = 1 + 0.02 * Math.sin(n.x * 30 + n.y * 20);
    p.setXYZ(i, n.x * R * k, n.y * R * k, n.z * R * k);
  }
  env.computeVertexNormals();
  g.add(new THREE.Mesh(env, phys({ color: 0x8ea6c8, roughness: 0.6, sheen: 0.8, sheenColor: 0xd8e8ff })));
  const stems: InstSpec[] = [];
  const heads: InstSpec[] = [];
  const heads2: InstSpec[] = [];
  const N = 340;
  for (let i = 0; i < N; i++) {
    const y = 1 - (2 * (i + 0.5)) / N;
    const rad = Math.sqrt(1 - y * y);
    const th = i * 2.39996;
    const n = V(Math.cos(th) * rad, y, Math.sin(th) * rad);
    const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), n);
    const len = R * 0.26;
    const mid = n.clone().multiplyScalar(R + len / 2);
    stems.push({ p: [mid.x, mid.y, mid.z], q, s: [R * 0.025, len, R * 0.025] });
    const tip = n.clone().multiplyScalar(R + len);
    (i % 7 === 0 ? heads2 : heads).push({ p: [tip.x, tip.y, tip.z], q, s: [R * 0.06, R * 0.08, R * 0.06] });
  }
  g.add(inst(new THREE.CylinderGeometry(1, 1, 1, 6), std({ color: 0xc9d2dc, roughness: 0.6 }), stems));
  g.add(inst(new THREE.SphereGeometry(1, 10, 8), phys({ color: 0xd94a3a, roughness: 0.5, sheen: 0.5 }), heads));
  g.add(inst(new THREE.SphereGeometry(1, 10, 8), phys({ color: 0xf0b13a, roughness: 0.5, sheen: 0.5 }), heads2));
  return { obj: g, update: (t) => g.rotation.set(t * 0.03, t * 0.05, 0) };
}

/** DNA-Doppelhelix: 2 nm breit, 0,34 nm pro Basenpaar, 10,5 Basenpaare pro Windung. */
export function dna(u: number, lengthM: number): Life {
  const bpRise = m(0.34e-9, u);
  const R = m(1e-9, u);
  const nbp = Math.floor(m(lengthM, u) / bpRise);
  const back: InstSpec[] = [];
  const bases: InstSpec[] = [];
  const cols = [0x3fb950, 0xe5534b, 0xf0b13a, 0x539bf5];
  const r = rng(11);
  for (let i = 0; i < nbp; i++) {
    const a = (i / 10.5) * Math.PI * 2;
    const x = (i - nbp / 2) * bpRise;
    const p1 = V(x, Math.cos(a) * R, Math.sin(a) * R);
    const p2 = V(x, Math.cos(a + 2.4) * R, Math.sin(a + 2.4) * R);
    back.push({ p: [p1.x, p1.y, p1.z], s: [R * 0.32, R * 0.32, R * 0.32] }, { p: [p2.x, p2.y, p2.z], s: [R * 0.32, R * 0.32, R * 0.32] });
    const mid = p1.clone().lerp(p2, 0.5);
    const b = r.int(0, 3);
    const c1 = cylBetween(p1, mid, R * 0.12);
    c1.c = cols[b];
    const c2 = cylBetween(mid, p2, R * 0.12);
    c2.c = cols[3 - b];
    bases.push(c1, c2);
  }
  const g = new THREE.Group();
  g.add(inst(new THREE.SphereGeometry(1, 12, 10), phys({ color: 0xdfe8f5, roughness: 0.35, clearcoat: 0.6 }), back));
  g.add(inst(new THREE.CylinderGeometry(1, 1, 1, 8), std({ color: 0xffffff, roughness: 0.45 }), bases));
  g.position.y = R * 1.4;
  return { obj: g, update: (t) => (g.rotation.x = t * 0.15) };
}

/** Wassermolekül H₂O: O–H 0,096 nm, Winkel 104,5°. Radien wie bei den übrigen Atomen (Kalottenmodell, verkleinert). */
export function water(u: number, radiusScale = 0.55): Life {
  const g = new THREE.Group();
  const rO = m(0.152e-9 * radiusScale, u);
  const rH = m(0.11e-9 * radiusScale, u);
  const d = m(0.0958e-9, u) * 1.6;
  const o = new THREE.Mesh(new THREE.SphereGeometry(rO, 32, 24), phys({ color: 0xff3b30, roughness: 0.3, clearcoat: 0.6 }));
  g.add(o);
  const a = (104.5 * Math.PI) / 360;
  for (const s of [-1, 1]) {
    const h = new THREE.Mesh(new THREE.SphereGeometry(rH, 24, 18), phys({ color: 0xf4f4f4, roughness: 0.3, clearcoat: 0.6 }));
    h.position.set(Math.sin(a) * d * s, -Math.cos(a) * d, 0);
    g.add(h);
  }
  return {
    obj: g,
    update(t) {
      g.rotation.set(t * 0.4, t * 0.27, t * 0.18);
    },
  };
}

/** Unregelmäßiges Teilchen (Staub, Rauch) mit gegebenem Durchmesser in Metern. */
export function particle(u: number, diamM: number, color: number, seed: number, fluffy = false): Life {
  const R = m(diamM / 2, u);
  const geo = new THREE.IcosahedronGeometry(R, fluffy ? 4 : 3);
  const r = rng(seed);
  const p = geo.attributes.position;
  const c = [r.range(2, 5), r.range(2, 5), r.range(2, 5)];
  for (let i = 0; i < p.count; i++) {
    const n = V(p.getX(i), p.getY(i), p.getZ(i)).normalize();
    const k = fluffy
      ? 1 + 0.12 * Math.sin(n.x * 13 + n.y * 7) * Math.sin(n.z * 11) + 0.08 * Math.sin(n.y * 23)
      : 1 + 0.22 * Math.sin(n.x * c[0]) * Math.sin(n.y * c[1] + 1) * Math.sin(n.z * c[2] + 2) + 0.06 * Math.sin(n.x * 19);
    p.setXYZ(i, n.x * R * k, n.y * R * k * (fluffy ? 1 : 0.75), n.z * R * k);
  }
  geo.computeVertexNormals();
  const me = new THREE.Mesh(geo, std({ color, roughness: 0.9, flatShading: !fluffy }));
  me.position.y = R * 0.7;
  return { obj: me };
}

export { MAT };
