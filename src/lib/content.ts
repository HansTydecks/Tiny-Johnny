/** Hilfsfunktionen, die nur beim Bauen der Seite laufen (Astro-Frontmatter). */
import { marked } from 'marked';
import { getCollection } from 'astro:content';
import { assemble } from './johnny/assembler';
import { ramToShare } from './johnny/fileio';
import { microprogramFor, type Mode } from './johnny/microcode';
import type { Example } from './johnny/sim.svelte';

marked.setOptions({ gfm: true, breaks: false });

export function md(text: string | undefined): string {
  if (!text) return '';
  return marked.parse(text, { async: false }) as string;
}

export function mdInline(text: string | undefined): string {
  if (!text) return '';
  return marked.parseInline(text, { async: false }) as string;
}

export function assembleToShare(src: string, mode: Mode): string {
  const { ram, errors } = assemble(src, microprogramFor(mode).names);
  if (errors.length) throw new Error(`Assembler-Fehler: ${errors.map((e) => `Zeile ${e.line}: ${e.message}`).join('; ')}`);
  return ramToShare(ram);
}

export async function getExamples(): Promise<Example[]> {
  const all = await getCollection('beispiele');
  return all
    .sort((a, b) => a.data.reihenfolge - b.data.reihenfolge)
    .map((e) => ({
      titel: e.data.titel,
      beschreibung: e.data.beschreibung,
      modus: e.data.modus,
      code: assembleToShare(e.data.programm, e.data.modus),
    }));
}

export const KONTEXTE = {
  mathe: { titel: 'Rechnen & Mathe', farbe: 'alu', icon: '∑' },
  spiele: { titel: 'Spiele & Zähler', farbe: 'io', icon: '🎮' },
  klassiker: { titel: 'Informatik-Klassiker', farbe: 'cu', icon: '⌘' },
} as const;
