/**
 * Kleine Befehlssprache, um Bedienschritte am Simulator zu beschreiben.
 * Wird genutzt, um Lösungswege der Tutorial-Missionen automatisch zu testen.
 *
 *   ram 010 = 7        Zelle beschreiben (auch „ram 000 = TAKE 010“ oder „01.010“)
 *   ab = 10            Adressbus von Hand setzen
 *   db = 7             Datenbus von Hand setzen
 *   micro ram->db      Mikrobefehl ausführen
 *   mikroschritt       einen Mikroschritt
 *   makroschritt       einen Makroschritt
 *   ausfuehren         laufen lassen bis Halt
 *   reset              Register zurücksetzen
 *   modus bonsai       Mikroprogramm wechseln
 *   aufnahme 11 DBL    Aufnahme starten
 *   aufnahme ende      Aufnahme beenden
 */
import { parseValue } from './assembler';
import type { Johnny } from './engine';

export function applyAction(j: Johnny, action: string): void {
  const a = action.trim();
  let m: RegExpExecArray | null;
  if ((m = /^ram\s+(\d{1,3})\s*=\s*(.+)$/i.exec(a))) {
    const v = parseValue(m[2], j.names);
    if (typeof v === 'string') throw new Error(`${action}: ${v}`);
    j.writeRam(Number(m[1]), v);
  } else if ((m = /^ab\s*=\s*(\d+)$/i.exec(a))) j.setAb(Number(m[1]));
  else if ((m = /^db\s*=\s*(\d+)$/i.exec(a))) j.setDb(Number(m[1]));
  else if ((m = /^micro\s+(\S+)$/i.exec(a))) j.exec(m[1]);
  else if (/^mikroschritt$/i.test(a)) j.microStep();
  else if (/^makroschritt$/i.test(a)) j.macroStep();
  else if (/^ausfuehren$/i.test(a)) j.run();
  else if (/^reset$/i.test(a)) j.reset();
  else if ((m = /^modus\s+(normal|bonsai)$/i.exec(a))) j.setMode(m[1].toLowerCase() as 'normal' | 'bonsai');
  else if (/^aufnahme\s+ende$/i.test(a)) j.stopRecording();
  else if ((m = /^aufnahme\s+(\d+)\s+(\S+)$/i.exec(a))) j.startRecording(Number(m[1]), m[2]);
  else throw new Error(`Unbekannte Aktion: ${action}`);
}
