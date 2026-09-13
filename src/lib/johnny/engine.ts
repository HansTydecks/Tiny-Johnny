/**
 * Johnny – reine Rechnerlogik ohne Oberfläche.
 *
 * Verhalten 1:1 wie Johnny 2.0:
 * - 1000 Speicherzellen (000–999), Werte 0–19999
 * - Akkumulator sättigt bei 0 bzw. 19999
 * - Mikrobefehle erhöhen den Mikroprogrammzähler nur beim automatischen Mikroschritt,
 *   nicht beim Klick auf einen Mikrobefehl (außer ins→mc / mc:=0, die ihn direkt setzen)
 */
import { MICROCODE_SIZE, MICRO_BY_CODE, MICRO_BY_KEY, SLOTS, microprogramFor, type Mode } from './microcode';

export const RAM_SIZE = 1000;
export const MAX_VALUE = 19999;
export const MAX_ADDR = RAM_SIZE - 1;

export interface JohnnyState {
  ram: number[];
  ab: number;
  db: number;
  acc: number;
  ins: number;
  pc: number;
  mc: number;
  halted: boolean;
  microcode: number[];
  names: string[];
  mode: Mode;
}

export type Register = 'ram' | 'ab' | 'db' | 'acc' | 'ins' | 'pc' | 'mc' | 'halt';

export interface MicroEvent {
  code: number;
  key: string;
  /** Welches Bauteil wurde verändert */
  target: Register;
  /** Aus welchem Bauteil kam der Wert */
  source?: Register;
  before: number;
  after: number;
  /** Beteiligte Speicheradresse (bei ram→db, db→ram) */
  addr?: number;
  /** true, wenn die Operation wegen einer Grenze nichts/abgeschnitten verändert hat */
  clamped?: boolean;
}

export type StopReason = 'halt' | 'stuck' | 'error' | 'limit';

export interface JohnnyError {
  kind: 'no-microcode' | 'microcode-overflow' | 'invalid-micro';
  message: string;
}

export function clampValue(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(MAX_VALUE, Math.trunc(v)));
}
export function clampAddr(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(MAX_ADDR, Math.trunc(v)));
}
export const opcodeOf = (v: number) => Math.floor(v / 1000);
export const addrOf = (v: number) => v % 1000;

export interface Recording {
  slot: number;
  pos: number;
}

type Listener = (e: MicroEvent) => void;

export class Johnny {
  ram: number[] = new Array(RAM_SIZE).fill(0);
  ab = 0;
  db = 0;
  acc = 0;
  ins = 0;
  pc = 0;
  mc = 0;
  halted = false;
  mode: Mode = 'normal';
  microcode: number[];
  names: string[];

  /** Gezählte Takte (Mikroschritte + manuelle Mikrobefehle) seit dem letzten Reset */
  ticks = 0;
  /** Ausgeführte Makrobefehle seit dem letzten Reset */
  macroCount = 0;
  lastError: JohnnyError | null = null;
  recording: Recording | null = null;
  /** Alle seit dem letzten Reset benutzten Mikrobefehle (Schlüssel) */
  used = new Set<string>();

  private listeners = new Set<Listener>();

  constructor(opts: { mode?: Mode; ram?: ArrayLike<number> } = {}) {
    const mp = microprogramFor(opts.mode ?? 'normal');
    this.mode = opts.mode ?? 'normal';
    this.microcode = mp.microcode;
    this.names = mp.names;
    if (opts.ram) this.loadRam(opts.ram);
  }

  onMicro(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  snapshot(): JohnnyState {
    return {
      ram: this.ram.slice(),
      ab: this.ab,
      db: this.db,
      acc: this.acc,
      ins: this.ins,
      pc: this.pc,
      mc: this.mc,
      halted: this.halted,
      microcode: this.microcode.slice(),
      names: this.names.slice(),
      mode: this.mode,
    };
  }

  // ------------------------------------------------------------------ Eingaben von Hand

  setAb(v: number) {
    this.ab = clampAddr(v);
  }
  setDb(v: number) {
    this.db = clampValue(v);
  }
  writeRam(addr: number, v: number) {
    this.ram[clampAddr(addr)] = clampValue(v);
  }
  loadRam(values: ArrayLike<number>) {
    for (let i = 0; i < RAM_SIZE; i++) this.ram[i] = clampValue(Number(values[i] ?? 0));
  }
  clearRam() {
    this.ram.fill(0);
  }

  /** Setzt alle Register zurück (wie „Reset“ im Original). Speicher und Mikrocode bleiben erhalten. */
  reset() {
    this.ab = 0;
    this.db = 0;
    this.ins = 0;
    this.mc = 0;
    this.acc = 0;
    this.pc = 0;
    this.halted = false;
    this.ticks = 0;
    this.macroCount = 0;
    this.lastError = null;
    this.used.clear();
  }

  setMode(mode: Mode) {
    const mp = microprogramFor(mode);
    this.mode = mode;
    this.microcode = mp.microcode;
    this.names = mp.names;
    this.recording = null;
    this.mc = 0;
  }

  loadMicroprogram(microcode: ArrayLike<number>, names: ArrayLike<string>) {
    this.microcode = new Array(MICROCODE_SIZE).fill(0).map((_, i) => {
      const n = Number(microcode[i] ?? 0);
      return MICRO_BY_CODE[n] ? n : 0;
    });
    this.names = new Array(SLOTS).fill('').map((_, i) => String(names[i] ?? '').trim());
    this.recording = null;
    this.mc = 0;
  }

  // ------------------------------------------------------------------ Mikrobefehle

  /**
   * Führt einen Mikrobefehl direkt aus (wie ein Klick auf den Knopf im Original).
   * Der Mikroprogrammzähler wird dabei NICHT weitergezählt.
   */
  exec(codeOrKey: number | string): MicroEvent {
    const info = typeof codeOrKey === 'string' ? MICRO_BY_KEY[codeOrKey] : MICRO_BY_CODE[codeOrKey];
    if (!info) throw new Error(`Unbekannter Mikrobefehl: ${codeOrKey}`);
    let e: MicroEvent;
    switch (info.code) {
      case 1: {
        const before = this.ram[this.ab];
        this.ram[this.ab] = this.db;
        e = { code: 1, key: info.key, target: 'ram', source: 'db', before, after: this.db, addr: this.ab };
        break;
      }
      case 2: {
        const before = this.db;
        this.db = this.ram[this.ab];
        e = { code: 2, key: info.key, target: 'db', source: 'ram', before, after: this.db, addr: this.ab };
        break;
      }
      case 3: {
        const before = this.ins;
        this.ins = this.db;
        e = { code: 3, key: info.key, target: 'ins', source: 'db', before, after: this.ins };
        break;
      }
      case 4: {
        const before = this.ab;
        this.ab = addrOf(this.ins);
        e = { code: 4, key: info.key, target: 'ab', source: 'ins', before, after: this.ab };
        break;
      }
      case 5: {
        const before = this.mc;
        this.mc = opcodeOf(this.ins) * 10;
        e = { code: 5, key: info.key, target: 'mc', source: 'ins', before, after: this.mc };
        break;
      }
      case 7: {
        const before = this.mc;
        this.mc = 0;
        e = { code: 7, key: info.key, target: 'mc', before, after: 0 };
        break;
      }
      case 8: {
        const before = this.ab;
        this.ab = this.pc;
        e = { code: 8, key: info.key, target: 'ab', source: 'pc', before, after: this.ab };
        break;
      }
      case 9: {
        const before = this.pc;
        if (this.pc < MAX_ADDR) this.pc++;
        e = { code: 9, key: info.key, target: 'pc', before, after: this.pc, clamped: before === this.pc };
        break;
      }
      case 10: {
        const before = this.pc;
        if (this.pc < MAX_ADDR && this.acc === 0) this.pc++;
        e = { code: 10, key: info.key, target: 'pc', source: 'acc', before, after: this.pc };
        break;
      }
      case 11: {
        const before = this.pc;
        this.pc = addrOf(this.ins);
        e = { code: 11, key: info.key, target: 'pc', source: 'ins', before, after: this.pc };
        break;
      }
      case 12: {
        const before = this.acc;
        this.acc = 0;
        e = { code: 12, key: info.key, target: 'acc', before, after: 0 };
        break;
      }
      case 13: {
        const before = this.acc;
        const sum = this.acc + this.db;
        this.acc = sum < MAX_VALUE + 1 ? sum : MAX_VALUE;
        e = { code: 13, key: info.key, target: 'acc', source: 'db', before, after: this.acc, clamped: sum > MAX_VALUE };
        break;
      }
      case 14: {
        const before = this.acc;
        const diff = this.acc - this.db;
        this.acc = diff >= 0 ? diff : 0;
        e = { code: 14, key: info.key, target: 'acc', source: 'db', before, after: this.acc, clamped: diff < 0 };
        break;
      }
      case 15: {
        const before = this.db;
        this.db = this.acc;
        e = { code: 15, key: info.key, target: 'db', source: 'acc', before, after: this.db };
        break;
      }
      case 16: {
        const before = this.acc;
        if (this.acc < MAX_VALUE) this.acc++;
        e = { code: 16, key: info.key, target: 'acc', before, after: this.acc, clamped: before === this.acc };
        break;
      }
      case 17: {
        const before = this.acc;
        if (this.acc > 0) this.acc--;
        e = { code: 17, key: info.key, target: 'acc', before, after: this.acc, clamped: before === this.acc };
        break;
      }
      case 18: {
        const before = this.acc;
        this.acc = this.db;
        e = { code: 18, key: info.key, target: 'acc', source: 'db', before, after: this.acc };
        break;
      }
      case 19: {
        this.halted = true;
        e = { code: 19, key: info.key, target: 'halt', before: 0, after: 1 };
        break;
      }
      default:
        throw new Error(`Unbekannter Mikrobefehl: ${codeOrKey}`);
    }
    this.ticks++;
    this.used.add(info.key);
    this.record(info.code);
    for (const fn of this.listeners) fn(e);
    return e;
  }

  /** Führt den Mikrobefehl aus, auf den der Mikroprogrammzähler zeigt (Mikroschritt). */
  microStep(): MicroEvent | null {
    this.lastError = null;
    if (this.mc >= MICROCODE_SIZE) {
      return this.fail('microcode-overflow', `Der Mikroprogrammzähler steht bei ${this.mc}. Dort gibt es keinen Mikrocode mehr. Johnny hält an.`);
    }
    const code = this.microcode[this.mc];
    if (!MICRO_BY_CODE[code]) {
      const slot = Math.floor(this.mc / 10);
      const msg =
        this.mc % 10 === 0
          ? `Für Befehl ${String(slot).padStart(2, '0')} gibt es kein Mikroprogramm (Mikrocode-Adresse ${String(this.mc).padStart(3, '0')} ist leer). Johnny weiß nicht, was er tun soll, und hält an.`
          : `In Mikrocode-Adresse ${String(this.mc).padStart(3, '0')} steht kein Mikrobefehl. Fehlt am Ende des Mikroprogramms „mc:=0“? Johnny hält an.`;
      return this.fail('no-microcode', msg);
    }
    const e = this.exec(code);
    if (code !== 5 && code !== 7) this.mc++;
    return e;
  }

  private fail(kind: JohnnyError['kind'], message: string): null {
    this.lastError = { kind, message };
    this.halted = true;
    this.mc = 0;
    return null;
  }

  /**
   * Führt Mikroschritte aus, bis der Mikroprogrammzähler wieder 0 ist (Makroschritt).
   * Beginnt mitten in einem Befehl, wird dieser zu Ende geführt.
   */
  macroStep(): MicroEvent[] {
    const events: MicroEvent[] = [];
    let guard = 0;
    do {
      const e = this.microStep();
      if (!e) break;
      events.push(e);
      guard++;
    } while (this.mc !== 0 && guard < MICROCODE_SIZE * 2);
    // Ein Makroschritt besteht aus FETCH + Ausführung. Gezählt wird der ausgeführte Befehl.
    if (this.mc === 0 && !this.lastError) this.macroCount++;
    return events;
  }

  /**
   * Führt einen Programmschritt im „Ausführen“-Modus aus und sagt, ob danach angehalten wird.
   * Wie im Original endet das Ausführen bei HLT oder wenn sich der Programmzähler nicht mehr ändert
   * (z. B. JMP auf sich selbst oder ein Befehl 00).
   */
  runStep(): StopReason | null {
    const before = this.pc;
    this.halted = false;
    this.macroStep();
    if (this.lastError) return 'error';
    if (this.halted) return 'halt';
    if (this.pc === before) return 'stuck';
    return null;
  }

  /** Läuft ohne Pause, bis angehalten wird oder das Limit erreicht ist (für Prüfungen). */
  run(maxMacroSteps = 10000): StopReason {
    for (let i = 0; i < maxMacroSteps; i++) {
      const r = this.runStep();
      if (r) return r;
    }
    return 'limit';
  }

  // ------------------------------------------------------------------ Mikrocode-Aufnahme

  /** Startet die Aufnahme eines eigenen Makrobefehls in Platz `slot` (1–19). */
  startRecording(slot: number, name: string) {
    if (slot < 1 || slot >= SLOTS) throw new Error('Platz muss zwischen 1 und 19 liegen');
    for (let i = slot * 10; i < slot * 10 + 10; i++) this.microcode[i] = 0;
    this.names[slot] = name.trim().toUpperCase();
    this.recording = { slot, pos: 0 };
  }
  stopRecording() {
    this.recording = null;
  }
  private record(code: number) {
    if (!this.recording) return;
    if (this.recording.pos >= 10) return;
    this.microcode[this.recording.slot * 10 + this.recording.pos] = code;
    this.recording.pos++;
  }
}
