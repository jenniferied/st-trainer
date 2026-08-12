/* Maskottchen — Stufe 1: das Ei.
   Sitzt oben in der Tagesziel-Karte. Es sammelt Herzen aus dem, was Rose
   ohnehin uebt, und kommt dem Schluepfen naeher. Was drin ist, sagt es nicht.

   Waehrung sind HERZEN, nicht richtige Antworten: pro Uebungstag eins fuers
   Anfangen, eins fuers Minimum, eins fuers Tagespensum. Das belohnt Auftauchen
   statt Koennen — ein zaeher Tag mit drei Karten zahlt trotzdem. Das Streckziel
   gibt stattdessen einen Stern.

   Die Historie wird rueckwirkend gerechnet: Rose faengt nicht bei null an,
   sondern bekommt gutgeschrieben, was sie seit Juli geleistet hat.

   Ablauf beim ersten Mal:
     1. "Da war jemand am Nest"  — es ist nur klar, dass etwas da ist
     2. Auswahl wie beim Starter — drei Eier, eins nach dem anderen, mit einem
        Hinweis, der etwas ueber den Charakter andeutet und nichts verraet
     3. danach die kompakte Ansicht mit Herzen

   WICHTIG: Der Ankunfts-Schalter liegt ABSICHTLICH geraetelokal und nicht im
   synchronisierten state. Sonst wuerde ein Test auf Jennifers Geraet Rose die
   Ankunft wegnehmen, bevor sie sie gesehen hat. Die gewaehlte Ei-Variante
   dagegen gehoert in den state, damit sie ueber den Sync mitwandert.

   Entwurf, Archiv und Werkstatt: playground/rose/maskottchen/ */
import * as C from "./core.js";

const REDUCE_MOTION = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
const ANKUNFT_KEY = "st-mk-ankunft";   // geraetelokal, siehe Kopfkommentar

/* ---------- Herzen aus der echten Uebungshistorie ----------
   Fuer vergangene Tage ist der damalige Tagesplan nicht gespeichert; wir
   rechnen sie mit den heutigen Schwellen. Grosszuegig gerundet und bewusst so:
   bei einer Belohnungswaehrung ist ein Herz zu viel harmlos, eines zu wenig
   fuehlt sich wie Betrug an. */
export function herzenStand(tz) {
  const min = tz && tz.minimum ? tz.minimum : 15;
  const ziel = tz && tz.ziel ? tz.ziel : 35;
  const stretch = tz && tz.stretch ? tz.stretch : 55;
  const akt = C.aktivitaetProTag();
  let herzen = 0, sterne = 0, tage = 0;
  for (const key of Object.keys(akt)) {
    const n = akt[key].n || 0;
    if (!n) continue;
    tage++;
    herzen += 1 + (n >= min ? 1 : 0) + (n >= ziel ? 1 : 0);
    if (n >= stretch) sterne++;
  }
  return { herzen, sterne, tage };
}

const STUFEN = [
  { ab: 0,  satz: "Da liegt ein Ei im Nest. Keine Ahnung, wo das herkommt." },
  { ab: 20, satz: "Das Ei hat sich bewegt. Nur ein bisschen, aber es hat." },
  { ab: 45, satz: "Es knackt. Da will jemand raus — bald ist es so weit." },
];
export const stufeVon = (herzen) => { let i = 0; STUFEN.forEach((s, k) => { if (herzen >= s.ab) i = k; }); return i; };

/* ---------- Das Ei, Blockgrafik ----------
   Volle Flaeche statt Umriss: ein Ei ist ein Gegenstand, da traegt die
   Fuellung. Die Musterung ist keine andere Zeichenart, sondern nur eine zweite
   Farbe auf denselben Bloecken — dadurch kann nichts verrutschen. */
const EI_FORM = [
  "   ▄▄▄▄▄   ",
  "  ▟█████▙  ",
  " ▐███████▌ ",
  " ▐███████▌ ",
  " ▝███████▘ ",
  "   ▀▀▀▀▀   ",
];
const VOLL = "█▟▙▐▌▝▘▄▀";

/* Die drei Eier. Der Hinweis deutet Temperament an und verraet nichts.
   Im GE-Trainer liegen bewusst ANDERE drei. */
export const EIER = [
  { key: "streifen", name: "Gestreift", muster: (z, sp) => sp % 3 === 1,
    teaser: "Warm. Und es hat sich schon zweimal gedreht, als du weggeschaut hast." },
  { key: "tupfen", name: "Getupft", muster: (z, sp) => (z * 3 + sp) % 5 === 0,
    teaser: "Kühl und ruhig. Wenn man die Hand drauflegt, wird es langsam wärmer." },
  { key: "zickzack", name: "Zickzack", muster: (z, sp) => (z + sp) % 4 === 0,
    teaser: "Es knistert leise, sobald man näher kommt. Neugierig, würde ich sagen." },
];
export const eiIndex = () => {
  const k = C.state().settings.mkEi;
  const i = EIER.findIndex((e) => e.key === k);
  return i < 0 ? 0 : i;
};

function eiEbenen(variante, stufe) {
  const zeilen = EI_FORM.slice();
  const maske = EI_FORM.map((zeile, z) =>
    zeile.split("").map((ch, sp) => (VOLL.indexOf(ch) < 0 ? " " : variante.muster(z, sp) ? "M" : "F")).join(""));
  const setz = (z, sp, text, m) => {
    const a = zeilen[z].split(""), b = maske[z].split("");
    for (let i = 0; i < text.length; i++) { a[sp + i] = text[i]; b[sp + i] = m; }
    zeilen[z] = a.join(""); maske[z] = b.join("");
  };
  if (stufe >= 1) setz(2, 5, "╷", "R");
  if (stufe >= 2) { setz(2, 4, "╲╱", "R"); setz(3, 5, "╱", "R"); }
  return { zeilen, maske };
}
const FARBE = { F: "var(--mk-fell)", M: "var(--mk-muster)", R: "var(--mk-riss)" };

export function eiHtml(variante, stufe) {
  const { zeilen, maske } = eiEbenen(variante, stufe);
  return zeilen.map((zeile, i) => {
    let out = "", puffer = "", k = null;
    const spuelen = () => {
      if (!puffer) return;
      out += k === " " ? puffer : `<span style="color:${FARBE[k]}">${puffer}</span>`;
      puffer = "";
    };
    for (let j = 0; j < zeile.length; j++) {
      const kk = maske[i][j] || " ";
      if (kk !== k) { spuelen(); k = kk; }
      puffer += zeile[j];
    }
    spuelen();
    return out;
  }).join("\n");
}

/* ---------- Zustand des Ankunfts-Ablaufs ---------- */
const phase = () => localStorage.getItem(ANKUNFT_KEY) || "";       // "" | "gesehen" | "fertig"
const setzePhase = (p) => localStorage.setItem(ANKUNFT_KEY, p);
export function zuruecksetzen() { localStorage.removeItem(ANKUNFT_KEY); C.state().settings.mkEi = null; C.save(); }

/* Welches Ei die Auswahl gerade zeigt (nur waehrend der Auswahl). */
let blaetterIdx = 0;

/* ---------- Ansichten ---------- */
function ankunftHtml() {
  return `<div class="mk-ankunft">
    <div class="mk-ank-kopf">🥚 Da war jemand am Nest.</div>
    <p class="mk-ank-text">Etwas ist angekommen, während du geübt hast. Es liegen drei da — eins davon darf bei dir bleiben.</p>
    <button class="btn small" data-mk-ankunft="gesehen">Nachsehen</button>
  </div>`;
}

function auswahlHtml() {
  const v = EIER[blaetterIdx];
  const punkte = EIER.map((e, i) => `<span class="${i === blaetterIdx ? "an" : ""}">●</span>`).join("");
  return `<div class="mk-ankunft">
    <div class="mk-ank-kopf">Welches nimmst du mit?</div>
    <div class="mk-karussell" data-mk-swipe>
      <button class="mk-pfeil" data-mk-nav="-1" aria-label="Vorheriges Ei">‹</button>
      <pre class="mk-ei gross" aria-hidden="true">${eiHtml(v, 0)}</pre>
      <button class="mk-pfeil" data-mk-nav="1" aria-label="Nächstes Ei">›</button>
    </div>
    <div class="mk-punkte">${punkte}</div>
    <p class="mk-teaser">${v.teaser}</p>
    <button class="btn small" data-mk-nimm="${v.key}">Das nehme ich</button>
  </div>`;
}

function standHtml(tz) {
  const st = herzenStand(tz);
  const stufe = stufeVon(st.herzen);
  const naechste = STUFEN[stufe + 1];
  const stunde = new Date().getHours();
  const nacht = stunde >= 22 || stunde < 6;
  const v = EIER[eiIndex()];
  const anim = REDUCE_MOTION || stufe === 0 ? "" : stufe === 1 ? " mk-atmet" : " mk-wackelt";
  const satz = nacht ? "Das Ei ist still. Morgen früh sind wir wieder da." : STUFEN[stufe].satz;
  const rest = naechste ? `noch ${naechste.ab - st.herzen} ♥ bis es weitergeht` : "gleich passiert was";
  const sterne = st.sterne ? ` · <b>${st.sterne}</b> ★` : "";
  return `<div class="mk-zeile">
    <pre class="mk-ei${anim}" aria-hidden="true">${eiHtml(v, stufe)}</pre>
    <div class="mk-text">
      <p class="mk-satz">${satz}</p>
      <p class="mk-meta"><b>${st.herzen}</b> ♥${sterne} aus ${st.tage} Übungstagen — ${rest}
        · <button class="mk-link" data-mk-ankunft="gesehen">anderes Ei</button></p>
    </div>
  </div>`;
}

export function html(tz) {
  const p = phase();
  if (!p) return ankunftHtml();
  if (p === "gesehen") return auswahlHtml();
  return standHtml(tz);
}

/* ---------- Klicks und Wischen ---------- */
export function binde(wurzel, neuZeichnen) {
  wurzel.querySelectorAll("[data-mk-ankunft]").forEach((b) => b.onclick = () => {
    blaetterIdx = eiIndex();
    setzePhase("gesehen");
    neuZeichnen();
  });
  wurzel.querySelectorAll("[data-mk-nav]").forEach((b) => b.onclick = () => {
    blaetterIdx = (blaetterIdx + +b.dataset.mkNav + EIER.length) % EIER.length;
    neuZeichnen();
  });
  wurzel.querySelectorAll("[data-mk-nimm]").forEach((b) => b.onclick = () => {
    C.state().settings.mkEi = b.dataset.mkNimm;
    C.save();
    setzePhase("fertig");
    neuZeichnen();
  });
  // Wischen am Handy: Rose übt mobil, Pfeile allein wären zu klein
  wurzel.querySelectorAll("[data-mk-swipe]").forEach((box) => {
    let x0 = null;
    box.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    box.addEventListener("touchend", (e) => {
      if (x0 == null) return;
      const dx = e.changedTouches[0].clientX - x0;
      x0 = null;
      if (Math.abs(dx) < 30) return;
      blaetterIdx = (blaetterIdx + (dx < 0 ? 1 : -1) + EIER.length) % EIER.length;
      neuZeichnen();
    }, { passive: true });
  });
}
