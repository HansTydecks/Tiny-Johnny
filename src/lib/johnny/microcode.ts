/**
 * Mikrobefehle und Mikroprogramme von Johnny.
 *
 * Die Nummern und Abläufe entsprechen exakt Johnny 2.0 (D. Laubersheimer, P. Dauscher),
 * damit .mc-Dateien und Programme zwischen Tiny Johnny und dem Original austauschbar sind.
 */

export const MICROCODE_SIZE = 200;
export const SLOTS = MICROCODE_SIZE / 10;

/** Wo ein Mikrobefehl in der Oberfläche „wirkt“ – steuert Farbe und Platzierung. */
export type MicroGroup = 'ram' | 'acc' | 'ins' | 'pc' | 'mc' | 'halt';

export interface MicroInfo {
  /** Originalnummer im Mikrocode */
  code: number;
  /** ASCII-Schlüssel, z. B. für Inhaltsdateien: "ram->db" */
  key: string;
  /** Beschriftung wie im Original, mit Pfeil */
  label: string;
  /** Deutsche Kurzbeschreibung */
  de: string;
  /** Ausführliche Erklärung */
  info: string;
  group: MicroGroup;
}

export const MICRO_LIST: MicroInfo[] = [
  { code: 2, key: 'ram->db', label: 'ram→db', de: 'Speicher → Datenbus', group: 'ram',
    info: 'Die Speicherzelle, deren Adresse auf dem Adressbus liegt, wird gelesen. Ihr Inhalt wird auf den Datenbus gelegt.' },
  { code: 1, key: 'db->ram', label: 'db→ram', de: 'Datenbus → Speicher', group: 'ram',
    info: 'Die Zahl auf dem Datenbus wird in die Speicherzelle geschrieben, deren Adresse auf dem Adressbus liegt. Der alte Inhalt ist danach weg.' },
  { code: 18, key: 'db->acc', label: 'db→acc', de: 'Datenbus → Akkumulator', group: 'acc',
    info: 'Die Zahl auf dem Datenbus wird in den Akkumulator kopiert.' },
  { code: 15, key: 'acc->db', label: 'acc→db', de: 'Akkumulator → Datenbus', group: 'acc',
    info: 'Der Inhalt des Akkumulators wird auf den Datenbus gelegt.' },
  { code: 13, key: 'plus', label: 'plus', de: 'Akku + Datenbus', group: 'acc',
    info: 'Das Rechenwerk addiert die Zahl auf dem Datenbus zum Akkumulator. Das Ergebnis steht im Akkumulator (höchstens 19999).' },
  { code: 14, key: 'minus', label: 'minus', de: 'Akku − Datenbus', group: 'acc',
    info: 'Das Rechenwerk subtrahiert die Zahl auf dem Datenbus vom Akkumulator. Johnny kennt keine negativen Zahlen: Das Ergebnis ist mindestens 0.' },
  { code: 12, key: 'acc:=0', label: 'acc:=0', de: 'Akkumulator auf 0', group: 'acc',
    info: 'Der Akkumulator wird auf 0 gesetzt.' },
  { code: 16, key: 'acc++', label: 'acc++', de: 'Akkumulator + 1', group: 'acc',
    info: 'Der Akkumulator wird um 1 erhöht (höchstens 19999).' },
  { code: 17, key: 'acc--', label: 'acc--', de: 'Akkumulator − 1', group: 'acc',
    info: 'Der Akkumulator wird um 1 verringert (mindestens 0).' },
  { code: 3, key: 'db->ins', label: 'db→ins', de: 'Datenbus → Befehlsregister', group: 'ins',
    info: 'Die Zahl auf dem Datenbus wird ins Befehlsregister übernommen. Dort wird sie als Befehl gedeutet: vorne der Opcode, hinten die Adresse.' },
  { code: 4, key: 'ins->ab', label: 'ins→ab', de: 'Adressteil → Adressbus', group: 'ins',
    info: 'Der Adressteil des Befehls (die letzten drei Ziffern) wird auf den Adressbus gelegt.' },
  { code: 11, key: 'ins->pc', label: 'ins→pc', de: 'Adressteil → Programmzähler', group: 'ins',
    info: 'Der Adressteil des Befehls wird in den Programmzähler geschrieben. So entsteht ein Sprung.' },
  { code: 5, key: 'ins->mc', label: 'ins→mc', de: 'Opcode → Mikroprogrammzähler', group: 'ins',
    info: 'Der Opcode (die ersten beiden Ziffern) wird mal 10 genommen und in den Mikroprogrammzähler geschrieben. Das Steuerwerk springt so an den Anfang des passenden Mikroprogramms.' },
  { code: 8, key: 'pc->ab', label: 'pc→ab', de: 'Programmzähler → Adressbus', group: 'pc',
    info: 'Die Adresse im Programmzähler wird auf den Adressbus gelegt. Damit wird die Zelle mit dem nächsten Befehl ausgewählt.' },
  { code: 9, key: 'pc++', label: 'pc++', de: 'Programmzähler + 1', group: 'pc',
    info: 'Der Programmzähler wird um 1 erhöht. Er zeigt jetzt auf die nächste Speicherzelle.' },
  { code: 10, key: '=0:pc++', label: '=0:pc++', de: 'Wenn Akku = 0: Programmzähler + 1', group: 'pc',
    info: 'Nur wenn der Akkumulator 0 ist, wird der Programmzähler um 1 erhöht. Das ist die einzige bedingte Operation von Johnny.' },
  { code: 7, key: 'mc:=0', label: 'mc:=0', de: 'Mikroprogrammzähler auf 0', group: 'mc',
    info: 'Der Mikroprogrammzähler wird auf 0 gesetzt. Das Steuerwerk beginnt wieder mit FETCH, also mit dem Holen des nächsten Befehls.' },
  { code: 19, key: 'stopp', label: 'stopp', de: 'Anhalten', group: 'halt',
    info: 'Johnny hält an. Das Programm ist beendet.' },
];

export const MICRO_BY_CODE: Record<number, MicroInfo> = Object.fromEntries(
  MICRO_LIST.map((m) => [m.code, m]),
);
export const MICRO_BY_KEY: Record<string, MicroInfo> = Object.fromEntries(
  MICRO_LIST.map((m) => [m.key, m]),
);

export function isMicroCode(n: number): boolean {
  return n in MICRO_BY_CODE;
}

/** Aus einer lesbaren Liste von Mikrobefehlen ein Mikroprogramm (200 Zellen + Namen) bauen. */
function build(slots: Record<number, { name: string; ops: string[] }>): { microcode: number[]; names: string[] } {
  const microcode = new Array<number>(MICROCODE_SIZE).fill(0);
  const names = new Array<string>(SLOTS).fill('');
  for (const [slotStr, { name, ops }] of Object.entries(slots)) {
    const slot = Number(slotStr);
    names[slot] = name;
    ops.forEach((key, i) => {
      const info = MICRO_BY_KEY[key];
      if (!info) throw new Error(`Unbekannter Mikrobefehl ${key}`);
      microcode[slot * 10 + i] = info.code;
    });
  }
  return { microcode, names };
}

const FETCH = { name: 'FETCH', ops: ['pc->ab', 'ram->db', 'db->ins', 'ins->mc'] };

export const STANDARD = build({
  0: FETCH,
  1: { name: 'TAKE', ops: ['ins->ab', 'ram->db', 'db->acc', 'pc++', 'mc:=0'] },
  2: { name: 'ADD', ops: ['ins->ab', 'ram->db', 'plus', 'pc++', 'mc:=0'] },
  3: { name: 'SUB', ops: ['ins->ab', 'ram->db', 'minus', 'pc++', 'mc:=0'] },
  4: { name: 'SAVE', ops: ['ins->ab', 'acc->db', 'db->ram', 'pc++', 'mc:=0'] },
  5: { name: 'JMP', ops: ['ins->pc', 'mc:=0'] },
  6: { name: 'TST', ops: ['ins->ab', 'ram->db', 'db->acc', '=0:pc++', 'pc++', 'mc:=0'] },
  7: { name: 'INC', ops: ['ins->ab', 'ram->db', 'db->acc', 'acc++', 'acc->db', 'db->ram', 'pc++', 'mc:=0'] },
  8: { name: 'DEC', ops: ['ins->ab', 'ram->db', 'db->acc', 'acc--', 'acc->db', 'db->ram', 'pc++', 'mc:=0'] },
  9: { name: 'NULL', ops: ['ins->ab', 'acc:=0', 'acc->db', 'db->ram', 'pc++', 'mc:=0'] },
  10: { name: 'HLT', ops: ['stopp', 'mc:=0'] },
});

export const BONSAI = build({
  0: FETCH,
  1: { name: 'INC', ops: ['ins->ab', 'ram->db', 'db->acc', 'acc++', 'acc->db', 'db->ram', 'pc++', 'mc:=0'] },
  2: { name: 'DEC', ops: ['ins->ab', 'ram->db', 'db->acc', 'acc--', 'acc->db', 'db->ram', 'pc++', 'mc:=0'] },
  3: { name: 'JMP', ops: ['ins->pc', 'mc:=0'] },
  4: { name: 'TST', ops: ['ins->ab', 'ram->db', 'db->acc', '=0:pc++', 'pc++', 'mc:=0'] },
  5: { name: 'HLT', ops: ['stopp', 'mc:=0'] },
});

export type Mode = 'normal' | 'bonsai';

export function microprogramFor(mode: Mode) {
  const src = mode === 'bonsai' ? BONSAI : STANDARD;
  return { microcode: [...src.microcode], names: [...src.names] };
}

/** Kurze Beschreibung der Makrobefehle für Hilfen und Tabellen. */
export const MACRO_INFO: Record<string, { de: string; hinweis?: string }> = {
  FETCH: { de: 'Holt den nächsten Befehl aus dem Speicher ins Befehlsregister und springt zu dessen Mikroprogramm.' },
  TAKE: { de: 'Kopiert den Inhalt der Zelle in den Akkumulator.' },
  ADD: { de: 'Addiert den Inhalt der Zelle zum Akkumulator.' },
  SUB: { de: 'Subtrahiert den Inhalt der Zelle vom Akkumulator (Ergebnis mindestens 0).' },
  SAVE: { de: 'Speichert den Akkumulator in der Zelle.' },
  JMP: { de: 'Springt zur angegebenen Adresse: Der nächste Befehl wird von dort geholt.' },
  TST: { de: 'Ist die Zelle 0, wird der nächste Befehl übersprungen.', hinweis: 'Überschreibt den Akkumulator mit dem Zellinhalt!' },
  INC: { de: 'Erhöht den Inhalt der Zelle um 1.', hinweis: 'Überschreibt den Akkumulator!' },
  DEC: { de: 'Verringert den Inhalt der Zelle um 1 (mindestens 0).', hinweis: 'Überschreibt den Akkumulator!' },
  NULL: { de: 'Setzt die Zelle auf 0.', hinweis: 'Setzt auch den Akkumulator auf 0!' },
  HLT: { de: 'Hält das Programm an.' },
};
