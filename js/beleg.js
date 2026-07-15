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
const TOTAL = 317;
const bildUrl = (seite) => `data/folien/folie-${String(seite).padStart(3, "0")}.jpg`;

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export function folienSeite(thema, folie) {
  const off = OFFSET[thema];
  if (off == null || !Number.isFinite(folie)) return null;
  return Math.min(TOTAL, Math.max(1, folie + off));
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

// Delegierter Klick-Handler fuer alle Folien-Chips (einmalig installiert).
document.addEventListener("click", (e) => {
  const chip = e.target.closest(".beleg.folie");
  if (!chip) return;
  e.preventDefault();
  oeffneFolie(+chip.dataset.seite, chip.dataset.cap);
});
