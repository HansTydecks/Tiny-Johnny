/** Aufbereitung der Aufgaben für die Oberfläche (läuft beim Bauen). */
import type { CollectionEntry } from 'astro:content';
import type { TestCase } from './johnny/checker';
import type { Mode } from './johnny/microcode';
import { assemble } from './johnny/assembler';
import { ramToShare } from './johnny/fileio';
import { microprogramFor } from './johnny/microcode';

export interface TaskView {
  id: string;
  titel: string;
  kontext: 'mathe' | 'spiele' | 'klassiker';
  sterne: number;
  typ: 'programm' | 'trace' | 'fehlersuche';
  modus: Mode;
  leitfrage: string;
  html: string;
  zellen: Record<string, string>;
  start: string;
  tests: TestCase[];
  fragen: { html: string; zelle?: number; akku?: boolean; antwort: number }[];
  tipps: string[];
  loesung: string;
  loesungText: string;
  erklaerung: string;
}

export function toTaskView(entry: CollectionEntry<'aufgaben'>, md: (s: string) => string): TaskView {
  const d = entry.data;
  const names = microprogramFor(d.modus).names;
  const start = assemble(d.start, names);
  if (start.errors.length) throw new Error(`${entry.id}: ${JSON.stringify(start.errors)}`);
  // Bei Trace-Aufgaben ist die „Lösung“ eine kommentierte Trace-Tabelle, kein Programm
  const solution = d.typ === 'trace' ? start : assemble(d.loesung, names, start.ram);
  if (solution.errors.length) throw new Error(`${entry.id}: ${JSON.stringify(solution.errors)}`);
  return {
    id: entry.id,
    titel: d.titel,
    kontext: d.kontext,
    sterne: d.sterne,
    typ: d.typ,
    modus: d.modus,
    leitfrage: d.leitfrage,
    html: md(d.text),
    zellen: d.zellen,
    start: ramToShare(start.ram),
    tests: d.tests,
    fragen: d.fragen.map((f) => ({ html: md(f.text), zelle: f.zelle, akku: f.akku, antwort: f.antwort })),
    tipps: d.tipps.map(md),
    loesung: ramToShare(solution.ram),
    loesungText: d.loesung.trim(),
    erklaerung: md(d.erklaerung),
  };
}
