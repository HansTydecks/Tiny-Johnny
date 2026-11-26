/** Die tiefsten Ebenen: einzelne Atome in Transistor, Kondensator, Speicherzelle und Magnetkorn (Einheit: nm). */
import type { Built, BuildCtx, Frame, LabelDef } from '../types';
import { t } from '../zoom';
import { THREE, rng } from './kit';
import { amorphous, bcc, diamond, electrons, fluorite, hcp, renderAtoms, rocksalt, tickAtoms, type Atom, type El } from './lattice';
import { water } from './life';

function withWater(root: THREE.Group, anims: ((f: Frame) => void)[], labels: LabelDef[], pos: [number, number, number]) {
  const w = water(1e-9);
  w.obj.position.set(...pos);
  root.add(w.obj);
  anims.push((f) => {
    if (!f.reduced) w.update?.(f.t, f.dt);
    w.obj.position.y = pos[1] + Math.sin(f.t * 0.6) * 0.15;
  });
  labels.push({ pos: [pos[0], pos[1] + 0.35, pos[2]], text: t('Wassermolekül H₂O', 'Water molecule H₂O'), size: 0.28e-9, zMax: -8.3, zMin: -9.4, kind: 'life' });
}

const tmpM = new THREE.Matrix4();

/** Kanal eines FinFETs: Silizium-Kristall, darüber Siliziumoxid und Hafniumoxid. */
export function buildFinAtoms(_ctx: BuildCtx): Built {
  const root = new THREE.Group();
  const anims: ((f: Frame) => void)[] = [];
  const labels: LabelDef[] = [];
  const si = diamond({ x: [-3.6, 3.6], y: [-3.8, 0], z: [-3.5, 3.5] });
  const ox = [
    ...amorphous({ x: [0, 3.6], y: [0.05, 0.6], z: [-3.5, 4.1] }, [['Si', 1], ['O', 2]], 0.25, 3),
    ...amorphous({ x: [-3.6, 3.6], y: [-3.8, 0.6], z: [3.55, 4.1] }, [['Si', 1], ['O', 2]], 0.25, 4),
  ];
  const hf = [
    ...amorphous({ x: [0.8, 3.6], y: [0.65, 2.1], z: [-3.5, 5.6] }, [['Hf', 1], ['O', 2]], 0.235, 5),
    ...amorphous({ x: [-3.6, 0.8], y: [-3.8, 2.1], z: [4.15, 5.6] }, [['Hf', 1], ['O', 2]], 0.235, 6),
  ];
  const all: Atom[] = [...si, ...ox, ...hf];
  const g = renderAtoms(all, { bonds: [{ a: 'Si', b: 'Si', max: 0.25 }], jitter: 0.007 });
  root.add(g);
  // Elektronen im Kanal
  const N = 46;
  const el = electrons(N, 0x7fd4ff, 0.055);
  root.add(el);
  const r = rng(12);
  const ep = Array.from({ length: N }, () => [r.range(-3.6, 3.6), r.range(-1.6, -0.15), r.range(-3.2, 3.2), r.range(0.6, 1.4)]);
  const live: [number, number, number] = [0, 0, 0];
  anims.push((f) => {
    tickAtoms(g, f.t, f.reduced);
    for (let i = 0; i < N; i++) {
      const e = ep[i];
      if (!f.reduced) e[0] += f.dt * 1.1 * e[3];
      if (e[0] > 3.6) e[0] -= 7.2;
      const s = 1 + 0.25 * Math.sin(f.t * 7 + i);
      tmpM.makeScale(s, s, s).setPosition(e[0], e[1] + Math.sin(f.t * 3 + i) * 0.05, e[2]);
      el.setMatrixAt(i, tmpM);
    }
    el.instanceMatrix.needsUpdate = true;
    live[0] = ep[5][0];
    live[1] = ep[5][1];
    live[2] = ep[5][2];
  });
  const front = si.filter((a) => a.p.z > 3.0 && a.p.y > -1.2 && a.p.y < -0.6 && Math.abs(a.p.x + 2) < 0.4)[0]?.p ?? new THREE.Vector3(-2, -1, 3.3);
  labels.push(
    { pos: [front.x, front.y, front.z], text: t('Silizium-Atom', 'Silicon atom'), size: 0.22e-9, zMax: -8.1, zMin: -9.4 },
    { pos: [-1, -2.5, 3.6], text: t('Silizium-Kristall: Abstand 0,235 nm', 'Silicon crystal: spacing 0.235 nm'), zMax: -7.75, zMin: -8.6 },
    { pos: [2.6, 2.1, 0], text: t('Hafniumoxid – Isolator, nur 1,5 nm dick', 'Hafnium oxide – insulator, only 1.5 nm thick'), zMax: -7.6, zMin: -8.7 },
    { pos: [-3, 0.4, 4.0], text: t('Siliziumoxid', 'Silicon oxide'), zMax: -8.2, zMin: -9.0 },
    { pos: [0, -2.5, 0], text: t('Elektronen', 'Electrons'), zMax: -7.9, zMin: -9.1, live: () => live },
    { pos: [0, 0, 0], text: t('Die Finne ist nur ≈ 13 Atome breit', 'The fin is only ≈ 13 atoms wide'), size: 7e-9, zMax: -7.3, zMin: -7.9 },
  );
  withWater(root, anims, labels, [2.4, 3.2, 1.8]);
  return { root, labels, pick: [pickPlane(20)], update: (f) => anims.forEach((a) => a(f)) };
}

/** Wand eines DRAM-Kondensators: Titannitrid | Zirkonoxid | Titannitrid, mit gespeicherten Elektronen. */
export function buildCapAtoms(_ctx: BuildCtx): Built {
  const root = new THREE.Group();
  const anims: ((f: Frame) => void)[] = [];
  const labels: LabelDef[] = [];
  const box = (x0: number, x1: number) => ({ x: [x0, x1] as [number, number], y: [-2.6, 2.6] as [number, number], z: [-1.4, 0] as [number, number] });
  const atoms = [...rocksalt(box(-5.5, -2.5), 'Ti', 'N', 0.424), ...fluorite(box(-2.45, 2.45), 'Zr', 'O', 0.512), ...rocksalt(box(2.5, 5.5), 'Ti', 'N', 0.424)];
  const g = renderAtoms(atoms, { bonds: [{ a: 'Ti', b: 'N', max: 0.23 }, { a: 'Zr', b: 'O', max: 0.235 }], jitter: 0.006 });
  root.add(g);
  const N = 40;
  const el = electrons(N, 0x7fd4ff, 0.07);
  root.add(el);
  const r = rng(4);
  const ep = Array.from({ length: N }, () => [r.range(2.55, 2.85), r.range(-2.8, 2.8), r.range(-1.8, 0.1)]);
  anims.push((f) => {
    tickAtoms(g, f.t, f.reduced);
    for (let i = 0; i < N; i++) {
      const e = ep[i];
      tmpM.makeTranslation(e[0] + Math.sin(f.t * 5 + i) * 0.04, e[1] + Math.sin(f.t * 3.1 + i * 2) * 0.05, e[2] + 0.12);
      el.setMatrixAt(i, tmpM);
    }
    el.instanceMatrix.needsUpdate = true;
  });
  labels.push(
    { pos: [-4, 3.1, 0], text: t('Titannitrid (Elektrode)', 'Titanium nitride (electrode)'), zMax: -7.5, zMin: -9.0 },
    { pos: [0, 3.1, 0], text: t('Zirkonoxid – Isolator', 'Zirconium oxide – insulator'), size: 5e-9, zMax: -7.5, zMin: -9.0 },
    { pos: [2.7, -1.5, 0.2], text: t('Gespeicherte Elektronen = Bit „1“', 'Stored electrons = bit “1”'), zMax: -7.8, zMin: -9.2 },
    { pos: [-1.28, 0.25, 0], text: t('Zirkonium-Atom', 'Zirconium atom'), size: 0.32e-9, zMax: -8.4, zMin: -9.4 },
  );
  withWater(root, anims, labels, [-1.5, 3.9, 0.8]);
  return { root, labels, pick: [pickPlane(20, 0)], update: (f) => anims.forEach((a) => a(f)) };
}

/** Ladungsfalle einer 3D-NAND-Zelle: Kanal | Tunneloxid | Siliziumnitrid | Sperroxid | Wolfram. */
export function buildTrapAtoms(_ctx: BuildCtx): Built {
  const root = new THREE.Group();
  const anims: ((f: Frame) => void)[] = [];
  const labels: LabelDef[] = [];
  const b = (x0: number, x1: number) => ({ x: [x0, x1] as [number, number], y: [-2.6, 2.6] as [number, number], z: [-1.4, 0] as [number, number] });
  const w = bcc(b(5.6, 7.2), 'W', 0.3165);
  const atoms = [
    ...diamond(b(-7.2, -4.1)),
    ...amorphous(b(-4.0, -2.1), [['Si', 1], ['O', 2]], 0.25, 21),
    ...amorphous(b(-2.0, 3.0), [['Si', 3], ['N', 4]], 0.22, 22),
    ...amorphous(b(3.1, 5.5), [['Si', 1], ['O', 2]], 0.25, 23),
    ...w,
  ];
  const g = renderAtoms(atoms, { bonds: [{ a: 'Si', b: 'Si', max: 0.25 }], jitter: 0.006 });
  root.add(g);
  const N = 24;
  const el = electrons(N, 0x7fd4ff, 0.08);
  root.add(el);
  const r = rng(8);
  const traps = Array.from({ length: N }, () => [r.range(-1.6, 2.6), r.range(-2.7, 2.7), r.range(-1.8, 0.1)]);
  let tun = 0;
  anims.push((f) => {
    tickAtoms(g, f.t, f.reduced);
    tun = (tun + f.dt * 0.35) % 1;
    for (let i = 0; i < N; i++) {
      const e = traps[i];
      let x = e[0];
      if (i === 0) x = -6 + tun * (e[0] + 6); // ein Elektron tunnelt gerade hinein
      tmpM.makeTranslation(x + Math.sin(f.t * 4 + i) * 0.03, e[1], e[2] + 0.1);
      el.setMatrixAt(i, tmpM);
    }
    el.instanceMatrix.needsUpdate = true;
  });
  labels.push(
    { pos: [-5.6, 3.1, 0], text: t('Kanal (Silizium)', 'Channel (silicon)'), zMax: -7.5, zMin: -9.0 },
    { pos: [-3, 3.1, 0], text: t('Tunneloxid', 'Tunnel oxide'), zMax: -7.5, zMin: -9.0 },
    { pos: [0.5, 3.1, 0], text: t('Siliziumnitrid: hier sitzen die Elektronen fest', 'Silicon nitride: electrons are trapped here'), zMax: -7.5, zMin: -9.0 },
    { pos: [6.4, 3.1, 0], text: t('Wolfram (Wortleitung)', 'Tungsten (word line)'), zMax: -7.5, zMin: -9.0 },
  );
  withWater(root, anims, labels, [0.5, 4.1, 0.9]);
  return { root, labels, pick: [pickPlane(24, 0)], update: (f) => anims.forEach((a) => a(f)) };
}

/** Ein Magnetkorn der Festplatte: Kobalt-Chrom-Platin, alle Spins zeigen in dieselbe Richtung. */
export function buildGrainAtoms(_ctx: BuildCtx): Built {
  const root = new THREE.Group();
  const anims: ((f: Frame) => void)[] = [];
  const labels: LabelDef[] = [];
  const R = 3.3;
  const inHex = (p: THREE.Vector3, rr: number) => {
    const x = Math.abs(p.x);
    const z = Math.abs(p.z);
    return z <= rr * 0.866 && x * 0.866 + z * 0.5 <= rr * 0.866;
  };
  const hash = (p: THREE.Vector3) => Math.abs(Math.sin(p.x * 127.1 + p.y * 311.7 + p.z * 74.7) * 43758.5453) % 1;
  const pick = (p: THREE.Vector3): El => {
    const h = hash(p);
    return h < 0.16 ? 'Pt' : h < 0.25 ? 'Cr' : 'Co';
  };
  const metal = hcp({ x: [-R, R], y: [-2.6, 0], z: [-R, R] }, pick, 0.2507, 0.4069, (p) => inHex(p, R));
  const seg = amorphous({ x: [-R - 1, R + 1], y: [-4, 0], z: [-R - 1, R + 1] }, [['Si', 1], ['O', 2]], 0.26, 9, (p) => !inHex(p, R + 0.15) && inHex(p, R + 1) && p.z > -R * 0.3 && p.y > -2.6);
  const g = renderAtoms([...metal, ...seg], { jitter: 0.006 });
  root.add(g);
  // Spins als Pfeile
  const top = metal.filter((a) => a.p.y > -0.25 && a.el !== 'Cr');
  const cone = new THREE.ConeGeometry(0.045, 0.22, 10);
  cone.translate(0, 0.2, 0);
  const arrows = new THREE.InstancedMesh(cone, new THREE.MeshStandardMaterial({ color: 0xffc94a, emissive: 0xff9a1a, emissiveIntensity: 0.6, roughness: 0.4 }), top.length);
  top.forEach((a, i) => arrows.setMatrixAt(i, tmpM.makeTranslation(a.p.x, a.p.y, a.p.z)));
  arrows.frustumCulled = false;
  root.add(arrows);
  anims.push((f) => {
    tickAtoms(g, f.t, f.reduced);
    arrows.rotation.y = Math.sin(f.t * 0.8) * 0.02;
  });
  const co = metal.find((a) => a.el === 'Co' && a.p.y > -0.3 && a.p.z > 2.4)?.p ?? new THREE.Vector3(0, 0, 2.6);
  const pt = metal.find((a) => a.el === 'Pt' && a.p.y > -0.3 && a.p.z > 1.8)?.p ?? new THREE.Vector3(1, 0, 2);
  labels.push(
    { pos: [co.x, co.y + 0.2, co.z], text: t('Kobalt-Atom', 'Cobalt atom'), size: 0.25e-9, zMax: -8.2, zMin: -9.4 },
    { pos: [pt.x, pt.y + 0.2, pt.z], text: t('Platin-Atom', 'Platinum atom'), zMax: -8.4, zMin: -9.4 },
    { pos: [0, 0.6, 0], text: t('Alle Spins zeigen nach oben = ein Magnet', 'All spins point up = one magnet'), zMax: -7.7, zMin: -8.8 },
    { pos: [0, -2, R + 0.7], text: t('Oxid trennt die Körner', 'Oxide separates the grains'), zMax: -7.9, zMin: -8.8 },
  );
  withWater(root, anims, labels, [1.8, 2.2, 1.2]);
  return { root, labels, pick: [pickPlane(20)], update: (f) => anims.forEach((a) => a(f)) };
}

function pickPlane(size: number, z?: number) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ visible: false }));
  if (z === undefined) m.rotation.x = -Math.PI / 2;
  else m.position.z = z;
  return m;
}
