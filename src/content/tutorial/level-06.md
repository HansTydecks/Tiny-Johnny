---
nummer: 6
titel: Befehle sind Zahlen
kurz: Opcode und Adresse – das Befehlsregister.
leitfrage: Wie kann eine Zahl im Speicher der CPU sagen, was sie tun soll?
sichtbar: [ram, ab, db, acc, ins, log]
funktionen: [abInput, dbInput]
mikro: [ram->db, db->ram, db->acc, acc->db, plus, minus, acc:=0, acc++, acc--, db->ins, ins->ab]
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
  "12": Ergebnis
schritte:
  - typ: info
    titel: Die geniale Idee
    text: |
      John von Neumann hatte 1945 die entscheidende Idee: **Das Programm steht ebenfalls im Speicher** –
      als ganz normale Zahlen, genau wie die Daten.

      Bei Johnny wird eine 5-stellige Zahl so gelesen:

      | `01` | `.` | `010` |
      |---|---|---|
      | **Opcode** – welcher Befehl? | | **Adresse** – mit welcher Zelle? |

      | Opcode | Befehl | Bedeutung |
      |---|---|---|
      | 01 | TAKE | Zelle in den Akku holen |
      | 02 | ADD | Zelle zum Akku addieren |
      | 03 | SUB | Zelle vom Akku subtrahieren |
      | 04 | SAVE | Akku in Zelle speichern |
      | 05 | JMP | springen |
      | 06 | TST | testen, ob Zelle 0 ist |
      | 07 | INC | Zelle + 1 |
      | 08 | DEC | Zelle − 1 |
      | 09 | NULL | Zelle := 0 |
      | 10 | HLT | anhalten |

      Die Wörter TAKE, ADD … heißen **Assembler** – sie sind nur Namen für die Zahlen.
      In der Speichertabelle siehst du sie in der Spalte „Bedeutung“.
  - typ: quiz
    frage: Was bedeutet der Speicherinhalt **02.011**?
    optionen:
      - "ADD 011: Addiere den Inhalt von Zelle 011 zum Akku."
      - "Addiere die Zahl 11 zum Akku."
      - "Speichere die 2 in Zelle 011."
    richtig: 0
    erklaerung: Opcode 02 = ADD, Adresse 011. Achtung – es wird nicht die Zahl 11 addiert, sondern der **Inhalt** der Zelle 011.
  - typ: vorhersage
    frage: Welche Zahl steht im Speicher für den Befehl **SAVE 012**? (Ohne Punkt eingeben.)
    antwort: 4012
    erklaerung: SAVE hat den Opcode 04, dazu die Adresse 012 → `04.012` = 4012.
  - typ: info
    titel: Das Befehlsregister
    text: |
      Um einen Befehl auszuführen, kopiert die CPU ihn aus dem Speicher in ein eigenes Register im Steuerwerk:
      das **Befehlsregister** (`ins`, von *instruction*). Dort wird die Zahl in **Opcode** und **Adresse** zerlegt.

      - `db→ins` – Datenbus ins Befehlsregister
      - `ins→ab` – den **Adressteil** des Befehls auf den Adressbus legen
  - typ: aktion
    text: |
      Hole den Befehl aus Zelle **000** in das Befehlsregister.
    ziel:
      ins: 1010
      benutzt: [db->ins]
    tipp: Adresse 000 anlegen → `ram→db` → `db→ins`.
    loesung: ["ab = 0", "micro ram->db", "micro db->ins"]
  - typ: aktion
    text: |
      Im Befehlsregister steht **TAKE 010**. Führe diesen Befehl jetzt von Hand aus.
      Nutze `ins→ab`, damit du die Adresse nicht selbst eintippen musst.
    ziel:
      acc: 7
      benutzt: [ins->ab]
    loesung: ["micro ins->ab", "micro ram->db", "micro db->acc"]
  - typ: aktion
    text: |
      Hole den nächsten Befehl (Zelle **001**) ins Befehlsregister und führe ihn aus.
    ziel:
      ins: 2011
      acc: 10
      benutzt: [db->ins, ins->ab, plus]
    tipp: "Befehl holen (Adresse 001, `ram→db`, `db→ins`), dann ausführen (`ins→ab`, `ram→db`, `plus`)."
    loesung: ["ab = 1", "micro ram->db", "micro db->ins", "micro ins->ab", "micro ram->db", "micro plus"]
  - typ: aktion
    text: |
      Und jetzt den Befehl aus Zelle **002**.
    ziel:
      ins: 4012
      ram: { "12": 10 }
    loesung: ["ab = 2", "micro ram->db", "micro db->ins", "micro ins->ab", "micro acc->db", "micro db->ram"]
  - typ: quiz
    frage: Kann man einer Speicherzelle ansehen, ob sie einen Befehl oder eine Zahl enthält?
    optionen:
      - "Nein – 01.010 kann der Befehl TAKE 010 oder die Zahl 1010 sein. Es kommt darauf an, wie die CPU die Zelle benutzt."
      - "Ja, Befehle haben immer einen Punkt."
      - "Ja, Befehle stehen immer in den Zellen ab 000."
    richtig: 0
    erklaerung: Befehle und Daten sind im Von-Neumann-Speicher **nicht unterscheidbar**. Der Punkt ist nur eine Anzeigehilfe.
  - typ: info
    titel: Merke
    text: |
      - Ein **Befehl** ist eine Zahl: **Opcode** (was?) + **Adresse** (womit?).
      - Die CPU kopiert den Befehl ins **Befehlsregister** und zerlegt ihn dort.
      - Programm und Daten liegen im **selben Speicher**.

      Immer noch mühsam: Du musstest wissen, welche Mikrobefehle zu TAKE, ADD und SAVE gehören,
      und dir merken, welcher Befehl als Nächstes dran ist. Genau das automatisieren wir jetzt.
---
