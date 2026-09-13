---
nummer: 3
titel: Der Datenbus
kurz: Lesen und Schreiben – die ersten beiden Mikrobefehle.
leitfrage: Wie kommt eine Zahl aus dem Speicher heraus – und wieder hinein?
sichtbar: [ram, ab, db]
funktionen: [abInput, dbInput]
mikro: [ram->db, db->ram]
programm: |
  010: 7
  3
  12
  100: 42
schritte:
  - typ: info
    titel: Der zweite Bus
    text: |
      Der **Datenbus** (grün) transportiert die **Inhalte** – und zwar in **beide Richtungen**:
      vom Speicher zur CPU (lesen) und von der CPU zum Speicher (schreiben).

      Dafür gibt es zwei **Mikrobefehle**. Mikrobefehle sind die kleinsten Schritte, die Johnny kann:

      - `ram→db` – **lesen**: Der Inhalt der ausgewählten Zelle wird auf den Datenbus gelegt.
      - `db→ram` – **schreiben**: Die Zahl auf dem Datenbus wird in die ausgewählte Zelle geschrieben.

      Welche Zelle „ausgewählt“ ist, bestimmt immer der **Adressbus**.
  - typ: aktion
    text: |
      Hole den Inhalt von Zelle **100** auf den Datenbus.
    ziel:
      db: 42
      benutzt: [ram->db]
    tipp: Zuerst die Adresse 100 auf den Adressbus legen, dann den Mikrobefehl `ram→db` anklicken.
    loesung: ["ab = 100", "micro ram->db"]
  - typ: vorhersage
    frage: Zelle 100 wurde gerade gelesen. Welche Zahl steht **jetzt in Zelle 100**?
    antwort: 42
    erklaerung: Lesen ist **Kopieren**. Der Inhalt bleibt im Speicher erhalten – auf dem Datenbus liegt nur eine Kopie.
  - typ: aktion
    text: |
      Die 42 liegt auf dem Datenbus. Schreibe sie in Zelle **020**.
    ziel:
      ram: { "20": 42 }
      benutzt: [db->ram]
    tipp: Lege die Zieladresse 020 auf den Adressbus und klicke `db→ram`.
    loesung: ["ab = 20", "micro db->ram"]
  - typ: aktion
    text: |
      Kopiere den Inhalt von Zelle **010** in Zelle **030** – nur mit dem Adressbus und den beiden Mikrobefehlen.
    ziel:
      ram: { "30": 7 }
      benutzt: [ram->db, db->ram]
    tipp: "Vier Handgriffe: Adresse 010 anlegen → lesen → Adresse 030 anlegen → schreiben."
    loesung: ["ab = 10", "micro ram->db", "ab = 30", "micro db->ram"]
  - typ: aktion
    text: |
      Schreibe die Zahl **99** in Zelle **012**. Lege die 99 dazu **von Hand** auf den Datenbus.
    ziel:
      ram: { "12": 99 }
      benutzt: [db->ram]
    loesung: ["db = 99", "ab = 12", "micro db->ram"]
  - typ: quiz
    frage: Welche Aussagen stimmen?
    optionen:
      - "Der Datenbus transportiert Zahlen in beide Richtungen."
      - "Der Adressbus transportiert die Inhalte der Speicherzellen."
      - "Beim Schreiben geht der alte Inhalt der Zelle verloren."
      - "Beim Lesen wird die Zelle gelöscht."
    richtig: [0, 2]
    erklaerung: Adressbus = *welche* Zelle, Datenbus = *welcher* Wert. Lesen kopiert, Schreiben überschreibt.
  - typ: info
    titel: Merke
    text: |
      - **Datenbus**: transportiert Werte, in beide Richtungen.
      - `ram→db` liest, `db→ram` schreibt – jeweils die Zelle, auf die der **Adressbus** zeigt.
      - Echte Computer haben zusätzlich einen **Steuerbus**, der z. B. „lesen“ oder „schreiben“ signalisiert.
        Bei Johnny steckt diese Information im Mikrobefehl selbst.

      Übrigens: Alles läuft über diese wenigen Leitungen – immer nur eins nach dem anderen.
      Das ist der berühmte **Von-Neumann-Flaschenhals**.
---
