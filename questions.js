/**
 * WerkstattStatus – Kundenumfrage: Fragen als Knoten (Nodes)
 *
 * Diese Datei ist die einzige Quelle für Fragen, Optionen und Ablauf.
 * Sie wird von der Umfrage (survey.js) UND später vom Dashboard genutzt,
 * damit Spaltennamen im Google Sheet und Diagrammbeschriftungen immer übereinstimmen.
 *
 * Aufbau eines Knotens:
 *   id         Eindeutige ID, gleichzeitig Spaltenname im Google Sheet
 *   section    "A" | "B" | "C"  (Teil der Umfrage, steuert die Fortschrittsanzeige)
 *   type       "intro" | "single" | "multi" | "text" | "end"
 *   text       Fragetext
 *   hint       optionaler Hinweis unter der Frage
 *   options    [{ label, next?, other? }]  – next überschreibt das next des Knotens (Verzweigung)
 *   next       ID des Folgeknotens
 *   maxSelect  nur bei "multi": maximale Anzahl Antworten
 *   optional   true = Frage darf übersprungen werden
 *   traces     Bezug zu Hypothesen / User Stories (Pre-Traceability, für Dashboard und Doku)
 */
window.SURVEY = {
  version: "1.0",
  start: "intro",

  sections: {
    A: "Zu Ihnen",
    B: "Ihr letzter Werkstattbesuch",
    C: "Ihre Wünsche",
  },

  nodes: {
    intro: {
      type: "intro",
      text: "Wie läuft Ihr Werkstattbesuch – und was würde ihn einfacher machen?",
      hint:
        "Wir sind ein studentisches Team der Hochschule Flensburg und entwickeln eine Anwendung, " +
        "die die Kommunikation zwischen Kfz-Werkstätten und Kunden verbessern soll. " +
        "Die Umfrage ist anonym und dauert etwa 4 Minuten.",
      next: "F1",
    },

    // ---------- Teil A: Zur Person und Werkstatt ----------
    F1: {
      section: "A",
      type: "single",
      text: "Wie alt sind Sie?",
      options: [{ label: "unter 25" }, { label: "25–39" }, { label: "40–59" }, { label: "60 oder älter" }],
      next: "F2",
      traces: ["Stichprobe"],
    },
    F2: {
      section: "A",
      type: "single",
      text: "Wo lassen Sie Ihr Fahrzeug meist warten oder reparieren?",
      options: [
        { label: "Autohaus / Vertragswerkstatt" },
        { label: "Freie Werkstatt" },
        { label: "Werkstattkette (z. B. ATU, Pit-Stop)" },
        { label: "Unterschiedlich" },
      ],
      next: "F3",
      traces: ["Stichprobe", "Zielgruppe Folie 4"],
    },
    F3: {
      section: "A",
      type: "single",
      text: "Wie oft ist Ihr Fahrzeug ungefähr pro Jahr in der Werkstatt?",
      options: [
        { label: "Gar nicht", next: "F10" },
        { label: "1-mal", next: "F4" },
        { label: "2- bis 3-mal", next: "F4" },
        { label: "Mehr als 3-mal", next: "F4" },
      ],
      traces: ["Filter"],
    },

    // ---------- Teil B: Letzter Werkstattbesuch ----------
    F4: {
      section: "B",
      type: "single",
      text: "Haben Sie Ihr Fahrzeug beim letzten Besuch dort gelassen oder vor Ort gewartet?",
      options: [
        { label: "Dort gelassen", next: "F5" },
        { label: "Vor Ort gewartet", next: "F8" },
      ],
      traces: ["Filter"],
    },
    F5: {
      section: "B",
      type: "single",
      text: "Haben Sie während der Reparatur nachgefragt, wie weit sie ist?",
      options: [
        { label: "Nein", next: "F8" },
        { label: "Ja, einmal", next: "F6" },
        { label: "Ja, mehrmals", next: "F6" },
      ],
      traces: ["H01"],
    },
    F6: {
      section: "B",
      type: "multi",
      text: "Warum haben Sie nachgefragt?",
      hint: "Mehrere Antworten möglich.",
      options: [
        { label: "Fertigstellung war unklar" },
        { label: "Ich musste meinen Tag planen" },
        { label: "Die Werkstatt hatte sich nicht gemeldet" },
        { label: "Meine Fahrzeug-App zeigte, dass das Auto bewegt wurde" },
        { label: "Sonstiges", other: true },
      ],
      next: "F7",
      traces: ["H01", "Interview Abschn. 3"],
    },
    F7: {
      section: "B",
      type: "single",
      text: "Hätte Ihnen eine Online-Statusanzeige diesen Anruf erspart?",
      options: [{ label: "Ja" }, { label: "Eher ja" }, { label: "Eher nein" }, { label: "Nein" }],
      next: "F8",
      traces: ["H02", "US-01"],
    },
    F8: {
      section: "B",
      type: "single",
      text: "Hat eine Werkstatt Sie schon einmal wegen zusätzlicher Arbeiten oder Mehrkosten kontaktiert?",
      options: [
        { label: "Ja", next: "F9" },
        { label: "Nein", next: "F10" },
      ],
      traces: ["Filter"],
    },
    F9: {
      section: "B",
      type: "single",
      text: "Wie schnell konnten Sie der Werkstatt damals antworten?",
      options: [
        { label: "Sofort" },
        { label: "Innerhalb weniger Stunden" },
        { label: "Erst am nächsten Tag oder später" },
        { label: "Weiß ich nicht mehr" },
      ],
      next: "F10",
      traces: ["Interview Abschn. 5"],
    },

    // ---------- Teil C: Wünsche ----------
    F10: {
      section: "C",
      type: "single",
      text: "Wie möchten Sie über zusätzliche Arbeiten an Ihrem Fahrzeug am liebsten entscheiden?",
      options: [
        { label: "Online, mit Beschreibung, Foto und Kosten" },
        { label: "Telefonisch" },
        { label: "Kommt auf die Höhe der Kosten an" },
      ],
      next: "F11",
      traces: ["H03", "US-04", "US-05"],
    },
    F11: {
      section: "C",
      type: "single",
      text: "Würden Sie der Werkstatt vorab ein Kostenlimit nennen, bis zu dem sie ohne Rückfrage reparieren darf?",
      options: [{ label: "Ja" }, { label: "Nein" }, { label: "Kommt auf die Werkstatt an" }],
      next: "F12",
      traces: ["US-06"],
    },
    F12: {
      section: "C",
      type: "multi",
      maxSelect: 2,
      text: "Was wäre Ihnen bei einer zusätzlichen Reparatur am wichtigsten?",
      hint: "Bitte höchstens 2 auswählen.",
      options: [
        { label: "Foto des Mangels" },
        { label: "Genaue Kosten" },
        { label: "Ob es sicherheitsrelevant ist" },
        { label: "Wie lange es länger dauert" },
        { label: "Eine verständliche Erklärung" },
      ],
      next: "F13",
      traces: ["H04", "US-07"],
    },
    F13: {
      section: "C",
      type: "single",
      text: "Wie möchten Sie informiert werden, wenn Ihr Fahrzeug abholbereit ist?",
      options: [{ label: "SMS" }, { label: "E-Mail" }, { label: "WhatsApp" }, { label: "Anruf" }, { label: "Egal" }],
      next: "F14",
      traces: ["US-03", "NFR Benachrichtigung"],
    },
    F14: {
      section: "C",
      type: "single",
      text: "Wie würden Sie eine Statusanzeige am liebsten nutzen?",
      options: [
        { label: "Eine App installieren" },
        { label: "Einen Link per SMS oder E-Mail öffnen, ohne Anmeldung" },
        { label: "Ein Konto mit Passwort anlegen" },
        { label: "Gar nicht" },
      ],
      next: "FREITEXT",
      traces: ["NFR Zugang", "Architektur PWA/Auth"],
    },
    FREITEXT: {
      section: "C",
      type: "text",
      optional: true,
      text: "Was stört Sie am meisten beim Werkstattbesuch?",
      hint: "Optional – gern ein, zwei Sätze.",
      next: "end",
      traces: ["Offene Erhebung"],
    },

    end: {
      type: "end",
      text: "Danke! Ihre Antworten sind gespeichert.",
      hint: "Sie helfen uns damit, eine Anwendung zu entwickeln, die sich am echten Werkstattalltag orientiert. Sie können diese Seite jetzt schließen.",
    },
  },
};
