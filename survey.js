/**
 * WerkstattStatus – Umfrage-Engine
 *
 * Läuft die Knoten aus questions.js ab, prüft Eingaben und sendet das Ergebnis
 * an eine Google-Apps-Script-Web-App, die es in ein Google Sheet schreibt.
 *
 * Datenfluss:  questions.js (Knoten) → survey.js (Ablauf, Validierung) → Apps Script → Google Sheet
 */
(function () {
  "use strict";

  const S = window.SURVEY;
  const CFG = window.SURVEY_CONFIG || {};
  const QUEUE_KEY = "werkstattstatus-umfrage-queue";
  const SEP = " | "; // Trennzeichen für Mehrfachantworten in einer Sheet-Zelle

  // ---------- Zustand ----------
  const state = {
    current: S.start,
    history: [],          // bisher besuchte Knoten (für "Zurück" und den Pfad)
    answers: {},          // { F1: "unter 25", F6: ["…", "…"], … }
    other: {},            // Freitext zu "Sonstiges"-Optionen
    startedAt: new Date(),
    sessionId: makeId(),
  };

  const $ = (sel) => document.querySelector(sel);
  const el = (tag, attrs = {}, ...children) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") n.className = v;
      else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
      else if (v !== false && v != null) n.setAttribute(k, v === true ? "" : v);
    }
    children.flat().forEach((c) => c != null && n.append(c));
    return n;
  };

  function makeId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "s-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  // ---------- Ablauflogik ----------

  /** Ermittelt den Folgeknoten. Eine gewählte Option mit eigenem next hat Vorrang (Verzweigung). */
  function nextId(id) {
    const node = S.nodes[id];
    if (node.type === "single") {
      const opt = (node.options || []).find((o) => o.label === state.answers[id]);
      if (opt && opt.next) return opt.next;
    }
    return node.next;
  }

  /** Prüft die Eingabe des aktuellen Knotens. Liefert eine Fehlermeldung oder null. */
  function validate(id) {
    const node = S.nodes[id];
    const a = state.answers[id];
    if (node.type === "single" && !a) return "Bitte wählen Sie eine Antwort.";
    if (node.type === "multi") {
      if (!a || a.length === 0) return "Bitte wählen Sie mindestens eine Antwort.";
      if (node.maxSelect && a.length > node.maxSelect) return `Bitte höchstens ${node.maxSelect} auswählen.`;
      const otherOpt = node.options.find((o) => o.other);
      if (otherOpt && a.includes(otherOpt.label) && !(state.other[id] || "").trim())
        return "Bitte beschreiben Sie kurz, was Sie mit „Sonstiges“ meinen.";
    }
    if (node.type === "text" && !node.optional && !(a || "").trim()) return "Bitte geben Sie eine Antwort ein.";
    return null;
  }

  function goNext() {
    const err = validate(state.current);
    if (err) return showError(err);
    state.history.push(state.current);
    state.current = nextId(state.current);
    if (S.nodes[state.current].type === "end") submit();
    render(true);
  }

  function goBack() {
    if (!state.history.length) return;
    state.current = state.history.pop();
    render(true);
  }

  // ---------- Fortschritt ----------

  /** Fortschritt innerhalb der drei Teile: welcher Teil ist aktiv, wie viele Fragen davon wurden beantwortet. */
  function progress() {
    const order = ["A", "B", "C"];
    const node = S.nodes[state.current];
    const activeIdx = node.type === "intro" ? -1 : node.type === "end" ? 3 : order.indexOf(node.section);
    return order.map((sec, i) => {
      const ids = Object.keys(S.nodes).filter((k) => S.nodes[k].section === sec);
      const done = state.history.filter((h) => S.nodes[h].section === sec).length;
      let fill = 0;
      if (i < activeIdx) fill = 1;
      else if (i === activeIdx) fill = Math.min(0.92, done / Math.max(ids.length - 1, 1));
      return { sec, label: S.sections[sec], fill, state: i < activeIdx ? "done" : i === activeIdx ? "active" : "todo" };
    });
  }

  function renderProgress() {
    const wrap = $("#progress");
    wrap.innerHTML = "";
    progress().forEach((p) =>
      wrap.append(
        el("li", { class: `stage stage--${p.state}`, "aria-current": p.state === "active" ? "step" : null },
          el("span", { class: "stage__bar" }, el("span", { class: "stage__fill", style: `transform:scaleX(${p.fill})` })),
          el("span", { class: "stage__label" }, p.label))
      )
    );
  }

  // ---------- Darstellung ----------

  function showError(msg) {
    const box = $("#error");
    box.textContent = msg;
    box.hidden = false;
    box.focus();
  }
  function clearError() {
    const box = $("#error");
    if (box) { box.hidden = true; box.textContent = ""; }
  }

  function render(moveFocus) {
    const node = S.nodes[state.current];
    const main = $("#question");
    main.innerHTML = "";
    renderProgress();

    const title = el("h1", { class: "q__text", id: "q-title", tabindex: "-1" }, node.text);
    const hint = node.hint ? el("p", { class: "q__hint", id: "q-hint" }, node.hint) : null;
    const error = el("p", { class: "q__error", id: "error", role: "alert", tabindex: "-1", hidden: true });

    if (node.type === "intro") {
      main.append(title, hint,
        el("div", { class: "actions" }, el("button", { class: "btn btn--primary", onclick: goNext }, "Umfrage starten")));
    } else if (node.type === "end") {
      main.append(title, hint, el("p", { class: "q__status", id: "save-note", hidden: true }));
    } else {
      main.append(title, hint, field(node), error,
        el("div", { class: "actions" },
          el("button", { class: "btn btn--ghost", onclick: goBack }, "Zurück"),
          el("button", { class: "btn btn--primary", id: "next-btn", onclick: goNext },
            node.optional && !(state.answers[state.current] || "").trim() ? "Überspringen" : "Weiter")));
    }
    if (moveFocus) title.focus();
  }

  /** Baut das Eingabefeld passend zum Knotentyp. */
  function field(node) {
    const id = state.current;
    if (node.type === "text") {
      return el("textarea", {
        class: "q__textarea", rows: "4", maxlength: "1000", "aria-labelledby": "q-title",
        oninput: (e) => {
          state.answers[id] = e.target.value;
          clearError();
          const btn = document.getElementById("next-btn");
          if (btn && node.optional) btn.textContent = e.target.value.trim() ? "Weiter" : "Überspringen";
        },
      }, state.answers[id] || "");
    }

    const multi = node.type === "multi";
    const selected = multi ? state.answers[id] || [] : state.answers[id];
    const fs = el("fieldset", { class: "options" }, el("legend", { class: "sr-only" }, node.text));

    node.options.forEach((opt, i) => {
      const inputId = `${id}-${i}`;
      const checked = multi ? selected.includes(opt.label) : selected === opt.label;
      const input = el("input", {
        type: multi ? "checkbox" : "radio", name: id, id: inputId, value: opt.label, checked,
        onchange: (e) => {
          clearError();
          if (multi) {
            const set = new Set(state.answers[id] || []);
            e.target.checked ? set.add(opt.label) : set.delete(opt.label);
            state.answers[id] = node.options.map((o) => o.label).filter((l) => set.has(l));
            if (node.maxSelect && state.answers[id].length > node.maxSelect)
              showError(`Bitte höchstens ${node.maxSelect} auswählen.`);
            if (opt.other) render(false);
          } else {
            state.answers[id] = opt.label;
          }
        },
      });
      const row = el("label", { class: "option", for: inputId }, input,
        el("span", { class: "option__mark", "aria-hidden": "true" }),
        el("span", { class: "option__label" }, opt.label));
      fs.append(row);

      if (opt.other && checked) {
        fs.append(el("input", {
          class: "option__other", type: "text", maxlength: "200", "aria-label": "Sonstiges, bitte beschreiben",
          placeholder: "Bitte kurz beschreiben", value: state.other[id] || "",
          oninput: (e) => { state.other[id] = e.target.value; clearError(); },
        }));
      }
    });
    return fs;
  }

  // ---------- Speichern ----------

  /** Baut die Zeile für das Google Sheet. Nur Antworten auf dem tatsächlich gegangenen Pfad zählen. */
  function buildPayload() {
    const visited = new Set(state.history);
    const answers = {};
    Object.keys(S.nodes).forEach((id) => {
      const node = S.nodes[id];
      if (!["single", "multi", "text"].includes(node.type)) return;
      if (!visited.has(id)) { answers[id] = ""; return; } // nicht gesehen → leer (wichtig für n pro Frage)
      let v = state.answers[id];
      if (Array.isArray(v)) {
        v = v.map((label) => {
          const o = node.options.find((x) => x.label === label);
          return o && o.other && state.other[id] ? `${label}: ${state.other[id].trim()}` : label;
        }).join(SEP);
      }
      answers[id] = (v || "").toString().trim();
    });
    const now = new Date();
    return {
      action: "response",
      version: S.version,
      sessionId: state.sessionId,
      startedAt: state.startedAt.toISOString(),
      submittedAt: now.toISOString(),
      durationSec: Math.round((now - state.startedAt) / 1000),
      path: state.history.filter((h) => S.nodes[h].type !== "intro").join(">"),
      answers,
    };
  }

  async function post(payload) {
    if (!CFG.SCRIPT_URL) {
      console.info("[Testmodus] Keine SCRIPT_URL gesetzt. Payload:\n" + JSON.stringify(payload, null, 2));
      return true;
    }
    // text/plain vermeidet den CORS-Preflight, den Apps Script nicht beantwortet.
    await fetch(CFG.SCRIPT_URL, { method: "POST", mode: "no-cors", body: JSON.stringify(payload) });
    return true;
  }

  /** Fehlgeschlagene Sendungen landen in einer Warteschlange und werden beim nächsten Laden erneut gesendet. */
  function readQueue() { try { return JSON.parse(localStorage.getItem(QUEUE_KEY)) || []; } catch { return []; } }
  function writeQueue(q) { try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); } catch { /* ignorieren */ } }

  async function send(payload) {
    try { await post(payload); return true; }
    catch (e) { writeQueue([...readQueue(), payload]); return false; }
  }

  async function flushQueue() {
    const q = readQueue();
    if (!q.length) return;
    const rest = [];
    for (const p of q) { try { await post(p); } catch { rest.push(p); } }
    writeQueue(rest);
  }

  async function submit() {
    const ok = await send(buildPayload());
    const note = $("#save-note");
    if (note && !ok) {
      note.hidden = false;
      note.textContent = "Keine Verbindung. Ihre Antworten werden gesendet, sobald Sie diese Seite wieder öffnen.";
    }
  }

  // ---------- Start ----------
  flushQueue();
  render(false);
})();
