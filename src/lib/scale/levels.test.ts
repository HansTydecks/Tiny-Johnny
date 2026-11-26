/**
 * Prüft die Zoomstufen: Jede Kette muss lückenlos vom Mainboard bis zu den Atomen reichen,
 * und alle Texte müssen auf Deutsch und Englisch vorhanden sein.
 */
import { describe, expect, it } from 'vitest';
import { LEVELS, PATHS } from './levels';
import { UI, PATH_BUTTONS } from './ui';
import { PARTS } from './parts';
import type { LevelDef } from './types';

const byId = new Map(LEVELS.map((l) => [l.id, l]));
const parentOf = (l: LevelDef) => (l.parent ? byId.get(l.parent)! : null);

describe('Zoomstufen', () => {
  it('haben eindeutige IDs und gültige Eltern', () => {
    expect(byId.size).toBe(LEVELS.length);
    expect(LEVELS.filter((l) => !l.parent)).toHaveLength(1);
    for (const l of LEVELS) if (l.parent) expect(byId.has(l.parent), l.id).toBe(true);
  });

  it('Kinder erscheinen erst nach der Elternebene und sind erreichbar', () => {
    for (const l of LEVELS) {
      const p = parentOf(l);
      expect(l.zCover, l.id).toBeLessThan(l.zIn);
      expect(l.floor, l.id).toBeLessThan(l.zIn);
      expect(l.catchR, l.id).toBeLessThanOrEqual(l.pullR);
      if (!p) continue;
      expect(l.zIn, l.id).toBeLessThan(p.zIn);
      // Man muss über die Elternebene hinaus bis zum Erscheinen des Kindes zoomen können
      expect(p.floor, `${p.id} → ${l.id}`).toBeLessThanOrEqual(l.zIn - 0.25);
      // Das Kind muss kleiner sein als der Bereich, in dem die Eltern sichtbar sind
      expect(l.unit, l.id).toBeLessThanOrEqual(p.unit);
    }
  });

  it('jede Kette endet bei den Atomen (Sichtfeld unter 1 nm)', () => {
    expect(PATHS.length).toBe(6);
    for (const p of PATHS) {
      const leaf = byId.get(p.leaf);
      expect(leaf, p.leaf).toBeDefined();
      expect(leaf!.floor).toBeLessThan(-9.2);
      // vom Blatt bis zur Wurzel
      let l: LevelDef | null = leaf!;
      let n = 0;
      while (l) {
        n++;
        l = parentOf(l);
      }
      expect(n, p.leaf).toBeGreaterThanOrEqual(5);
    }
    expect(PATH_BUTTONS.map((b) => b.leaf).sort()).toEqual(PATHS.map((p) => p.leaf).sort());
  });

  it('Untertitel sind nach Tiefe sortiert', () => {
    for (const l of LEVELS) {
      expect(l.captions.length, l.id).toBeGreaterThan(0);
      for (let i = 1; i < l.captions.length; i++) expect(l.captions[i].z, l.id).toBeLessThan(l.captions[i - 1].z);
    }
  });

  it('alle Texte gibt es auf Deutsch und Englisch', () => {
    const check = (x: { de: string; en: string }, where: string) => {
      expect(x.de.trim(), where).not.toBe('');
      expect(x.en.trim(), where).not.toBe('');
    };
    for (const l of LEVELS) {
      check(l.title, l.id);
      l.captions.forEach((c, i) => {
        check(c.text, `${l.id} caption ${i}`);
        expect(c.text.de, `${l.id} caption ${i} übersetzt?`).not.toBe(c.text.en);
      });
    }
    for (const [k, v] of Object.entries(UI)) check(v, k);
    for (const [k, p] of Object.entries(PARTS)) {
      check(p.name, k);
      check(p.info, k);
    }
  });

  it('zoombare Bauteile zeigen auf echte Ebenen direkt unter der Platine', () => {
    for (const [k, p] of Object.entries(PARTS)) {
      if (!p.zoomTo) continue;
      const l = byId.get(p.zoomTo);
      expect(l, k).toBeDefined();
      expect(l!.parent, k).toBe('board');
    }
  });
});
