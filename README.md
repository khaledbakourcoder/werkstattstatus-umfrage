# WerkstattStatus – Kundenumfrage

Mobile Umfrage für Fahrzeugkunden (Phase 2 „Kundensicht“, Folie 9). Die Fragen sind als Knoten in `questions.js` modelliert, die Antworten landen über ein Google Apps Script in einem Google Sheet. Dasselbe Script liefert die Daten als JSON für das spätere Dashboard.

```
questions.js  ──►  survey.js  ──POST──►  Apps Script (doPost)  ──►  Google Sheet
   (Knoten)       (Ablauf,                                              │
                   Validierung)       Dashboard  ◄──GET── Apps Script (doGet)
```

## Dateien

| Datei | Zweck |
|---|---|
| `index.html` | Einstiegsseite |
| `styles.css` | Gestaltung, mobil zuerst, Hell- und Dunkelmodus |
| `questions.js` | Fragen, Optionen, Verzweigungen, Bezug zu Hypothesen/User Stories (`traces`) |
| `survey.js` | Ablauf-Engine: Navigation, Zurück, Validierung, Senden, Offline-Warteschlange |
| `config.js` | URL der Apps-Script-Web-App |
| `apps-script/Code.gs` | Backend im Google Sheet: speichern (`doPost`), auslesen (`doGet`) |

## Einrichtung (ca. 10 Minuten)

1. **Google Sheet anlegen**, z. B. „WerkstattStatus Umfrage“, mit einem gemeinsamen Team-Account.
2. **Script einfügen:** Im Sheet *Erweiterungen → Apps Script*, Inhalt von `Code.gs` einfügen, speichern. Funktion `setup` auswählen und *Ausführen* (Berechtigung bestätigen). Danach gibt es das Blatt „Antworten“.
3. **Als Web-App bereitstellen:** *Bereitstellen → Neue Bereitstellung → Typ: Web-App*
   - Ausführen als: **Ich**
   - Zugriff: **Jeder**
   Die angezeigte URL (`https://script.google.com/macros/s/…/exec`) in `config.js` bei `SCRIPT_URL` eintragen.
4. **Hosten**, z. B. über GitHub Pages (Ordner ins Repo, *Settings → Pages*) oder Vercel. Lokal testen: `npx serve .` im Ordner.
5. **Testen:** Einmal komplett durchklicken und prüfen, ob eine Zeile im Blatt „Antworten“ erscheint. Testzeilen vor dem Start löschen.

Ohne `SCRIPT_URL` läuft die Umfrage im **Testmodus** und gibt die Antworten nur in der Browser-Konsole aus.

> Nach jeder Änderung an `Code.gs` muss die Bereitstellung aktualisiert werden (*Bereitstellungen verwalten → Bearbeiten → Neue Version*), sonst läuft weiter die alte Version.

## Fragen ändern

Alles passiert in `questions.js`:

```js
F5: {
  section: "B",
  type: "single",                       // "single" | "multi" | "text"
  text: "Haben Sie … nachgefragt?",
  options: [
    { label: "Nein", next: "F8" },      // Verzweigung: Option bestimmt den Folgeknoten
    { label: "Ja, einmal", next: "F6" },
  ],
  traces: ["H01"],                      // Bezug für Doku und Dashboard
}
```

- Neue Frage: Knoten ergänzen, im Vorgängerknoten `next` darauf zeigen lassen, **ID hinten in `QUESTION_IDS` in `Code.gs` anhängen**.
- Nach inhaltlichen Änderungen `version` erhöhen, damit Antworten unterschiedlicher Fragebogenversionen im Sheet unterscheidbar bleiben.

## Datenformat im Sheet

Blatt **„Antworten“**, eine Zeile pro Teilnahme:

| Spalte | Inhalt |
|---|---|
| `submittedAt`, `startedAt` | Zeitpunkte |
| `durationSec` | Bearbeitungsdauer |
| `sessionId` | Zufalls-ID gegen Doppelspeicherung, kein Personenbezug |
| `version` | Fragebogenversion |
| `path` | gegangener Pfad, z. B. `F1>F2>F3>F10>…` |
| `F1` … `F14`, `FREITEXT` | Antworttexte; Mehrfachantworten mit ` \| ` getrennt; **leer = Frage wurde nicht gezeigt** |

Für die Auswertung heißt „leer“ nicht „keine Meinung“, sondern „nicht im Pfad“. Das n pro Frage ist die Zahl der nicht leeren Zellen.

## Daten für das Dashboard

```js
const res = await fetch(SCRIPT_URL);          // ggf. SCRIPT_URL + "?token=…"
const { rows, count, updatedAt } = await res.json();
// rows: [{ submittedAt, F1: "25–39", F6: "A | B", … }]
```

Das Dashboard kann `questions.js` ebenfalls einbinden und daraus Fragetexte, Optionsreihenfolge und `traces` für Beschriftungen und den Bezug zu H01–H04 übernehmen. Optional `READ_TOKEN` in `Code.gs` setzen.

## Datenschutz

- Die Umfrage erhebt keine Kontaktdaten (kein Name, keine E-Mail, keine Telefonnummer) und speichert keine IP-Adressen.
- Freitexte werden auf 1000 Zeichen begrenzt; Zellen, die mit `=`, `+`, `-` oder `@` beginnen, werden entschärft (Formel-Injection).
