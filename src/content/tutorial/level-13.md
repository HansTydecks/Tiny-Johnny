---
nummer: 13
titel: Du bist das Steuerwerk
kurz: Interpretations- und Ausführungsphase Takt für Takt.
leitfrage: Was genau tut das Steuerwerk in jedem einzelnen Takt?
sichtbar: [ram, ab, db, acc, ins, pc, mc, microcode, log]
funktionen: [microStep, macroStep, run, reset, controlToggle]
mikro: alle
programm: |
  000: TAKE 100
  SUB 101
  SAVE 102
  HLT
  100: 9
  4
zellen:
  "100": a
  "101": b
  "102": a − b
schritte:
  - typ: info
    titel: Zwei Phasen
    text: |
      Jeder Befehl wird in zwei Phasen abgearbeitet:

      **1. Interpretationsphase** (Fetch + Decode)
      - Befehl laden: `pc→ab`, `ram→db`, `db→ins`
      - Befehl decodieren: `ins→mc`
      - Daten holen: `ins→ab`, `ram→db` (bei Befehlen, die mit einer Zelle arbeiten)

      **2. Ausführungsphase** (Execute)
      - ALU führt den Befehl aus (`plus`, `minus`, `db→acc` …)
      - Ergebnis wird gespeichert oder weiterverwendet (`acc→db`, `db→ram`)
      - weiter zum nächsten Befehl: `pc++`, `mc:=0`

      Bei Johnny stehen „Daten holen“ und „Ausführen“ zusammen im Rezept des Befehls – FETCH ist für alle Befehle gleich.
  - typ: quiz
    frage: Welche Mikrobefehle gehören zum **Laden und Decodieren** des Befehls?
    optionen: ["`pc→ab`", "`db→ins`", "`ins→mc`", "`plus`", "`db→ram`"]
    richtig: [0, 1, 2]
    erklaerung: "`pc→ab`, `ram→db`, `db→ins`, `ins→mc` – das ist FETCH. `plus` und `db→ram` gehören zur Ausführungsphase."
  - typ: aktion
    vorbereitung:
      reset: true
      register: { acc: 9, pc: 1 }
    text: |
      **Sei selbst das Steuerwerk!** Der Akku enthält schon 9, der Programmzähler steht auf 001 (SUB 101).

      Unter **Mehr → Mikroprogramm-Steuerung** kannst du den Mikrocode ausblenden.
      Führe dann den kompletten Befehl **von Hand** mit Mikrobefehlen aus: Befehl holen, ausführen, `pc++`.
      (`ins→mc` brauchst du nicht – den Befehl decodierst du selbst im Kopf.)
    ziel:
      acc: 5
      pc: 2
      ins: 3101
      benutzt: [pc->ab, ram->db, db->ins, ins->ab, minus, pc++]
    tipp: "`pc→ab` → `ram→db` → `db→ins` → `ins→ab` → `ram→db` → `minus` → `pc++`"
    erfolg: Genau diese Folge steht als FETCH + SUB-Rezept im Mikrocode. Das Steuerwerk macht nichts anderes – nur Milliarden Mal schneller.
    loesung: ["micro pc->ab", "micro ram->db", "micro db->ins", "micro ins->ab", "micro ram->db", "micro minus", "micro pc++"]
  - typ: vorhersage
    frage: Wie viele Takte braucht ein **ADD**-Befehl insgesamt, also mit FETCH?
    antwort: 9
    einheit: Takte
    erklaerung: 4 Takte FETCH + 5 Takte ADD-Rezept.
  - typ: quiz
    frage: Warum ist es praktisch, dass FETCH ein eigenes Rezept bei 000 ist?
    optionen:
      - "FETCH ist für alle Befehle gleich und muss nur ein einziges Mal im Mikrocode stehen."
      - "Weil FETCH schneller ist als alle anderen Rezepte."
      - "Weil Befehle bei 000 beginnen müssen."
    richtig: 0
    erklaerung: Jedes Rezept endet mit `mc:=0` und springt damit automatisch zu FETCH zurück – so entsteht der Zyklus.
  - typ: quiz
    frage: Welches Bauteil einer **realen CPU** entspricht Johnnys Mikroprogrammzähler mit Mikrocode?
    optionen: ["Befehlsdecodierer / Steuerlogik", "Cache", "ALU"]
    richtig: 0
    erklaerung: Der Befehlsdecodierer übersetzt den Opcode in Steuersignale. Johnnys Mikrocode macht genau das – nur sichtbar.
  - typ: aktion
    vorbereitung:
      reset: true
    text: |
      Zum Abschluss: Schalte die Mikroprogramm-Steuerung wieder ein (falls ausgeschaltet), drücke **Reset**
      und lass das ganze Programm mit **Ausführen** laufen.
    ziel:
      halted: true
      ram: { "102": 5 }
    loesung: ["ausfuehren"]
  - typ: info
    titel: Merke
    text: |
      - **Interpretationsphase:** Befehl laden (`pc→ab`, `ram→db`, `db→ins`), decodieren (`ins→mc`), Daten holen.
      - **Ausführungsphase:** ALU führt aus, Ergebnis speichern, `pc++`, `mc:=0`.
      - Das Steuerwerk ist ein **Automat**, der Mikrobefehle in einer festen Reihenfolge auslöst.
---
