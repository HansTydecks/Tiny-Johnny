/**
 * Zahlen ↔ Befehle: Formatierung wie im Original („01.005“) und ein kleiner Assembler
 * für Musterlösungen und Beispielprogramme.
 */
import { MAX_ADDR, MAX_VALUE, RAM_SIZE, addrOf, opcodeOf } from './engine';

export const pad = (n: number, len: number) => String(n).padStart(len, '0');

/** 1005 → "01.005" */
export function formatValue(v: number): string {
  return `${pad(opcodeOf(v), 2)}.${pad(addrOf(v), 3)}`;
}
export const formatAddr = (a: number) => pad(a, 3);
export const formatPlain = (v: number) => pad(v, 5);

/** Liefert Mnemonic und Operand, wenn die Zahl als Befehl gedeutet werden kann. */
export function disassembleValue(v: number, names: readonly string[]): { mnemonic: string; operand: number } | null {
  const op = opcodeOf(v);
  if (op === 0) return null;
  const name = names[op];
  if (!name) return null;
  return { mnemonic: name, operand: addrOf(v) };
}

export interface AsmError {
  line: number;
  message: string;
}

/**
 * Wandelt eine einzelne Eingabe in eine Zahl um.
 * Erlaubt: „7“, „00007“, „01.005“, „TAKE 5“, „take 005“, „HLT“.
 */
export function parseValue(input: string, names: readonly string[]): number | string {
  const s = input.trim();
  if (s === '') return 'Leere Eingabe';
  const dotted = /^(\d{1,2})[.,](\d{1,3})$/.exec(s);
  if (dotted) {
    const v = Number(dotted[1]) * 1000 + Number(dotted[2]);
    return v > MAX_VALUE ? `Zu groß: höchstens ${formatValue(MAX_VALUE)}` : v;
  }
  if (/^\d+$/.test(s)) {
    const v = Number(s);
    return v > MAX_VALUE ? `Zu groß: Johnny speichert höchstens ${MAX_VALUE}` : v;
  }
  const m = /^([A-Za-zÄÖÜäöü_]\w*)(?:\s+(\d+))?$/.exec(s);
  if (m) {
    const name = m[1].toUpperCase();
    const op = names.findIndex((n, i) => i > 0 && n.toUpperCase() === name);
    if (op < 0) return `Unbekannter Befehl „${m[1]}“`;
    const operand = m[2] === undefined ? 0 : Number(m[2]);
    if (operand > MAX_ADDR) return `Adresse ${operand} gibt es nicht (000–999)`;
    return op * 1000 + operand;
  }
  return `Nicht verstanden: „${s}“`;
}

/**
 * Programmtext → Speicherinhalt.
 * Jede Zeile belegt die nächste Zelle. „100: 5“ setzt die Zelle 100 und macht dort weiter.
 * Kommentare beginnen mit ; oder #.
 */
export function assemble(src: string, names: readonly string[], base: ArrayLike<number> = []) {
  const ram = new Array<number>(RAM_SIZE).fill(0).map((_, i) => Number(base[i] ?? 0));
  const errors: AsmError[] = [];
  let addr = 0;
  src.split(/\r?\n/).forEach((raw, idx) => {
    const line = raw.replace(/[;#].*$/, '').trim();
    if (!line) return;
    let body = line;
    const labeled = /^(\d{1,3})\s*:\s*(.*)$/.exec(line);
    if (labeled) {
      addr = Number(labeled[1]);
      body = labeled[2].trim();
      if (!body) return;
    }
    if (addr > MAX_ADDR) {
      errors.push({ line: idx + 1, message: 'Kein Platz mehr im Speicher' });
      return;
    }
    const v = parseValue(body, names);
    if (typeof v === 'string') errors.push({ line: idx + 1, message: v });
    else ram[addr] = v;
    addr++;
  });
  return { ram, errors };
}

/** Speicherbereich → Programmtext (nur belegte Zellen oder bis `to`). */
export function disassemble(ram: readonly number[], names: readonly string[], from = 0, to?: number): string {
  let last = to ?? -1;
  if (to === undefined) for (let i = ram.length - 1; i >= 0; i--) if (ram[i] !== 0) { last = i; break; }
  const lines: string[] = [];
  for (let i = from; i <= last; i++) {
    const d = disassembleValue(ram[i], names);
    lines.push(`${formatAddr(i)}: ${d ? `${d.mnemonic} ${formatAddr(d.operand)}` : String(ram[i])}`);
  }
  return lines.join('\n');
}
