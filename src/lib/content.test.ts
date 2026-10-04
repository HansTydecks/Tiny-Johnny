/**
 * Prüft alle Inhaltsdateien: Jede Tutorial-Mission muss mit dem hinterlegten Lösungsweg lösbar sein,
 * jede Musterlösung muss alle Testfälle bestehen, jedes Beispiel muss sich assemblieren lassen.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { load as yamlLoad } from 'js-yaml';
import { Johnny } from './johnny/engine';
import { assemble } from './johnny/assembler';
import { applyAction } from './johnny/actions';
import { goalMet, prepareProgram, runTests, type Goal } from './johnny/checker';
import { ramToShare } from './johnny/fileio';
import { microprogramFor, MICRO_BY_KEY, type Mode } from './johnny/microcode';
import { FOCUS_IDS, FOCUS_NEEDS, type FocusId } from './johnny/flow';

const root = join(__dirname, '..', 'content');
const files = (dir: string, ext: string) =>
  readdirSync(join(root, dir))
    .filter((f) => f.endsWith(ext))
    .sort()
    .map((f) => ({ name: f, text: readFileSync(join(root, dir, f), 'utf8') }));

function frontmatter(text: string): any {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!m) throw new Error('Kein Frontmatter');
  return yamlLoad(m[1]);
}

function asm(src: string | undefined, mode: Mode, j?: Johnny): number[] {
  const res = assemble(src ?? '', j?.names ?? microprogramFor(mode).names);
  expect(res.errors, JSON.stringify(res.errors)).toEqual([]);
  return res.ram;
}

/**
 * Welche Bedienmöglichkeit ein Schritt des Lösungswegs braucht – so ist sichergestellt, dass die Lernenden
 * genau das tun können (und nur das), was der Lösungsweg vorsieht.
 */
function needs(action: string, mikro: string[] | 'alle'): string | null {
  const a = action.trim().toLowerCase();
  if (a.startsWith('micro ')) {
    const k = action.trim().slice(6).trim();
    return mikro === 'alle' || mikro.includes(k) ? null : `den Mikrobefehl ${k} (fehlt in „mikro“)`;
  }
  const map: [RegExp, string][] = [
    [/^ram\s/, 'ramEdit'],
    [/^ab\s*=/, 'abInput'],
    [/^db\s*=/, 'dbInput'],
    [/^mikroschritt$/, 'microStep'],
    [/^makroschritt$/, 'macroStep'],
    [/^ausfuehren$/, 'run'],
    [/^reset$/, 'reset'],
    [/^modus\s/, 'bonsai'],
    [/^aufnahme\s/, 'record'],
  ];
  return map.find(([re]) => re.test(a))?.[1] ?? null;
}

describe('Tutorial-Missionen', () => {
  const levels = files('tutorial', '.md');
  it('gibt es in lückenloser Nummerierung', () => {
    const nums = levels.map((l) => frontmatter(l.text).nummer).sort((a, b) => a - b);
    expect(nums).toEqual(nums.map((_, i) => i + 1));
  });

  for (const file of levels) {
    it(`${file.name} ist mit dem Lösungsweg lösbar`, () => {
      const d = frontmatter(file.text);
      const mode: Mode = d.modus ?? 'normal';
      const start = asm(d.programm, mode);
      for (const [k, v] of Object.entries(d.startRam ?? {})) start[Number(k)] = v as number;
      const j = new Johnny({ mode, ram: start });
      const used = new Set<string>();
      j.onMicro((e) => used.add(e.key));

      for (const k of d.mikro === 'alle' ? [] : (d.mikro ?? [])) expect(MICRO_BY_KEY[k], `Mikrobefehl ${k}`).toBeDefined();

      d.schritte.forEach((step: any, i: number) => {
        const where = `${file.name} Schritt ${i + 1}`;
        const p = step.vorbereitung;
        if (p) {
          if (p.reset) j.reset();
          if (p.ramLeeren) j.clearRam();
          if (p.programm !== undefined) j.loadRam(asm(p.programm, mode, j));
          for (const [k, v] of Object.entries(p.ram ?? {})) j.writeRam(Number(k), v as number);
          for (const [k, v] of Object.entries(p.register ?? {})) (j as any)[k] = v;
        }
        for (const f of step.fokus ?? []) {
          expect(FOCUS_IDS, `${where}: unbekannter Fokus ${f}`).toContain(f);
          for (const part of FOCUS_NEEDS[f as FocusId]) expect(d.sichtbar, `${where}: Fokus ${f} braucht sichtbares ${part}`).toContain(part);
        }
        used.clear();
        if (step.typ === 'aktion') {
          expect(step.loesung?.length, `${where}: Lösungsweg fehlt`).toBeGreaterThan(0);
          const allowed = new Set<string>(step.funktionen ?? d.funktionen ?? []);
          for (const a of step.loesung) {
            const need = needs(a, d.mikro ?? []);
            expect(need === null || allowed.has(need), `${where}: „${a}“ braucht ${need}, erlaubt sind nur [${[...allowed]}]`).toBe(true);
            applyAction(j, a);
          }
          const goal: Goal = {
            ...step.ziel,
            programm: undefined,
            programmRam: step.ziel.programm !== undefined ? ramToShare(asm(step.ziel.programm, mode, j)) : undefined,
          };
          expect(goalMet(goal, j.snapshot(), { used }), `${where}: Ziel nicht erreicht`).toBe(true);
        } else if (step.typ === 'quiz') {
          const r = Array.isArray(step.richtig) ? step.richtig : [step.richtig];
          expect(r.every((x: number) => x >= 0 && x < step.optionen.length), `${where}: richtig-Index`).toBe(true);
        } else if (step.typ === 'vorhersage') {
          expect(typeof step.antwort, where).toBe('number');
        }
      });
    });
  }
});

describe('Aufgaben', () => {
  let tasks: { name: string; text: string }[] = [];
  try {
    tasks = files('aufgaben', '.yaml');
  } catch {
    tasks = [];
  }
  for (const file of tasks) {
    it(`${file.name}: Musterlösung besteht alle Tests`, () => {
      const d: any = yamlLoad(file.text);
      const mode: Mode = d.modus ?? 'normal';
      for (const key of ['titel', 'kurz', 'leitfrage', 'text'])
        expect(typeof d[key], `${file.name}: ${key} muss Text sein`).toBe('string');
      for (const tip of d.tipps ?? []) expect(typeof tip, `${file.name}: Tipp muss Text sein (Doppelpunkt in Anführungszeichen setzen)`).toBe('string');
      if (d.typ === 'trace') {
        const j = new Johnny({ mode, ram: asm(d.start, mode) });
        j.run();
        for (const f of d.fragen) {
          const got = f.akku ? j.acc : j.ram[f.zelle];
          expect(got, `${file.name}: ${f.text}`).toBe(f.antwort);
        }
        return;
      }
      expect(d.tests?.length, `${file.name}: keine Tests`).toBeGreaterThan(0);
      expect(d.tipps?.length, `${file.name}: Tipps`).toBeGreaterThanOrEqual(2);
      const base = asm(d.start, mode);
      const solution = assemble(d.loesung, microprogramFor(mode).names, base);
      expect(solution.errors).toEqual([]);
      const results = runTests(solution.ram, d.tests, { mode });
      for (const r of results) expect(r.problems, `${file.name} ${r.name}`).toEqual([]);
      // Auch nach einem Probelauf (veränderte Daten) muss die Prüfung noch funktionieren
      const dirty = new Johnny({ mode, ram: solution.ram });
      dirty.run();
      const prepared = prepareProgram(dirty.ram, base, Object.keys(d.zellen ?? {}).map(Number));
      for (const r of runTests(prepared, d.tests, { mode })) expect(r.problems, `${file.name} nach Probelauf ${r.name}`).toEqual([]);
      if (d.typ === 'fehlersuche') {
        const broken = runTests(base, d.tests, { mode, maxMacroSteps: 3000 });
        expect(broken.some((r) => !r.passed), `${file.name}: Das fehlerhafte Programm besteht bereits alle Tests`).toBe(true);
      }
    });
  }
});

describe('Beispiele', () => {
  for (const file of files('beispiele', '.yaml')) {
    it(`${file.name} assembliert und hält an`, () => {
      const d: any = yamlLoad(file.text);
      const mode: Mode = d.modus ?? 'normal';
      const j = new Johnny({ mode, ram: asm(d.programm, mode) });
      expect(j.run()).toBe('halt');
    });
  }
});
