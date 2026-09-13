/** Aufbereitung der Tutorial-Missionen für die Oberfläche (läuft beim Bauen). */
import type { CollectionEntry } from 'astro:content';
import type { Goal } from './johnny/checker';
import type { Feature, Part } from './johnny/sim.svelte';
import type { Mode } from './johnny/microcode';
import { assemble } from './johnny/assembler';
import { ramToShare } from './johnny/fileio';
import { microprogramFor } from './johnny/microcode';

export interface Prep {
  reset?: boolean;
  ramLeeren?: boolean;
  /** Einzelne Zellen setzen (der Rest bleibt) */
  ram?: Record<string, number>;
  /** Ganzer Speicherinhalt als Teilen-Code (aus Assembler-Text, ersetzt alles) */
  programm?: string;
  register?: Partial<Record<'acc' | 'ab' | 'db' | 'ins' | 'pc' | 'mc', number>>;
}

export type StepView =
  | { typ: 'info'; titel?: string; html: string; prep?: Prep }
  | { typ: 'aktion'; titel?: string; html: string; ziel: Goal; tipp?: string; erfolg?: string; prep?: Prep }
  | { typ: 'quiz'; titel?: string; frage: string; optionen: string[]; richtig: number | number[]; erklaerung: string; prep?: Prep }
  | { typ: 'vorhersage'; titel?: string; frage: string; antwort: number; einheit?: string; erklaerung: string; prep?: Prep };

export interface LevelView {
  id: string;
  nummer: number;
  titel: string;
  leitfrage: string;
  modus: Mode;
  sichtbar: Part[];
  mikro: 'alle' | string[];
  funktionen: Feature[];
  startRam: string;
  zellen: Record<string, string>;
  schritte: StepView[];
}

export const levelId = (n: number) => String(n).padStart(2, '0');

export function toShare(ram: Record<string, number> | undefined, programm: string | undefined, mode: Mode): string {
  const names = microprogramFor(mode).names;
  const base = new Array(1000).fill(0);
  if (programm) {
    const res = assemble(programm, names);
    if (res.errors.length) throw new Error(res.errors.map((e) => `Zeile ${e.line}: ${e.message}`).join('; '));
    res.ram.forEach((v, i) => (base[i] = v));
  }
  for (const [k, v] of Object.entries(ram ?? {})) base[Number(k)] = v;
  return ramToShare(base);
}

export function toLevelView(entry: CollectionEntry<'tutorial'>, md: (s: string) => string, mdInline: (s: string) => string): LevelView {
  const d = entry.data;
  const prep = (p: (typeof d.schritte)[number]['vorbereitung']): Prep | undefined =>
    p
      ? {
          reset: p.reset,
          ramLeeren: p.ramLeeren,
          register: p.register,
          ram: p.ram,
          programm: p.programm !== undefined ? toShare(undefined, p.programm, d.modus) : undefined,
        }
      : undefined;
  return {
    id: levelId(d.nummer),
    nummer: d.nummer,
    titel: d.titel,
    leitfrage: d.leitfrage,
    modus: d.modus,
    sichtbar: d.sichtbar,
    mikro: d.mikro,
    funktionen: d.funktionen,
    startRam: toShare(d.startRam, d.programm, d.modus),
    zellen: d.zellen,
    schritte: d.schritte.map((s): StepView => {
      switch (s.typ) {
        case 'info':
          return { typ: 'info', titel: s.titel, html: md(s.text), prep: prep(s.vorbereitung) };
        case 'aktion':
          return {
            typ: 'aktion',
            titel: s.titel,
            html: md(s.text),
            ziel: {
              ...s.ziel,
              programm: undefined,
              programmRam: s.ziel.programm !== undefined ? toShare(undefined, s.ziel.programm, d.modus) : undefined,
            } as Goal,
            tipp: s.tipp ? md(s.tipp) : undefined,
            erfolg: s.erfolg ? md(s.erfolg) : undefined,
            prep: prep(s.vorbereitung),
          };
        case 'quiz':
          return {
            typ: 'quiz',
            titel: s.titel,
            frage: md(s.frage),
            optionen: s.optionen.map(mdInline),
            richtig: s.richtig,
            erklaerung: md(s.erklaerung),
            prep: prep(s.vorbereitung),
          };
        case 'vorhersage':
          return {
            typ: 'vorhersage',
            titel: s.titel,
            frage: md(s.frage),
            antwort: s.antwort,
            einheit: s.einheit,
            erklaerung: md(s.erklaerung),
            prep: prep(s.vorbereitung),
          };
      }
    }),
  };
}
