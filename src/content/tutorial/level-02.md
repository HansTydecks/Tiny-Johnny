---
nummer: 2
titel: Der Adressbus
kurz: Wie die CPU eine von 1000 Zellen auswählt.
leitfrage: Wie wählt die CPU aus, mit welcher der 1000 Speicherzellen sie arbeiten will?
sichtbar: [ram, ab]
funktionen: [abInput]
programm: |
  010: 7
  3
  12
  100: 42
schritte:
  - typ: info
    titel: CPU und Speicher sind getrennt
    text: |
      In der Von-Neumann-Architektur sind Prozessor (CPU) und Speicher **getrennte Bauteile**.
      Sie sind über Leitungen verbunden – den **Bus**.

      Der erste Teil davon ist der **Adressbus**. Über ihn sagt die CPU dem Speicher:
      *„Ich meine jetzt Zelle Nummer …“*

      Rechts siehst du den Adressbus in **Orange**. Die Zelle, auf die er zeigt, ist in der Tabelle
      orange markiert (`ab`).
  - typ: aktion
    text: |
      Lege die Adresse **100** auf den Adressbus.
    ziel:
      ab: 100
    tipp: Tippe `100` in das Eingabefeld beim Adressbus und klicke auf **anlegen**.
    erfolg: Zelle 100 ist jetzt ausgewählt. Beachte – ihr Inhalt hat sich **nicht** verändert. Der Adressbus wählt nur aus.
    loesung: ["ab = 100"]
  - typ: quiz
    frage: Der Adressbus zeigt **012**. Was bedeutet das?
    optionen:
      - "Die CPU hat Zelle 012 ausgewählt."
      - "In Zelle 012 steht jetzt die Zahl 12."
      - "Die Zahl 12 wird gerade zur CPU transportiert."
    richtig: 0
    erklaerung: Auf dem Adressbus liegen nur **Adressen**. Welche Zahl in der Zelle steht, spielt für den Adressbus keine Rolle.
  - typ: aktion
    text: |
      Wähle nacheinander die Zellen **010**, **011** und zum Schluss **012** aus.
    ziel:
      ab: 12
    loesung: ["ab = 10", "ab = 11", "ab = 12"]
  - typ: info
    titel: Und in einem echten Computer?
    text: |
      Ein echter Adressbus besteht aus einzelnen Leitungen, die entweder Strom führen (1) oder nicht (0).
      Mit **n** Leitungen lassen sich **2ⁿ** verschiedene Adressen bilden.

      Beispiel: 3 Leitungen → 000, 001, 010, 011, 100, 101, 110, 111 → **8 Zellen**.
  - typ: vorhersage
    frage: Wie viele Speicherzellen kann ein Adressbus mit **8 Leitungen** ansprechen?
    antwort: 256
    einheit: Zellen
    erklaerung: 2⁸ = 256. Jede weitere Leitung verdoppelt die Anzahl der möglichen Adressen.
  - typ: vorhersage
    frage: Und mit **16 Leitungen**?
    antwort: 65536
    einheit: Zellen
    erklaerung: 2¹⁶ = 65 536. Heutige Prozessoren nutzen 48 und mehr Adressleitungen – genug für viele Terabyte.
  - typ: info
    titel: Merke
    text: |
      - Der **Adressbus** legt fest, **welche Zelle** gemeint ist.
      - Er führt nur in **eine Richtung**: von der CPU zum Speicher.
      - Johnnys Adressbus hat 3 Dezimalstellen → 1000 Zellen.

      Die Zelle ist jetzt ausgewählt – aber ihr Inhalt ist noch nicht bei der CPU. Dafür brauchen wir
      einen zweiten Bus.
---
