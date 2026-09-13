---
nummer: 10
titel: Sprünge
kurz: JMP verändert den Programmzähler – Schleifen entstehen.
leitfrage: Wie kann ein Programm etwas wiederholen?
sichtbar: [ram, ab, db, acc, ins, pc, mc, microcode, log]
funktionen: [ramEdit, asm, microStep, macroStep, run, reset]
programm: |
  000: INC 100
  JMP 000
zellen:
  "100": Zähler
schritte:
  - typ: info
    titel: Springen
    text: |
      **JMP** *adr* („jump“) setzt den Programmzähler auf *adr*. Der nächste Befehl wird also von dort geholt.
      Im Mikrocode ist das ganz kurz: `ins→pc`, `mc:=0`.

      **INC** *adr* erhöht den Inhalt einer Zelle um 1.

      Im Speicher steht ein kleines Programm:
      `000: INC 100` und `001: JMP 000`.
  - typ: vorhersage
    frage: Welcher Wert steht nach **6 Makroschritten** in Zelle 100?
    antwort: 3
    erklaerung: "INC, JMP, INC, JMP, INC, JMP – drei Erhöhungen."
  - typ: aktion
    text: |
      Starte das Programm mit **Ausführen**. Halte es mit **Pause** an, sobald der Zähler mindestens **20** erreicht hat.
    ziel:
      ramMin: { "100": 20 }
    tipp: Drehe den Geschwindigkeitsregler auf „schnell“, dann dauert es nicht so lange.
    erfolg: Ohne Pause würde Johnny ewig weiterzählen – eine **Endlosschleife**.
    loesung: ["ausfuehren"]
  - typ: vorhersage
    frage: Wie viele Mikrobefehle hat das Rezept für **JMP**?
    antwort: 2
    erklaerung: "`ins→pc` und `mc:=0`. Kein `pc++` – der Programmzähler wurde ja gerade gezielt gesetzt."
  - typ: aktion
    vorbereitung:
      reset: true
      programm: |
        000: 0
        NULL 100
        INC 100
        HLT
        100: 5
    text: |
      Neues Programm: In Zelle 001 steht **NULL 100** – das würde den Zähler löschen.
      Schreibe in Zelle **000** einen Befehl, der den NULL-Befehl **überspringt**.
    ziel:
      tests:
        - ein: { "100": 5 }
          aus: { "100": 6 }
        - ein: { "100": 41 }
          aus: { "100": 42 }
    tipp: Springe direkt zu dem Befehl, der nach NULL kommt.
    loesung: ["ram 000 = JMP 002"]
  - typ: quiz
    frage: Warum hört das Zähler-Programm vom Anfang nie von allein auf?
    optionen:
      - "Weil JMP 000 immer wieder zum Anfang springt und kein HLT erreicht wird."
      - "Weil INC den Programmzähler verändert."
      - "Weil Zelle 100 zu groß wird."
    richtig: 0
    erklaerung: Es fehlt eine **Bedingung**, die die Schleife beendet. Genau die liefert der nächste Befehl.
  - typ: info
    titel: Merke
    text: |
      - **JMP** setzt den Programmzähler – das Programm läuft an einer anderen Stelle weiter.
      - Ein Sprung zurück erzeugt eine **Schleife**, ohne Abbruch eine **Endlosschleife**.
      - Johnny hält beim Ausführen automatisch an, wenn sich der Programmzähler nicht mehr ändert (z. B. `JMP` auf sich selbst).
---
