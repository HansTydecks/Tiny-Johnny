---
nummer: 14
titel: Neue Befehle erfinden
kurz: Mikrocode aufnehmen und der Bonsai-Modus.
leitfrage: Kann man einer CPU neue Befehle beibringen – oder mit weniger Befehlen auskommen?
vertiefung: true
sichtbar: [ram, ab, db, acc, ins, pc, mc, microcode, log]
funktionen: [ramEdit, asm, microStep, macroStep, run, reset, record, bonsai, controlToggle]
mikro: alle
programm: |
  000: 11100
  HLT
  100: 21
zellen:
  "100": Zahl
schritte:
  - typ: info
    titel: Ein Befehl zum Verdoppeln
    text: |
      In Zelle 000 steht `11.100`. Einen Befehl mit Opcode **11** gibt es nicht – noch nicht!

      Wir erfinden **DBL** („double“): *Verdopple den Inhalt einer Zelle.* Das Rezept:

      `ins→ab`, `ram→db`, `db→acc`, `plus`, `acc→db`, `db→ram`, `pc++`, `mc:=0`

      Unten im Mikrocode-Bereich gibt es die **Aufnahme**: Du wählst einen Platz und einen Namen,
      startest die Aufnahme und klickst die Mikrobefehle der Reihe nach an.
  - typ: quiz
    frage: Warum muss am Ende des Rezepts `mc:=0` stehen?
    optionen:
      - "Damit danach wieder FETCH ausgeführt und der nächste Befehl geholt wird."
      - "Damit der Akku gelöscht wird."
      - "Damit der Befehl gespeichert wird."
    richtig: 0
    erklaerung: Ohne `mc:=0` würde das Steuerwerk einfach im Mikrocode weiterlaufen – in einen leeren Bereich.
  - typ: aktion
    text: |
      Nimm den Befehl **DBL** mit Opcode **11** auf und beende die Aufnahme.
      Klicke dann auf **Befehl prüfen** – getestet wird das Programm `DBL 100`, `HLT` mit verschiedenen Zahlen.
    ziel:
      befehl: { name: DBL }
      programm: |
        000: 11100
        HLT
      tests:
        - ein: { "100": 21 }
          aus: { "100": 42 }
        - ein: { "100": 500 }
          aus: { "100": 1000 }
    tipp: |
      Platz `11` wählen, Name `DBL`, **Aufnahme starten**. Dann nacheinander anklicken:
      `ins→ab`, `ram→db`, `db→acc`, `plus`, `acc→db`, `db→ram`, `pc++`, `mc:=0` – und **Aufnahme beenden**.
      Keine Sorge: Die Klicks verändern dabei Register und Speicher. Im nächsten Schritt wird alles wiederhergestellt.
    loesung: ["aufnahme 11 DBL", "micro ins->ab", "micro ram->db", "micro db->acc", "micro plus", "micro acc->db", "micro db->ram", "micro pc++", "micro mc:=0", "aufnahme ende"]
  - typ: aktion
    vorbereitung:
      reset: true
      programm: |
        000: 11100
        HLT
        100: 21
    text: |
      Speicher und Register sind wiederhergestellt: In Zelle 000 steht `DBL 100`, in Zelle 100 die **21**.
      Lass das Programm mit **Ausführen** laufen.
    ziel:
      halted: true
      ram: { "100": 42 }
    loesung: ["ausfuehren"]
  - typ: info
    titel: Weniger ist mehr – der Bonsai-Computer
    text: |
      Braucht man überhaupt so viele Befehle? Der **Bonsai-Computer** kommt mit **fünf** aus:

      | Opcode | Befehl |
      |---|---|
      | 01 | INC |
      | 02 | DEC |
      | 03 | JMP |
      | 04 | TST |
      | 05 | HLT |

      Keine Addition, kein TAKE, kein SAVE. Und trotzdem lässt sich damit **alles** berechnen –
      man braucht nur mehr Befehle und mehr Zeit.
  - typ: aktion
    text: |
      Schalte in den **Bonsai-Modus** (**Mehr → Bonsai-Modus**).
    ziel:
      modus: bonsai
    loesung: ["modus bonsai"]
  - typ: aktion
    vorbereitung:
      ramLeeren: true
      reset: true
      ram: { "100": 4, "101": 3 }
    text: |
      Schreibe im Bonsai-Modus ein Programm, das den Inhalt von Zelle **101** zu Zelle **100** addiert.
      (Zelle 101 darf dabei 0 werden.)
    ziel:
      modus: bonsai
      tests:
        - ein: { "100": 4, "101": 3 }
          aus: { "100": 7 }
        - ein: { "100": 10, "101": 0 }
          aus: { "100": 10 }
        - ein: { "100": 0, "101": 25 }
          aus: { "100": 25 }
    tipp: |
      Wie in Mission 11: `TST 101`, `JMP 003`, `HLT`, dann `DEC 101`, `INC 100`, `JMP 000`.
      Achtung – im Bonsai-Modus haben die Befehle andere Opcodes. Wähle sie im Auswahlfeld aus.
    loesung: ["ram 000 = TST 101", "ram 001 = JMP 003", "ram 002 = HLT", "ram 003 = DEC 101", "ram 004 = INC 100", "ram 005 = JMP 000"]
  - typ: info
    titel: Merke & Ausblick
    text: |
      - Johnnys Befehlssatz ist **im Mikrocode festgelegt** und lässt sich erweitern.
      - Echte Prozessoren unterscheiden **CISC** (viele, mächtige Befehle, oft mikroprogrammiert) und
        **RISC** (wenige, einfache Befehle, fest verdrahtet, sehr schnell).
      - Schon fünf Befehle genügen, um im Prinzip alles zu berechnen.

      **Glückwunsch – du kennst jetzt jedes Detail von Johnny!** Weiter geht es mit den **Aufgaben**.
---
