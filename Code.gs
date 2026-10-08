/**
 * WerkstattStatus – Google Apps Script für die Kundenumfrage
 *
 * doPost  nimmt Antworten der Umfrage entgegen und schreibt sie ins Google Sheet
 * doGet   liefert die Antworten als JSON für das spätere Dashboard (ohne Tester-Kontakte)
 * setup   legt einmalig die Tabellenblätter und Kopfzeilen an
 *
 * Einrichtung: siehe README.md
 */

const SHEET_RESPONSES = "Antworten";
const SHEET_TESTER = "Tester";

// Muss zu den IDs in questions.js passen. Neue Fragen hinten anhängen, nie umsortieren.
const QUESTION_IDS = ["F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9",
                      "F10", "F11", "F12", "F13", "F14", "FREITEXT"];
const META_COLUMNS = ["submittedAt", "startedAt", "durationSec", "sessionId", "version", "path"];
const RESPONSE_HEADER = META_COLUMNS.concat(QUESTION_IDS);
const TESTER_HEADER = ["createdAt", "contact"];

// Optional: Wenn gesetzt, verlangt doGet ?token=… (einfacher Schutz für das Dashboard).
const READ_TOKEN = "";

/** Einmalig im Editor ausführen: legt Blätter und Kopfzeilen an. */
function setup() {
  ensureSheet_(SHEET_RESPONSES, RESPONSE_HEADER);
  ensureSheet_(SHEET_TESTER, TESTER_HEADER);
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000); // verhindert, dass gleichzeitige Antworten sich überschreiben
  try {
    const data = JSON.parse(e.postData.contents);

    if (data.action === "tester") {
      const sheet = ensureSheet_(SHEET_TESTER, TESTER_HEADER);
      sheet.appendRow([new Date(), clean_(data.contact, 120)]);
      return json_({ ok: true });
    }

    if (data.action === "response") {
      const sheet = ensureSheet_(SHEET_RESPONSES, RESPONSE_HEADER);
      // Doppelte Sendungen (z. B. aus der Offline-Warteschlange) erkennen
      if (sessionExists_(sheet, data.sessionId)) return json_({ ok: true, duplicate: true });

      const a = data.answers || {};
      const row = [
        new Date(data.submittedAt || Date.now()),
        new Date(data.startedAt || Date.now()),
        Number(data.durationSec) || "",
        clean_(data.sessionId, 64),
        clean_(data.version, 10),
        clean_(data.path, 200),
      ].concat(QUESTION_IDS.map(function (id) { return clean_(a[id], 1000); }));
      sheet.appendRow(row);
      return json_({ ok: true });
    }

    return json_({ ok: false, error: "unknown action" });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

/** Liefert alle Antworten als JSON: { updatedAt, count, columns, rows: [{F1: "...", ...}] } */
function doGet(e) {
  if (READ_TOKEN && (!e.parameter || e.parameter.token !== READ_TOKEN)) {
    return json_({ ok: false, error: "unauthorized" });
  }
  const sheet = ensureSheet_(SHEET_RESPONSES, RESPONSE_HEADER);
  const values = sheet.getDataRange().getValues();
  const header = values.shift();
  const rows = values.map(function (r) {
    const o = {};
    header.forEach(function (h, i) {
      if (h === "sessionId") return; // für das Dashboard nicht nötig
      o[h] = r[i] instanceof Date ? r[i].toISOString() : r[i];
    });
    return o;
  });
  return json_({ ok: true, updatedAt: new Date().toISOString(), count: rows.length,
                 columns: header.filter(function (h) { return h !== "sessionId"; }), rows: rows });
}

// ---------- Hilfsfunktionen ----------

function ensureSheet_(name, header) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(header);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, header.length).setFontWeight("bold");
  }
  return sheet;
}

function sessionExists_(sheet, sessionId) {
  if (!sessionId || sheet.getLastRow() < 2) return false;
  const col = RESPONSE_HEADER.indexOf("sessionId") + 1;
  const found = sheet.getRange(2, col, sheet.getLastRow() - 1, 1)
    .createTextFinder(String(sessionId)).matchEntireCell(true).findNext();
  return !!found;
}

/** Kürzt Text und verhindert Formel-Injection (Zellen, die mit = + - @ beginnen). */
function clean_(v, max) {
  if (v === null || v === undefined) return "";
  let s = String(v).slice(0, max);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
