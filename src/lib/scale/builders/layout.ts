/**
 * Maße und Lage aller Bauteile auf der Platine (in mm, ATX: 244 × 305 mm).
 * x: nach rechts, z: nach vorne (unterer Platinenrand), y: nach oben. Oberseite der Platine bei y = 0.
 * Die Ankerpunkte der Unter-Ebenen stehen hier, damit Platine und Ebenen-Liste dieselben Zahlen benutzen.
 */
import type { Vec3 } from '../types';

export const BOARD = { w: 244, d: 305, t: 1.6 };

export const CPU = { x: -8, z: -66, pkgW: 37.5, pkgD: 45, sockTop: 3.0, subT: 1.15, dieW: 10.8, dieD: 23.8, dieT: 0.55, ihsT: 3.0 };
export const CPU_SUB_TOP = CPU.sockTop + CPU.subT;
export const CPU_DIE_TOP = CPU_SUB_TOP + 0.08 + CPU.dieT;

export const DIMM = { slotsX: [46, 56.5, 67, 77.5], filled: [1, 3], z: -62, len: 133.35, h: 31.25, t: 1.27, bottom: 2.4 };
export const RAM_CHIP = { w: 8.2, h: 11, t: 0.95, y: 2.4 + 18.5 };
/** Chip-Position (z) auf dem Riegel, 4 + 4 Chips links und rechts der Mitte */
export const RAM_CHIP_Z = [-54, -40, -26, -12, 12, 26, 40, 54];

export const M2 = { x0: -64, z: -18, len: 80, w: 22, y: 2.2, t: 0.8 };
export const SSD_NAND = { x: -34, w: 14, d: 18, t: 1.2 };

export const PCIE1_Z = 12;
export const GPU = { x0: -121, x1: 146, y0: 3, y1: 114, pcbT: 1.6, coolerZ: 52, dieX: -22, dieY: 60, subT: 1.6, dieW: 24.6, dieH: 24.8, dieT: 0.8 };
export const GPU_PCB_FRONT = PCIE1_Z + GPU.pcbT / 2;
export const GPU_DIE_FACE = GPU_PCB_FRONT + 0.25 + GPU.subT + 0.06 + GPU.dieT;

export const PCH = { x: 88, z: 72, sub: 25, subT: 1.0, dieW: 9, dieD: 7.5, dieT: 0.5 };
export const PCH_DIE_TOP = PCH.subT + 0.08 + PCH.dieT;

export const HDD = { x: 218, z: -6, w: 101.6, d: 147, h: 26.1, floor: 3, platterY: 19.5, platterR: 47.5 };
/** Platte und Arm im Laufwerk (lokale Koordinaten, relativ zur HDD-Mitte) */
export const HDD_SPINDLE = { x: 0, z: -24 };
export const HDD_PIVOT = { x: 35, z: 44 };
export const HDD_ARM_LEN = 66;
export const HDD_HEAD_R = 34;
/** Winkel des Arms, bei dem der Kopf über Spur-Radius HDD_HEAD_R steht (gelöst per Bisektion) */
export const HDD_ARM_ANGLE = (() => {
  const head = (a: number) => [HDD_PIVOT.x - Math.sin(a) * HDD_ARM_LEN, HDD_PIVOT.z - Math.cos(a) * HDD_ARM_LEN];
  const r = (a: number) => Math.hypot(head(a)[0] - HDD_SPINDLE.x, head(a)[1] - HDD_SPINDLE.z);
  let lo = 0;
  let hi = 1.2;
  // r(a) fällt, wenn der Arm zur Spindel schwenkt
  for (let i = 0; i < 60; i++) {
    const m = (lo + hi) / 2;
    if (r(m) > HDD_HEAD_R) lo = m;
    else hi = m;
  }
  return (lo + hi) / 2;
})();
export const hddHeadAt = (a: number): [number, number] => [HDD_PIVOT.x - Math.sin(a) * HDD_ARM_LEN, HDD_PIVOT.z - Math.cos(a) * HDD_ARM_LEN];
export const HDD_FLY = 0.00003; // ein Hauch über der Platte (3 nm wären 0,000003 mm – hier nur fürs Bild)

export const ANT = { x: 33, z: -24, r: 5.5 };

/** Anker der Unter-Ebenen (Einheiten der Platine: mm) */
export const ANCHORS = {
  cpuDie: [CPU.x, CPU_DIE_TOP, CPU.z] as Vec3,
  ramDie: [DIMM.slotsX[1] - DIMM.t / 2 - RAM_CHIP.t, RAM_CHIP.y, DIMM.z + RAM_CHIP_Z[3]] as Vec3,
  ssdPkg: [SSD_NAND.x, M2.y + M2.t + SSD_NAND.t, M2.z] as Vec3,
  gpuDie: [GPU.dieX, GPU.dieY, GPU_DIE_FACE] as Vec3,
  pchDie: [PCH.x, PCH_DIE_TOP, PCH.z] as Vec3,
  hddHead: (() => {
    const [hx, hz] = hddHeadAt(HDD_ARM_ANGLE);
    return [HDD.x + hx, HDD.platterY, HDD.z + hz] as Vec3;
  })(),
};

/** Grundflächen aller Bauteile (für „freie Platine“ beim Zoomen) [x0, z0, x1, z1] */
export const FOOTPRINTS: [number, number, number, number][] = [];
export function addFootprint(cx: number, cz: number, w: number, d: number, pad = 1.5) {
  FOOTPRINTS.push([cx - w / 2 - pad, cz - d / 2 - pad, cx + w / 2 + pad, cz + d / 2 + pad]);
}
export function isBare(x: number, z: number): boolean {
  if (Math.abs(x) > BOARD.w / 2 - 4 || Math.abs(z) > BOARD.d / 2 - 4) return false;
  for (const f of FOOTPRINTS) if (x >= f[0] && x <= f[2] && z >= f[1] && z <= f[3]) return false;
  return true;
}
