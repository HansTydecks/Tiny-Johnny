# Tiny Johnny – Vom Von-Neumann-Rechner zum Modellrechner Johnny

Viele Lehrpläne verlangen, dass Schülerinnen und Schüler der Sekundarstufe II verstehen, wie ein Computer auf
Hardware-Ebene Befehle ausführt – ein Thema, das auf Folien schnell abstrakt bleibt. Tiny Johnny macht daraus einen
interaktiven Lernpfad: Von-Neumann-Architektur mit Simulationen erkunden, den Modellrechner Johnny Bauteil für
Bauteil selbst aufbauen und anschließend eigene Programme schreiben. Nützlich für Informatiklehrkräfte, die eine
geführte, selbsterklärende Unterrichtsreihe suchen, und für Lernende, die eigenständig oder zur Wiederholung üben
wollen.

## Auf einen Blick

- **Fach/Fächer:** Informatik
- **Zielgruppe bzw. Klassenstufen:** Sekundarstufe II
- **Materialart bzw. Tool-Typ:** Interaktive Web-Anwendung (Lernpfad mit Simulator, Missionen und Übungsaufgaben)
- **Einsatzdauer oder Einsatzform:** Vorschlag für rund 7 Doppelstunden als zusammenhängende Unterrichtsreihe;
  einzelne Kapitel, Missionen oder Aufgaben lassen sich auch unabhängig davon einsetzen
- **Technische Voraussetzungen:** Nur ein Browser, keine Anmeldung, keine Installation. Lernfortschritt wird lokal
  im Browser gespeichert (`localStorage`).

## Das bietet das Projekt

Tiny Johnny besteht aus vier Teilen, die aufeinander aufbauen:

- **Von-Neumann-Rechner** – 10 Kapitel zu EVAS-Prinzip, Ein-/Ausgabe, Speicher, Speichertechnik (elektronisch,
  magnetisch, optisch), Cache, Bus, CPU und Bewertung, jeweils mit eingebetteten Simulationen zum Ausprobieren.
- **Tutorial** – 14 Missionen, in denen der Modellrechner Johnny Bauteil für Bauteil aufgebaut wird. Jede Mission hat
  eine Leitfrage, verlangt vor dem Ausführen eine Vorhersage und prüft automatisch, ob das Lernziel erreicht wurde.
- **Aufgaben** – 20 Aufgaben in drei Kontexten (Rechnen & Mathe, Spiele & Zähler, Informatik-Klassiker) und drei
  Schwierigkeitsstufen, mit automatisch geprüften Testfällen, gestuften Tipps und Musterlösung.
- **Sandbox** – Johnny mit allen Funktionen: Mikro- und Makroschritt, Programme ausführen, eigene Befehle
  aufnehmen, Bonsai-Modus sowie Speichern/Laden von `.ram`- und `.mc`-Dateien.

Der Simulator verhält sich exakt wie das Original Johnny 2.0 (gleicher Mikrocode, gleiche Grenzen, gleiche
Dateiformate) – das wird bei jeder Änderung automatisch getestet. Didaktisch durchgängig sind eine einheitliche
Farbcodierung der Bauteile (Speicher, Adressbus, Datenbus, Rechenwerk, Steuerwerk) sowie deutsche Bezeichnungen
neben den Original-Kürzeln, damit der Umstieg auf den Original-Simulator leichtfällt.

## So kann es im Unterricht eingesetzt werden

1. **Als durchgehende Unterrichtsreihe:** Der mitgelieferte Vorschlag für Lehrkräfte gliedert Kapitel und Missionen
   in etwa 7 Doppelstunden, vom Von-Neumann-Modell bis zu eigenen Programmen.
2. **Gezielt einzelne Themen vertiefen:** Kapitel oder Missionen (z. B. nur Bus, Cache oder Sprungbefehle) lassen
   sich einzeln verlinken, etwa zur Wiederholung vor einer Klassenarbeit.
3. **Differenzierung über die Aufgaben:** Drei Kontexte und drei Sterne-Stufen erlauben es, Aufgaben passend zum
   Leistungsstand auszuwählen; gestufte Tipps unterstützen schwächere Lernende, ohne die Musterlösung sofort
   preiszugeben.
4. **Selbstständiges Lernen/Hausaufgabe:** Da Missionen und Aufgaben automatisch geprüft werden und Musterlösungen
   nach allen Tipps sichtbar sind, eignet sich Tiny Johnny auch zum eigenständigen Bearbeiten außerhalb des
   Unterrichts.
5. **Projekt- oder Vertiefungsarbeit:** In der Sandbox können eigene Programme geschrieben, eigene Befehle
   aufgenommen und Dateien exportiert werden – etwa um sie mit dem Original-Simulator Johnny 2.0 zu vergleichen.

## So funktioniert es

Die Website ist direkt im Browser unter [tinyjohnny.tinfo.space](https://tinyjohnny.tinfo.space/) nutzbar – ohne
Installation oder Anmeldung. Lernende arbeiten sich der Reihe nach durch Kapitel und Missionen oder steuern gezielt
einzelne Themen an; die Sandbox steht jederzeit für freies Ausprobieren offen. Für Lehrkräfte gibt es eine eigene
Seite mit Unterrichtsvorschlag und allen Musterlösungen. Wer Inhalte anpassen möchte: Alle Kapitel, Missionen und
Aufgaben liegen als einfache Text-/YAML-Dateien im Repository und lassen sich direkt auf GitHub bearbeiten – nach
einem Commit baut sich die Website automatisch neu (Tests laufen dabei mit, siehe README).

## Links

- Repository: [github.com/HansTydecks/Tiny-Johnny](https://github.com/HansTydecks/Tiny-Johnny)
- Demo bzw. veröffentlichte Version: [tinyjohnny.tinfo.space](https://tinyjohnny.tinfo.space/)
- Anleitung zum Bearbeiten der Inhalte: [README – Inhalte bearbeiten](https://github.com/HansTydecks/Tiny-Johnny#inhalte-bearbeiten)
- Hinweise für Lehrkräfte (Unterrichtsvorschlag, Musterlösungen): [tinyjohnny.tinfo.space/lehrkraefte](https://tinyjohnny.tinfo.space/lehrkraefte/)

## Lizenz und Weiterverwendung

Laut `LICENSE`-Datei gilt für dieses Projekt eine geteilte Lizenzierung:

- **Programmcode** (alles außer `src/content/`): MIT-Lizenz – frei nutzbar, veränderbar und weiterverbreitbar, auch
  kommerziell, solange der Lizenz- und Copyright-Hinweis erhalten bleibt.
- **Texte, Aufgaben und Grafiken** (`src/content/` sowie Seitentexte): [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/deed.de)
  – frei für den Unterricht nutzbar und anpassbar, bei Namensnennung und Weitergabe unter gleichen Bedingungen.

Der Modellrechner Johnny selbst stammt von Peter Dauscher, die Web-Version Johnny 2.0 von David Laubersheimer
([github.com/Laubersheini/johnny](https://github.com/Laubersheini/johnny), AGPL-3.0). Tiny Johnny ist eine
eigenständige Neuimplementierung ohne übernommenen Code aus Johnny 2.0.

## Kontakt und Rückmeldung

Fragen, Fehler oder Ideen gerne per E-Mail an **hanstydecks.tea@gmail.com** oder über das Kontaktformular
[contact.tinfo.space](https://contact.tinfo.space/). Für Fehler oder Verbesserungsvorschläge zum Code und zu den
Inhalten freue ich mich auch über ein [Issue auf GitHub](https://github.com/HansTydecks/Tiny-Johnny/issues).
