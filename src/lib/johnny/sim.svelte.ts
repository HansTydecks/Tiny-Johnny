/**
 * Reaktive Hülle um die Johnny-Engine für die Oberfläche (Svelte 5 Runes).
 */
import { Johnny, addrOf, opcodeOf, type JohnnyState, type MicroEvent, type StopReason } from './engine';
import { disassembleValue, formatAddr, formatPlain, formatValue } from './assembler';
import type { Mode } from './microcode';

export type Part = 'ram' | 'ab' | 'db' | 'acc' | 'ins' | 'pc' | 'mc' | 'microcode' | 'log';
export type Feature =
  | 'ramEdit'
  | 'asm'
  | 'abInput'
  | 'dbInput'
  | 'microStep'
  | 'macroStep'
  | 'run'
  | 'reset'
  | 'clearRam'
  | 'files'
  | 'controlToggle'
  | 'bonsai'
  | 'record';

export const ALL_PARTS: Part[] = ['ram', 'ab', 'db', 'acc', 'ins', 'pc', 'mc', 'microcode', 'log'];
export const ALL_FEATURES: Feature[] = [
  'ramEdit',
  'asm',
  'abInput',
  'dbInput',
  'microStep',
  'macroStep',
  'run',
  'reset',
  'clearRam',
  'files',
  'controlToggle',
  'bonsai',
  'record',
];

/** Beispielprogramm für die Sandbox (Speicher als Teilen-Code) */
export interface Example {
  titel: string;
  beschreibung: string;
  modus: Mode;
  code: string;
}

export interface LogEntry {
  id: number;
  kind: 'micro' | 'macro' | 'info' | 'stop' | 'error';
  key?: string;
  text: string;
}

export interface StopInfo {
  reason: StopReason;
  message: string;
}

let logId = 0;

export class Sim {
  engine: Johnny;
  s: JohnnyState = $state.raw(null as unknown as JohnnyState);
  events: MicroEvent[] = $state.raw([]);
  pulse = $state(0);
  log: LogEntry[] = $state.raw([]);
  running = $state(false);
  speed = $state(650);
  turbo = $state(false);
  stop: StopInfo | null = $state(null);
  selected = $state(0);
  controlUnit = $state(true);
  recording: { slot: number; pos: number } | null = $state(null);
  ticks = $state(0);
  macros = $state(0);
  version = $state(0);
  /** Benutzte Mikrobefehle seit `markUsed()` – für Missionsziele */
  usedSince: Set<string> = new Set();

  private pending: MicroEvent[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private raf = 0;
  private changeListeners = new Set<() => void>();

  constructor(opts: { mode?: Mode; ram?: ArrayLike<number> } = {}) {
    this.engine = new Johnny(opts);
    this.engine.onMicro((e) => {
      this.pending.push(e);
      this.usedSince.add(e.key);
    });
    this.sync();
  }

  onChange(fn: () => void) {
    this.changeListeners.add(fn);
    return () => this.changeListeners.delete(fn);
  }

  sync(logEvents = true) {
    const evs = this.pending;
    this.pending = [];
    if (evs.length) {
      this.events = evs;
      this.pulse++;
      if (logEvents) this.addLog(evs.map((e) => ({ kind: 'micro' as const, key: e.key, text: describe(e, this.engine) })));
    }
    this.s = this.engine.snapshot();
    this.ticks = this.engine.ticks;
    this.macros = this.engine.macroCount;
    this.recording = this.engine.recording ? { ...this.engine.recording } : null;
    this.version++;
    for (const fn of this.changeListeners) fn();
  }

  private addLog(entries: Omit<LogEntry, 'id'>[]) {
    if (!entries.length) return;
    const next = [...this.log, ...entries.map((e) => ({ ...e, id: ++logId }))];
    this.log = next.length > 150 ? next.slice(next.length - 150) : next;
  }

  info(text: string, kind: LogEntry['kind'] = 'info') {
    this.addLog([{ kind, text }]);
  }

  // ------------------------------------------------------------ Bedienung

  exec(key: string) {
    this.pause();
    this.stop = null;
    this.engine.exec(key);
    if (key === 'stopp') this.stop = { reason: 'halt', message: 'Johnny hält an (stopp).' };
    this.sync();
  }

  microStep() {
    this.pause();
    this.stop = null;
    this.engine.microStep();
    this.sync();
    if (this.engine.lastError) this.setStop('error');
    else if (this.engine.halted && this.events.some((e) => e.code === 19)) this.setStop('halt');
  }

  macroStep() {
    this.pause();
    this.stop = null;
    const startPc = this.engine.pc;
    const fromStart = this.engine.mc === 0;
    this.engine.halted = false;
    this.engine.macroStep();
    this.sync();
    if (fromStart && !this.engine.lastError) this.info(`Befehl aus Zelle ${formatAddr(startPc)} ausgeführt: ${this.commandText(this.engine.ins)}`, 'macro');
    if (this.engine.lastError) this.setStop('error');
    else if (this.engine.halted) this.setStop('halt');
  }

  toggleRun() {
    if (this.running) this.pause();
    else this.start();
  }

  start() {
    if (this.running) return;
    this.stop = null;
    this.running = true;
    this.info('▶ Programm läuft …');
    this.tick();
  }

  pause() {
    if (!this.running) return;
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    if (this.raf) cancelAnimationFrame(this.raf);
    this.timer = null;
    this.raf = 0;
    this.sync(false);
    this.info('❚❚ Angehalten.');
  }

  private tick = () => {
    if (!this.running) return;
    if (this.turbo) {
      const t0 = performance.now();
      let r: StopReason | null = null;
      do {
        r = this.engine.runStep();
      } while (!r && performance.now() - t0 < 14);
      this.pending = this.pending.slice(-12);
      this.sync(false);
      if (r) return this.finish(r);
      this.raf = requestAnimationFrame(this.tick);
    } else {
      const startPc = this.engine.pc;
      const r = this.engine.runStep();
      this.sync();
      if (r !== 'error') this.info(`Befehl aus Zelle ${formatAddr(startPc)}: ${this.commandText(this.engine.ins)}`, 'macro');
      if (r) return this.finish(r);
      this.timer = setTimeout(this.tick, this.speed);
    }
  };

  private finish(r: StopReason) {
    this.running = false;
    this.timer = null;
    this.raf = 0;
    this.setStop(r);
  }

  private setStop(reason: StopReason) {
    const e = this.engine;
    let message = '';
    if (reason === 'halt') message = 'Programm beendet: Johnny hat den Befehl HLT erreicht.';
    else if (reason === 'error') message = e.lastError?.message ?? 'Fehler';
    else if (reason === 'stuck') {
      const cell = e.ram[e.pc];
      const why =
        opcodeOf(cell) === 0
          ? `In Zelle ${formatAddr(e.pc)} steht kein Befehl (Opcode 00). Johnny holt sie immer wieder.`
          : opcodeOf(e.ins) === e.names.indexOf('JMP') && addrOf(e.ins) === e.pc
            ? `Der Befehl springt auf sich selbst (${this.commandText(e.ins)}).`
            : `Der Programmzähler ändert sich nicht mehr.`;
      message = `Johnny hält an: ${why}`;
    } else message = 'Abbruch: zu viele Schritte.';
    this.stop = { reason, message };
    this.info(message, reason === 'error' ? 'error' : 'stop');
    this.sync(false);
  }

  reset() {
    this.pause();
    this.engine.reset();
    this.usedSince.clear();
    this.stop = null;
    this.log = [];
    this.selected = 0;
    this.sync(false);
  }

  clearRam() {
    this.pause();
    this.engine.clearRam();
    this.sync(false);
  }

  writeRam(addr: number, v: number) {
    this.engine.writeRam(addr, v);
    this.sync(false);
  }

  setAb(v: number) {
    this.engine.setAb(v);
    this.info(`Adressbus von Hand gesetzt: ${formatAddr(this.engine.ab)}`);
    this.sync(false);
  }

  setDb(v: number) {
    this.engine.setDb(v);
    this.info(`Datenbus von Hand gesetzt: ${formatPlain(this.engine.db)}`);
    this.sync(false);
  }

  loadRam(ram: ArrayLike<number>) {
    this.pause();
    this.engine.loadRam(ram);
    this.sync(false);
  }

  setRegisters(r: Partial<Record<'acc' | 'ab' | 'db' | 'ins' | 'pc' | 'mc', number>>) {
    const e = this.engine;
    if (r.acc !== undefined) e.acc = r.acc;
    if (r.ab !== undefined) e.ab = r.ab;
    if (r.db !== undefined) e.db = r.db;
    if (r.ins !== undefined) e.ins = r.ins;
    if (r.pc !== undefined) e.pc = r.pc;
    if (r.mc !== undefined) e.mc = r.mc;
    this.sync(false);
  }

  setMode(mode: Mode) {
    this.pause();
    this.engine.setMode(mode);
    this.info(mode === 'bonsai' ? 'Bonsai-Modus: nur INC, DEC, JMP, TST, HLT.' : 'Normaler Befehlssatz geladen.');
    this.sync(false);
  }

  loadMicroprogram(microcode: number[], names: string[]) {
    this.pause();
    this.engine.loadMicroprogram(microcode, names);
    this.sync(false);
  }

  startRecording(slot: number, name: string) {
    this.pause();
    this.engine.startRecording(slot, name);
    this.info(`● Aufnahme für Befehl ${String(slot).padStart(2, '0')} „${name.toUpperCase()}“ gestartet. Klicke jetzt die Mikrobefehle an.`);
    this.sync(false);
  }

  stopRecording() {
    this.engine.stopRecording();
    this.info('■ Aufnahme beendet.');
    this.sync(false);
  }

  select(addr: number) {
    this.selected = Math.max(0, Math.min(999, addr));
  }

  markUsed() {
    this.usedSince = new Set();
  }

  commandText(v: number): string {
    const d = disassembleValue(v, this.engine.names);
    return d ? `${d.mnemonic} ${formatAddr(d.operand)}` : formatValue(v);
  }

  destroy() {
    this.pause();
    this.changeListeners.clear();
  }
}

export function describe(e: MicroEvent, j: Johnny): string {
  const A = formatAddr;
  const V = formatPlain;
  switch (e.key) {
    case 'ram->db':
      return `Zelle ${A(e.addr!)} wird gelesen → Datenbus: ${V(e.after)}`;
    case 'db->ram':
      return `Datenbus ${V(e.after)} → Zelle ${A(e.addr!)} (vorher ${V(e.before)})`;
    case 'db->acc':
      return `Datenbus → Akkumulator: ${V(e.after)}`;
    case 'acc->db':
      return `Akkumulator → Datenbus: ${V(e.after)}`;
    case 'plus':
      return `Rechenwerk: ${V(e.before)} + ${V(j.db)} = ${V(e.after)}${e.clamped ? ' (Obergrenze 19999 erreicht)' : ''}`;
    case 'minus':
      return `Rechenwerk: ${V(e.before)} − ${V(j.db)} = ${V(e.after)}${e.clamped ? ' (Johnny kennt keine negativen Zahlen → 0)' : ''}`;
    case 'acc:=0':
      return 'Akkumulator := 0';
    case 'acc++':
      return `Akkumulator ${V(e.before)} → ${V(e.after)}${e.clamped ? ' (Obergrenze)' : ''}`;
    case 'acc--':
      return `Akkumulator ${V(e.before)} → ${V(e.after)}${e.clamped ? ' (nicht unter 0)' : ''}`;
    case 'db->ins': {
      const d = disassembleValue(e.after, j.names);
      return `Datenbus → Befehlsregister: ${formatValue(e.after)}${d ? ` = ${d.mnemonic} ${A(d.operand)}` : ''}`;
    }
    case 'ins->ab':
      return `Adressteil des Befehls → Adressbus: ${A(e.after)}`;
    case 'ins->pc':
      return `Adressteil → Programmzähler: ${A(e.after)} (Sprung)`;
    case 'ins->mc': {
      const op = e.after / 10;
      const name = j.names[op];
      return `Opcode ${String(op).padStart(2, '0')}${name ? ` (${name})` : ''} → Mikroprogrammzähler: ${A(e.after)}`;
    }
    case 'pc->ab':
      return `Programmzähler → Adressbus: ${A(e.after)}`;
    case 'pc++':
      return `Programmzähler ${A(e.before)} → ${A(e.after)}`;
    case '=0:pc++':
      return e.after !== e.before
        ? `Akkumulator ist 0 → Programmzähler ${A(e.before)} → ${A(e.after)} (nächster Befehl wird übersprungen)`
        : `Akkumulator ist nicht 0 → Programmzähler bleibt ${A(e.after)}`;
    case 'mc:=0':
      return 'Mikroprogrammzähler := 0 → als Nächstes wird der nächste Befehl geholt (FETCH)';
    case 'stopp':
      return 'stopp: Johnny hält an';
    default:
      return e.key;
  }
}
