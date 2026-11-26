/**
 * Alle Zoomstufen. z = log10(Sichtfeld in Metern): −0,3 ≈ 50 cm, −3 = 1 mm, −6 = 1 µm, −9 = 1 nm.
 *
 *  Mainboard ─┬─ CPU:  Chip → Kern → Kupferlagen → Transistoren (NAND) → Atome
 *             ├─ RAM:  Chip → Bank → Zellenfeld → Kondensatoren → Atome
 *             ├─ SSD:  Gehäuse mit Chipstapel → Speicherfeld → 3D-NAND-Block → Atome
 *             ├─ HDD:  Schreib-/Lesekopf → Datenspuren → Magnetkörner → Atome
 *             ├─ GPU:  Chip → Streaming-Multiprozessor → Kupferlagen → SRAM-Zelle → Atome
 *             └─ freie Platine: Leiterbahnen → Glasfasergewebe
 */
import type { BuildCtx, LevelDef, Vec3 } from './types';
import { t } from './zoom';
import { buildBoard } from './builders/board';
import { buildDieLevel, buildTexLevel } from './builders/chip';
import { CPU_DIE, DRAM_DIE, GPU_DIE, NAND_DIE, findBlock, type Die } from './builders/dieshot';
import { buildMetal, METAL_BOTTOM } from './builders/metal';
import { buildFinfet } from './builders/finfet';
import { buildCapAtoms, buildFinAtoms, buildGrainAtoms, buildTrapAtoms } from './builders/atoms';
import { buildDramCells } from './builders/dram';
import { buildNandPkg, buildNandStack, STACK_H, TOP_DIE_Y } from './builders/nand';
import { buildHddGrains, buildHddSurface, buildHddTracks, GRAIN_TOP } from './builders/hdd';
import { buildPcbPatch } from './builders/pcb';
import { ANCHORS, CPU, HDD_ARM_ANGLE, HDD_SPINDLE, hddHeadAt, isBare } from './builders/layout';
import { THREE } from './builders/kit';
import { dustMite, hair, saltGrain } from './builders/life';

const PI = Math.PI;

/** Punkt auf dem Chip (Chip-Koordinaten in mm) → lokale Koordinaten der Chip-Ebene */
const onDie = (d: Die, x: number, y: number, h = 0): Vec3 => [x - d.w / 2, h, y - d.h / 2];
const centerOf = (d: Die, name: string): [number, number] => {
  const b = findBlock(d, name);
  return [b.x + b.w / 2, b.y + b.h / 2];
};
/** Mittelpunkt mehrerer Blöcke mit gleichem Namensanfang */
const groupCenter = (d: Die, prefix: string): [number, number] => {
  const bs = d.blocks.filter((b) => b.name?.startsWith(prefix));
  const x0 = Math.min(...bs.map((b) => b.x));
  const x1 = Math.max(...bs.map((b) => b.x + b.w));
  const y0 = Math.min(...bs.map((b) => b.y));
  const y1 = Math.max(...bs.map((b) => b.y + b.h));
  return [(x0 + x1) / 2, (y0 + y1) / 2];
};

const CORE_F = centerOf(CPU_DIE, 'p1:exec');
const SM_F = groupCenter(GPU_DIE, 'sm2t4:');
const BANK_F = (() => {
  const b = DRAM_DIE.blocks.filter((x) => x.name === 'bank')[5];
  return [b.x + b.w * 0.4, b.y + b.h * 0.45] as [number, number];
})();
const PLANE_F = (() => {
  const b = NAND_DIE.blocks.filter((x) => x.name === 'plane')[1];
  return [b.x + b.w * 0.5, b.y + b.h * 0.5] as [number, number];
})();

/** Fahrtrichtung der Plattenoberfläche unter dem Kopf → Drehung der Kopf-Ebene */
const HDD_ROT = (() => {
  const [hx, hz] = hddHeadAt(HDD_ARM_ANGLE);
  const rx = hx - HDD_SPINDLE.x;
  const rz = hz - HDD_SPINDLE.z;
  return Math.atan2(-rz, rx);
})();

let pcbAnchor: Vec3 = [0, 0, 0];

/** Beschriftung eines Chip-Blocks relativ zum Brennpunkt (µm) */
const blockLabel = (d: Die, name: string, fx: number, fy: number, de: string, en: string, zMax: number, zMin: number, prefix = false) => {
  const [cx, cy] = prefix ? groupCenter(d, name) : centerOf(d, name);
  const b = prefix ? null : findBlock(d, name);
  return { pos: [(cx - fx) * 1000, 4, (cy - fy) * 1000] as Vec3, text: t(de, en), size: b ? Math.max(b.w, b.h) * 1e-3 : undefined, zMax, zMin };
};

export const LEVELS: LevelDef[] = [
  {
    id: 'board',
    parent: null,
    unit: 1e-3,
    anchor: [0, 0, 0],
    zIn: 1,
    zCover: 0,
    floor: -2.25,
    catchR: 1,
    pullR: 1,
    title: t('Mainboard', 'Motherboard'),
    captions: [
      { z: 1, text: t('Ein Mainboard im ATX-Format: 30,5 × 24,4 cm. Ziehen zum Drehen, scrollen zum Hineinzoomen – zum Beispiel auf den Prozessor.', 'An ATX motherboard: 30.5 × 24.4 cm. Drag to rotate, scroll to zoom in – for example on the processor.') },
      { z: -0.75, text: t('Je näher du kommst, desto mehr Details tauchen auf. Zeig mit der Maus auf ein Bauteil und zoome weiter.', 'The closer you get, the more details appear. Point at a part and keep zooming.') },
      { z: -1.4, text: t('Kleinste Bauteile hier: Kondensatoren mit 1 × 0,5 mm. Die Ameise ist 3 mm lang.', 'Smallest parts here: capacitors of 1 × 0.5 mm. The ant is 3 mm long.') },
    ],
    build: buildBoard,
  },

  // ───────────────────────── CPU
  {
    id: 'cpu.die',
    parent: 'board',
    unit: 1e-3,
    anchor: ANCHORS.cpuDie,
    rot: [0, PI / 2, 0],
    frame: true,
    zIn: -1.55,
    zCover: -2.0,
    floor: -3.0,
    catchR: 0.016,
    pullR: 0.034,
    view: { pitch: 64 },
    title: t('Prozessor-Chip', 'Processor die'),
    path: 'cpu',
    captions: [
      { z: -1.55, text: t('Unter dem Metalldeckel liegt der eigentliche Chip: ein Stück Silizium, 24 × 11 mm, kaum dicker als ein Blatt Papier.', 'Under the metal lid sits the actual chip: a piece of silicon, 24 × 11 mm, barely thicker than a sheet of paper.') },
      { z: -1.95, text: t('Der Chip liegt kopfüber im Gehäuse (Flip-Chip). Wir drehen ihn um – jetzt sieht man die Schaltungen.', 'The die sits upside down in the package (flip chip). We turn it over – now you can see the circuits.') },
      { z: -2.2, text: t('8 große und 16 kleine Kerne, dazwischen der L3-Cache, rechts die Grafikeinheit. Rund 20 Milliarden Transistoren.', '8 big and 16 small cores, the L3 cache in between, the graphics unit on the right. Around 20 billion transistors.') },
    ],
    build: (ctx) =>
      buildDieLevel(ctx, {
        die: CPU_DIE,
        thick: CPU.dieT,
        texW: 4096,
        substrate: { w: CPU.pkgD, d: CPU.pkgW, t: CPU.subT, color: 0x1e4a36, caps: 70 },
        flip: [-1.8, -2.15],
        labels: [
          { pos: onDie(CPU_DIE, ...groupCenter(CPU_DIE, 'p1:'), 0.1), text: t('Prozessorkern', 'CPU core'), size: 2.25e-3, zMax: -2.1, zMin: -2.7 },
          { pos: onDie(CPU_DIE, ...centerOf(CPU_DIE, 'l3'), 0.1), text: t('L3-Cache', 'L3 cache'), zMax: -2.1, zMin: -2.6 },
          { pos: onDie(CPU_DIE, 18.6, 5.4, 0.1), text: t('Grafikeinheit', 'Graphics unit'), zMax: -2.1, zMin: -2.6 },
          { pos: onDie(CPU_DIE, 1.3, 5.4, 0.1), text: t('Speicher-Controller', 'Memory controller'), zMax: -2.1, zMin: -2.6 },
          { pos: onDie(CPU_DIE, 14.6, 2.3, 0.1), text: t('Effizienzkerne', 'Efficiency cores'), zMax: -2.15, zMin: -2.6 },
        ],
      }),
  },
  {
    id: 'cpu.core',
    parent: 'cpu.die',
    unit: 1e-6,
    anchor: onDie(CPU_DIE, ...CORE_F),
    zIn: -2.35,
    zCover: -2.75,
    floor: -3.85,
    catchR: 0.0012,
    pullR: 0.004,
    view: { pitch: 62 },
    title: t('Kern', 'Core'),
    captions: [
      { z: -2.35, text: t('Ein Prozessorkern, 2,3 × 4,2 mm: Rechenwerke, Steuerung und Caches. Die farbigen Flächen sind Millionen Transistoren.', 'One processor core, 2.3 × 4.2 mm: execution units, control and caches. The coloured areas are millions of transistors.') },
      { z: -3.0, text: t('Ein Salzkorn wäre hier so groß wie ein ganzer Block des Kerns. Ein Haar ist 70 µm dick.', 'A grain of salt would cover a whole block of the core. A hair is 70 µm thick.') },
    ],
    build: (ctx) => {
      const [fx, fy] = CORE_F;
      return buildTexLevel(ctx, {
        die: CPU_DIE,
        cx: fx,
        cy: fy,
        size: 4.4,
        texW: 3072,
        scale: 1000,
        labels: [
          blockLabel(CPU_DIE, 'p1:exec', fx, fy, 'Rechenwerke (ganze Zahlen)', 'Integer execution units', -2.55, -3.25),
          blockLabel(CPU_DIE, 'p1:l2', fx, fy, 'L2-Cache (2 MB)', 'L2 cache (2 MB)', -2.45, -3.1),
          blockLabel(CPU_DIE, 'p1:l1d', fx, fy, 'L1-Datencache', 'L1 data cache', -2.6, -3.3),
          blockLabel(CPU_DIE, 'p1:fpu', fx, fy, 'Gleitkomma-Einheit', 'Floating-point unit', -2.6, -3.3),
          blockLabel(CPU_DIE, 'p1:ooo', fx, fy, 'Befehlsplanung', 'Instruction scheduling', -2.6, -3.3),
          { pos: [-420, 40, 260], text: t('Menschliches Haar', 'Human hair'), size: 70e-6, zMax: -2.6, zMin: -3.7, kind: 'life' },
          { pos: [520, 330, -380], text: t('Salzkorn', 'Grain of salt'), size: 0.3e-3, zMax: -2.5, zMin: -3.4, kind: 'life' },
          { pos: [-620, 160, -520], text: t('Hausstaubmilbe', 'Dust mite'), size: 0.3e-3, zMax: -2.5, zMin: -3.4, kind: 'life' },
        ],
        extra: (root, anims, c) => {
          const h = hair(1e-6, 3.6e-3, c.aniso);
          h.obj.position.set(-420, 0, 260);
          h.obj.rotation.y = 0.55;
          const s = saltGrain(1e-6);
          s.obj.position.set(520, 0, -380);
          const m = dustMite(1e-6);
          m.obj.position.set(-620, 0, -520);
          m.obj.rotation.y = 0.8;
          root.add(h.obj, s.obj, m.obj);
          anims.push((f) => m.update?.(f.t, f.dt));
        },
      });
    },
  },
  {
    id: 'cpu.metal',
    parent: 'cpu.core',
    unit: 1e-6,
    anchor: [0, 0, 0],
    zIn: -3.35,
    zCover: -3.75,
    floor: -5.95,
    catchR: 300e-6,
    pullR: 900e-6,
    view: { pitch: 52 },
    title: t('Leiterbahnen', 'Interconnect'),
    captions: [
      { z: -3.35, text: t('Über den Transistoren liegen bis zu 17 Lagen aus Kupfer – hier ohne das Isoliermaterial dazwischen, wie unter dem Elektronenmikroskop.', 'Up to 17 copper layers sit above the transistors – shown here without the insulation in between, as under an electron microscope.') },
      { z: -4.3, text: t('Je tiefer, desto feiner: Jede Lage ist etwa dreimal dünner als die darüber. Wir heben sie nacheinander ab.', 'The deeper, the finer: each layer is about three times thinner than the one above. We lift them off one by one.') },
      { z: -5.2, text: t('Ein Bakterium (2 µm) ist hier schon größer als die Leitungen, über die die Signale laufen.', 'A bacterium (2 µm) is already larger than the wires that carry the signals.') },
    ],
    build: (ctx) => buildMetal(ctx, 9),
  },
  {
    id: 'cpu.gates',
    parent: 'cpu.metal',
    unit: 1e-9,
    anchor: [0, METAL_BOTTOM - 0.16, 0],
    zIn: -5.5,
    zCover: -5.95,
    floor: -7.6,
    catchR: 1.2e-6,
    pullR: 3e-6,
    view: { pitch: 48, yaw: -20 },
    title: t('Transistoren', 'Transistors'),
    captions: [
      { z: -5.5, text: t('Ganz unten: die Transistoren. Senkrecht die Gates, darunter Finnen aus Silizium – 30 nm Abstand.', 'At the very bottom: the transistors. Gates running across, silicon fins underneath – 30 nm apart.') },
      { z: -6.2, text: t('Vier Transistoren bilden ein NAND-Gatter. Leuchtet ein Gate (blau), ist der Eingang 1. Der Ausgang (orange) ist nur 0, wenn beide Eingänge 1 sind.', 'Four transistors form a NAND gate. A glowing gate (blue) means input 1. The output (orange) is 0 only if both inputs are 1.') },
      { z: -6.8, text: t('Strom fließt nur beim Umschalten – Elektronen durch die NMOS-, Löcher durch die PMOS-Transistoren. Ein Virus ist größer als das ganze Gatter.', 'Current flows only when switching – electrons through the NMOS, holes through the PMOS transistors. A virus is bigger than the whole gate.') },
    ],
    build: (ctx) => buildFinfet(ctx, 'nand', 5),
  },
  {
    id: 'cpu.atoms',
    parent: 'cpu.gates',
    unit: 1e-9,
    anchor: [0, 0, 0],
    zIn: -7.3,
    zCover: -7.85,
    floor: -9.35,
    catchR: 4e-9,
    pullR: 25e-9,
    view: { pitch: 34, yaw: 28, minPitch: 4 },
    title: t('Atome', 'Atoms'),
    captions: [
      { z: -7.3, text: t('Wir schneiden das Gate auf und schauen in die Finne: ein Kristall aus Silizium-Atomen.', 'We cut the gate open and look into the fin: a crystal of silicon atoms.') },
      { z: -8.0, text: t('Jedes Atom hat vier Nachbarn im Abstand von 0,235 nm. Darüber der Isolator aus Hafniumoxid – nur 1,5 nm dick.', 'Each atom has four neighbours 0.235 nm away. Above it the hafnium oxide insulator – only 1.5 nm thick.') },
      { z: -8.7, text: t('Hier endet die Reise: Vom ganzen Mainboard bis hierher haben wir rund eine Milliarde Mal vergrößert.', 'The journey ends here: from the whole motherboard to this point we magnified about a billion times.') },
    ],
    path: 'cpu',
    build: buildFinAtoms,
  },

  // ───────────────────────── RAM
  {
    id: 'ram.die',
    parent: 'board',
    unit: 1e-3,
    anchor: ANCHORS.ramDie,
    rot: [0, 0, PI / 2],
    frame: true,
    zIn: -1.6,
    zCover: -2.1,
    floor: -3.0,
    catchR: 0.012,
    pullR: 0.026,
    view: { pitch: 78, yaw: 90 },
    title: t('DRAM-Chip', 'DRAM die'),
    path: 'ram',
    captions: [
      { z: -1.6, text: t('Ein Speicherchip des Arbeitsspeichers – das Gehäuse blenden wir aus. Golddrähte verbinden den Chip mit dem Riegel.', 'One memory chip of the RAM stick – we hide the package. Gold wires connect the die to the module.') },
      { z: -2.2, text: t('16 Gigabit auf 10 × 6,6 mm: Die großen Felder (Bänke) bestehen aus Milliarden winziger Kondensatoren.', '16 gigabits on 10 × 6.6 mm: the large fields (banks) consist of billions of tiny capacitors.') },
    ],
    build: (ctx) =>
      buildDieLevel(ctx, {
        die: DRAM_DIE,
        thick: 0.1,
        texW: 3072,
        substrate: { w: 11, d: 8.2, t: 0.3, color: 0x16351f },
        bonds: { y: DRAM_DIE.h / 2, n: 24 },
        labels: [
          { pos: onDie(DRAM_DIE, ...BANK_F, 0.05), text: t('Speicherbank', 'Memory bank'), zMax: -2.0, zMin: -2.7 },
          { pos: onDie(DRAM_DIE, DRAM_DIE.w / 2, DRAM_DIE.h / 2, 0.3), text: t('Anschlüsse mit Golddrähten', 'Pads with gold wires'), size: 25e-6, zMax: -1.9, zMin: -2.6 },
        ],
      }),
  },
  {
    id: 'ram.bank',
    parent: 'ram.die',
    unit: 1e-6,
    anchor: onDie(DRAM_DIE, ...BANK_F),
    zIn: -2.55,
    zCover: -2.95,
    floor: -4.1,
    catchR: 0.0007,
    pullR: 0.002,
    title: t('Bank', 'Bank'),
    captions: [{ z: -2.55, text: t('Eine Bank ist in viele Zellenfelder (Matten) aufgeteilt. Dazwischen: Leseverstärker und Treiber.', 'A bank is divided into many cell arrays (mats). In between: sense amplifiers and drivers.') }],
    build: (ctx) =>
      buildTexLevel(ctx, {
        die: DRAM_DIE,
        cx: BANK_F[0],
        cy: BANK_F[1],
        size: 1.8,
        texW: 4096,
        scale: 1000,
        labels: [{ pos: [0, 2, 0], text: t('Zellenfeld (Matte)', 'Cell array (mat)'), size: 80e-6, zMax: -3.0, zMin: -3.9 }],
      }),
  },
  {
    id: 'ram.mat',
    parent: 'ram.bank',
    unit: 1e-6,
    anchor: [0, 0, 0],
    zIn: -3.75,
    zCover: -4.15,
    floor: -5.85,
    catchR: 50e-6,
    pullR: 150e-6,
    title: t('Zellenfeld', 'Cell array'),
    captions: [{ z: -3.75, text: t('Die feinen Linien sind Wort- und Bitleitungen. An jeder Kreuzung sitzt eine Speicherzelle.', 'The fine lines are word and bit lines. A memory cell sits at every crossing.') }],
    build: (ctx) =>
      buildTexLevel(ctx, {
        die: DRAM_DIE,
        cx: BANK_F[0],
        cy: BANK_F[1],
        size: 0.13,
        texW: 4096,
        scale: 1000,
        relief: 0.05,
        labels: [],
      }),
  },
  {
    id: 'ram.cells',
    parent: 'ram.mat',
    unit: 1e-9,
    anchor: [0, 0, 0],
    zIn: -5.35,
    zCover: -5.8,
    floor: -7.4,
    catchR: 1.2e-6,
    pullR: 4e-6,
    view: { pitch: 38, yaw: 0 },
    title: t('Kondensatoren', 'Capacitors'),
    captions: [
      { z: -5.35, text: t('Jede Säule ist ein Kondensator. Geladen (leuchtend) = 1, leer = 0. Die Ladung versickert – deshalb wird ständig aufgefrischt.', 'Each pillar is a capacitor. Charged (glowing) = 1, empty = 0. The charge leaks away – so it is refreshed constantly.') },
      { z: -6.4, text: t('Wir schneiden eine Säule auf: außen und innen Elektroden, dazwischen der Isolator. Darin: einige zehntausend Elektronen.', 'We cut one pillar open: electrodes outside and inside, the insulator in between. Inside: some ten thousand electrons.') },
    ],
    build: buildDramCells,
  },
  {
    id: 'ram.atoms',
    parent: 'ram.cells',
    unit: 1e-9,
    anchor: [-13.5, -150, 0],
    zIn: -7.15,
    zCover: -7.7,
    floor: -9.3,
    catchR: 4e-9,
    pullR: 30e-9,
    view: { pitch: 8, yaw: 0, minPitch: 0 },
    title: t('Atome', 'Atoms'),
    path: 'ram',
    captions: [
      { z: -7.15, text: t('Die Wand des Kondensators, Atom für Atom: Titannitrid, Zirkonoxid, Titannitrid.', 'The capacitor wall, atom by atom: titanium nitride, zirconium oxide, titanium nitride.') },
      { z: -8.2, text: t('Die Elektronen an der Grenzschicht sind das gespeicherte Bit. Der Isolator ist nur etwa 10 Atomlagen dick.', 'The electrons at the interface are the stored bit. The insulator is only about 10 atomic layers thick.') },
    ],
    build: buildCapAtoms,
  },

  // ───────────────────────── SSD
  {
    id: 'ssd.pkg',
    parent: 'board',
    unit: 1e-3,
    anchor: ANCHORS.ssdPkg,
    rot: [0, PI / 2, 0],
    frame: true,
    zIn: -1.45,
    zCover: -1.95,
    floor: -2.95,
    catchR: 0.012,
    pullR: 0.022,
    view: { pitch: 32, yaw: -35 },
    title: t('NAND-Gehäuse', 'NAND package'),
    path: 'ssd',
    captions: [
      { z: -1.45, text: t('Ein Flash-Speicherbaustein der SSD. Wir machen die schwarze Vergussmasse durchsichtig.', 'A flash memory package of the SSD. We make the black mould compound transparent.') },
      { z: -1.95, text: t('Darin: 8 hauchdünne Chips (je 40 µm) als Treppe gestapelt, jeder mit eigenen Golddrähten. Zusammen 2 Terabit.', 'Inside: 8 wafer-thin dies (40 µm each) stacked like stairs, each with its own gold wires. 2 terabits together.') },
    ],
    build: buildNandPkg,
  },
  {
    id: 'ssd.array',
    parent: 'ssd.pkg',
    unit: 1e-6,
    anchor: onDie(NAND_DIE, ...PLANE_F, TOP_DIE_Y),
    zIn: -2.55,
    zCover: -3.3,
    floor: -4.95,
    catchR: 0.0006,
    pullR: 0.002,
    view: { pitch: 66 },
    title: t('Speicherfeld', 'Memory array'),
    captions: [{ z: -2.55, text: t('Die vier großen Flächen des Chips sind Speicherfelder. Von oben sieht man nur die Enden von Milliarden senkrechter Kanäle.', 'The four large areas of the die are memory arrays. From above you only see the ends of billions of vertical channels.') }],
    build: (ctx) => buildTexLevel(ctx, { die: NAND_DIE, cx: PLANE_F[0], cy: PLANE_F[1], size: 1.4, texW: 4096, scale: 1000, labels: [] }),
  },
  {
    id: 'ssd.stack',
    parent: 'ssd.array',
    unit: 1e-9,
    anchor: [0, -(STACK_H / 2) * 1e-3, 0],
    zIn: -4.5,
    zCover: -7,
    floor: -7.4,
    catchR: 6e-6,
    pullR: 15e-6,
    view: { pitch: 12, yaw: 0, minPitch: 0 },
    title: t('3D-NAND', '3D NAND'),
    captions: [
      { z: -4.5, text: t('Wir schneiden das Speicherfeld auf: 232 Schichten übereinander, wie ein Hochhaus aus Speicherzellen.', 'We cut the array open: 232 layers on top of each other, like a skyscraper of memory cells.') },
      { z: -5.6, text: t('Durch alle Schichten führen senkrechte Kanallöcher (Ø 100 nm). Wo ein Kanal eine Wortleitung kreuzt, sitzt eine Speicherzelle.', 'Vertical channel holes (Ø 100 nm) run through all layers. Wherever a channel crosses a word line, there is a memory cell.') },
      { z: -6.4, text: t('Gespeichert wird mit gefangenen Elektronen im Siliziumnitrid (gelb). Sie bleiben dort jahrelang – auch ohne Strom.', 'Data is stored as electrons trapped in the silicon nitride (yellow). They stay there for years – even without power.') },
    ],
    build: buildNandStack,
  },
  {
    id: 'ssd.atoms',
    parent: 'ssd.stack',
    unit: 1e-9,
    anchor: [36.5, -32.8, 0],
    zIn: -7.15,
    zCover: -7.7,
    floor: -9.3,
    catchR: 4e-9,
    pullR: 30e-9,
    view: { pitch: 8, yaw: 0, minPitch: 0 },
    title: t('Atome', 'Atoms'),
    path: 'ssd',
    captions: [
      { z: -7.15, text: t('Eine Speicherzelle im Querschnitt: Kanal, Tunneloxid, Siliziumnitrid, Sperroxid, Wolfram.', 'One memory cell in cross-section: channel, tunnel oxide, silicon nitride, blocking oxide, tungsten.') },
      { z: -8.2, text: t('Beim Schreiben tunneln Elektronen durch das nur 2 nm dicke Oxid in das Nitrid – und sitzen dort fest.', 'When writing, electrons tunnel through the oxide, only 2 nm thick, into the nitride – and get stuck there.') },
    ],
    build: buildTrapAtoms,
  },

  // ───────────────────────── HDD
  {
    id: 'hdd.surface',
    parent: 'board',
    unit: 1e-6,
    anchor: ANCHORS.hddHead,
    rot: [0, HDD_ROT, 0],
    frame: true,
    zIn: -1.9,
    zCover: -2.4,
    floor: -4.7,
    catchR: 0.006,
    pullR: 0.02,
    view: { pitch: 16, yaw: 0, minPitch: 3 },
    title: t('Schreib-/Lesekopf', 'Read/write head'),
    path: 'hdd',
    captions: [
      { z: -1.9, text: t('Der Schreib-/Lesekopf: ein Keramikblock, kleiner als ein Sandkorn. Die Platte unter ihm rast mit 120 Umdrehungen pro Sekunde.', 'The read/write head: a ceramic block smaller than a grain of sand. The platter below it spins 120 times per second.') },
      { z: -3.0, text: t('Er fliegt auf einem Luftpolster nur 3 nm über der Platte. Ein Haar wäre für ihn ein Gebirge.', 'It flies on a cushion of air only 3 nm above the platter. A hair would be a mountain range for it.') },
    ],
    build: buildHddSurface,
  },
  {
    id: 'hdd.tracks',
    parent: 'hdd.surface',
    unit: 1e-9,
    anchor: [0, 0, 0],
    zIn: -4.3,
    zCover: -4.75,
    floor: -6.9,
    catchR: 8e-6,
    pullR: 20e-6,
    view: { pitch: 22, yaw: 0, minPitch: 2 },
    title: t('Datenspuren', 'Data tracks'),
    captions: [
      { z: -4.3, text: t('Die Daten liegen auf Spuren mit 70 nm Abstand. Jedes Bit ist ein winziger Magnet – hier in Falschfarben: ↑ rot, ↓ blau.', 'The data lies on tracks 70 nm apart. Every bit is a tiny magnet – shown here in false colour: ↑ red, ↓ blue.') },
      { z: -5.9, text: t('Der Lesesensor ist 30 nm breit und spürt, wie sich die Magnetrichtung ändert. Darüber nur 3 nm Luft.', 'The read sensor is 30 nm wide and senses the changes in magnetic direction. Only 3 nm of air above.') },
    ],
    build: buildHddTracks,
  },
  {
    id: 'hdd.grains',
    parent: 'hdd.tracks',
    unit: 1e-9,
    anchor: [0, 0, 0],
    zIn: -6.5,
    zCover: -7.0,
    floor: -8.0,
    catchR: 120e-9,
    pullR: 400e-9,
    view: { pitch: 46 },
    title: t('Magnetkörner', 'Magnetic grains'),
    captions: [{ z: -6.5, text: t('Ein Bit besteht aus 10 bis 20 Körnern, je 8 nm groß. Alle Körner eines Bits sind gleich magnetisiert.', 'A bit consists of 10 to 20 grains, each 8 nm across. All grains of a bit are magnetised the same way.') }],
    build: buildHddGrains,
  },
  {
    id: 'hdd.atoms',
    parent: 'hdd.grains',
    unit: 1e-9,
    anchor: [0, GRAIN_TOP, 0],
    zIn: -7.45,
    zCover: -7.95,
    floor: -9.3,
    catchR: 3e-9,
    pullR: 20e-9,
    view: { pitch: 40 },
    title: t('Atome', 'Atoms'),
    path: 'hdd',
    captions: [{ z: -7.45, text: t('Ein einziges Korn: Kobalt mit etwas Platin und Chrom. Jedes Atom ist ein winziger Magnet (Spin) – alle zeigen in dieselbe Richtung.', 'A single grain: cobalt with some platinum and chromium. Each atom is a tiny magnet (spin) – they all point the same way.') }],
    build: buildGrainAtoms,
  },

  // ───────────────────────── GPU
  {
    id: 'gpu.die',
    parent: 'board',
    unit: 1e-3,
    anchor: ANCHORS.gpuDie,
    rot: [PI / 2, 0, 0],
    frame: true,
    zIn: -1.45,
    zCover: -1.95,
    floor: -3.0,
    catchR: 0.018,
    pullR: 0.04,
    view: { pitch: 72, yaw: 0 },
    title: t('Grafikchip', 'GPU die'),
    path: 'gpu',
    captions: [
      { z: -1.45, text: t('Unter dem Kühler: der Grafikchip mit 12 Speicherchips rundherum. Mit 6 cm² ist er einer der größten Chips überhaupt.', 'Under the cooler: the graphics die with 12 memory chips around it. At 6 cm² it is one of the largest chips ever made.') },
      { z: -2.15, text: t('144 gleiche Rechenblöcke (Streaming-Multiprozessoren) in 12 Gruppen – in der Mitte der L2-Cache.', '144 identical compute blocks (streaming multiprocessors) in 12 groups – the L2 cache in the middle.') },
    ],
    build: (ctx) =>
      buildDieLevel(ctx, {
        die: GPU_DIE,
        thick: 0.8,
        texW: 4096,
        substrate: { w: 52, d: 52, t: 1.6, color: 0x23402f, caps: 90 },
        flip: [-1.75, -2.05],
        labels: [
          { pos: onDie(GPU_DIE, ...SM_F, 0.1), text: t('Streaming-Multiprozessor', 'Streaming multiprocessor'), size: 1.6e-3, zMax: -2.2, zMin: -2.8 },
          { pos: onDie(GPU_DIE, GPU_DIE.w / 2, GPU_DIE.h / 2, 0.1), text: t('L2-Cache', 'L2 cache'), zMax: -2.1, zMin: -2.6 },
          { pos: onDie(GPU_DIE, 1.1, 6, 0.1), text: t('Speicher-Schnittstelle', 'Memory interface'), zMax: -2.1, zMin: -2.6 },
        ],
      }),
  },
  {
    id: 'gpu.sm',
    parent: 'gpu.die',
    unit: 1e-6,
    anchor: onDie(GPU_DIE, ...SM_F),
    zIn: -2.35,
    zCover: -2.75,
    floor: -3.85,
    catchR: 0.0012,
    pullR: 0.004,
    title: t('Multiprozessor', 'Multiprocessor'),
    captions: [{ z: -2.35, text: t('Ein Streaming-Multiprozessor: vier Blöcke mit je 32 Rechenkernen, Tensor-Kernen für KI und großen Registerspeichern.', 'One streaming multiprocessor: four blocks with 32 compute cores each, tensor cores for AI and large register files.') }],
    build: (ctx) => {
      const [fx, fy] = SM_F;
      return buildTexLevel(ctx, {
        die: GPU_DIE,
        cx: fx,
        cy: fy,
        size: 4.0,
        texW: 3072,
        scale: 1000,
        labels: [
          blockLabel(GPU_DIE, 'sm2t4:rf', fx, fy, 'Registerspeicher (SRAM)', 'Register file (SRAM)', -2.5, -3.3),
          blockLabel(GPU_DIE, 'sm2t4:alu', fx, fy, 'Rechenkerne', 'CUDA cores', -2.5, -3.3),
          blockLabel(GPU_DIE, 'sm2t4:tensor', fx, fy, 'Tensor-Kerne', 'Tensor cores', -2.55, -3.3),
          blockLabel(GPU_DIE, 'sm2t4:l1', fx, fy, 'L1-Cache / Shared Memory', 'L1 cache / shared memory', -2.5, -3.3),
        ],
      });
    },
  },
  {
    id: 'gpu.metal',
    parent: 'gpu.sm',
    unit: 1e-6,
    anchor: [0, 0, 0],
    zIn: -3.35,
    zCover: -3.75,
    floor: -5.95,
    catchR: 300e-6,
    pullR: 900e-6,
    view: { pitch: 52 },
    title: t('Leiterbahnen', 'Interconnect'),
    captions: [{ z: -3.35, text: t('Auch hier: ein Gebirge aus Kupferleitungen über den Transistoren, oben dick, unten hauchdünn.', 'Here too: a mountain range of copper wires above the transistors, thick on top, wafer-thin at the bottom.') }],
    build: (ctx) => buildMetal(ctx, 23),
  },
  {
    id: 'gpu.sram',
    parent: 'gpu.metal',
    unit: 1e-9,
    anchor: [0, METAL_BOTTOM - 0.16, 0],
    zIn: -5.5,
    zCover: -5.95,
    floor: -7.6,
    catchR: 1.2e-6,
    pullR: 3e-6,
    view: { pitch: 48, yaw: -20 },
    title: t('SRAM-Zelle', 'SRAM cell'),
    captions: [{ z: -5.5, text: t('Der Registerspeicher besteht aus SRAM-Zellen: 6 Transistoren halten ein Bit fest, solange Strom fließt. Leuchtend grün = gespeicherte 1.', 'The register file consists of SRAM cells: 6 transistors hold one bit as long as power is on. Glowing green = stored 1.') }],
    build: (ctx) => buildFinfet(ctx, 'sram', 17),
  },
  {
    id: 'gpu.atoms',
    parent: 'gpu.sram',
    unit: 1e-9,
    anchor: [0, 0, 0],
    zIn: -7.3,
    zCover: -7.85,
    floor: -9.35,
    catchR: 4e-9,
    pullR: 25e-9,
    view: { pitch: 34, yaw: 28, minPitch: 4 },
    title: t('Atome', 'Atoms'),
    path: 'gpu',
    captions: [{ z: -7.3, text: t('Auch der Grafikchip besteht am Ende aus Silizium-Atomen – mit 76 Milliarden Transistoren.', 'In the end the graphics chip is made of silicon atoms too – with 76 billion transistors.') }],
    build: buildFinAtoms,
  },

  // ───────────────────────── freie Platine
  {
    id: 'board.pcb',
    parent: 'board',
    unit: 1e-3,
    anchor: [0, 0.004, 0],
    zIn: -1.75,
    zCover: -2.8,
    floor: -3.05,
    catchR: 0.01,
    pullR: 0.01,
    shareDepth: true,
    title: t('Leiterplatte', 'Circuit board'),
    dynamic: (p) => (isBare(p[0], p[2]) ? [p[0], 0.004, p[2]] : null),
    captions: [{ z: -1.75, text: t('Unter dem schwarzen Lötstopplack liegen Leiterbahnen aus Kupfer. Eine Platine hat 6–12 solcher Lagen übereinander.', 'Copper traces lie under the black solder mask. A board has 6–12 such layers stacked on top of each other.') }],
    build: (ctx: BuildCtx) => {
      pcbAnchor = ctx.anchor;
      return buildPcbPatch(ctx, 24, 1, 0, 0, false);
    },
  },
  {
    id: 'board.weave',
    parent: 'board.pcb',
    unit: 1e-6,
    anchor: [0, 0.002, 0],
    zIn: -2.75,
    zCover: -3.15,
    floor: -4.3,
    catchR: 0.0008,
    pullR: 0.0008,
    shareDepth: true,
    title: t('Glasfasergewebe', 'Glass-fibre weave'),
    captions: [{ z: -2.75, text: t('Die Platine selbst ist aus Glasfasergewebe und Epoxidharz (FR-4). Jede Faser ist 7 µm dick.', 'The board itself is made of glass-fibre fabric and epoxy (FR-4). Each fibre is 7 µm thick.') }],
    build: (ctx: BuildCtx) => buildPcbPatch({ ...ctx, anchor: pcbAnchor }, 2.4, 1000, 2, 0, true),
  },
];

export const PATHS: { id: string; leaf: string; label: { de: string; en: string } }[] = [
  { id: 'cpu', leaf: 'cpu.atoms', label: t('CPU', 'CPU') },
  { id: 'ram', leaf: 'ram.atoms', label: t('RAM', 'RAM') },
  { id: 'ssd', leaf: 'ssd.atoms', label: t('SSD', 'SSD') },
  { id: 'hdd', leaf: 'hdd.atoms', label: t('HDD', 'HDD') },
  { id: 'gpu', leaf: 'gpu.atoms', label: t('GPU', 'GPU') },
];

void THREE;
