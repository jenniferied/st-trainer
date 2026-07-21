// ============ Lernmethoden-Info-System (Block F, NextGen-Plan) ============
// Wiederverwendbarer kleiner Info-Button: erklaert die Lernmethode hinter einem
// Feature in einfacher Sprache + 1 Satz Studienbefund. Ueberall einsetzbar:
// infoBtn("selbsterklaerung") liefert den Button-HTML, der Klick-Handler ist
// einmal global installiert (Bottom-Sheet, mobil-freundlich).

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export const METHODEN = {
  selbsterklaerung: {
    icon: "💬",
    name: "Selbsterklärung beim Feedback",
    text: "Wenn du erst selbst überlegst, warum eine Antwort falsch war, und DANN die Erklärung liest, merkt sich dein Gehirn die Korrektur viel besser. Besonders stark wirkt das, wenn du dir sicher warst und es doch anders kam — genau diese Aha-Momente bleiben am längsten hängen.",
    studie: "Chi et al. 1994: Selbsterklären verdoppelte den Lernzuwachs beim Textlernen. Butterfield & Metcalfe 2006: Fehler, bei denen man sich sicher war, werden nach Korrektur am besten behalten (Hypercorrection-Effekt).",
  },
  interleaving: {
    icon: "🔀",
    name: "Kontrastlernen (Interleaving)",
    text: "Ähnliche Konzepte gemischt zu üben — immer im direkten Vergleich — trainiert genau das, was die Klausur prüft: die feinen Unterschiede. Wer Parsons und Fend nur getrennt lernt, verwechselt sie unter Druck; wer sie ständig gegeneinander sortiert, nicht.",
    studie: "Rohrer & Taylor 2007: Gemischtes Üben schlug geblocktes Üben im Test um mehr als das Doppelte — obwohl es sich beim Üben schwerer anfühlt.",
  },
  operatoren: {
    icon: "🔎",
    name: "Operatoren-Wortschatz",
    text: "Prüfungsfragen haben ihre eigene Fachsprache: 'trifft NICHT zu', 'kennzeichnet', 'im Sinne von'. Diese Wendungen sind lernbar wie Vokabeln. Wer sie automatisch erkennt, spart in der Klausur Zeit und tappt in weniger Fallen — ganz unabhängig vom Stoff.",
    studie: "Forschung zur Bildungssprache (z. B. Schleppegrell 2004): Schulaufgaben scheitern oft an der Aufgabensprache, nicht am Wissen — gezieltes Training der Aufgabenwörter hilft messbar.",
  },
  paraphrasieren: {
    icon: "🗣",
    name: "Paraphrasieren vor dem Antworten (RAP)",
    text: "Lesen — sich selbst fragen 'Was will die Frage von mir?' — in eigenen Worten sagen. Dieser kleine Zwischenschritt entlastet das Arbeitsgedächtnis, gerade bei langen Sätzen und NICHT-Fragen: Erst verstehen, dann kreuzen.",
    studie: "RAP-Strategie nach Schumaker & Deshler: Paraphrasieren verbesserte das Textverständnis in mehreren Studien deutlich — am stärksten bei sprachlich schweren Aufgaben.",
  },
  abstempeln: {
    icon: "✅",
    name: "Optionen einzeln beurteilen",
    text: "Aus einer NICHT-Frage mit 6 Optionen werden 6 einfache Ja/Nein-Urteile: 'Stimmt dieser Satz — ja oder nein?' Erst am Ende drehst du um, was die Frage verlangt. So muss dein Kopf nicht gleichzeitig die Negation UND alle Optionen jonglieren.",
    studie: "Negationen kosten nachweislich Verarbeitungszeit und Fehler (Psycholinguistik, z. B. Clark & Chase 1972). Deine eigenen Daten zeigen es auch: NICHT-Fragen sind dein teuerster Fragetyp.",
  },
  relearning: {
    icon: "📅",
    name: "Verteiltes Üben (Successive Relearning)",
    text: "Jeden Tag 20 bis 30 Minuten schlägt zweimal pro Woche zwei Stunden — bei gleicher Gesamtzeit. Das Gehirn festigt Wissen in den Pausen zwischen den Übungstagen. Kleine tägliche Runden sind deshalb kein 'zu wenig', sie sind die effizienteste Form.",
    studie: "Cepeda et al. 2006 (Meta-Analyse mit 839 Vergleichen): Verteiltes Üben schlägt Massieren fast immer. Rawson & Dunlosky 2011: mehrfaches erneutes Abrufen über Tage brachte die stabilsten Klausurleistungen.",
  },
  retrieval: {
    icon: "🧠",
    name: "Abrufübung (Retrieval Practice)",
    text: "Sich an etwas zu erinnern versuchen ist Training, kein Test. Jede Frage, die du beantwortest — auch falsch! — festigt die Spur im Gedächtnis stärker als dreimal Nachlesen. Deshalb besteht diese App aus Fragen statt aus Zusammenfassungen.",
    studie: "Roediger & Karpicke 2006: Einmal abrufen brachte nach einer Woche deutlich mehr als wiederholtes Lesen — der am besten belegte Effekt der Lernforschung.",
  },
};

export const infoBtn = (key, cls = "") =>
  METHODEN[key] ? `<button type="button" class="info-btn ${cls}" data-methode="${key}" title="Warum das hilft" aria-label="Info: ${esc(METHODEN[key].name)}">ⓘ</button>` : "";

function zeigeSheet(key) {
  const m = METHODEN[key];
  if (!m) return;
  const ov = document.createElement("div");
  ov.className = "sheet-ov";
  ov.innerHTML = `<div class="sheet" role="dialog" aria-label="${esc(m.name)}">
    <div class="sheet-grip"></div>
    <h3>${m.icon} ${esc(m.name)}</h3>
    <p>${esc(m.text)}</p>
    <p class="sheet-studie">📚 ${esc(m.studie)}</p>
    <button class="btn small" data-sheet-close>Alles klar</button>
  </div>`;
  document.body.appendChild(ov);
  const zu = () => ov.remove();
  ov.addEventListener("click", (e) => { if (e.target === ov || e.target.closest("[data-sheet-close]")) zu(); });
}

// Delegierter Handler — einmalig, funktioniert damit auch in nachgerendertem HTML
document.addEventListener("click", (e) => {
  const b = e.target.closest(".info-btn[data-methode]");
  if (!b) return;
  e.preventDefault();
  e.stopPropagation();
  zeigeSheet(b.dataset.methode);
});
