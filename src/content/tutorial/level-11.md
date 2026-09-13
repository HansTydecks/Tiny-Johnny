---
nummer: 11
titel: Entscheidungen mit TST
kurz: Die einzige Bedingung von Johnny – und ihre Tücken.
leitfrage: Wie kann ein Programm selbst entscheiden, ob es weitermacht oder aufhört?
sichtbar: [ram, ab, db, acc, ins, pc, mc, microcode, log]
funktionen: [ramEdit, asm, microStep, macroStep, run, reset]
programm: |
  000: TST 100
  JMP 003
  HLT
  DEC 100
  JMP 000
  100: 3
zellen:
  "100": Zähler
  "101": Summe
schritte:
  - typ: info
    titel: Testen auf null
    text: |
      **TST** *adr* prüft, ob in der Zelle eine **0** steht. Wenn ja, wird der **nächste Befehl übersprungen**.

      Das Rezept: `ins→ab`, `ram→db`, `db→acc`, `=0:pc++`, `pc++`, `mc:=0`

      Der Mikrobefehl `=0:pc++` erhöht den Programmzähler **nur, wenn der Akku 0 ist**.
      Das ist die einzige Stelle, an der Johnny etwas „entscheidet“!

      Typisches Muster:
      ```
      TST zähler   ; ist der Zähler 0?
      JMP weiter   ; nein → weitermachen
      HLT          ; ja → fertig
      ```
  - typ: vorhersage
    frage: Zelle 100 enthält **3**, der Programmzähler steht auf 000 (TST 100). Welche Adresse steht nach diesem Makroschritt im Programmzähler?
    antwort: 1
    erklaerung: 3 ist nicht 0 → nur ein `pc++` → 001. Dort steht JMP 003.
  - typ: vorhersage
    frage: Und wenn in Zelle 100 eine **0** stünde?
    antwort: 2
    erklaerung: "Der Akku wäre 0 → `=0:pc++` **und** `pc++` → 002. JMP 003 wird übersprungen, Johnny landet beim HLT."
  - typ: aktion
    text: |
      Führe das Programm aus (Makroschritte oder Ausführen), bis es anhält. Beobachte den Programmzähler!
    ziel:
      halted: true
      ram: { "100": 0 }
    loesung: ["ausfuehren"]
  - typ: vorhersage
    frage: Wie oft wurde der Befehl **DEC 100** ausgeführt?
    antwort: 3
    erklaerung: Der Zähler lief 3 → 2 → 1 → 0. Danach hat TST das JMP übersprungen.
  - typ: aktion
    vorbereitung:
      ram: { "100": 3 }
    text: |
      Erweitere das Programm: Bei jedem Durchlauf soll zusätzlich Zelle **101** um 1 erhöht werden.
      Am Ende gilt dann: **Summe = alte Summe + Zähler**.
    ziel:
      tests:
        - ein: { "100": 3, "101": 4 }
          aus: { "100": 0, "101": 7 }
        - ein: { "100": 0, "101": 9 }
          aus: { "101": 9 }
        - ein: { "100": 10, "101": 0 }
          aus: { "101": 10 }
    tipp: |
      Füge nach `DEC 100` (Zelle 003) ein `INC 101` ein. Dann rutscht der Sprung zurück eine Zelle nach unten.
    erfolg: Du hast eine Addition nur mit Zählen gebaut – ohne ADD!
    loesung: ["ram 004 = INC 101", "ram 005 = JMP 000"]
  - typ: quiz
    frage: |
      Ein Programm beginnt so: `TAKE 102`, `TST 100`, `JMP 005`, … Was steht **nach TST** im Akkumulator?
    optionen:
      - "Der Inhalt von Zelle 100 – TST überschreibt den Akku."
      - "Weiterhin der Inhalt von Zelle 102."
      - "Immer 0."
    richtig: 0
    erklaerung: |
      Achtung, Stolperfalle! TST holt die Zelle mit `db→acc` in den Akku. Genauso überschreiben **INC**, **DEC** und **NULL**
      den Akkumulator. Ein Zwischenergebnis im Akku muss man vorher mit SAVE sichern.
  - typ: info
    titel: Merke
    text: |
      - **TST** überspringt den nächsten Befehl, wenn die Zelle 0 ist.
      - Schleife mit Abbruch: `TST` → `JMP weiter` → `HLT`.
      - TST, INC, DEC und NULL **überschreiben den Akkumulator**.
      - Mit Sprüngen und einer Bedingung kann Johnny im Prinzip **alles berechnen**, was ein moderner Computer berechnen kann –
        nur langsamer und mit weniger Speicher.
---
