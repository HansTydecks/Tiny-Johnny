# Tiny Johnny

**Vom Von-Neumann-Rechner zum Modellrechner Johnny** – ein interaktiver Lernpfad für die Sekundarstufe II.

🌐 **Website:** https://tinyjohnny.tinfo.space/

Leitfrage: *Woher weiß der Computer eigentlich, was er tun soll?*

| Teil | Inhalt |
|---|---|
| **Von-Neumann-Rechner** | 10 Kapitel: EVAS, Ein-/Ausgabe, Speicher, Speichertechnik (elektronisch, magnetisch, optisch), Cache, Bus, CPU, Bewertung, Brücke zu Johnny – mit Simulationen |
| **Tutorial** | 14 Missionen, in denen Johnny Bauteil für Bauteil aufgebaut wird – mit Leitfragen, Vorhersagen und automatisch geprüften Zielen |
| **Aufgaben** | 20 Aufgaben (Rechnen & Mathe, Spiele & Zähler, Informatik-Klassiker) mit Testfällen, gestuften Tipps und Musterlösung |
| **Sandbox** | Johnny mit allen Funktionen: Mikro-/Makroschritt, Ausführen, eigene Befehle aufnehmen, Bonsai-Modus, .ram/.mc-Dateien |

Der Simulator verhält sich **exakt wie Johnny 2.0** (gleicher Mikrocode, gleiche Grenzen, gleiche Dateiformate).
Das wird bei jeder Änderung automatisch getestet.

---

## Inhalte bearbeiten

Alle Inhalte liegen als Textdateien in `src/content/`. Man kann sie **direkt auf GitHub bearbeiten**
(Datei öffnen → Stift-Symbol → „Commit changes“). Danach werden automatisch alle Tests ausgeführt und die Website
neu gebaut (Reiter **Actions**, ca. 2 Minuten). Schlägt ein Test fehl, bleibt die alte Version online – in den Actions
steht dann, was nicht stimmt.

> **YAML-Stolperfalle:** Enthält ein einzeiliger Text einen Doppelpunkt mit Leerzeichen (`Tipp: so`), muss er in
> Anführungszeichen stehen: `"Tipp: so"`. Längere Texte schreibt man als Block mit `|` (siehe Beispiele).

### Aufgaben – `src/content/aufgaben/*.yaml`

```yaml
titel: Summe dreier Zahlen
kontext: mathe            # mathe | spiele | klassiker
sterne: 1                 # 1 bis 3
reihenfolge: 1            # Sortierung innerhalb gleicher Sterne
typ: programm             # programm | trace | fehlersuche
modus: normal             # normal | bonsai (optional)
kurz: Drei Zahlen addieren und das Ergebnis speichern.
leitfrage: Wie wird aus einer Rechnung eine Folge von Befehlen?
text: |
  Aufgabentext in **Markdown**.
zellen:                   # Beschriftung der Datenzellen (werden vor jeder Prüfung zurückgesetzt)
  "100": a
  "103": Summe
start: |                  # Anfangsinhalt des Speichers (Assembler)
  100: 4
  7
  9
tests:                    # ein = Eingabewerte, aus = erwartete Werte
  - ein: { "100": 4, "101": 7, "102": 9 }
    aus: { "103": 20 }
tipps:                    # Tipp 1 … n, danach wird die Musterlösung freigeschaltet
  - Erster Denkanstoß
  - "Zweiter Tipp: mit Doppelpunkt in Anführungszeichen"
  - |
    Lückenprogramm als Codeblock
loesung: |
  TAKE 100
  ADD 101
  ADD 102
  SAVE 103
  HLT
erklaerung: |
  Wird nach dem Lösen angezeigt.
```

- **Trace-Aufgaben** (`typ: trace`) haben statt `tests` eine Liste `fragen` mit `text`, `zelle` *oder* `akku: true` und `antwort`.
- **Fehlersuche** (`typ: fehlersuche`): `start` enthält das fehlerhafte Programm, `loesung` das reparierte.

### Assembler-Schreibweise

Jede Zeile belegt die nächste Speicherzelle. `100: 7` springt zur Zelle 100. Erlaubt sind `TAKE 100`, `01.100`, `1100`
oder einfache Zahlen. Kommentare beginnen mit `;`.

### Tutorial-Missionen – `src/content/tutorial/level-XX.md`

Alles steht im Kopfbereich (zwischen `---`):

```yaml
nummer: 3
titel: Der Datenbus
kurz: Kurzbeschreibung für die Übersicht
leitfrage: Wie kommt eine Zahl aus dem Speicher heraus?
sichtbar: [ram, ab, db]          # ram ab db acc ins pc mc microcode log
funktionen: [abInput, dbInput]   # ramEdit asm abInput dbInput microStep macroStep run reset clearRam files controlToggle bonsai record
mikro: [ram->db, db->ram]        # erlaubte Mikrobefehl-Knöpfe oder: alle
programm: |                      # Anfangsinhalt des Speichers
  100: 42
schritte:
  - typ: info
    titel: Überschrift
    text: |
      Erklärung in Markdown
  - typ: aktion
    text: Hole den Inhalt von Zelle **100** auf den Datenbus.
    ziel: { db: 42, benutzt: [ram->db] }   # ram, ramMin, acc, ab, db, ins, pc, mc, halted, benutzt, befehl, modus, tests
    tipp: Erst die Adresse anlegen …
    erfolg: Text nach dem Erreichen des Ziels
    loesung: ["ab = 100", "micro ram->db"]  # Lösungsweg für den automatischen Test
  - typ: quiz
    frage: Welche Aussagen stimmen?
    optionen: ["A", "B", "C"]
    richtig: [0, 2]                # eine Zahl oder eine Liste
    erklaerung: …
  - typ: vorhersage
    frage: Welche Zahl steht danach im Akku?
    antwort: 6
    erklaerung: …
```

Ein Schritt kann mit `vorbereitung:` den Simulator vorbereiten (`reset: true`, `ramLeeren: true`, `programm: |…`,
`ram: {...}`, `register: {acc: 9, pc: 1}`).

Lösungswege (`loesung`) bestehen aus: `ram 010 = 7`, `ab = 10`, `db = 7`, `micro ram->db`, `mikroschritt`,
`makroschritt`, `ausfuehren`, `reset`, `modus bonsai`, `aufnahme 11 DBL`, `aufnahme ende`.

### Von-Neumann-Kapitel – `src/content/kapitel/*.mdx`

Normales Markdown. Interaktive Bausteine werden oben importiert und im Text eingesetzt, z. B.:

```mdx
<Callout typ="merke">Wichtiger Merksatz</Callout>
<Quiz client:visible frage="…" optionen={['A', 'B']} richtig={0} erklaerung="…" />
<DragSort client:visible kategorien={['E', 'V']} karten={[{ text: 'Tastatur', cat: 0 }]} />
```

### Sandbox-Beispiele – `src/content/beispiele/*.yaml`

`titel`, `beschreibung`, optional `modus: bonsai`, `programm` (Assembler).

---

## Lokal entwickeln

Voraussetzung: [Node.js](https://nodejs.org/) 22 oder neuer.

```bash
npm install
npm run dev      # Entwicklungsserver auf http://localhost:4321/
npm test         # Engine-Tests + Prüfung aller Missionen, Aufgaben und Beispiele
npm run build    # statische Website nach dist/
```

## Aufbau

```
src/lib/johnny/      Johnny-Engine (engine.ts), Mikrocode, Assembler, Dateiformate, Prüfung, Tests
src/components/      simulator/ (Johnny), learning/ (Missionen, Aufgaben, Quiz …),
                     vonneumann/, storage/, io/ (Simulationen), content/ (Textbausteine)
src/content/         kapitel/, tutorial/, aufgaben/, beispiele/
src/pages/           Seiten
```

Technik: [Astro](https://astro.build) (statische Seite) + [Svelte 5](https://svelte.dev) für interaktive Teile,
Tests mit [Vitest](https://vitest.dev), Veröffentlichung über GitHub Pages (`.github/workflows/deploy.yml`).

## Quellen & Lizenz

- **Johnny** von Peter Dauscher, **Johnny 2.0** von David Laubersheimer ([GitHub](https://github.com/Laubersheini/johnny), AGPL-3.0).
  Tiny Johnny ist eine eigenständige Neuimplementierung ohne übernommenen Code.
- Didaktische Anregungen: [inf-schule.de – Modellrechner Johnny](https://inf-schule.de/rechner/johnny)
- Code: MIT · Inhalte: CC BY-SA 4.0 (siehe `LICENSE`)
