/**
 * Automatische Prüfung von Programmen und Missionszielen.
 */
import { Johnny, type JohnnyState, type StopReason, RAM_SIZE } from './engine';
import { formatAddr, formatPlain } from './assembler';
import { MICRO_BY_KEY, type Mode } from './microcode';
import { ramFromShare } from './fileio';

export type CellMap = Record<string | number, number>;

export interface TestCase {
  name?: string;
  /** Eingabewerte, die vor dem Lauf in den Speicher geschrieben werden */
  ein?: CellMap;
  /** Erwartete Speicherinhalte nach dem Lauf */
  aus?: CellMap;
  /** Erwarteter Akkumulator nach dem Lauf */
  akku?: number;
}

export interface TestResult {
  name: string;
  passed: boolean;
  stop: StopReason;
  ticks: number;
  macros: number;
  problems: string[];
  errorMessage?: string;
}

export const toEntries = (m: CellMap | undefined) =>
  Object.entries(m ?? {}).map(([k, v]) => [Number(k), Number(v)] as const);

export interface RunOptions {
  mode?: Mode;
  microcode?: readonly number[];
  names?: readonly string[];
  maxMacroSteps?: number;
  /** Muss das Programm mit HLT enden? (Standard: ja) */
  requireHalt?: boolean;
}

export function runTest(program: ArrayLike<number>, test: TestCase, opts: RunOptions = {}, index = 0): TestResult {
  const j = new Johnny({ mode: opts.mode, ram: program });
  if (opts.microcode && opts.names) j.loadMicroprogram(opts.microcode, opts.names);
  for (const [a, v] of toEntries(test.ein)) j.writeRam(a, v);
  const stop = j.run(opts.maxMacroSteps ?? 20000);
  const problems: string[] = [];
  const requireHalt = opts.requireHalt ?? true;
  if (stop === 'limit') problems.push('Das Programm hört nicht auf (Endlosschleife?).');
  if (stop === 'error') problems.push(j.lastError?.message ?? 'Fehler beim Ausführen.');
  if (stop === 'stuck' && requireHalt)
    problems.push(`Das Programm bleibt bei Adresse ${formatAddr(j.pc)} hängen, ohne HLT zu erreichen.`);
  for (const [a, want] of toEntries(test.aus)) {
    const got = j.ram[a];
    if (got !== want) problems.push(`Zelle ${formatAddr(a)}: erwartet ${formatPlain(want)}, gefunden ${formatPlain(got)}`);
  }
  if (test.akku !== undefined && j.acc !== test.akku)
    problems.push(`Akkumulator: erwartet ${formatPlain(test.akku)}, gefunden ${formatPlain(j.acc)}`);
  return {
    name: test.name ?? `Test ${index + 1}`,
    passed: problems.length === 0,
    stop,
    ticks: j.ticks,
    macros: j.macroCount,
    problems,
    errorMessage: j.lastError?.message,
  };
}

/**
 * Programm für die Prüfung vorbereiten: Die Datenzellen einer Aufgabe werden auf ihren Anfangswert
 * zurückgesetzt – sonst würden Werte aus einem früheren Probelauf die Tests verfälschen.
 */
export function prepareProgram(ram: ArrayLike<number>, start: ArrayLike<number>, dataCells: Iterable<number>): number[] {
  const out = Array.from({ length: RAM_SIZE }, (_, i) => Number(ram[i] ?? 0));
  for (const a of dataCells) out[a] = Number(start[a] ?? 0);
  return out;
}

export function runTests(program: ArrayLike<number>, tests: TestCase[], opts: RunOptions = {}): TestResult[] {
  return tests.map((t, i) => runTest(program, t, opts, i));
}

// ---------------------------------------------------------------------------- Missionsziele

export interface Goal {
  ram?: CellMap;
  /** Zellen müssen mindestens diesen Wert haben */
  ramMin?: CellMap;
  acc?: number;
  ab?: number;
  db?: number;
  ins?: number;
  pc?: number;
  mc?: number;
  halted?: boolean;
  /** Diese Mikrobefehle müssen seit dem Missionsschritt benutzt worden sein */
  benutzt?: string[];
  /** Eigener Makrobefehl mit diesem Namen muss existieren (optional mit bestimmten Mikrobefehlen) */
  befehl?: { name: string; mikro?: string[] };
  modus?: Mode;
  /** Das Programm im Speicher muss diese Tests bestehen */
  tests?: TestCase[];
  /** Müssen die Tests mit HLT enden? (Standard: ja) */
  requireHalt?: boolean;
  /** Tests mit diesem festen Programm (Teilen-Code) statt mit dem aktuellen Speicher ausführen */
  programmRam?: string;
}

export function goalProgram(goal: Goal, s: JohnnyState): number[] {
  return goal.programmRam !== undefined ? ramFromShare(goal.programmRam) : s.ram.slice(0, RAM_SIZE);
}

export interface GoalContext {
  used: ReadonlySet<string>;
}

export function goalMet(goal: Goal, s: JohnnyState, ctx: GoalContext): boolean {
  for (const [a, v] of toEntries(goal.ram)) if (s.ram[a] !== v) return false;
  for (const [a, v] of toEntries(goal.ramMin)) if (s.ram[a] < v) return false;
  if (goal.acc !== undefined && s.acc !== goal.acc) return false;
  if (goal.ab !== undefined && s.ab !== goal.ab) return false;
  if (goal.db !== undefined && s.db !== goal.db) return false;
  if (goal.ins !== undefined && s.ins !== goal.ins) return false;
  if (goal.pc !== undefined && s.pc !== goal.pc) return false;
  if (goal.mc !== undefined && s.mc !== goal.mc) return false;
  if (goal.halted !== undefined && s.halted !== goal.halted) return false;
  if (goal.modus !== undefined && s.mode !== goal.modus) return false;
  if (goal.benutzt && !goal.benutzt.every((k) => ctx.used.has(k))) return false;
  if (goal.befehl) {
    const slot = s.names.findIndex((n, i) => i > 0 && n.toUpperCase() === goal.befehl!.name.toUpperCase());
    if (slot < 0) return false;
    const ops = s.microcode.slice(slot * 10, slot * 10 + 10);
    if (ops.every((o) => o === 0)) return false;
    if (goal.befehl.mikro) {
      const want = goal.befehl.mikro.map((k) => MICRO_BY_KEY[k]?.code);
      if (!want.every((c, i) => ops[i] === c)) return false;
    }
  }
  if (goal.tests) {
    const res = runTests(goalProgram(goal, s), goal.tests, {
      microcode: s.microcode,
      names: s.names,
      requireHalt: goal.requireHalt,
    });
    if (!res.every((r) => r.passed)) return false;
  }
  return true;
}
