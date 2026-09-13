---
nummer: 1
titel: Der Speicher
kurz: 1000 durchnummerierte Zellen – Adresse und Inhalt unterscheiden.
leitfrage: Wo liegen eigentlich die Zahlen, mit denen ein Computer arbeitet?
sichtbar: [ram]
funktionen: [ramEdit]
startRam:
  100: 42
zellen: {}
schritte:
  - typ: info
    titel: Willkommen bei Johnny
    text: |
      **Johnny** ist ein Modellrechner, der genau nach der Von-Neumann-Architektur aufgebaut ist.
      Er ist so einfach, dass man *jeden einzelnen Schritt* beobachten kann.

      Wir bauen Johnny Stück für Stück zusammen. In dieser Mission siehst du nur ein einziges Bauteil:
      den **Speicher** (RAM, Arbeitsspeicher).

      > Leitfrage: Wo liegen eigentlich die Zahlen, mit denen ein Computer arbeitet?
  - typ: info
    titel: Adresse und Inhalt
    text: |
      Johnnys Speicher besteht aus **1000 Zellen**. Jede Zelle hat eine feste Nummer – ihre **Adresse**
      (000 bis 999). In jeder Zelle steht eine Zahl – ihr **Inhalt**.

      Stell dir eine Wand mit Schließfächern vor: Die Nummer auf der Tür ist die Adresse,
      das, was drin liegt, ist der Inhalt.

      Johnny rechnet übrigens **dezimal**, nicht binär – das macht ihn leichter lesbar.
      Ein echter Rechner würde in Zelle 305 z. B. `11011011` speichern.
  - typ: quiz
    frage: In der Tabelle siehst du Zelle **100** mit dem Inhalt **00.042**. Was stimmt?
    optionen:
      - "Die Adresse ist 100, der Inhalt ist 42."
      - "Die Adresse ist 42, der Inhalt ist 100."
      - "Adresse und Inhalt sind immer gleich."
    richtig: 0
    erklaerung: Die Adresse sagt, *wo* etwas steht. Der Inhalt sagt, *was* dort steht. Zelle 100 enthält die Zahl 42.
  - typ: aktion
    text: |
      Schreibe die Zahl **7** in die Zelle **010**.
    ziel:
      ram: { "10": 7 }
    tipp: |
      Tippe unten bei **Zelle** die Adresse `10` ein (oder klicke die Zeile in der Tabelle an).
      Gib bei **Inhalt** die `7` ein und drücke **Enter** oder **Schreiben**.
    erfolg: In Zelle 010 steht jetzt 00.007. Nach dem Schreiben springt die Auswahl automatisch eine Zelle weiter.
    loesung: ["ram 010 = 7"]
  - typ: aktion
    text: |
      Schreibe **3** in Zelle **011** und **12** in Zelle **012**.
    ziel:
      ram: { "11": 3, "12": 12 }
    loesung: ["ram 011 = 3", "ram 012 = 12"]
  - typ: aktion
    text: |
      Überschreibe die **42** in Zelle **100** mit der Zahl **5**.
    ziel:
      ram: { "100": 5 }
    erfolg: Die 42 ist weg! Beim Schreiben wird der alte Inhalt einer Zelle **überschrieben**.
    loesung: ["ram 100 = 5"]
  - typ: quiz
    frage: Wie viele Speicherzellen hat Johnny?
    optionen: ["999", "1000", "100 000"]
    richtig: 1
    erklaerung: Die Adressen reichen von 000 bis 999 – das sind 1000 Zellen, denn die 000 zählt mit.
  - typ: vorhersage
    frage: |
      Jede Zelle hat fünf Dezimalstellen, die erste Stelle darf aber höchstens **1** sein.
      Was ist die **größte Zahl**, die in eine Zelle passt?
    antwort: 19999
    erklaerung: |
      **19999** (angezeigt als `19.999`). Warum der Punkt und die seltsame Grenze? Später teilt Johnny jede
      Zahl in zwei Teile: die ersten zwei Ziffern (00–19) und die letzten drei (000–999).
      Wozu das gut ist, erfährst du in Mission 6.
  - typ: info
    titel: Merke
    text: |
      - Der Speicher ist **durchnummeriert**: Jede Zelle hat eine Adresse.
      - In jeder Zelle steht genau **eine Zahl**. Schreiben überschreibt den alten Inhalt.
      - Der Speicher selbst **tut nichts**. Er merkt sich nur Zahlen.

      Aber wie kommt eine Zahl aus dem Speicher heraus – und woher weiß der Speicher,
      *welche* Zelle gemeint ist? Das klären wir in Mission 2.
---
