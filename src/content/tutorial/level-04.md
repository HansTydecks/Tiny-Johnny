---
nummer: 4
titel: Der Akkumulator
kurz: Ein Register in der CPU merkt sich die Zahl, mit der gerade gearbeitet wird.
leitfrage: Wo merkt sich die CPU eine Zahl, mit der sie gerade arbeitet?
sichtbar: [ram, ab, db, acc]
funktionen: [abInput, dbInput]
mikro: [ram->db, db->ram, db->acc, acc->db, acc:=0, acc++, acc--]
programm: |
  010: 7
  3
  12
  100: 42
schritte:
  - typ: info
    titel: Ein Merkzettel in der CPU
    text: |
      Ein Bus ist nur eine **Leitung** – er hält nichts fest. Sobald die nächste Zahl transportiert wird,
      ist die alte weg. Die CPU braucht deshalb eigene, winzige Speicherplätze direkt im Prozessor:
      **Register**.

      Johnnys wichtigstes Register ist der **Akkumulator** (`acc`, lateinisch „Sammler“) im **Rechenwerk** (lila).
      Neue Mikrobefehle:

      - `db→acc` – Datenbus in den Akku kopieren
      - `acc→db` – Akku auf den Datenbus legen
      - `acc:=0`, `acc++`, `acc--` – Akku auf 0 setzen, um 1 erhöhen, um 1 verringern

      Die Lampe **=0?** leuchtet, wenn der Akkumulator 0 ist.
  - typ: aktion
    text: |
      Hole die **7** aus Zelle **010** in den Akkumulator.
    ziel:
      acc: 7
      benutzt: [db->acc]
    tipp: Adresse 010 anlegen → `ram→db` → `db→acc`.
    loesung: ["ab = 10", "micro ram->db", "micro db->acc"]
  - typ: aktion
    text: |
      Erhöhe den Akkumulator auf **9**.
    ziel:
      acc: 9
      benutzt: [acc++]
    loesung: ["micro acc++", "micro acc++"]
  - typ: aktion
    text: |
      Speichere die **9** zurück in Zelle **010**.
    ziel:
      ram: { "10": 9 }
      benutzt: [acc->db, db->ram]
    tipp: Der Adressbus zeigt noch auf 010. Der Akku muss erst auf den Datenbus, dann in den Speicher.
    loesung: ["micro acc->db", "micro db->ram"]
  - typ: vorhersage
    frage: Der Akkumulator enthält **0**. Du klickst `acc--`. Was steht danach im Akkumulator?
    antwort: 0
    erklaerung: |
      Johnny kennt **keine negativen Zahlen**. Der Akku bleibt bei 0 stehen.
      Genauso kommt er nie über 19999 hinaus. Probier es ruhig aus!
  - typ: aktion
    text: |
      Erhöhe den Inhalt von Zelle **011** um **2** (aus 3 wird 5).
    ziel:
      ram: { "11": 5 }
    tipp: "Holen (3 Handgriffe) → zweimal erhöhen → zurückschreiben (2 Mikrobefehle)."
    loesung: ["ab = 11", "micro ram->db", "micro db->acc", "micro acc++", "micro acc++", "micro acc->db", "micro db->ram"]
  - typ: quiz
    frage: Warum braucht die CPU den Akkumulator? Die Zahl lag doch schon auf dem Datenbus.
    optionen:
      - "Der Bus transportiert nur und wird gleich für die nächste Zahl gebraucht – im Register bleibt die Zahl erhalten."
      - "Der Datenbus kann nur Adressen transportieren."
      - "Der Akkumulator ist größer als der Speicher."
    richtig: 0
    erklaerung: Register sind die schnellsten Speicherplätze eines Computers – aber es gibt nur sehr wenige davon, direkt im Prozessor.
  - typ: info
    titel: Merke
    text: |
      - **Register** sind kleine, sehr schnelle Speicherplätze **in der CPU**.
      - Johnnys **Akkumulator** hält das Zwischenergebnis. In echten CPUs heißen solche Register z. B. **Datenregister**.
      - Johnny rechnet nur mit Zahlen von **0 bis 19999**.

      Bisher haben wir nur gezählt. Als Nächstes lassen wir das Rechenwerk richtig **rechnen**.
---
