/**
 * Dateiformate kompatibel zu Johnny 2.0:
 * - .ram: 1000 Zeilen, eine Zahl pro Zeile
 * - .mc:  200 Zeilen Mikrocode, danach die Befehlsnamen (Zeile 200 = FETCH, 201 = Befehl 01 …)
 */
import { RAM_SIZE, clampValue } from './engine';
import { MICROCODE_SIZE, MICRO_BY_CODE, SLOTS } from './microcode';

export function ramToFile(ram: readonly number[]): string {
  return ram.slice(0, RAM_SIZE).join('\r\n');
}

export function ramFromFile(text: string): number[] {
  const lines = text.split(/\r?\n/);
  return new Array(RAM_SIZE).fill(0).map((_, i) => clampValue(parseInt(lines[i] ?? '0', 10) || 0));
}

export function mcToFile(microcode: readonly number[], names: readonly string[]): string {
  let last = 0;
  names.forEach((n, i) => {
    if (n) last = i;
  });
  return [...microcode.slice(0, MICROCODE_SIZE), ...names.slice(0, last + 1)].join('\r\n');
}

export function mcFromFile(text: string): { microcode: number[]; names: string[] } {
  const lines = text.split(/\r?\n/);
  const microcode = new Array(MICROCODE_SIZE).fill(0).map((_, i) => {
    const n = parseInt(lines[i] ?? '0', 10);
    return MICRO_BY_CODE[n] ? n : 0;
  });
  const names = new Array(SLOTS).fill('').map((_, i) => (lines[MICROCODE_SIZE + i] ?? '').trim());
  return { microcode, names };
}

/** Kompakte Kodierung für Teilen-Links: nur belegte Zellen, „adresse:wert“, durch Kommas getrennt. */
export function ramToShare(ram: readonly number[]): string {
  const parts: string[] = [];
  ram.forEach((v, i) => {
    if (v !== 0) parts.push(`${i.toString(36)}:${v.toString(36)}`);
  });
  return parts.join(',');
}

export function ramFromShare(code: string): number[] {
  const ram = new Array(RAM_SIZE).fill(0);
  for (const part of code.split(',')) {
    const [a, v] = part.split(':');
    const addr = parseInt(a, 36);
    const val = parseInt(v, 36);
    if (Number.isInteger(addr) && addr >= 0 && addr < RAM_SIZE && Number.isInteger(val)) ram[addr] = clampValue(val);
  }
  return ram;
}
