---
nummer: 9
titel: Selbst programmieren
kurz: Befehle eingeben, ausführen, verändern.
leitfrage: Wie schreibe ich ein Programm, das Johnny selbstständig ausführt?
sichtbar: [ram, ab, db, acc, ins, pc, mc, log]
funktionen: [ramEdit, asm, microStep, macroStep, run, reset]
programm: |
  100: 4
  9
  13
zellen:
  "100": x
  "101": y
  "102": z
  "103": Ergebnis
schritte:
  - typ: info
    titel: Programme eingeben
    text: |
      Jetzt schreibst du selbst ein Programm. So gibst du einen Befehl ein:

      1. Zelle anklicken (oder Adresse eintippen)
      2. bei **Befehl** z. B. `TAKE` wählen und die **Adresse** eintragen – oder direkt `TAKE 100` ins Feld tippen
      3. **Enter** – die nächste Zelle ist automatisch ausgewählt

      Programme beginnen bei **000** und enden mit **HLT**.
      **Reset** setzt alle Register (auch den Programmzähler) auf 0, der Speicher bleibt erhalten.
      **Ausführen** arbeitet das Programm automatisch ab.
  - typ: aktion
    text: |
      Schreibe ab Zelle **000** ein Programm, das **x + y + z** berechnet und in Zelle **103** speichert.

      Klicke dann auf **Programm prüfen** – Johnny testet dein Programm mit verschiedenen Zahlen.
    ziel:
      tests:
        - ein: { "100": 4, "101": 9, "102": 13 }
          aus: { "103": 26 }
        - ein: { "100": 100, "101": 20, "102": 3 }
          aus: { "103": 123 }
    tipp: |
      Du brauchst fünf Befehle: x holen, y addieren, z addieren, speichern, anhalten.
    erfolg: Dein Programm funktioniert für beliebige Zahlen in x, y und z.
    loesung: ["ram 000 = TAKE 100", "ram 001 = ADD 101", "ram 002 = ADD 102", "ram 003 = SAVE 103", "ram 004 = HLT"]
  - typ: aktion
    text: |
      Drücke **Reset** und dann **Ausführen**. Beobachte, wie Johnny arbeitet.
      Mit dem Regler kannst du die Geschwindigkeit ändern.
    ziel:
      halted: true
      ram: { "103": 26 }
    loesung: ["reset", "ausfuehren"]
  - typ: vorhersage
    frage: Wie viele **Takte** braucht dein Programm? (FETCH = 4, TAKE/ADD/SAVE = je 5, HLT = 2)
    antwort: 42
    einheit: Takte
    erklaerung: "5 × 4 (FETCH) + 5 + 5 + 5 + 5 + 2 = 42. Übrigens: Moderne Prozessoren schaffen einige Milliarden Takte pro Sekunde."
  - typ: aktion
    text: |
      Ändere dein Programm so, dass es **x + y − z** berechnet.
    ziel:
      tests:
        - ein: { "100": 20, "101": 9, "102": 13 }
          aus: { "103": 16 }
        - ein: { "100": 5, "101": 5, "102": 3 }
          aus: { "103": 7 }
    tipp: Du musst nur einen einzigen Befehl austauschen.
    loesung: ["ram 002 = SUB 102"]
  - typ: quiz
    frage: Was passiert, wenn du am Ende das **HLT** vergisst?
    optionen:
      - "Johnny holt einfach den Inhalt der nächsten Zelle als Befehl. Steht dort 00.000, holt er diese Zelle immer wieder und kommt nicht weiter."
      - "Johnny meldet einen Syntaxfehler, bevor das Programm startet."
      - "Das Programm beginnt automatisch wieder bei 000."
    richtig: 0
    erklaerung: Probier es aus! Die CPU prüft nichts – sie führt stur aus, worauf der Programmzähler zeigt.
  - typ: info
    titel: Merke
    text: |
      - Ein **Programm** ist eine Folge von Befehlen im Speicher, beginnend bei der Startadresse.
      - Daten legt man am besten **getrennt** vom Programm ab (hier ab Zelle 100).
      - Assembler-Wörter wie TAKE sind nur Namen für Zahlen – der Speicher enthält immer Zahlen.

      Bis jetzt laufen Programme stur von oben nach unten. Als Nächstes lernst du, wie Johnny **springt**.
---
