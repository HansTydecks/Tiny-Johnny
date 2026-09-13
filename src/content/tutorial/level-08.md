---
nummer: 8
titel: Programmzähler & FETCH
kurz: Der Von-Neumann-Zyklus – Johnny arbeitet ein Programm selbstständig ab.
leitfrage: Woher weiß die CPU, welcher Befehl als Nächstes dran ist?
sichtbar: [ram, ab, db, acc, ins, pc, mc, microcode, log]
funktionen: [microStep, macroStep]
programm: |
  000: TAKE 010
  ADD 011
  SAVE 012
  HLT
  010: 7
  3
zellen:
  "10": a
  "11": b
  "12": Summe
schritte:
  - typ: info
    titel: Der Programmzähler
    text: |
      Der **Programmzähler** (`pc`, auch *Befehlszähler*) enthält die **Adresse des nächsten Befehls**.
      Nach einem Reset steht er auf 000 – dort beginnt jedes Programm.

      Zwei neue Mikrobefehle:
      - `pc→ab` – Adresse aus dem Programmzähler auf den Adressbus legen
      - `pc++` – Programmzähler um 1 erhöhen

      Jetzt verstehst du auch das `pc++` am Ende jedes Rezepts: Nach dem Befehl zeigt der Programmzähler
      auf die **nächste Zelle**.
  - typ: quiz
    frage: Befehlsregister und Programmzähler – was stimmt?
    optionen:
      - "Der Programmzähler enthält die Adresse des nächsten Befehls, das Befehlsregister den aktuellen Befehl selbst."
      - "Beide enthalten den aktuellen Befehl."
      - "Das Befehlsregister zählt, wie viele Befehle schon ausgeführt wurden."
    richtig: 0
    erklaerung: Wichtiger Unterschied! Programmzähler = **wo** steht der nächste Befehl. Befehlsregister = **welcher** Befehl wird gerade ausgeführt.
  - typ: info
    titel: FETCH – das Rezept bei 000
    text: |
      Im Mikrocode steht bei 000–003 das Rezept **FETCH** („holen“):

      1. `pc→ab` – Adresse des nächsten Befehls anlegen
      2. `ram→db` – Befehl lesen
      3. `db→ins` – Befehl ins Befehlsregister
      4. `ins→mc` – zum Rezept des Befehls springen

      Jedes Rezept endet mit `mc:=0` – und dann kommt wieder FETCH. **Johnny läuft im Kreis.**
  - typ: aktion
    text: |
      Führe mit **Mikroschritt** die vier FETCH-Schritte aus.
    ziel:
      ins: 1010
      mc: 10
    erfolg: Der Befehl TAKE 010 wurde geholt, und der Mikroprogrammzähler zeigt auf das TAKE-Rezept.
    loesung: ["mikroschritt", "mikroschritt", "mikroschritt", "mikroschritt"]
  - typ: vorhersage
    frage: Wenn der TAKE-Befehl fertig ist – welche Adresse steht dann im **Programmzähler**?
    antwort: 1
    erklaerung: "`pc++` erhöht ihn von 000 auf 001. Dort steht der nächste Befehl: ADD 011."
  - typ: aktion
    text: |
      Arbeite den TAKE-Befehl mit Mikroschritten zu Ende.
    ziel:
      mc: 0
      pc: 1
      acc: 7
    loesung: ["mikroschritt", "mikroschritt", "mikroschritt", "mikroschritt", "mikroschritt"]
  - typ: info
    titel: Makroschritt
    text: |
      Ein **Makroschritt** erledigt einen ganzen Befehl auf einmal: FETCH und das Rezept – so lange,
      bis der Mikroprogrammzähler wieder auf 000 steht.
  - typ: vorhersage
    frage: Der nächste Befehl ist **ADD 011**. Was steht nach dem Makroschritt im Akkumulator?
    antwort: 10
    erklaerung: 7 + 3 = 10.
  - typ: aktion
    text: |
      Drücke **Makroschritt**.
    ziel:
      pc: 2
      acc: 10
    loesung: ["makroschritt"]
  - typ: vorhersage
    frage: Nächster Befehl **SAVE 012**. Was steht nach dem Makroschritt in Zelle **012**?
    antwort: 10
    erklaerung: SAVE schreibt den Akku (10) in Zelle 012.
  - typ: aktion
    text: |
      Führe das Programm mit Makroschritten zu Ende, bis Johnny beim **HLT** anhält.
    ziel:
      halted: true
      ram: { "12": 10 }
    loesung: ["makroschritt", "makroschritt"]
  - typ: vorhersage
    frage: |
      Jeder Befehl braucht 4 Takte für FETCH. TAKE, ADD und SAVE haben je 5 Mikrobefehle, HLT hat 2.
      Wie viele **Takte** braucht das ganze Programm (4 Befehle)?
    antwort: 33
    einheit: Takte
    erklaerung: "4 × 4 (FETCH) + 5 + 5 + 5 + 2 = 33 Takte. Der Zähler in der Werkzeugleiste zählt mit."
  - typ: info
    titel: Merke – der Von-Neumann-Zyklus
    text: |
      1. **Holen** (FETCH): Befehl von der Adresse im Programmzähler ins Befehlsregister
      2. **Decodieren**: `ins→mc` wählt das passende Rezept
      3. **Ausführen**: das Rezept arbeitet – mit Daten, Rechenwerk und Speicher
      4. `pc++` und `mc:=0` – weiter mit dem nächsten Befehl

      Das ist die Antwort auf die große Frage: **Der Computer weiß, was er tun soll, weil er Befehl für Befehl
      aus dem Speicher holt – der Programmzähler zeigt ihm, wo.**
---
