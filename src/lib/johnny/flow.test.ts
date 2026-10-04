import { describe, expect, it } from 'vitest';
import { Johnny, type JohnnyState, type MicroEvent } from './engine';
import { assemble } from './assembler';
import { MICRO_LIST, STANDARD } from './microcode';
import { WIRE_OF, signature, stateBefore, stepDuration, tokenLabel } from './flow';

const regs = (s: JohnnyState) => ({ ab: s.ab, db: s.db, acc: s.acc, ins: s.ins, pc: s.pc, mc: s.mc, halted: s.halted });

describe('Datenfluss-Wiedergabe', () => {
  it('rekonstruiert jeden Zwischenzustand eines Makroschritts', () => {
    const src = 'TAKE 100\nINC 100\nSAVE 101\nTST 102\nHLT\n100: 7\n0\n0';
    for (let steps = 1; steps <= 4; steps++) {
      const j = new Johnny({ ram: assemble(src, STANDARD.names).ram });
      for (let i = 0; i < steps - 1; i++) j.macroStep();

      const snapshots: JohnnyState[] = [j.snapshot()];
      const events: MicroEvent[] = [];
      j.onMicro((e) => {
        events.push(e);
        snapshots.push(j.snapshot());
      });
      do j.microStep();
      while (j.mc !== 0);

      const final = j.snapshot();
      events.forEach((_, k) => {
        const s = stateBefore(final, events, k);
        // Schnappschuss nach Ereignis k−1 – der Mikroprogrammzähler steht dann auf dem Mikrobefehl k
        const want = { ...regs(snapshots[k]), mc: events[k].at };
        expect(regs(s), `Schritt ${steps}, Mikrobefehl ${k}`).toEqual(want);
        expect(s.ram.slice(100, 103)).toEqual(snapshots[k].ram.slice(100, 103));
      });
      expect(stateBefore(final, events, events.length)).toBe(final);
    }
  });

  it('verändert den Endzustand nicht', () => {
    const j = new Johnny({ ram: assemble('INC 100\nHLT\n100: 5', STANDARD.names).ram });
    const events: MicroEvent[] = [];
    j.onMicro((e) => events.push(e));
    j.macroStep();
    const final = j.snapshot();
    const sig = signature(final);
    const s = stateBefore(final, events, 0);
    expect(s.ram[100]).toBe(5);
    expect(final.ram[100]).toBe(6);
    expect(signature(final)).toBe(sig);
  });

  it('kennt für jeden Mikrobefehl eine Leitung oder ausdrücklich keine', () => {
    for (const m of MICRO_LIST) expect(m.key in WIRE_OF, m.key).toBe(true);
  });

  it('beschriftet die Pakete verständlich', () => {
    const s = { db: 42, acc: 0, ins: 1010 };
    const ev = (key: string, after: number, before = 0): MicroEvent => ({ code: 0, key, target: 'db', before, after });
    expect(tokenLabel(ev('ram->db', 42), s)).toBe('42');
    expect(tokenLabel(ev('db->ins', 1010), s)).toBe('01.010');
    expect(tokenLabel(ev('plus', 49, 7), s)).toBe('+42');
    expect(tokenLabel(ev('ins->ab', 10), s)).toBe('010');
    expect(tokenLabel(ev('ins->mc', 10), s)).toBe('01');
    expect(tokenLabel(ev('=0:pc++', 1, 0), s)).toBe('= 0');
  });

  it('animiert nur, wenn genug Zeit bleibt', () => {
    expect(stepDuration(1)).toBeGreaterThan(300);
    expect(stepDuration(9)).toBeGreaterThanOrEqual(150);
    expect(stepDuration(9, 650)).toBe(0);
    expect(stepDuration(9, 1500)).toBeGreaterThan(0);
  });
});
