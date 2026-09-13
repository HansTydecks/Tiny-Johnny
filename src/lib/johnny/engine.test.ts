import { describe, expect, it } from 'vitest';
import { Johnny, MAX_VALUE } from './engine';
import { BONSAI, MICRO_BY_KEY, STANDARD } from './microcode';
import { assemble, disassemble, formatValue, parseValue } from './assembler';
import { mcFromFile, mcToFile, ramFromFile, ramFromShare, ramToFile, ramToShare } from './fileio';
import { goalMet, runTests } from './checker';

const prog = (src: string, mode: 'normal' | 'bonsai' = 'normal') =>
  assemble(src, (mode === 'bonsai' ? BONSAI : STANDARD).names).ram;

describe('Mikroprogramm entspricht Johnny 2.0', () => {
  it('Standard-Mikrocode ist identisch zum Original', () => {
    const original =
      '8;2;3;5;0;0;0;0;0;0;4;2;18;9;7;0;0;0;0;0;4;2;13;9;7;0;0;0;0;0;4;2;14;9;7;0;0;0;0;0;4;15;1;9;7;0;0;0;0;0;11;7;0;0;0;0;0;0;0;0;4;2;18;10;9;7;0;0;0;0;4;2;18;16;15;1;9;7;0;0;4;2;18;17;15;1;9;7;0;0;4;12;15;1;9;7;0;0;0;0;19;7'
        .split(';')
        .map(Number);
    expect(STANDARD.microcode.slice(0, original.length)).toEqual(original);
    expect(STANDARD.microcode.slice(original.length).every((x) => x === 0)).toBe(true);
    expect(STANDARD.names.slice(0, 11)).toEqual(['FETCH', 'TAKE', 'ADD', 'SUB', 'SAVE', 'JMP', 'TST', 'INC', 'DEC', 'NULL', 'HLT']);
  });
  it('Bonsai-Mikrocode ist identisch zum Original', () => {
    const original = '8;2;3;5;0;0;0;0;0;0;4;2;18;16;15;1;9;7;0;0;4;2;18;17;15;1;9;7;0;0;11;7;0;0;0;0;0;0;0;0;4;2;18;10;9;7;0;0;0;0;19;7'
      .split(';')
      .map(Number);
    expect(BONSAI.microcode.slice(0, original.length)).toEqual(original);
    expect(BONSAI.names.slice(0, 6)).toEqual(['FETCH', 'INC', 'DEC', 'JMP', 'TST', 'HLT']);
  });
});

describe('Mikrobefehle', () => {
  it('Speicher und Busse', () => {
    const j = new Johnny();
    j.setAb(10);
    j.setDb(1234);
    j.exec('db->ram');
    expect(j.ram[10]).toBe(1234);
    j.setDb(0);
    j.exec('ram->db');
    expect(j.db).toBe(1234);
    j.exec('db->acc');
    expect(j.acc).toBe(1234);
    j.exec('acc->db');
    expect(j.db).toBe(1234);
  });

  it('Akkumulator sättigt bei 0 und 19999', () => {
    const j = new Johnny();
    j.setDb(5);
    j.exec('minus');
    expect(j.acc).toBe(0);
    j.exec('acc--');
    expect(j.acc).toBe(0);
    j.setDb(MAX_VALUE);
    j.exec('db->acc');
    j.exec('acc++');
    expect(j.acc).toBe(MAX_VALUE);
    j.setDb(10);
    j.exec('plus');
    expect(j.acc).toBe(MAX_VALUE);
    j.exec('acc:=0');
    expect(j.acc).toBe(0);
  });

  it('Befehlsregister zerlegt Opcode und Adresse', () => {
    const j = new Johnny();
    j.setDb(7123);
    j.exec('db->ins');
    j.exec('ins->ab');
    expect(j.ab).toBe(123);
    j.exec('ins->pc');
    expect(j.pc).toBe(123);
    j.exec('ins->mc');
    expect(j.mc).toBe(70);
    j.exec('mc:=0');
    expect(j.mc).toBe(0);
  });

  it('Programmzähler: pc++ bleibt bei 999, =0:pc++ nur bei Akku 0', () => {
    const j = new Johnny();
    j.exec('=0:pc++');
    expect(j.pc).toBe(1);
    j.acc = 3;
    j.exec('=0:pc++');
    expect(j.pc).toBe(1);
    j.pc = 999;
    j.exec('pc++');
    expect(j.pc).toBe(999);
    j.exec('pc->ab');
    expect(j.ab).toBe(999);
  });

  it('Manueller Mikrobefehl zählt mc nicht weiter, Mikroschritt schon', () => {
    const j = new Johnny();
    j.exec('pc->ab');
    expect(j.mc).toBe(0);
    j.microStep();
    expect(j.mc).toBe(1);
    expect(j.used.has('pc->ab')).toBe(true);
  });
});

describe('Makrobefehle', () => {
  const run = (src: string, setup?: (j: Johnny) => void) => {
    const j = new Johnny({ ram: prog(src) });
    setup?.(j);
    const stop = j.run();
    return { j, stop };
  };

  it('TAKE / ADD / SUB / SAVE / HLT', () => {
    const { j, stop } = run('TAKE 100\nADD 101\nSUB 102\nSAVE 103\nHLT\n100: 7\n3\n4');
    expect(stop).toBe('halt');
    expect(j.ram[103]).toBe(6);
    expect(j.acc).toBe(6);
    expect(j.pc).toBe(4);
    expect(j.macroCount).toBe(5);
  });

  it('INC / DEC / NULL überschreiben den Akkumulator', () => {
    const { j } = run('TAKE 100\nINC 101\nHLT\n100: 50\n9');
    expect(j.ram[101]).toBe(10);
    expect(j.acc).toBe(10);
    const r2 = run('TAKE 100\nDEC 101\nHLT\n100: 50\n9');
    expect(r2.j.ram[101]).toBe(8);
    expect(r2.j.acc).toBe(8);
    const r3 = run('TAKE 100\nNULL 101\nHLT\n100: 50\n9');
    expect(r3.j.ram[101]).toBe(0);
    expect(r3.j.acc).toBe(0);
  });

  it('TST überspringt bei 0 und überschreibt den Akku', () => {
    const src = 'TAKE 100\nTST 101\nJMP 005\nHLT\n000\n004: SAVE 102\nHLT\n100: 42';
    const zero = run(src, (j) => j.writeRam(101, 0));
    expect(zero.j.pc).toBe(3);
    expect(zero.j.acc).toBe(0);
    const nonzero = run(src, (j) => j.writeRam(101, 5));
    expect(nonzero.j.ram[102]).toBe(0); // JMP 005 → HLT bei 005
    expect(nonzero.j.pc).toBe(5);
    expect(nonzero.j.acc).toBe(5);
  });

  it('JMP auf sich selbst stoppt das Ausführen (PC unverändert)', () => {
    const { stop, j } = run('JMP 000');
    expect(stop).toBe('stuck');
    expect(j.pc).toBe(0);
  });

  it('Befehl 00 wird geholt, PC ändert sich nicht', () => {
    const { stop } = run('0');
    expect(stop).toBe('stuck');
  });

  it('Befehl ohne Mikroprogramm hält mit Fehler an', () => {
    const j = new Johnny();
    j.writeRam(0, 15000);
    expect(j.run()).toBe('error');
    expect(j.lastError?.message).toMatch(/kein Mikroprogramm/);
  });

  it('Countdown-Schleife', () => {
    const { j, stop } = run('TST 100\nJMP 003\nHLT\nDEC 100\nJMP 000\n100: 5');
    expect(stop).toBe('halt');
    expect(j.ram[100]).toBe(0);
  });

  it('Bonsai-Modus: Addition nur mit INC/DEC/TST/JMP', () => {
    const src = '000: TST 101\nJMP 003\nHLT\nDEC 101\nINC 100\nJMP 000\n100: 4\n3';
    const j = new Johnny({ mode: 'bonsai', ram: prog(src, 'bonsai') });
    expect(j.run()).toBe('halt');
    expect(j.ram[100]).toBe(7);
  });
});

describe('Mikrocode-Aufnahme', () => {
  it('eigener Befehl DBL verdoppelt eine Zelle', () => {
    const j = new Johnny();
    j.startRecording(11, 'dbl');
    for (const k of ['ins->ab', 'ram->db', 'db->acc', 'plus', 'acc->db', 'db->ram', 'pc++', 'mc:=0']) j.exec(k);
    j.stopRecording();
    expect(j.names[11]).toBe('DBL');
    j.reset();
    j.loadRam(assemble('DBL 100\nHLT\n100: 21', j.names).ram);
    expect(j.run()).toBe('halt');
    expect(j.ram[100]).toBe(42);
  });
});

describe('Assembler & Dateien', () => {
  it('formatiert und parst', () => {
    expect(formatValue(1005)).toBe('01.005');
    expect(parseValue('01.005', STANDARD.names)).toBe(1005);
    expect(parseValue('take 5', STANDARD.names)).toBe(1005);
    expect(parseValue('HLT', STANDARD.names)).toBe(10000);
    expect(parseValue('20000', STANDARD.names)).toMatch(/Zu groß/);
    expect(parseValue('FOO 1', STANDARD.names)).toMatch(/Unbekannt/);
  });
  it('disassembliert', () => {
    const ram = prog('TAKE 100\nHLT\n100: 7');
    expect(disassemble(ram, STANDARD.names, 0, 1)).toBe('000: TAKE 100\n001: HLT 000');
  });
  it('.ram und .mc Round-Trip im Originalformat', () => {
    const ram = prog('TAKE 100\nHLT\n100: 7');
    const file = ramToFile(ram);
    expect(file.split('\r\n')).toHaveLength(1000);
    expect(ramFromFile(file)).toEqual(ram);
    const mc = mcToFile(STANDARD.microcode, STANDARD.names);
    const lines = mc.split('\r\n');
    expect(lines).toHaveLength(211);
    expect(lines[200]).toBe('FETCH');
    expect(mcFromFile(mc)).toEqual({ microcode: STANDARD.microcode, names: STANDARD.names });
    expect(ramFromShare(ramToShare(ram))).toEqual(ram);
  });
});

describe('Prüfung', () => {
  it('Tests und Ziele', () => {
    const ram = prog('TAKE 100\nADD 101\nSAVE 102\nHLT');
    const res = runTests(ram, [
      { ein: { 100: 2, 101: 3 }, aus: { 102: 5 } },
      { ein: { 100: 9, 101: 9 }, aus: { 102: 18 } },
    ]);
    expect(res.every((r) => r.passed)).toBe(true);
    const bad = runTests(prog('TAKE 100\nSAVE 102'), [{ ein: { 100: 2 }, aus: { 102: 2 } }]);
    expect(bad[0].passed).toBe(false);
    const j = new Johnny();
    j.writeRam(10, 7);
    expect(goalMet({ ram: { '010': 7 } }, j.snapshot(), { used: j.used })).toBe(true);
    expect(goalMet({ benutzt: ['plus'] }, j.snapshot(), { used: j.used })).toBe(false);
    expect(MICRO_BY_KEY['plus'].code).toBe(13);
  });
});
