---
nummer: 7
titel: Das Mikroprogramm
kurz: Jeder Befehl hat ein „Rezept“ aus Mikrobefehlen.
leitfrage: Woher weiß die CPU, welche Mikrobefehle zu einem Befehl gehören?
sichtbar: [ram, ab, db, acc, ins, mc, microcode, log]
funktionen: [microStep]
mikro: [ins->mc, mc:=0]
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
    titel: Rezepte im Steuerwerk
    text: |
      Für jeden Befehl ist im Steuerwerk ein festes **Rezept** hinterlegt: eine Liste von Mikrobefehlen.
      Diese Liste heißt **Mikrocode** (unten rechts im Steuerwerk).

      Beispiel **TAKE** (Mikrocode-Adressen 010–014):
      `ins→ab`, `ram→db`, `db→acc`, `pc++`, `mc:=0`

      Genau das hast du in Mission 6 von Hand gemacht! (`pc++` ignorieren wir noch – dazu gleich mehr.)

      Der **Mikroprogrammzähler** (`mc`) zeigt auf den Mikrobefehl, der als Nächstes dran ist.
      Der Knopf **Mikroschritt** führt genau diesen einen Mikrobefehl aus und zählt `mc` um 1 weiter.
  - typ: quiz
    frage: Im Befehlsregister steht **01.010** (TAKE). Bei welcher Mikrocode-Adresse beginnt das Rezept?
    optionen: ["010", "001", "100"]
    richtig: 0
    erklaerung: Das Rezept für Opcode *n* beginnt bei Adresse *n × 10*. Opcode 01 → 010, Opcode 02 → 020 usw. Genau das erledigt der Mikrobefehl `ins→mc`.
  - typ: aktion
    vorbereitung:
      reset: true
      register: { ins: 1010 }
    text: |
      Im Befehlsregister steht schon **TAKE 010**. Lass den Mikroprogrammzähler mit `ins→mc` auf das passende Rezept springen.
    ziel:
      mc: 10
      benutzt: [ins->mc]
    loesung: ["micro ins->mc"]
  - typ: quiz
    frage: Welcher Mikrobefehl ist jetzt als Nächstes dran?
    optionen: ["`ins→ab`", "`pc→ab`", "`ram→db`"]
    richtig: 0
    erklaerung: Im Mikrocode steht bei 010 der Befehl `ins→ab`. Der passende Knopf ist gestrichelt markiert.
  - typ: aktion
    text: |
      Arbeite das TAKE-Rezept mit **Mikroschritt** ab, bis der Mikroprogrammzähler wieder auf **000** steht.
      Beobachte das Protokoll!
    ziel:
      mc: 0
      acc: 7
    erfolg: "`mc:=0` hat den Mikroprogrammzähler zurückgesetzt – das Rezept ist fertig. Bei 000 beginnt ein ganz besonderes Rezept …"
    loesung: ["mikroschritt", "mikroschritt", "mikroschritt", "mikroschritt", "mikroschritt"]
  - typ: vorhersage
    frage: Schau in den Mikrocode. Aus wie vielen Mikrobefehlen besteht das Rezept für **ADD**?
    antwort: 5
    erklaerung: "`ins→ab`, `ram→db`, `plus`, `pc++`, `mc:=0` – fast wie TAKE, nur `plus` statt `db→acc`."
  - typ: aktion
    vorbereitung:
      register: { ins: 3011, acc: 7, mc: 0 }
    text: |
      Jetzt steht **SUB 011** im Befehlsregister, der Akku enthält 7.
      Führe den Befehl mit `ins→mc` und Mikroschritten aus.
    ziel:
      acc: 4
      mc: 0
      benutzt: [ins->mc, minus]
    loesung: ["micro ins->mc", "mikroschritt", "mikroschritt", "mikroschritt", "mikroschritt", "mikroschritt"]
  - typ: quiz
    frage: Was ist der Unterschied zwischen einem **Makrobefehl** (z. B. TAKE) und einem **Mikrobefehl** (z. B. `ram→db`)?
    optionen:
      - "Ein Makrobefehl steht im Speicher und besteht aus mehreren Mikrobefehlen, die im Mikrocode festgelegt sind."
      - "Mikrobefehle stehen im RAM, Makrobefehle im Rechenwerk."
      - "Es gibt keinen Unterschied, das sind nur zwei Namen."
    richtig: 0
    erklaerung: Makrobefehle sind die „Sprache“ der Programme. Mikrobefehle sind die Handgriffe, mit denen das Steuerwerk jeden Makrobefehl umsetzt.
  - typ: info
    titel: Merke
    text: |
      - Der **Mikrocode** enthält für jeden Befehl ein Rezept aus Mikrobefehlen.
      - `ins→mc` springt zum Rezept (Opcode × 10), `mc:=0` beendet es.
      - In einer echten CPU übernimmt das der **Befehlsdecodierer** (bei manchen CPUs ebenfalls mit Mikrocode).

      Offen ist noch: Wie kommt der Befehl überhaupt ins Befehlsregister – und welcher ist der nächste?
---
