/**
 * Transistor-Ebene (Einheit: nm). FinFETs wie in heutigen 3–5-nm-Chips:
 * Silizium-Finnen (7 nm breit, 30 nm Abstand), Gates quer darüber (16 nm lang, 54 nm Abstand),
 * Source/Drain-Epitaxie, Kontakte, darüber die feinsten Kupferlagen M0 und M1.
 * Modus „nand“: ein NAND-Gatter aus 4 Transistoren schaltet sichtbar.
 * Modus „sram“: eine 6-Transistor-Speicherzelle speichert ein Bit.
 */
import type { Built, BuildCtx, Frame, LabelDef } from '../types';
import { smoothstep, t } from '../zoom';
import { THREE, MAT, inst, phys, rng, setFade, std, type InstSpec } from './kit';
import { dna, virus } from './life';

export const FP = 30; // Finnenabstand
export const FW = 7; // Finnenbreite
export const FH = 50; // Finnenhöhe über dem Isolator
export const GP = 54; // Gate-Abstand (CPP)
export const GL = 16; // Gate-Länge
const SP = 6; // Spacer
const GTOP = 40;
const ROW = 240;
const M0Y: [number, number] = [56, 84];
const M1Y: [number, number] = [100, 132];

export function buildFinfet(_ctx: BuildCtx, mode: 'nand' | 'sram', seed: number): Built {
  const root = new THREE.Group();
  const anims: ((f: Frame) => void)[] = [];
  const r = rng(seed);
  const K = 24; // Gates links/rechts
  const R = 5; // Reihen nach oben/unten
  const X0 = -K * GP;
  const X1 = K * GP;

  const siFin = std({ color: 0x5b6a86, metalness: 0.35, roughness: 0.45 });
  const sti = std({ color: 0x46546b, metalness: 0, roughness: 0.8 });
  const gateMat = MAT.tungsten({ color: 0x9a948a, roughness: 0.34 });
  const spacer = std({ color: 0xa9b1bf, roughness: 0.6 });
  const nEpi = std({ color: 0x6fa3a0, roughness: 0.5, metalness: 0.2 });
  const pEpi = std({ color: 0xa57fa8, roughness: 0.5, metalness: 0.2 });
  const tcn = MAT.tungsten({ roughness: 0.3 });
  const cu = MAT.copper({ roughness: 0.3 });
  const ru = std({ color: 0xb5b0a8, metalness: 1, roughness: 0.3 }); // M0 oft aus Ruthenium/Kobalt

  const fins: InstSpec[] = [];
  const gates: InstSpec[] = [];
  const spacers: InstSpec[] = [];
  const epiN: InstSpec[] = [];
  const epiP: InstSpec[] = [];
  const tcns: InstSpec[] = [];
  const m0: InstSpec[] = [];
  const m1: InstSpec[] = [];
  const v0: InstSpec[] = [];

  /** Reihen-Geometrie: Finnen und Schienen (gespiegelt bei ungeraden Reihen) */
  const rowInfo = (row: number) => {
    const b0 = -45 + row * ROW;
    const even = ((row % 2) + 2) % 2 === 0;
    const n = even ? [b0 + 45, b0 + 75] : [b0 + 165, b0 + 195];
    const p = even ? [b0 + 165, b0 + 195] : [b0 + 45, b0 + 75];
    const vss = even ? b0 : b0 + ROW;
    const vdd = even ? b0 + ROW : b0;
    return { b0, n, p, vss, vdd };
  };

  // Zellgrenzen pro Reihe (Diffusionsunterbrechungen an diesen Gate-Indizes)
  for (let row = -R; row <= R; row++) {
    const info = rowInfo(row);
    const breaks: number[] = [-K];
    if (mode === 'sram') {
      for (let k = -K; k <= K; k += 3) breaks.push(k);
    } else {
      let k = -K;
      while (k < K) {
        k += r.int(2, 6);
        breaks.push(Math.min(k, K));
      }
      if (row === 0) {
        // NAND-Zelle: Gates 0 und 1, Grenzen bei −1 und 2
        const filtered = breaks.filter((b) => b < -1 || b > 2);
        filtered.push(-1, 2);
        breaks.length = 0;
        breaks.push(...filtered.sort((a, b) => a - b));
      }
    }
    const uniq = [...new Set(breaks)].sort((a, b) => a - b);
    // Finnen-Abschnitte
    for (let i = 0; i < uniq.length - 1; i++) {
      const xa = uniq[i] * GP;
      const xb = uniq[i + 1] * GP;
      for (const z of [...info.n, ...info.p]) fins.push({ p: [(xa + xb) / 2, -FH / 2, z], s: [xb - xa + 8, FH, FW] });
      // S/D-Epitaxie zwischen den Gates
      for (let k = uniq[i]; k < uniq[i + 1]; k++) {
        const x = (k + 0.5) * GP;
        for (const z of info.n) epiN.push({ p: [x, -20, z], s: [GP - GL - 2 * SP - 2, 34, 22], r: [0, 0, 0] });
        for (const z of info.p) epiP.push({ p: [x, -20, z], s: [GP - GL - 2 * SP - 2, 34, 22] });
        const special = row === 0 && mode === 'nand' && k >= -1 && k <= 1;
        if (!special && r.chance(0.55)) {
          const zs = r.chance(0.5) ? info.n : info.p;
          tcns.push({ p: [x, 17.5, (zs[0] + zs[1]) / 2], s: [14, 45, 54] });
          if (r.chance(0.6)) v0.push({ p: [x, (GTOP + M0Y[0]) / 2 + 3, (zs[0] + zs[1]) / 2], s: [14, M0Y[0] - GTOP + 4, 14] });
        }
      }
    }
    // Gates (an Reihengrenzen geschnitten)
    for (let k = -K; k <= K; k++) {
      if (mode === 'nand' && row === 0 && (k === 0 || k === 1)) continue; // eigene Meshes
      const x = k * GP;
      gates.push({ p: [x, (GTOP - FH) / 2, info.b0 + ROW / 2], s: [GL, GTOP + FH, ROW - 24] });
      spacers.push({ p: [x, (GTOP - 6 - FH) / 2, info.b0 + ROW / 2], s: [GL + 2 * SP, GTOP - 6 + FH, ROW - 26] });
    }
    // M0: Schienen und Signalspuren
    for (const zr of [info.vss, info.vdd]) m0.push({ p: [0, (M0Y[0] + M0Y[1]) / 2, zr], s: [X1 - X0, M0Y[1] - M0Y[0], 34] });
    for (const off of [60, 100, 140, 180]) {
      const zt = info.b0 + off;
      let x = X0;
      while (x < X1) {
        const len = r.range(1, 7) * GP;
        const skip = r.range(0.4, 2) * GP;
        const special = row === 0 && mode === 'nand' && x < 140 && x + len > -60;
        if (!special) m0.push({ p: [x + len / 2, (M0Y[0] + M0Y[1]) / 2, zt], s: [len, M0Y[1] - M0Y[0], 20] });
        x += len + skip;
      }
    }
  }
  // M1: senkrechte Leitungen (Abstand 48 nm)
  for (let m = Math.ceil(X0 / 48); m <= Math.floor(X1 / 48); m++) {
    const x = m * 48;
    let z = -R * ROW - 45;
    while (z < R * ROW + 195) {
      const len = r.range(2, 9) * 40;
      const special = mode === 'nand' && (m === 0 || m === 1 || m === 2) && z < 250 && z + len > -60;
      if (!special) m1.push({ p: [x, (M1Y[0] + M1Y[1]) / 2, z + len / 2], s: [24, M1Y[1] - M1Y[0], len] });
      z += len + r.range(0.6, 2.5) * 40;
    }
  }

  const box = new THREE.BoxGeometry(1, 1, 1);
  const octa = new THREE.OctahedronGeometry(0.5, 0);
  root.add(inst(box, siFin, fins));
  const finsMesh = root.children[root.children.length - 1];
  const g1 = inst(box, gateMat, gates);
  const s1 = inst(box, spacer, spacers);
  root.add(g1, s1);
  root.add(inst(octa, nEpi, epiN), inst(octa, pEpi, epiP));
  const tcnMesh = inst(box, tcn, tcns);
  const v0Mesh = inst(box, tcn, v0);
  const m0Mesh = inst(box, ru, m0);
  const m1Mesh = inst(box, cu, m1);
  root.add(tcnMesh, v0Mesh, m0Mesh, m1Mesh);
  // Isolator (STI) und Silizium darunter
  const stiM = new THREE.Mesh(new THREE.BoxGeometry(X1 - X0 + 200, 30, (2 * R + 1) * ROW + 200), sti);
  stiM.position.y = -FH - 15;
  root.add(stiM);
  void finsMesh;

  const labels: LabelDef[] = [];
  const L = (pos: [number, number, number], de: string, en: string, size: number | undefined, zMax: number, zMin: number, kind: 'part' | 'life' = 'part') =>
    labels.push({ pos, text: t(de, en), size, zMax, zMin, kind });

  // ───────────── NAND-Gatter
  let state = { a: 0, b: 0, y: 1 };
  if (mode === 'nand') {
    const glowA = std({ color: 0x8d8a83, metalness: 1, roughness: 0.35, emissive: 0x2a7fff, emissiveIntensity: 0 });
    const glowB = glowA.clone();
    const gA = new THREE.Mesh(box, glowA);
    gA.scale.set(GL, GTOP + FH, ROW - 24);
    gA.position.set(0, (GTOP - FH) / 2, 75);
    const gB = new THREE.Mesh(box, glowB);
    gB.scale.copy(gA.scale);
    gB.position.set(GP, (GTOP - FH) / 2, 75);
    const spA = new THREE.Mesh(box, spacer.clone());
    spA.scale.set(GL + 2 * SP, GTOP - 6 + FH, ROW - 26);
    spA.position.set(0, (GTOP - 6 - FH) / 2, 75);
    const spB = new THREE.Mesh(box, spacer);
    spB.scale.copy(spA.scale);
    spB.position.set(GP, spA.position.y, 75);
    gB.userData.cell = spB.userData.cell = true;
    root.add(gA, gB, spA, spB);
    // Kanal-Leuchten (leitender Transistor)
    const chan = (x: number, zs: number[], col: number) => {
      const m = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
      const g = new THREE.Group();
      for (const z of zs) {
        const c = new THREE.Mesh(box, m);
        c.scale.set(GL + 10, FH + 6, FW + 6);
        c.position.set(x, -FH / 2, z);
        g.add(c);
      }
      root.add(g);
      return m;
    };
    const cNA = chan(0, [0, 30], 0x3fa9ff);
    const cNB = chan(GP, [0, 30], 0x3fa9ff);
    const cPA = chan(0, [120, 150], 0xff7a45);
    const cPB = chan(GP, [120, 150], 0xff7a45);
    // Kontakte der NAND-Zelle
    const yMat = std({ color: 0xb5b0a8, metalness: 1, roughness: 0.3, emissive: 0xffa040, emissiveIntensity: 0 });
    const mk = (mat: THREE.Material, p: [number, number, number], s: [number, number, number]) => {
      const m = new THREE.Mesh(box, mat);
      m.position.set(...p);
      m.scale.set(...s);
      m.userData.cell = true;
      root.add(m);
      return m;
    };
    mk(tcn, [-27, 17.5, -30], [14, 45, 90]); // N links → VSS
    mk(tcn, [-27, 17.5, 165], [14, 45, 90]); // P links → VDD
    mk(tcn, [81, 17.5, 165], [14, 45, 90]); // P rechts → VDD
    const yParts: THREE.Mesh[] = [];
    yParts.push(mk(yMat, [27, 17.5, 117], [14, 45, 84])); // P Mitte → Y
    yParts.push(mk(yMat, [81, 17.5, 42], [14, 45, 120])); // N rechts → Y
    yParts.push(mk(yMat, [27, (GTOP + M0Y[0]) / 2 + 3, 100], [14, M0Y[0] - GTOP + 4, 14]));
    yParts.push(mk(yMat, [81, (GTOP + M0Y[0]) / 2 + 3, 100], [14, M0Y[0] - GTOP + 4, 14]));
    yParts.push(mk(yMat, [61, (M0Y[0] + M0Y[1]) / 2, 100], [80, M0Y[1] - M0Y[0], 20]));
    yParts.push(mk(yMat, [96, (M0Y[1] + M1Y[0]) / 2, 100], [16, M1Y[0] - M0Y[1], 16]));
    const yM1 = new THREE.Mesh(box, std({ color: 0xd88a5e, metalness: 1, roughness: 0.3, emissive: 0xffa040, emissiveIntensity: 0 }));
    yM1.scale.set(24, M1Y[1] - M1Y[0], 300);
    yM1.position.set(96, (M1Y[0] + M1Y[1]) / 2, 100);
    yM1.userData.cell = true;
    root.add(yM1);
    // Eingänge A und B
    const inA = std({ color: 0xd88a5e, metalness: 1, roughness: 0.3, emissive: 0x2a7fff, emissiveIntensity: 0 });
    const inB = inA.clone();
    for (const [mat, x] of [
      [inA, 0],
      [inB, GP],
    ] as [THREE.MeshStandardMaterial, number][]) {
      mk(mat, [x, (GTOP + M0Y[0]) / 2 + 3, 60], [14, M0Y[0] - GTOP + 4, 14]);
      mk(mat, [x, (M0Y[0] + M0Y[1]) / 2, 60], [24, M0Y[1] - M0Y[0], 20]);
      const mx = x === 0 ? 0 : 48;
      mk(mat, [mx, (M0Y[1] + M1Y[0]) / 2, 60], [16, M1Y[0] - M0Y[1], 16]);
      mk(mat, [mx, (M1Y[0] + M1Y[1]) / 2, 60 - 140], [24, M1Y[1] - M1Y[0], 300]);
    }
    // Ladungsträger beim Umschalten
    const nPart = 26;
    const parts = new THREE.InstancedMesh(new THREE.SphereGeometry(2.2, 10, 8), new THREE.MeshBasicMaterial({ color: 0x9fd8ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), nPart);
    parts.frustumCulled = false;
    {
      const z0 = new THREE.Matrix4().makeScale(0, 0, 0);
      for (let i = 0; i < nPart; i++) parts.setMatrixAt(i, z0);
    }
    root.add(parts);
    let pulse = -1;
    let pulseKind: 'n' | 'p' = 'n';
    const tmp = new THREE.Matrix4();
    let clock = 0;
    let step = 0;
    const seq = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ];
    anims.push((f) => {
      clock += f.dt;
      if (clock > 1.6) {
        clock = 0;
        step = (step + 1) % 4;
        const [a, b] = seq[step];
        const y = a && b ? 0 : 1;
        if (y !== state.y) {
          pulse = 0;
          pulseKind = y ? 'p' : 'n';
        }
        state = { a, b, y };
      }
      const ease = (cur: number, goal: number) => cur + (goal - cur) * (1 - Math.exp(-f.dt * 10));
      glowA.emissiveIntensity = ease(glowA.emissiveIntensity, state.a ? 1.6 : 0);
      glowB.emissiveIntensity = ease(glowB.emissiveIntensity, state.b ? 1.6 : 0);
      inA.emissiveIntensity = glowA.emissiveIntensity * 0.8;
      inB.emissiveIntensity = glowB.emissiveIntensity * 0.8;
      yMat.emissiveIntensity = ease(yMat.emissiveIntensity, state.y ? 1.3 : 0);
      (yM1.material as THREE.MeshStandardMaterial).emissiveIntensity = yMat.emissiveIntensity;
      const vis = f.alpha;
      cNA.opacity = ease(cNA.opacity, state.a ? 0.32 * vis : 0);
      cNB.opacity = ease(cNB.opacity, state.b ? 0.32 * vis : 0);
      cPA.opacity = ease(cPA.opacity, !state.a ? 0.3 * vis : 0);
      cPB.opacity = ease(cPB.opacity, !state.b ? 0.3 * vis : 0);
      // Pulse: Elektronen (NMOS-Pfad) bzw. Löcher (PMOS-Pfad)
      if (pulse >= 0) {
        pulse += f.dt * 0.9;
        (parts.material as THREE.MeshBasicMaterial).color.set(pulseKind === 'n' ? 0x9fd8ff : 0xffb38a);
        for (let i = 0; i < nPart; i++) {
          const ph = pulse - i * 0.025;
          const k = Math.min(1, Math.max(0, ph));
          let x: number;
          let z: number;
          if (pulseKind === 'n') {
            x = 81 - k * 108;
            z = i % 2 ? 0 : 30;
          } else {
            const fromLeft = i % 2 === 0;
            x = fromLeft ? -27 + k * 54 : 81 - k * 54;
            z = i % 4 < 2 ? 120 : 150;
          }
          const s = ph > 0 && ph < 1 ? 1 : 0;
          tmp.makeScale(s, s, s).setPosition(x, 3, z);
          parts.setMatrixAt(i, tmp);
        }
        parts.instanceMatrix.needsUpdate = true;
        (parts.material as THREE.MeshBasicMaterial).opacity = 0.9 * f.alpha;
        if (pulse > 1.8) pulse = -1;
      }
      // Schnitt: Gate A über der Finne ausblenden, wenn die Atome erscheinen
      const cut = smoothstep(-7.05, -7.35, f.z);
      gA.visible = spA.visible = cut < 0.99;
      setFade(gA, 1 - cut);
      setFade(spA, 1 - cut);
    });
    L([0, GTOP + 8, 75], 'Gate A', 'Gate A', undefined, -6.15, -7.1);
    L([GP, GTOP + 8, 75], 'Gate B', 'Gate B', undefined, -6.15, -7.1);
    L([96, M1Y[1] + 8, 160], 'Ausgang Y = nicht (A und B)', 'Output Y = not (A and B)', undefined, -5.8, -6.6);
    L([27, 0, 15], 'NMOS (2 Transistoren in Reihe)', 'NMOS (2 transistors in series)', undefined, -6.45, -7.05);
    L([27, 0, 135], 'PMOS (2 Transistoren parallel)', 'PMOS (2 transistors in parallel)', undefined, -6.45, -7.05);
    L([27, M1Y[1] + 30, 75], 'NAND-Gatter: 4 Transistoren', 'NAND gate: 4 transistors', 0.2e-6, -5.9, -6.7);
    L([-140, 2, 0], 'Finne aus Silizium', 'Silicon fin', FW * 1e-9, -6.6, -7.2);
    L([-108, GTOP, -30], 'Gate', 'Gate', GL * 1e-9, -6.6, -7.2);
  } else {
    // ───────────── SRAM-Zelle: zwei rückgekoppelte Inverter + zwei Zugriffstransistoren
    const qMat = std({ color: 0x8d8a83, metalness: 1, roughness: 0.3, emissive: 0x22ff9c, emissiveIntensity: 0 });
    const qbMat = qMat.clone();
    const wlMat = std({ color: 0xd88a5e, metalness: 1, roughness: 0.3, emissive: 0xffd04a, emissiveIntensity: 0 });
    const mk = (mat: THREE.Material, p: [number, number, number], s: [number, number, number]) => {
      const m = new THREE.Mesh(box, mat);
      m.position.set(...p);
      m.scale.set(...s);
      m.userData.cell = true;
      root.add(m);
      return m;
    };
    mk(qMat, [27, 17.5 + 2, 75], [15, 46, 170]);
    mk(qbMat, [81, 17.5 + 2, 75], [15, 46, 170]);
    mk(wlMat, [54, (M1Y[0] + M1Y[1]) / 2 + 40, 75], [700, 28, 24]);
    let clock = 0;
    let bit = 0;
    anims.push((f) => {
      clock += f.dt;
      if (clock > 2.4) {
        clock = 0;
        bit = 1 - bit;
      }
      const write = Math.max(0, 1 - Math.abs(clock - 0.25) * 4);
      wlMat.emissiveIntensity = write * 2;
      const ease = (cur: number, goal: number) => cur + (goal - cur) * (1 - Math.exp(-f.dt * 8));
      qMat.emissiveIntensity = ease(qMat.emissiveIntensity, bit ? 1.5 : 0);
      qbMat.emissiveIntensity = ease(qbMat.emissiveIntensity, bit ? 0 : 1.5);
    });
    L([27, GTOP + 20, 75], 'Speicherknoten Q', 'Storage node Q', undefined, -6.2, -7.1);
    L([81, GTOP + 20, 75], 'Speicherknoten Q̄', 'Storage node Q̄', undefined, -6.2, -7.1);
    L([54, M1Y[1] + 60, 75], 'Wortleitung (öffnet die Zelle)', 'Word line (opens the cell)', undefined, -5.8, -6.6);
    L([54, M1Y[1] + 30, -60], 'SRAM-Zelle: 6 Transistoren = 1 Bit', 'SRAM cell: 6 transistors = 1 bit', 0.11e-6, -5.9, -6.7);
    L([-140, 2, 0], 'Finne aus Silizium', 'Silicon fin', FW * 1e-9, -6.6, -7.2);
  }

  // ───────────── Größenvergleiche: Virus und DNA
  const vi = virus(1e-9);
  vi.obj.position.set(-420, M1Y[1] + 52, -330);
  root.add(vi.obj);
  const dn = dna(1e-9, 70e-9);
  dn.obj.position.set(-60, GTOP + 2, 210);
  dn.obj.rotation.y = 0.35;
  root.add(dn.obj);
  L([-420, M1Y[1] + 120, -330], 'Grippevirus', 'Influenza virus', 100e-9, -5.9, -6.9, 'life');
  L([-60, GTOP + 8, 210], 'DNA-Doppelhelix', 'DNA double helix', 2e-9, -6.75, -7.6, 'life');

  // Beim Übergang zu den Atomen: Gates, Spacer und Kontakte ausblenden, nur Finnen und Epitaxie bleiben
  anims.push((f) => {
    const cut = smoothstep(-6.95, -7.3, f.z);
    for (const m of [g1, s1, tcnMesh]) {
      setFade(m, 1 - cut);
      m.visible = cut < 0.99;
    }
    root.children.forEach((c) => {
      if (c.userData.cell) {
        setFade(c, 1 - cut);
        c.visible = cut < 0.99;
      }
    });
  });

  // Abheben der oberen Lagen
  const zM1 = -6.35;
  const zM0 = -6.62;
  anims.push((f) => {
    const a1 = smoothstep(zM1 - 0.25, zM1 + 0.05, f.z);
    const a0 = smoothstep(zM0 - 0.25, zM0 + 0.05, f.z);
    setFade(m1Mesh, a1);
    m1Mesh.position.y = (1 - a1) * 30;
    setFade(m0Mesh, a0);
    setFade(v0Mesh, a0);
    m0Mesh.position.y = (1 - a0) * 20;
    v0Mesh.position.y = m0Mesh.position.y;
    vi.update?.(f.t, f.dt);
    dn.update?.(f.t, f.dt);
    setFade(vi.obj, a1);
  });

  const pickPlane = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), new THREE.MeshBasicMaterial({ visible: false }));
  pickPlane.rotation.x = -Math.PI / 2;
  root.add(pickPlane);
  void phys;
  return { root, labels, pick: [pickPlane], update: (f) => anims.forEach((a) => a(f)) };
}
