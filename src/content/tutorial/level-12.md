---
nummer: 12
titel: Befehle oder Daten?
kurz: Der Kern der Von-Neumann-Idee – mit allen Chancen und Risiken.
leitfrage: Was passiert, wenn die CPU Daten für Befehle hält – und umgekehrt?
sichtbar: [ram, ab, db, acc, ins, pc, mc, log]
funktionen: [ramEdit, asm, microStep, macroStep, run, reset]
programm: |
  000: TAKE 003
  ADD 004
  SAVE 005
  1004
  4
  0
schritte:
  - typ: info
    titel: Ein Speicher für alles
    text: |
      Bei Von Neumann liegen Programm und Daten im **selben Speicher**. Die CPU kann sie nicht auseinanderhalten.
      Allein der **Programmzähler** entscheidet: *Worauf er zeigt, wird als Befehl ausgeführt.*

      Im Speicher steht ein Programm, dem das **HLT fehlt**. Direkt dahinter liegen die Daten:
      Zelle 003 = 1004, Zelle 004 = 4, Zelle 005 = 0 (für das Ergebnis).
  - typ: vorhersage
    frage: |
      Nach TAKE 003, ADD 004 und SAVE 005 steht der Programmzähler auf **003**. Dort steht `01.004` –
      eigentlich als Zahl 1004 gedacht. Was steht nach dem **nächsten** Makroschritt im Akkumulator?
    antwort: 4
    erklaerung: "Johnny liest 01.004 als **TAKE 004** und holt die 4 in den Akku. Die Zahl wurde zum Befehl!"
  - typ: aktion
    text: |
      Führe das Programm mit **Ausführen** aus und lies die Meldung über der Speichertabelle.
    ziel:
      pc: 4
      acc: 4
      ram: { "5": 1008 }
    loesung: ["ausfuehren"]
  - typ: quiz
    frage: Warum bleibt Johnny bei Zelle 004 hängen?
    optionen:
      - "In Zelle 004 steht 00.004. Opcode 00 hat kein eigenes Rezept: Johnny holt die Zelle immer wieder, der Programmzähler ändert sich nie."
      - "Zelle 004 ist schreibgeschützt."
      - "Johnny erkennt, dass dort eine Zahl steht, und hält ordnungsgemäß an."
    richtig: 0
    erklaerung: Die CPU „erkennt“ gar nichts. Sie folgt stur dem Programmzähler.
  - typ: info
    titel: Programme, die sich selbst verändern
    vorbereitung:
      reset: true
      programm: |
        000: INC 001
        TAKE 010
        HLT
        010: 5
        8
    text: |
      Wenn Befehle Zahlen sind, kann ein Programm **seine eigenen Befehle verändern**.
      Neues Programm im Speicher:

      ```
      000: INC 001
      001: TAKE 010
      002: HLT
      010: 5
      011: 8
      ```
  - typ: vorhersage
    frage: Was steht am Ende im **Akkumulator**?
    antwort: 8
    erklaerung: "INC 001 macht aus `01.010` (TAKE 010) die Zahl `01.011` – also **TAKE 011**. Geholt wird die 8."
  - typ: aktion
    text: |
      Überprüfe deine Vorhersage mit **Ausführen**.
    ziel:
      halted: true
      acc: 8
    loesung: ["ausfuehren"]
  - typ: quiz
    frage: Welche Folgen hat es, dass Befehle und Daten im selben Speicher liegen?
    optionen:
      - "Programme können wie Daten geladen, gespeichert und ausgetauscht werden."
      - "Durch einen Fehler können Daten als Befehle ausgeführt werden."
      - "Die CPU erkennt Befehle an einer besonderen Markierung."
      - "Programme können sich selbst verändern."
    richtig: [0, 1, 3]
    erklaerung: |
      Das macht den Computer **frei programmierbar** – eine Maschine für alle Aufgaben. Es ist aber auch ein Risiko:
      Viele Sicherheitslücken (z. B. *Buffer Overflows*) schleusen Daten ein, die dann als Befehle ausgeführt werden.
      Moderne Systeme markieren deshalb Speicherbereiche als „nicht ausführbar“.
  - typ: info
    titel: Merke
    text: |
      - Im Von-Neumann-Speicher sind **Befehle und Daten nicht unterscheidbar**.
      - Nur der **Programmzähler** bestimmt, was als Befehl ausgeführt wird.
      - **Vorteil:** frei programmierbar, flexibel. **Nachteil:** Fehler und Angriffe können Daten zu Befehlen machen.
      - Die **Harvard-Architektur** trennt Befehls- und Datenspeicher (z. B. in vielen Mikrocontrollern).
---
