// Beleg-Sprungmarken: macht aus den Quellen-Ankern in den Erklaerungen
// ("Folie 46", "§ 37", "Art. 7 GG") anklickbare Chips.
//   - Folien  -> oeffnen die Vorlesungsfolie an genau der Stelle (In-App-Viewer)
//   - §-Paragraphen -> Deep-Link ins Brandenburgische Schulgesetz (bravors)
//   - GG-Artikel -> Deep-Link ins Grundgesetz (gesetze-im-internet)
//
// Die Folien liegen als Einzelbilder unter data/folien/folie-NNN.jpg (aus dem
// gemergten 317-Seiten-PDF gerendert). Vorteil gegenueber einem PDF-Viewer:
// Rose laedt nur die Folie, die sie antippt (mobil sparsam), es gibt keinen
// Renderer, der haengen kann, und getippte Folien liegen offline im Cache.
//
// Aufgedruckte Foliennummer startet je Sitzung neu bei 1; die absolute
// PDF-/Bild-Seite = Foliennummer + Offset der Sitzung (Reihenfolge im gemergten
// PDF, siehe materialien/folien-referenz.md). Bei Schulqualitaet sind die
// aufgedruckten Nummern leicht unzuverlaessig (Animations-Dubletten) -> der
// Sprung landet in der Naehe, mit den Blaettern-Pfeilen justiert Rose selbst.

const OFFSET = {
  "unterricht-motivierend": 0,   // PDF 1-39   (1:1)
  "schultheorie-3": 39,          // PDF 40-77
  "schultheorie-2": 77,          // PDF 78-113
  "schultheorie-1": 113,         // PDF 114-163
  "schulqualitaet": 163,         // PDF 164-224 (Nummern erratisch -> ca.)
  "schulrecht": 224,             // PDF 225-317
};
const SITZUNG = {
  "unterricht-motivierend": "Unterricht motivierend gestalten",
  "schultheorie-3": "Schultheorie III",
  "schultheorie-2": "Schultheorie II",
  "schultheorie-1": "Schultheorie I",
  "schulqualitaet": "Schulqualität",
  "schulrecht": "Schulrecht",
};
export const TOTAL = 317;
export const bildUrl = (seite) => `data/folien/folie-${String(seite).padStart(3, "0")}.jpg`;

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export function folienSeite(thema, folie) {
  const off = OFFSET[thema];
  if (off == null || !Number.isFinite(folie)) return null;
  return Math.min(TOTAL, Math.max(1, folie + off));
}

// Relevante Folien einer Frage: alle "Folie N"-/"Folien N-M"-Anker aus den
// Options-Erklaerungen UND dem Konzept-Feld, als absolute Bildseiten,
// meistreferenzierte zuerst. Grundlage fuer die Foliensicht im Klausurmodus.
// (Konzept mitlesen ist wichtig: manche Fragen tragen ihren Beleg nur dort —
// sonst zeigt das Panel "keine Folie", obwohl es eine gibt.)
export function relevanteFolien(q) {
  const zaehl = new Map();
  const texte = [q.konzept || "", ...(q.optionen || []).map((o) => o.erklaerung || "")];
  for (const t of texte) {
    for (const m of String(t).matchAll(/Folien?\s?(\d{1,3})(?:\s?[–-]\s?(\d{1,3}))?/g)) {
      const von = +m[1], bis = m[2] ? +m[2] : von;
      // Ranges expandieren, aber nur plausible (kleine) Spannen
      for (let f = von; f <= Math.min(bis, von + 6); f++) {
        const seite = folienSeite(q.oberthema, f);
        if (seite) zaehl.set(seite, (zaehl.get(seite) || 0) + (f === von ? 1 : 0.5));
      }
    }
  }
  return [...zaehl.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]).map((e) => e[0]);
}

// Erklaerungstext -> HTML mit Beleg-Chips. Gibt bereits escapten HTML zurueck.
export function render(text, thema) {
  let s = esc(text);
  const berlin = /Berlin/.test(text); // Berliner SchulG != BbgSchulG -> § nicht verlinken
  // 1) GG-Artikel ("Art. 7 GG")
  s = s.replace(/Art\.?\s?(\d+)([a-z])?\s?GG/g, (m, n) =>
    `<a class="beleg law" target="_blank" rel="noopener" href="https://www.gesetze-im-internet.de/gg/art_${n}.html">📖 ${m}</a>`);
  // 2) Brandenburgisches Schulgesetz ("§ 37", "§ 46a")
  if (!berlin) {
    s = s.replace(/§\s?(\d+)([a-z])?/g, (m, n) =>
      `<a class="beleg law" target="_blank" rel="noopener" href="https://bravors.brandenburg.de/gesetze/bbgschulg#${n}">📖 ${m}</a>`);
  }
  // 3) Folien ("Folie 46", "Folien 44-46") -> In-App-Folien-Viewer
  s = s.replace(/Folien?\s?(\d{1,3})(\s?[–-]\s?\d{1,3})?/g, (m, n) => {
    const seite = folienSeite(thema, +n);
    if (!seite) return m;
    const cap = `${SITZUNG[thema] || ""} · ${m}`;
    return `<button type="button" class="beleg folie" data-seite="${seite}" data-cap="${esc(cap)}">📄 ${m}</button>`;
  });
  // In einen Span, damit .explain (display:flex) den Text als EIN Flex-Item mit
  // normalem Inline-Fluss behandelt und die Chips nicht als Spalten umbrechen.
  return `<span class="bt">${s}</span>`;
}

// ---- Folien-Viewer ---------------------------------------------------------
let vState = null; // { seite, quelle, zoom, ov, img, capEl }

function baueOverlay() {
  const ov = document.createElement("div");
  ov.className = "folien-ov";
  ov.innerHTML = `
    <div class="folien-box">
      <div class="folien-bar">
        <button class="fv-btn" data-fv="prev" title="Vorige Folie" aria-label="Vorige Folie">‹</button>
        <span class="folien-cap" id="fvCap">…</span>
        <button class="fv-btn" data-fv="next" title="Nächste Folie" aria-label="Nächste Folie">›</button>
        <span class="fv-sp"></span>
        <button class="fv-btn" data-fv="out" title="Kleiner" aria-label="Kleiner">−</button>
        <button class="fv-btn" data-fv="in" title="Größer" aria-label="Größer">+</button>
        <button class="fv-btn" data-fv="close" title="Schließen" aria-label="Schließen">✕</button>
      </div>
      <div class="folien-scroll">
        <img class="folien-img" id="fvImg" alt="Vorlesungsfolie" draggable="false">
        <div class="folien-msg" id="fvMsg" hidden></div>
      </div>
      <div class="folien-foot">
        <span class="fv-hint" id="fvHint"></span>
        <a class="beleg law" id="fvExt" target="_blank" rel="noopener" href="#">Folie einzeln öffnen ↗</a>
      </div>
    </div>`;
  document.body.appendChild(ov);
  ov.addEventListener("click", (e) => {
    if (e.target === ov) return schliesse();
    const b = e.target.closest("[data-fv]"); if (!b) return;
    const a = b.dataset.fv;
    if (a === "close") schliesse();
    else if (a === "prev") gehe(vState.seite - 1);
    else if (a === "next") gehe(vState.seite + 1);
    else if (a === "in") setZoom(vState.zoom + 0.25);
    else if (a === "out") setZoom(vState.zoom - 0.25);
  });
  const img = ov.querySelector("#fvImg");
  img.addEventListener("error", () => {
    const msg = ov.querySelector("#fvMsg");
    msg.hidden = false;
    msg.innerHTML = `Diese Folie ließ sich nicht laden (offline?).<br>Beim nächsten Mal online wird sie gespeichert.`;
  });
  img.addEventListener("load", () => { ov.querySelector("#fvMsg").hidden = true; });
  document.addEventListener("keydown", tasten);
  return ov;
}

function tasten(e) {
  if (!vState) return;
  if (e.key === "Escape") schliesse();
  else if (e.key === "ArrowLeft") gehe(vState.seite - 1);
  else if (e.key === "ArrowRight") gehe(vState.seite + 1);
}

function schliesse() {
  if (!vState) return;
  document.removeEventListener("keydown", tasten);
  vState.ov.remove();
  vState = null;
}

function setZoom(z) {
  vState.zoom = Math.min(3, Math.max(1, +z.toFixed(2)));
  vState.img.style.width = (vState.zoom * 100) + "%";
}

function gehe(seite) {
  seite = Math.min(TOTAL, Math.max(1, seite));
  if (!vState || seite === vState.seite) return;
  vState.seite = seite;
  vState.quelle = ""; // ab jetzt nur noch Foliennummer, kein Sitzungsbezug mehr
  zeige();
}

function zeige() {
  const st = vState; if (!st) return;
  st.img.style.width = "100%"; st.zoom = 1;
  st.img.src = bildUrl(st.seite);
  st.ov.querySelector("#fvMsg").hidden = true;
  st.capEl.textContent = st.quelle ? st.quelle : `Folie ${st.seite} / ${TOTAL}`;
  st.ov.querySelector("#fvExt").href = bildUrl(st.seite);
  const hint = st.ov.querySelector("#fvHint");
  hint.textContent = `Folie ${st.seite} / ${TOTAL} · aufgedruckte Nummern können abweichen — mit ‹ › justieren`;
  st.ov.querySelector(".folien-scroll").scrollTo(0, 0);
}

export function oeffneFolie(seite, cap) {
  seite = Math.min(TOTAL, Math.max(1, +seite || 1));
  const ov = baueOverlay();
  vState = { seite, quelle: cap || "", zoom: 1, ov, img: ov.querySelector("#fvImg"), capEl: ov.querySelector("#fvCap") };
  zeige();
}

// ---- Skript-Panel: die GANZE Folien-PDF neben der Klausur ------------------
// In der echten Klausur liegt die komplette PDF offen (scrollen, Strg+F) —
// nicht die passende Folie. Das Panel lebt direkt im <body> und uebersteht
// damit das Neu-Rendern beim Fragenblaettern: Scrollposition/Suchtreffer
// bleiben stehen ("last opened stays"). Desktop: echte PDF im Browser-Viewer
// (mit Suche). Mobil rendern Browser keine PDFs inline -> Fallback ist eine
// scrollbare Bilderliste aller 317 Folien (lazy geladen); umschaltbar.
const KANN_PDF = !/iPhone|iPod|iPad|Android/i.test(navigator.userAgent);
export const SKRIPT_URL = "data/folien/skript.pdf";
let sk = null; // { el, modus: "pdf"|"bilder", onClose }

export function skriptOffen() { return !!sk; }

function malSkript() {
  const body = sk.el.querySelector("#skBody");
  if (sk.modus === "pdf") {
    body.innerHTML = `<iframe class="sk-pdf" src="${SKRIPT_URL}#view=FitH" title="Vorlesungsfolien (PDF)"></iframe>`;
  } else {
    // Bilderliste: identischer Inhalt, laeuft ueberall; nur getippte/gescrollte
    // Folien werden geladen (loading=lazy)
    body.innerHTML = Array.from({ length: TOTAL }, (_, i) =>
      `<div class="sk-folie"><img loading="lazy" src="${bildUrl(i + 1)}" alt="Folie ${i + 1}"><span>${i + 1}</span></div>`).join("");
  }
  const mb = sk.el.querySelector("#skModus");
  mb.textContent = sk.modus === "pdf" ? "als Bilder" : (KANN_PDF ? "als PDF" : "");
  mb.hidden = !KANN_PDF && sk.modus === "bilder";
}

export function oeffneSkript(opts = {}) {
  if (sk) { sk.onClose = opts.onClose || sk.onClose; return; }
  const el = document.createElement("aside");
  el.className = "skript-panel";
  el.innerHTML = `
    <div class="sk-bar"><b>📕 Skript</b><span class="sk-sub">alle ${TOTAL} Folien${KANN_PDF ? " · Suche: Strg/Cmd+F im PDF" : ""}</span>
      <span class="fv-sp"></span>
      <button class="fv-btn" id="skModus" title="Ansicht wechseln"></button>
      <button class="fv-btn" id="skClose" title="Skript schließen" aria-label="Skript schließen">✕</button></div>
    <div class="sk-body" id="skBody"></div>`;
  document.body.appendChild(el);
  document.body.classList.add("skript-offen");
  sk = { el, modus: KANN_PDF ? "pdf" : "bilder", onClose: opts.onClose || null };
  malSkript();
  el.querySelector("#skModus").onclick = () => { sk.modus = sk.modus === "pdf" ? "bilder" : "pdf"; malSkript(); };
  el.querySelector("#skClose").onclick = () => { const cb = sk.onClose; schliesseSkript(); if (cb) cb(); };
}

export function schliesseSkript() {
  if (!sk) return;
  sk.el.remove();
  document.body.classList.remove("skript-offen");
  sk = null;
}

// Delegierter Klick-Handler fuer alle Folien-Chips (einmalig installiert).
document.addEventListener("click", (e) => {
  const chip = e.target.closest(".beleg.folie");
  if (!chip) return;
  e.preventDefault();
  oeffneFolie(+chip.dataset.seite, chip.dataset.cap);
});
