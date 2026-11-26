/** Die Hauptplatine mit allen Bauteilen – Maße in Millimetern. */
import type { Built, BuildCtx, Frame, LabelDef } from '../types';
import { smoothstep, t } from '../zoom';
import {
  THREE,
  MAT,
  boxOn,
  canvasTex,
  contactShadow,
  inst,
  makeCanvas,
  mesh,
  noiseTex,
  phys,
  rbox,
  rng,
  setFade,
  std,
  textTex,
  type InstSpec,
} from './kit';
import {
  ANT,
  BOARD,
  CPU,
  CPU_SUB_TOP,
  DIMM,
  GPU,
  GPU_PCB_FRONT,
  HDD,
  HDD_ARM_ANGLE,
  HDD_ARM_LEN,
  HDD_PIVOT,
  HDD_SPINDLE,
  M2,
  PCIE1_Z,
  PCH,
  RAM_CHIP,
  RAM_CHIP_Z,
  SSD_NAND,
  addFootprint,
  FOOTPRINTS,
} from './layout';
import { drawPcb } from './pcbart';
import { ant } from './life';
import { buildFan, type Fan } from './fan';

const HW = BOARD.w / 2;
const HD = BOARD.d / 2;

export function buildBoard(ctx: BuildCtx): Built {
  FOOTPRINTS.length = 0;
  const A = ctx.aniso;
  const root = new THREE.Group();
  const anims: ((f: Frame) => void)[] = [];
  const labels: LabelDef[] = [];
  const pick: THREE.Object3D[] = [];
  const r = rng(42);
  /** Bauteil markieren: Name für die Infokarte, Treffer beim Zielen */
  const tag = <T extends THREE.Object3D>(o: T, id: string): T => {
    o.userData.part = id;
    pick.push(o);
    return o;
  };

  // ─────────────── Platine
  const { cv, g } = makeCanvas(2560, 3200);
  drawPcb(g, -HW, -HD, HW, HD, cv.width, cv.height, 'color');
  const rough = makeCanvas(1280, 1600);
  drawPcb(rough.g, -HW, -HD, HW, HD, rough.cv.width, rough.cv.height, 'rough');
  const height = makeCanvas(1280, 1600);
  drawPcb(height.g, -HW, -HD, HW, HD, height.cv.width, height.cv.height, 'height');
  const topMat = std({ map: canvasTex(cv, A), roughnessMap: canvasTex(rough.cv, A, false), roughness: 1, metalness: 0.1, bumpMap: canvasTex(height.cv, A, false), bumpScale: 0.035 });
  const top = new THREE.Mesh(new THREE.PlaneGeometry(BOARD.w, BOARD.d), topMat);
  top.rotation.x = -Math.PI / 2;
  top.userData.surface = 'pcb';
  root.add(tag(top, 'pcb'));
  const edge = std({ color: 0x2a2e27, roughness: 0.8 });
  const body = mesh(new THREE.BoxGeometry(BOARD.w, BOARD.t, BOARD.d), edge, 0, -BOARD.t / 2 - 0.001, 0);
  root.add(body);
  // Boden-Schatten
  const sh = contactShadow(BOARD.w * 1.25, BOARD.d * 1.2, A, 0.75, -BOARD.t - 6);
  root.add(sh);
  const sh2 = contactShadow(HDD.w * 1.5, HDD.d * 1.35, A, 0.7, -BOARD.t - 6);
  sh2.position.x = HDD.x;
  sh2.position.z = HDD.z;
  root.add(sh2);

  // Befestigungslöcher
  const ringMat = MAT.tin({ roughness: 0.35 });
  const holeMat = std({ color: 0x050505, roughness: 1 });
  for (const [x, z] of [
    [-112, -145],
    [48, -145],
    [112, -145],
    [-112, -16],
    [36, 2],
    [112, -16],
    [-112, 145],
    [48, 145],
    [112, 145],
  ]) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(2, 3.6, 40), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.02, z);
    const hole = new THREE.Mesh(new THREE.CircleGeometry(2, 32), holeMat);
    hole.rotation.x = -Math.PI / 2;
    hole.position.set(x, 0.03, z);
    root.add(ring, hole);
    addFootprint(x, z, 8, 8);
  }

  // Gemeinsame Materialien
  const blackPlastic = MAT.plastic(0x121315, { roughness: 0.55 });
  const greyPlastic = MAT.plastic(0xc3c8cf, { roughness: 0.5 });
  const gun = std({ color: 0x2b2e34, metalness: 0.75, roughness: 0.38, roughnessMap: noiseTex(256, A, 4, 120, 170, 1) });
  const accent = MAT.alu({ roughness: 0.25 });
  const epoxy = MAT.epoxy();

  // ─────────────── CPU-Sockel und Prozessor
  const cpu = new THREE.Group();
  cpu.position.set(CPU.x, 0, CPU.z);
  root.add(tag(cpu, 'cpu'));
  addFootprint(CPU.x, CPU.z, 56, 64);
  cpu.add(boxOn(47.5, CPU.sockTop, 57, blackPlastic, 0, 0, 0, 0.4));
  const steel = MAT.steel({ roughness: 0.32 });
  const fy = CPU.sockTop;
  const ow = CPU.pkgW / 2 + 3.2;
  const od = CPU.pkgD / 2 + 3.2;
  cpu.add(boxOn(3.6, 1.7, 2 * od + 3.6, steel, -ow, fy, 0), boxOn(3.6, 1.7, 2 * od + 3.6, steel, ow, fy, 0));
  cpu.add(boxOn(2 * ow, 1.7, 3.6, steel, 0, fy, -od), boxOn(2 * ow, 1.7, 3.6, steel, 0, fy, od));
  // Ladeplatte
  const plate = MAT.steel({ roughness: 0.22 });
  cpu.add(boxOn(2 * ow + 3.6, 0.35, 4.5, plate, 0, fy + 1.7, -od + 0.2), boxOn(2 * ow + 3.6, 0.35, 4.5, plate, 0, fy + 1.7, od - 0.2));
  // Hebel
  const lever = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 2 * od + 10, 20), steel);
  lever.rotation.x = Math.PI / 2;
  lever.position.set(ow + 5.2, fy + 1.0, 0);
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 8, 16), steel);
  handle.rotation.z = Math.PI / 2;
  handle.position.set(ow + 1.5, fy + 1.0, od + 5);
  cpu.add(lever, handle);
  for (const [sx, sz] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ]) {
    const scr = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 1.4, 6), MAT.nickel());
    scr.position.set(sx * (ow + 1), fy + 2.3, sz * (od + 6));
    cpu.add(scr);
  }
  // Träger (Substrat) mit Kondensatoren
  const sub = MAT.substrate({ color: 0x1e4a36 });
  cpu.add(boxOn(CPU.pkgW, CPU.subT, CPU.pkgD, sub, 0, CPU.sockTop, 0, 0.2));
  const caps: InstSpec[] = [];
  for (let i = 0; i < 26; i++) {
    const zz = (i % 13) * 2.4 - 14.4;
    caps.push({ p: [-13 + (i < 13 ? 0 : 26), CPU_SUB_TOP + 0.25, zz], c: 0x9b7f5a });
  }
  for (let i = 0; i < 16; i++) caps.push({ p: [(i % 8) * 2.6 - 9, CPU_SUB_TOP + 0.25, i < 8 ? -21.3 : 21.3], c: 0x9b7f5a });
  // Kondensatoren rund um den Chip (sichtbar, wenn der Deckel abgehoben ist)
  for (let i = 0; i < 18; i++) caps.push({ p: [-7.6 + (i % 2) * 15.2, CPU_SUB_TOP + 0.25, -11 + Math.floor(i / 2) * 2.7], c: 0x8c7552 });
  cpu.add(inst(new THREE.BoxGeometry(0.5, 0.5, 1.0), MAT.ceramic({ roughness: 0.45 }), caps));
  // Chip unter dem Deckel (Rückseite: spiegelndes Silizium mit Lotschicht)
  cpu.add(boxOn(CPU.dieW, CPU.dieT, CPU.dieD, MAT.silicon({ iridescence: 0.2 }), 0, CPU_SUB_TOP + 0.08, 0));
  // Deckel (Heatspreader)
  const ihs = new THREE.Group();
  const ihsTex = (() => {
    const c = makeCanvas(1024, 1229);
    c.g.fillStyle = '#c8cbd0';
    c.g.fillRect(0, 0, 1024, 1229);
    const n = rng(8);
    for (let i = 0; i < 9000; i++) {
      c.g.fillStyle = `rgba(${n.chance(0.5) ? '255,255,255' : '0,0,0'},${n.range(0.02, 0.06)})`;
      c.g.fillRect(n.next() * 1024, n.next() * 1229, n.range(2, 60), 1);
    }
    c.g.fillStyle = 'rgba(40,44,52,0.55)';
    c.g.font = '600 58px "JetBrains Mono Variable", monospace';
    c.g.textAlign = 'center';
    c.g.fillText('TINY JOHNNY CORE', 512, 420);
    c.g.font = '500 40px "JetBrains Mono Variable", monospace';
    c.g.fillText('TJ-24C · 3.2 GHz · 125 W', 512, 500);
    c.g.fillText('X4K21B07 · MADE FOR LEARNING', 512, 560);
    // 2D-Code
    for (let i = 0; i < 12; i++) for (let j = 0; j < 12; j++) if (n.chance(0.5)) c.g.fillRect(430 + i * 14, 640 + j * 14, 14, 14);
    return canvasTex(c.cv, A);
  })();
  const ihsMat = MAT.nickel({ map: ihsTex, roughness: 0.3 });
  const ihsFlange = MAT.nickel({ roughness: 0.3 });
  ihs.add(boxOn(CPU.pkgW - 2.4, 0.8, CPU.pkgD - 5.2, ihsFlange, 0, CPU_SUB_TOP, 0, 0.6));
  const ihsTop = boxOn(CPU.pkgW - 7, CPU.ihsT - 0.8, CPU.pkgD - 7, [ihsFlange, ihsFlange, ihsMat, ihsFlange, ihsFlange, ihsFlange] as unknown as THREE.Material, 0, CPU_SUB_TOP + 0.8, 0);
  ihs.add(ihsTop);
  cpu.add(ihs);
  anims.push((f) => {
    const k = f.near('cpu.die') * smoothstep(-1.2, -1.75, f.z);
    ihs.position.y = k * 16;
    ihs.position.x = k * 6;
    ihs.rotation.z = -k * 0.35;
    setFade(ihs, 1 - smoothstep(0.55, 1, k));
  });

  // ─────────────── Spannungswandler: Spulen, Kondensatoren, Kühlkörper
  const chokeTex = textTex(['R22', '2440'], { w: 256, h: 256, color: '#c9c9c9', bg: '#46484c', aniso: A });
  const chokeMat = MAT.ferrite({ map: chokeTex, roughness: 0.7 });
  const chokeSide = MAT.ferrite();
  const chokeGeo = rbox(10, 6.2, 10, 0.7);
  const chokeAt = (x: number, z: number) => {
    const c = new THREE.Mesh(chokeGeo, [chokeSide, chokeSide, chokeMat, chokeSide, chokeSide, chokeSide]);
    c.position.set(x, 3.1, z);
    root.add(tag(c, 'vrm'));
    addFootprint(x, z, 10, 10, 0.5);
  };
  for (let i = 0; i < 8; i++) chokeAt(-52 + i * 11.5, -112);
  for (let i = 0; i < 7; i++) chokeAt(-74, -100 + i * 11.5);
  const capTop = textTex(['820', '6.3V'], { w: 128, h: 128, color: '#e8e8e8', bg: '#5b2a6e', aniso: A });
  const capSide = MAT.alu({ roughness: 0.3 });
  const capTopMat = std({ map: capTop, metalness: 0.4, roughness: 0.35 });
  const capGeo = new THREE.CylinderGeometry(4, 4, 7, 32);
  const capAt = (x: number, z: number, h = 7) => {
    const c = new THREE.Mesh(capGeo, [capSide, capTopMat, capSide]);
    c.scale.y = h / 7;
    c.position.set(x, h / 2, z);
    root.add(tag(c, 'caps'));
    addFootprint(x, z, 8, 8, 0.5);
  };
  for (let i = 0; i < 9; i++) capAt(-46 + i * 9, -101);
  for (let i = 0; i < 7; i++) capAt(-62, -88 + i * 9);
  // Kühlkörper oben
  const hsTop = new THREE.Group();
  hsTop.add(boxOn(94, 4, 16, gun, 0, 0, 0, 0.4));
  const fins: InstSpec[] = [];
  for (let i = 0; i < 22; i++) fins.push({ p: [-44 + i * 4.2, 4 + 9, 0], s: [1.4, 18, 15] });
  hsTop.add(inst(new THREE.BoxGeometry(1, 1, 1), gun, fins));
  hsTop.add(boxOn(96, 5, 17, gun, 0, 22, 0, 1.2));
  hsTop.add(boxOn(70, 0.6, 0.8, accent, 0, 27, 8.2));
  hsTop.position.set(-11, 0, -128);
  root.add(hsTop);
  addFootprint(-11, -128, 96, 17);
  // Kühlkörper links mit Anschluss-Abdeckung
  const hsLeft = new THREE.Group();
  hsLeft.add(boxOn(34, 30, 124, gun, 0, 0, 0, 2.2));
  for (let i = 0; i < 5; i++) hsLeft.add(boxOn(34.4, 0.8, 1.2, accent, 0, 8 + i * 4.5, 40 - i * 4));
  hsLeft.add(boxOn(0.6, 18, 90, accent, 17.2, 6, -10));
  hsLeft.position.set(-102, 0, -88);
  root.add(hsLeft);
  addFootprint(-102, -88, 36, 126);
  tag(hsLeft, 'heatsink');
  tag(hsTop, 'heatsink');
  // EPS-Stromanschluss
  const eps = boxOn(17.5, 13, 9.6, blackPlastic, -60, 0, -146, 0.3);
  root.add(tag(eps, 'eps'));
  addFootprint(-60, -146, 18, 10);

  // ─────────────── Anschlüsse hinten (ragen über den Rand)
  const io = new THREE.Group();
  const ioSteel = MAT.steel({ roughness: 0.3 });
  const blue = MAT.plastic(0x1f5fd6);
  for (const [z, kind] of [
    [-140, 'usb'],
    [-118, 'usb3'],
    [-96, 'usbc'],
    [-72, 'rj45'],
    [-48, 'hdmi'],
    [-26, 'audio'],
  ] as [number, string][]) {
    if (kind === 'audio') {
      const cols = [0x3ab0ff, 0x7ed957, 0xff6fb5, 0xff9f2e, 0x222222];
      cols.forEach((c, i) => {
        const j = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 6, 24), MAT.plastic(c, { roughness: 0.35 }));
        j.rotation.z = Math.PI / 2;
        j.position.set(-125, 4 + (i % 3) * 6.5, z + (i < 3 ? -4 : 4));
        io.add(j);
      });
      continue;
    }
    const h = kind === 'rj45' ? 13.5 : kind === 'hdmi' ? 6 : 14.5;
    io.add(boxOn(16, h, kind === 'rj45' ? 16 : 14, ioSteel, -122, 0, z, 0.3));
    if (kind.startsWith('usb')) {
      io.add(boxOn(16.2, 1.6, 9, kind === 'usb3' ? blue : blackPlastic, -122, 3, z));
      io.add(boxOn(16.2, 1.6, 9, kind === 'usb3' ? blue : blackPlastic, -122, 10, z));
    }
  }
  root.add(tag(io, 'io'));

  // ─────────────── Arbeitsspeicher-Steckplätze und Riegel
  const slotLatch = greyPlastic;
  DIMM.slotsX.forEach((x, i) => {
    const s = new THREE.Group();
    s.add(boxOn(6.4, 2.8, 144, blackPlastic, 0, 0, 0));
    s.add(boxOn(2.1, 8.6, 144, blackPlastic, -2.15, 0, 0), boxOn(2.1, 8.6, 144, blackPlastic, 2.15, 0, 0));
    s.add(boxOn(6.8, 11, 5, slotLatch, 0, 0, -74, 0.4), boxOn(6.8, 11, 5, slotLatch, 0, 0, 74, 0.4));
    s.position.set(x, 0, DIMM.z);
    root.add(tag(s, 'dimmslot'));
    addFootprint(x, DIMM.z, 7, 154, 1);
    void i;
  });
  const dimmPcb = std({ color: 0x0c4429, roughness: 0.5, metalness: 0.1 });
  const dramTex = textTex(['TJ D5', 'D5R16G8', '2448 ·  ·'], { w: 256, h: 340, color: '#8e9196', bg: '#18191b', aniso: A, align: 'left' });
  const dramTop = std({ map: dramTex, roughness: 0.68 });
  // Rückseite: −x-Fläche zeigt die Textur gespiegelt → gespiegelte Kopie verwenden
  const dramTexM = dramTex.clone();
  dramTexM.wrapS = THREE.RepeatWrapping;
  dramTexM.repeat.x = -1;
  const dramTopM = std({ map: dramTexM, roughness: 0.68 });
  const fingers: InstSpec[] = [];
  const smd: InstSpec[] = [];
  let anchorChip: THREE.Mesh | null = null;
  const dimmPick: THREE.Object3D[] = [];
  for (const si of DIMM.filled) {
    const x = DIMM.slotsX[si];
    const stick = new THREE.Group();
    const p = boxOn(DIMM.t, DIMM.h, DIMM.len, dimmPcb, x, DIMM.bottom, DIMM.z, 0.2);
    stick.add(p);
    dimmPick.push(p);
    for (const side of [-1, 1]) {
      for (let k = 0; k < 144; k++) fingers.push({ p: [x + side * (DIMM.t / 2 + 0.01), DIMM.bottom + 1.8, DIMM.z - 62 + k * 0.85 + (k > 72 ? 2 : 0)], s: [0.04, 3.4, 0.6] });
      RAM_CHIP_Z.forEach((cz, ci) => {
        const chipMats = [epoxy, epoxy, epoxy, epoxy, epoxy, epoxy] as THREE.Material[];
        const isAnchor = si === 1 && side === -1 && ci === 3;
        const faceMat = isAnchor ? std({ map: dramTexM, roughness: 0.68 }) : side > 0 ? dramTop : dramTopM;
        // Box-Flächen: +x, −x, +y, −y, +z, −z
        if (side > 0) chipMats[0] = faceMat;
        else chipMats[1] = faceMat;
        const c = new THREE.Mesh(rbox(RAM_CHIP.t, RAM_CHIP.h, RAM_CHIP.w, 0.15), isAnchor ? chipMats.map((m) => (m === epoxy ? MAT.epoxy() : m)) : chipMats);
        c.position.set(x + side * (DIMM.t / 2 + RAM_CHIP.t / 2), RAM_CHIP.y, DIMM.z + cz);
        stick.add(c);
        if (isAnchor) anchorChip = c;
      });
      // kleine Bauteile
      for (let k = 0; k < 60; k++) smd.push({ p: [x + side * (DIMM.t / 2 + 0.25), DIMM.bottom + r.range(5, 9), DIMM.z + r.range(-64, 64)], s: [0.5, 0.5, 1], c: r.chance(0.6) ? 0x9b7f5a : 0x161616 });
      // PMIC + SPD
      stick.add(boxOn(0.8, 4, 4, epoxy, x + side * (DIMM.t / 2 + 0.4), DIMM.bottom + 22.5, DIMM.z, 0.1));
    }
    root.add(tag(stick, 'ram'));
  }
  root.add(inst(new THREE.BoxGeometry(1, 1, 1), MAT.gold({ roughness: 0.18 }), fingers));
  anims.push((f) => {
    if (!anchorChip) return;
    const k = f.near('ram.die') * smoothstep(-1.55, -1.95, f.z);
    setFade(anchorChip, 1 - k);
  });

  // ATX-24-Pin
  const atx = new THREE.Group();
  atx.add(boxOn(10.6, 13, 52, blackPlastic, 0, 0, 0, 0.4));
  const holes: InstSpec[] = [];
  for (let i = 0; i < 12; i++) for (let j = 0; j < 2; j++) holes.push({ p: [-2.1 + j * 4.2, 13.02, -23 + i * 4.2], s: [3, 0.05, 3] });
  atx.add(inst(new THREE.BoxGeometry(1, 1, 1), std({ color: 0x050505, roughness: 1 }), holes));
  atx.position.set(112, 0, -60);
  root.add(tag(atx, 'atx'));
  addFootprint(112, -60, 11, 52);

  // ─────────────── M.2-SSD
  const ssd = new THREE.Group();
  const ssdPcb = std({ color: 0x0d0f12, roughness: 0.55 });
  ssd.add(boxOn(4.5, 3.2, 22.5, blackPlastic, M2.x0 - 1.8, 0, M2.z, 0.2));
  const ssdBoard = boxOn(M2.len, M2.t, M2.w, ssdPcb, M2.x0 + M2.len / 2, M2.y, M2.z, 0.4);
  ssd.add(ssdBoard);
  const ssdFing: InstSpec[] = [];
  for (let k = 0; k < 30; k++) ssdFing.push({ p: [M2.x0 + 1.5, M2.y + M2.t + 0.01, M2.z - 9.5 + k * 0.65 + (k > 23 ? 1.2 : 0)], s: [3, 0.03, 0.35] });
  ssd.add(inst(new THREE.BoxGeometry(1, 1, 1), MAT.gold(), ssdFing));
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, M2.y, 6), MAT.gold({ color: 0xd6b26a, roughness: 0.35 }));
  stand.position.set(M2.x0 + M2.len - 1, M2.y / 2, M2.z);
  const scr = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 1.2, 24), MAT.nickel());
  scr.position.set(M2.x0 + M2.len - 1, M2.y + M2.t + 0.6, M2.z);
  ssd.add(stand, scr);
  const ctrlTex = textTex(['TJ-S5', 'NVMe 5.0', 'CTRL'], { w: 256, h: 256, color: '#9aa0a8', bg: '#151619', aniso: A });
  const nandTex = textTex(['TJ NAND', '3D TLC 2Tb', '232L'], { w: 256, h: 320, color: '#9aa0a8', bg: '#16171a', aniso: A });
  const sy = M2.y + M2.t;
  ssd.add(boxOn(12, 1.1, 12, [epoxy, epoxy, std({ map: ctrlTex, roughness: 0.6 }), epoxy, epoxy, epoxy] as unknown as THREE.Material, M2.x0 + 14, sy, M2.z, 0.2));
  const nandMats = () => [MAT.epoxy(), MAT.epoxy(), std({ map: nandTex, roughness: 0.6 }), MAT.epoxy(), MAT.epoxy(), MAT.epoxy()];
  const nand1 = boxOn(SSD_NAND.w, SSD_NAND.t, SSD_NAND.d, nandMats() as unknown as THREE.Material, SSD_NAND.x, sy, M2.z, 0.2);
  const nand2 = boxOn(SSD_NAND.w, SSD_NAND.t, SSD_NAND.d, nandMats() as unknown as THREE.Material, SSD_NAND.x + 20, sy, M2.z, 0.2);
  ssd.add(nand1, nand2);
  ssd.add(boxOn(8, 1, 12, [epoxy, epoxy, dramTop, epoxy, epoxy, epoxy] as unknown as THREE.Material, M2.x0 + 66, sy, M2.z, 0.15));
  for (let k = 0; k < 40; k++) smd.push({ p: [M2.x0 + r.range(8, 76), sy + 0.25, M2.z + (r.chance(0.5) ? -1 : 1) * r.range(7.5, 10)], s: [1, 0.5, 0.5], c: r.chance(0.6) ? 0x9b7f5a : 0x161616 });
  root.add(tag(ssd, 'ssd'));
  addFootprint(M2.x0 + M2.len / 2, M2.z, M2.len + 6, M2.w + 2);
  anims.push((f) => {
    const k = f.near('ssd.pkg') * smoothstep(-1.55, -1.95, f.z);
    setFade(nand1, 1 - k);
  });

  // ─────────────── PCIe-Steckplätze
  const slot = (x0: number, len: number, z: number, mat: THREE.Material, armor: boolean) => {
    const s = new THREE.Group();
    s.add(boxOn(len, 11, 7.6, mat, x0 + len / 2, 0, z, 0.3));
    s.add(boxOn(len, 0.3, 1.8, std({ color: 0x050505 }), x0 + len / 2, 11, z));
    if (armor) {
      s.add(boxOn(len + 1, 11.4, 0.35, MAT.steel({ roughness: 0.25 }), x0 + len / 2, 0, z - 4));
      s.add(boxOn(len + 1, 11.4, 0.35, MAT.steel({ roughness: 0.25 }), x0 + len / 2, 0, z + 4));
      s.add(boxOn(4, 12, 8.5, greyPlastic, x0 + len + 2, 0, z, 0.4));
    }
    root.add(tag(s, 'pcie'));
    addFootprint(x0 + len / 2, z, len + 6, 9);
  };
  slot(-95, 89, PCIE1_Z, blackPlastic, true);
  slot(-95, 25, 52, blackPlastic, false);
  slot(-95, 89, 92, greyPlastic, false);
  slot(-95, 25, 132, blackPlastic, false);

  // ─────────────── Chipsatz: Träger, Chip und Kühlkörper (hebt beim Hineinzoomen ab)
  const pch = new THREE.Group();
  pch.userData.part = 'pch';
  pch.add(boxOn(PCH.sub, PCH.subT, PCH.sub, MAT.substrate({ color: 0x1f4632 }), 0, 0, 0, 0.2));
  pch.add(boxOn(PCH.dieW, PCH.dieT, PCH.dieD, MAT.silicon({ iridescence: 0.2 }), 0, PCH.subT + 0.08, 0));
  const pchCaps: InstSpec[] = [];
  for (let i = 0; i < 24; i++) {
    const side = i % 4;
    const k = Math.floor(i / 4) * 2.4 - 6;
    const pos: [number, number] = side === 0 ? [k, -9] : side === 1 ? [k, 9] : side === 2 ? [-9, k] : [9, k];
    pchCaps.push({ p: [pos[0], PCH.subT + 0.25, pos[1]], s: side < 2 ? [1, 0.5, 0.5] : [0.5, 0.5, 1] });
  }
  pch.add(inst(new THREE.BoxGeometry(1, 1, 1), MAT.ceramic({ roughness: 0.45 }), pchCaps));
  const pchSink = new THREE.Group();
  pchSink.add(boxOn(40, 9, 36, gun, 0, PCH.subT + 0.7, 0, 1.4));
  for (let i = 0; i < 6; i++) pchSink.add(boxOn(36, 0.4, 1.2, accent, 0, PCH.subT + 9.7, -12 + i * 4.8));
  pchSink.add(textLabelPlate('TINY JOHNNY', A, 30, 6, 0, PCH.subT + 9.95, 13));
  pch.add(pchSink);
  pch.position.set(PCH.x, 0, PCH.z);
  root.add(tag(pch, 'pch'));
  addFootprint(PCH.x, PCH.z, 40, 36);
  anims.push((f) => {
    const k = f.near('pch.die') * smoothstep(-1.1, -1.6, f.z);
    pchSink.position.y = k * 22;
    pchSink.position.x = k * 8;
    pchSink.rotation.z = k * 0.3;
    setFade(pchSink, 1 - smoothstep(0.5, 1, k));
    pchSink.visible = k < 0.999;
  });

  // SATA, USB-Header, Lüfteranschlüsse, Frontpanel
  for (const [z, y] of [
    [118, 0],
    [132, 0],
    [118, 6.2],
    [132, 6.2],
  ])
    root.add(tag(boxOn(12, 6, 9, blackPlastic, 115, y, z, 0.3), 'sata'));
  addFootprint(115, 125, 12, 24);
  root.add(tag(boxOn(9, 9, 19, MAT.plastic(0x2b4e9e), 113, 0, 24, 0.3), 'usbhdr'));
  addFootprint(113, 24, 9, 19);
  const white = MAT.plastic(0xf2f2ee, { roughness: 0.45 });
  for (const [x, z] of [
    [30, -146],
    [-112, 68],
    [100, 147],
  ]) {
    root.add(tag(boxOn(10, 6, 5.5, white, x, 0, z, 0.3), 'fanhdr'));
    addFootprint(x, z, 10, 6);
  }
  const pins: InstSpec[] = [];
  for (let i = 0; i < 10; i++) pins.push({ p: [74 + (i % 5) * 2.54, 1 + 3, 146 + Math.floor(i / 5) * 2.54], s: [0.64, 6, 0.64] });
  root.add(tag(boxOn(13, 2.5, 6, blackPlastic, 79, 0, 147.3), 'fpanel'));
  root.add(inst(new THREE.BoxGeometry(1, 1, 1), MAT.gold(), pins));
  addFootprint(79, 147, 14, 7);

  // CMOS-Batterie
  root.add(tag(boxOn(23, 2.2, 23, blackPlastic, 40, 0, 125, 1), 'battery'));
  const cell = new THREE.Mesh(
    new THREE.CylinderGeometry(10, 10, 3.2, 64),
    [MAT.steel({ roughness: 0.2 }), MAT.steel({ map: textTex(['CR2032', '3V  +'], { w: 256, h: 256, color: '#4a4d52', bg: '#c9ccd0', aniso: A }), roughness: 0.25 }), MAT.steel()],
  );
  cell.position.set(40, 2.2 + 1.6, 125);
  root.add(tag(cell, 'battery'));
  addFootprint(40, 125, 23, 23);
  // BIOS-Chip
  root.add(tag(boxOn(5, 1.5, 4, epoxy, -10, 0, 124, 0.1), 'bios'));
  addFootprint(-10, 124, 6, 6);
  // Audio
  const gold = MAT.plastic(0xc9a03b, { roughness: 0.4, metalness: 0.3 });
  for (let i = 0; i < 6; i++) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 7, 28), [gold, std({ color: 0xb2b5b9, metalness: 1, roughness: 0.3 }), gold]);
    c.position.set(-112 + (i % 3) * 9, 3.5, 128 + Math.floor(i / 3) * 10);
    root.add(tag(c, 'audio'));
    addFootprint(c.position.x, c.position.z, 7, 7);
  }
  root.add(tag(boxOn(11, 1.4, 11, MAT.tin({ roughness: 0.35 }), -84, 0, 112, 0.2), 'audio'));
  addFootprint(-84, 112, 11, 11);

  // ─────────────── Grafikkarte (steht im ersten PCIe-Steckplatz)
  const gpu = new THREE.Group();
  root.add(tag(gpu, 'gpu'));
  const gLen = GPU.x1 - GPU.x0;
  const gH = GPU.y1 - GPU.y0;
  const gcx = (GPU.x0 + GPU.x1) / 2;
  const gcy = (GPU.y0 + GPU.y1) / 2;
  const gpcb = std({ color: 0x0b0c0f, roughness: 0.55 });
  gpu.add(mesh(new THREE.BoxGeometry(gLen, gH, GPU.pcbT), gpcb, gcx, gcy, PCIE1_Z));
  // Vorderseite: Substrat, Chip, Speicher, Spannungswandler
  const front = GPU_PCB_FRONT;
  const gsub = MAT.substrate({ color: 0x23402f });
  const onFront = (w: number, h: number, d: number, mat: THREE.Material | THREE.Material[], x: number, y: number, z0 = front, r0 = 0.2) => {
    const geo = r0 > 0 ? rbox(w, h, d, r0) : new THREE.BoxGeometry(w, h, d);
    const mm = new THREE.Mesh(geo, mat as THREE.Material);
    mm.position.set(x, y, z0 + d / 2);
    gpu.add(mm);
    return mm;
  };
  onFront(52, 52, GPU.subT, gsub, GPU.dieX, GPU.dieY, front + 0.25);
  onFront(GPU.dieW, GPU.dieH, GPU.dieT, MAT.silicon({ iridescence: 0.2 }), GPU.dieX, GPU.dieY, front + 0.25 + GPU.subT + 0.06, 0);
  const gddrTex = textTex(['TJ G7', 'GDDR7 16Gb', '32Gbps'], { w: 560, h: 480, color: '#9aa0a8', bg: '#17181b', aniso: A });
  const gddrMat = [epoxy, epoxy, epoxy, epoxy, std({ map: gddrTex, roughness: 0.62 }), epoxy];
  for (let i = 0; i < 4; i++) onFront(14, 12, 1.2, gddrMat, GPU.dieX - 27 + i * 18, GPU.dieY + 40);
  for (let i = 0; i < 4; i++) onFront(14, 12, 1.2, gddrMat, GPU.dieX - 27 + i * 18, GPU.dieY - 40);
  for (let i = 0; i < 2; i++) onFront(12, 14, 1.2, gddrMat, GPU.dieX - 42, GPU.dieY - 9 + i * 18);
  for (let i = 0; i < 2; i++) onFront(12, 14, 1.2, gddrMat, GPU.dieX + 42, GPU.dieY - 9 + i * 18);
  for (let i = 0; i < 14; i++) {
    const c = new THREE.Mesh(chokeGeo, [chokeSide, chokeSide, chokeMat, chokeSide, chokeSide, chokeSide]);
    c.rotation.x = Math.PI / 2;
    c.scale.set(0.8, 0.8, 0.8);
    c.position.set(40 + (i % 7) * 12, 34 + Math.floor(i / 7) * 46, front + 2.5);
    gpu.add(c);
  }
  const gsmd: InstSpec[] = [];
  for (let i = 0; i < 140; i++) {
    const a = r.range(0, Math.PI * 2);
    const rad = r.range(28, 34);
    gsmd.push({ p: [GPU.dieX + Math.cos(a) * rad, GPU.dieY + Math.sin(a) * rad, front + 0.25], s: [1, 0.5, 0.5], c: r.chance(0.6) ? 0x9b7f5a : 0x161616 });
  }
  gpu.add(inst(new THREE.BoxGeometry(1, 1, 1), MAT.ceramic({ roughness: 0.45 }), gsmd));
  // Rückplatte
  const back = std({ color: 0x1d1f23, metalness: 0.8, roughness: 0.42 });
  gpu.add(mesh(rbox(gLen - 6, gH - 2, 2.4, 0.8), back, gcx + 2, gcy, PCIE1_Z - GPU.pcbT / 2 - 2.5));
  // Slotblech
  const bracket = MAT.steel({ roughness: 0.3 });
  gpu.add(mesh(new THREE.BoxGeometry(1, gH + 10, 46), bracket, GPU.x0 - 0.5, gcy + 4, PCIE1_Z + 18));
  for (let i = 0; i < 4; i++) gpu.add(mesh(new THREE.BoxGeometry(1.4, 9, 14), std({ color: 0x0a0a0a }), GPU.x0 - 0.6, 20 + i * 14, PCIE1_Z + 16));
  // Kühler (wird beim Hineinzoomen ausgeblendet)
  const cooler = new THREE.Group();
  gpu.add(cooler);
  const finMat = MAT.alu({ roughness: 0.35 });
  const gfins: InstSpec[] = [];
  for (let i = 0; i < 120; i++) gfins.push({ p: [GPU.x0 + 12 + i * 2.12, gcy, front + 3 + 13.5], s: [0.35, gH - 10, 27] });
  cooler.add(inst(new THREE.BoxGeometry(1, 1, 1), finMat, gfins));
  const pipeMat = MAT.copper({ roughness: 0.22 });
  for (let i = 0; i < 6; i++) {
    const zz = front + 6 + i * 3.6;
    const pts = [new THREE.Vector3(GPU.dieX - 18 + i * 7, GPU.dieY, zz), new THREE.Vector3(GPU.dieX - 18 + i * 7, GPU.y1 + 2, zz), new THREE.Vector3(GPU.x0 + 40 + i * 30, GPU.y1 + 3, zz), new THREE.Vector3(GPU.x0 + 50 + i * 34, GPU.y0 + 12, zz)];
    const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.2);
    cooler.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 80, 1.6, 14), pipeMat));
  }
  // Abdeckung mit drei Lüfteröffnungen
  const fanX = [GPU.x0 + 50, GPU.x0 + 138, GPU.x0 + 226];
  const fanR = 41.5; // Öffnungen (Ø 85 mm) dürfen sich bei 88 mm Abstand nicht berühren
  const shape = new THREE.Shape();
  const sw = gLen - 2;
  const sh0 = gH + 2;
  shape.moveTo(-sw / 2 + 8, -sh0 / 2);
  shape.lineTo(sw / 2 - 8, -sh0 / 2);
  shape.lineTo(sw / 2, -sh0 / 2 + 8);
  shape.lineTo(sw / 2, sh0 / 2 - 4);
  shape.lineTo(sw / 2 - 4, sh0 / 2);
  shape.lineTo(-sw / 2 + 14, sh0 / 2);
  shape.lineTo(-sw / 2, sh0 / 2 - 14);
  shape.lineTo(-sw / 2, -sh0 / 2 + 6);
  for (const fx of fanX) {
    const hole = new THREE.Path();
    hole.absarc(fx - gcx, 0, fanR + 1, 0, Math.PI * 2, true);
    shape.holes.push(hole);
  }
  const shroudGeo = new THREE.ExtrudeGeometry(shape, { depth: 3, bevelEnabled: true, bevelSize: 1, bevelThickness: 1, bevelSegments: 2, curveSegments: 64 });
  const shroud = new THREE.Mesh(shroudGeo, gun);
  shroud.position.set(gcx, gcy, front + 34);
  cooler.add(shroud);
  cooler.add(mesh(new THREE.BoxGeometry(gLen - 4, 2, 34), gun, gcx, GPU.y1 + 1, front + 18));
  cooler.add(mesh(new THREE.BoxGeometry(gLen - 4, 2, 34), gun, gcx, GPU.y0 + 1, front + 18));
  cooler.add(mesh(new THREE.BoxGeometry(gLen - 30, 1.2, 0.6), accent, gcx + 10, GPU.y1 - 3, front + 38.6));
  // Lüfter (eigene Flügelgeometrie, siehe fan.ts) mit angefasten Ringen in der Abdeckung
  const fans: Fan[] = [];
  const frameMat = std({ color: 0x1e2126, metalness: 0.4, roughness: 0.5 });
  for (const fx of fanX) {
    const fan = buildFan(fanR, A, frameMat);
    fan.obj.position.set(fx, gcy, front + 31);
    cooler.add(fan.obj);
    fans.push(fan);
    const bezel = new THREE.Mesh(new THREE.TorusGeometry(fanR + 1.2, 0.7, 12, 128), MAT.aluDark({ roughness: 0.35 }));
    bezel.position.set(fx, gcy, front + 37.2);
    cooler.add(bezel);
  }
  // Lichtleiste an der Oberkante
  const glow = std({ color: 0x0b0d12, emissive: 0x7fb8ff, emissiveIntensity: 1.6, roughness: 0.4 });
  cooler.add(mesh(new THREE.BoxGeometry(gLen - 60, 1.4, 1.2), glow, gcx + 12, GPU.y1 - 0.8, front + 38.2));
  anims.push((f) => {
    const sp = f.reduced ? 0.3 : 1.6;
    fans.forEach((fan, i) => fan.update(f.dt, sp * (1 + i * 0.04)));
    const k = f.near('gpu.die') * smoothstep(-1.2, -1.52, f.z);
    cooler.position.z = k * 90;
    const a = 1 - smoothstep(0.03, 0.45, k);
    setFade(cooler, a);
    for (const fan of fans) fan.blur.userData.fade = a * fan.blurK;
    glow.emissiveIntensity = 1.3 + 0.4 * Math.sin(f.t * 1.4);
    cooler.visible = k < 0.45;
  });
  addFootprint(gcx, PCIE1_Z + 25, gLen, 52);

  // ─────────────── Festplatte (liegt neben der Platine, Deckel offen)
  const hdd = new THREE.Group();
  hdd.position.set(HDD.x, 0, HDD.z);
  root.add(tag(hdd, 'hdd'));
  const cast = std({ color: 0x8f949b, metalness: 0.85, roughness: 0.55, roughnessMap: noiseTex(256, A, 21, 100, 190, 1) });
  hdd.add(boxOn(HDD.w, HDD.floor, HDD.d, cast, 0, 0, 0, 1));
  const wall = 4;
  hdd.add(boxOn(wall, HDD.h, HDD.d, cast, -HDD.w / 2 + wall / 2, 0, 0, 0.8), boxOn(wall, HDD.h, HDD.d, cast, HDD.w / 2 - wall / 2, 0, 0, 0.8));
  hdd.add(boxOn(HDD.w, HDD.h, wall, cast, 0, 0, -HDD.d / 2 + wall / 2, 0.8), boxOn(HDD.w, HDD.h, wall, cast, 0, 0, HDD.d / 2 - wall / 2, 0.8));
  const hddPcb = std({ color: 0x0f3b26, roughness: 0.6 });
  hdd.add(boxOn(HDD.w - 6, 1.2, HDD.d - 20, hddPcb, 0, -1.2, 6));
  hdd.add(boxOn(40, 7, 5, blackPlastic, -10, 2, HDD.d / 2 + 1.5, 0.3));
  // Schraubenlöcher oben
  for (const [x, z] of [
    [-HDD.w / 2 + 2, -HDD.d / 2 + 2],
    [HDD.w / 2 - 2, -HDD.d / 2 + 2],
    [-HDD.w / 2 + 2, HDD.d / 2 - 2],
    [HDD.w / 2 - 2, HDD.d / 2 - 2],
    [-HDD.w / 2 + 2, 0],
    [HDD.w / 2 - 2, 0],
  ]) {
    const hh = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.2, 16), holeMat);
    hh.position.set(x, HDD.h + 0.01, z);
    hdd.add(hh);
  }
  // Scheiben (zwei) und Spindel
  const platters = new THREE.Group();
  platters.position.set(HDD_SPINDLE.x, 0, HDD_SPINDLE.z);
  hdd.add(platters);
  const platMat = phys({ color: 0xb9bec6, metalness: 1, roughness: 0.1, anisotropy: 0.6, clearcoat: 0.2, envMapIntensity: 0.4 });
  for (const py of [HDD.platterY - 1.27, HDD.platterY - 6]) {
    const pl = new THREE.Mesh(new THREE.CylinderGeometry(HDD.platterR, HDD.platterR, 1.27, 128), platMat);
    pl.position.y = py + 0.635;
    platters.add(pl);
  }
  const clamp = new THREE.Mesh(new THREE.CylinderGeometry(15, 15.5, 1.6, 64), MAT.steel({ roughness: 0.18 }));
  clamp.position.y = HDD.platterY + 0.8;
  platters.add(clamp);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(6.5, 6.5, 2.6, 48), MAT.alu({ roughness: 0.25 }));
  hub.position.y = HDD.platterY + 1.3;
  platters.add(hub);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const s = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 1, 6), MAT.steel({ color: 0x6d7076 }));
    s.position.set(Math.cos(a) * 11, HDD.platterY + 1.9, Math.sin(a) * 11);
    platters.add(s);
  }
  const bigPick = new THREE.Mesh(new THREE.CylinderGeometry(HDD.platterR, HDD.platterR, 0.1, 64), new THREE.MeshBasicMaterial({ visible: false }));
  bigPick.position.set(HDD_SPINDLE.x, HDD.platterY, HDD_SPINDLE.z);
  hdd.add(bigPick);
  // Aktuator: Lager, Arm, Aufhängung, Kopf
  const arm = new THREE.Group();
  arm.position.set(HDD_PIVOT.x, 0, HDD_PIVOT.z);
  hdd.add(arm);
  const bearing = new THREE.Mesh(new THREE.CylinderGeometry(6.5, 6.5, 18, 40), MAT.alu({ roughness: 0.3 }));
  bearing.position.y = HDD.floor + 9;
  arm.add(bearing);
  const armShape = new THREE.Shape();
  armShape.moveTo(-7, 0);
  armShape.lineTo(7, 0);
  armShape.lineTo(3.2, -42);
  armShape.lineTo(-3.2, -42);
  armShape.closePath();
  const hole = new THREE.Path();
  hole.absellipse(0, -20, 2, 9, 0, Math.PI * 2, true, 0);
  armShape.holes.push(hole);
  const armGeo = new THREE.ExtrudeGeometry(armShape, { depth: 1.2, bevelEnabled: false });
  armGeo.rotateX(Math.PI / 2);
  const armMesh = new THREE.Mesh(armGeo, MAT.alu({ roughness: 0.32 }));
  armMesh.position.y = HDD.platterY + 2.4;
  armMesh.rotation.y = 0;
  // Shape liegt in x/y; nach rotateX(+90°) zeigt y → −z
  arm.add(armMesh);
  const susp = new THREE.Group();
  const sShape = new THREE.Shape();
  sShape.moveTo(-3, 0);
  sShape.lineTo(3, 0);
  sShape.lineTo(0.8, -(HDD_ARM_LEN - 42));
  sShape.lineTo(-0.8, -(HDD_ARM_LEN - 42));
  sShape.closePath();
  const sGeo = new THREE.ExtrudeGeometry(sShape, { depth: 0.08, bevelEnabled: false });
  sGeo.rotateX(Math.PI / 2);
  const suspMesh = new THREE.Mesh(sGeo, MAT.steel({ color: 0xd2d5da, roughness: 0.22 }));
  susp.add(suspMesh);
  susp.position.set(0, HDD.platterY + 1.3, -42);
  susp.rotation.x = -Math.atan2(1.1, HDD_ARM_LEN - 42);
  arm.add(susp);
  const slider = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.23, 0.85), std({ color: 0x3a3d42, metalness: 0.3, roughness: 0.35 }));
  slider.position.set(0, HDD.platterY + 0.115 + 0.002, -HDD_ARM_LEN);
  arm.add(slider);
  // Schwingspule und Magnet
  const coilShape = new THREE.Shape();
  coilShape.absarc(0, 0, 26, Math.PI * 0.18, Math.PI * 0.82, false);
  coilShape.absarc(0, 0, 10, Math.PI * 0.82, Math.PI * 0.18, true);
  const coilGeo = new THREE.ExtrudeGeometry(coilShape, { depth: 2.5, bevelEnabled: false, curveSegments: 32 });
  coilGeo.rotateX(Math.PI / 2);
  const coil = new THREE.Mesh(coilGeo, MAT.copper({ color: 0xb8653a, roughness: 0.45 }));
  coil.position.y = HDD.platterY + 2.5;
  arm.add(coil);
  const mag = new THREE.Mesh(coilGeo.clone().scale(1.15, 1.6, 1.15), MAT.nickel({ roughness: 0.15 }));
  mag.position.set(HDD_PIVOT.x, HDD.platterY + 6.5, HDD_PIVOT.z);
  mag.rotation.y = 0.0;
  hdd.add(mag);
  // Flexkabel
  const flex = new THREE.Mesh(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([new THREE.Vector3(HDD_PIVOT.x - 6, HDD.platterY, HDD_PIVOT.z), new THREE.Vector3(HDD_PIVOT.x - 16, HDD.platterY - 4, HDD_PIVOT.z + 12), new THREE.Vector3(HDD_PIVOT.x - 30, HDD.floor + 3, HDD_PIVOT.z + 18)]),
      30,
      0.6,
      6,
    ),
    std({ color: 0xc98a28, roughness: 0.4, metalness: 0.2 }),
  );
  hdd.add(flex);
  // Parkrampe
  hdd.add(boxOn(6, 4, 4, MAT.plastic(0x222428), HDD_SPINDLE.x + 44, HDD.platterY - 2, HDD_SPINDLE.z + 22, 0.3));

  let armAng = HDD_ARM_ANGLE;
  let armGoal = HDD_ARM_ANGLE;
  let seekT = 0;
  anims.push((f) => {
    platters.rotation.y -= f.dt * (f.reduced ? 0.6 : 2 * Math.PI * 0.9);
    const near = f.near('hdd.surface');
    seekT -= f.dt;
    if (near > 0.02) armGoal = HDD_ARM_ANGLE;
    else if (seekT <= 0) {
      seekT = r.range(0.45, 1.3);
      armGoal = HDD_ARM_ANGLE + r.range(-0.2, 0.24);
    }
    armAng += (armGoal - armAng) * (1 - Math.exp(-f.dt * 14));
    arm.rotation.y = armAng;
    setFade(susp, 1 - near * smoothstep(-2.3, -2.7, f.z));
  });
  addFootprint(HDD.x, HDD.z, HDD.w, HDD.d);

  // ─────────────── Kleinteile: Keramik-Kondensatoren und Widerstände (Instanzen)
  const bare = (x: number, z: number) => {
    for (const fp of FOOTPRINTS) if (x >= fp[0] && x <= fp[2] && z >= fp[1] && z <= fp[3]) return false;
    if (Math.hypot(x - ANT.x, z - ANT.z) < ANT.r + 4) return false;
    return Math.abs(x) < HW - 3 && Math.abs(z) < HD - 3;
  };
  const clusters: [number, number, number, number][] = [
    [CPU.x - 36, CPU.z, 4, 50],
    [CPU.x + 30, CPU.z - 20, 6, 40],
    [CPU.x, CPU.z + 36, 44, 5],
    [60, 100, 30, 12],
    [-80, 118, 14, 20],
    [100, -10, 12, 30],
    [-40, 70, 40, 6],
    [-20, -145, 50, 4],
  ];
  for (const [cx, cz, w, d] of clusters)
    for (let i = 0; i < 70; i++) {
      const x = cx + r.range(-w / 2, w / 2);
      const z = cz + r.range(-d / 2, d / 2);
      if (!bare(x, z)) continue;
      const rot = r.chance(0.5);
      smd.push({ p: [x, 0.25, z], s: rot ? [1, 0.5, 0.5] : [0.5, 0.5, 1], c: r.chance(0.65) ? 0x9b7f5a : 0x141414 });
      addFootprint(x, z, rot ? 1 : 0.5, rot ? 0.5 : 1, 0.2);
    }
  for (let i = 0; i < 260; i++) {
    const x = r.range(-HW + 6, HW - 6);
    const z = r.range(-HD + 6, HD - 6);
    if (!bare(x, z)) continue;
    const rot = r.chance(0.5);
    const big = r.chance(0.2);
    const s = big ? 1.6 : 1;
    smd.push({ p: [x, 0.25 * s, z], s: rot ? [1 * s, 0.5 * s, 0.5 * s] : [0.5 * s, 0.5 * s, 1 * s], c: r.chance(0.6) ? 0x9b7f5a : 0x141414 });
    addFootprint(x, z, s, s, 0.2);
  }
  root.add(inst(new THREE.BoxGeometry(1, 1, 1), MAT.ceramic({ roughness: 0.42, color: 0xffffff }), smd));
  // silberne Anschlusskappen der Kleinteile
  const ends: InstSpec[] = [];
  for (const it of smd) {
    const [sx, sy, sz] = it.s!;
    const alongX = sx > sz;
    const l = alongX ? sx : sz;
    for (const sgn of [-1, 1])
      ends.push({
        p: [it.p[0] + (alongX ? (sgn * l * 0.42) : 0), it.p[1], it.p[2] + (alongX ? 0 : sgn * l * 0.42)],
        s: alongX ? [l * 0.18, sy * 1.04, sz * 1.04] : [sx * 1.04, sy * 1.04, l * 0.18],
      });
  }
  root.add(inst(new THREE.BoxGeometry(1, 1, 1), MAT.tin({ roughness: 0.3 }), ends));

  // ─────────────── Ameise
  const a = ant(1e-3);
  root.add(tag(a.obj, 'ant'));
  let antPhi = 0;
  const antPos: [number, number, number] = [ANT.x, 0.5, ANT.z];
  anims.push((f) => {
    if (!f.reduced) antPhi += f.dt * 0.32;
    const x = ANT.x + Math.cos(antPhi) * ANT.r;
    const z = ANT.z + Math.sin(antPhi) * ANT.r;
    a.obj.position.set(x, 0.04, z);
    a.obj.rotation.y = -(antPhi + Math.PI / 2);
    antPos[0] = x;
    antPos[2] = z;
    if (!f.reduced) a.update?.(f.t, f.dt);
  });

  // ─────────────── Beschriftungen
  const L = (pos: [number, number, number], de: string, en: string, size: number | undefined, zMax: number, zMin: number, kind: 'part' | 'life' = 'part', live?: () => [number, number, number]) =>
    labels.push({ pos, text: t(de, en), size, zMax, zMin, kind, live });
  L([CPU.x, 10, CPU.z], 'Prozessor (CPU)', 'Processor (CPU)', 0.045, 0.1, -1.25);
  L([DIMM.slotsX[1], 36, DIMM.z + 48], 'Arbeitsspeicher (RAM)', 'Memory (RAM)', 0.13335, 0.1, -1.1);
  L([M2.x0 + 46, 5, M2.z], 'SSD (M.2)', 'SSD (M.2)', 0.08, 0.1, -1.2);
  L([40, GPU.y1 + 6, PCIE1_Z + 30], 'Grafikkarte (GPU)', 'Graphics card (GPU)', 0.267, 0.1, -0.9);
  L([HDD.x, HDD.h + 4, HDD.z + 52], 'Festplatte (HDD) · 3,5″', 'Hard disk (HDD) · 3.5″', 0.147, 0.1, -1.15);
  L([-11, 32, -128], 'Spannungswandler', 'Voltage regulators', undefined, -0.35, -1.3);
  L([PCH.x, 13, PCH.z], 'Chipsatz', 'Chipset', 0.025, -0.4, -1.3);
  L([40, 6, 125], 'CMOS-Batterie', 'CMOS battery', 0.02, -0.55, -1.5);
  L([-6, 8, -101], 'Kondensatoren', 'Capacitors', 0.008, -0.8, -1.6);
  L([HDD.x + HDD_SPINDLE.x, HDD.platterY + 3, HDD.z + HDD_SPINDLE.z - 30], 'Magnetscheibe · 7200 U/min', 'Magnetic platter · 7200 rpm', 0.095, -0.6, -1.5);
  L([-30, 0.5, 40], 'Leiterbahnen', 'Copper traces', undefined, -1.1, -2.2);
  L(antPos, 'Ameise', 'Ant', 3e-3, -1.3, -2.6, 'life', () => [antPos[0], 2.2, antPos[2]]);

  return {
    root,
    labels,
    pick,
    update(f) {
      for (const an of anims) an(f);
    },
  };
}

function textLabelPlate(s: string, aniso: number, w: number, h: number, x: number, y: number, z: number) {
  const tx = textTex([s], { w: 512, h: 100, color: '#cfd3d8', aniso });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tx, transparent: true, metalness: 0.6, roughness: 0.3 }));
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y, z);
  return m;
}
