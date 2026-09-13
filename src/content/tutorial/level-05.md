---
nummer: 5
titel: Das Rechenwerk
kurz: plus und minus – und du bist das Steuerwerk.
leitfrage: Wie rechnet die CPU eigentlich?
sichtbar: [ram, ab, db, acc, log]
funktionen: [abInput, dbInput]
mikro: [ram->db, db->ram, db->acc, acc->db, plus, minus, acc:=0, acc++, acc--]
programm: |
  010: 7
  3
  100: 42
zellen:
  "10": a
  "11": b
  "12": Summe
  "13": Differenz
schritte:
  - typ: info
    titel: Die ALU
    text: |
      Das Rechenwerk heißt auch **ALU** (*Arithmetic Logic Unit*). Johnnys ALU kann zwei Rechnungen:

      - `plus` – **Akku := Akku + Datenbus**
      - `minus` – **Akku := Akku − Datenbus**

      Gerechnet wird also **immer** mit dem Akkumulator und der Zahl auf dem Datenbus.
      Das Ergebnis landet wieder im Akkumulator.

      Unten gibt es jetzt ein **Protokoll** – dort steht, was bei jedem Klick passiert ist.
  - typ: vorhersage
    frage: Im Akku steht **10**, auf dem Datenbus **4**. Du klickst `minus`. Was steht danach im Akku?
    antwort: 6
    erklaerung: 10 − 4 = 6. Der Datenbus bleibt dabei unverändert.
  - typ: aktion
    titel: Addiere Speicherinhalte
    text: |
      Berechne **a + b** (Zellen 010 und 011) und speichere das Ergebnis in Zelle **012**.
    ziel:
      ram: { "12": 10 }
      benutzt: [plus]
    tipp: |
      Plane zuerst:
      1. a in den Akku holen
      2. b auf den Datenbus holen
      3. `plus`
      4. Akku in Zelle 012 schreiben
    erfolg: Genau so steht es auf den Folien – „Addiere Speicherstelleninhalt X mit Y und speichere das Ergebnis in Z“.
    loesung: ["ab = 10", "micro ram->db", "micro db->acc", "ab = 11", "micro ram->db", "micro plus", "micro acc->db", "ab = 12", "micro db->ram"]
  - typ: vorhersage
    frage: Wie viele **Mikrobefehle** brauchst du für diese Aufgabe mindestens? (Das Anlegen der Adressen zählt nicht mit.)
    antwort: 6
    erklaerung: "`ram→db`, `db→acc`, `ram→db`, `plus`, `acc→db`, `db→ram` – sechs Mikrobefehle plus dreimal eine Adresse anlegen."
  - typ: aktion
    text: |
      Berechne **42 − a** (42 steht in Zelle 100) und speichere das Ergebnis in Zelle **013**.
    ziel:
      ram: { "13": 35 }
      benutzt: [minus]
    loesung: ["ab = 100", "micro ram->db", "micro db->acc", "ab = 10", "micro ram->db", "micro minus", "micro acc->db", "ab = 13", "micro db->ram"]
  - typ: vorhersage
    frage: Was ergibt **3 − 7** bei Johnny?
    antwort: 0
    erklaerung: Johnny kennt keine negativen Zahlen – das Ergebnis wird auf 0 begrenzt. Das müssen wir beim Programmieren später beachten!
  - typ: quiz
    frage: Du hast gerade die Arbeit eines Bauteils übernommen, das Johnny noch fehlt. Was hast du dabei festgelegt?
    optionen:
      - "Welche Adresse auf den Adressbus kommt."
      - "Welche Mikrobefehle in welcher Reihenfolge ausgeführt werden."
      - "Wie das Rechenwerk intern mit Transistoren addiert."
    richtig: [0, 1]
    erklaerung: Genau das ist die Aufgabe des **Steuerwerks**. Es arbeitet nach **Befehlen**, die – und das ist der Clou – ebenfalls im Speicher stehen.
  - typ: info
    titel: Merke
    text: |
      - Das **Rechenwerk (ALU)** rechnet: Akku ± Datenbus → Akku.
      - Jede Rechnung besteht aus vielen kleinen Schritten: holen, rechnen, zurückschreiben.
      - Bisher warst **du** das Steuerwerk.

      **Kernfrage:** Woher weiß ein Computer ohne dich, was er tun soll? → Mission 6.
---
