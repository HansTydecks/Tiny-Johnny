/**
 * Datenfluss für die Anzeige.
 *
 * Die Engine rechnet einen Makroschritt in einem Rutsch. Damit man trotzdem sieht, *wie* die Zahlen
 * durch Johnny wandern, spielt die Oberfläche die Mikrobefehle danach einzeln ab: Jeder Mikrobefehl
 * schickt ein „Paket“ über seine Leitung, erst bei der Ankunft ändert sich das Ziel-Register.
 *
 * Hier stehen nur reine Funktionen – die Engine bleibt unverändert.
 */
import { opcodeOf, type JohnnyState, type MicroEvent } from './engine';
import { formatAddr, formatValue, pad } from './assembler';

/** Leitungen im Schaltbild. Die meisten heißen wie der Mikrobefehl, der sie benutzt. */
export type WireId =
  | 'ab->ram'
  | 'ram->db'
  | 'db->ram'
  | 'db->acc'
  | 'acc->db'
  | 'db->ins'
  | 'ins->ab'
  | 'ins->mc'
  | 'ins->pc'
  | 'pc->ab'
  | 'flag';

export const WIRE_IDS: WireId[] = ['ab->ram', 'ram->db', 'db->ram', 'db->acc', 'acc->db', 'db->ins', 'ins->ab', 'ins->mc', 'ins->pc', 'pc->ab', 'flag'];

/** Über welche Leitung ein Mikrobefehl Daten schickt (null = wirkt nur im Register selbst). */
export const WIRE_OF: Record<string, WireId | null> = {
  'ram->db': 'ram->db',
  'db->ram': 'db->ram',
  'db->acc': 'db->acc',
  plus: 'db->acc',
  minus: 'db->acc',
  'acc->db': 'acc->db',
  'db->ins': 'db->ins',
  'ins->ab': 'ins->ab',
  'ins->mc': 'ins->mc',
  'ins->pc': 'ins->pc',
  'pc->ab': 'pc->ab',
  '=0:pc++': 'flag',
  'acc:=0': null,
  'acc++': null,
  'acc--': null,
  'pc++': null,
  'mc:=0': null,
  stopp: null,
};

/** Bauteile und Leitungen, die eine Tutorial-Mission im Schaltbild hervorheben kann (`fokus:`). */
export const FOCUS_IDS = ['ram', 'ab', 'db', 'acc', 'ins', 'pc', 'mc', 'microcode', 'alu', 'cu', ...WIRE_IDS] as const;
export type FocusId = (typeof FOCUS_IDS)[number];

/** Welche sichtbaren Bauteile eine Hervorhebung voraussetzt */
export const FOCUS_NEEDS: Record<FocusId, string[]> = {
  ram: ['ram'],
  ab: ['ab'],
  db: ['db'],
  acc: ['acc'],
  ins: ['ins'],
  pc: ['ins', 'pc'],
  mc: ['ins', 'mc'],
  microcode: ['ins', 'mc', 'microcode'],
  alu: ['acc'],
  cu: ['ins'],
  'ab->ram': ['ram', 'ab'],
  'ram->db': ['ram', 'db'],
  'db->ram': ['ram', 'db'],
  'db->acc': ['acc', 'db'],
  'acc->db': ['acc', 'db'],
  'db->ins': ['ins', 'db'],
  'ins->ab': ['ins', 'ab'],
  'ins->mc': ['ins', 'mc'],
  'ins->pc': ['ins', 'pc'],
  'pc->ab': ['ins', 'pc', 'ab'],
  flag: ['ins', 'pc', 'acc'],
};

/** Eine Zahl so kurz wie möglich: 42 bleibt 42, Befehle erscheinen als 01.010. */
export function shortValue(v: number): string {
  return opcodeOf(v) === 0 ? String(v) : formatValue(v);
}

/** Was auf dem Paket steht, das über die Leitung wandert. `s` ist der Zustand *vor* dem Mikrobefehl. */
export function tokenLabel(e: MicroEvent, s: Pick<JohnnyState, 'db' | 'acc' | 'ins'>): string {
  switch (e.key) {
    case 'ram->db':
    case 'db->ram':
    case 'db->acc':
    case 'acc->db':
      return shortValue(e.after);
    case 'db->ins':
      return formatValue(e.after);
    case 'plus':
      return `+${shortValue(s.db)}`;
    case 'minus':
      return `−${shortValue(s.db)}`;
    case 'ins->ab':
    case 'ins->pc':
    case 'pc->ab':
      return formatAddr(e.after);
    case 'ins->mc':
      return pad(opcodeOf(s.ins), 2);
    case '=0:pc++':
      return s.acc === 0 ? '= 0' : '≠ 0';
    default:
      return '';
  }
}

/** Kurze Wirkung, die am Ziel-Register aufblinkt (auch für Mikrobefehle ohne Leitung). */
export function effectLabel(e: MicroEvent): string {
  switch (e.key) {
    case 'acc++':
    case 'pc++':
      return e.after === e.before ? '+1 (Grenze)' : '+1';
    case 'acc--':
      return e.after === e.before ? '−1 (Grenze)' : '−1';
    case 'acc:=0':
    case 'mc:=0':
      return ':= 0';
    case '=0:pc++':
      return e.after !== e.before ? '+1' : 'bleibt';
    case 'plus':
      return e.clamped ? '+ (Grenze)' : '+';
    case 'minus':
      return e.clamped ? '− (auf 0)' : '−';
    case 'ins->mc':
      return '× 10';
    case 'stopp':
      return 'stopp';
    default:
      return '';
  }
}

/**
 * Zustand vor dem Mikrobefehl Nummer `k` einer Folge.
 * Ausgehend vom Endzustand werden die Mikrobefehle k … n−1 rückwärts zurückgenommen –
 * jedes Ereignis kennt den Wert seines Ziels vorher.
 */
export function stateBefore(final: JohnnyState, events: readonly MicroEvent[], k: number): JohnnyState {
  if (k >= events.length) return final;
  const s: JohnnyState = { ...final };
  let ramCopied = false;
  for (let i = events.length - 1; i >= Math.max(0, k); i--) {
    const e = events[i];
    switch (e.target) {
      case 'ram':
        if (!ramCopied) {
          s.ram = final.ram.slice();
          ramCopied = true;
        }
        if (e.addr !== undefined) s.ram[e.addr] = e.before;
        break;
      case 'halt':
        s.halted = false;
        break;
      default:
        s[e.target] = e.before;
    }
  }
  // Der Mikroprogrammzähler zählt beim Mikroschritt ohne eigenes Ereignis weiter – die Adresse steht im Ereignis
  const at = events[Math.max(0, k)].at;
  if (at !== undefined) s.mc = at;
  return s;
}

/** Kompakte Signatur von Registern und Speicher, um Änderungen außerhalb der Wiedergabe zu erkennen. */
export function signature(s: JohnnyState): string {
  let sum = 0;
  for (let i = 0; i < s.ram.length; i++) sum = (sum * 31 + s.ram[i] * (i + 1)) % 2147483647;
  return [s.ab, s.db, s.acc, s.ins, s.pc, s.mc, s.halted ? 1 : 0, sum, s.mode].join(',');
}

/**
 * Wie lange ein einzelnes Paket unterwegs ist (ms) – oder 0, wenn nicht animiert wird.
 * `runSpeed` ist die Zeit pro Makroschritt beim Ausführen (sonst undefined).
 */
export function stepDuration(count: number, runSpeed?: number): number {
  if (count <= 0) return 0;
  if (runSpeed !== undefined) {
    const step = (runSpeed * 0.85) / count;
    return step >= 80 ? Math.min(step, 260) : 0;
  }
  if (count === 1) return 460;
  return Math.max(150, Math.min(240, 2600 / count));
}
